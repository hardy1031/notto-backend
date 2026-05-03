import type { AIService } from "../domain/ai/AIService.ts"
import { ContextObjectEntity } from "../domain/contextObject/ContextObjectEntity.ts"
import type { ContextObjectRepository } from "../domain/contextObject/ContextObjectRepository.ts"
import { QuizEntity } from "../domain/contextObject/quiz/QuizEntity.ts"
import type { QuizRepository } from "../domain/contextObject/quiz/QuizRepository.ts"
import { NotePieceEntity } from "../domain/note/notePiece/NotePieceEntity.ts"
import type { NoteEntity } from "../domain/note/NoteEntity.ts"
import type { NotePieceContent } from "../domain/types.ts"
import { parsedNoteSchema } from "../schemas/sync.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import type { ContextObjectQueryService } from "./queries/ContextObjectQueryService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"

export type GenerateQuizzesInput = {
  userId: string
  allNotes: NoteEntity[]
}

export async function GenerateQuizzesUseCase(
  input: GenerateQuizzesInput,
  deps: {
    noteStorage: NoteStorageService
    notePieceRepo: NotePieceQueryService
    contextObjectRepo: ContextObjectRepository
    contextObjectQueryService: ContextObjectQueryService
    quizRepo: QuizRepository
    aiRepo: AIService
  }
): Promise<void> {
  const { userId, allNotes } = input
  const allNoteIds = allNotes.map((note) => note.id)

  if (allNoteIds.length === 0) return

  // find note pieces that have not been interpreted into context objects yet
  const notePieces = await deps.notePieceRepo.findByNoteIds(allNoteIds)
  const existingContextObjects = await deps.contextObjectQueryService.findByUserId(userId)
  const uninterpretedPieces = NotePieceEntity.findUninterpreted(notePieces, existingContextObjects)

  // build a map of parsed notes fetched from storage (lazy, cached per note)
  const parsedNoteCache = new Map<string, NotePieceContent[]>()
  const getNotePieceContents = async (noteId: string): Promise<NotePieceContent[]> => {
    if (parsedNoteCache.has(noteId)) return parsedNoteCache.get(noteId)!
    const note = allNotes.find((n) => n.id === noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)
    const json = await deps.noteStorage.fetch(note.s3Key)
    const parsed = parsedNoteSchema.parse(JSON.parse(json))
    parsedNoteCache.set(noteId, parsed)
    return parsed
  }

  // combines NotePieceEntity (from DB) with expression/annotation (from S3)
  type NotePieceWithContent = {
    notePieceEntity: NotePieceEntity
    expression: string
    annotation: string
  }

  const piecesWithContent: NotePieceWithContent[] = []
  for (const piece of uninterpretedPieces) {
    const parsedNote = await getNotePieceContents(piece.noteId)
    const pieceContent = parsedNote.find((content) => content.notePieceId === piece.id)
    if (!pieceContent) continue
    piecesWithContent.push({
      notePieceEntity: piece,
      expression: pieceContent.expression,
      annotation: pieceContent.annotation,
    })
  }

  // generate context objects from uninterpreted note pieces using AI
  const generatedContextObjects =
    piecesWithContent.length > 0
      ? await deps.aiRepo.generateContextObjects(
          piecesWithContent.map((pieceWithContent) => ({
            expression: pieceWithContent.expression,
            annotation: pieceWithContent.annotation,
          }))
        )
      : []

  const now = new Date()
  const newContextObjects: ContextObjectEntity[] = piecesWithContent.map(
    (pieceWithContent, i) =>
      ContextObjectEntity.fromAIOutput(
        generatedContextObjects[i]!,
        pieceWithContent.notePieceEntity.id,
        pieceWithContent.notePieceEntity.noteId,
        crypto.randomUUID(),
        now
      )
  )

  if (newContextObjects.length > 0) {
    await deps.contextObjectRepo.bulkCreate(newContextObjects)
  }

  // generate quizzes for context objects that don't have one yet using AI
  const contextObjectsWithoutQuizzes =
    await deps.contextObjectQueryService.findWithoutQuizzes(allNoteIds)
  const generatedQuizItems = await deps.aiRepo.generateQuizzes(contextObjectsWithoutQuizzes)

  const newQuizzes: QuizEntity[] = generatedQuizItems.map((generatedQuizItem) => {
    const contextObject = contextObjectsWithoutQuizzes[generatedQuizItem.contextObjectIndex]
    if (!contextObject)
      throw new Error(`Invalid context_object_index: ${generatedQuizItem.contextObjectIndex}`)
    return QuizEntity.fromAIOutput(generatedQuizItem, contextObject, crypto.randomUUID(), now)
  })

  if (newQuizzes.length > 0) {
    await deps.contextObjectRepo.bulkCreateQuizzes(newQuizzes)
  }
}

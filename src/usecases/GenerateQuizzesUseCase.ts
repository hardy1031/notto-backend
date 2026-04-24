import type { AIService } from "../domain/ai/AIService.ts"
import { ContextObjectEntity } from "../domain/contextObject/ContextObjectEntity.ts"
import type { ContextObjectRepository } from "../domain/contextObject/ContextObjectRepository.ts"
import { QuizEntity } from "../domain/contextObject/quiz/QuizEntity.ts"
import { NotePieceEntity } from "../domain/note/NotePieceEntity.ts"
import type { NotePieceContent } from "../domain/types.ts"
import { parsedNoteSchema } from "../schemas/sync.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import type { ContextObjectQueryService } from "./queries/ContextObjectQueryService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"
import type { NoteQueryService } from "./queries/NoteQueryService.ts"
import type { QuizQueryService } from "./queries/QuizQueryService.ts"

export type GenerateQuizzesInput = {
  userId: string
  clientContextObjectIds: string[]
  clientQuizIds: string[]
}

export type GenerateQuizzesOutput = {
  contextObjects: ContextObjectEntity[]
  quizzes: QuizEntity[]
}

export async function GenerateQuizzesUseCase(
  input: GenerateQuizzesInput,
  deps: {
    noteRepo: NoteQueryService
    noteStorage: NoteStorageService
    notePieceRepo: NotePieceQueryService
    contextObjectRepo: ContextObjectRepository
    contextObjectQueryService: ContextObjectQueryService
    quizQueryService: QuizQueryService
    aiRepo: AIService
  }
): Promise<GenerateQuizzesOutput> {
  const { userId, clientContextObjectIds, clientQuizIds } = input

  // get all note IDs for the user
  const allNotes = await deps.noteRepo.findByUserId(userId)
  const allNoteIds = allNotes.map((note) => note.id)

  if (allNoteIds.length === 0) return { contextObjects: [], quizzes: [] }

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

  // collect pieces with their content, then generate all context objects in one AI call
  const piecesWithContent: {
    piece: (typeof uninterpretedPieces)[number]
    expression: string
    annotation: string
  }[] = []
  for (const piece of uninterpretedPieces) {
    const parsedNote = await getNotePieceContents(piece.noteId)
    const pieceContent = parsedNote.find((p) => p.notePieceId === piece.id)
    if (!pieceContent) continue
    piecesWithContent.push({
      piece,
      expression: pieceContent.expression,
      annotation: pieceContent.annotation,
    })
  }

  const generatedContextObjects =
    piecesWithContent.length > 0
      ? await deps.aiRepo.generateContextObjects(
          piecesWithContent.map((p) => ({ expression: p.expression, annotation: p.annotation }))
        )
      : []

  const now = new Date()
  const newContextObjects: ContextObjectEntity[] = piecesWithContent.map((p, i) =>
    ContextObjectEntity.fromGenerated(
      generatedContextObjects[i]!,
      p.piece.id,
      p.piece.noteId,
      crypto.randomUUID(),
      now
    )
  )

  if (newContextObjects.length > 0) {
    await deps.contextObjectRepo.bulkCreate(newContextObjects)
  }

  // generate quizzes for context objects that don't have quizzes yet
  const contextObjectsWithoutQuizzes =
    await deps.contextObjectQueryService.findWithoutQuizzes(allNoteIds)
  const generatedQuizItems = await deps.aiRepo.generateQuizzes(contextObjectsWithoutQuizzes)

  const newQuizzes: QuizEntity[] = generatedQuizItems.map((generatedQuizItem) => {
    const contextObject = contextObjectsWithoutQuizzes[generatedQuizItem.contextObjectIndex]
    if (!contextObject)
      throw new Error(`Invalid context_object_index: ${generatedQuizItem.contextObjectIndex}`)
    return QuizEntity.fromGenerated(generatedQuizItem, contextObject, crypto.randomUUID(), now)
  })

  if (newQuizzes.length > 0) {
    await deps.contextObjectRepo.bulkCreateQuizzes(newQuizzes)
  }

  // return context objects and quizzes the server has that the client does not
  const clientContextObjectIdSet = new Set(clientContextObjectIds)
  const clientQuizIdSet = new Set(clientQuizIds)

  const allContextObjects = await deps.contextObjectQueryService.findByUserId(userId)
  const allContextObjectIds = allContextObjects.map((co) => co.id)
  const allQuizzes =
    allContextObjectIds.length > 0
      ? await deps.quizQueryService.findByContextObjectIds(allContextObjectIds)
      : []

  return {
    contextObjects: allContextObjects.filter((co) => !clientContextObjectIdSet.has(co.id)),
    quizzes: allQuizzes.filter((q) => !clientQuizIdSet.has(q.id)),
  }
}

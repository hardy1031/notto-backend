import type { AIService } from "../domain/ai/AIService.ts"
import { ContextObjectEntity } from "../domain/contextObject/ContextObjectEntity.ts"
import type { ContextObjectRepository } from "../domain/contextObject/ContextObjectRepository.ts"
import { QuizEntity } from "../domain/contextObject/quiz/QuizEntity.ts"
import type { QuizRepository } from "../domain/contextObject/quiz/QuizRepository.ts"
import { NotePieceEntity } from "../domain/note/notePiece/NotePieceEntity.ts"
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
  deletedQuizIds: string[]
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
    quizRepo: QuizRepository
    aiRepo: AIService
  }
): Promise<GenerateQuizzesOutput> {
  const { userId, clientContextObjectIds, clientQuizIds, deletedQuizIds } = input

  // process quiz deletions first
  for (const quizId of deletedQuizIds) {
    await deps.quizRepo.softDelete(quizId, new Date())
  }

  // get all non-deleted note IDs for the user
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
    ContextObjectEntity.fromAIOutput(
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

  // return context objects and quizzes for sync:
  // - new for client: server has it, client doesn't, not deleted
  // - tombstones: client has it, server has deleted_at set
  const clientContextObjectIdSet = new Set(clientContextObjectIds)
  const clientQuizIdSet = new Set(clientQuizIds)

  const allContextObjects = await deps.contextObjectQueryService.findByUserId(userId)
  const allQuizzes = await deps.quizQueryService.findAllForSync(userId)

  const contextObjectsForClient = allContextObjects.filter(
    (co) => !clientContextObjectIdSet.has(co.id)
  )

  const quizzesForClient = allQuizzes.filter(
    (q) =>
      (!clientQuizIdSet.has(q.id) && !q.isDeleted) || // new for client
      (clientQuizIdSet.has(q.id) && q.isDeleted) // tombstone
  )

  return {
    contextObjects: contextObjectsForClient,
    quizzes: quizzesForClient,
  }
}

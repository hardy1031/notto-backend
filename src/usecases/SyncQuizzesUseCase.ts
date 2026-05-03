import type { AIService } from "../domain/ai/AIService.ts"
import type { ContextObjectEntity } from "../domain/contextObject/ContextObjectEntity.ts"
import type { ContextObjectRepository } from "../domain/contextObject/ContextObjectRepository.ts"
import type { QuizEntity } from "../domain/contextObject/quiz/QuizEntity.ts"
import type { QuizRepository } from "../domain/contextObject/quiz/QuizRepository.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import { GenerateQuizzesUseCase } from "./GenerateQuizzesUseCase.ts"
import type { ContextObjectQueryService } from "./queries/ContextObjectQueryService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"
import type { NoteQueryService } from "./queries/NoteQueryService.ts"
import type { QuizQueryService } from "./queries/QuizQueryService.ts"

export type SyncQuizzesInput = {
  userId: string
  clientContextObjectIds: string[]
  clientQuizIds: string[]
  deletedQuizIds: string[]
}

export type SyncQuizzesOutput = {
  contextObjects: ContextObjectEntity[]
  quizzes: QuizEntity[]
}

export async function SyncQuizzesUseCase(
  input: SyncQuizzesInput,
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
): Promise<SyncQuizzesOutput> {
  const { userId, clientContextObjectIds, clientQuizIds, deletedQuizIds } = input

  // process quiz deletions first
  for (const quizId of deletedQuizIds) {
    await deps.quizRepo.softDelete(quizId, new Date())
  }

  const allNotes = await deps.noteRepo.findByUserId(userId)

  await GenerateQuizzesUseCase(
    { userId, allNotes },
    {
      noteStorage: deps.noteStorage,
      notePieceRepo: deps.notePieceRepo,
      contextObjectRepo: deps.contextObjectRepo,
      contextObjectQueryService: deps.contextObjectQueryService,
      quizRepo: deps.quizRepo,
      aiRepo: deps.aiRepo,
    }
  )

  // return context objects and quizzes for sync:
  // - new for client: server has it, client doesn't, not deleted
  // - tombstones: client has it, server has deleted_at set
  const clientContextObjectIdSet = new Set(clientContextObjectIds)
  const clientQuizIdSet = new Set(clientQuizIds)

  const allContextObjects = await deps.contextObjectQueryService.findByUserId(userId)
  const allQuizzes = await deps.quizQueryService.findAllForSync(userId)

  const contextObjectsForClient = allContextObjects.filter(
    (contextObject) => !clientContextObjectIdSet.has(contextObject.id)
  )

  const quizzesForClient = allQuizzes.filter(
    (quiz) =>
      (!clientQuizIdSet.has(quiz.id) && !quiz.isDeleted) || // new for client
      (clientQuizIdSet.has(quiz.id) && quiz.isDeleted) // tombstone
  )

  return {
    contextObjects: contextObjectsForClient,
    quizzes: quizzesForClient,
  }
}

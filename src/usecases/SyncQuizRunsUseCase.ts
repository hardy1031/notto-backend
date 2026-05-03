import {
  QuizRecordEntity,
  QuizRunEntity,
  type QuizRunWithRecords,
} from "../domain/quizRun/QuizRunEntity.ts"
import type { QuizRunRepository } from "../domain/quizRun/QuizRunRepository.ts"
import { NotFoundError } from "../errors/index.ts"
import type { QuizQueryService } from "./queries/QuizQueryService.ts"
import type { QuizRunQueryService } from "./queries/QuizRunQueryService.ts"

export type SyncQuizRunRecordInput = {
  id: string
  quizId: string
  choices: string[]
  userAnswer: string
  isCorrect: boolean
  createdAt: Date
}

export type SyncQuizRunInput = {
  id: string
  startedAt: Date
  completedAt: Date | null
  records: SyncQuizRunRecordInput[]
}

export type SyncQuizRunsOutput = {
  quizRuns: QuizRunWithRecords[]
}

export async function SyncQuizRunsUseCase(
  input: {
    userId: string
    quizRuns: SyncQuizRunInput[]
  },
  deps: {
    quizQueryService: QuizQueryService
    quizRunRepo: QuizRunRepository
    quizRunQueryService: QuizRunQueryService
  }
): Promise<SyncQuizRunsOutput> {
  const { userId, quizRuns } = input
  const clientQuizRunIds = quizRuns.map((quizRun) => quizRun.id)

  // insert quiz runs the server does not have yet
  if (quizRuns.length > 0) {
    const existingQuizRuns = await deps.quizRunQueryService.findByUserIdAndIds(
      userId,
      clientQuizRunIds
    )
    const existingIds = new Set(existingQuizRuns.map((quizRun) => quizRun.quizRun.id))

    for (const quizRun of quizRuns) {
      if (existingIds.has(quizRun.id)) continue

      // validate that all quizzes in the records belong to the user
      for (const record of quizRun.records) {
        const quiz = await deps.quizQueryService.findByIdAndUserId(record.quizId, userId)
        if (!quiz) throw new NotFoundError(`Quiz not found: ${record.quizId}`)
      }

      const quizRunEntity = QuizRunEntity.create({
        id: quizRun.id,
        userId,
        startedAt: quizRun.startedAt,
        completedAt: quizRun.completedAt,
        syncedAt: new Date(),
      })
      const quizRecords = quizRun.records.map((record) =>
        QuizRecordEntity.create({
          id: record.id,
          quizRunId: quizRun.id,
          quizId: record.quizId,
          choices: record.choices,
          userAnswer: record.userAnswer,
          isCorrect: record.isCorrect,
          createdAt: record.createdAt,
        })
      )
      await deps.quizRunRepo.save(quizRunEntity, quizRecords)
    }
  }

  if (clientQuizRunIds.length > 0) {
    await deps.quizRunRepo.updateSyncedAt(clientQuizRunIds, new Date())
  }

  // return quiz runs the server has that the client does not
  const clientIdSet = new Set(clientQuizRunIds)
  const allServerQuizRuns = await deps.quizRunQueryService.findByUserId(userId)
  const newQuizRuns = allServerQuizRuns.filter((quizRun) => !clientIdSet.has(quizRun.quizRun.id))

  return { quizRuns: newQuizRuns }
}

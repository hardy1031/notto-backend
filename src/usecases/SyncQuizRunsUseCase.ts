import { NotFoundError } from "../errors/index.ts"
import type { QuizRepository } from "../repositories/quizRepository.ts"
import type { QuizRunRepository } from "../repositories/quizRunRepository.ts"
import type { QuizRecord, QuizRun } from "../repositories/types.ts"

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
  quizRuns: {
    quizRun: QuizRun
    quizRecords: QuizRecord[]
  }[]
}

export async function SyncQuizRunsUseCase(
  input: {
    userId: string
    quizRuns: SyncQuizRunInput[]
  },
  deps: {
    quizRepo: QuizRepository
    quizRunRepo: QuizRunRepository
  }
): Promise<SyncQuizRunsOutput> {
  const { userId, quizRuns } = input

  // insert quiz runs the server does not have yet
  if (quizRuns.length > 0) {
    const clientQuizRunIds = quizRuns.map((qr) => qr.id)
    const existingQuizRuns = await deps.quizRunRepo.findByUserIdAndIds(userId, clientQuizRunIds)
    const existingIds = new Set(existingQuizRuns.map((qr) => qr.quizRun.id))

    for (const quizRun of quizRuns) {
      if (existingIds.has(quizRun.id)) continue

      // validate that all quizzes in the records belong to the user
      for (const record of quizRun.records) {
        const quiz = await deps.quizRepo.findByIdAndUserId(record.quizId, userId)
        if (!quiz) throw new NotFoundError(`Quiz not found: ${record.quizId}`)
      }

      const quizRunEntity: QuizRun = {
        id: quizRun.id,
        userId,
        startedAt: quizRun.startedAt,
        completedAt: quizRun.completedAt,
      }
      const quizRecords: QuizRecord[] = quizRun.records.map((record) => ({
        id: record.id,
        quizRunId: quizRun.id,
        quizId: record.quizId,
        choices: record.choices,
        userAnswer: record.userAnswer,
        isCorrect: record.isCorrect,
        createdAt: record.createdAt,
      }))
      await deps.quizRunRepo.save(quizRunEntity, quizRecords)
    }
  }

  // return quiz runs the server has that the client does not
  const clientIdSet = new Set(quizRuns.map((qr) => qr.id))
  const allServerQuizRuns = await deps.quizRunRepo.findByUserId(userId)
  const newQuizRuns = allServerQuizRuns.filter((qr) => !clientIdSet.has(qr.quizRun.id))

  return { quizRuns: newQuizRuns }
}

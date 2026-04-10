import { NotFoundError } from "../errors/index.ts"
import type { QuizRepository } from "../repositories/quizRepository.ts"
import type { QuizRunRepository } from "../repositories/quizRunRepository.ts"
import type { QuizRecord, QuizRun } from "../repositories/types.ts"

export type SubmitQuizRunInput = {
  userId: string
  startedAt: Date
  completedAt: Date | null
  records: {
    quizId: string
    userAnswer: string
    isCorrect: boolean
  }[]
}

export type SubmitQuizRunOutput = {
  quizRun: QuizRun
  quizRecords: QuizRecord[]
}

export async function SubmitQuizRunUseCase(
  input: SubmitQuizRunInput,
  deps: {
    quizRepo: QuizRepository
    quizRunRepo: QuizRunRepository
  }
): Promise<SubmitQuizRunOutput> {
  for (const record of input.records) {
    const quiz = await deps.quizRepo.findByIdAndUserId(record.quizId, input.userId)
    if (!quiz) throw new NotFoundError(`Quiz not found: ${record.quizId}`)
  }

  const now = new Date()
  const quizRun: QuizRun = {
    id: crypto.randomUUID(),
    userId: input.userId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  }

  const quizRecords: QuizRecord[] = input.records.map((r) => ({
    id: crypto.randomUUID(),
    quizRunId: quizRun.id,
    quizId: r.quizId,
    userAnswer: r.userAnswer,
    isCorrect: r.isCorrect,
    createdAt: now,
  }))

  return deps.quizRunRepo.save(quizRun, quizRecords)
}

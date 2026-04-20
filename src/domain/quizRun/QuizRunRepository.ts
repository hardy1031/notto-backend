import type { QuizRecord, QuizRun } from "../types.ts"

/** Aggregate root: QuizRun (includes QuizRecord[]) */
export interface QuizRunRepository {
  save(
    quizRun: QuizRun,
    quizRecords: QuizRecord[]
  ): Promise<{ quizRun: QuizRun; quizRecords: QuizRecord[] }>
}

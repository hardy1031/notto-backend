import type { QuizRecord, QuizRun, QuizRunWithRecords } from "./types.ts"

export interface QuizRunRepository {
  findByUserId(userId: string): Promise<QuizRunWithRecords[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<QuizRunWithRecords[]>
  save(
    quizRun: QuizRun,
    quizRecords: QuizRecord[]
  ): Promise<{ quizRun: QuizRun; quizRecords: QuizRecord[] }>
}

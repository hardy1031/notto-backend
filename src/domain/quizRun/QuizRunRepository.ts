import type { QuizRecordEntity, QuizRunEntity, QuizRunWithRecords } from "./QuizRunEntity.ts"

/** Aggregate root: QuizRun (includes QuizRecord[]) */
export interface QuizRunRepository {
  save(quizRun: QuizRunEntity, quizRecords: QuizRecordEntity[]): Promise<QuizRunWithRecords>
  updateSyncedAt(ids: string[], syncedAt: Date): Promise<void>
}

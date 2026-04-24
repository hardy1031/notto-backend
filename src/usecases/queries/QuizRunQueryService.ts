import type { QuizRunWithRecords } from "../../domain/quizRun/QuizRunEntity.ts"

export interface QuizRunQueryService {
  findByUserId(userId: string): Promise<QuizRunWithRecords[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<QuizRunWithRecords[]>
}

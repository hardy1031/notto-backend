import type { QuizRunWithRecords } from "../../domain/types.ts"

export interface QuizRunQueryService {
  findByUserId(userId: string): Promise<QuizRunWithRecords[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<QuizRunWithRecords[]>
}

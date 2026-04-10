import type { Quiz } from "./types.ts"

export interface QuizRepository {
  findByContextObjectIds(contextObjectIds: string[]): Promise<Quiz[]>
  findByUserId(userId: string): Promise<Quiz[]>
  findByIdAndUserId(id: string, userId: string): Promise<Quiz | null>
  bulkCreate(quizzes: Quiz[]): Promise<void>
}

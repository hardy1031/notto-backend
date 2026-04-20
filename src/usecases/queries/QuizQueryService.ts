import type { Quiz } from "../../domain/types.ts"

export interface QuizQueryService {
  findByContextObjectIds(contextObjectIds: string[]): Promise<Quiz[]>
  findByUserId(userId: string): Promise<Quiz[]>
  findByIdAndUserId(id: string, userId: string): Promise<Quiz | null>
}

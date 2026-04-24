import type { QuizEntity } from "../../domain/contextObject/quiz/QuizEntity.ts"

export interface QuizQueryService {
  findByContextObjectIds(contextObjectIds: string[]): Promise<QuizEntity[]>
  findByUserId(userId: string): Promise<QuizEntity[]>
  findByIdAndUserId(id: string, userId: string): Promise<QuizEntity | null>
}

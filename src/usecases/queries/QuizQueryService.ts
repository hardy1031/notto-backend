import type { QuizEntity } from "../../domain/contextObject/quiz/QuizEntity.ts"

export interface QuizQueryService {
  findByContextObjectIds(contextObjectIds: string[]): Promise<QuizEntity[]>
  /** Returns non-deleted quizzes for the user. */
  findByUserId(userId: string): Promise<QuizEntity[]>
  findByIdAndUserId(id: string, userId: string): Promise<QuizEntity | null>
  /** Returns all quizzes including deleted ones — for sync tombstone detection. */
  findAllForSync(userId: string): Promise<QuizEntity[]>
}

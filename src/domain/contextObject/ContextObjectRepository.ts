import type { ContextObjectEntity } from "./ContextObjectEntity.ts"
import type { QuizEntity } from "./quiz/QuizEntity.ts"

/** Aggregate root: ContextObject (includes Quiz[]) */
export interface ContextObjectRepository {
  bulkCreate(contextObjects: ContextObjectEntity[]): Promise<void>
  bulkCreateQuizzes(quizzes: QuizEntity[]): Promise<void>
}

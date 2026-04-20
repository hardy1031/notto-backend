import type { ContextObject, Quiz } from "../types.ts"

/** Aggregate root: ContextObject (includes Quiz[]) */
export interface ContextObjectRepository {
  bulkCreate(contextObjects: ContextObject[]): Promise<void>
  bulkCreateQuizzes(quizzes: Quiz[]): Promise<void>
}

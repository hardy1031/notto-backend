import type { ContextObjectEntity } from "../contextObject/ContextObjectEntity.ts"
import type { AILearnResponse, GeneratedContextObject, GeneratedQuiz } from "../types.ts"

export interface AIService {
  generateContextObjects(
    pieces: { expression: string; annotation: string }[]
  ): Promise<GeneratedContextObject[]>
  generateQuizzes(contextObjects: ContextObjectEntity[]): Promise<GeneratedQuiz[]>
  askAI(contextObject: ContextObjectEntity, question: string): Promise<AILearnResponse>
}

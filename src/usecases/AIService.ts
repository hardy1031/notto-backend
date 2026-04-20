import type {
  AILearnResponse,
  ContextObject,
  GeneratedContextObject,
  GeneratedQuiz,
} from "../domain/types.ts"

export interface AIService {
  generateContextObjects(pieces: { expression: string; annotation: string }[]): Promise<GeneratedContextObject[]>
  generateQuizzes(contextObjects: ContextObject[]): Promise<GeneratedQuiz[]>
  askAI(contextObject: ContextObject, question: string): Promise<AILearnResponse>
}

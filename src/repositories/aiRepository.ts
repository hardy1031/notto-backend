import type {
  AILearnResponse,
  ContextObject,
  GeneratedContextObject,
  GeneratedQuiz,
} from "./types.ts"

export interface AIRepository {
  generateContextObjects(noteContent: string): Promise<GeneratedContextObject[]>
  generateQuizzes(contextObjects: ContextObject[]): Promise<GeneratedQuiz[]>
  askAI(contextObject: ContextObject, question: string): Promise<AILearnResponse>
}

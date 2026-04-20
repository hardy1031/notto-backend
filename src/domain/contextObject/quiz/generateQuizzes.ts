import type { AIService } from "../../../usecases/AIService.ts"
import type { ContextObject, GeneratedQuiz } from "../../types.ts"

export async function generateQuizzes(
  contextObjects: ContextObject[],
  aiRepo: AIService
): Promise<GeneratedQuiz[]> {
  return aiRepo.generateQuizzes(contextObjects)
}

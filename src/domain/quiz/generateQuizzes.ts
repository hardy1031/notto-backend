import type { AIRepository } from "../../repositories/aiRepository.ts"
import type { ContextObject, GeneratedQuiz } from "../../repositories/types.ts"

export async function generateQuizzes(
  contextObjects: ContextObject[],
  aiRepo: AIRepository
): Promise<GeneratedQuiz[]> {
  return aiRepo.generateQuizzes(contextObjects)
}

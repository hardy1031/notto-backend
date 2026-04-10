import type { AIRepository } from "../../repositories/aiRepository.ts"
import type { AILearnResponse, ContextObject } from "../../repositories/types.ts"

export async function askAI(
  contextObject: ContextObject,
  question: string,
  aiRepo: AIRepository
): Promise<AILearnResponse> {
  return aiRepo.askAI(contextObject, question)
}

import type { AIService } from "../../usecases/AIService.ts"
import type { AILearnResponse, ContextObject } from "../types.ts"

export async function askAI(
  contextObject: ContextObject,
  question: string,
  aiRepo: AIService
): Promise<AILearnResponse> {
  return aiRepo.askAI(contextObject, question)
}

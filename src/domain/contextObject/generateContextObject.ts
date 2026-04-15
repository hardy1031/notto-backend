import type { AIRepository } from "../../repositories/aiRepository.ts"
import type { GeneratedContextObject } from "../../repositories/types.ts"

export async function generateContextObject(
  expression: string,
  annotation: string,
  aiRepo: AIRepository
): Promise<GeneratedContextObject> {
  return aiRepo.generateContextObject(expression, annotation)
}

import type { AIService } from "../../usecases/AIService.ts"
import type { GeneratedContextObject } from "../types.ts"

export async function generateContextObjects(
  pieces: { expression: string; annotation: string }[],
  aiRepo: AIService
): Promise<GeneratedContextObject[]> {
  return aiRepo.generateContextObjects(pieces)
}

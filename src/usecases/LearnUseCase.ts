import { askAI } from "../domain/learn/askAI.ts"
import { ForbiddenError, NotFoundError } from "../errors/index.ts"
import type { AIRepository } from "../repositories/aiRepository.ts"
import type { ContextObjectRepository } from "../repositories/contextObjectRepository.ts"
import type { AILearnResponse } from "../repositories/types.ts"

export type LearnInput = {
  userId: string
  contextObjectId: string
  question: string
}

export async function LearnUseCase(
  input: LearnInput,
  deps: {
    contextObjectRepo: ContextObjectRepository
    aiRepo: AIRepository
  }
): Promise<AILearnResponse> {
  const contextObject = await deps.contextObjectRepo.findByUserAndId(
    input.userId,
    input.contextObjectId
  )

  if (!contextObject) {
    // Could be not found or forbidden — use NotFoundError since we can't distinguish
    throw new NotFoundError(`Context object not found: ${input.contextObjectId}`)
  }

  return askAI(contextObject, input.question, deps.aiRepo)
}

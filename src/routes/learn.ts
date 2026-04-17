import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { MockAIRepository } from "../infrastructure/aiClient.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { userRateLimit } from "../middleware/rateLimit.ts"
import type { AppVariables } from "../types/hono.ts"
import { LearnUseCase } from "../usecases/LearnUseCase.ts"

export const learnRouter = new Hono<{ Variables: AppVariables }>()

learnRouter.use("*", authMiddleware)
learnRouter.use("*", userRateLimit(20, 60 * 1000)) // 20 requests per minute

learnRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      context_object_id: z.string().uuid(),
      question: z.string().min(1),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await LearnUseCase(
      {
        userId,
        contextObjectId: body.context_object_id,
        question: body.question,
      },
      {
        contextObjectRepo: new SupabaseContextObjectRepository(),
        aiRepo: new MockAIRepository(),
      }
    )

    return c.json({
      explanation: result.explanation,
      examples: result.examples,
      related_expressions: result.relatedExpressions,
    })
  }
)

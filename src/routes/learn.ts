import { Hono } from "hono"
import { MockAIService } from "../infrastructure/ai/geminiAIService.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/db/supabaseContextObjectRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { userRateLimit } from "../middleware/rateLimit.ts"
import { validate } from "../middleware/validate.ts"
import { learnSchema } from "../schemas/learn.ts"
import type { AppVariables } from "../types/hono.ts"
import { LearnUseCase } from "../usecases/LearnUseCase.ts"

export const learnRouter = new Hono<{ Variables: AppVariables }>()

learnRouter.use("*", authMiddleware)
learnRouter.use("*", userRateLimit(20, 60 * 1000)) // 20 requests per minute

learnRouter.post(
  "/",
  validate("json", learnSchema),
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
        aiRepo: new MockAIService(),
      }
    )

    return c.json({
      explanation: result.explanation,
      examples: result.examples,
      related_expressions: result.relatedExpressions,
    })
  }
)

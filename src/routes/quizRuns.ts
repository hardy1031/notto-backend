import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../infrastructure/repositories/supabaseQuizRunRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { SubmitQuizRunUseCase } from "../usecases/SubmitQuizRunUseCase.ts"

export const quizRunsRouter = new Hono<{ Variables: AppVariables }>()

quizRunsRouter.use("*", authMiddleware)

quizRunsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      started_at: z.string().datetime(),
      completed_at: z.string().datetime().nullable(),
      records: z.array(
        z.object({
          quiz_id: z.string().uuid(),
          user_answer: z.string(),
          is_correct: z.boolean(),
        })
      ),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await SubmitQuizRunUseCase(
      {
        userId,
        startedAt: new Date(body.started_at),
        completedAt: body.completed_at ? new Date(body.completed_at) : null,
        records: body.records.map((record) => ({
          quizId: record.quiz_id,
          userAnswer: record.user_answer,
          isCorrect: record.is_correct,
        })),
      },
      {
        quizRepo: new SupabaseQuizRepository(),
        quizRunRepo: new SupabaseQuizRunRepository(),
      }
    )

    return c.json(
      {
        quiz_run: {
          id: result.quizRun.id,
          user_id: result.quizRun.userId,
          started_at: result.quizRun.startedAt.toISOString(),
          completed_at: result.quizRun.completedAt
            ? result.quizRun.completedAt.toISOString()
            : null,
        },
        quiz_records: result.quizRecords.map((quizRecord) => ({
          id: quizRecord.id,
          quiz_run_id: quizRecord.quizRunId,
          quiz_id: quizRecord.quizId,
          user_answer: quizRecord.userAnswer,
          is_correct: quizRecord.isCorrect,
          created_at: quizRecord.createdAt.toISOString(),
        })),
      },
      201
    )
  }
)

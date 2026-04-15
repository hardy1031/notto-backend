import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../infrastructure/repositories/supabaseQuizRunRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncQuizRunsUseCase } from "../usecases/SyncQuizRunsUseCase.ts"

export const syncQuizRunsRouter = new Hono<{ Variables: AppVariables }>()

syncQuizRunsRouter.use("*", authMiddleware)

syncQuizRunsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      quiz_runs: z
        .array(
          z.object({
            id: z.string().uuid(),
            started_at: z.string().datetime(),
            completed_at: z.string().datetime().nullable(),
            records: z
              .array(
                z.object({
                  id: z.string().uuid(),
                  quiz_id: z.string().uuid(),
                  choices: z.array(z.string()),
                  user_answer: z.string().min(1),
                  is_correct: z.boolean(),
                  created_at: z.string().datetime(),
                })
              )
              .min(1),
          })
        )
        .default([]),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await SyncQuizRunsUseCase(
      {
        userId,
        quizRuns: body.quiz_runs.map((qr) => ({
          id: qr.id,
          startedAt: new Date(qr.started_at),
          completedAt: qr.completed_at ? new Date(qr.completed_at) : null,
          records: qr.records.map((r) => ({
            id: r.id,
            quizId: r.quiz_id,
            choices: r.choices,
            userAnswer: r.user_answer,
            isCorrect: r.is_correct,
            createdAt: new Date(r.created_at),
          })),
        })),
      },
      {
        quizRepo: new SupabaseQuizRepository(),
        quizRunRepo: new SupabaseQuizRunRepository(),
      }
    )

    return c.json({
      quiz_runs: result.quizRuns.map(({ quizRun, quizRecords }) => ({
        id: quizRun.id,
        started_at: quizRun.startedAt.toISOString(),
        completed_at: quizRun.completedAt ? quizRun.completedAt.toISOString() : null,
        records: quizRecords.map((r) => ({
          id: r.id,
          quiz_run_id: r.quizRunId,
          quiz_id: r.quizId,
          choices: r.choices,
          user_answer: r.userAnswer,
          is_correct: r.isCorrect,
          created_at: r.createdAt.toISOString(),
        })),
      })),
    })
  }
)

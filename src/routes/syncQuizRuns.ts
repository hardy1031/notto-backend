import { Hono } from "hono"
import { SupabaseQuizRepository } from "../infrastructure/db/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../infrastructure/db/supabaseQuizRunRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { validate } from "../middleware/validate.ts"
import { syncQuizRunsSchema } from "../schemas/sync.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncQuizRunsUseCase } from "../usecases/SyncQuizRunsUseCase.ts"

export const syncQuizRunsRouter = new Hono<{ Variables: AppVariables }>()

syncQuizRunsRouter.use("*", authMiddleware)

syncQuizRunsRouter.post(
  "/",
  validate("json", syncQuizRunsSchema),
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

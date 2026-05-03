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
        quizRuns: body.quiz_runs.map((quizRun) => ({
          id: quizRun.id,
          startedAt: new Date(quizRun.started_at),
          completedAt: quizRun.completed_at ? new Date(quizRun.completed_at) : null,
          records: quizRun.records.map((record) => ({
            id: record.id,
            quizId: record.quiz_id,
            choices: record.choices,
            userAnswer: record.user_answer,
            isCorrect: record.is_correct,
            createdAt: new Date(record.created_at),
          })),
        })),
      },
      {
        quizQueryService: new SupabaseQuizRepository(),
        quizRunRepo: new SupabaseQuizRunRepository(),
        quizRunQueryService: new SupabaseQuizRunRepository(),
      }
    )

    return c.json({
      quiz_runs: result.quizRuns.map(({ quizRun, quizRecords }) => ({
        id: quizRun.id,
        started_at: quizRun.startedAt.toISOString(),
        completed_at: quizRun.completedAt ? quizRun.completedAt.toISOString() : null,
        records: quizRecords.map((record) => ({
          id: record.id,
          quiz_run_id: record.quizRunId,
          quiz_id: record.quizId,
          choices: record.choices,
          user_answer: record.userAnswer,
          is_correct: record.isCorrect,
          created_at: record.createdAt.toISOString(),
        })),
      })),
    })
  }
)

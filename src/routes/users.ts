import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { SupabaseAuthRepository } from "../infrastructure/supabaseAuthRepository.ts"
import { createNoteStorageRepository } from "../infrastructure/noteStorageFactory.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { DeleteLearnerUseCase } from "../usecases/DeleteLearnerUseCase.ts"
import { GetLearnerUseCase } from "../usecases/GetLearnerUseCase.ts"
import { UpdateLearnerUseCase } from "../usecases/UpdateLearnerUseCase.ts"

const authRepo = new SupabaseAuthRepository()

export const usersRouter = new Hono<{ Variables: AppVariables }>()

usersRouter.use("/me", authMiddleware)
usersRouter.use("/me/*", authMiddleware)

function formatLearner(learner: {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}) {
  return {
    id: learner.id,
    user_name: learner.userName,
    email: learner.email,
    first_language: learner.firstLanguage,
    target_language: learner.targetLanguage,
    created_at: learner.createdAt.toISOString(),
  }
}

usersRouter.get("/me", async (c) => {
  const userId = c.get("userId")
  const learner = await GetLearnerUseCase(userId, authRepo)
  return c.json({ user: formatLearner(learner) })
})

usersRouter.patch(
  "/me",
  zValidator(
    "json",
    z
      .object({
        user_name: z.string().min(1).optional(),
        first_language: z.string().min(1).optional(),
        target_language: z.string().min(1).optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
      })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")
    const learner = await UpdateLearnerUseCase(
      userId,
      {
        userName: body.user_name,
        firstLanguage: body.first_language,
        targetLanguage: body.target_language,
      },
      authRepo
    )
    return c.json({ user: formatLearner(learner) })
  }
)

usersRouter.delete("/me", async (c) => {
  const userId = c.get("userId")
  await DeleteLearnerUseCase(userId, authRepo, createNoteStorageRepository())
  return c.body(null, 204)
})

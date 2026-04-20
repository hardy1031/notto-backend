import { Hono } from "hono"
import { SupabaseUserRepository } from "../infrastructure/db/supabaseUserRepository.ts"
import { S3NoteStorageService } from "../infrastructure/s3NoteStorageService.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { validate } from "../middleware/validate.ts"
import { updateLearnerSchema } from "../schemas/users.ts"
import type { AppVariables } from "../types/hono.ts"
import { DeleteLearnerUseCase } from "../usecases/DeleteLearnerUseCase.ts"
import { GetLearnerUseCase } from "../usecases/GetLearnerUseCase.ts"
import { UpdateLearnerUseCase } from "../usecases/UpdateLearnerUseCase.ts"

const userRepo = new SupabaseUserRepository()

export const usersRouter = new Hono<{ Variables: AppVariables }>()

usersRouter.use("/me", authMiddleware)
usersRouter.use("/me/*", authMiddleware)

function formatUser(user: {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}) {
  return {
    id: user.id,
    user_name: user.userName,
    email: user.email,
    first_language: user.firstLanguage,
    target_language: user.targetLanguage,
    created_at: user.createdAt.toISOString(),
  }
}

usersRouter.get("/me", async (c) => {
  const userId = c.get("userId")
  const user = await GetLearnerUseCase(userId, userRepo)
  return c.json({ user: formatUser(user) })
})

usersRouter.patch(
  "/me",
  validate("json", updateLearnerSchema),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")
    const user = await UpdateLearnerUseCase(
      userId,
      {
        userName: body.user_name,
        firstLanguage: body.first_language,
        targetLanguage: body.target_language,
      },
      userRepo,
      userRepo
    )
    return c.json({ user: formatUser(user) })
  }
)

usersRouter.delete("/me", async (c) => {
  const userId = c.get("userId")
  await DeleteLearnerUseCase(userId, userRepo, new S3NoteStorageService())
  return c.body(null, 204)
})

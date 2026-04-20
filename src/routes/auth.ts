import { Hono } from "hono"
import { SupabaseAuthService } from "../infrastructure/supabaseAuthService.ts"
import { SupabaseUserRepository } from "../infrastructure/db/supabaseUserRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { ipRateLimit } from "../middleware/rateLimit.ts"
import { validate } from "../middleware/validate.ts"
import { loginSchema, registerSchema } from "../schemas/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { LoginUseCase } from "../usecases/LoginUseCase.ts"
import { LogoutUseCase } from "../usecases/LogoutUseCase.ts"
import { RegisterUseCase } from "../usecases/RegisterUseCase.ts"

const authService = new SupabaseAuthService()
const userRepo = new SupabaseUserRepository()

export const authRouter = new Hono<{ Variables: AppVariables }>()

authRouter.post(
  "/register",
  ipRateLimit(5, 60 * 60 * 1000), // 5 requests per hour
  validate("json", registerSchema),
  async (c) => {
    const body = c.req.valid("json")
    const result = await RegisterUseCase(
      {
        userName: body.user_name,
        email: body.email,
        password: body.password,
        firstLanguage: body.first_language,
        targetLanguage: body.target_language,
      },
      authService,
      userRepo
    )
    return c.json(
      {
        token: result.token,
        user: {
          id: result.user.id,
          user_name: result.user.userName,
          email: result.user.email,
          first_language: result.user.firstLanguage,
          target_language: result.user.targetLanguage,
          created_at: result.user.createdAt.toISOString(),
        },
      },
      201
    )
  }
)

authRouter.post(
  "/login",
  ipRateLimit(10, 15 * 60 * 1000), // 10 requests per 15 minutes
  validate("json", loginSchema),
  async (c) => {
    const body = c.req.valid("json")
    const result = await LoginUseCase({ email: body.email, password: body.password }, authService, userRepo)
    return c.json({
      token: result.token,
      user: {
        id: result.user.id,
        user_name: result.user.userName,
        email: result.user.email,
        first_language: result.user.firstLanguage,
        target_language: result.user.targetLanguage,
        created_at: result.user.createdAt.toISOString(),
      },
    })
  }
)

authRouter.post("/logout", authMiddleware, async (c) => {
  const authHeader = c.req.header("Authorization")!
  const token = authHeader.slice(7)
  await LogoutUseCase(token, authService)
  return c.body(null, 204)
})

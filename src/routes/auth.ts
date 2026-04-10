import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { LoginUseCase } from "../usecases/LoginUseCase.ts"
import { RegisterUseCase } from "../usecases/RegisterUseCase.ts"

export const authRouter = new Hono()

authRouter.post(
  "/register",
  zValidator(
    "json",
    z.object({
      user_name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      first_language: z.string().min(1),
      target_language: z.string().min(1),
    })
  ),
  async (c) => {
    const body = c.req.valid("json")
    const result = await RegisterUseCase({
      userName: body.user_name,
      email: body.email,
      password: body.password,
      firstLanguage: body.first_language,
      targetLanguage: body.target_language,
    })
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
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })
  ),
  async (c) => {
    const body = c.req.valid("json")
    const result = await LoginUseCase({ email: body.email, password: body.password })
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

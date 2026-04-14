import type { MiddlewareHandler } from "hono"
import { SupabaseAuthRepository } from "../infrastructure/supabaseAuthRepository.ts"
import type { AppVariables } from "../types/hono.ts"

const authRepo = new SupabaseAuthRepository()

const DEV_BYPASS_USER_ID = process.env.DEV_BYPASS_USER_ID

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  if (DEV_BYPASS_USER_ID) {
    c.set("userId", DEV_BYPASS_USER_ID)
    await next()
    return
  }

  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid token" } }, 401)
  }

  const token = authHeader.slice(7)
  const userId = await authRepo.verifyToken(token)

  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } }, 401)
  }

  c.set("userId", userId)
  await next()
}

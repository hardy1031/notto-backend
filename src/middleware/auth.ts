import type { MiddlewareHandler } from "hono"
import { SupabaseAuthRepository } from "../infrastructure/supabaseAuthRepository.ts"
import type { AppVariables } from "../types/hono.ts"

const authRepo = new SupabaseAuthRepository()

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
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

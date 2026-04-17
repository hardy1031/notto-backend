import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { AIUnavailableError, ConflictError, DBError, ForbiddenError, NotFoundError, S3Error } from "./errors/index.ts"
import { authRouter } from "./routes/auth.ts"
import { learnRouter } from "./routes/learn.ts"
import { syncQuizRunsRouter } from "./routes/syncQuizRuns.ts"
import { syncQuizzesRouter } from "./routes/syncQuizzes.ts"
import { syncNotebooksRouter } from "./routes/syncNotebooks.ts"
import { usersRouter } from "./routes/users.ts"

const app = new Hono()

// CORS is only needed for browser-based clients (dev tools, web client).
// Native app clients do not use browsers so CORS headers are irrelevant for them.
// Set ALLOWED_ORIGINS (comma-separated) to enable CORS for specific origins.
// Leave unset in production (native-only) to skip CORS entirely.
app.use(bodyLimit({ maxSize: 1 * 1024 * 1024 })) // 1MB

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim())
if (allowedOrigins && allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }))
}

app.route("/auth", authRouter)
app.route("/users", usersRouter)
app.route("/sync/notebooks", syncNotebooksRouter)
app.route("/sync/quizzes", syncQuizzesRouter)
app.route("/sync/quiz-runs", syncQuizRunsRouter)
app.route("/learn", learnRouter)

app.onError((err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404)
  }
  if (err instanceof ConflictError) {
    return c.json({ error: { code: "CONFLICT", message: err.message } }, 409)
  }
  if (err instanceof ForbiddenError) {
    return c.json({ error: { code: "FORBIDDEN", message: err.message } }, 403)
  }
  if (err instanceof AIUnavailableError) {
    return c.json({ error: { code: "AI_UNAVAILABLE", message: err.message } }, 503)
  }
  if (err instanceof S3Error) {
    console.error(`[S3Error]`, err.message)
    return c.json({ error: { code: "STORAGE_ERROR", message: "Storage operation failed" } }, 503)
  }
  if (err instanceof DBError) {
    console.error(`[DBError]`, err.message)
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
  }
  console.error(`[${err.constructor.name}]`, err.message, err.stack)
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
})

const port = Number(process.env.PORT ?? 3000)

export default {
  port,
  fetch: app.fetch,
}

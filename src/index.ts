import { Hono } from "hono"
import { handle } from "hono/aws-lambda"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import {
  AIUnavailableError,
  ConflictError,
  DBError,
  ForbiddenError,
  NotFoundError,
  S3Error,
} from "./errors/index.ts"
import { authRouter } from "./routes/auth.ts"
import { learnRouter } from "./routes/learn.ts"
import { syncNotebooksRouter } from "./routes/syncNotebooks.ts"
import { syncQuizRunsRouter } from "./routes/syncQuizRuns.ts"
import { syncQuizzesRouter } from "./routes/syncQuizzes.ts"
import { usersRouter } from "./routes/users.ts"

const app = new Hono()

// CORS is only needed for browser-based clients (dev tools, web client).
// Native app clients do not use browsers so CORS headers are irrelevant for them.
// Set ALLOWED_ORIGINS (comma-separated) to enable CORS for specific origins.
// Leave unset in production (native-only) to skip CORS entirely.
app.use(bodyLimit({ maxSize: 1 * 1024 * 1024 })) // 1MB

app.use(async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  const status = c.res.status
  const base = { method: c.req.method, path: c.req.path, status, duration }
  // Log all requests. 4xx (e.g. validation errors) are the client's fault,
  // not server bugs, but we still log them at ERROR level so they're
  // visible in CloudWatch without requiring investigation.
  // For error responses, include the response body for full context.
  if (status >= 400) {
    const body = await c.res.clone().json().catch(() => null)
    console.error(JSON.stringify({ ...base, body }))
  } else {
    console.log(JSON.stringify(base))
  }
})

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
  const ctx = { method: c.req.method, path: c.req.path }

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
    console.error(JSON.stringify({ ...ctx, error: "S3Error", message: err.message, stack: err.stack }))
    return c.json({ error: { code: "STORAGE_ERROR", message: "Storage operation failed" } }, 503)
  }
  if (err instanceof DBError) {
    console.error(JSON.stringify({ ...ctx, error: "DBError", message: err.message, stack: err.stack }))
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
  }
  console.error(
    JSON.stringify({ ...ctx, error: err.constructor.name, message: err.message, stack: err.stack })
  )
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
})

// Lambda handler — used when deployed to AWS Lambda via API Gateway
export const handler = handle(app)

// Bun dev server — used for local development only
if (typeof Bun !== "undefined") {
  const port = Number(process.env.PORT ?? 3000)
  Bun.serve({ port, fetch: app.fetch })
  console.log(`Server running at http://localhost:${port}`)
}

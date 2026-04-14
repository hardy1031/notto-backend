import { Hono } from "hono"
import { cors } from "hono/cors"
import { AIUnavailableError, ConflictError, ForbiddenError, NotFoundError } from "./errors/index.ts"
import { authRouter } from "./routes/auth.ts"
import { contextObjectsRouter } from "./routes/contextObjects.ts"
import { learnRouter } from "./routes/learn.ts"
import { quizRunsRouter } from "./routes/quizRuns.ts"
import { quizzesRouter } from "./routes/quizzes.ts"

const app = new Hono()

app.use(cors({ origin: "http://localhost:5173" }))

app.route("/auth", authRouter)
app.route("/context-objects", contextObjectsRouter)
app.route("/quiz-runs", quizRunsRouter)
app.route("/quizzes", quizzesRouter)
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
  console.error(`[${err.constructor.name}]`, err.message, err.stack)
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
})

const port = Number(process.env.PORT ?? 3000)

export default {
  port,
  fetch: app.fetch,
}

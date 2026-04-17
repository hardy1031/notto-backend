import type { MiddlewareHandler } from "hono"

type RateLimitOptions = {
  /** Maximum number of requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
  /**
   * Function that returns the rate limit key for a given request.
   * Use IP for unauthenticated endpoints, userId for authenticated ones.
   */
  keyFn: (c: Parameters<MiddlewareHandler>[0]) => string | undefined
}

type WindowEntry = {
  count: number
  resetAt: number
}

/**
 * Fixed-window in-memory rate limiter.
 * Each unique key gets `limit` requests per `windowMs`.
 * Suitable for single-instance deployments (Fly.io single machine).
 * Swap `store` for a Redis-backed implementation when scaling horizontally.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, WindowEntry>()

  // Periodically purge expired entries to prevent unbounded memory growth
  const purgeInterval = Math.max(options.windowMs, 60_000)
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, purgeInterval).unref()

  return async (c, next) => {
    const key = options.keyFn(c)

    // If the key cannot be determined (e.g. userId not yet set), skip limiting
    if (key === undefined) {
      await next()
      return
    }

    const now = Date.now()
    const entry = store.get(key)

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs })
      await next()
      return
    }

    if (entry.count >= options.limit) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000)
      c.header("Retry-After", String(retryAfterSecs))
      return c.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
        429
      )
    }

    entry.count++
    await next()
  }
}

/** Extracts client IP from standard proxy headers, falls back to a constant. */
function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  )
}

/** Rate limiter keyed by IP — for unauthenticated endpoints (register, login). */
export function ipRateLimit(limit: number, windowMs: number): MiddlewareHandler {
  return rateLimit({ limit, windowMs, keyFn: getClientIp })
}

/** Rate limiter keyed by userId — for authenticated AI endpoints (quizzes, learn). */
export function userRateLimit(limit: number, windowMs: number): MiddlewareHandler {
  return rateLimit({
    limit,
    windowMs,
    keyFn: (c) => c.get("userId" as never) as string | undefined,
  })
}

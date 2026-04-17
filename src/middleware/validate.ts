import { zValidator as honoZValidator } from "@hono/zod-validator"
import type { ZodSchema } from "zod"

/**
 * Wraps @hono/zod-validator with a standardized error response format.
 * Without this, zod validation errors return Zod's internal structure directly
 * instead of going through the global error handler.
 */
export function validate<T extends ZodSchema>(target: "json" | "query" | "param", schema: T) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      const field = firstIssue?.path.join(".") ?? "unknown"
      const message = firstIssue?.message ?? "Invalid input"
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `${field}: ${message}`,
          },
        },
        400
      )
    }
  })
}

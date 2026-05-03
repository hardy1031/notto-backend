import { z } from "zod"

export const learnSchema = z.object({
  question: z.string().min(1).max(500),
})

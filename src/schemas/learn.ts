import { z } from "zod"

export const learnSchema = z.object({
  context_object_id: z.string().uuid(),
  question: z.string().min(1).max(500),
})

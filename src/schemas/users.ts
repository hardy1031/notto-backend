import { z } from "zod"

export const updateLearnerSchema = z
  .object({
    user_name: z.string().min(1).max(50).optional(),
    first_language: z.string().min(1).max(10).optional(),
    target_language: z.string().min(1).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })

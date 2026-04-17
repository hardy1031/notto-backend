import { z } from "zod"

export const registerSchema = z.object({
  user_name: z.string().min(1).max(50),
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  first_language: z.string().min(1).max(10),
  target_language: z.string().min(1).max(10),
})

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
})

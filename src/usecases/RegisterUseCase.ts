import { createUser } from "../domain/auth/createUser.ts"
import type { CreatedUser } from "../domain/auth/createUser.ts"

export type RegisterInput = {
  userName: string
  email: string
  password: string
  firstLanguage: string
  targetLanguage: string
}

export type RegisterOutput = {
  token: string
  user: CreatedUser
}

export async function RegisterUseCase(input: RegisterInput): Promise<RegisterOutput> {
  return createUser(input)
}

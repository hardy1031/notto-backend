import { authenticateUser } from "../domain/auth/authenticateUser.ts"
import type { CreatedUser } from "../domain/auth/createUser.ts"

export type LoginInput = {
  email: string
  password: string
}

export type LoginOutput = {
  token: string
  user: CreatedUser
}

export async function LoginUseCase(input: LoginInput): Promise<LoginOutput> {
  return authenticateUser(input.email, input.password)
}

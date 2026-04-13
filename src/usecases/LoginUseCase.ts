import type { AuthRepository, AuthUser } from "../repositories/authRepository.ts"

export type LoginInput = {
  email: string
  password: string
}

export type LoginOutput = {
  token: string
  user: AuthUser
}

export async function LoginUseCase(
  input: LoginInput,
  authRepo: AuthRepository
): Promise<LoginOutput> {
  return authRepo.authenticateUser(input.email, input.password)
}

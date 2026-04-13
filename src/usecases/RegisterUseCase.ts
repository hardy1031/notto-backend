import type { AuthRepository, AuthUser } from "../repositories/authRepository.ts"

export type RegisterInput = {
  userName: string
  email: string
  password: string
  firstLanguage: string
  targetLanguage: string
}

export type RegisterOutput = {
  token: string
  user: AuthUser
}

export async function RegisterUseCase(
  input: RegisterInput,
  authRepo: AuthRepository
): Promise<RegisterOutput> {
  return authRepo.createUser(input)
}

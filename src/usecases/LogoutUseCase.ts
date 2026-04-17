import type { AuthRepository } from "../repositories/authRepository.ts"

export async function LogoutUseCase(token: string, authRepo: AuthRepository): Promise<void> {
  return authRepo.logout(token)
}

import type { AuthService } from "./AuthService.ts"

export async function LogoutUseCase(token: string, authRepo: AuthService): Promise<void> {
  return authRepo.logout(token)
}

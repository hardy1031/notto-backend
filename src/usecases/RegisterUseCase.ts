import type { UserEntity } from "../domain/user/UserEntity.ts"
import type { UserRepository } from "../domain/user/UserRepository.ts"
import type { AuthService } from "./AuthService.ts"

export type RegisterInput = {
  userName: string
  email: string
  password: string
  firstLanguage: string
  targetLanguage: string
}

export type RegisterOutput = {
  token: string
  user: UserEntity
}

export async function RegisterUseCase(
  input: RegisterInput,
  authService: AuthService,
  userRepo: UserRepository & { getUser(userId: string): Promise<UserEntity> }
): Promise<RegisterOutput> {
  const { token, userId } = await authService.createAuthUser(input.email, input.password)
  await userRepo.initUser(userId, {
    userName: input.userName,
    firstLanguage: input.firstLanguage,
    targetLanguage: input.targetLanguage,
  })
  const user = await userRepo.getUser(userId)
  return { token, user }
}

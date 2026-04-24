import type { UserEntity } from "../domain/user/UserEntity.ts"
import type { AuthService } from "./AuthService.ts"
import type { UserQueryService } from "./queries/UserQueryService.ts"

export type LoginInput = {
  email: string
  password: string
}

export type LoginOutput = {
  token: string
  user: UserEntity
}

export async function LoginUseCase(
  input: LoginInput,
  authService: AuthService,
  userQueryService: UserQueryService
): Promise<LoginOutput> {
  const { token, userId } = await authService.authenticateUser(input.email, input.password)
  const user = await userQueryService.getUser(userId)
  return { token, user }
}

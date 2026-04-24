import type { UserEntity } from "../domain/user/UserEntity.ts"
import type { UserQueryService } from "./queries/UserQueryService.ts"

export async function GetLearnerUseCase(
  userId: string,
  userQueryService: UserQueryService
): Promise<UserEntity> {
  return userQueryService.getUser(userId)
}

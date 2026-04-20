import type { UserQueryService } from "./queries/UserQueryService.ts"
import type { User } from "../domain/types.ts"

export async function GetLearnerUseCase(
  userId: string,
  userQueryService: UserQueryService
): Promise<User> {
  return userQueryService.getUser(userId)
}

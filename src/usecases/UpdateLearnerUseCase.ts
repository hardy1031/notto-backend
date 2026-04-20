import type { UserRepository } from "../domain/user/UserRepository.ts"
import type { UserQueryService } from "./queries/UserQueryService.ts"
import type { User } from "../domain/types.ts"

export type UpdateLearnerInput = {
  userName?: string
  firstLanguage?: string
  targetLanguage?: string
}

export async function UpdateLearnerUseCase(
  userId: string,
  input: UpdateLearnerInput,
  userRepo: UserRepository,
  userQueryService: UserQueryService
): Promise<User> {
  await userRepo.updateUser(userId, input)
  return userQueryService.getUser(userId)
}

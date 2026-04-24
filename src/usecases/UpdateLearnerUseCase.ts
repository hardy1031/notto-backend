import type { UserEntity } from "../domain/user/UserEntity.ts"
import type { UserRepository } from "../domain/user/UserRepository.ts"
import type { UserQueryService } from "./queries/UserQueryService.ts"

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
): Promise<UserEntity> {
  await userRepo.updateUser(userId, input)
  return userQueryService.getUser(userId)
}

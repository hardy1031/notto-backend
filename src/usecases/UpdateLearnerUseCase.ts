import type { AuthRepository, Learner } from "../repositories/authRepository.ts"

export type UpdateLearnerInput = {
  userName?: string
  firstLanguage?: string
  targetLanguage?: string
}

export async function UpdateLearnerUseCase(
  userId: string,
  input: UpdateLearnerInput,
  authRepo: AuthRepository
): Promise<Learner> {
  return authRepo.updateLearner(userId, input)
}

import type { AuthRepository, Learner } from "../repositories/authRepository.ts"

export async function GetLearnerUseCase(
  userId: string,
  authRepo: AuthRepository
): Promise<Learner> {
  return authRepo.getLearner(userId)
}

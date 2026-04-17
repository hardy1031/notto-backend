import type { AuthRepository } from "../repositories/authRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"

export async function DeleteLearnerUseCase(
  userId: string,
  authRepo: AuthRepository,
  noteStorage: NoteStorageRepository
): Promise<void> {
  // Clean up S3 objects before removing the auth record.
  // DB rows are handled by ON DELETE CASCADE from auth.users.
  await noteStorage.deleteAllForUser(userId)
  await authRepo.deleteLearner(userId)
}

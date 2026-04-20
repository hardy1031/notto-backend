import type { UserRepository } from "../domain/user/UserRepository.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"

export async function DeleteLearnerUseCase(
  userId: string,
  userRepo: UserRepository,
  noteStorage: NoteStorageService
): Promise<void> {
  // Clean up S3 objects before removing the auth record.
  // DB rows are handled by ON DELETE CASCADE from auth.users.
  await noteStorage.deleteAllForUser(userId)
  await userRepo.deleteUser(userId)
}

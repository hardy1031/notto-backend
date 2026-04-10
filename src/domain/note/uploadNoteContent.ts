import type { NoteStorageRepository } from "../../repositories/noteStorageRepository.ts"

export async function uploadNoteContent(
  s3Key: string,
  content: string,
  storage: NoteStorageRepository
): Promise<void> {
  await storage.upload(s3Key, content)
}

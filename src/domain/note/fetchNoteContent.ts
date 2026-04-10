import type { NoteStorageRepository } from "../../repositories/noteStorageRepository.ts"

export async function fetchNoteContent(
  s3Key: string,
  storage: NoteStorageRepository
): Promise<string> {
  return storage.fetch(s3Key)
}

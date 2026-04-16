import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"

// Singleton store shared across all instances — allows separate request handlers
// (e.g. POST /sync/notebooks and POST /sync/quizzes) to access the same in-memory data.
const sharedStore = new Map<string, string>()

export class MockNoteStorageRepository implements NoteStorageRepository {
  async upload(s3Key: string, content: string): Promise<void> {
    sharedStore.set(s3Key, content)
  }

  async fetch(s3Key: string): Promise<string> {
    return sharedStore.get(s3Key) ?? ""
  }
}

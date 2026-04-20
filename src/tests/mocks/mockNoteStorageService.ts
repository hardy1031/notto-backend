import type { NoteStorageService } from "../../usecases/NoteStorageService.ts"

// Singleton store shared across all instances — allows separate request handlers
// (e.g. POST /sync/notebooks and POST /sync/quizzes) to access the same in-memory data.
const sharedStore = new Map<string, string>()

export class MockNoteStorageService implements NoteStorageService {
  async upload(s3Key: string, content: string): Promise<void> {
    sharedStore.set(s3Key, content)
  }

  async fetch(s3Key: string): Promise<string> {
    return sharedStore.get(s3Key) ?? ""
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const key of sharedStore.keys()) {
      if (key.startsWith(`${userId}/`)) {
        sharedStore.delete(key)
      }
    }
  }
}

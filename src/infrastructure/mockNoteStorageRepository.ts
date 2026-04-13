import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"

export class MockNoteStorageRepository implements NoteStorageRepository {
  private store = new Map<string, string>()

  async upload(s3Key: string, content: string): Promise<void> {
    this.store.set(s3Key, content)
  }

  async fetch(s3Key: string): Promise<string> {
    return this.store.get(s3Key) ?? ""
  }
}

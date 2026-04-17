import { MockNoteStorageRepository } from "./mockNoteStorageRepository.ts"
import { S3NoteStorageRepository } from "./s3Client.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"

export function createNoteStorageRepository(): NoteStorageRepository {
  if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME) {
    return new S3NoteStorageRepository()
  }
  return new MockNoteStorageRepository()
}

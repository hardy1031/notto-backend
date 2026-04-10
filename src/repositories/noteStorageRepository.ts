export interface NoteStorageRepository {
  upload(s3Key: string, content: string): Promise<void>
  fetch(s3Key: string): Promise<string>
}

import type { NoteEntity } from "../../domain/note/NoteEntity.ts"

export interface NoteQueryService {
  /** Returns non-deleted notes for the user. */
  findByUserId(userId: string): Promise<NoteEntity[]>
  /** Returns non-deleted notes matching the given IDs. */
  findByUserIdAndIds(userId: string, ids: string[]): Promise<NoteEntity[]>
  /** Returns all notes including deleted ones — for sync tombstone detection. */
  findAllForSync(userId: string): Promise<NoteEntity[]>
}

import type { Note } from "./types.ts"

export interface NoteRepository {
  findByUserIdAndIds(userId: string, ids: string[]): Promise<Note[]>
  findByUserId(userId: string): Promise<Note[]>
  create(note: Note): Promise<void>
  update(note: Note): Promise<void>
}

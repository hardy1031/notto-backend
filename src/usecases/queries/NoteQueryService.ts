import type { Note } from "../../domain/types.ts"

export interface NoteQueryService {
  findByUserId(userId: string): Promise<Note[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<Note[]>
}

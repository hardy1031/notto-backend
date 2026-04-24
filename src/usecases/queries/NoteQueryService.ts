import type { NoteEntity } from "../../domain/note/NoteEntity.ts"

export interface NoteQueryService {
  findByUserId(userId: string): Promise<NoteEntity[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<NoteEntity[]>
}

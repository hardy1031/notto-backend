import type { NotePiece } from "./types.ts"

export interface NotePieceRepository {
  findByNoteIds(noteIds: string[]): Promise<NotePiece[]>
  deleteByNoteId(noteId: string): Promise<void>
  upsert(pieces: NotePiece[]): Promise<void>
}

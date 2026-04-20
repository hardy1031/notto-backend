import type { Note, NotePiece } from "../types.ts"

/** Aggregate root: Note (includes NotePiece[]) */
export interface NoteRepository {
  createWithNotePieces(note: Note, pieces: NotePiece[]): Promise<void>
  updateWithNotePieces(note: Note, pieces: NotePiece[]): Promise<void>
}

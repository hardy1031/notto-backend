import type { NoteEntity } from "./NoteEntity.ts"
import type { NotePieceEntity } from "./NotePieceEntity.ts"

/** Aggregate root: Note (includes NotePiece[]) */
export interface NoteRepository {
  createWithNotePieces(note: NoteEntity, pieces: NotePieceEntity[]): Promise<void>
  updateWithNotePieces(note: NoteEntity, pieces: NotePieceEntity[]): Promise<void>
  updateSyncedAt(ids: string[], syncedAt: Date): Promise<void>
}

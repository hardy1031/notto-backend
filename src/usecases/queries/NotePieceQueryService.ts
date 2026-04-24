import type { NotePieceEntity } from "../../domain/note/notePiece/NotePieceEntity.ts"

export interface NotePieceQueryService {
  findByNoteIds(noteIds: string[]): Promise<NotePieceEntity[]>
}

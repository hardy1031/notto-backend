import type { NotePiece } from "../../domain/types.ts"

export interface NotePieceQueryService {
  findByNoteIds(noteIds: string[]): Promise<NotePiece[]>
}

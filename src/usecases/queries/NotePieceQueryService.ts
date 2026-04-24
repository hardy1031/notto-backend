import type { NotePieceEntity } from "../../domain/note/NotePieceEntity.ts"

export interface NotePieceQueryService {
  findByNoteIds(noteIds: string[]): Promise<NotePieceEntity[]>
}

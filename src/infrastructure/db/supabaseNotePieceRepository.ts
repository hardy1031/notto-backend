import { NotePieceEntity } from "../../domain/note/notePiece/NotePieceEntity.ts"
import { DBError } from "../../errors/index.ts"
import type { NotePieceQueryService } from "../../usecases/queries/NotePieceQueryService.ts"
import sql from "../postgresClient.ts"

function toNotePiece(row: Record<string, unknown>): NotePieceEntity {
  return NotePieceEntity.reconstruct({
    id: row.id as string,
    noteId: row.note_id as string,
    createdAt: new Date(row.created_at as string),
  })
}

export class SupabaseNotePieceRepository implements NotePieceQueryService {
  async findByNoteIds(noteIds: string[]): Promise<NotePieceEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM note_pieces WHERE note_id = ANY(${noteIds})
      `
      return rows.map(toNotePiece)
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

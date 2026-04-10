import { DBError } from "../../errors/index.ts"
import type { NotePieceRepository } from "../../repositories/notePieceRepository.ts"
import type { NotePiece } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toNotePiece(row: Record<string, unknown>): NotePiece {
  return {
    id: row.id as string,
    noteId: row.note_id as string,
    order: row.order as number,
    createdAt: new Date(row.created_at as string),
  }
}

export class SupabaseNotePieceRepository implements NotePieceRepository {
  async findByNoteIds(noteIds: string[]): Promise<NotePiece[]> {
    const { data, error } = await supabase.from("note_pieces").select("*").in("note_id", noteIds)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toNotePiece)
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    // Only delete pieces that have no context_objects (cascade handles quizzes)
    const { data: pieces, error: fetchError } = await supabase
      .from("note_pieces")
      .select("id")
      .eq("note_id", noteId)
    if (fetchError) throw new DBError(fetchError.message)

    const pieceIds = (pieces ?? []).map((p) => p.id as string)
    if (pieceIds.length === 0) return

    const { data: contextObjects, error: coError } = await supabase
      .from("context_objects")
      .select("note_piece_id")
      .in("note_piece_id", pieceIds)
    if (coError) throw new DBError(coError.message)

    const usedPieceIds = new Set((contextObjects ?? []).map((co) => co.note_piece_id as string))
    const toDelete = pieceIds.filter((id) => !usedPieceIds.has(id))

    if (toDelete.length === 0) return

    const { error } = await supabase.from("note_pieces").delete().in("id", toDelete)
    if (error) throw new DBError(error.message)
  }

  async upsert(pieces: NotePiece[]): Promise<void> {
    const { error } = await supabase.from("note_pieces").upsert(
      pieces.map((p) => ({
        id: p.id,
        note_id: p.noteId,
        order: p.order,
        created_at: p.createdAt.toISOString(),
      }))
    )
    if (error) throw new DBError(error.message)
  }
}

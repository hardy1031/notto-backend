import { DBError } from "../../errors/index.ts"
import type { NotePieceRepository } from "../../repositories/notePieceRepository.ts"
import type { NotePiece } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toNotePiece(row: Record<string, unknown>): NotePiece {
  return {
    id: row.id as string,
    noteId: row.note_id as string,
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
    // Cascade deletes associated context_objects and quizzes via FK ON DELETE CASCADE
    const { error } = await supabase.from("note_pieces").delete().eq("note_id", noteId)
    if (error) throw new DBError(error.message)
  }

  async upsert(pieces: NotePiece[]): Promise<void> {
    const { error } = await supabase.from("note_pieces").upsert(
      pieces.map((p) => ({
        id: p.id,
        note_id: p.noteId,
        created_at: p.createdAt.toISOString(),
      }))
    )
    if (error) throw new DBError(error.message)
  }
}

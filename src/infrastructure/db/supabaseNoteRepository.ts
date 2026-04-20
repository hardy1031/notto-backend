import { DBError } from "../../errors/index.ts"
import type { NoteRepository } from "../../repositories/noteRepository.ts"
import type { Note } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    notebookId: row.notebook_id as string,
    name: row.name as string,
    s3Key: row.s3_key as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class SupabaseNoteRepository implements NoteRepository {
  async findByUserIdAndIds(userId: string, ids: string[]): Promise<Note[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*, notebooks!inner(user_id)")
      .eq("notebooks.user_id", userId)
      .in("id", ids)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toNote)
  }

  async findByUserId(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*, notebooks!inner(user_id)")
      .eq("notebooks.user_id", userId)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toNote)
  }

  async create(note: Note): Promise<void> {
    const { error } = await supabase.from("notes").insert({
      id: note.id,
      notebook_id: note.notebookId,
      name: note.name,
      s3_key: note.s3Key,
      created_at: note.createdAt.toISOString(),
      updated_at: note.updatedAt.toISOString(),
    })
    if (error) throw new DBError(error.message)
  }

  async update(note: Note): Promise<void> {
    const { error } = await supabase
      .from("notes")
      .update({ name: note.name, updated_at: note.updatedAt.toISOString() })
      .eq("id", note.id)
    if (error) throw new DBError(error.message)
  }
}

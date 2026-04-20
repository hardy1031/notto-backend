import { DBError } from "../../errors/index.ts"
import type { ContextObjectRepository } from "../../repositories/contextObjectRepository.ts"
import type { ContextObject } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toContextObject(row: Record<string, unknown>): ContextObject {
  return {
    id: row.id as string,
    notePieceId: row.note_piece_id as string,
    noteId: row.note_id as string,
    expression: row.expression as string,
    baseMeaning: row.base_meaning as string,
    actualNuance: row.actual_nuance as string,
    tone: row.tone as string,
    formality: row.formality as "casual" | "neutral" | "formal",
    isSlang: row.is_slang as boolean,
    exampleDialogue: row.example_dialogue as { speaker: string; text: string }[],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class SupabaseContextObjectRepository implements ContextObjectRepository {
  async findByNoteIds(noteIds: string[]): Promise<ContextObject[]> {
    const { data, error } = await supabase
      .from("context_objects")
      .select("*")
      .in("note_id", noteIds)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toContextObject)
  }

  async findByUserId(userId: string): Promise<ContextObject[]> {
    const { data, error } = await supabase
      .from("context_objects")
      .select("*, note_pieces!inner(notes!inner(notebooks!inner(user_id)))")
      .eq("note_pieces.notes.notebooks.user_id", userId)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toContextObject)
  }

  async findWithoutQuizzes(noteIds: string[]): Promise<ContextObject[]> {
    const { data, error } = await supabase
      .from("context_objects")
      .select("*, quizzes(id)")
      .in("note_id", noteIds)
    if (error) throw new DBError(error.message)
    return (data ?? [])
      .filter((row) => {
        const quizzes = row.quizzes as unknown[]
        return !quizzes || quizzes.length === 0
      })
      .map(toContextObject)
  }

  async bulkCreate(contextObjects: ContextObject[]): Promise<void> {
    const { error } = await supabase.from("context_objects").insert(
      contextObjects.map((co) => ({
        id: co.id,
        note_piece_id: co.notePieceId,
        note_id: co.noteId,
        expression: co.expression,
        base_meaning: co.baseMeaning,
        actual_nuance: co.actualNuance,
        tone: co.tone,
        formality: co.formality,
        is_slang: co.isSlang,
        example_dialogue: co.exampleDialogue,
        created_at: co.createdAt.toISOString(),
        updated_at: co.updatedAt.toISOString(),
      }))
    )
    if (error) throw new DBError(error.message)
  }

  async findByUserAndId(userId: string, id: string): Promise<ContextObject | null> {
    const { data, error } = await supabase
      .from("context_objects")
      .select("*, note_pieces!inner(note_id, notes!inner(notebook_id, notebooks!inner(user_id)))")
      .eq("id", id)
      .eq("note_pieces.notes.notebooks.user_id", userId)
      .single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw new DBError(error.message)
    }
    return data ? toContextObject(data as Record<string, unknown>) : null
  }
}

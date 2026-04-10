import { DBError } from "../../errors/index.ts"
import type { NotebookRepository } from "../../repositories/notebookRepository.ts"
import type { Notebook } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toNotebook(row: Record<string, unknown>): Notebook {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class SupabaseNotebookRepository implements NotebookRepository {
  async findByUserIdAndIds(userId: string, ids: string[]): Promise<Notebook[]> {
    const { data, error } = await supabase
      .from("notebooks")
      .select("*")
      .eq("user_id", userId)
      .in("id", ids)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toNotebook)
  }

  async findByUserId(userId: string): Promise<Notebook[]> {
    const { data, error } = await supabase.from("notebooks").select("*").eq("user_id", userId)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toNotebook)
  }

  async create(notebook: Notebook): Promise<void> {
    const { error } = await supabase.from("notebooks").insert({
      id: notebook.id,
      user_id: notebook.userId,
      name: notebook.name,
      created_at: notebook.createdAt.toISOString(),
      updated_at: notebook.updatedAt.toISOString(),
    })
    if (error) throw new DBError(error.message)
  }

  async update(notebook: Notebook): Promise<void> {
    const { error } = await supabase
      .from("notebooks")
      .update({
        name: notebook.name,
        updated_at: notebook.updatedAt.toISOString(),
      })
      .eq("id", notebook.id)
    if (error) throw new DBError(error.message)
  }
}

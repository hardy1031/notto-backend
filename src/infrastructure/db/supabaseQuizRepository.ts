import { DBError } from "../../errors/index.ts"
import type { QuizRepository } from "../../repositories/quizRepository.ts"
import type { Quiz } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

function toQuiz(row: Record<string, unknown>): Quiz {
  return {
    id: row.id as string,
    contextObjectId: row.context_object_id as string,
    type: row.type as Quiz["type"],
    questionSentence: row.question_sentence as string,
    answer: row.answer as string,
    choicePool: row.choice_pool as string[],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class SupabaseQuizRepository implements QuizRepository {
  async findByContextObjectIds(contextObjectIds: string[]): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .in("context_object_id", contextObjectIds)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toQuiz)
  }

  async findByUserId(userId: string): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*, context_objects!inner(note_pieces!inner(notes!inner(notebooks!inner(user_id))))")
      .eq("context_objects.note_pieces.notes.notebooks.user_id", userId)
    if (error) throw new DBError(error.message)
    return (data ?? []).map(toQuiz)
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*, context_objects!inner(note_pieces!inner(notes!inner(notebooks!inner(user_id))))")
      .eq("id", id)
      .eq("context_objects.note_pieces.notes.notebooks.user_id", userId)
      .single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw new DBError(error.message)
    }
    return data ? toQuiz(data as Record<string, unknown>) : null
  }

  async bulkCreate(quizzes: Quiz[]): Promise<void> {
    const { error } = await supabase.from("quizzes").insert(
      quizzes.map((q) => ({
        id: q.id,
        context_object_id: q.contextObjectId,
        type: q.type,
        question_sentence: q.questionSentence,
        answer: q.answer,
        choice_pool: q.choicePool,
        created_at: q.createdAt.toISOString(),
        updated_at: q.updatedAt.toISOString(),
      }))
    )
    if (error) throw new DBError(error.message)
  }
}

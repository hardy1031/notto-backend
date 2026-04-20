import { DBError } from "../../errors/index.ts"
import type { QuizQueryService } from "../../usecases/queries/QuizQueryService.ts"
import type { Quiz } from "../../domain/types.ts"
import sql from "../postgresClient.ts"

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

export class SupabaseQuizRepository implements QuizQueryService {
  async findByContextObjectIds(contextObjectIds: string[]): Promise<Quiz[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM quizzes WHERE context_object_id = ANY(${contextObjectIds})
      `
      return rows.map(toQuiz)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<Quiz[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT q.*
        FROM quizzes q
        JOIN context_objects co ON co.id = q.context_object_id
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId}
      `
      return rows.map(toQuiz)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Quiz | null> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT q.*
        FROM quizzes q
        JOIN context_objects co ON co.id = q.context_object_id
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE q.id = ${id} AND nb.user_id = ${userId}
      `
      return rows.length > 0 ? toQuiz(rows[0]!) : null
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

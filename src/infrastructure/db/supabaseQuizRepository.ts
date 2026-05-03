import { QuizEntity } from "../../domain/contextObject/quiz/QuizEntity.ts"
import type { QuizRepository } from "../../domain/contextObject/quiz/QuizRepository.ts"
import { DBError } from "../../errors/index.ts"
import type { QuizQueryService } from "../../usecases/queries/QuizQueryService.ts"
import sql from "../postgresClient.ts"

function toQuiz(row: Record<string, unknown>): QuizEntity {
  return QuizEntity.reconstruct({
    id: row.id as string,
    contextObjectId: row.context_object_id as string,
    type: row.type as QuizEntity["type"],
    questionSentence: row.question_sentence as string,
    answer: row.answer as string,
    choicePool: row.choice_pool as string[],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
  })
}

export class SupabaseQuizRepository implements QuizRepository, QuizQueryService {
  async findByContextObjectIds(contextObjectIds: string[]): Promise<QuizEntity[]> {
    if (contextObjectIds.length === 0) return []
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM quizzes WHERE context_object_id = ANY(${contextObjectIds})
      `
      return rows.map(toQuiz)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<QuizEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT q.*
        FROM quizzes q
        JOIN context_objects co ON co.id = q.context_object_id
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId} AND q.deleted_at IS NULL
      `
      return rows.map(toQuiz)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findAllForSync(userId: string): Promise<QuizEntity[]> {
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

  async findByIdAndUserId(id: string, userId: string): Promise<QuizEntity | null> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT q.*
        FROM quizzes q
        JOIN context_objects co ON co.id = q.context_object_id
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE q.id = ${id} AND nb.user_id = ${userId} AND q.deleted_at IS NULL
      `
      return rows.length > 0 ? toQuiz(rows[0]!) : null
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    try {
      await sql`
        UPDATE quizzes SET deleted_at = ${deletedAt.toISOString()} WHERE id = ${id}
      `
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

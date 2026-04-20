import { DBError } from "../../errors/index.ts"
import type { ContextObjectRepository } from "../../domain/contextObject/ContextObjectRepository.ts"
import type { ContextObjectQueryService } from "../../usecases/queries/ContextObjectQueryService.ts"
import type { ContextObject, Quiz } from "../../domain/types.ts"
import sql from "../postgresClient.ts"

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

export class SupabaseContextObjectRepository implements ContextObjectRepository, ContextObjectQueryService {
  async findByNoteIds(noteIds: string[]): Promise<ContextObject[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM context_objects WHERE note_id = ANY(${noteIds})
      `
      return rows.map(toContextObject)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<ContextObject[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT co.*
        FROM context_objects co
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId}
      `
      return rows.map(toContextObject)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findWithoutQuizzes(noteIds: string[]): Promise<ContextObject[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT co.*
        FROM context_objects co
        WHERE co.note_id = ANY(${noteIds})
          AND NOT EXISTS (
            SELECT 1 FROM quizzes q WHERE q.context_object_id = co.id
          )
      `
      return rows.map(toContextObject)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async bulkCreate(contextObjects: ContextObject[]): Promise<void> {
    if (contextObjects.length === 0) return
    try {
      const values = contextObjects.map((co) => ({
        id: co.id,
        note_piece_id: co.notePieceId,
        note_id: co.noteId,
        expression: co.expression,
        base_meaning: co.baseMeaning,
        actual_nuance: co.actualNuance,
        tone: co.tone,
        formality: co.formality,
        is_slang: co.isSlang,
        example_dialogue: JSON.stringify(co.exampleDialogue),
        created_at: co.createdAt.toISOString(),
        updated_at: co.updatedAt.toISOString(),
      }))
      await sql`
        INSERT INTO context_objects ${sql(values, "id", "note_piece_id", "note_id", "expression", "base_meaning", "actual_nuance", "tone", "formality", "is_slang", "example_dialogue", "created_at", "updated_at")}
      `
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async bulkCreateQuizzes(quizzes: Quiz[]): Promise<void> {
    if (quizzes.length === 0) return
    try {
      const values = quizzes.map((q) => ({
        id: q.id,
        context_object_id: q.contextObjectId,
        type: q.type,
        question_sentence: q.questionSentence,
        answer: q.answer,
        choice_pool: JSON.stringify(q.choicePool),
        created_at: q.createdAt.toISOString(),
        updated_at: q.updatedAt.toISOString(),
      }))
      await sql`
        INSERT INTO quizzes ${sql(values, "id", "context_object_id", "type", "question_sentence", "answer", "choice_pool", "created_at", "updated_at")}
      `
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserAndId(userId: string, id: string): Promise<ContextObject | null> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT co.*
        FROM context_objects co
        JOIN note_pieces np ON np.id = co.note_piece_id
        JOIN notes n ON n.id = np.note_id
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE co.id = ${id} AND nb.user_id = ${userId}
      `
      return rows.length > 0 ? toContextObject(rows[0]!) : null
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

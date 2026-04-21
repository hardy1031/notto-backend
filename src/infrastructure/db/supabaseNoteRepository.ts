import { DBError } from "../../errors/index.ts"
import type { NoteRepository } from "../../domain/note/NoteRepository.ts"
import type { NoteQueryService } from "../../usecases/queries/NoteQueryService.ts"
import type { Note, NotePiece } from "../../domain/types.ts"
import sql from "../postgresClient.ts"

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    notebookId: row.notebook_id as string,
    name: row.name as string,
    s3Key: row.s3_key as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    syncedAt: new Date(row.synced_at as string),
  }
}

export class SupabaseNoteRepository implements NoteRepository, NoteQueryService {
  async findByUserIdAndIds(userId: string, ids: string[]): Promise<Note[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT n.*
        FROM notes n
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId} AND n.id = ANY(${ids})
      `
      return rows.map(toNote)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<Note[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT n.*
        FROM notes n
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId}
      `
      return rows.map(toNote)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async createWithNotePieces(note: Note, pieces: NotePiece[]): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO notes (id, notebook_id, name, s3_key, created_at, updated_at, synced_at)
          VALUES (${note.id}, ${note.notebookId}, ${note.name}, ${note.s3Key},
                  ${note.createdAt.toISOString()}, ${note.updatedAt.toISOString()}, ${note.syncedAt.toISOString()})
        `
        if (pieces.length > 0) {
          const values = pieces.map((p) => ({ id: p.id, note_id: p.noteId, created_at: p.createdAt.toISOString() }))
          await tx`
            INSERT INTO note_pieces ${tx(values, "id", "note_id", "created_at")}
            ON CONFLICT (id) DO UPDATE SET note_id = EXCLUDED.note_id, created_at = EXCLUDED.created_at
          `
        }
      })
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async updateSyncedAt(ids: string[], syncedAt: Date): Promise<void> {
    try {
      await sql`UPDATE notes SET synced_at = ${syncedAt.toISOString()} WHERE id = ANY(${ids})`
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async updateWithNotePieces(note: Note, pieces: NotePiece[]): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE notes
          SET name = ${note.name}, updated_at = ${note.updatedAt.toISOString()}, synced_at = ${note.syncedAt.toISOString()}
          WHERE id = ${note.id}
        `
        await tx`DELETE FROM note_pieces WHERE note_id = ${note.id}`
        if (pieces.length > 0) {
          const values = pieces.map((p) => ({ id: p.id, note_id: p.noteId, created_at: p.createdAt.toISOString() }))
          await tx`
            INSERT INTO note_pieces ${tx(values, "id", "note_id", "created_at")}
            ON CONFLICT (id) DO UPDATE SET note_id = EXCLUDED.note_id, created_at = EXCLUDED.created_at
          `
        }
      })
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

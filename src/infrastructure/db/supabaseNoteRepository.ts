import { NoteEntity } from "../../domain/note/NoteEntity.ts"
import type { NoteRepository } from "../../domain/note/NoteRepository.ts"
import type { NotePieceEntity } from "../../domain/note/notePiece/NotePieceEntity.ts"
import { DBError } from "../../errors/index.ts"
import type { NoteQueryService } from "../../usecases/queries/NoteQueryService.ts"
import sql from "../postgresClient.ts"

function toNote(row: Record<string, unknown>): NoteEntity {
  return NoteEntity.reconstruct({
    id: row.id as string,
    notebookId: row.notebook_id as string,
    name: row.name as string,
    s3Key: row.s3_key as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    syncedAt: new Date(row.synced_at as string),
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
  })
}

export class SupabaseNoteRepository implements NoteRepository, NoteQueryService {
  async findByUserIdAndIds(userId: string, ids: string[]): Promise<NoteEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT n.*
        FROM notes n
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId} AND n.id = ANY(${ids}) AND n.deleted_at IS NULL
      `
      return rows.map(toNote)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<NoteEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT n.*
        FROM notes n
        JOIN notebooks nb ON nb.id = n.notebook_id
        WHERE nb.user_id = ${userId} AND n.deleted_at IS NULL
      `
      return rows.map(toNote)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findAllForSync(userId: string): Promise<NoteEntity[]> {
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

  async createWithNotePieces(note: NoteEntity, pieces: NotePieceEntity[]): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO notes (id, notebook_id, name, s3_key, created_at, updated_at, synced_at)
          VALUES (${note.id}, ${note.notebookId}, ${note.name}, ${note.s3Key},
                  ${note.createdAt.toISOString()}, ${note.updatedAt.toISOString()}, ${note.syncedAt.toISOString()})
        `
        if (pieces.length > 0) {
          const values = pieces.map((p) => ({
            id: p.id,
            note_id: p.noteId,
            created_at: p.createdAt.toISOString(),
          }))
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

  async updateWithNotePieces(note: NoteEntity, pieces: NotePieceEntity[]): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE notes
          SET name = ${note.name}, updated_at = ${note.updatedAt.toISOString()}, synced_at = ${note.syncedAt.toISOString()}
          WHERE id = ${note.id}
        `
        await tx`DELETE FROM note_pieces WHERE note_id = ${note.id}`
        if (pieces.length > 0) {
          const values = pieces.map((p) => ({
            id: p.id,
            note_id: p.noteId,
            created_at: p.createdAt.toISOString(),
          }))
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

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        // physically delete note_pieces (cascades to context_objects and quizzes)
        await tx`DELETE FROM note_pieces WHERE note_id = ${id}`
        // soft-delete the note
        await tx`UPDATE notes SET deleted_at = ${deletedAt.toISOString()} WHERE id = ${id}`
      })
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

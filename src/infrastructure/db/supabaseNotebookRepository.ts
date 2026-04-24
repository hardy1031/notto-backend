import { NotebookEntity } from "../../domain/notebook/NotebookEntity.ts"
import type { NotebookRepository } from "../../domain/notebook/NotebookRepository.ts"
import { DBError } from "../../errors/index.ts"
import type { NotebookQueryService } from "../../usecases/queries/NotebookQueryService.ts"
import sql from "../postgresClient.ts"

function toNotebook(row: Record<string, unknown>): NotebookEntity {
  return NotebookEntity.reconstruct({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    syncedAt: new Date(row.synced_at as string),
  })
}

export class SupabaseNotebookRepository implements NotebookRepository, NotebookQueryService {
  async findByUserIdAndIds(userId: string, ids: string[]): Promise<NotebookEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM notebooks WHERE user_id = ${userId} AND id = ANY(${ids})
      `
      return rows.map(toNotebook)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserId(userId: string): Promise<NotebookEntity[]> {
    try {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT * FROM notebooks WHERE user_id = ${userId}
      `
      return rows.map(toNotebook)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async create(notebook: NotebookEntity): Promise<void> {
    try {
      await sql`
        INSERT INTO notebooks (id, user_id, name, created_at, updated_at, synced_at)
        VALUES (${notebook.id}, ${notebook.userId}, ${notebook.name},
                ${notebook.createdAt.toISOString()}, ${notebook.updatedAt.toISOString()}, ${notebook.syncedAt.toISOString()})
      `
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async updateSyncedAt(ids: string[], syncedAt: Date): Promise<void> {
    try {
      await sql`UPDATE notebooks SET synced_at = ${syncedAt.toISOString()} WHERE id = ANY(${ids})`
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async update(notebook: NotebookEntity): Promise<void> {
    try {
      await sql`
        UPDATE notebooks
        SET name = ${notebook.name}, updated_at = ${notebook.updatedAt.toISOString()}, synced_at = ${notebook.syncedAt.toISOString()}
        WHERE id = ${notebook.id}
      `
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

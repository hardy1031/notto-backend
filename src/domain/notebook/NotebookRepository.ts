import type { NotebookEntity } from "./NotebookEntity.ts"

/** Aggregate root: Notebook */
export interface NotebookRepository {
  create(notebook: NotebookEntity): Promise<void>
  update(notebook: NotebookEntity): Promise<void>
  updateSyncedAt(ids: string[], syncedAt: Date): Promise<void>
  /** Soft-deletes the notebook and cascade soft-deletes its notes, physically deletes note_pieces. All in one transaction. */
  softDeleteWithCascade(id: string, deletedAt: Date): Promise<void>
}

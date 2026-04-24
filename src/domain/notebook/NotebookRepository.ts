import type { NotebookEntity } from "./NotebookEntity.ts"

/** Aggregate root: Notebook */
export interface NotebookRepository {
  create(notebook: NotebookEntity): Promise<void>
  update(notebook: NotebookEntity): Promise<void>
  updateSyncedAt(ids: string[], syncedAt: Date): Promise<void>
}

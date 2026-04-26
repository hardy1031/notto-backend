import type { NotebookEntity } from "../../domain/notebook/NotebookEntity.ts"

export interface NotebookQueryService {
  /** Returns non-deleted notebooks for the user. */
  findByUserId(userId: string): Promise<NotebookEntity[]>
  /** Returns non-deleted notebooks matching the given IDs. */
  findByUserIdAndIds(userId: string, ids: string[]): Promise<NotebookEntity[]>
  /** Returns all notebooks including deleted ones — for sync tombstone detection. */
  findAllForSync(userId: string): Promise<NotebookEntity[]>
}

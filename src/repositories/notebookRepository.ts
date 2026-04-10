import type { Notebook } from "./types.ts"

export interface NotebookRepository {
  findByUserIdAndIds(userId: string, ids: string[]): Promise<Notebook[]>
  findByUserId(userId: string): Promise<Notebook[]>
  create(notebook: Notebook): Promise<void>
  update(notebook: Notebook): Promise<void>
}

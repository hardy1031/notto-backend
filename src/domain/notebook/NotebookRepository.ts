import type { Notebook } from "../types.ts"

/** Aggregate root: Notebook */
export interface NotebookRepository {
  create(notebook: Notebook): Promise<void>
  update(notebook: Notebook): Promise<void>
}

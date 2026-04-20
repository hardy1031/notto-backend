import type { Notebook } from "../../domain/types.ts"

export interface NotebookQueryService {
  findByUserId(userId: string): Promise<Notebook[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<Notebook[]>
}

import type { NotebookEntity } from "../../domain/notebook/NotebookEntity.ts"

export interface NotebookQueryService {
  findByUserId(userId: string): Promise<NotebookEntity[]>
  findByUserIdAndIds(userId: string, ids: string[]): Promise<NotebookEntity[]>
}

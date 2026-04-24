import type { ContextObjectEntity } from "../../domain/contextObject/ContextObjectEntity.ts"

export interface ContextObjectQueryService {
  findByNoteIds(noteIds: string[]): Promise<ContextObjectEntity[]>
  findByUserId(userId: string): Promise<ContextObjectEntity[]>
  findWithoutQuizzes(noteIds: string[]): Promise<ContextObjectEntity[]>
  findByUserAndId(userId: string, id: string): Promise<ContextObjectEntity | null>
}

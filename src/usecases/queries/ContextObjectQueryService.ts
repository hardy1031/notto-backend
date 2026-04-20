import type { ContextObject } from "../../domain/types.ts"

export interface ContextObjectQueryService {
  findByNoteIds(noteIds: string[]): Promise<ContextObject[]>
  findByUserId(userId: string): Promise<ContextObject[]>
  findWithoutQuizzes(noteIds: string[]): Promise<ContextObject[]>
  findByUserAndId(userId: string, id: string): Promise<ContextObject | null>
}

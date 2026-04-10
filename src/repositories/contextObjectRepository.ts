import type { ContextObject } from "./types.ts"

export interface ContextObjectRepository {
  findByNoteIds(noteIds: string[]): Promise<ContextObject[]>
  findWithoutQuizzes(noteIds: string[]): Promise<ContextObject[]>
  bulkCreate(contextObjects: ContextObject[]): Promise<void>
  findByUserAndId(userId: string, id: string): Promise<ContextObject | null>
}

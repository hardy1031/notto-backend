/** Repository for Quiz aggregate operations. */
export interface QuizRepository {
  softDelete(id: string, deletedAt: Date): Promise<void>
}

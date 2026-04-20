import { DBError } from "../../errors/index.ts"
import type { QuizRunRepository } from "../../domain/quizRun/QuizRunRepository.ts"
import type { QuizRunQueryService } from "../../usecases/queries/QuizRunQueryService.ts"
import type { QuizRecord, QuizRun, QuizRunWithRecords } from "../../domain/types.ts"
import sql from "../postgresClient.ts"

function toQuizRun(row: Record<string, unknown>): QuizRun {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
  }
}

function toQuizRecord(row: Record<string, unknown>): QuizRecord {
  return {
    id: row.id as string,
    quizRunId: row.quiz_run_id as string,
    quizId: row.quiz_id as string,
    choices: row.choices as string[],
    userAnswer: (row.user_answer as string) ?? null,
    isCorrect: (row.is_correct as boolean) ?? null,
    createdAt: new Date(row.created_at as string),
  }
}

function groupRunsWithRecords(runs: QuizRun[], records: QuizRecord[]): QuizRunWithRecords[] {
  const recordsByRunId = new Map<string, QuizRecord[]>()
  for (const record of records) {
    const existing = recordsByRunId.get(record.quizRunId) ?? []
    existing.push(record)
    recordsByRunId.set(record.quizRunId, existing)
  }
  return runs.map((run) => ({
    quizRun: run,
    quizRecords: recordsByRunId.get(run.id) ?? [],
  }))
}

export class SupabaseQuizRunRepository implements QuizRunRepository, QuizRunQueryService {
  async findByUserId(userId: string): Promise<QuizRunWithRecords[]> {
    try {
      const runs = (
        await sql<Record<string, unknown>[]>`SELECT * FROM quiz_runs WHERE user_id = ${userId}`
      ).map(toQuizRun)

      if (runs.length === 0) return []

      const runIds = runs.map((r) => r.id)
      const records = (
        await sql<Record<string, unknown>[]>`SELECT * FROM quiz_records WHERE quiz_run_id = ANY(${runIds})`
      ).map(toQuizRecord)

      return groupRunsWithRecords(runs, records)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async findByUserIdAndIds(userId: string, ids: string[]): Promise<QuizRunWithRecords[]> {
    try {
      const runs = (
        await sql<Record<string, unknown>[]>`
          SELECT * FROM quiz_runs WHERE user_id = ${userId} AND id = ANY(${ids})
        `
      ).map(toQuizRun)

      if (runs.length === 0) return []

      const runIds = runs.map((r) => r.id)
      const records = (
        await sql<Record<string, unknown>[]>`SELECT * FROM quiz_records WHERE quiz_run_id = ANY(${runIds})`
      ).map(toQuizRecord)

      return groupRunsWithRecords(runs, records)
    } catch (e) {
      throw new DBError(String(e))
    }
  }

  async save(
    quizRun: QuizRun,
    quizRecords: QuizRecord[]
  ): Promise<{ quizRun: QuizRun; quizRecords: QuizRecord[] }> {
    try {
      await sql`
        INSERT INTO quiz_runs (id, user_id, started_at, completed_at)
        VALUES (${quizRun.id}, ${quizRun.userId}, ${quizRun.startedAt.toISOString()},
                ${quizRun.completedAt ? quizRun.completedAt.toISOString() : null})
      `

      if (quizRecords.length > 0) {
        const values = quizRecords.map((r) => ({
          id: r.id,
          quiz_run_id: r.quizRunId,
          quiz_id: r.quizId,
          choices: JSON.stringify(r.choices),
          user_answer: r.userAnswer,
          is_correct: r.isCorrect,
          created_at: r.createdAt.toISOString(),
        }))
        await sql`
          INSERT INTO quiz_records ${sql(values, "id", "quiz_run_id", "quiz_id", "choices", "user_answer", "is_correct", "created_at")}
        `
      }

      return { quizRun, quizRecords }
    } catch (e) {
      throw new DBError(String(e))
    }
  }
}

import { DBError } from "../../errors/index.ts"
import type { QuizRunRepository } from "../../repositories/quizRunRepository.ts"
import type { QuizRecord, QuizRun, QuizRunWithRecords } from "../../repositories/types.ts"
import { supabase } from "../supabaseClient.ts"

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
    userAnswer: row.user_answer as string,
    isCorrect: row.is_correct as boolean,
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

export class SupabaseQuizRunRepository implements QuizRunRepository {
  async findByUserId(userId: string): Promise<QuizRunWithRecords[]> {
    const { data: runsData, error: runsError } = await supabase
      .from("quiz_runs")
      .select("*")
      .eq("user_id", userId)
    if (runsError) throw new DBError(runsError.message)

    const runs = (runsData ?? []).map(toQuizRun)
    const runIds = runs.map((r) => r.id)
    if (runIds.length === 0) return []

    const { data: recordsData, error: recordsError } = await supabase
      .from("quiz_records")
      .select("*")
      .in("quiz_run_id", runIds)
    if (recordsError) throw new DBError(recordsError.message)

    const records = (recordsData ?? []).map(toQuizRecord)
    return groupRunsWithRecords(runs, records)
  }

  async findByUserIdAndIds(userId: string, ids: string[]): Promise<QuizRunWithRecords[]> {
    const { data: runsData, error: runsError } = await supabase
      .from("quiz_runs")
      .select("*")
      .eq("user_id", userId)
      .in("id", ids)
    if (runsError) throw new DBError(runsError.message)

    const runs = (runsData ?? []).map(toQuizRun)
    const runIds = runs.map((r) => r.id)
    if (runIds.length === 0) return []

    const { data: recordsData, error: recordsError } = await supabase
      .from("quiz_records")
      .select("*")
      .in("quiz_run_id", runIds)
    if (recordsError) throw new DBError(recordsError.message)

    const records = (recordsData ?? []).map(toQuizRecord)
    return groupRunsWithRecords(runs, records)
  }

  async save(
    quizRun: QuizRun,
    quizRecords: QuizRecord[]
  ): Promise<{ quizRun: QuizRun; quizRecords: QuizRecord[] }> {
    const { error: runError } = await supabase.from("quiz_runs").insert({
      id: quizRun.id,
      user_id: quizRun.userId,
      started_at: quizRun.startedAt.toISOString(),
      completed_at: quizRun.completedAt ? quizRun.completedAt.toISOString() : null,
    })
    if (runError) throw new DBError(runError.message)

    if (quizRecords.length > 0) {
      const { error: recordsError } = await supabase.from("quiz_records").insert(
        quizRecords.map((r) => ({
          id: r.id,
          quiz_run_id: r.quizRunId,
          quiz_id: r.quizId,
          user_answer: r.userAnswer,
          is_correct: r.isCorrect,
          created_at: r.createdAt.toISOString(),
        }))
      )
      if (recordsError) throw new DBError(recordsError.message)
    }

    return { quizRun, quizRecords }
  }
}

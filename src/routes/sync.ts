import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { SupabaseContextObjectRepository } from "../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../infrastructure/repositories/supabaseNotebookRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../infrastructure/repositories/supabaseQuizRunRepository.ts"
import { MockNoteStorageRepository } from "../infrastructure/mockNoteStorageRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { ContextObject, Note, Notebook, QuizRecord, QuizRun } from "../repositories/types.ts"
import type { Quiz } from "../repositories/types.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncUseCase } from "../usecases/SyncUseCase.ts"

const notebookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

const noteSchema = z.object({
  id: z.string().uuid(),
  notebook_id: z.string().uuid(),
  s3_key: z.string(),
  content: z.string().default(""),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

const quizRecordSchema = z.object({
  id: z.string().uuid(),
  quiz_id: z.string().uuid(),
  user_answer: z.string(),
  is_correct: z.boolean(),
  created_at: z.string().datetime(),
})

const quizRunSchema = z.object({
  id: z.string().uuid(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  records: z.array(quizRecordSchema),
})

function serializeNotebook(n: Notebook) {
  return {
    id: n.id,
    user_id: n.userId,
    name: n.name,
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  }
}

function serializeNote(n: Note) {
  return {
    id: n.id,
    notebook_id: n.notebookId,
    s3_key: n.s3Key,
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  }
}

function serializeContextObject(co: ContextObject) {
  return {
    id: co.id,
    note_piece_id: co.notePieceId,
    note_id: co.noteId,
    expression: co.expression,
    base_meaning: co.baseMeaning,
    actual_nuance: co.actualNuance,
    tone: co.tone,
    formality: co.formality,
    is_slang: co.isSlang,
    example_dialogue: co.exampleDialogue,
    created_at: co.createdAt.toISOString(),
    updated_at: co.updatedAt.toISOString(),
  }
}

function serializeQuiz(q: Quiz) {
  return {
    id: q.id,
    context_object_id: q.contextObjectId,
    type: q.type,
    question_sentence: q.questionSentence,
    answer: q.answer,
    created_at: q.createdAt.toISOString(),
    updated_at: q.updatedAt.toISOString(),
  }
}

function serializeQuizRun(r: QuizRun) {
  return {
    id: r.id,
    user_id: r.userId,
    started_at: r.startedAt.toISOString(),
    completed_at: r.completedAt ? r.completedAt.toISOString() : null,
  }
}

function serializeQuizRecord(r: QuizRecord) {
  return {
    id: r.id,
    quiz_run_id: r.quizRunId,
    quiz_id: r.quizId,
    user_answer: r.userAnswer,
    is_correct: r.isCorrect,
    created_at: r.createdAt.toISOString(),
  }
}

export const syncRouter = new Hono<{ Variables: AppVariables }>()

syncRouter.use("*", authMiddleware)

syncRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      notebooks: z.array(notebookSchema).default([]),
      notes: z.array(noteSchema).default([]),
      quiz_runs: z.array(quizRunSchema).default([]),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await SyncUseCase(
      {
        userId,
        notebooks: body.notebooks.map((n) => ({
          id: n.id,
          userId,
          name: n.name,
          createdAt: new Date(n.created_at),
          updatedAt: new Date(n.updated_at),
        })),
        notes: body.notes.map((n) => ({
          id: n.id,
          notebookId: n.notebook_id,
          s3Key: n.s3_key,
          content: n.content,
          createdAt: new Date(n.created_at),
          updatedAt: new Date(n.updated_at),
        })),
        quizRuns: body.quiz_runs.map((r) => ({
          id: r.id,
          userId,
          startedAt: new Date(r.started_at),
          completedAt: r.completed_at ? new Date(r.completed_at) : null,
          records: r.records.map((rec) => ({
            id: rec.id,
            quizId: rec.quiz_id,
            userAnswer: rec.user_answer,
            isCorrect: rec.is_correct,
            createdAt: new Date(rec.created_at),
          })),
        })),
      },
      {
        notebookRepo: new SupabaseNotebookRepository(),
        noteRepo: new SupabaseNoteRepository(),
        notePieceRepo: new SupabaseNotePieceRepository(),
        noteStorage: new MockNoteStorageRepository(),
        contextObjectRepo: new SupabaseContextObjectRepository(),
        quizRepo: new SupabaseQuizRepository(),
        quizRunRepo: new SupabaseQuizRunRepository(),
      }
    )

    return c.json({
      notebooks: result.notebooks.map(serializeNotebook),
      notes: result.notes.map(serializeNote),
      context_objects: result.contextObjects.map(serializeContextObject),
      quizzes: result.quizzes.map(serializeQuiz),
      quiz_runs: result.quizRuns.map(serializeQuizRun),
      quiz_records: result.quizRecords.map(serializeQuizRecord),
    })
  }
)

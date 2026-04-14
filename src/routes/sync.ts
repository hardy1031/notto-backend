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

function serializeNotebook(notebook: Notebook) {
  return {
    id: notebook.id,
    user_id: notebook.userId,
    name: notebook.name,
    created_at: notebook.createdAt.toISOString(),
    updated_at: notebook.updatedAt.toISOString(),
  }
}

function serializeNote(note: Note) {
  return {
    id: note.id,
    notebook_id: note.notebookId,
    s3_key: note.s3Key,
    created_at: note.createdAt.toISOString(),
    updated_at: note.updatedAt.toISOString(),
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

function serializeQuiz(quiz: Quiz) {
  return {
    id: quiz.id,
    context_object_id: quiz.contextObjectId,
    type: quiz.type,
    question_sentence: quiz.questionSentence,
    answer: quiz.answer,
    choices: quiz.choices,
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
  }
}

function serializeQuizRun(quizRun: QuizRun) {
  return {
    id: quizRun.id,
    user_id: quizRun.userId,
    started_at: quizRun.startedAt.toISOString(),
    completed_at: quizRun.completedAt ? quizRun.completedAt.toISOString() : null,
  }
}

function serializeQuizRecord(quizRecord: QuizRecord) {
  return {
    id: quizRecord.id,
    quiz_run_id: quizRecord.quizRunId,
    quiz_id: quizRecord.quizId,
    user_answer: quizRecord.userAnswer,
    is_correct: quizRecord.isCorrect,
    created_at: quizRecord.createdAt.toISOString(),
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
        notebooks: body.notebooks.map((notebook) => ({
          id: notebook.id,
          userId,
          name: notebook.name,
          createdAt: new Date(notebook.created_at),
          updatedAt: new Date(notebook.updated_at),
        })),
        notes: body.notes.map((note) => ({
          id: note.id,
          notebookId: note.notebook_id,
          s3Key: note.s3_key,
          content: note.content,
          createdAt: new Date(note.created_at),
          updatedAt: new Date(note.updated_at),
        })),
        quizRuns: body.quiz_runs.map((quizRun) => ({
          id: quizRun.id,
          userId,
          startedAt: new Date(quizRun.started_at),
          completedAt: quizRun.completed_at ? new Date(quizRun.completed_at) : null,
          records: quizRun.records.map((record) => ({
            id: record.id,
            quizId: record.quiz_id,
            userAnswer: record.user_answer,
            isCorrect: record.is_correct,
            createdAt: new Date(record.created_at),
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

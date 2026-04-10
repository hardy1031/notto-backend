import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { fetchNoteContent } from "../domain/note/fetchNoteContent.ts"
import { MockAIRepository } from "../infrastructure/aiClient.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../infrastructure/repositories/supabaseNotebookRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../infrastructure/repositories/supabaseQuizRunRepository.ts"
import { S3NoteStorageRepository } from "../infrastructure/s3Client.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { GenerateQuizzesUseCase } from "../usecases/GenerateQuizzesUseCase.ts"
import { SyncUseCase } from "../usecases/SyncUseCase.ts"

export const interpretRouter = new Hono<{ Variables: AppVariables }>()

interpretRouter.use("*", authMiddleware)

interpretRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      notebooks: z
        .array(
          z.object({
            id: z.string().uuid(),
            name: z.string().min(1),
            created_at: z.string().datetime(),
            updated_at: z.string().datetime(),
          })
        )
        .default([]),
      notes: z.array(
        z.object({
          id: z.string().uuid(),
          notebook_id: z.string().uuid(),
          content: z.string(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime(),
        })
      ),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const noteStorage = new S3NoteStorageRepository()
    const notebookRepo = new SupabaseNotebookRepository()
    const noteRepo = new SupabaseNoteRepository()
    const notePieceRepo = new SupabaseNotePieceRepository()
    const contextObjectRepo = new SupabaseContextObjectRepository()
    const quizRepo = new SupabaseQuizRepository()
    const quizRunRepo = new SupabaseQuizRunRepository()
    const aiRepo = new MockAIRepository()

    const contentByNoteId = new Map(body.notes.map((n) => [n.id, n.content]))

    const syncResult = await SyncUseCase(
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
          s3Key: `${userId}/${n.notebook_id}/${n.id}.md`,
          content: n.content,
          createdAt: new Date(n.created_at),
          updatedAt: new Date(n.updated_at),
        })),
      },
      {
        notebookRepo,
        noteRepo,
        notePieceRepo,
        noteStorage,
        contextObjectRepo,
        quizRepo,
        quizRunRepo,
      }
    )

    const generateResult = await GenerateQuizzesUseCase(syncResult.syncedNoteIds, {
      notePieceRepo,
      contextObjectRepo,
      quizRepo,
      noteStorage,
      aiRepo,
      getNoteContent: async (noteId) => {
        const fromRequest = contentByNoteId.get(noteId)
        if (fromRequest !== undefined) return fromRequest
        const note = await noteRepo.findByUserIdAndIds(userId, [noteId])
        if (!note[0]) throw new Error(`Note not found: ${noteId}`)
        return fetchNoteContent(note[0].s3Key, noteStorage)
      },
    })

    return c.json(
      {
        generated: generateResult.generated.map((item) => ({
          context_object: {
            id: item.contextObject.id,
            note_piece_id: item.contextObject.notePieceId,
            note_id: item.contextObject.noteId,
            expression: item.contextObject.expression,
            base_meaning: item.contextObject.baseMeaning,
            actual_nuance: item.contextObject.actualNuance,
            tone: item.contextObject.tone,
            formality: item.contextObject.formality,
            is_slang: item.contextObject.isSlang,
            example_dialogue: item.contextObject.exampleDialogue,
            created_at: item.contextObject.createdAt.toISOString(),
            updated_at: item.contextObject.updatedAt.toISOString(),
          },
          quizzes: item.quizzes.map((q) => ({
            id: q.id,
            context_object_id: q.contextObjectId,
            type: q.type,
            question_sentence: q.questionSentence,
            answer: q.answer,
            created_at: q.createdAt.toISOString(),
            updated_at: q.updatedAt.toISOString(),
          })),
        })),
      },
      201
    )
  }
)

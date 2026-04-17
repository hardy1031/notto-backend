import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { MockAIRepository } from "../infrastructure/aiClient.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { createNoteStorageRepository } from "../infrastructure/noteStorageFactory.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { userRateLimit } from "../middleware/rateLimit.ts"
import type { AppVariables } from "../types/hono.ts"
import { GenerateQuizzesUseCase } from "../usecases/GenerateQuizzesUseCase.ts"

export const syncQuizzesRouter = new Hono<{ Variables: AppVariables }>()

syncQuizzesRouter.use("*", authMiddleware)
syncQuizzesRouter.use("*", userRateLimit(20, 60 * 1000)) // 20 requests per minute

syncQuizzesRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      context_object_ids: z.array(z.string().uuid()).default([]),
      quiz_ids: z.array(z.string().uuid()).default([]),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await GenerateQuizzesUseCase(
      {
        userId,
        clientContextObjectIds: body.context_object_ids,
        clientQuizIds: body.quiz_ids,
      },
      {
        noteRepo: new SupabaseNoteRepository(),
        noteStorage: createNoteStorageRepository(),
        notePieceRepo: new SupabaseNotePieceRepository(),
        contextObjectRepo: new SupabaseContextObjectRepository(),
        quizRepo: new SupabaseQuizRepository(),
        aiRepo: new MockAIRepository(),
      }
    )

    return c.json(
      {
        context_objects: result.contextObjects.map((co) => ({
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
        })),
        quizzes: result.quizzes.map((q) => ({
          id: q.id,
          context_object_id: q.contextObjectId,
          type: q.type,
          question_sentence: q.questionSentence,
          answer: q.answer,
          choice_pool: q.choicePool,
          created_at: q.createdAt.toISOString(),
          updated_at: q.updatedAt.toISOString(),
        })),
      },
      201
    )
  }
)

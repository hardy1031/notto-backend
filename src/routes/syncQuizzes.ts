import { Hono } from "hono"
import { MockAIRepository } from "../infrastructure/ai/geminiAIRepository.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/db/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../infrastructure/db/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/db/supabaseNoteRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/db/supabaseQuizRepository.ts"
import { S3NoteStorageRepository } from "../infrastructure/s3NoteStorageRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { userRateLimit } from "../middleware/rateLimit.ts"
import { validate } from "../middleware/validate.ts"
import { syncQuizzesSchema } from "../schemas/sync.ts"
import type { AppVariables } from "../types/hono.ts"
import { GenerateQuizzesUseCase } from "../usecases/GenerateQuizzesUseCase.ts"

export const syncQuizzesRouter = new Hono<{ Variables: AppVariables }>()

syncQuizzesRouter.use("*", authMiddleware)
syncQuizzesRouter.use("*", userRateLimit(20, 60 * 1000)) // 20 requests per minute

syncQuizzesRouter.post(
  "/",
  validate("json", syncQuizzesSchema),
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
        noteStorage: new S3NoteStorageRepository(),
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

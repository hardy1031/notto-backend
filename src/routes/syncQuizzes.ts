import { Hono } from "hono"
import { GeminiAIService } from "../infrastructure/ai/geminiAIService.ts"
import { SupabaseContextObjectRepository } from "../infrastructure/db/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../infrastructure/db/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/db/supabaseNoteRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/db/supabaseQuizRepository.ts"
import { S3NoteStorageService } from "../infrastructure/s3NoteStorageService.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { userRateLimit } from "../middleware/rateLimit.ts"
import { validate } from "../middleware/validate.ts"
import { syncQuizzesSchema } from "../schemas/sync.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncQuizzesUseCase } from "../usecases/SyncQuizzesUseCase.ts"

export const syncQuizzesRouter = new Hono<{ Variables: AppVariables }>()

syncQuizzesRouter.use("*", authMiddleware)
syncQuizzesRouter.use("*", userRateLimit(20, 60 * 1000))

syncQuizzesRouter.post("/", validate("json", syncQuizzesSchema), async (c) => {
  const userId = c.get("userId")
  const body = c.req.valid("json")

  const quizRepo = new SupabaseQuizRepository()

  const result = await SyncQuizzesUseCase(
    {
      userId,
      clientContextObjectIds: body.context_object_ids,
      clientQuizIds: body.quiz_ids,
      deletedQuizIds: body.deleted_quiz_ids,
    },
    {
      noteRepo: new SupabaseNoteRepository(),
      noteStorage: new S3NoteStorageService(),
      notePieceRepo: new SupabaseNotePieceRepository(),
      contextObjectRepo: new SupabaseContextObjectRepository(),
      contextObjectQueryService: new SupabaseContextObjectRepository(),
      quizQueryService: quizRepo,
      quizRepo,
      aiRepo: new GeminiAIService(),
    }
  )

  return c.json(
    {
      context_objects: result.contextObjects.map((contextObject) => ({
        id: contextObject.id,
        note_piece_id: contextObject.notePieceId,
        note_id: contextObject.noteId,
        expression: contextObject.expression,
        base_meaning: contextObject.baseMeaning,
        actual_nuance: contextObject.actualNuance,
        tone: contextObject.tone,
        formality: contextObject.formality,
        is_slang: contextObject.isSlang,
        example_dialogue: contextObject.exampleDialogue,
        created_at: contextObject.createdAt.toISOString(),
        updated_at: contextObject.updatedAt.toISOString(),
      })),
      quizzes: result.quizzes.map((quiz) => ({
        id: quiz.id,
        context_object_id: quiz.contextObjectId,
        type: quiz.type,
        question_sentence: quiz.questionSentence,
        answer: quiz.answer,
        choice_pool: quiz.choicePool,
        created_at: quiz.createdAt.toISOString(),
        updated_at: quiz.updatedAt.toISOString(),
        deleted_at: quiz.deletedAt?.toISOString() ?? null,
      })),
    },
    200
  )
})

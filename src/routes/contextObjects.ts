import { Hono } from "hono"
import { SupabaseContextObjectRepository } from "../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { SupabaseQuizRepository } from "../infrastructure/repositories/supabaseQuizRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"

export const contextObjectsRouter = new Hono<{ Variables: AppVariables }>()

contextObjectsRouter.use("*", authMiddleware)

contextObjectsRouter.get("/", async (c) => {
  const userId = c.get("userId")

  const contextObjectRepo = new SupabaseContextObjectRepository()
  const quizRepo = new SupabaseQuizRepository()

  const contextObjects = await contextObjectRepo.findByUserId(userId)
  const contextObjectIds = contextObjects.map((co) => co.id)
  const quizzes = contextObjectIds.length > 0 ? await quizRepo.findByContextObjectIds(contextObjectIds) : []

  const quizzesByContextObjectId = new Map<string, typeof quizzes>()
  for (const quiz of quizzes) {
    const existing = quizzesByContextObjectId.get(quiz.contextObjectId) ?? []
    existing.push(quiz)
    quizzesByContextObjectId.set(quiz.contextObjectId, existing)
  }

  return c.json(
    contextObjects.map((co) => ({
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
      quizzes: (quizzesByContextObjectId.get(co.id) ?? []).map((q) => ({
        id: q.id,
        context_object_id: q.contextObjectId,
        type: q.type,
        question_sentence: q.questionSentence,
        answer: q.answer,
        choices: q.choices,
        created_at: q.createdAt.toISOString(),
        updated_at: q.updatedAt.toISOString(),
      })),
    }))
  )
})

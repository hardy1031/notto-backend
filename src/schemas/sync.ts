import { z } from "zod"

export const notePieceContentSchema = z.object({
  notePieceId: z.string().uuid(),
  expression: z.string().min(1),
  annotation: z.string().min(1),
})

export const parsedNoteSchema = z.array(notePieceContentSchema).max(200)

export const syncNotebooksSchema = z.object({
  notebooks: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100),
        created_at: z.string().datetime(),
        updated_at: z.string().datetime(),
      })
    )
    .max(500)
    .default([]),
  notes: z
    .array(
      z.object({
        id: z.string().uuid(),
        notebook_id: z.string().uuid(),
        name: z.string().min(1).max(100),
        content: parsedNoteSchema,
        created_at: z.string().datetime(),
        updated_at: z.string().datetime(),
      })
    )
    .max(500)
    .default([]),
})

export const syncQuizzesSchema = z.object({
  context_object_ids: z.array(z.string().uuid()).default([]),
  quiz_ids: z.array(z.string().uuid()).default([]),
})

export const syncQuizRunsSchema = z.object({
  quiz_runs: z
    .array(
      z.object({
        id: z.string().uuid(),
        started_at: z.string().datetime(),
        completed_at: z.string().datetime().nullable(),
        records: z
          .array(
            z.object({
              id: z.string().uuid(),
              quiz_id: z.string().uuid(),
              choices: z.array(z.string().max(500)).max(10),
              user_answer: z.string().min(1).max(500),
              is_correct: z.boolean(),
              created_at: z.string().datetime(),
            })
          )
          .min(1)
          .max(200),
      })
    )
    .max(100)
    .default([]),
})

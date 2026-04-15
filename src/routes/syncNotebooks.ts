import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { SupabaseNotePieceRepository } from "../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../infrastructure/repositories/supabaseNotebookRepository.ts"
import { MockNoteStorageRepository } from "../infrastructure/mockNoteStorageRepository.ts"
import { authMiddleware } from "../middleware/auth.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncUseCase } from "../usecases/SyncUseCase.ts"

export const syncNotebooksRouter = new Hono<{ Variables: AppVariables }>()

syncNotebooksRouter.use("*", authMiddleware)

syncNotebooksRouter.post(
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
      notes: z
        .array(
          z.object({
            id: z.string().uuid(),
            notebook_id: z.string().uuid(),
            content: z.string().min(1),
            created_at: z.string().datetime(),
            updated_at: z.string().datetime(),
          })
        )
        .default([]),
    })
  ),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const result = await SyncUseCase(
      {
        userId,
        notebooks: body.notebooks.map((nb) => ({
          id: nb.id,
          userId,
          name: nb.name,
          createdAt: new Date(nb.created_at),
          updatedAt: new Date(nb.updated_at),
        })),
        notes: body.notes.map((note) => ({
          id: note.id,
          notebookId: note.notebook_id,
          content: note.content,
          createdAt: new Date(note.created_at),
          updatedAt: new Date(note.updated_at),
        })),
      },
      {
        notebookRepo: new SupabaseNotebookRepository(),
        noteRepo: new SupabaseNoteRepository(),
        notePieceRepo: new SupabaseNotePieceRepository(),
        noteStorage: new MockNoteStorageRepository(),
      }
    )

    return c.json({
      notebooks: result.notebooks.map((nb) => ({
        id: nb.id,
        name: nb.name,
        created_at: nb.createdAt.toISOString(),
        updated_at: nb.updatedAt.toISOString(),
      })),
      notes: result.notes.map((note) => ({
        id: note.id,
        notebook_id: note.notebookId,
        created_at: note.createdAt.toISOString(),
        updated_at: note.updatedAt.toISOString(),
      })),
    })
  }
)

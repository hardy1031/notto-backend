import { Hono } from "hono"
import { SupabaseNotePieceRepository } from "../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../infrastructure/repositories/supabaseNotebookRepository.ts"
import { createNoteStorageRepository } from "../infrastructure/noteStorageFactory.ts"
import { authMiddleware } from "../middleware/auth.ts"
import { validate } from "../middleware/validate.ts"
import { syncNotebooksSchema } from "../schemas/sync.ts"
import type { AppVariables } from "../types/hono.ts"
import { SyncNotebooksUseCase } from "../usecases/SyncNotebooksUseCase.ts"
import { SyncNotesUseCase } from "../usecases/SyncNotesUseCase.ts"

export const syncNotebooksRouter = new Hono<{ Variables: AppVariables }>()

syncNotebooksRouter.use("*", authMiddleware)

syncNotebooksRouter.post(
  "/",
  validate("json", syncNotebooksSchema),
  async (c) => {
    const userId = c.get("userId")
    const body = c.req.valid("json")

    const notebookRepo = new SupabaseNotebookRepository()
    const noteRepo = new SupabaseNoteRepository()
    const notePieceRepo = new SupabaseNotePieceRepository()
    const noteStorage = createNoteStorageRepository()

    // sync notebooks first, then notes (notes depend on notebooks existing on server)
    const notebooksResult = await SyncNotebooksUseCase(
      {
        userId,
        notebooks: body.notebooks.map((nb) => ({
          id: nb.id,
          name: nb.name,
          createdAt: new Date(nb.created_at),
          updatedAt: new Date(nb.updated_at),
        })),
      },
      { notebookRepo }
    )

    const notesResult = await SyncNotesUseCase(
      {
        userId,
        notes: body.notes.map((note) => ({
          id: note.id,
          notebookId: note.notebook_id,
          name: note.name,
          content: note.content,
          createdAt: new Date(note.created_at),
          updatedAt: new Date(note.updated_at),
        })),
      },
      { notebookRepo, noteRepo, notePieceRepo, noteStorage }
    )

    return c.json({
      notebooks: notebooksResult.notebooks.map((nb) => ({
        id: nb.id,
        name: nb.name,
        created_at: nb.createdAt.toISOString(),
        updated_at: nb.updatedAt.toISOString(),
      })),
      notes: notesResult.notes.map((note) => ({
        id: note.id,
        notebook_id: note.notebookId,
        name: note.name,
        created_at: note.createdAt.toISOString(),
        updated_at: note.updatedAt.toISOString(),
      })),
    })
  }
)

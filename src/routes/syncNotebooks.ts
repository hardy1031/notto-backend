import { Hono } from "hono"
import { SupabaseNotePieceRepository } from "../infrastructure/db/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../infrastructure/db/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../infrastructure/db/supabaseNotebookRepository.ts"
import { S3NoteStorageService } from "../infrastructure/s3NoteStorageService.ts"
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
    const noteStorage = new S3NoteStorageService()

    // sync notebooks first, then notes (notes depend on notebooks existing on server)
    const notebooksResult = await SyncNotebooksUseCase(
      {
        userId,
        clientNotebooks: body.notebooks.map((notebook) => ({
          id: notebook.id,
          name: notebook.name,
          createdAt: new Date(notebook.created_at),
          updatedAt: new Date(notebook.updated_at),
        })),
      },
      { notebookRepo }
    )

    const notesResult = await SyncNotesUseCase(
      {
        userId,
        clientNotes: body.notes.map((note) => ({
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
      notebooks: notebooksResult.clientNotebooks.map((notebook) => ({
        id: notebook.id,
        name: notebook.name,
        created_at: notebook.createdAt.toISOString(),
        updated_at: notebook.updatedAt.toISOString(),
      })),
      notes: notesResult.clientNotes.map(({ note, content }) => ({
        id: note.id,
        notebook_id: note.notebookId,
        name: note.name,
        created_at: note.createdAt.toISOString(),
        updated_at: note.updatedAt.toISOString(),
        content,
      })),
    })
  }
)

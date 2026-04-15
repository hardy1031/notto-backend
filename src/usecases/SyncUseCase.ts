import { createNote } from "../domain/note/createNote.ts"
import { parseNote } from "../domain/note/parseNote.ts"
import { updateNote } from "../domain/note/updateNote.ts"
import { uploadNoteContent } from "../domain/note/uploadNoteContent.ts"
import { createNotebook } from "../domain/notebook/createNotebook.ts"
import { updateNotebook } from "../domain/notebook/updateNotebook.ts"
import type { NotePieceRepository } from "../repositories/notePieceRepository.ts"
import type { NoteRepository } from "../repositories/noteRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"
import type { NotebookRepository } from "../repositories/notebookRepository.ts"
import type { Note, Notebook } from "../repositories/types.ts"

export type SyncNotebookInput = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNoteInput = {
  id: string
  notebookId: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type SyncInput = {
  userId: string
  notebooks?: SyncNotebookInput[]
  notes?: SyncNoteInput[]
}

export type SyncOutput = {
  notebooks: Notebook[]
  notes: Note[]
  syncedNoteIds: string[]
}

export async function SyncUseCase(
  input: SyncInput,
  deps: {
    notebookRepo: NotebookRepository
    noteRepo: NoteRepository
    notePieceRepo: NotePieceRepository
    noteStorage: NoteStorageRepository
  }
): Promise<SyncOutput> {
  const { userId } = input

  // sync notebooks from client to server (LWW by updatedAt)
  const clientNotebookIds = (input.notebooks ?? []).map((notebook) => notebook.id)
  const existingNotebooks =
    clientNotebookIds.length > 0
      ? await deps.notebookRepo.findByUserIdAndIds(userId, clientNotebookIds)
      : []
  const existingNotebookMap = new Map(existingNotebooks.map((notebook) => [notebook.id, notebook]))

  for (const notebook of input.notebooks ?? []) {
    const existing = existingNotebookMap.get(notebook.id)
    if (!existing) {
      await createNotebook(
        { id: notebook.id, userId, name: notebook.name, createdAt: notebook.createdAt, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    } else if (notebook.updatedAt > existing.updatedAt) {
      await updateNotebook(
        { ...existing, name: notebook.name, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    }
  }

  // sync notes from client to server (LWW by updatedAt)
  const clientNoteIds = (input.notes ?? []).map((note) => note.id)
  const existingNotes =
    clientNoteIds.length > 0 ? await deps.noteRepo.findByUserIdAndIds(userId, clientNoteIds) : []
  const existingNoteMap = new Map(existingNotes.map((note) => [note.id, note]))

  const syncedNoteIds: string[] = []

  for (const note of input.notes ?? []) {
    const existing = existingNoteMap.get(note.id)
    const s3Key = `${userId}/${note.notebookId}/${note.id}.json`
    const parsed = parseNote(note.id, note.content)

    if (!existing) {
      await uploadNoteContent(s3Key, JSON.stringify(parsed), deps.noteStorage)
      await createNote(
        { id: note.id, notebookId: note.notebookId, s3Key, createdAt: note.createdAt, updatedAt: note.updatedAt },
        deps.noteRepo
      )
      const now = new Date()
      await deps.notePieceRepo.upsert(
        parsed.pieces.map((p) => ({ id: p.notePieceId, noteId: note.id, createdAt: now }))
      )
      syncedNoteIds.push(note.id)
    } else if (note.updatedAt > existing.updatedAt) {
      await uploadNoteContent(s3Key, JSON.stringify(parsed), deps.noteStorage)
      await updateNote({ ...existing, updatedAt: note.updatedAt }, deps.noteRepo)
      await deps.notePieceRepo.deleteByNoteId(note.id)
      const now = new Date()
      await deps.notePieceRepo.upsert(
        parsed.pieces.map((p) => ({ id: p.notePieceId, noteId: note.id, createdAt: now }))
      )
      syncedNoteIds.push(note.id)
    }
  }

  // return notebooks and notes the server has that the client does not
  const serverNotebooks = await deps.notebookRepo.findByUserId(userId)
  const clientNotebookIdSet = new Set(clientNotebookIds)
  const newNotebooks = serverNotebooks.filter((nb) => !clientNotebookIdSet.has(nb.id))

  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientNoteIdSet = new Set(clientNoteIds)
  const newNotes = serverNotes.filter((note) => !clientNoteIdSet.has(note.id))

  return { notebooks: newNotebooks, notes: newNotes, syncedNoteIds }
}

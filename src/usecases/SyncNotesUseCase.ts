import { NotFoundError } from "../errors/index.ts"
import { createNote } from "../domain/note/createNote.ts"
import { parseNote } from "../domain/note/parseNote.ts"
import { updateNote } from "../domain/note/updateNote.ts"
import { uploadNoteContent } from "../domain/note/uploadNoteContent.ts"
import type { NotePieceRepository } from "../repositories/notePieceRepository.ts"
import type { NoteRepository } from "../repositories/noteRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"
import type { NotebookRepository } from "../repositories/notebookRepository.ts"
import type { Note } from "../repositories/types.ts"

export type SyncNoteInput = {
  id: string
  notebookId: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNotesOutput = {
  notes: Note[]
  syncedNoteIds: string[]
}

export async function SyncNotesUseCase(
  input: {
    userId: string
    notes: SyncNoteInput[]
  },
  deps: {
    notebookRepo: NotebookRepository
    noteRepo: NoteRepository
    notePieceRepo: NotePieceRepository
    noteStorage: NoteStorageRepository
  }
): Promise<SyncNotesOutput> {
  const { userId, notes } = input

  // validate that all notebook_ids exist on the server
  const notebookIds = [...new Set(notes.map((note) => note.notebookId))]
  if (notebookIds.length > 0) {
    const existingNotebooks = await deps.notebookRepo.findByUserIdAndIds(userId, notebookIds)
    const existingNotebookIds = new Set(existingNotebooks.map((nb) => nb.id))
    for (const notebookId of notebookIds) {
      if (!existingNotebookIds.has(notebookId)) {
        throw new NotFoundError(`Notebook not found: ${notebookId}`)
      }
    }
  }

  // sync notes from client to server (LWW by updatedAt)
  const clientIds = notes.map((note) => note.id)
  const existingNotes =
    clientIds.length > 0 ? await deps.noteRepo.findByUserIdAndIds(userId, clientIds) : []
  const existingMap = new Map(existingNotes.map((note) => [note.id, note]))

  const syncedNoteIds: string[] = []

  for (const note of notes) {
    const existing = existingMap.get(note.id)
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

  // return notes the server has that the client does not
  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientIdSet = new Set(clientIds)
  return {
    notes: serverNotes.filter((note) => !clientIdSet.has(note.id)),
    syncedNoteIds,
  }
}

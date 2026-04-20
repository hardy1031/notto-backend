import { NotFoundError } from "../errors/index.ts"
import { parseNote } from "../domain/note/parseNote.ts"
import type { NoteRepository } from "../domain/note/NoteRepository.ts"
import type { NoteQueryService } from "./queries/NoteQueryService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import type { NotebookQueryService } from "./queries/NotebookQueryService.ts"
import type { Note, ParsedNote } from "../domain/types.ts"

export type SyncNoteInput = {
  id: string
  notebookId: string
  name: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNotesOutput = {
  clientNotes: { note: Note; content: ParsedNote }[]
  syncedNoteIds: string[]
}

export async function SyncNotesUseCase(
  input: {
    userId: string
    clientNotes: SyncNoteInput[]
  },
  deps: {
    notebookRepo: NotebookQueryService
    noteRepo: NoteRepository & NoteQueryService
    notePieceRepo: NotePieceQueryService
    noteStorage: NoteStorageService
  }
): Promise<SyncNotesOutput> {
  const { userId, clientNotes: inputNotes } = input

  // validate that all notebookIds exist on the server
  const notebookIds = [...new Set(inputNotes.map((note) => note.notebookId))]
  if (notebookIds.length > 0) {
    const serverNotebooks = await deps.notebookRepo.findByUserIdAndIds(userId, notebookIds)
    const serverNotebookIds = new Set(serverNotebooks.map((notebook) => notebook.id))
    for (const notebookId of notebookIds) {
      if (!serverNotebookIds.has(notebookId)) {
        throw new NotFoundError(`Notebook not found: ${notebookId}`)
      }
    }
  }

  // sync notes from client to server (LWW by updatedAt)
  const inputNoteIds = inputNotes.map((note) => note.id)
  const serverNotesById = new Map<string, Note>()
  if (inputNoteIds.length > 0) {
    const serverNotes = await deps.noteRepo.findByUserIdAndIds(userId, inputNoteIds)
    for (const note of serverNotes) {
      serverNotesById.set(note.id, note)
    }
  }

  const syncedNoteIds: string[] = []

  for (const note of inputNotes) {
    const serverNote = serverNotesById.get(note.id)
    const s3Key = `${userId}/${note.notebookId}/${note.id}.json`
    const parsed = parseNote(note.id, note.content)
    const now = new Date()
    const pieces = parsed.pieces.map((p) => ({ id: p.notePieceId, noteId: note.id, createdAt: now }))

    if (!serverNote) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(parsed))
      await deps.noteRepo.createWithNotePieces(
        { id: note.id, notebookId: note.notebookId, name: note.name, s3Key, createdAt: note.createdAt, updatedAt: note.updatedAt },
        pieces
      )
      syncedNoteIds.push(note.id)
    } else if (note.updatedAt > serverNote.updatedAt) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(parsed))
      await deps.noteRepo.updateWithNotePieces(
        { ...serverNote, name: note.name, updatedAt: note.updatedAt },
        pieces
      )
      syncedNoteIds.push(note.id)
    }
  }

  // return notes the server has that the client does not (including content from storage)
  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientNoteIdSet = new Set(inputNoteIds)
  const notesToSend = serverNotes.filter((note) => !clientNoteIdSet.has(note.id))
  const clientNotes = await Promise.all(
    notesToSend.map(async (note) => {
      const json = await deps.noteStorage.fetch(note.s3Key)
      return { note, content: JSON.parse(json) as ParsedNote }
    })
  )
  return { clientNotes, syncedNoteIds }
}

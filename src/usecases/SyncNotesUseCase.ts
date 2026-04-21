import { NotFoundError } from "../errors/index.ts"
import type { NoteRepository } from "../domain/note/NoteRepository.ts"
import type { NoteQueryService } from "./queries/NoteQueryService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import type { NotebookQueryService } from "./queries/NotebookQueryService.ts"
import type { Note, NotePieceContent } from "../domain/types.ts"

export type SyncNoteInput = {
  id: string
  notebookId: string
  name: string
  content: NotePieceContent[]
  createdAt: Date
  updatedAt: Date
}

export type SyncNotesOutput = {
  clientNotes: { note: Note; content: NotePieceContent[] }[]
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
  const { userId, clientNotes } = input

  // validate that all clientNotebookIds exist on the server
  const clientNotebookIds = [...new Set(clientNotes.map((note) => note.notebookId))]
  if (clientNotebookIds.length > 0) {
    const serverNotebooks = await deps.notebookRepo.findByUserIdAndIds(userId, clientNotebookIds)
    const serverNotebookIds = new Set(serverNotebooks.map((notebook) => notebook.id))
    for (const clientNotebookId of clientNotebookIds) {
      if (!serverNotebookIds.has(clientNotebookId)) {
        throw new NotFoundError(`Notebook not found: ${clientNotebookId}`)
      }
    }
  }

  // sync notes from client to server (LWW by updatedAt)
  const clientNoteIds = clientNotes.map((note) => note.id)
  const serverNotesById = new Map<string, Note>()
  if (clientNoteIds.length > 0) {
    const serverNotes = await deps.noteRepo.findByUserIdAndIds(userId, clientNoteIds)
    for (const serverNote of serverNotes) {
      serverNotesById.set(serverNote.id, serverNote)
    }
  }

  const syncedNoteIds: string[] = []
  const now = new Date()

  for (const clientNote of clientNotes) {
    const serverNote = serverNotesById.get(clientNote.id)
    const s3Key = `${userId}/${clientNote.notebookId}/${clientNote.id}.json`
    const pieces = clientNote.content.map((p) => ({ id: p.notePieceId, noteId: clientNote.id, createdAt: now }))

    if (!serverNote) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(clientNote.content))
      await deps.noteRepo.createWithNotePieces(
        { id: clientNote.id, notebookId: clientNote.notebookId, name: clientNote.name, s3Key, createdAt: clientNote.createdAt, updatedAt: clientNote.updatedAt, syncedAt: new Date() },
        pieces
      )
      syncedNoteIds.push(clientNote.id)
    } else if (clientNote.updatedAt > serverNote.updatedAt) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(clientNote.content))
      await deps.noteRepo.updateWithNotePieces(
        { ...serverNote, name: clientNote.name, updatedAt: clientNote.updatedAt, syncedAt: new Date() },
        pieces
      )
      syncedNoteIds.push(clientNote.id)
    }
  }

  // return notes the server has that the client does not (including content from storage)
  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientNoteIdSet = new Set(clientNoteIds) // Set for O(1) lookup in filter below
  const missingNotes = serverNotes.filter((note) => !clientNoteIdSet.has(note.id))
  const missingNoteIds = missingNotes.map((note) => note.id)

  const allSyncedNoteIds = [...clientNoteIds, ...missingNoteIds]
  if (allSyncedNoteIds.length > 0) {
    await deps.noteRepo.updateSyncedAt(allSyncedNoteIds, new Date())
  }
  const missingNotesWithContent = await Promise.all(
    missingNotes.map(async (note) => {
      const json = await deps.noteStorage.fetch(note.s3Key)
      return { note, content: JSON.parse(json) as NotePieceContent[] }
    })
  )
  return { clientNotes: missingNotesWithContent, syncedNoteIds }
}

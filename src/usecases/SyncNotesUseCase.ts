import { NoteEntity } from "../domain/note/NoteEntity.ts"
import type { NoteRepository } from "../domain/note/NoteRepository.ts"
import { NotePieceEntity } from "../domain/note/notePiece/NotePieceEntity.ts"
import type { NotePieceContent } from "../domain/types.ts"
import { NotFoundError } from "../errors/index.ts"
import { parsedNoteSchema } from "../schemas/sync.ts"
import type { NoteStorageService } from "./NoteStorageService.ts"
import type { NotePieceQueryService } from "./queries/NotePieceQueryService.ts"
import type { NoteQueryService } from "./queries/NoteQueryService.ts"
import type { NotebookQueryService } from "./queries/NotebookQueryService.ts"

export type SyncNoteInput = {
  id: string
  notebookId: string
  name: string
  content: NotePieceContent[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type SyncNotesOutput = {
  clientNotes: { note: NoteEntity; content: NotePieceContent[] }[]
  syncedNoteIds: string[]
}

export async function SyncNotesUseCase(
  input: {
    userId: string
    clientNotes: SyncNoteInput[]
  },
  deps: {
    notebookQueryService: NotebookQueryService
    noteRepo: NoteRepository
    noteQueryService: NoteQueryService
    notePieceQueryService: NotePieceQueryService
    noteStorage: NoteStorageService
  }
): Promise<SyncNotesOutput> {
  const { userId, clientNotes } = input

  // validate that all notebooks referenced by non-deleted notes exist on the server
  const activeClientNotes = clientNotes.filter((note) => !note.deletedAt)
  const clientNotebookIds = [...new Set(activeClientNotes.map((note) => note.notebookId))]
  if (clientNotebookIds.length > 0) {
    const serverNotebooks = await deps.notebookQueryService.findByUserIdAndIds(
      userId,
      clientNotebookIds
    )
    const serverNotebookIds = new Set(serverNotebooks.map((notebook) => notebook.id))
    for (const clientNotebookId of clientNotebookIds) {
      if (!serverNotebookIds.has(clientNotebookId)) {
        throw new NotFoundError(`Notebook not found: ${clientNotebookId}`)
      }
    }
  }

  const clientNoteIds = clientNotes.map((note) => note.id)
  // fetch all (including deleted) for "deleted wins" check
  const serverNotesById = new Map<string, NoteEntity>()
  if (clientNoteIds.length > 0) {
    const serverNotes = await deps.noteQueryService.findAllForSync(userId)
    for (const serverNote of serverNotes) {
      serverNotesById.set(serverNote.id, serverNote)
    }
  }

  const syncedNoteIds: string[] = []
  const now = new Date()

  for (const clientNote of clientNotes) {
    const serverNote = serverNotesById.get(clientNote.id)

    if (clientNote.deletedAt) {
      // client deleted this note
      if (serverNote && !serverNote.isDeleted) {
        await deps.noteRepo.softDelete(clientNote.id, clientNote.deletedAt)
      }
      // if server is already deleted or doesn't exist: no-op
      continue
    }

    const s3Key = NoteEntity.buildS3Key(userId, clientNote.notebookId, clientNote.id)
    const pieces = clientNote.content.map((notePieceContent) =>
      NotePieceEntity.create({ id: notePieceContent.notePieceId, noteId: clientNote.id, createdAt: now })
    )

    if (!serverNote) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(clientNote.content))
      await deps.noteRepo.createWithNotePieces(
        NoteEntity.create({
          id: clientNote.id,
          notebookId: clientNote.notebookId,
          name: clientNote.name,
          s3Key,
          createdAt: clientNote.createdAt,
          updatedAt: clientNote.updatedAt,
          syncedAt: now,
          deletedAt: null,
        }),
        pieces
      )
      syncedNoteIds.push(clientNote.id)
    } else if (serverNote.isDeleted) {
      // "deleted wins": ignore client update
    } else if (clientNote.updatedAt > serverNote.updatedAt) {
      await deps.noteStorage.upload(s3Key, JSON.stringify(clientNote.content))
      await deps.noteRepo.updateWithNotePieces(
        serverNote.withUpdates(clientNote.name, clientNote.updatedAt, now),
        pieces
      )
      syncedNoteIds.push(clientNote.id)
    }
  }

  const nonDeletedClientNoteIds = clientNotes.filter((note) => !note.deletedAt).map((note) => note.id)
  const allSyncedNoteIds = [...nonDeletedClientNoteIds]
  if (allSyncedNoteIds.length > 0) {
    await deps.noteRepo.updateSyncedAt(allSyncedNoteIds, now)
  }

  // return notes for sync:
  // - new for client: server has it (non-deleted), client doesn't have it
  // - tombstones: client has it, server has deleted_at set
  const allServerNotes = await deps.noteQueryService.findAllForSync(userId)
  const clientNoteIdSet = new Set(clientNoteIds)

  const notesForClient = allServerNotes.filter(
    (note) =>
      (!clientNoteIdSet.has(note.id) && !note.isDeleted) || // new for client
      (clientNoteIdSet.has(note.id) && note.isDeleted) // tombstone
  )

  // fetch content only for non-deleted notes
  const missingNotesWithContent = await Promise.all(
    notesForClient
      .filter((note) => !note.isDeleted)
      .map(async (note) => {
        const json = await deps.noteStorage.fetch(note.s3Key)
        return { note, content: parsedNoteSchema.parse(JSON.parse(json)) }
      })
  )

  // include tombstones (no content needed — client just needs to know they're deleted)
  const tombstones = notesForClient
    .filter((note) => note.isDeleted)
    .map((note) => ({ note, content: [] as NotePieceContent[] }))

  return {
    clientNotes: [...missingNotesWithContent, ...tombstones],
    syncedNoteIds,
  }
}

import { createNote } from "../domain/note/createNote.ts"
import { updateNote } from "../domain/note/updateNote.ts"
import { uploadNoteContent } from "../domain/note/uploadNoteContent.ts"
import { createNotebook } from "../domain/notebook/createNotebook.ts"
import { updateNotebook } from "../domain/notebook/updateNotebook.ts"
import type { ContextObjectRepository } from "../repositories/contextObjectRepository.ts"
import type { NotePieceRepository } from "../repositories/notePieceRepository.ts"
import type { NoteRepository } from "../repositories/noteRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"
import type { NotebookRepository } from "../repositories/notebookRepository.ts"
import type { QuizRepository } from "../repositories/quizRepository.ts"
import type { QuizRunRepository } from "../repositories/quizRunRepository.ts"
import type {
  ContextObject,
  Note,
  NotePiece,
  Notebook,
  Quiz,
  QuizRecord,
  QuizRun,
  QuizRunWithRecords,
} from "../repositories/types.ts"

export type SyncNoteInput = {
  id: string
  notebookId: string
  s3Key: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNotebookInput = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type SyncQuizRunInput = {
  id: string
  userId: string
  startedAt: Date
  completedAt: Date | null
  records: {
    id: string
    quizId: string
    userAnswer: string
    isCorrect: boolean
    createdAt: Date
  }[]
}

export type SyncInput = {
  userId: string
  notebooks: SyncNotebookInput[]
  notes: SyncNoteInput[]
  quizRuns?: SyncQuizRunInput[]
}

export type SyncOutput = {
  notebooks: Notebook[]
  notes: Note[]
  contextObjects: ContextObject[]
  quizzes: Quiz[]
  quizRuns: QuizRun[]
  quizRecords: QuizRecord[]
  syncedNoteIds: string[]
}

export async function SyncUseCase(
  input: SyncInput,
  deps: {
    notebookRepo: NotebookRepository
    noteRepo: NoteRepository
    notePieceRepo: NotePieceRepository
    noteStorage: NoteStorageRepository
    contextObjectRepo: ContextObjectRepository
    quizRepo: QuizRepository
    quizRunRepo: QuizRunRepository
  }
): Promise<SyncOutput> {
  const { userId } = input

  // sync notebooks from client to server (LWW by updatedAt)
  const clientNotebookIds = input.notebooks.map((notebook) => notebook.id)
  const existingNotebooks =
    clientNotebookIds.length > 0
      ? await deps.notebookRepo.findByUserIdAndIds(userId, clientNotebookIds)
      : []
  const existingNotebookMap = new Map(existingNotebooks.map((notebook) => [notebook.id, notebook]))

  for (const notebook of input.notebooks) {
    const existing = existingNotebookMap.get(notebook.id)
    if (!existing) {
      // create notebook if not exists on server
      await createNotebook(
        { id: notebook.id, userId, name: notebook.name, createdAt: notebook.createdAt, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    } else if (notebook.updatedAt > existing.updatedAt) {
      // update notebook if client version is newer
      await updateNotebook(
        { ...existing, name: notebook.name, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    }
  }

  // sync notes from client to server (LWW by updatedAt)
  const clientNoteIds = input.notes.map((note) => note.id)
  const existingNotes =
    clientNoteIds.length > 0 ? await deps.noteRepo.findByUserIdAndIds(userId, clientNoteIds) : []
  const existingNoteMap = new Map(existingNotes.map((note) => [note.id, note]))

  const syncedNoteIds: string[] = []

  for (const note of input.notes) {
    const existing = existingNoteMap.get(note.id)
    const s3Key = note.s3Key || `${userId}/${note.notebookId}/${note.id}.md`

    if (!existing) {
      // create note and its initial note piece if not exists on server
      await uploadNoteContent(s3Key, note.content, deps.noteStorage)
      await createNote(
        {
          id: note.id,
          notebookId: note.notebookId,
          s3Key,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
        deps.noteRepo
      )
      const pieceId = crypto.randomUUID()
      await deps.notePieceRepo.upsert([
        { id: pieceId, noteId: note.id, order: 1, createdAt: new Date() },
      ])
      syncedNoteIds.push(note.id)
    } else if (note.updatedAt > existing.updatedAt) {
      // update note content and replace note pieces if client version is newer
      await uploadNoteContent(s3Key, note.content, deps.noteStorage)
      await updateNote({ ...existing, updatedAt: note.updatedAt }, deps.noteRepo)
      await deps.notePieceRepo.deleteByNoteId(note.id)
      const pieceId = crypto.randomUUID()
      await deps.notePieceRepo.upsert([
        { id: pieceId, noteId: note.id, order: 1, createdAt: new Date() },
      ])
      syncedNoteIds.push(note.id)
    }
  }

  // sync quiz runs from client to server (insert only, no update)
  if (input.quizRuns) {
    const clientQuizRunIds = input.quizRuns.map((quizRun) => quizRun.id)
    const existingQuizRuns =
      clientQuizRunIds.length > 0
        ? await deps.quizRunRepo.findByUserIdAndIds(userId, clientQuizRunIds)
        : []
    const existingQuizRunIds = new Set(existingQuizRuns.map((quizRun) => quizRun.quizRun.id))

    for (const quizRun of input.quizRuns) {
      if (existingQuizRunIds.has(quizRun.id)) continue
      // save quiz run with its records if not exists on server
      const quizRunEntity: QuizRun = {
        id: quizRun.id,
        userId,
        startedAt: quizRun.startedAt,
        completedAt: quizRun.completedAt,
      }
      const quizRecords: QuizRecord[] = quizRun.records.map((record) => ({
        id: record.id,
        quizRunId: quizRun.id,
        quizId: record.quizId,
        userAnswer: record.userAnswer,
        isCorrect: record.isCorrect,
        createdAt: record.createdAt,
      }))
      await deps.quizRunRepo.save(quizRunEntity, quizRecords)
    }
  }

  // fetch server-side data that the client does not have yet
  const serverNotebooks = await deps.notebookRepo.findByUserId(userId)
  const clientNotebookIdSet = new Set(input.notebooks.map((notebook) => notebook.id))
  const newNotebooks = serverNotebooks.filter((notebook) => !clientNotebookIdSet.has(notebook.id))

  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientNoteIdSet = new Set(input.notes.map((note) => note.id))
  const newNotes = serverNotes.filter((note) => !clientNoteIdSet.has(note.id))

  const allServerNoteIds = serverNotes.map((note) => note.id)
  const contextObjects =
    allServerNoteIds.length > 0 ? await deps.contextObjectRepo.findByNoteIds(allServerNoteIds) : []
  const contextObjectIds = contextObjects.map((contextObject) => contextObject.id)
  const quizzes =
    contextObjectIds.length > 0 ? await deps.quizRepo.findByContextObjectIds(contextObjectIds) : []

  const serverQuizRuns = await deps.quizRunRepo.findByUserId(userId)
  const clientQuizRunIdSet = new Set((input.quizRuns ?? []).map((quizRun) => quizRun.id))
  const newQuizRunsWithRecords = serverQuizRuns.filter((quizRun) => !clientQuizRunIdSet.has(quizRun.quizRun.id))

  return {
    notebooks: newNotebooks,
    notes: newNotes,
    contextObjects,
    quizzes,
    quizRuns: newQuizRunsWithRecords.map((quizRunWithRecords) => quizRunWithRecords.quizRun),
    quizRecords: newQuizRunsWithRecords.flatMap((quizRunWithRecords) => quizRunWithRecords.quizRecords),
    syncedNoteIds,
  }
}

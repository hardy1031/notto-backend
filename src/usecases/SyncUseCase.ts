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

  const clientNotebookIds = input.notebooks.map((n) => n.id)
  const existingNotebooks =
    clientNotebookIds.length > 0
      ? await deps.notebookRepo.findByUserIdAndIds(userId, clientNotebookIds)
      : []
  const existingNotebookMap = new Map(existingNotebooks.map((n) => [n.id, n]))

  for (const nb of input.notebooks) {
    const existing = existingNotebookMap.get(nb.id)
    if (!existing) {
      await createNotebook(
        { id: nb.id, userId, name: nb.name, createdAt: nb.createdAt, updatedAt: nb.updatedAt },
        deps.notebookRepo
      )
    } else if (nb.updatedAt > existing.updatedAt) {
      await updateNotebook(
        { ...existing, name: nb.name, updatedAt: nb.updatedAt },
        deps.notebookRepo
      )
    }
  }

  const clientNoteIds = input.notes.map((n) => n.id)
  const existingNotes =
    clientNoteIds.length > 0 ? await deps.noteRepo.findByUserIdAndIds(userId, clientNoteIds) : []
  const existingNoteMap = new Map(existingNotes.map((n) => [n.id, n]))

  const syncedNoteIds: string[] = []

  for (const note of input.notes) {
    const existing = existingNoteMap.get(note.id)
    const s3Key = note.s3Key || `${userId}/${note.notebookId}/${note.id}.md`

    if (!existing) {
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

  if (input.quizRuns) {
    const clientQuizRunIds = input.quizRuns.map((r) => r.id)
    const existingQuizRuns =
      clientQuizRunIds.length > 0
        ? await deps.quizRunRepo.findByUserIdAndIds(userId, clientQuizRunIds)
        : []
    const existingQuizRunIds = new Set(existingQuizRuns.map((r) => r.quizRun.id))

    for (const qr of input.quizRuns) {
      if (existingQuizRunIds.has(qr.id)) continue
      const quizRun: QuizRun = {
        id: qr.id,
        userId,
        startedAt: qr.startedAt,
        completedAt: qr.completedAt,
      }
      const quizRecords: QuizRecord[] = qr.records.map((r) => ({
        id: r.id,
        quizRunId: qr.id,
        quizId: r.quizId,
        userAnswer: r.userAnswer,
        isCorrect: r.isCorrect,
        createdAt: r.createdAt,
      }))
      await deps.quizRunRepo.save(quizRun, quizRecords)
    }
  }

  const serverNotebooks = await deps.notebookRepo.findByUserId(userId)
  const clientNotebookIdSet = new Set(input.notebooks.map((n) => n.id))
  const newNotebooks = serverNotebooks.filter((n) => !clientNotebookIdSet.has(n.id))

  const serverNotes = await deps.noteRepo.findByUserId(userId)
  const clientNoteIdSet = new Set(input.notes.map((n) => n.id))
  const newNotes = serverNotes.filter((n) => !clientNoteIdSet.has(n.id))

  const allServerNoteIds = serverNotes.map((n) => n.id)
  const contextObjects =
    allServerNoteIds.length > 0 ? await deps.contextObjectRepo.findByNoteIds(allServerNoteIds) : []
  const contextObjectIds = contextObjects.map((co) => co.id)
  const quizzes =
    contextObjectIds.length > 0 ? await deps.quizRepo.findByContextObjectIds(contextObjectIds) : []

  const serverQuizRuns = await deps.quizRunRepo.findByUserId(userId)
  const clientQuizRunIdSet = new Set((input.quizRuns ?? []).map((r) => r.id))
  const newQuizRunsWithRecords = serverQuizRuns.filter((r) => !clientQuizRunIdSet.has(r.quizRun.id))

  return {
    notebooks: newNotebooks,
    notes: newNotes,
    contextObjects,
    quizzes,
    quizRuns: newQuizRunsWithRecords.map((r) => r.quizRun),
    quizRecords: newQuizRunsWithRecords.flatMap((r) => r.quizRecords),
    syncedNoteIds,
  }
}

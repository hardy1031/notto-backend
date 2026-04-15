import { findUninterpretedPieces } from "../domain/contextObject/findUninterpretedPieces.ts"
import { generateContextObject } from "../domain/contextObject/generateContextObject.ts"
import { generateQuizzes } from "../domain/quiz/generateQuizzes.ts"
import type { AIRepository } from "../repositories/aiRepository.ts"
import type { ContextObjectRepository } from "../repositories/contextObjectRepository.ts"
import type { NotePieceRepository } from "../repositories/notePieceRepository.ts"
import type { NoteRepository } from "../repositories/noteRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"
import type { QuizRepository } from "../repositories/quizRepository.ts"
import type { ContextObject, ParsedNote, Quiz } from "../repositories/types.ts"

export type GenerateQuizzesInput = {
  userId: string
  clientContextObjectIds: string[]
  clientQuizIds: string[]
}

export type GenerateQuizzesOutput = {
  contextObjects: ContextObject[]
  quizzes: Quiz[]
}

export async function GenerateQuizzesUseCase(
  input: GenerateQuizzesInput,
  deps: {
    noteRepo: NoteRepository
    noteStorage: NoteStorageRepository
    notePieceRepo: NotePieceRepository
    contextObjectRepo: ContextObjectRepository
    quizRepo: QuizRepository
    aiRepo: AIRepository
  }
): Promise<GenerateQuizzesOutput> {
  const { userId, clientContextObjectIds, clientQuizIds } = input

  // get all note IDs for the user
  const allNotes = await deps.noteRepo.findByUserId(userId)
  const allNoteIds = allNotes.map((note) => note.id)

  if (allNoteIds.length === 0) return { contextObjects: [], quizzes: [] }

  // find note pieces that have not been interpreted into context objects yet
  const notePieces = await deps.notePieceRepo.findByNoteIds(allNoteIds)
  const existingContextObjects = await deps.contextObjectRepo.findByUserId(userId)
  const uninterpretedPieces = findUninterpretedPieces(notePieces, existingContextObjects)

  // build a map of parsed notes fetched from storage (lazy, cached per note)
  const parsedNoteCache = new Map<string, ParsedNote>()
  const getParsedNote = async (noteId: string): Promise<ParsedNote> => {
    if (parsedNoteCache.has(noteId)) return parsedNoteCache.get(noteId)!
    const note = allNotes.find((n) => n.id === noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)
    const json = await deps.noteStorage.fetch(note.s3Key)
    const parsed = JSON.parse(json) as ParsedNote
    parsedNoteCache.set(noteId, parsed)
    return parsed
  }

  // generate one context object per uninterpreted piece via AI
  const newContextObjects: ContextObject[] = []

  for (const piece of uninterpretedPieces) {
    const parsedNote = await getParsedNote(piece.noteId)
    const pieceContent = parsedNote.pieces.find((p) => p.notePieceId === piece.id)
    if (!pieceContent) continue
    const generated = await generateContextObject(pieceContent.expression, pieceContent.annotation, deps.aiRepo)
    const now = new Date()
    newContextObjects.push({
      id: crypto.randomUUID(),
      notePieceId: piece.id,
      noteId: piece.noteId,
      expression: generated.expression,
      baseMeaning: generated.baseMeaning,
      actualNuance: generated.actualNuance,
      tone: generated.tone,
      formality: generated.formality,
      isSlang: generated.isSlang,
      exampleDialogue: generated.exampleDialogue,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (newContextObjects.length > 0) {
    await deps.contextObjectRepo.bulkCreate(newContextObjects)
  }

  // generate quizzes for context objects that don't have quizzes yet
  const contextObjectsWithoutQuizzes = await deps.contextObjectRepo.findWithoutQuizzes(allNoteIds)
  const generatedQuizItems = await generateQuizzes(contextObjectsWithoutQuizzes, deps.aiRepo)

  const now = new Date()
  const newQuizzes: Quiz[] = generatedQuizItems.map((generatedQuizItem) => {
    const contextObject = contextObjectsWithoutQuizzes[generatedQuizItem.contextObjectIndex]
    if (!contextObject) throw new Error(`Invalid context_object_index: ${generatedQuizItem.contextObjectIndex}`)
    return {
      id: crypto.randomUUID(),
      contextObjectId: contextObject.id,
      type: generatedQuizItem.type,
      questionSentence: generatedQuizItem.questionSentence,
      answer: generatedQuizItem.answer,
      choicePool: generatedQuizItem.choicePool,
      createdAt: now,
      updatedAt: now,
    }
  })

  if (newQuizzes.length > 0) {
    await deps.quizRepo.bulkCreate(newQuizzes)
  }

  // return context objects and quizzes the server has that the client does not
  const clientContextObjectIdSet = new Set(clientContextObjectIds)
  const clientQuizIdSet = new Set(clientQuizIds)

  const allContextObjects = await deps.contextObjectRepo.findByUserId(userId)
  const allContextObjectIds = allContextObjects.map((co) => co.id)
  const allQuizzes =
    allContextObjectIds.length > 0
      ? await deps.quizRepo.findByContextObjectIds(allContextObjectIds)
      : []

  return {
    contextObjects: allContextObjects.filter((co) => !clientContextObjectIdSet.has(co.id)),
    quizzes: allQuizzes.filter((q) => !clientQuizIdSet.has(q.id)),
  }
}

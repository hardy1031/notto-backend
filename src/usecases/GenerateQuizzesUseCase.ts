import { findUninterpretedPieces } from "../domain/contextObject/findUninterpretedPieces.ts"
import { generateContextObjects } from "../domain/contextObject/generateContextObjects.ts"
import { generateQuizzes } from "../domain/quiz/generateQuizzes.ts"
import type { AIRepository } from "../repositories/aiRepository.ts"
import type { ContextObjectRepository } from "../repositories/contextObjectRepository.ts"
import type { NotePieceRepository } from "../repositories/notePieceRepository.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"
import type { QuizRepository } from "../repositories/quizRepository.ts"
import type { ContextObject, Quiz } from "../repositories/types.ts"

export type GenerateQuizzesOutput = {
  generated: {
    contextObject: ContextObject
    quizzes: Quiz[]
  }[]
}

export async function GenerateQuizzesUseCase(
  noteIds: string[],
  deps: {
    notePieceRepo: NotePieceRepository
    contextObjectRepo: ContextObjectRepository
    quizRepo: QuizRepository
    noteStorage: NoteStorageRepository
    aiRepo: AIRepository
    getNoteContent: (noteId: string) => Promise<string>
  }
): Promise<GenerateQuizzesOutput> {
  if (noteIds.length === 0) return { generated: [] }

  // find note pieces that have not been interpreted into context objects yet
  const notePieces = await deps.notePieceRepo.findByNoteIds(noteIds)
  const existingContextObjects = await deps.contextObjectRepo.findByNoteIds(noteIds)
  const uninterpretedPieces = findUninterpretedPieces(notePieces, existingContextObjects)

  // generate context objects for each uninterpreted piece via AI
  const newContextObjects: ContextObject[] = []

  for (const piece of uninterpretedPieces) {
    const content = await deps.getNoteContent(piece.noteId)
    const generatedContextObjects = await generateContextObjects(content, deps.aiRepo)
    const now = new Date()
    const contextObjects: ContextObject[] = generatedContextObjects.map((generatedContextObject) => ({
      id: crypto.randomUUID(),
      notePieceId: piece.id,
      noteId: piece.noteId,
      expression: generatedContextObject.expression,
      baseMeaning: generatedContextObject.baseMeaning,
      actualNuance: generatedContextObject.actualNuance,
      tone: generatedContextObject.tone,
      formality: generatedContextObject.formality,
      isSlang: generatedContextObject.isSlang,
      exampleDialogue: generatedContextObject.exampleDialogue,
      createdAt: now,
      updatedAt: now,
    }))
    newContextObjects.push(...contextObjects)
  }

  if (newContextObjects.length > 0) {
    await deps.contextObjectRepo.bulkCreate(newContextObjects)
  }

  // generate quizzes for context objects that don't have quizzes yet
  const contextObjectsWithoutQuizzes = await deps.contextObjectRepo.findWithoutQuizzes(noteIds)

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

  // group quizzes by context object id for the response
  const quizzesByContextObjectId = new Map<string, Quiz[]>()
  for (const quiz of newQuizzes) {
    const existing = quizzesByContextObjectId.get(quiz.contextObjectId) ?? []
    existing.push(quiz)
    quizzesByContextObjectId.set(quiz.contextObjectId, existing)
  }

  return {
    generated: newContextObjects.map((contextObject) => ({
      contextObject,
      quizzes: quizzesByContextObjectId.get(contextObject.id) ?? [],
    })),
  }
}

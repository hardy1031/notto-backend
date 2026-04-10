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

  const notePieces = await deps.notePieceRepo.findByNoteIds(noteIds)
  const existingContextObjects = await deps.contextObjectRepo.findByNoteIds(noteIds)
  const uninterpretedPieces = findUninterpretedPieces(notePieces, existingContextObjects)

  const newContextObjects: ContextObject[] = []

  for (const piece of uninterpretedPieces) {
    const content = await deps.getNoteContent(piece.noteId)
    const generated = await generateContextObjects(content, deps.aiRepo)
    const now = new Date()
    const contextObjs: ContextObject[] = generated.map((g) => ({
      id: crypto.randomUUID(),
      notePieceId: piece.id,
      noteId: piece.noteId,
      expression: g.expression,
      baseMeaning: g.baseMeaning,
      actualNuance: g.actualNuance,
      tone: g.tone,
      formality: g.formality,
      isSlang: g.isSlang,
      exampleDialogue: g.exampleDialogue,
      createdAt: now,
      updatedAt: now,
    }))
    newContextObjects.push(...contextObjs)
  }

  if (newContextObjects.length > 0) {
    await deps.contextObjectRepo.bulkCreate(newContextObjects)
  }

  const contextObjectsWithoutQuizzes = await deps.contextObjectRepo.findWithoutQuizzes(noteIds)

  const generatedQuizItems = await generateQuizzes(contextObjectsWithoutQuizzes, deps.aiRepo)

  const now = new Date()
  const newQuizzes: Quiz[] = generatedQuizItems.map((q) => {
    const co = contextObjectsWithoutQuizzes[q.contextObjectIndex]
    if (!co) throw new Error(`Invalid context_object_index: ${q.contextObjectIndex}`)
    return {
      id: crypto.randomUUID(),
      contextObjectId: co.id,
      type: q.type,
      questionSentence: q.questionSentence,
      answer: q.answer,
      createdAt: now,
      updatedAt: now,
    }
  })

  if (newQuizzes.length > 0) {
    await deps.quizRepo.bulkCreate(newQuizzes)
  }

  const quizzesByContextObjectId = new Map<string, Quiz[]>()
  for (const quiz of newQuizzes) {
    const existing = quizzesByContextObjectId.get(quiz.contextObjectId) ?? []
    existing.push(quiz)
    quizzesByContextObjectId.set(quiz.contextObjectId, existing)
  }

  return {
    generated: newContextObjects.map((co) => ({
      contextObject: co,
      quizzes: quizzesByContextObjectId.get(co.id) ?? [],
    })),
  }
}

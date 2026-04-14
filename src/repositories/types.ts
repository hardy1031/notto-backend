export type QuizType = "choose_context" | "choose_pronunciation" | "fill_metadata"

export type Notebook = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type Note = {
  id: string
  notebookId: string
  s3Key: string
  createdAt: Date
  updatedAt: Date
}

export type NotePiece = {
  id: string
  noteId: string
  order: number
  createdAt: Date
}

export type ContextObject = {
  id: string
  notePieceId: string
  noteId: string
  expression: string
  baseMeaning: string
  actualNuance: string
  tone: string
  formality: "casual" | "neutral" | "formal"
  isSlang: boolean
  exampleDialogue: { speaker: string; text: string }[]
  createdAt: Date
  updatedAt: Date
}

export type Quiz = {
  id: string
  contextObjectId: string
  type: QuizType
  questionSentence: string
  answer: string
  choices: string[]
  createdAt: Date
  updatedAt: Date
}

export type QuizRun = {
  id: string
  userId: string
  startedAt: Date
  completedAt: Date | null
}

export type QuizRecord = {
  id: string
  quizRunId: string
  quizId: string
  userAnswer: string
  isCorrect: boolean
  createdAt: Date
}

export type QuizRunWithRecords = {
  quizRun: QuizRun
  quizRecords: QuizRecord[]
}

export type GeneratedContextObject = {
  expression: string
  baseMeaning: string
  actualNuance: string
  tone: string
  formality: "casual" | "neutral" | "formal"
  isSlang: boolean
  exampleDialogue: { speaker: string; text: string }[]
}

export type GeneratedQuiz = {
  contextObjectIndex: number
  type: QuizType
  questionSentence: string
  answer: string
  choices: string[]
}

export type AILearnResponse = {
  explanation: string
  examples: string[]
  relatedExpressions: string[]
}

export type User = {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}

export type QuizType = "choose_context" | "choose_pronunciation" | "fill_metadata"

export type Notebook = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
  syncedAt: Date
}

export type Note = {
  id: string
  notebookId: string
  name: string
  s3Key: string
  createdAt: Date
  updatedAt: Date
  syncedAt: Date
}

export type NotePiece = {
  id: string
  noteId: string
  createdAt: Date
}

export type NotePieceContent = {
  notePieceId: string
  expression: string
  annotation: string
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
  choicePool: string[]
  createdAt: Date
  updatedAt: Date
}

export type QuizRun = {
  id: string
  userId: string
  startedAt: Date
  completedAt: Date | null
  syncedAt: Date
}

export type QuizRecord = {
  id: string
  quizRunId: string
  quizId: string
  choices: string[]
  userAnswer: string | null
  isCorrect: boolean | null
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
  choicePool: string[]
}

export type AILearnResponse = {
  explanation: string
  examples: string[]
  relatedExpressions: string[]
}

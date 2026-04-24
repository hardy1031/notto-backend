export type QuizType = "choose_context" | "choose_pronunciation" | "fill_metadata"

export type NotePieceContent = {
  notePieceId: string
  expression: string
  annotation: string
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

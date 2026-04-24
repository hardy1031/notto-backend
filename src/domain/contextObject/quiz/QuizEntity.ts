import type { GeneratedQuiz, QuizType } from "../../types.ts"
import type { ContextObjectEntity } from "../ContextObjectEntity.ts"

type QuizProps = {
  id: string
  contextObjectId: string
  type: QuizType
  questionSentence: string
  answer: string
  choicePool: string[]
  createdAt: Date
  updatedAt: Date
}

export class QuizEntity {
  readonly id!: string
  readonly contextObjectId!: string
  readonly type!: QuizType
  readonly questionSentence!: string
  readonly answer!: string
  readonly choicePool!: string[]
  readonly createdAt!: Date
  readonly updatedAt!: Date

  private constructor(props: QuizProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: QuizProps): QuizEntity {
    return new QuizEntity(props)
  }

  static reconstruct(props: QuizProps): QuizEntity {
    return new QuizEntity(props)
  }

  /** Creates a QuizEntity from AI-generated data for a given ContextObject. */
  static fromGenerated(
    generated: GeneratedQuiz,
    contextObject: ContextObjectEntity,
    id: string,
    now: Date
  ): QuizEntity {
    return new QuizEntity({
      id,
      contextObjectId: contextObject.id,
      type: generated.type,
      questionSentence: generated.questionSentence,
      answer: generated.answer,
      choicePool: generated.choicePool,
      createdAt: now,
      updatedAt: now,
    })
  }
}

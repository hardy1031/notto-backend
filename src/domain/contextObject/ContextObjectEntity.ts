import type { GeneratedContextObject } from "../types.ts"

type Formality = "casual" | "neutral" | "formal"
type ExampleDialogueLine = { speaker: string; text: string }

type ContextObjectProps = {
  id: string
  notePieceId: string
  noteId: string
  expression: string
  baseMeaning: string
  actualNuance: string
  tone: string
  formality: Formality
  isSlang: boolean
  exampleDialogue: ExampleDialogueLine[]
  createdAt: Date
  updatedAt: Date
}

export class ContextObjectEntity {
  readonly id!: string
  readonly notePieceId!: string
  readonly noteId!: string
  readonly expression!: string
  readonly baseMeaning!: string
  readonly actualNuance!: string
  readonly tone!: string
  readonly formality!: Formality
  readonly isSlang!: boolean
  readonly exampleDialogue!: ExampleDialogueLine[]
  readonly createdAt!: Date
  readonly updatedAt!: Date

  private constructor(props: ContextObjectProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: ContextObjectProps): ContextObjectEntity {
    return new ContextObjectEntity(props)
  }

  static reconstruct(props: ContextObjectProps): ContextObjectEntity {
    return new ContextObjectEntity(props)
  }

  /** Creates a ContextObjectEntity from AI-generated data. */
  static fromGenerated(
    generated: GeneratedContextObject,
    notePieceId: string,
    noteId: string,
    id: string,
    now: Date
  ): ContextObjectEntity {
    return new ContextObjectEntity({
      id,
      notePieceId,
      noteId,
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
}

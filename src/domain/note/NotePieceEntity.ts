import type { ContextObjectEntity } from "../contextObject/ContextObjectEntity.ts"

type NotePieceProps = {
  id: string
  noteId: string
  createdAt: Date
}

export class NotePieceEntity {
  readonly id!: string
  readonly noteId!: string
  readonly createdAt!: Date

  private constructor(props: NotePieceProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: NotePieceProps): NotePieceEntity {
    return new NotePieceEntity(props)
  }

  static reconstruct(props: NotePieceProps): NotePieceEntity {
    return new NotePieceEntity(props)
  }

  /** Returns pieces that have not yet been interpreted into a ContextObject. */
  static findUninterpreted(
    pieces: NotePieceEntity[],
    contextObjects: ContextObjectEntity[]
  ): NotePieceEntity[] {
    const interpretedIds = new Set(contextObjects.map((co) => co.notePieceId))
    return pieces.filter((p) => !interpretedIds.has(p.id))
  }
}

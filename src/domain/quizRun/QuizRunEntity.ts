type QuizRunProps = {
  id: string
  userId: string
  startedAt: Date
  completedAt: Date | null
  syncedAt: Date
}

type QuizRecordProps = {
  id: string
  quizRunId: string
  quizId: string
  choices: string[]
  userAnswer: string | null
  isCorrect: boolean | null
  createdAt: Date
}

export class QuizRecordEntity {
  readonly id!: string
  readonly quizRunId!: string
  readonly quizId!: string
  readonly choices!: string[]
  readonly userAnswer!: string | null
  readonly isCorrect!: boolean | null
  readonly createdAt!: Date

  private constructor(props: QuizRecordProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: QuizRecordProps): QuizRecordEntity {
    return new QuizRecordEntity(props)
  }

  static reconstruct(props: QuizRecordProps): QuizRecordEntity {
    return new QuizRecordEntity(props)
  }
}

export type QuizRunWithRecords = {
  quizRun: QuizRunEntity
  quizRecords: QuizRecordEntity[]
}

export class QuizRunEntity {
  readonly id!: string
  readonly userId!: string
  readonly startedAt!: Date
  readonly completedAt!: Date | null
  readonly syncedAt!: Date

  private constructor(props: QuizRunProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: QuizRunProps): QuizRunEntity {
    return new QuizRunEntity(props)
  }

  static reconstruct(props: QuizRunProps): QuizRunEntity {
    return new QuizRunEntity(props)
  }

  isCompleted(): boolean {
    return this.completedAt !== null
  }

  /** Returns a new completed QuizRun. Throws if already completed. */
  complete(completedAt: Date): QuizRunEntity {
    if (this.isCompleted()) {
      throw new Error(`QuizRun ${this.id} is already completed`)
    }
    return new QuizRunEntity({ ...this.toProps(), completedAt })
  }

  withSyncedAt(syncedAt: Date): QuizRunEntity {
    return new QuizRunEntity({ ...this.toProps(), syncedAt })
  }

  private toProps(): QuizRunProps {
    return {
      id: this.id,
      userId: this.userId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      syncedAt: this.syncedAt,
    }
  }
}

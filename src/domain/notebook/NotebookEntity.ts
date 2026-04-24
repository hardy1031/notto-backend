type NotebookProps = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
  syncedAt: Date
}

export class NotebookEntity {
  readonly id!: string
  readonly userId!: string
  readonly name!: string
  readonly createdAt!: Date
  readonly updatedAt!: Date
  readonly syncedAt!: Date

  private constructor(props: NotebookProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: NotebookProps): NotebookEntity {
    return new NotebookEntity(props)
  }

  static reconstruct(props: NotebookProps): NotebookEntity {
    return new NotebookEntity(props)
  }

  /** Returns true if this notebook was updated more recently than the other (for LWW sync). */
  isNewerThan(other: NotebookEntity): boolean {
    return this.updatedAt > other.updatedAt
  }

  withUpdates(name: string, updatedAt: Date, syncedAt: Date): NotebookEntity {
    return new NotebookEntity({ ...this.toProps(), name, updatedAt, syncedAt })
  }

  withSyncedAt(syncedAt: Date): NotebookEntity {
    return new NotebookEntity({ ...this.toProps(), syncedAt })
  }

  private toProps(): NotebookProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      syncedAt: this.syncedAt,
    }
  }
}

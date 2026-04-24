type NoteProps = {
  id: string
  notebookId: string
  name: string
  s3Key: string
  createdAt: Date
  updatedAt: Date
  syncedAt: Date
}

export class NoteEntity {
  readonly id!: string
  readonly notebookId!: string
  readonly name!: string
  readonly s3Key!: string
  readonly createdAt!: Date
  readonly updatedAt!: Date
  readonly syncedAt!: Date

  private constructor(props: NoteProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: NoteProps): NoteEntity {
    return new NoteEntity(props)
  }

  static reconstruct(props: NoteProps): NoteEntity {
    return new NoteEntity(props)
  }

  /** Builds the S3 storage key for a note's content. */
  static buildS3Key(userId: string, notebookId: string, noteId: string): string {
    return `${userId}/${notebookId}/${noteId}.json`
  }

  /** Returns true if this note was updated more recently than the other (for LWW sync). */
  isNewerThan(other: NoteEntity): boolean {
    return this.updatedAt > other.updatedAt
  }

  withUpdates(name: string, updatedAt: Date, syncedAt: Date): NoteEntity {
    return new NoteEntity({ ...this.toProps(), name, updatedAt, syncedAt })
  }

  withSyncedAt(syncedAt: Date): NoteEntity {
    return new NoteEntity({ ...this.toProps(), syncedAt })
  }

  private toProps(): NoteProps {
    return {
      id: this.id,
      notebookId: this.notebookId,
      name: this.name,
      s3Key: this.s3Key,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      syncedAt: this.syncedAt,
    }
  }
}

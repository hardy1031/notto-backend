type UserProps = {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}

export class UserEntity {
  readonly id!: string
  readonly userName!: string
  readonly email!: string
  readonly firstLanguage!: string
  readonly targetLanguage!: string
  readonly createdAt!: Date

  private constructor(props: UserProps) {
    Object.assign(this, props)
    Object.freeze(this)
  }

  static create(props: UserProps): UserEntity {
    return new UserEntity(props)
  }

  static reconstruct(props: UserProps): UserEntity {
    return new UserEntity(props)
  }
}

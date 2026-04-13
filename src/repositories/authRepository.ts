export type AuthUser = {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}

export interface AuthRepository {
  createUser(params: {
    userName: string
    email: string
    password: string
    firstLanguage: string
    targetLanguage: string
  }): Promise<{ token: string; user: AuthUser }>

  authenticateUser(
    email: string,
    password: string
  ): Promise<{ token: string; user: AuthUser }>

  verifyToken(token: string): Promise<string | null>
}

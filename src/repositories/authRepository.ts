export type AuthUser = {
  id: string
  userName: string
  email: string
  firstLanguage: string
  targetLanguage: string
  createdAt: Date
}

// Domain alias — the authenticated user is a Learner
export type Learner = AuthUser

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

  logout(token: string): Promise<void>

  getLearner(userId: string): Promise<Learner>

  updateLearner(
    userId: string,
    params: { userName?: string; firstLanguage?: string; targetLanguage?: string }
  ): Promise<Learner>

  deleteLearner(userId: string): Promise<void>
}

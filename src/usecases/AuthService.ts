export interface AuthService {
  verifyToken(token: string): Promise<string | null>

  authenticateUser(email: string, password: string): Promise<{ token: string; userId: string }>

  logout(token: string): Promise<void>

  createAuthUser(email: string, password: string): Promise<{ token: string; userId: string }>
}

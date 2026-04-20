export interface UserRepository {
  updateUser(
    userId: string,
    params: { userName?: string; firstLanguage?: string; targetLanguage?: string }
  ): Promise<void>

  deleteUser(userId: string): Promise<void>

  initUser(
    userId: string,
    params: { userName: string; firstLanguage: string; targetLanguage: string }
  ): Promise<void>
}

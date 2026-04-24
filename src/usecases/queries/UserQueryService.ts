import type { UserEntity } from "../../domain/user/UserEntity.ts"

export interface UserQueryService {
  getUser(userId: string): Promise<UserEntity>
}

import type { User } from "../../domain/types.ts"

export interface UserQueryService {
  getUser(userId: string): Promise<User>
}

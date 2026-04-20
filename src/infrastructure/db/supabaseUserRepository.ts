import { createClient } from "@supabase/supabase-js"
import { DBError } from "../../errors/index.ts"
import sql from "../postgresClient.ts"
import type { User } from "../../domain/types.ts"
import type { UserRepository } from "../../domain/user/UserRepository.ts"
import type { UserQueryService } from "../../usecases/queries/UserQueryService.ts"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export class SupabaseUserRepository implements UserRepository, UserQueryService {
  async initUser(
    userId: string,
    params: { userName: string; firstLanguage: string; targetLanguage: string }
  ): Promise<void> {
    await sql`
      UPDATE users
      SET user_name = ${params.userName},
          first_language = ${params.firstLanguage},
          target_language = ${params.targetLanguage}
      WHERE id = ${userId}
    `
  }

  async updateUser(
    userId: string,
    params: { userName?: string; firstLanguage?: string; targetLanguage?: string }
  ): Promise<void> {
    if (params.userName !== undefined) {
      await sql`UPDATE users SET user_name = ${params.userName} WHERE id = ${userId}`
    }
    if (params.firstLanguage !== undefined) {
      await sql`UPDATE users SET first_language = ${params.firstLanguage} WHERE id = ${userId}`
    }
    if (params.targetLanguage !== undefined) {
      await sql`UPDATE users SET target_language = ${params.targetLanguage} WHERE id = ${userId}`
    }
  }

  async deleteUser(userId: string): Promise<void> {
    // Deleting from auth.users cascades to all user data in the DB.
    // S3 objects under {userId}/ must be cleaned up separately (see production_todo §4.3).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw new DBError(error.message)
  }

  async getUser(userId: string): Promise<User> {
    const rows = await sql<{ user_name: string; first_language: string; target_language: string }[]>`
      SELECT user_name, first_language, target_language FROM users WHERE id = ${userId}
    `
    if (rows.length === 0) throw new DBError("User not found")

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authError) throw new DBError(authError.message)

    const userData = rows[0]!
    return {
      id: userId,
      userName: userData.user_name,
      email: authUser.user.email ?? "",
      firstLanguage: userData.first_language,
      targetLanguage: userData.target_language,
      createdAt: new Date(authUser.user.created_at),
    }
  }
}

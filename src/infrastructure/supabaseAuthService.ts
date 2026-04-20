import { createClient } from "@supabase/supabase-js"
import { ConflictError, DBError } from "../errors/index.ts"
import { supabaseAnon } from "./supabaseClient.ts"
import type { AuthService } from "../usecases/AuthService.ts"

// Service-role client used only for Supabase Auth admin operations (createUser, deleteUser, etc.)
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export class SupabaseAuthService implements AuthService {
  async createAuthUser(
    email: string,
    password: string
  ): Promise<{ token: string; userId: string }> {
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        throw new ConflictError("Email already registered")
      }
      throw new DBError(signUpError.message)
    }

    const userId = authData.user.id

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) throw new DBError(signInError.message)

    const token = signInData.session?.access_token
    if (!token) throw new DBError("Failed to obtain access token")

    return { token, userId }
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<{ token: string; userId: string }> {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })

    if (error) throw new DBError(error.message)

    const token = data.session?.access_token
    if (!token) throw new DBError("Failed to obtain access token")

    return { token, userId: data.user.id }
  }

  async verifyToken(token: string): Promise<string | null> {
    const { data, error } = await supabaseAnon.auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
  }

  async logout(token: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.signOut(token)
    if (error) throw new DBError(error.message)
  }
}

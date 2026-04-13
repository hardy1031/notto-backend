import { ConflictError, DBError } from "../errors/index.ts"
import { supabase, supabaseAnon } from "./supabaseClient.ts"
import type { AuthRepository, AuthUser } from "../repositories/authRepository.ts"

export class SupabaseAuthRepository implements AuthRepository {
  async createUser(params: {
    userName: string
    email: string
    password: string
    firstLanguage: string
    targetLanguage: string
  }): Promise<{ token: string; user: AuthUser }> {
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        throw new ConflictError("Email already registered")
      }
      throw new DBError(signUpError.message)
    }

    const userId = authData.user.id

    const { error: updateError } = await supabase
      .from("users")
      .update({
        user_name: params.userName,
        first_language: params.firstLanguage,
        target_language: params.targetLanguage,
      })
      .eq("id", userId)

    if (updateError) throw new DBError(updateError.message)

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    })

    if (signInError) throw new DBError(signInError.message)

    const token = signInData.session?.access_token
    if (!token) throw new DBError("Failed to obtain access token")

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()

    if (userError) throw new DBError(userError.message)

    return {
      token,
      user: {
        id: userId,
        userName: userData.user_name as string,
        email: params.email,
        firstLanguage: userData.first_language as string,
        targetLanguage: userData.target_language as string,
        createdAt: new Date(authData.user.created_at),
      },
    }
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<{ token: string; user: AuthUser }> {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })

    if (error) throw new DBError(error.message)

    const token = data.session?.access_token
    if (!token) throw new DBError("Failed to obtain access token")

    const userId = data.user.id

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("userError details:", JSON.stringify(userError))
      throw new DBError(userError.message)
    }

    return {
      token,
      user: {
        id: userId,
        userName: userData.user_name as string,
        email,
        firstLanguage: userData.first_language as string,
        targetLanguage: userData.target_language as string,
        createdAt: new Date(data.user.created_at),
      },
    }
  }

  async verifyToken(token: string): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
  }
}

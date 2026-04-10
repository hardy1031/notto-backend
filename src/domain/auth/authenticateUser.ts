import { DBError } from "../../errors/index.ts"
import { supabase } from "../../infrastructure/supabaseClient.ts"
import type { CreatedUser } from "./createUser.ts"

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ token: string; user: CreatedUser }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) throw new DBError(error.message)

  const token = data.session?.access_token
  if (!token) throw new DBError("Failed to obtain access token")

  const userId = data.user.id

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
      email,
      firstLanguage: userData.first_language as string,
      targetLanguage: userData.target_language as string,
      createdAt: new Date(data.user.created_at),
    },
  }
}

import { supabase } from "../../infrastructure/supabaseClient.ts"

export async function verifyToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

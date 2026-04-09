import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export async function signInAnonymously() {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.signInAnonymously()
  if (error) console.error("[auth] signInAnonymously error:", error)
}

// TODO: 익명 사용자가 로그인 중인 경우 linkIdentity({ provider: 'google' })로 교체 필요.
// 현재 signInWithOAuth는 기존 세션을 교체하므로 익명 사용자의 데이터(user_id)가 끊어진다.
export async function signInWithGoogle() {
  const supabase = getSupabaseBrowserClient()
  const redirectTo = `${window.location.origin}/auth/callback`

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  })

  if (error) console.error("[auth] signInWithGoogle error:", error)
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.signOut()
  if (error) console.error("[auth] signOut error:", error)
}

export async function getCurrentUser() {
  try {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user ?? null
  } catch {
    return null
  }
}

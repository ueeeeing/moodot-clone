import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export async function signInAnonymously() {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.signInAnonymously()
  if (error) console.error("[auth] signInAnonymously error:", error)
}

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowserClient()
  const redirectTo = `${window.location.origin}/auth/callback`

  const { data: { user } } = await supabase.auth.getUser()

  console.debug(
    "[auth] signInWithGoogle | user.id:", user?.id ?? "null",
    "| is_anonymous:", user?.is_anonymous ?? "-"
  )

  // 익명 사용자인 경우 uid 저장 → 로그인 후 데이터 병합에 사용
  if (user?.is_anonymous) {
    localStorage.setItem("pre_auth_uid", user.id)
    console.debug("[auth] pre_auth_uid 저장:", user.id)
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  })

  if (error) {
    console.error("[auth] signInWithGoogle error:", error)
    localStorage.removeItem("pre_auth_uid")
    throw error
  }
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

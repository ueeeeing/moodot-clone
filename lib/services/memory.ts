import { getSupabaseBrowserClient } from "@/lib/supabase/client"

// ---------- Types ----------

export type MemoryRow = {
  id: number
  title: string | null
  text: string | null
  image_url: string | null
  emotion_id: number | null
  with_whom: string | null
  memory_at: string | null
  place_name: string | null
  location_label: string | null
  location_lat: number | null
  location_lng: number | null
}

export type CreateMemoryInput = {
  title: string | null
  text: string | null
  image_url: string | null
  emotion_id: number
  with_whom: string
  memory_at: string
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  place_name: string | null
}

export type UpdateMemoryInput = {
  title: string | null
  text: string | null
  image_url: string | null
  emotion_id: number
  with_whom: string
  memory_at: string
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  place_name: string | null
}

// ---------- Queries ----------

/** 전체 목록 (memory_at 내림차순). 에러 시 throw. */
export async function getMemories(): Promise<MemoryRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("memories")
    .select("id,title,text,emotion_id,with_whom,memory_at")
    .order("memory_at", { ascending: false })
  if (error) throw error
  return (data as MemoryRow[]) ?? []
}

/** 최신 N개 (memory_at 내림차순). 에러 시 throw. */
export async function getRecentMemories(limit: number): Promise<MemoryRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("memories")
    .select("id,title,text,emotion_id,memory_at")
    .order("memory_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as MemoryRow[]) ?? []
}

/** 단건 조회. 에러 시 throw. */
export async function getMemoryById(id: number): Promise<MemoryRow> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("memories")
    .select("id,title,text,image_url,emotion_id,with_whom,memory_at,place_name,location_label,location_lat,location_lng")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as MemoryRow
}

// ---------- Mutations ----------

/** 새 메모리 생성. 에러 시 throw. */
export async function createMemory(input: CreateMemoryInput): Promise<void> {
  const supabase = getSupabaseBrowserClient()

  // 세션 확인 — 없으면 익명 로그인 후 재시도
  let { data: { user } } = await supabase.auth.getUser()
  console.log("[createMemory] getUser:", user?.id ?? "null", "| is_anonymous:", user?.is_anonymous ?? "-")

  if (!user) {
    console.log("[createMemory] 세션 없음 → signInAnonymously")
    const { data, error: anonErr } = await supabase.auth.signInAnonymously()
    if (anonErr || !data.user) {
      console.error("[createMemory] signInAnonymously 실패:", anonErr)
      throw new Error("인증에 실패했습니다. 잠시 후 다시 시도해주세요.")
    }
    user = data.user
    console.log("[createMemory] 익명 사용자 생성:", user.id)
  }

  const { data: sessionData } = await supabase.auth.getSession()
  console.log("[createMemory] access_token:", sessionData.session?.access_token ? "있음" : "없음(MISSING)")

  const { error } = await supabase
    .from("memories")
    .insert({ ...input, user_id: user.id } as unknown as never)

  if (error) {
    console.error("[createMemory] insert error:", error.code, error.message)
    throw error
  }
}

/** 기존 메모리 수정. 에러 시 throw. */
export async function updateMemory(id: number, input: UpdateMemoryInput): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("memories").update(input as unknown as never).eq("id", id)
  if (error) throw error
}

/** 메모리 삭제. 에러 시 throw. */
export async function deleteMemory(id: number): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("memories").delete().eq("id", id)
  if (error) throw error
}

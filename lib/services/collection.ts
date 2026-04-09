import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { MemoryRow } from "./memory"

// ---------- Types ----------

/** collections.cover_memory_id → memories 조인 결과 타입 */
export type CoverMemory = { image_url: string | null } | null

/** DB 컬럼 그대로의 raw 타입 (조인 필드 제외) */
export type CollectionRow = {
  id: string          // UUID
  title: string
  note: string | null
  location: string | null
  start_date: string | null   // "YYYY-MM-DD"
  end_date: string | null     // "YYYY-MM-DD"
  cover_memory_id: number | null
  created_at: string
  updated_at: string
}

/**
 * 목록 조회 결과.
 * cover_memory 는 cover_memory_id → memories 조인으로 채워진다.
 */
export type CollectionSummary = CollectionRow & {
  cover_memory: CoverMemory
  memory_count: number
}

export type MemoryInCollection = MemoryRow & { position: number }

/**
 * 상세 조회 결과.
 * cover_memory 는 cover_memory_id → memories 조인으로 채워진다.
 */
export type CollectionWithMemories = CollectionRow & {
  cover_memory: CoverMemory
  memories: MemoryInCollection[]
}

export type CollectionFormInput = {
  title: string
  note: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  cover_memory_id: number | null
  memory_ids: number[]          // position 순서 기준
}

// ---------- 내부 Supabase 응답 타입 ----------

/** getCollections 쿼리의 row 타입 */
type CollectionListRow = CollectionRow & {
  cover_memory: CoverMemory
  collection_memories: Array<{ count: number }>
}

/** getCollectionById 쿼리의 row 타입 */
type CollectionDetailRow = CollectionRow & {
  cover_memory: CoverMemory
}

// ---------- Queries ----------

/** 전체 컬렉션 목록 (생성일 내림차순) */
export async function getCollections(): Promise<CollectionSummary[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_memories(count), cover_memory:cover_memory_id(image_url)")
    .order("created_at", { ascending: false })
  if (error) throw error

  return (data as CollectionListRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    note: row.note,
    location: row.location,
    start_date: row.start_date,
    end_date: row.end_date,
    cover_memory_id: row.cover_memory_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cover_memory: row.cover_memory ?? null,
    memory_count: Number(row.collection_memories?.[0]?.count ?? 0),
  }))
}

/** 단건 컬렉션 + 포함된 Memory 목록 (position 오름차순) */
export async function getCollectionById(id: string): Promise<CollectionWithMemories> {
  const supabase = getSupabaseBrowserClient()

  const { data: row, error: colError } = await supabase
    .from("collections")
    .select("*, cover_memory:cover_memory_id(image_url)")
    .eq("id", id)
    .single()
  if (colError) throw colError

  const { data: joins, error: joinsError } = await supabase
    .from("collection_memories")
    .select(
      "position, memories(id, title, text, image_url, emotion_id, with_whom, memory_at, place_name, location_label, location_lat, location_lng)"
    )
    .eq("collection_id", id)
    .order("position", { ascending: true })
  if (joinsError) throw joinsError

  const memories: MemoryInCollection[] = (joins ?? []).map(
    (j: { position: number; memories: MemoryRow | MemoryRow[] }) => {
      const mem = Array.isArray(j.memories) ? j.memories[0] : j.memories
      return { ...mem, position: j.position }
    }
  )

  const { cover_memory, ...rest } = row as CollectionDetailRow

  return {
    ...rest,
    cover_memory: cover_memory ?? null,
    memories,
  }
}

// ---------- 사용 가능한 Memory ----------

/**
 * 컬렉션에 추가할 수 있는 Memory 목록:
 * - 어느 컬렉션에도 속하지 않은 Memory
 * - 현재 수정 중인 컬렉션(currentCollectionId)에 이미 속한 Memory
 */
export async function getAvailableMemories(
  currentCollectionId?: string
): Promise<MemoryRow[]> {
  const supabase = getSupabaseBrowserClient()

  const { data: taken, error: takenError } = await supabase
    .from("collection_memories")
    .select("memory_id, collection_id")
  if (takenError) throw takenError

  const excludedIds = (taken as Array<{ memory_id: number; collection_id: string }>)
    .filter(
      (cm) =>
        currentCollectionId == null || cm.collection_id !== currentCollectionId
    )
    .map((cm) => cm.memory_id)

  const { data: memories, error } = await supabase
    .from("memories")
    .select("id, title, text, image_url, emotion_id, with_whom, memory_at, place_name")
    .order("memory_at", { ascending: false })
  if (error) throw error

  const all = (memories ?? []) as MemoryRow[]
  if (excludedIds.length === 0) return all
  return all.filter((m) => !excludedIds.includes(m.id))
}

// ---------- Mutations ----------

/** 새 컬렉션 생성. 생성된 UUID 반환. */
export async function createCollection(
  input: CollectionFormInput
): Promise<string> {
  const supabase = getSupabaseBrowserClient()

  let { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const { data, error: anonErr } = await supabase.auth.signInAnonymously()
    if (anonErr || !data.user) throw new Error("인증에 실패했습니다.")
    user = data.user
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({
      title: input.title,
      note: input.note,
      location: input.location,
      start_date: input.start_date,
      end_date: input.end_date,
      cover_memory_id: input.cover_memory_id,
      user_id: user.id,
    })
    .select("id")
    .single()
  if (error) throw error

  const collectionId = (data as { id: string }).id

  if (input.memory_ids.length > 0) {
    const { error: cmError } = await supabase
      .from("collection_memories")
      .insert(
        input.memory_ids.map((memoryId, index) => ({
          collection_id: collectionId,
          memory_id: memoryId,
          position: index,
        }))
      )
    if (cmError) throw cmError
  }

  return collectionId
}

/** 기존 컬렉션 수정 (memory 목록 전체 교체). */
export async function updateCollection(
  id: string,
  input: CollectionFormInput
): Promise<void> {
  const supabase = getSupabaseBrowserClient()

  const { error } = await supabase
    .from("collections")
    .update({
      title: input.title,
      note: input.note,
      location: input.location,
      start_date: input.start_date,
      end_date: input.end_date,
      cover_memory_id: input.cover_memory_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw error

  const { error: deleteError } = await supabase
    .from("collection_memories")
    .delete()
    .eq("collection_id", id)
  if (deleteError) throw deleteError

  if (input.memory_ids.length > 0) {
    const { error: insertError } = await supabase
      .from("collection_memories")
      .insert(
        input.memory_ids.map((memoryId, index) => ({
          collection_id: id,
          memory_id: memoryId,
          position: index,
        }))
      )
    if (insertError) throw insertError
  }
}

/** 컬렉션 삭제. collection_memories는 CASCADE로 자동 삭제. */
export async function deleteCollection(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("collections").delete().eq("id", id)
  if (error) throw error
}

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type { CreateMemoryInput } from "@/lib/services/memory"
import {
  MEMORY_SELECT_COLUMNS,
  toPublicMemoryRow,
  type MemoryDbRow,
} from "@/lib/server/memory-records"
import { encryptMemoryText } from "@/lib/server/memory-text-crypto"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function buildCreatePayload(input: CreateMemoryInput, userId: string) {
  const encryptedText = encryptMemoryText(input.text)

  return {
    ...input,
    user_id: userId,
    text: null,
    ...encryptedText,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const limitParam = request.nextUrl.searchParams.get("limit")

    if (!user) {
      return jsonError("인증이 필요합니다.", 401)
    }

    let query = supabase
      .from("memories")
      .select(MEMORY_SELECT_COLUMNS)
      .eq("user_id", user.id)
      .order("memory_at", { ascending: false })

    if (limitParam) {
      const limit = Number.parseInt(limitParam, 10)
      if (Number.isFinite(limit) && limit > 0) {
        query = query.limit(limit)
      }
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(((data ?? []) as MemoryDbRow[]).map(toPublicMemoryRow))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메모리를 불러오지 못했습니다."
    return jsonError(message, 500)
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateMemoryInput
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("인증이 필요합니다.", 401)
    }

    const { data, error } = await supabase
      .from("memories")
      .insert(buildCreatePayload(input, user.id) as unknown as never)
      .select("id")
      .single()

    if (error) throw error

    return NextResponse.json({ id: (data as { id: number }).id })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메모리 저장에 실패했습니다."
    return jsonError(message, 500)
  }
}

import { NextResponse } from "next/server"

import type { UpdateMemoryInput } from "@/lib/services/memory"
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

function parseMemoryId(rawId: string) {
  const id = Number(rawId)
  return Number.isInteger(id) && id > 0 ? id : null
}

function buildUpdatePayload(input: UpdateMemoryInput) {
  const encryptedText = encryptMemoryText(input.text)

  return {
    ...input,
    text: null,
    ...encryptedText,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await params
    const memoryId = parseMemoryId(rawId)

    if (!memoryId) {
      return jsonError("잘못된 메모리 ID입니다.", 400)
    }

    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("인증이 필요합니다.", 401)
    }

    const { data, error } = await supabase
      .from("memories")
      .select(MEMORY_SELECT_COLUMNS)
      .eq("id", memoryId)
      .eq("user_id", user.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return jsonError("기록을 찾을 수 없습니다.", 404)
      }
      throw error
    }

    return NextResponse.json(toPublicMemoryRow(data as MemoryDbRow))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메모리를 불러오지 못했습니다."
    return jsonError(message, 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await params
    const memoryId = parseMemoryId(rawId)

    if (!memoryId) {
      return jsonError("잘못된 메모리 ID입니다.", 400)
    }

    const input = (await request.json()) as UpdateMemoryInput
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("인증이 필요합니다.", 401)
    }

    const { error } = await supabase
      .from("memories")
      .update(buildUpdatePayload(input) as unknown as never)
      .eq("id", memoryId)
      .eq("user_id", user.id)

    if (error) throw error

    return new Response(null, { status: 204 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메모리 수정에 실패했습니다."
    return jsonError(message, 500)
  }
}

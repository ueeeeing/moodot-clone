"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, User, Users, Plus } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type MemoryRow = {
  id: number
  title: string | null
  text: string | null
  emotion_id: number | null
  with_whom: string | null
  memory_at: string | null
}

const EMOTION_COLOR_MAP: Record<number, string> = {
  1: "#FFE8B8",
  2: "#F8C8C8",
  3: "#B0E4F8",
  4: "#C0ECD8",
}

function formatMemoryDate(value: string | null) {
  if (!value) return "날짜 정보 없음"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음"

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function MemoriesListView() {
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [searchText, setSearchText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const fetchMemories = async () => {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error } = await supabase
          .from("memories")
          .select("id,title,text,emotion_id,with_whom,memory_at")
          .order("memory_at", { ascending: false })

        if (error) throw error
        if (!mounted) return
        setMemories((data as MemoryRow[]) ?? [])
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : "메모리를 불러오지 못했습니다."
        setErrorMessage(`메모리 조회 실패: ${message}`)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void fetchMemories()
    return () => {
      mounted = false
    }
  }, [])

  const filteredMemories =
    searchText.trim() === ""
      ? memories
      : memories.filter((memory) => {
          const keyword = searchText.toLowerCase()
          const title = (memory.title ?? "").toLowerCase()
          const text = (memory.text ?? "").toLowerCase()
          return title.includes(keyword) || text.includes(keyword)
        })

  return (
    <section className="pt-6">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mb-muted" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search your memories..."
          className="h-14 w-full rounded-xl bg-mb-card pl-11 pr-4 font-body text-sm text-mb-dark outline-none transition-all duration-200 placeholder:text-mb-muted focus:ring-2 focus:ring-mb-accent-cyan/50"
        />
      </div>

      {/* 기록 남기기 버튼 */}
      <div className="mb-6 flex justify-center">
        <button
          type="button"
          onClick={() => router.push("/memory-create")}
          className="flex items-center gap-2 h-11 rounded-full bg-gradient-to-br from-mb-primary to-mb-secondary font-heading text-[14px] font-semibold text-white shadow-[0px_6px_20px_rgba(124,196,216,0.3)] transition-transform duration-200 active:scale-95"
          style={{ width: "80%" }}
        >
          <Plus className="w-4 h-4 flex-shrink-0 ml-4" />
          <span className="flex-1 text-center pr-4">기록 남기기</span>
        </button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-mb-muted">메모리를 불러오는 중...</p>
      ) : errorMessage ? (
        <p className="py-6 text-center text-sm text-mb-muted">{errorMessage}</p>
      ) : filteredMemories.length === 0 ? (
        <p className="py-6 text-center text-sm text-mb-muted">표시할 메모리가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {filteredMemories.map((memory) => {
            const color = EMOTION_COLOR_MAP[memory.emotion_id ?? 1] ?? EMOTION_COLOR_MAP[1]
            const isTogether = (memory.with_whom ?? "").toLowerCase() === "together"

            return (
              <article
                key={memory.id}
                className="relative overflow-hidden rounded-xl bg-mb-card px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                onClick={() => router.push(`/memory/${memory.id}`)}
              >
                <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: color }} />

                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-[12px] font-bold leading-tight text-mb-dark">
                        {memory.title?.trim() ? memory.title : "Untitled Memory"}
                      </h3>
                      <p className="mt-1 text-xs font-bold tracking-wide text-mb-muted">{formatMemoryDate(memory.memory_at)}</p>
                    </div>
                  </div>
                  {isTogether ? (
                    <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-mb-muted" />
                  ) : (
                    <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-mb-muted" />
                  )}
                </div>

                <p
                  className="font-body text-sm leading-relaxed text-mb-dark/80"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {memory.text?.trim() ? memory.text : " "}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

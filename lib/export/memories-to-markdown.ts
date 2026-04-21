import type { MemoryRow } from "@/lib/services/memory"

const EMOTION_LABEL: Record<number, string> = {
  1: "😊 행복",
  2: "😢 슬픔",
  3: "🌧 우울",
  4: "🌿 평온",
}

function formatExportDate(value: string | null): string {
  if (!value) return "날짜 없음"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "날짜 없음"
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function memoriesToMarkdown(memories: MemoryRow[]): string {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const lines: string[] = []
  lines.push(`# 내 기록 모음 (${memories.length}건)`)
  lines.push("")
  lines.push(`_내보낸 날짜: ${today}_`)

  for (const memory of memories) {
    const title = memory.title?.trim() || "제목 없음"
    const date = formatExportDate(memory.memory_at)
    const emotion = EMOTION_LABEL[memory.emotion_id ?? 1] ?? EMOTION_LABEL[1]
    const isTogether = (memory.with_whom ?? "").toLowerCase() === "together"
    const withWhom = isTogether ? "👥 함께" : "👤 혼자"
    const place = memory.place_name?.trim() || memory.location_label?.trim() || null

    lines.push("")
    lines.push("---")
    lines.push("")
    lines.push(`## ${title}`)
    lines.push("")
    lines.push(`📅 ${date}  ${emotion}  ${withWhom}`)
    if (place) lines.push(`📍 ${place}`)
    lines.push("")

    if (memory.text?.trim()) {
      lines.push(memory.text.trim().replace(/\n/g, "  \n"))
    } else {
      lines.push("_(본문 없음)_")
    }
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(`_Exported from Moodot · ${today}_`)

  return lines.join("\n")
}

export function memoriesToFilename(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `moodot-memories-${date}.md`
}

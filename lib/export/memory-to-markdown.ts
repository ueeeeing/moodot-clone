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

export function memoryToMarkdown(memory: MemoryRow): string {
  const title = memory.title?.trim() || "제목 없음"
  const date = formatExportDate(memory.memory_at)
  const emotion = EMOTION_LABEL[memory.emotion_id ?? 1] ?? EMOTION_LABEL[1]
  const isTogether = (memory.with_whom ?? "").toLowerCase() === "together"
  const withWhom = isTogether ? "👥 함께" : "👤 혼자"
  const place = memory.place_name?.trim() || memory.location_label?.trim() || null

  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push("")
  lines.push(`📅 ${date}`)
  lines.push(`${emotion} · ${withWhom}`)
  if (place) lines.push(`📍 ${place}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  if (memory.text?.trim()) {
    // 줄바꿈 유지: Markdown에서 줄바꿈은 줄 끝 공백 2개
    lines.push(memory.text.trim().replace(/\n/g, "  \n"))
  } else {
    lines.push("_(본문 없음)_")
  }

  lines.push("")
  lines.push("---")
  lines.push("")

  if (memory.image_url) {
    lines.push(`사진: ${memory.image_url}`)
  } else {
    lines.push("사진: 없음")
  }

  lines.push("")
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  lines.push(`_Exported from Moodot · ${today}_`)

  return lines.join("\n")
}

export function memoryToFilename(memory: MemoryRow): string {
  const title = (memory.title?.trim() || "기록")
    .replace(/[^\w가-힣\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
  const date = memory.memory_at
    ? new Date(memory.memory_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  return `moodot-${title}-${date}.md`
}

"use client"

import { Check, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MemoryRow } from "@/lib/services/memory"

const EMOTION_COLOR_MAP: Record<number, string> = {
  1: "#FFE8B8",
  2: "#F8C8C8",
  3: "#B0E4F8",
  4: "#C0ECD8",
}

function formatShortDate(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}

type Props = {
  memories: MemoryRow[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function MemoryPicker({ memories, selectedIds, onChange }: Props) {
  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  if (memories.length === 0) {
    return (
      <p className="py-4 text-center font-body text-sm text-mb-muted">
        선택할 수 있는 기록이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {memories.map((memory) => {
        const isSelected = selectedIds.includes(memory.id)
        const color = EMOTION_COLOR_MAP[memory.emotion_id ?? 1] ?? EMOTION_COLOR_MAP[1]

        return (
          <button
            key={memory.id}
            type="button"
            onClick={() => toggle(memory.id)}
            className={cn(
              "relative flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-mb-primary/50",
              isSelected
                ? "bg-mb-primary/10 ring-1 ring-mb-primary/40"
                : "bg-mb-card hover:bg-mb-unselected/60"
            )}
          >
            {/* Emotion color bar */}
            <div
              className="mt-0.5 h-4 w-1 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-[13px] font-semibold text-mb-dark">
                {memory.title?.trim() || "Untitled Memory"}
              </p>
              <p className="mt-0.5 font-body text-[11px] text-mb-muted">
                {formatShortDate(memory.memory_at)}
              </p>
              {memory.text?.trim() && (
                <p
                  className="mt-1 font-body text-xs leading-relaxed text-mb-dark/70"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {memory.text}
                </p>
              )}
            </div>

            {/* Image indicator */}
            {memory.image_url && (
              <ImageIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-mb-muted/60" />
            )}

            {/* Checkmark */}
            <div
              className={cn(
                "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                isSelected
                  ? "border-mb-primary bg-mb-primary"
                  : "border-mb-muted/40 bg-transparent"
              )}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

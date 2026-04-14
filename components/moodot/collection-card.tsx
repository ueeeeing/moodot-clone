"use client"

import { MapPin, Clock } from "lucide-react"
import type { CollectionSummary } from "@/lib/services/collection"
import { SignedImage } from "@/components/moodot/signed-image"

const GRADIENT_PLACEHOLDERS = [
  "from-mb-accent via-mb-accent-mint to-mb-accent-cyan",
  "from-mb-secondary/40 via-mb-accent-lavender/50 to-mb-accent-cyan/60",
  "from-mb-accent-mint via-mb-accent-cyan to-mb-secondary/30",
  "from-mb-sparkle/50 via-mb-accent/60 to-mb-accent-mint/50",
]

function getPlaceholderGradient(id: string): string {
  const lastChar = id.charCodeAt(id.length - 1)
  return GRADIENT_PLACEHOLDERS[lastChar % GRADIENT_PLACEHOLDERS.length]
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return ""
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  if (start && end) {
    if (start === end) return fmt(start)
    return `${fmt(start)} - ${fmt(end)}`
  }
  return fmt((start ?? end)!)
}

type Props = {
  collection: CollectionSummary
  onClick: () => void
}

export function CollectionCard({ collection, onClick }: Props) {
  const dateRange = formatDateRange(collection.start_date, collection.end_date)
  const gradient = getPlaceholderGradient(collection.id)
  const coverImageUrl = collection.cover_memory?.image_url ?? null

  return (
    <article
      className="relative overflow-hidden rounded-2xl bg-mb-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]"
      onClick={onClick}
    >
      {/* 커버 이미지 영역 */}
      <div className="relative h-44 w-full overflow-hidden">
        {coverImageUrl ? (
          <SignedImage
            path={coverImageUrl}
            alt={collection.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        {/* 텍스트 가독성 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* 기록 수 배지 */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">
          <span className="font-body text-[11px] font-semibold text-white">
            {collection.memory_count}개
          </span>
        </div>

        {/* 하단 정보 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-heading text-[16px] font-bold leading-tight text-white drop-shadow">
            {collection.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {collection.location && (
              <span className="flex items-center gap-1 font-body text-[12px] text-white/85">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {collection.location}
              </span>
            )}
            {dateRange && (
              <span className="flex items-center gap-1 font-body text-[12px] text-white/85">
                <Clock className="h-3 w-3 flex-shrink-0" />
                {dateRange}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

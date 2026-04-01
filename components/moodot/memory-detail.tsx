"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Smile, Frown, CloudRain, Leaf, User, Users, MapPin, Pencil } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

// --- Leaflet types (same as creation screen) ---
declare global {
  interface Window { L?: LeafletLib }
}
type LeafletMap    = { setView(latlng: [number, number], zoom: number): LeafletMap; remove(): void }
type LeafletMarker = { addTo(map: LeafletMap): LeafletMarker }
type LeafletTileLayer = { addTo(map: LeafletMap): void }
type LeafletLib = {
  map(container: HTMLElement, options: { zoomControl: boolean; dragging: boolean; scrollWheelZoom: boolean }): LeafletMap
  tileLayer(url: string, options: { attribution: string; maxZoom: number }): LeafletTileLayer
  marker(latlng: [number, number]): LeafletMarker
}

let leafletLoader: Promise<void> | null = null
function loadLeafletAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.L) return Promise.resolve()
  if (leafletLoader) return leafletLoader

  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet="true"]')) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      link.dataset.leaflet = "true"
      document.head.appendChild(link)
    }

    const existing = document.querySelector('script[data-leaflet="true"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Leaflet load failed")))
      return
    }

    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.dataset.leaflet = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Leaflet load failed"))
    document.body.appendChild(script)
  })

  return leafletLoader
}

// --- Data types ---
type MemoryRow = {
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

const EMOTION_MAP: Record<number, { icon: React.ElementType; color: string }> = {
  1: { icon: Smile,     color: "#FFE8B8" },
  2: { icon: Frown,     color: "#F8C8C8" },
  3: { icon: CloudRain, color: "#B0E4F8" },
  4: { icon: Leaf,      color: "#C0ECD8" },
}

function formatDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

// --- Read-only map component ---
function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      await loadLeafletAssets()
      if (cancelled || !containerRef.current || !window.L) return

      const L = window.L
      const map = L.map(containerRef.current, {
        zoomControl: true,
        dragging: false,
        scrollWheelZoom: false,
      }).setView([lat, lng], 15)   // 줌 레벨 15 — 생성 화면과 동일
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng]).addTo(map)
    }

    void init()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: "200px" }}
    />
  )
}

// --- Main component ---
export function MemoryDetail({ id }: { id: number }) {
  const [memory, setMemory] = useState<MemoryRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const fetchMemory = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error } = await supabase
          .from("memories")
          .select("id,title,text,image_url,emotion_id,with_whom,memory_at,place_name,location_label,location_lat,location_lng")
          .eq("id", id)
          .single()

        if (error) throw error
        if (!mounted) return
        setMemory(data as MemoryRow)
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "불러오지 못했습니다.")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void fetchMemory()
    return () => { mounted = false }
  }, [id])

  if (isLoading) return <p className="py-12 text-center text-sm text-mb-muted">불러오는 중...</p>
  if (error || !memory) return <p className="py-12 text-center text-sm text-mb-muted">{error || "기록을 찾을 수 없습니다."}</p>

  const emotion = EMOTION_MAP[memory.emotion_id ?? 1] ?? EMOTION_MAP[1]
  const EmotionIcon = emotion.icon
  const isTogether = (memory.with_whom ?? "").toLowerCase() === "together"
  const WithWhomIcon = isTogether ? Users : User
  const withWhomLabel = isTogether ? "TOGETHER" : "SOLO"
  const hasLocation = memory.location_lat !== null && memory.location_lng !== null

  return (
    <div className="space-y-5 pt-4">
      {/* 제목 영역 */}
      <header className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center justify-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.06)]"
            style={{ backgroundColor: emotion.color }}
          >
            <EmotionIcon className="w-5 h-5 text-mb-dark/80" />
          </div>
          <h2 className="font-heading text-2xl font-extrabold text-mb-dark tracking-tight leading-tight">
            {memory.title?.trim() || "Untitled Memory"}
          </h2>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="font-body text-[11px] font-bold text-mb-muted uppercase tracking-[0.15em]">
            {formatDate(memory.memory_at)}
          </p>
          <div className="flex items-center gap-1.5 text-mb-muted/70">
            <WithWhomIcon className="w-3.5 h-3.5" />
            <span className="font-body text-[10px] font-bold uppercase tracking-widest">
              {withWhomLabel}
            </span>
          </div>
        </div>
      </header>

      {/* 본문 */}
      {memory.text?.trim() && (
        <section className="bg-mb-card rounded-2xl p-6 shadow-[0px_8px_24px_rgba(43,52,54,0.04)]">
          <p className="font-body text-sm leading-relaxed text-mb-dark/80">
            {memory.text}
          </p>
        </section>
      )}

      {/* 이미지 */}
      {memory.image_url && (
        <section>
          <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-mb-unselected">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={memory.image_url}
              alt="Memory photo"
              className="w-full h-full object-cover transition-all duration-200"
            />
          </div>
        </section>
      )}

      {/* 지도 + 위치 정보 */}
      {hasLocation && (
        <section className="overflow-hidden rounded-xl shadow-[0px_4px_16px_rgba(43,52,54,0.05)]">
          {/* 지도 */}
          <div className="h-52 w-full bg-mb-unselected">
            <LocationMap lat={memory.location_lat!} lng={memory.location_lng!} />
          </div>

          {/* 위치 텍스트 */}
          {(memory.place_name || memory.location_label) && (
            <div className="bg-mb-unselected px-4 py-3 flex items-center gap-3">
              <MapPin className="w-4 h-4 text-mb-primary flex-shrink-0" />
              <div className="min-w-0">
                {memory.place_name && (
                  <p className="font-body font-semibold text-sm text-mb-dark truncate">
                    {memory.place_name}
                  </p>
                )}
                {memory.location_label && (
                  <p className="font-body text-xs text-mb-muted truncate">
                    {memory.location_label}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 수정 버튼 */}
      <button
        type="button"
        onClick={() => router.push(`/memory/${memory.id}/edit`)}
        className="mt-2 flex w-full items-center justify-center gap-2 h-12 rounded-full bg-mb-unselected font-body text-sm font-semibold text-mb-dark/70 transition-all duration-200 hover:bg-mb-unselected/80 active:scale-[0.98]"
      >
        <Pencil className="w-4 h-4" />
        수정하기
      </button>
    </div>
  )
}

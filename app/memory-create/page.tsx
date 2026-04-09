"use client"

import Image from "next/image"
import type { LeafletMap, LeafletMarker, LeafletClickEvent } from "@/types/leaflet"
import { useEffect, useRef, useState } from "react"
import {
  X,
  Smile,
  Frown,
  Meh,
  Leaf,
  Clock3,
  ChevronRight,
  ImagePlus,
  MapPinned,
} from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { uploadImage } from "@/lib/storage/image"
import { createMemory } from "@/lib/services/memory"
import { BottomNavigation } from "@/components/moodot/bottom-navigation"

type MoodType = "good" | "bad" | "sad" | "calm"
type WithType = "solo" | "together"
type UploadStatus = "idle" | "uploading" | "success" | "failed"

const EMOTION_ID_MAP: Record<MoodType, number> = {
  good: 1,
  bad: 2,
  sad: 3,
  calm: 4,
}

const moods: Array<{
  id: MoodType
  label: string
  icon: typeof Smile
  activeBg: string
  activeIcon: string
}> = [
  { id: "good", label: "Good", icon: Smile, activeBg: "#FFE8B8", activeIcon: "#8B6B23" },
  { id: "bad", label: "Bad", icon: Frown, activeBg: "#F8C8C8", activeIcon: "#A65E5E" },
  { id: "sad", label: "Sad", icon: Meh, activeBg: "#B0E4F8", activeIcon: "#4A8BA6" },
  { id: "calm", label: "Calm", icon: Leaf, activeBg: "#C0ECD8", activeIcon: "#4A8A6D" },
]

let leafletLoader: Promise<void> | null = null

function loadLeafletAssets() {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.L) return Promise.resolve()
  if (leafletLoader) return leafletLoader

  leafletLoader = new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-leaflet="true"]')
    if (!existingCss) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      link.dataset.leaflet = "true"
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector('script[data-leaflet="true"]')
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve())
      existingScript.addEventListener("error", () => reject(new Error("Leaflet script load failed.")))
      return
    }

    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.dataset.leaflet = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Leaflet script load failed."))
    document.body.appendChild(script)
  })

  return leafletLoader
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ko`,
    )
    if (!res.ok) throw new Error("Reverse geocoding failed")
    const data = await res.json()
    const label = typeof data?.display_name === "string" ? data.display_name : ""
    return label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

function getBrowserCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60_000 },
    )
  })
}

export default function CreatePage() {
  const [mood, setMood] = useState<MoodType>("good")
  const [withWho, setWithWho] = useState<WithType>("solo")
  const [memoryAt, setMemoryAt] = useState<string>("")
  const [title, setTitle] = useState<string>("")
  const [text, setText] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [locationLabel, setLocationLabel] = useState<string>("")
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [placeName, setPlaceName] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [isMapOpen, setIsMapOpen] = useState<boolean>(false)
  const [mapLoading, setMapLoading] = useState<boolean>(false)
  const [pendingLat, setPendingLat] = useState<number | null>(null)
  const [pendingLng, setPendingLng] = useState<number | null>(null)
  const [pendingLabel, setPendingLabel] = useState<string>("")

  const datetimeInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)

  const memoryAtText =
    memoryAt === ""
      ? "날짜와 시간을 선택하세요"
      : new Date(memoryAt).toLocaleString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    if (!isMapOpen) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markerRef.current = null
      return
    }

    let cancelled = false

    const initializeMap = async () => {
      setMapLoading(true)
      try {
        await loadLeafletAssets()
        if (cancelled || !mapContainerRef.current || !window.L) return

        const L = window.L
        const currentPosition =
          locationLat === null || locationLng === null ? await getBrowserCurrentPosition() : null

        const initialLat = locationLat ?? currentPosition?.lat ?? 37.5665
        const initialLng = locationLng ?? currentPosition?.lng ?? 126.978

        const initialZoom = locationLat && locationLng ? 15 : 17

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
        }).setView([initialLat, initialLng], initialZoom)
        mapRef.current = map

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map)

        if (locationLat !== null && locationLng !== null) {
          markerRef.current = L.marker([locationLat, locationLng]).addTo(map)
          setPendingLat(locationLat)
          setPendingLng(locationLng)
          setPendingLabel(locationLabel)
        } else if (currentPosition) {
          markerRef.current = L.marker([currentPosition.lat, currentPosition.lng]).addTo(map)
          setPendingLat(currentPosition.lat)
          setPendingLng(currentPosition.lng)
          setPendingLabel(await reverseGeocode(currentPosition.lat, currentPosition.lng))
        } else {
          setPendingLat(null)
          setPendingLng(null)
          setPendingLabel("")
        }

        if (!mapRef.current) {
          throw new Error("Map initialization failed.")
        }

        map.on("click", async (e: LeafletClickEvent) => {
          const lat = e.latlng.lat
          const lng = e.latlng.lng
          setPendingLat(lat)
          setPendingLng(lng)

          if (!markerRef.current) {
            markerRef.current = L.marker([lat, lng]).addTo(map)
          } else {
            markerRef.current.setLatLng([lat, lng])
          }

          const label = await reverseGeocode(lat, lng)
          if (!cancelled) setPendingLabel(label)
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "지도 로딩에 실패했습니다."
        alert(message)
        setIsMapOpen(false)
      } finally {
        if (!cancelled) setMapLoading(false)
      }
    }

    void initializeMap()

    return () => {
      cancelled = true
    }
  }, [isMapOpen, locationLat, locationLng, locationLabel])

  const handleMemoryAtPick = () => {
    const input = datetimeInputRef.current
    if (!input) return

    if ("showPicker" in input) {
      input.showPicker()
      return
    }
    ;(input as HTMLInputElement).focus()
    ;(input as HTMLInputElement).click()
  }

  const handlePhotoUpload = async (file: File) => {
    setUploadStatus("uploading")
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")
      const path = await uploadImage(file, user.id)
      setImageUrl(path)
      setUploadStatus("success")
    } catch (error) {
      setUploadStatus("failed")
      const message = error instanceof Error ? error.message : "사진 업로드에 실패했습니다."
      alert(`사진 업로드 실패: ${message}`)
    }
  }

  const handleConfirmLocation = () => {
    if (pendingLat === null || pendingLng === null) {
      alert("지도에서 위치를 먼저 선택해 주세요.")
      return
    }

    setLocationLat(pendingLat)
    setLocationLng(pendingLng)
    setLocationLabel(pendingLabel || `${pendingLat.toFixed(6)}, ${pendingLng.toFixed(6)}`)
    setIsMapOpen(false)
  }

  const handleSaveMemory = async () => {
    if (!mood) {
      alert("감정을 선택해 주세요.")
      return
    }
    if (!withWho) {
      alert("함께한 사람을 선택해 주세요.")
      return
    }
    if (!memoryAt) {
      alert("날짜/시간을 선택해 주세요.")
      return
    }
    if (uploadStatus === "uploading") {
      alert("사진 업로드가 완료된 후 저장해 주세요.")
      return
    }
    if (uploadStatus === "failed") {
      alert("사진 업로드에 실패했습니다. 다시 업로드한 뒤 저장해 주세요.")
      return
    }

    setIsSaving(true)
    try {
      await createMemory({
        title: title.trim() === "" ? null : title.trim(),
        text: text.trim() === "" ? null : text.trim(),
        image_url: imageUrl,
        emotion_id: EMOTION_ID_MAP[mood],
        with_whom: withWho === "solo" ? "Solo" : "Together",
        location_lat: locationLat,
        location_lng: locationLng,
        location_label: locationLabel.trim() === "" ? null : locationLabel.trim(),
        place_name: placeName.trim() === "" ? null : placeName.trim(),
        memory_at: new Date(memoryAt).toISOString(),
      })
      alert("기록이 저장되었습니다.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      alert(`저장 실패: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-mb-bg text-mb-dark">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-mb-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[375px] items-center justify-between px-5">
          <button
            type="button"
            className="text-mb-dark/80 transition-opacity duration-200 hover:opacity-70"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="font-heading text-lg font-bold tracking-tight text-mb-dark">New Memory</h1>
          <div className="w-5" />
        </div>
      </header>

      <main className="mx-auto flex max-w-[375px] flex-col gap-6 px-5 pb-32 pt-24">
        <section>
          <h2 className="font-heading text-[36px] font-bold leading-[1.15] tracking-[-0.02em] text-mb-dark">
            오늘을 어떻게
            <br />
            기억하고 싶나요?
          </h2>
        </section>

        <section className="grid grid-cols-4 gap-3">
          {moods.map((item) => {
            const Icon = item.icon
            const active = mood === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMood(item.id)}
                className="group flex flex-col items-center gap-2"
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: active ? item.activeBg : "#EFF4F6",
                    boxShadow: active ? `0 0 0 4px ${item.activeBg}33` : "none",
                  }}
                >
                  <Icon
                    className="h-5 w-5 transition-colors duration-200"
                    style={{ color: active ? item.activeIcon : "#AAB3B6" }}
                  />
                </div>
                <span className="font-body text-[10px] font-bold" style={{ color: active ? "#485058" : "#AAB3B6" }}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-body text-[14px] font-bold text-mb-dark">Who were you with?</h3>
          <div className="flex rounded-full bg-[#EFF4F6] p-1">
            <button
              type="button"
              onClick={() => setWithWho("solo")}
              className="h-11 flex-1 rounded-full text-[14px] font-semibold transition-all duration-200"
              style={{
                background: withWho === "solo" ? "#7CC4D8" : "transparent",
                color: withWho === "solo" ? "#FFFFFF" : "#AAB3B6",
              }}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => setWithWho("together")}
              className="h-11 flex-1 rounded-full text-[14px] font-semibold transition-all duration-200"
              style={{
                background: withWho === "together" ? "#7CC4D8" : "transparent",
                color: withWho === "together" ? "#FFFFFF" : "#AAB3B6",
              }}
            >
              Together
            </button>
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={handleMemoryAtPick}
            className="flex w-full items-center justify-between rounded-xl border border-[#AAB3B61A] bg-white px-4 py-4 shadow-[0px_2px_8px_rgba(43,52,54,0.02)]"
          >
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4 text-[#AAB3B6]" />
              <span className="text-[14px] font-semibold text-mb-dark">{memoryAtText}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[#AAB3B6]" />
          </button>
          <input
            ref={datetimeInputRef}
            type="datetime-local"
            value={memoryAt}
            onChange={(e) => setMemoryAt(e.target.value)}
            className="sr-only"
          />
        </section>

        <section>
          <input
            type="text"
            placeholder="Memory Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-[#AAB3B61A] bg-white px-5 py-4 text-[14px] font-semibold text-mb-dark placeholder:text-[#AAB3B6] shadow-[0px_2px_8px_rgba(43,52,54,0.02)] outline-none focus:ring-1 focus:ring-mb-primary"
          />
        </section>

        <section>
          <textarea
            placeholder="Memory Content"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-32 w-full resize-none rounded-xl border border-[#AAB3B61A] bg-white px-5 py-4 text-[14px] font-medium text-mb-dark placeholder:text-[#AAB3B6] shadow-[0px_2px_8px_rgba(43,52,54,0.02)] outline-none focus:ring-1 focus:ring-mb-primary"
          />
        </section>

        <section>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#AAB3B633] bg-[#EFF4F64D] transition-colors duration-200 hover:bg-[#EFF4F6]"
          >
            {imagePreviewUrl ? (
              <Image src={imagePreviewUrl} alt="선택한 사진 미리보기" fill className="rounded-xl object-cover" unoptimized />
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                  <ImagePlus className="h-5 w-5 text-[#737C7F]" />
                </div>
                <span className="text-[12px] font-semibold text-[#737C7F]">
                  {uploadStatus === "uploading" ? "사진 업로드 중..." : imageUrl ? "사진 업로드 완료" : "사진 추가하기 (선택)"}
                </span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
              setImagePreviewUrl(URL.createObjectURL(file))
              void handlePhotoUpload(file)
            }}
          />
        </section>

        <section>
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-[#AAB3B61A] bg-white px-4 py-4 shadow-[0px_2px_8px_rgba(43,52,54,0.02)]"
          >
            <div className="flex items-center gap-3">
              <MapPinned className="h-4 w-4 text-[#AAB3B6]" />
              <span className="text-[14px] font-semibold text-mb-dark">
                {locationLabel === "" ? "지도에서 위치 선택" : locationLabel}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-[#AAB3B6]" />
          </button>
        </section>

        {locationLat !== null && locationLng !== null ? (
          <section>
            <input
              type="text"
              placeholder="장소 별칭 입력 (예: 우리집, 회사)"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              className="w-full rounded-xl border border-[#AAB3B61A] bg-white px-5 py-4 text-[14px] font-semibold text-mb-dark placeholder:text-[#AAB3B6] shadow-[0px_2px_8px_rgba(43,52,54,0.02)] outline-none focus:ring-1 focus:ring-mb-primary"
            />
          </section>
        ) : null}

        <section className="mt-2">
          <button
            type="button"
            onClick={() => void handleSaveMemory()}
            disabled={isSaving || uploadStatus === "uploading"}
            className="h-14 w-full rounded-full bg-gradient-to-br from-mb-primary to-mb-secondary font-heading text-[16px] font-semibold text-white shadow-[0px_8px_24px_rgba(124,196,216,0.3)] transition-transform duration-200 active:scale-[0.99] disabled:opacity-70"
          >
            {isSaving ? "저장 중..." : "기록하기"}
          </button>
        </section>
      </main>

      <BottomNavigation />

      {isMapOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/35 px-5 py-8">
          <div className="mx-auto flex h-full w-full max-w-[375px] flex-col rounded-2xl bg-mb-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-mb-dark">지도에서 위치 선택</h3>
              <button type="button" onClick={() => setIsMapOpen(false)} className="text-mb-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-xl border border-[#AAB3B61A] bg-white">
              {mapLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-mb-muted">지도 로딩 중...</div>
              ) : null}
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>

            <p className="mt-3 text-xs text-mb-muted">
              {pendingLat !== null && pendingLng !== null
                ? `선택 좌표: ${pendingLat.toFixed(6)}, ${pendingLng.toFixed(6)}`
                : "지도에서 한 지점을 탭하세요."}
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="h-11 flex-1 rounded-full bg-[#EFF4F6] text-sm font-semibold text-mb-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="h-11 flex-1 rounded-full bg-[#7CC4D8] text-sm font-semibold text-white"
              >
                위치 선택 완료
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

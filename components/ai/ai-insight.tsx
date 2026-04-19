"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Character } from "@/components/ai/character"
import {
  getLatestPendingIntervention,
  markInterventionAsShown,
  type Intervention,
} from "@/lib/services/intervention"
import { getRecentMemories } from "@/lib/services/memory"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type BgScheme = { gradient: string; glow: string; border: string }

const EMOTION_BG: Record<number, BgScheme> = {
  1: { gradient: "linear-gradient(to bottom right, rgba(255,232,184,0.20), rgba(192,236,216,0.10), rgba(255,255,255,1))", glow: "rgba(255,232,184,0.50)", border: "rgba(255,232,184,0.25)" }, // good
  2: { gradient: "linear-gradient(to bottom right, rgba(248,200,200,0.20), rgba(248,200,200,0.10), rgba(255,255,255,1))", glow: "rgba(248,200,200,0.50)", border: "rgba(248,200,200,0.25)" }, // bad
  3: { gradient: "linear-gradient(to bottom right, rgba(176,228,248,0.20), rgba(176,228,248,0.10), rgba(255,255,255,1))", glow: "rgba(176,228,248,0.50)", border: "rgba(176,228,248,0.25)" }, // sad
  4: { gradient: "linear-gradient(to bottom right, rgba(255,232,184,0.20), rgba(192,236,216,0.12), rgba(255,255,255,1))", glow: "rgba(192,236,216,0.50)", border: "rgba(192,236,216,0.25)" }, // calm
}

const DEFAULT_BG: BgScheme = { gradient: "linear-gradient(to bottom right, rgba(180,200,230,0.14), rgba(180,200,230,0.07), rgba(255,255,255,1))", glow: "rgba(180,200,230,0.28)", border: "rgba(180,200,230,0.18)" }

const BUBBLES = [
  { left: "30%", delay: 0,   duration: 3.0 },
  { left: "55%", delay: 1.4, duration: 3.5 },
  { left: "68%", delay: 2.6, duration: 2.8 },
]

const EMOTION_BUBBLE_COLOR: Record<number, string> = {
  1: "#C4956A",
  2: "#C48B8B",
  3: "#6BAAC4",
  4: "#97B48B",
}
const DEFAULT_BUBBLE_COLOR = "#B8CADC"

function FloatingBubbles({ color }: { color: string }) {
  return (
    <>
      {BUBBLES.map((b, i) => (
        <motion.span
          key={i}
          className="absolute bottom-[30%] text-2xl font-black pointer-events-none select-none"
          style={{ left: b.left, color }}
          animate={{ y: [0, -28, -52], opacity: [0, 0.6, 0] }}
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" }}
        >
          !
        </motion.span>
      ))}
    </>
  )
}

export function AIInsight() {
  const [showMessage, setShowMessage] = useState(false)
  const [intervention, setIntervention] = useState<Intervention | null>(null)
  const [latestEmotionId, setLatestEmotionId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 초기 로드
  useEffect(() => {
    getLatestPendingIntervention().then((data) => {
      if (data) {
        setIntervention(data)
        markInterventionAsShown(data.id)
      }
    })

    getRecentMemories(1)
      .then((memories) => {
        setLatestEmotionId(memories[0]?.emotion_id ?? null)
      })
      .catch(() => {
        setLatestEmotionId(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Realtime 구독 — 새 intervention INSERT 시 표시
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel("interventions-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "interventions" },
        (payload) => {
          const newItem = payload.new as Intervention
          setIntervention(newItem)
          markInterventionAsShown(newItem.id)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const bg = (isLoading || latestEmotionId == null || !EMOTION_BG[latestEmotionId]) ? DEFAULT_BG : EMOTION_BG[latestEmotionId]

  const handleCardClick = () => {
    if (!intervention) return
    if (showMessage) {
      setShowMessage(false)
      setTimeout(() => setIntervention(null), 600)
    } else {
      setShowMessage(true)
    }
  }

  return (
    <section className="pt-8">
      <div
        className="relative"
        style={{ perspective: "1000px" }}
        onClick={handleCardClick}
      >
        <motion.div
          className="relative w-full"
          animate={{ rotateY: showMessage ? 180 : 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* 앞면 — 캐릭터 */}
          <div
            className="relative overflow-hidden rounded-xl p-5 border transition-colors duration-700"
            style={{ background: bg.gradient, borderColor: bg.border, backfaceVisibility: "hidden" }}
          >
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-colors duration-700"
              style={{ background: bg.glow }}
            />
            <div className="relative flex items-center justify-center h-[120px]">
              {!!intervention && (
                <FloatingBubbles
                  color={latestEmotionId != null ? (EMOTION_BUBBLE_COLOR[latestEmotionId] ?? DEFAULT_BUBBLE_COLOR) : DEFAULT_BUBBLE_COLOR}
                />
              )}
              <Character emotionId={latestEmotionId} hasMessage={!!intervention} isThinking={isLoading} />
            </div>
          </div>

          {/* 뒷면 — 메시지 */}
          <div
            className="absolute inset-0 overflow-hidden rounded-xl p-5 border flex items-center justify-center transition-colors duration-700"
            style={{ background: bg.gradient, borderColor: bg.border, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl"
              style={{ background: bg.glow }}
            />
            <p className="relative font-body text-sm text-mb-dark leading-relaxed text-center">
              {intervention?.message}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Character } from "@/components/ai/character"
import {
  getLatestPendingIntervention,
  markInterventionAsShown,
  markInterventionAsInteracted,
  submitFeedback,
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

type FeedbackVariant = {
  prompt: string
  positive: string
  negative: string
}

const FEEDBACK_VARIANTS: Record<string, [FeedbackVariant, FeedbackVariant]> = {
  empathy: [
    { prompt: "이렇게 느껴졌을 수도 있겠다 싶었어.", positive: "비슷한 것 같아", negative: "조금 달라" },
    { prompt: "나는 이렇게 이해했는데… 맞을까는 모르겠네.", positive: "맞는 편이야", negative: "다른 느낌이야" },
  ],
  encouragement: [
    { prompt: "조금 힘이 됐으면 좋겠다고 생각했어.", positive: "도움 됐어", negative: "잘 모르겠어" },
    { prompt: "이런 말이 괜찮은 타이밍이었을까 싶긴 해.", positive: "괜찮았어", negative: "지금은 아닌 것 같아" },
  ],
  checkin: [
    { prompt: "그냥 가볍게 한 번 말 걸어봤어.", positive: "괜찮았어", negative: "조금 뜬금없었어" },
    { prompt: "이 정도로 인사하는 건 괜찮은지 궁금하네.", positive: "이 정도 좋아", negative: "조금 줄여도 될 것 같아" },
  ],
}

const FEEDBACK_RESPONSES: Record<string, { positive: string; negative: string }> = {
  empathy:       { positive: "응, 비슷하게 느꼈다면 다행이다.", negative: "아, 내가 조금 다르게 이해했나 보다." },
  encouragement: { positive: "조금이라도 괜찮았으면 좋겠네.", negative: "지금은 그런 말이 아닐 수도 있겠다." },
  checkin:       { positive: "가볍게 남긴 건데 괜찮았다니 다행이다.", negative: "조금 뜬금없었을 수도 있겠다." },
}

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
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const [feedbackResponse, setFeedbackResponse] = useState<string | null>(null)

  // 초기 로드
  useEffect(() => {
getLatestPendingIntervention().then((data) => {
      if (data) setIntervention(data)
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
          setIntervention(payload.new as Intervention)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const bg = (isLoading || latestEmotionId == null || !EMOTION_BG[latestEmotionId]) ? DEFAULT_BG : EMOTION_BG[latestEmotionId]

  const variantIdx = intervention ? parseInt(intervention.id.slice(-1), 16) % 2 : 0

  const handleCardClick = () => {
    if (!intervention) return
    if (showMessage) {
      setShowMessage(false)
      setTimeout(() => {
        setIntervention(null)
        setFeedbackGiven(false)
        setFeedbackResponse(null)
      }, 600)
    } else {
      setShowMessage(true)
      markInterventionAsShown(intervention.id)
    }
  }

  const handleFeedback = (e: React.MouseEvent, score: 2 | -2) => {
    e.stopPropagation()
    if (!intervention) return
    submitFeedback(intervention.id, score)
    markInterventionAsInteracted(intervention.id)
    const type = intervention.message_type ?? "checkin"
    const responses = FEEDBACK_RESPONSES[type] ?? FEEDBACK_RESPONSES.checkin
    setFeedbackResponse(score === 2 ? responses.positive : responses.negative)
    setFeedbackGiven(true)
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
            className="absolute inset-0 overflow-hidden rounded-xl p-5 border flex flex-col items-center justify-center gap-4 transition-colors duration-700"
            style={{ background: bg.gradient, borderColor: bg.border, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl"
              style={{ background: bg.glow }}
            />
            <p className="relative font-body text-sm text-mb-dark leading-relaxed text-center">
              {feedbackGiven ? feedbackResponse : intervention?.message}
            </p>
            {!feedbackGiven && intervention?.message_type && (() => {
              const variants = FEEDBACK_VARIANTS[intervention.message_type]
              const variant = variants?.[variantIdx] ?? variants?.[0]
              if (!variant) return null
              return (
                <div className="relative flex flex-col items-center gap-2 w-full">
                  <p className="font-body text-xs text-mb-dark/50 text-center">{variant.prompt}</p>
                  <div className="flex gap-3">
                    <button
                      className="px-3 py-1 rounded-full text-xs font-body border transition-colors"
                      style={{ borderColor: bg.border, color: "var(--color-mb-dark)" }}
                      onClick={(e) => handleFeedback(e, 2)}
                    >
                      {variant.positive}
                    </button>
                    <button
                      className="px-3 py-1 rounded-full text-xs font-body border transition-colors"
                      style={{ borderColor: bg.border, color: "var(--color-mb-dark)" }}
                      onClick={(e) => handleFeedback(e, -2)}
                    >
                      {variant.negative}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

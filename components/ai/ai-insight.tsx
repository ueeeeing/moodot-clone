"use client"

import { useEffect, useState } from "react"
import { Character } from "@/components/ai/character"
import {
  getLatestPendingIntervention,
  markInterventionAsShown,
  type Intervention,
} from "@/lib/services/intervention"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export function AIInsight() {
  const [intervention, setIntervention] = useState<Intervention | null>(null)

  // 초기 로드
  useEffect(() => {
    getLatestPendingIntervention().then((data) => {
      if (data) {
        setIntervention(data)
        markInterventionAsShown(data.id)
      }
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

  return (
    <section className="pt-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-mb-accent/20 via-mb-accent-mint/12 to-mb-card p-5 border border-mb-accent-mint/25">
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-b from-mb-accent/50 via-mb-accent-mint/35 to-mb-accent-cyan/30 rounded-full blur-2xl" />

        <div className="relative flex items-center justify-center h-[120px]">
          <Character />
        </div>

        {intervention && (
          <p className="relative mt-3 font-body text-sm text-mb-dark leading-relaxed">
            {intervention.message}
          </p>
        )}
      </div>
    </section>
  )
}

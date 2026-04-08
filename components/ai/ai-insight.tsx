import { Character } from "@/components/ai/character"

export function AIInsight() {
  return (
    <section className="pt-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-mb-accent/20 via-mb-accent-mint/12 to-mb-card p-5 border border-mb-accent-mint/25">
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-b from-mb-accent/50 via-mb-accent-mint/35 to-mb-accent-cyan/30 rounded-full blur-2xl" />

        <div className="relative flex items-center justify-center h-[120px]">
          <Character />
        </div>
      </div>
    </section>
  )
}

import { Sparkles } from "lucide-react"

export function AIInsight() {
  return (
    <section className="pt-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-mb-accent/20 via-mb-accent-mint/12 to-mb-card p-5 border border-mb-accent-mint/25">
        {/* Decorative gradient orb matching logo sphere */}
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-b from-mb-accent/50 via-mb-accent-mint/35 to-mb-accent-cyan/30 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-mb-accent/30 via-mb-accent-mint/20 to-mb-accent-cyan/25">
              <Sparkles className="w-4 h-4 text-mb-sparkle" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-mb-primary">
              AI Insight
            </h3>
          </div>
          
          <p className="font-body text-sm text-mb-dark leading-relaxed">
            최근 기록을 분석해 보니, 명상 후에 더 안정된 기분을 느끼고 계시네요.
            긍정적인 흐름을 유지하기 위해 짧은 아침 명상을 추천드려요.
          </p>
        </div>
      </div>
    </section>
  )
}

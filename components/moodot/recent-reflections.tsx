import { Button } from "@/components/ui/button"

interface ReflectionCardProps {
  dotColor: string
  label: string
  text: string
  variant: "primary" | "secondary"
}

function ReflectionCard({ dotColor, label, text, variant }: ReflectionCardProps) {
  const isPrimary = variant === "primary"
  
  return (
    <div
      className={
        isPrimary
          ? "bg-mb-card rounded-xl p-4 shadow-sm shadow-mb-dark/5"
          : "bg-white/60 rounded-xl p-4 border border-mb-unselected"
      }
    >
      <div className="flex items-center mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-[10px] uppercase tracking-wider text-mb-muted font-body font-medium">
            {label}
          </span>
        </div>
      </div>
      <p
        className={`font-body text-sm leading-relaxed ${
          isPrimary ? "text-mb-dark" : "text-mb-muted"
        }`}
      >
        {text}
      </p>
    </div>
  )
}

export function RecentReflections() {
  return (
    <section className="pt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-base text-mb-dark">
          최근 기록
        </h3>
        <Button
          variant="ghost"
          className="h-auto p-0 text-xs text-mb-primary hover:text-mb-primary-dark hover:bg-transparent font-body font-medium"
        >
          전체보기
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <ReflectionCard
          dotColor="#7CC4D8"
          label="어제 저녁"
          text="저녁 명상이 긴 회의 후 마음을 비우는 데 도움이 됐어요. 마음이 차분해졌어요."
          variant="primary"
        />
        <ReflectionCard
          dotColor="#D0C8F0"
          label="이틀 전"
          text="조용한 아침. 차를 마시며 새소리를 들었어요. 에너지가 좀 낮지만 괜찮아요."
          variant="secondary"
        />
      </div>
    </section>
  )
}

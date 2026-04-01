import { TopAppBar } from "@/components/moodot/top-app-bar"
import { WelcomeHeader } from "@/components/moodot/welcome-header"
import { JournalEntry } from "@/components/moodot/journal-entry"
import { AIInsight } from "@/components/moodot/ai-insight"
import { RecentReflections } from "@/components/moodot/recent-reflections"
import { BottomNavigation } from "@/components/moodot/bottom-navigation"

export default function MoodotHome() {
  return (
    <div className="min-h-screen bg-mb-bg relative overflow-hidden">
      {/* Decorative blurred orb matching logo gradient sphere */}
      <div 
        className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-full h-full bg-gradient-to-b from-mb-accent/50 via-mb-accent-mint/35 to-mb-accent-cyan/25 rounded-full blur-3xl transform translate-x-1/4 -translate-y-1/4" />
      </div>

      {/* Top App Bar */}
      <TopAppBar />

      {/* Main Content */}
      <main className="relative mx-auto max-w-[375px] px-5 pt-20 pb-32">
        <WelcomeHeader />
        <JournalEntry />
        <AIInsight />
        <RecentReflections />
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}

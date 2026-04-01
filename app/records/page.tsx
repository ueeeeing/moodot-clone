import Link from "next/link"
import { Plus } from "lucide-react"
import { MemoriesListView } from "@/components/moodot/memories-list-view"
import { TopAppBar } from "@/components/moodot/top-app-bar"
import { BottomNavigation } from "@/components/moodot/bottom-navigation"

export default function RecordsPage() {
  return (
    <div className="min-h-screen bg-mb-bg relative">
      <TopAppBar />
      <main className="relative mx-auto max-w-[375px] px-5 pt-16 pb-32">
        <MemoriesListView />
      </main>

      {/* 기록 남기기 FAB */}
      <Link
        href="/memory-create"
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-mb-primary to-mb-secondary px-5 h-12 shadow-[0px_8px_24px_rgba(124,196,216,0.35)] transition-transform duration-200 active:scale-95"
      >
        <Plus className="w-4 h-4 text-white" />
        <span className="font-body text-sm font-semibold text-white">기록 남기기</span>
      </Link>

      <BottomNavigation />
    </div>
  )
}

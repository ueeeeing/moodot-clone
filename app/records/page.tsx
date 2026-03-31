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
      <BottomNavigation />
    </div>
  )
}

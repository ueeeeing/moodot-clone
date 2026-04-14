"use client"

import { useRouter, usePathname } from "next/navigation"
import { Home, BookOpen, Layers, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { id: "home", label: "홈", icon: Home, path: "/" },
  { id: "journal", label: "기록", icon: BookOpen, path: "/records" },
  { id: "collection", label: "컬렉션", icon: Layers, path: "/collection" },
  { id: "meditation", label: "캘린더", icon: CalendarDays, path: "/calendar" },
]

export function BottomNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  const activeTab =
    pathname === "/records" ? "journal" :
    pathname === "/calendar" ? "meditation" :
    pathname.startsWith("/collection") ? "collection" :
    pathname === "/" ? "home" : ""

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-mb-bg/90 border-t border-mb-unselected/50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-[375px] px-4 py-3">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.path) router.push(item.path)
                }}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-mb-primary focus-visible:ring-offset-2",
                  isActive
                    ? "bg-gradient-to-b from-mb-accent/20 via-mb-accent-mint/15 to-mb-accent-cyan/25"
                    : "bg-transparent hover:bg-mb-unselected/60"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    isActive ? "text-mb-primary" : "text-mb-muted/70"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-body transition-all duration-200",
                    isActive
                      ? "text-mb-primary font-semibold"
                      : "text-mb-muted/70 font-medium"
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

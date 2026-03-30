"use client"

import Image from "next/image"
import { Bell } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function TopAppBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl bg-mb-bg/80 border-b border-mb-unselected/50">
      <div className="mx-auto max-w-[375px] h-full px-5 flex items-center justify-between">
        {/* User Avatar */}
        <Avatar className="h-10 w-10 ring-2 ring-mb-accent-mint/40">
          <AvatarImage src="/avatar-placeholder.jpg" alt="User avatar" />
          <AvatarFallback className="bg-gradient-to-b from-mb-accent via-mb-accent-mint to-mb-accent-cyan text-mb-dark font-heading font-semibold text-sm">
            S
          </AvatarFallback>
        </Avatar>

        {/* App Logo */}
        <div className="flex items-center gap-1.5">
          <Image
            src="/images/moodot-logo.png"
            alt="Moodot"
            width={100}
            height={40}
            className="h-20 w-auto translate-y-1.5"
            priority
          />
        </div>

        {/* Notification Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-mb-card/80 hover:bg-mb-unselected text-mb-muted"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  )
}

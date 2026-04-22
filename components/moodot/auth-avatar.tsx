"use client"

import { UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { subscribeToAuth } from "@/lib/supabase/auth"
import type { User } from "@supabase/supabase-js"

export function AuthAvatar() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    return subscribeToAuth(setUser)
  }, [])

  if (user === undefined) {
    return (
      <div className="h-10 w-10 rounded-full bg-mb-card/50 ring-2 ring-mb-accent-mint/40" />
    )
  }

  if (user === null || user.is_anonymous) {
    return (
      <button
        type="button"
        onClick={() => router.push("/login")}
        aria-label="계정"
        className="h-10 w-10 rounded-full ring-2 ring-mb-unselected/60 bg-mb-card flex items-center justify-center hover:ring-mb-accent-mint/60 hover:bg-mb-unselected/50 transition-all duration-200"
      >
        <UserRound className="h-5 w-5 text-mb-muted" />
      </button>
    )
  }

  const initial = (user.email ?? user.user_metadata?.name ?? "?")
    .charAt(0)
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={() => router.push("/profile")}
      aria-label="프로필 및 설정"
      className="rounded-full ring-2 ring-mb-accent-mint/40 hover:opacity-80 transition-opacity duration-200"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.user_metadata?.avatar_url ?? ""} alt={initial} />
        <AvatarFallback className="bg-gradient-to-b from-mb-accent via-mb-accent-mint to-mb-accent-cyan text-mb-dark font-heading font-semibold text-sm">
          {initial}
        </AvatarFallback>
      </Avatar>
    </button>
  )
}

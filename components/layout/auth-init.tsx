"use client"

import { useEffect } from "react"
import { getCurrentUser, signInAnonymously } from "@/lib/supabase/auth"

export function AuthInit() {
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) void signInAnonymously()
    })
  }, [])

  return null
}

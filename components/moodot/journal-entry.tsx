"use client"

import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"

export function JournalEntry() {
  return (
    <section className="pt-8">
      <Button
        className="w-full h-14 rounded-full bg-gradient-to-r from-mb-primary to-mb-secondary hover:opacity-90 text-white font-heading font-semibold text-base shadow-lg shadow-mb-primary/40 transition-all duration-200"
      >
        기록 저장하기
        <Send className="ml-2 h-4 w-4" />
      </Button>
    </section>
  )
}

"use client"

import { useState } from "react"
import { Smile, Frown, CloudRain, Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

const moods = [
  { 
    id: "good", 
    label: "Good", 
    icon: Smile,
    selectedBg: "#FFE8B8",
    selectedShadow: "shadow-[0_4px_16px_rgba(255,232,184,0.7)]",
    unselectedBg: "#FFFBF5",
  },
  { 
    id: "bad", 
    label: "Bad", 
    icon: Frown,
    selectedBg: "#F8C8C8",
    selectedShadow: "shadow-[0_4px_16px_rgba(248,200,200,0.55)]",
    unselectedBg: "#FEF8F8",
  },
  { 
    id: "sad", 
    label: "Sad", 
    icon: CloudRain,
    selectedBg: "#B0E4F8",
    selectedShadow: "shadow-[0_4px_16px_rgba(176,228,248,0.65)]",
    unselectedBg: "#F5FAFD",
  },
  { 
    id: "calm", 
    label: "Calm", 
    icon: Leaf,
    selectedBg: "#C0ECD8",
    selectedShadow: "shadow-[0_4px_16px_rgba(192,236,216,0.6)]",
    unselectedBg: "#F5FCF8",
  },
]

export function MoodSelector() {
  const [selectedMood, setSelectedMood] = useState("good")

  return (
    <section className="pt-6">
      <div className="flex items-center justify-between gap-3">
        {moods.map((mood) => {
          const Icon = mood.icon
          const isSelected = selectedMood === mood.id

          return (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              aria-label={mood.label}
              className={cn(
                "flex flex-col items-center transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-mb-primary focus-visible:ring-offset-2 rounded-2xl"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-200",
                  isSelected ? mood.selectedShadow : ""
                )}
                style={{
                  backgroundColor: isSelected ? mood.selectedBg : mood.unselectedBg,
                }}
              >
                <Icon
                  className="w-7 h-7 transition-colors duration-200"
                  style={{
                    color: isSelected ? "#374151" : "#9CA3AF",
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

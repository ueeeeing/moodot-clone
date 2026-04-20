"use client"

import { Download } from "lucide-react"
import { memoriesToMarkdown, memoriesToFilename } from "@/lib/export/memories-to-markdown"
import type { MemoryRow } from "@/lib/services/memory"

interface MemoriesExportButtonProps {
  memories: MemoryRow[]
  disabled?: boolean
}

export function MemoriesExportButton({ memories, disabled }: MemoriesExportButtonProps) {
  const handleDownload = () => {
    if (memories.length === 0) return
    const md = memoriesToMarkdown(memories)
    const filename = memoriesToFilename()
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled || memories.length === 0}
      title="현재 목록 Markdown으로 내보내기"
      className="flex items-center justify-center h-14 w-14 rounded-xl bg-mb-card text-mb-muted transition-colors duration-150 hover:bg-mb-unselected hover:text-mb-primary disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download className="w-5 h-5" />
      <span className="sr-only">기록 내보내기</span>
    </button>
  )
}

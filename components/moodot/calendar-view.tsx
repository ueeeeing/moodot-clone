"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Smile, Frown, CloudRain, Leaf, Flame, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type MoodType = "good" | "bad" | "sad" | "calm"

interface MoodRecord {
  date: string // YYYY-MM-DD
  mood: MoodType
  note?: string
}

// 샘플 데이터 - 실제 연동 시 props나 API로 교체
const sampleRecords: MoodRecord[] = [
  { date: "2026-03-01", mood: "good", note: "좋은 하루였어요." },
  { date: "2026-03-05", mood: "calm", note: "조용한 하루." },
  { date: "2026-03-10", mood: "bad", note: "힘든 하루였어요." },
  { date: "2026-03-15", mood: "sad", note: "조금 우울했어요." },
  { date: "2026-03-20", mood: "good", note: "즐거운 하루!" },
  { date: "2026-03-25", mood: "calm", note: "명상 후 편안해졌어요." },
  { date: "2026-03-28", mood: "good", note: "친구들과 즐거운 시간." },
  { date: "2026-03-29", mood: "sad", note: "조금 지쳤지만 기록은 이어갔어요." },
  { date: "2026-03-30", mood: "good", note: "컨디션이 다시 좋아졌어요." },
  { date: "2026-03-31", mood: "good", note: "마무리가 만족스러운 하루." },
]

const moodConfig: Record<MoodType, { color: string; iconColor: string; icon: LucideIcon; label: string }> = {
  good:  { color: "bg-[#FFE8B8]", iconColor: "#374151", icon: Smile,    label: "Good" },
  bad:   { color: "bg-[#F8C8C8]", iconColor: "#374151", icon: Frown,    label: "Bad"  },
  sad:   { color: "bg-[#B0E4F8]", iconColor: "#374151", icon: CloudRain, label: "Sad" },
  calm:  { color: "bg-[#C0ECD8]", iconColor: "#374151", icon: Leaf,     label: "Calm" },
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]

const DAY_IN_MS = 24 * 60 * 60 * 1000

const parseDate = (dateStr: string) => new Date(`${dateStr}T12:00:00`)

function getStreakStats(records: MoodRecord[], today: Date) {
  const uniqueDates = [...new Set(records.map((record) => record.date))].sort()

  if (uniqueDates.length === 0) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let running = 1

  for (let i = 1; i < uniqueDates.length; i += 1) {
    const diff = parseDate(uniqueDates[i]).getTime() - parseDate(uniqueDates[i - 1]).getTime()

    if (diff === DAY_IN_MS) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 1
    }
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  let current = 0

  if (uniqueDates.includes(todayKey)) {
    current = 1

    for (let i = uniqueDates.length - 1; i > 0; i -= 1) {
      const diff = parseDate(uniqueDates[i]).getTime() - parseDate(uniqueDates[i - 1]).getTime()

      if (diff === DAY_IN_MS) {
        current += 1
      } else {
        break
      }
    }
  }

  return { current, longest }
}

export function CalendarView() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate()

  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay()

  const formatDate = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  const getMoodForDate = (dateStr: string) =>
    sampleRecords.find((r) => r.date === dateStr)

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth((m) => m - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth((m) => m + 1)
    }
    setSelectedDate(null)
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const selectedRecord = selectedDate ? getMoodForDate(selectedDate) : null
  const monthlyRecords = sampleRecords.filter((record) => {
    const recordDate = parseDate(record.date)

    return (
      recordDate.getFullYear() === currentYear &&
      recordDate.getMonth() === currentMonth
    )
  })
  const monthRecordDays = new Set(monthlyRecords.map((record) => record.date)).size
  const streakStats = getStreakStats(sampleRecords, today)

  return (
    <section className="pt-6">
      <div className="mb-4 space-y-2">
        <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm shadow-mb-dark/5">
          <p className="text-[11px] font-semibold tracking-[0.01em] text-mb-muted">이번 달 기록</p>
          <p className="mt-1 text-sm font-medium text-mb-dark">
            {monthRecordDays > 0
              ? `이번 달 ${monthRecordDays}일 기록`
              : "아직 이번 달 기록이 없어요"}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#FFF9EF] px-4 py-3 shadow-sm shadow-mb-dark/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white flex-shrink-0">
              <Flame className="h-4 w-4 text-[#E6A23C]" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.01em] text-mb-muted">연속 기록</p>
              <p className="truncate text-sm font-medium text-mb-dark">
                {streakStats.current > 0
                  ? `${streakStats.current}일 연속 기록 중 🔥`
                  : streakStats.longest > 0
                  ? `최고 ${streakStats.longest}일 기록`
                  : "첫 기록을 시작해보세요"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-mb-unselected hover:bg-mb-accent-mint/40"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4 text-mb-dark" />
        </Button>

        <h2 className="font-heading font-semibold text-mb-dark text-lg">
          {currentYear}년 {currentMonth + 1}월
        </h2>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-mb-unselected hover:bg-mb-accent-mint/40"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4 text-mb-dark" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-mb-muted py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="bg-white rounded-2xl shadow-sm shadow-mb-dark/5 p-3">
        <div className="grid grid-cols-7 gap-1">
          {/* 빈 칸 */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* 날짜 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDate(currentYear, currentMonth, day)
            const record = getMoodForDate(dateStr)
            const isToday =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear()
            const isSelected = selectedDate === dateStr

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`
                  relative flex flex-col items-center justify-center
                  h-10 w-full rounded-xl text-xs font-medium transition-all
                  ${isSelected
                    ? "bg-mb-primary text-white shadow-md shadow-mb-primary/30"
                    : isToday
                    ? "ring-2 ring-mb-primary text-mb-primary"
                    : "text-mb-dark hover:bg-mb-unselected"
                  }
                `}
              >
                <span>{day}</span>
                {record && !isSelected && (
                  <span
                    className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center ${moodConfig[record.mood].color}`}
                  >
                    {(() => { const Icon = moodConfig[record.mood].icon; return <Icon className="h-3 w-3" style={{ color: moodConfig[record.mood].iconColor }} /> })()}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 무드 범례 */}
      <div className="flex justify-center gap-4 mt-4">
        {Object.entries(moodConfig).map(([key, val]) => {
          const Icon = val.icon
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-6 w-6 rounded-lg flex items-center justify-center ${val.color}`}>
                <Icon className="h-3.5 w-3.5" style={{ color: val.iconColor }} />
              </span>
              <span className="text-xs text-mb-muted">{val.label}</span>
            </div>
          )
        })}
      </div>

      {/* 선택된 날짜 기록 */}
      {selectedDate && (
        <div className="mt-4 bg-white rounded-2xl shadow-sm shadow-mb-dark/5 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-sm font-semibold text-mb-dark mb-2">
            {selectedDate.replace(/-/g, ".")}
          </p>
          {selectedRecord ? (
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = moodConfig[selectedRecord.mood].icon
                return (
                  <span
                    className={`
                      h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${moodConfig[selectedRecord.mood].color}
                    `}
                  >
                    <Icon className="h-5 w-5" style={{ color: moodConfig[selectedRecord.mood].iconColor }} />
                  </span>
                )
              })()}
              <div>
                <p className="text-xs font-semibold text-mb-dark">
                  {moodConfig[selectedRecord.mood].label}
                </p>
                {selectedRecord.note && (
                  <p className="text-xs text-mb-muted mt-1">{selectedRecord.note}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-mb-muted">이 날의 기록이 없어요.</p>
          )}
        </div>
      )}
    </section>
  )
}

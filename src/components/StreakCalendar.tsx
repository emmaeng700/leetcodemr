'use client'
import { useMemo, useRef, useState, useEffect } from 'react'

function getWeeks(log: Record<string, number>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - (51 * 7 + today.getDay()))

  const weeks: { key: string; count: number; date: Date }[][] = []
  const d = new Date(start)
  while (d <= today) {
    const week: { key: string; count: number; date: Date }[] = []
    for (let i = 0; i < 7; i++) {
      const key = d.toISOString().split('T')[0]
      const future = d > today
      week.push({ key, count: future ? -1 : (log[key] || 0), date: new Date(d) })
      d.setDate(d.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_COL = 18  // px reserved for day labels (Mo/We/Fr)
const GAP = 2       // px gap between cells

interface StreakCalendarProps {
  log?: Record<string, number>
  target?: number
}

export default function StreakCalendar({ log = {}, target = 0 }: StreakCalendarProps) {
  const weeks = useMemo(() => getWeeks(log), [log])
  const maxCount = useMemo(() => Math.max(1, ...Object.values(log).filter(v => v > 0)), [log])

  // Measure container width and compute cell size that fills it exactly
  const containerRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(12)

  useEffect(() => {
    function recalc() {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth - DAY_COL - weeks.length * GAP
      const size = Math.max(4, Math.min(14, Math.floor(available / weeks.length)))
      setCell(size)
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [weeks.length])

  const colWidth = cell + GAP

  function cellColor(count: number) {
    if (count < 0) return 'bg-gray-50'
    if (count === 0) return 'bg-gray-100'
    if (target > 0) {
      if (count >= target) return 'bg-green-500'
      if (count >= target - 1) return 'bg-yellow-400'
      return 'bg-red-400'
    }
    const intensity = Math.min(count / Math.max(maxCount, 1), 1)
    if (intensity < 0.35) return 'bg-green-300'
    if (intensity < 0.6) return 'bg-green-500'
    if (intensity < 0.85) return 'bg-green-600'
    return 'bg-green-700'
  }

  const monthLabels: { wi: number; label: string }[] = []
  weeks.forEach((week, wi) => {
    const firstDay = week.find(d => d.count >= 0)
    if (firstDay) {
      const m = firstDay.date.getMonth()
      const prev = wi > 0 ? weeks[wi - 1].find(d => d.count >= 0) : null
      if (!prev || prev.date.getMonth() !== m) {
        const lastLabel = monthLabels[monthLabels.length - 1]
        if (!lastLabel || wi - lastLabel.wi >= 3) {
          monthLabels.push({ wi, label: MONTHS[m] })
        }
      }
    }
  })

  const totalActive = Object.values(log).filter(v => v >= 1).length

  return (
    <div ref={containerRef} className="w-full">
      {/* Month labels */}
      <div className="relative mb-1" style={{ height: '14px', paddingLeft: `${DAY_COL}px` }}>
        {monthLabels.map(({ wi, label }) => (
          <span
            key={wi}
            className="absolute text-gray-400 select-none"
            style={{ left: `${DAY_COL + wi * colWidth}px`, fontSize: '9px', lineHeight: '14px', whiteSpace: 'nowrap' }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex" style={{ gap: `${GAP}px` }}>
        {/* Day labels */}
        <div className="flex flex-col text-gray-300 shrink-0" style={{ width: `${DAY_COL}px`, gap: `${GAP}px` }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-center" style={{ height: `${cell}px`, lineHeight: `${cell}px`, fontSize: '8px' }}>
              {['Mo','We','Fr'].includes(d) ? d : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: `${GAP}px` }}>
            {week.map(day => (
              <div
                key={day.key}
                title={day.count < 0 ? '' : day.count === 0 ? `${day.date.toDateString()} — nothing solved` : `${day.date.toDateString()} — ${day.count} solved`}
                className={`rounded-sm ${cellColor(day.count)}`}
                style={{ width: `${cell}px`, height: `${cell}px`, flexShrink: 0 }}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {totalActive} active day{totalActive !== 1 ? 's' : ''}
        {target === 0 && ' · darker green = more questions solved'}
      </p>
    </div>
  )
}

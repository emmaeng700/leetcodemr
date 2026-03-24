'use client'
import { useMemo } from 'react'

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

interface StreakCalendarProps {
  log?: Record<string, number>
  target?: number
}

export default function StreakCalendar({ log = {}, target = 0 }: StreakCalendarProps) {
  const weeks = useMemo(() => getWeeks(log), [log])
  const maxCount = useMemo(() => Math.max(1, ...Object.values(log).filter(v => v > 0)), [log])

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
  const CELL = 12, GAP = 2, DAY_COL = 20
  const colWidth = CELL + GAP

  return (
    <div>
      <div className="relative">
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
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1 text-xs text-gray-300" style={{ width: '16px' }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center" style={{ height: '12px', lineHeight: '12px', fontSize: '9px' }}>
                {['Mo','We','Fr'].includes(d) ? d : ''}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map(day => (
                <div
                  key={day.key}
                  title={day.count < 0 ? '' : day.count === 0 ? `${day.date.toDateString()} — nothing solved` : `${day.date.toDateString()} — ${day.count} solved`}
                  className={`rounded-sm ${cellColor(day.count)}`}
                  style={{ width: '12px', height: '12px' }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {totalActive} active day{totalActive !== 1 ? 's' : ''}
        {target === 0 && ' · darker green = more questions solved that day'}
      </p>
    </div>
  )
}

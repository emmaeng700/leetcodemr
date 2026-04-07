'use client'
import { useState, useMemo } from 'react'
import { Calculator } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function todayStr() { return new Date().toISOString().split('T')[0] }
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d
}
function formatDate(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
function weekLabel(d: Date) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return `${days[d.getDay()]} ${formatDate(d)}`
}

export default function StudyPaceCalculator({ total = 0, solved = 0, planStartDate = '', planPerDay: planPD = 0 }: { total?: number; solved?: number; planStartDate?: string; planPerDay?: number }) {
  const remaining = Math.max(0, total - solved)
  const [perDay, setPerDay] = useState(5)
  const [startDate, setStartDate] = useState(todayStr)

  const calc = useMemo(() => {
    const n = Math.max(1, perDay)
    const daysNeeded = Math.ceil(remaining / n)
    const endDate = addDays(startDate, daysNeeded)
    const perWeek = n * 7
    const perMonth = n * 30
    const weeksNeeded = Math.ceil(remaining / perWeek)
    const monthsNeeded = remaining / perMonth

    const milestones: { label: string; date: Date; cumulative: number; pct: number; done: boolean }[] = []
    const start = new Date(startDate + 'T12:00:00')

    for (let w = 1; w <= Math.min(weeksNeeded, 8); w++) {
      const doneByWeek = Math.min(w * perWeek, remaining)
      const d = new Date(start)
      d.setDate(d.getDate() + w * 7)
      milestones.push({ label: `Week ${w}`, date: d, cumulative: doneByWeek, pct: Math.round((doneByWeek / remaining) * 100), done: doneByWeek >= remaining })
      if (doneByWeek >= remaining) break
    }

    if (weeksNeeded > 8) {
      const startMonth = start.getMonth()
      const startYear = start.getFullYear()
      for (let m = 1; m <= Math.ceil(monthsNeeded) + 1; m++) {
        const doneByMonth = Math.min(m * perMonth, remaining)
        const d = new Date(startYear, startMonth + m, 1)
        if (m * 30 > 56) {
          milestones.push({ label: `Month ${m} — ${MONTHS[(startMonth + m) % 12]} ${startYear + Math.floor((startMonth + m) / 12)}`, date: d, cumulative: doneByMonth, pct: Math.round((doneByMonth / remaining) * 100), done: doneByMonth >= remaining })
        }
        if (doneByMonth >= remaining) break
      }
      milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
    }

    return { daysNeeded, endDate, perWeek, perMonth, weeksNeeded, monthsNeeded, milestones }
  }, [perDay, startDate, remaining])

  if (remaining === 0) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <h2 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-2"><Calculator size={15} /> Study Pace Calculator</h2>
      <p className="text-sm text-green-600 font-semibold">🎉 You&apos;ve solved all questions!</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <h2 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2"><Calculator size={15} /> Study Pace Calculator</h2>
      <div className="flex flex-wrap gap-4 mb-5">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Questions per day</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setPerDay(p => Math.max(1, p - 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors flex items-center justify-center text-lg">−</button>
            <input type="number" min={1} max={50} value={perDay}
              onChange={e => setPerDay(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-16 text-center text-lg font-black text-indigo-600 border border-indigo-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={() => setPerDay(p => Math.min(50, p + 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors flex items-center justify-center text-lg">+</button>
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value || todayStr())}
            className="text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { label: 'remaining', value: remaining, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'days total', value: calc.daysNeeded, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'per week', value: calc.perWeek, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
          { label: 'per month', value: calc.perMonth, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
        ].map(c => (
          <div key={c.label} className={`border rounded-xl p-3 text-center ${c.bg}`}>
            <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-4 py-3 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-indigo-500 mb-0.5">🏁 Finish date</p>
            <p className="text-lg font-black text-indigo-800">{formatDate(calc.endDate)}</p>
            <p className="text-xs text-indigo-500 mt-0.5">
              {calc.weeksNeeded} week{calc.weeksNeeded !== 1 ? 's' : ''} · {calc.monthsNeeded >= 1 ? `${calc.monthsNeeded.toFixed(1)} months` : `${Math.round(calc.monthsNeeded * 30)} days`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-500 mb-0.5">Start</p>
            <p className="text-sm font-bold text-gray-700">{weekLabel(new Date(startDate + 'T12:00:00'))}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1.5 mb-0.5">Finish</p>
            <p className="text-sm font-bold text-gray-700">{weekLabel(calc.endDate)}</p>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Milestone timeline</p>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {calc.milestones.map((m, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${m.done ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}>
              <div className="text-xs font-bold text-gray-500 shrink-0 w-20">{m.label}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={`font-semibold ${m.done ? 'text-green-700' : 'text-gray-700'}`}>{m.cumulative} done {m.done && '✓'}</span>
                  <span className="text-gray-400">{m.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.done ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
              <div className="text-xs text-gray-400 shrink-0 hidden sm:block">{formatDate(m.date)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time actual progress */}
      {planStartDate && planPD > 0 && (() => {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        const start = new Date(planStartDate + 'T12:00:00')
        const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
        const weeksElapsed = Math.floor(daysElapsed / 7)
        const perWeek = planPD * 7
        const perMonth = planPD * 30

        // Build same milestones but from plan start, using planPD
        const planRemaining = total - solved + (planPD * daysElapsed) // approx original remaining
        const actualMilestones: { label: string; date: Date; target: number; isPast: boolean }[] = []
        const weeksNeededPlan = Math.ceil(planRemaining / perWeek)

        for (let w = 1; w <= Math.min(weeksNeededPlan, 8); w++) {
          const d = new Date(start)
          d.setDate(d.getDate() + w * 7)
          const target = Math.min(w * perWeek, planRemaining)
          actualMilestones.push({ label: `Week ${w}`, date: d, target, isPast: d <= today })
          if (target >= planRemaining) break
        }
        if (weeksNeededPlan > 8) {
          const sm = start.getMonth(); const sy = start.getFullYear()
          const monthsNeeded = planRemaining / perMonth
          for (let m = 1; m <= Math.ceil(monthsNeeded) + 1; m++) {
            const d = new Date(sy, sm + m, 1)
            if (m * 30 > 56) {
              const target = Math.min(m * perMonth, planRemaining)
              actualMilestones.push({ label: `Month ${m} — ${MONTHS[(sm + m) % 12]} ${sy + Math.floor((sm + m) / 12)}`, date: d, target, isPast: d <= today })
              if (target >= planRemaining) break
            }
          }
          actualMilestones.sort((a, b) => a.date.getTime() - b.date.getTime())
        }

        const expectedNow = Math.min(daysElapsed * planPD, planRemaining)
        const actualNow = solved
        const diff = actualNow - expectedNow
        const statusColor = diff >= 0 ? 'text-green-600' : diff >= -10 ? 'text-amber-500' : 'text-red-500'
        const statusBg = diff >= 0 ? 'bg-green-50 border-green-200' : diff >= -10 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
        const statusLabel = diff >= 0 ? `${diff} ahead 🔥` : `${Math.abs(diff)} behind`

        return (
          <div className="mt-5">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">📍 Your actual progress</p>

            {/* Today summary */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 border mb-3 ${statusBg}`}>
              <div>
                <p className="text-xs font-semibold text-gray-500">Day {daysElapsed + 1} · Week {weeksElapsed + 1}</p>
                <p className="text-xs text-gray-400 mt-0.5">Expected <span className="font-bold text-gray-600">{expectedNow}</span> · Actual <span className="font-bold text-gray-800">{actualNow}</span></p>
              </div>
              <span className={`text-sm font-black ${statusColor}`}>{statusLabel}</span>
            </div>

            {/* Per-milestone actual */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {actualMilestones.map((m, i) => {
                const actualPct = Math.min(100, Math.round((actualNow / m.target) * 100))
                const onTrack = actualNow >= m.target
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${
                    onTrack ? 'bg-green-50 border-green-200' :
                    m.isPast ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="text-xs font-bold text-gray-500 shrink-0 w-20">{m.label}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className={`font-semibold ${onTrack ? 'text-green-700' : m.isPast ? 'text-amber-700' : 'text-gray-500'}`}>
                          {onTrack ? `✓ ${actualNow} / ${m.target}` : `${actualNow} / ${m.target}`}
                        </span>
                        <span className="text-gray-400">{actualPct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${onTrack ? 'bg-green-500' : m.isPast ? 'bg-amber-400' : 'bg-indigo-400'}`}
                          style={{ width: `${actualPct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0 hidden sm:block">{formatDate(m.date)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

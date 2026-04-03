'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Question {
  id: number
  title: string
  difficulty: string
  slug: string
  tags: string[]
  source: string[]
}

export default function SpeedsterPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress,  setProgress]  = useState<Record<string, any>>({})
  const [perDay,    setPerDay]    = useState(3)
  const [loading,   setLoading]  = useState(true)
  const [dayIdx,    setDayIdx]   = useState(0)

  useEffect(() => {
    async function load() {
      const [qs, plan, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
        getProgress(),
      ])
      setQuestions(qs)
      setProgress(prog)
      if (plan?.question_order?.length) {
        setPlanOrder(plan.question_order)
        setPerDay(plan.per_day || 3)
      } else {
        setPlanOrder((qs as Question[]).map(q => q.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))

  // Group into days
  const days: number[][] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push(planOrder.slice(i, i + perDay))
  }

  const totalDays = days.length
  const currentDay = days[dayIdx] ?? []

  // How many questions in this day are solved
  const daySolved = currentDay.filter(id => !!progress[String(id)]?.solved).length

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
          <Gauge size={18} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-lg leading-tight">Speedster</h1>
          <p className="text-xs text-gray-400">Practice daily questions — submissions won't mark as solved</p>
        </div>
      </div>

      {/* Day navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setDayIdx(i => Math.max(0, i - 1))}
          disabled={dayIdx === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        <div className="text-center">
          <p className="text-base font-black text-gray-800">Day {dayIdx + 1}</p>
          <p className="text-xs text-gray-400">{daySolved}/{currentDay.length} solved · {dayIdx + 1} of {totalDays} days</p>
        </div>

        <button
          onClick={() => setDayIdx(i => Math.min(totalDays - 1, i + 1))}
          disabled={dayIdx === totalDays - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: totalDays ? `${((dayIdx + 1) / totalDays) * 100}%` : '0%' }}
        />
      </div>

      {/* Day card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {currentDay.map((qid, i) => {
          const q = qMap[qid]
          if (!q) return null
          const solved = !!progress[String(qid)]?.solved
          return (
            <Link
              key={qid}
              href={`/speedster/${qid}`}
              className={`flex items-center gap-3 px-5 py-4 transition-colors group ${
                i !== 0 ? 'border-t border-gray-100' : ''
              } ${solved
                ? 'bg-green-50 hover:bg-green-100/60'
                : 'hover:bg-yellow-50/40'
              }`}
            >
              <div className="shrink-0">
                {solved
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <Circle size={18} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />
                }
              </div>
              <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
              <span className={`flex-1 text-sm font-semibold truncate ${solved ? 'text-green-700' : 'text-gray-800'}`}>
                {q.title}
              </span>
              <DifficultyBadge difficulty={q.difficulty} />
              <ChevronRight size={14} className="text-gray-300 group-hover:text-yellow-400 shrink-0 transition-colors" />
            </Link>
          )
        })}
      </div>

      {/* Day jump dots */}
      {totalDays <= 20 && (
        <div className="flex justify-center gap-1.5 mt-5 flex-wrap">
          {days.map((_, i) => (
            <button
              key={i}
              onClick={() => setDayIdx(i)}
              className={`rounded-full transition-all ${
                i === dayIdx ? 'w-3 h-3 bg-yellow-500' : 'w-2 h-2 bg-gray-200 hover:bg-yellow-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

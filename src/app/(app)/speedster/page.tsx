'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Question {
  id: number
  title: string
  difficulty: string
  slug: string
}

export default function SpeedsterPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [perDay, setPerDay] = useState(3)
  const [loading, setLoading] = useState(true)

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
        setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))

  // Group by day
  const days: number[][] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push(planOrder.slice(i, i + perDay))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center">
          <Gauge size={18} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-lg">Speedster</h1>
          <p className="text-xs text-gray-400">Learn any question in plan order — submissions won't mark as solved</p>
        </div>
      </div>

      <div className="space-y-6">
        {days.map((dayIds, dayIdx) => (
          <div key={dayIdx}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Day {dayIdx + 1}</p>
            <div className="space-y-1.5">
              {dayIds.map((qid, qi) => {
                const q = qMap[qid]
                if (!q) return null
                const solved = !!progress[String(qid)]?.solved
                const planIdx = dayIdx * perDay + qi
                return (
                  <Link
                    key={qid}
                    href={`/speedster/${qid}?idx=${planIdx}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${
                      solved
                        ? 'bg-green-50 border-green-100 hover:border-green-200'
                        : 'bg-white border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/30'
                    }`}
                  >
                    <div className="shrink-0">
                      {solved
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <Circle size={16} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />}
                    </div>
                    <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                    <span className={`flex-1 text-sm font-medium truncate ${solved ? 'text-green-700' : 'text-gray-700'}`}>
                      {q.title}
                    </span>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

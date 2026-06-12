'use client'
import { useState, useEffect } from 'react'
import { Trophy, BarChart2 } from 'lucide-react'
import { getSetProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

export default function SetStatsTab({ set }: Props) {
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<ReturnType<typeof getSetProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds) : getSet3Questions(mainIds)
      setQuestions(qs)
      setProgress(getSetProgress(set))
      setLoading(false)
    }
    load()
  }, [set])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm animate-pulse">
      Loading stats…
    </div>
  )

  const total = questions.length
  const solved = questions.filter(q => progress[String(q.id)]?.solved).length
  const starred = questions.filter(q => progress[String(q.id)]?.starred).length
  const pct = total ? Math.round((solved / total) * 100) : 0

  const byDiff = (['Easy', 'Medium', 'Hard'] as const).map(d => {
    const qs = questions.filter(q => q.difficulty === d)
    const s = qs.filter(q => progress[String(q.id)]?.solved).length
    return { d, total: qs.length, solved: s, pct: qs.length ? Math.round((s / qs.length) * 100) : 0 }
  })

  const grouped = questions.reduce<Record<string, SetQuestion[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})

  const byCat = Object.entries(grouped).map(([cat, qs]) => {
    const s = qs.filter(q => progress[String(q.id)]?.solved).length
    return { cat, total: qs.length, solved: s, pct: qs.length ? Math.round((s / qs.length) * 100) : 0 }
  }).sort((a, b) => b.pct - a.pct)

  const recentlySolved = questions
    .filter(q => progress[String(q.id)]?.solved)
    .slice(0, 10)

  const DIFF_COLOR: Record<string, string> = {
    Easy: 'bg-green-500',
    Medium: 'bg-yellow-500',
    Hard: 'bg-red-500',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Trophy size={18} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="font-black text-[var(--text)] text-base">Stats — Set {set}</h2>
          <p className="text-xs text-[var(--text-subtle)]">Your progress on Set {set} questions</p>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-4xl font-black text-[var(--text)]">{solved}</p>
            <p className="text-sm text-[var(--text-subtle)]">of {total} solved ({pct}%)</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-yellow-500">{starred}</p>
            <p className="text-xs text-[var(--text-subtle)]">starred</p>
          </div>
        </div>
        <div className="h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: pct + '%' }} />
        </div>
      </div>

      {/* By Difficulty */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-bold text-sm text-[var(--text)] mb-4 flex items-center gap-2">
          <BarChart2 size={14} /> By Difficulty
        </h3>
        <div className="space-y-3">
          {byDiff.map(({ d, total: t, solved: s, pct: p }) => (
            <div key={d}>
              <div className="flex items-center justify-between mb-1">
                <DifficultyBadge difficulty={d} />
                <span className="text-xs text-[var(--text-subtle)]">{s}/{t} ({p}%)</span>
              </div>
              <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div className={`h-full ${DIFF_COLOR[d]} rounded-full transition-all`} style={{ width: p + '%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Category */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-bold text-sm text-[var(--text)] mb-4">By Category</h3>
        <div className="space-y-2">
          {byCat.map(({ cat, total: t, solved: s, pct: p }) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[var(--text)]">{cat}</span>
                <span className="text-xs text-[var(--text-subtle)]">{s}/{t}</span>
              </div>
              <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${p === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: p + '%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recently Solved */}
      {recentlySolved.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">Solved Questions</h3>
          <div className="space-y-2">
            {recentlySolved.map(q => (
              <div key={q.id} className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                <span className="flex-1 text-sm text-[var(--text)] truncate">{q.title}</span>
                <DifficultyBadge difficulty={q.difficulty} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, CheckCircle, Circle } from 'lucide-react'
import { getSetProgress, updateSetQProgress, type SetQProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

export default function SetPatternsTab({ set }: Props) {
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<Record<string, SetQProgress>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  const grouped = questions.reduce<Record<string, SetQuestion[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})

  const sortedCategories = Object.keys(grouped).sort()

  function toggle(cat: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  function toggleSolved(qId: number) {
    const cur = progress[String(qId)]
    const updated = updateSetQProgress(set, qId, { solved: !cur?.solved })
    setProgress(prev => ({ ...prev, [String(qId)]: updated }))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm animate-pulse">
      Loading patterns…
    </div>
  )

  const learnBase = set === 2 ? '/learn2' : '/learn3'
  const totalSolved = questions.filter(q => progress[String(q.id)]?.solved).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-black text-[var(--text)] text-base">Patterns — Set {set}</h2>
        <p className="text-xs text-[var(--text-subtle)] mt-0.5">
          {totalSolved} / {questions.length} solved · {sortedCategories.length} categories
        </p>
      </div>

      <div className="space-y-3">
        {sortedCategories.map((cat, ci) => {
          const qs = grouped[cat]
          const solved = qs.filter(q => progress[String(q.id)]?.solved).length
          const pct = qs.length ? Math.round((solved / qs.length) * 100) : 0
          const isOpen = expanded.has(cat)

          const PALETTE: [string, string, string][] = [
            ['bg-blue-50', 'border-blue-200', 'bg-blue-500'],
            ['bg-pink-50', 'border-pink-200', 'bg-pink-500'],
            ['bg-cyan-50', 'border-cyan-200', 'bg-cyan-500'],
            ['bg-violet-50', 'border-violet-200', 'bg-violet-500'],
            ['bg-green-50', 'border-green-200', 'bg-green-500'],
            ['bg-orange-50', 'border-orange-200', 'bg-orange-500'],
            ['bg-indigo-50', 'border-indigo-200', 'bg-indigo-500'],
            ['bg-teal-50', 'border-teal-200', 'bg-teal-500'],
          ]
          const [bg, border, bar] = PALETTE[ci % PALETTE.length]

          return (
            <div key={cat} className={`rounded-2xl border ${border} ${bg} overflow-hidden`}>
              <button onClick={() => toggle(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-sm text-[var(--text)]">{cat}</span>
                    <span className="text-xs font-semibold text-[var(--text-subtle)] shrink-0">
                      {solved}/{qs.length} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: pct + '%' }} />
                  </div>
                </div>
                {isOpen ? <ChevronDown size={14} className="text-[var(--text-subtle)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-subtle)] shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-white/40 bg-white/50">
                  {qs.map((q, qi) => {
                    const p = progress[String(q.id)]
                    const learnIdx = questions.indexOf(q)
                    return (
                      <div key={q.id} className={`flex items-center gap-3 px-4 py-2.5 ${qi !== 0 ? 'border-t border-white/40' : ''}`}>
                        <button onClick={() => toggleSolved(q.id)} className="shrink-0">
                          {p?.solved
                            ? <CheckCircle size={16} className="text-green-500" />
                            : <Circle size={16} className="text-[var(--text-subtle)]" />}
                        </button>
                        <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                        <span className="flex-1 text-sm text-[var(--text)] truncate">{q.title}</span>
                        <DifficultyBadge difficulty={q.difficulty} />
                        <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                          className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors shrink-0">
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

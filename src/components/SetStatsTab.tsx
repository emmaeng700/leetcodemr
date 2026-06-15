'use client'
import { useState, useEffect, useCallback } from 'react'
import { Trophy, BarChart2, X, Trash2 } from 'lucide-react'
import { getSetProgress, saveSetProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'

interface Props { set: 2 | 3 }

export default function SetStatsTab({ set }: Props) {
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<ReturnType<typeof getSetProgress>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => setProgress(getSetProgress(set)), [set])

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

  const solvedQuestions = questions.filter(q => progress[String(q.id)]?.solved)

  const DIFF_COLOR: Record<string, string> = {
    Easy: 'bg-green-500',
    Medium: 'bg-yellow-500',
    Hard: 'bg-red-500',
  }

  function unmarkSolved(qId: number, title: string) {
    const all = getSetProgress(set)
    if (all[String(qId)]) {
      all[String(qId)] = {
        ...all[String(qId)],
        solved: false,
        next_review: null,
        last_reviewed: null,
      }
      saveSetProgress(set, all)
      reload()
      toast.success(`#${qId} ${title} marked unsolved`)
    }
  }

  function clearAll() {
    if (!window.confirm(`Clear all Set ${set} progress? This removes all solved marks and review dates. Your notes and stars are kept.`)) return
    const all = getSetProgress(set)
    for (const key of Object.keys(all)) {
      all[key] = { ...all[key], solved: false, next_review: null, last_reviewed: null, review_count: 0 }
    }
    saveSetProgress(set, all)
    reload()
    toast.success(`Set ${set} progress cleared`)
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

      {/* Solved Questions — with individual unsolved button */}
      {solvedQuestions.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text)]">Solved Questions</h3>
            <span className="text-xs text-[var(--text-subtle)]">{solvedQuestions.length} total</span>
          </div>
          <div className="space-y-1">
            {solvedQuestions.map(q => (
              <div key={q.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 w-12">#{q.id}</span>
                <span className="flex-1 text-sm text-[var(--text)] truncate">{q.title}</span>
                <DifficultyBadge difficulty={q.difficulty} />
                <button
                  type="button"
                  onClick={() => unmarkSolved(q.id, q.title)}
                  className="flex items-center justify-center min-w-[32px] min-h-[32px] rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                  title="Mark unsolved"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone — clear all */}
      <div className="bg-[var(--bg-card)] border border-rose-200 rounded-2xl p-5">
        <h3 className="font-bold text-sm text-rose-600 mb-1">Reset Progress</h3>
        <p className="text-xs text-[var(--text-subtle)] mb-4">Clears all solved marks and review dates for Set {set}. Stars and notes are kept.</p>
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-100 transition-colors"
        >
          <Trash2 size={14} /> Clear all Set {set} progress
        </button>
      </div>
    </div>
  )
}

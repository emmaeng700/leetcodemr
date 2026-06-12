'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Circle, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  getSetProgress, updateSetQProgress, nextReviewDate, type SetQProgress,
} from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function SetReviewPage({ set }: Props) {
  const learnBase = set === 2 ? '/learn2' : '/learn3'

  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress,  setProgress]  = useState<Record<string, SetQProgress>>({})
  const [loading,   setLoading]   = useState(true)
  const [view, setView] = useState<'due' | 'all'>('due')

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

  const today = todayISO()

  const dueQuestions = questions.filter(q => {
    const p = progress[String(q.id)]
    if (!p?.solved) return false
    if (!p.next_review) return false
    return p.next_review <= today
  })

  const allSolved = questions.filter(q => progress[String(q.id)]?.solved)

  function markReviewed(q: SetQuestion) {
    const p = progress[String(q.id)]
    const newCount = (p?.review_count ?? 0) + 1
    const updated = updateSetQProgress(set, q.id, {
      review_count: newCount,
      last_reviewed: today,
      next_review: nextReviewDate(newCount),
    })
    setProgress(prev => ({ ...prev, [String(q.id)]: updated }))
    toast.success('Reviewed! Next review: ' + nextReviewDate(newCount))
  }

  const displayed = view === 'due' ? dueQuestions : allSolved

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-2 text-[var(--text-subtle)] text-sm">
      <RefreshCw size={14} className="animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-black text-[var(--text)] text-base">
            SR Reviews — Set {set}
          </h2>
          <p className="text-xs text-[var(--text-subtle)] mt-0.5">
            {dueQuestions.length} due · {allSolved.length} solved total
          </p>
        </div>
        <div className="flex gap-1">
          {(['due', 'all'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                view === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)]'
              }`}>
              {v === 'due' ? `Due (${dueQuestions.length})` : `All (${allSolved.length})`}
            </button>
          ))}
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-subtle)] text-sm">
          <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
          {view === 'due' ? 'No reviews due — great job! 🎉' : 'No solved questions yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((q, i) => {
            const p = progress[String(q.id)]
            return (
              <div key={q.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="font-semibold text-sm text-[var(--text)] truncate">{q.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text-subtle)]">
                    <span>{q.category}</span>
                    {p?.next_review && <span>Next: <strong className="text-indigo-400">{p.next_review}</strong></span>}
                    <span>Reviews: {p?.review_count ?? 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`${learnBase}/${questions.findIndex(x => x.id === q.id)}`}
                    className="text-[11px] text-indigo-400 hover:underline">
                    Learn
                  </Link>
                  <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors">
                    <ExternalLink size={13} />
                  </a>
                  {view === 'due' && (
                    <button onClick={() => markReviewed(q)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors">
                      <CheckCircle size={11} /> Done
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

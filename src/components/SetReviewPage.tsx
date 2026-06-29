'use client'
import { useState, useEffect, useMemo } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  getSetProgress, updateSetQProgress, nextReviewDate, type SetQProgress,
} from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import {
  getSetDueReviews,
  practiceReviewHref,
  reviewQueueKey,
} from '@/lib/setReviewFlow'
import { clearReviewSessionReps } from '@/lib/reviewSessionReps'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysOverdue(nr: string) {
  const [y, m, d] = nr.split('-').map(Number)
  const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d).getTime()) / 86400000)
  if (diff === 0) return 'due today'
  if (diff === 1) return '1 day overdue'
  return `${diff} days overdue`
}

export default function SetReviewPage({ set }: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress,  setProgress]  = useState<Record<string, SetQProgress>>({})
  const [loading,   setLoading]   = useState(true)
  const [view, setView] = useState<'due' | 'all'>('due')

  function reloadProgress() {
    setProgress(getSetProgress(set))
  }

  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds) : getSet3Questions(mainIds)
      setQuestions(qs)
      reloadProgress()
      setLoading(false)
    }
    load()

    const refresh = () => reloadProgress()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [set])

  const dueReviews = useMemo(
    () => getSetDueReviews(set, questions),
    [set, questions, progress],
  )

  const carriedDue = useMemo(() => dueReviews.filter(d => d.carried), [dueReviews])
  const naturalDue = useMemo(() => dueReviews.filter(d => !d.carried), [dueReviews])

  const questionById = useMemo(
    () => Object.fromEntries(questions.map(q => [q.id, q])),
    [questions],
  )

  const allSolved = questions.filter(q => progress[String(q.id)]?.solved)

  function markReviewed(q: SetQuestion) {
    const p = progress[String(q.id)]
    const newCount = (p?.review_count ?? 0) + 1
    const updated = updateSetQProgress(set, q.id, {
      review_count: newCount,
      last_reviewed: todayISO(),
      next_review: nextReviewDate(newCount),
      review_carry_date: null,
    })
    setProgress(prev => ({ ...prev, [String(q.id)]: updated }))
    toast.success('Reviewed! Next review: ' + nextReviewDate(newCount))
  }

  function startReviewQueue(ids: number[]) {
    if (!ids.length) return
    clearReviewSessionReps(set)
    try {
      sessionStorage.setItem(reviewQueueKey(set), JSON.stringify(ids))
    } catch { /* ignore */ }
    router.push(practiceReviewHref(ids[0], set))
  }

  const displayedDueIds = new Set(dueReviews.map(d => d.id))
  const displayed = view === 'due'
    ? questions.filter(q => displayedDueIds.has(q.id))
    : allSolved

  const setLabel = set === 2 ? 'Set 2 · NeetCode 250' : 'Set 3 · AlgoMaster 600'

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
            {dueReviews.length} due
            {carriedDue.length > 0 && (
              <span className="text-amber-700 font-semibold"> · {carriedDue.length} catch-up</span>
            )}
            {' · '}{allSolved.length} solved total
          </p>
        </div>
        <div className="flex gap-1">
          {(['due', 'all'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                view === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)]'
              }`}>
              {v === 'due' ? `Due (${dueReviews.length})` : `All (${allSolved.length})`}
            </button>
          ))}
        </div>
      </div>

      {view === 'due' && (
        <>
          {carriedDue.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  ⚠️ Review catch-up · {setLabel}
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  {carriedDue.length} rolled forward
                </span>
              </div>
              <p className="text-[10px] text-amber-700 mb-3">
                Missed from earlier days — finish these to clear catch-up.
              </p>
              <div className="space-y-2">
                {carriedDue.map(d => {
                  const q = questionById[d.id]
                  if (!q) return null
                  const p = progress[String(q.id)]
                  return (
                    <div key={q.id} className="bg-[var(--bg-card)] border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                          <DifficultyBadge difficulty={q.difficulty} />
                          <span className="font-semibold text-sm text-[var(--text)] truncate">{q.title}</span>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            catch-up
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text-subtle)]">
                          <span>{daysOverdue(d.next_review)}</span>
                          <span>Reviews: {p?.review_count ?? 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startReviewQueue(carriedDue.map(x => x.id))}
                          className="text-[11px] font-bold text-amber-700 hover:underline"
                        >
                          Start catch-up
                        </button>
                        <Link href={practiceReviewHref(q.id, set)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors">
                          Practice
                        </Link>
                        <button onClick={() => markReviewed(q)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-[11px] font-bold hover:bg-amber-50 transition-colors">
                          Done
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {naturalDue.length > 0 && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  Today&apos;s reviews
                </p>
                <button
                  type="button"
                  onClick={() => startReviewQueue([...carriedDue, ...naturalDue].map(d => d.id))}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Start all {dueReviews.length}
                </button>
              </div>
              <div className="space-y-2">
                {naturalDue.map(d => {
                  const q = questionById[d.id]
                  if (!q) return null
                  const p = progress[String(q.id)]
                  return (
                    <div key={q.id} className="bg-[var(--bg-card)] border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
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
                        <Link href={practiceReviewHref(q.id, set)}
                          className="text-[11px] text-indigo-400 hover:underline">
                          Practice
                        </Link>
                        <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                          className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors">
                          <ExternalLink size={13} />
                        </a>
                        <button onClick={() => markReviewed(q)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors">
                          Done
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {dueReviews.length === 0 && (
            <div className="text-center py-16 text-[var(--text-subtle)] text-sm">
              <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
              No reviews due — great job! 🎉
            </div>
          )}
        </>
      )}

      {view === 'all' && (
        displayed.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-subtle)] text-sm">
            <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
            No solved questions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(q => {
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
                    <Link href={practiceReviewHref(q.id, set)}
                      className="text-[11px] text-indigo-400 hover:underline">
                      Practice
                    </Link>
                    <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

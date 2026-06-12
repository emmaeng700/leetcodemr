'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getProgress, getDueReviews, completeReview, getUserProfile, rebalanceReviews, getUserRevisionCap } from '@/lib/db'
import { isDue, formatLocalDate } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'
import PriorityBadge from '@/components/PriorityBadge'
import { Brain, CheckCircle, Clock, CalendarCheck, Flame, Trophy, Home } from 'lucide-react'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
}

// ─── Utility: group any question array by pattern in DISPLAY_PATTERN_ORDER ────

function groupByPattern<T extends { id: number }>(
  items: T[],
  exclusiveMap: Record<number, string>
): Array<{ pattern: string; items: T[] }> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const pat = exclusiveMap[item.id] ?? 'Other'
    if (!map.has(pat)) map.set(pat, [])
    map.get(pat)!.push(item)
  }
  const order = DISPLAY_PATTERN_ORDER as readonly string[]
  return [...map.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    .map(([pattern, items]) => ({ pattern, items }))
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const online = useOnlineStatus()
  const [allQ, setAllQ] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [dueList, setDueList] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const [localDoneIds, setLocalDoneIds] = useState<Set<number>>(new Set())
  const [repsPerQ, setRepsPerQ] = useState(2)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const [qs, profile, userCap] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getUserProfile(),
          getUserRevisionCap(),
        ])
        setAllQ(qs)
        if (profile?.repsPerQ && profile.repsPerQ > 0) setRepsPerQ(profile.repsPerQ)

        // Rebalance before reading progress/due so next_review dates reflect current cap.
        const REBALANCE_KEY = `lm_rebalanced_cap_${userCap}`
        if (!localStorage.getItem(REBALANCE_KEY)) {
          for (const k of [...Object.keys(localStorage)]) {
            if (k.startsWith('lm_rebalanced_')) localStorage.removeItem(k)
          }
          await rebalanceReviews()
          localStorage.setItem(REBALANCE_KEY, '1')
        }

        const [prog, due] = await Promise.all([getProgress(), getDueReviews()])
        setProgress(prog ?? {})
        setDueList(due)
        setLoading(false)
      } catch (e) {
        console.error('[review] load failed:', e)
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!dueList.length) return
    const syncedDone = dueList
      .filter(d => { const next = progress[String(d.id)]?.next_review; return next && !isDue(next) })
      .map(d => d.id)
    if (!syncedDone.length) return
    setLocalDoneIds(prev => { const next = new Set(prev); syncedDone.forEach(id => next.add(id)); return next })
  }, [dueList, progress])

  const exclusiveMap = useMemo(() => buildExclusivePatternMap(allQ), [allQ])

  const handleCompleteReview = async (qId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleting(qId)
    const result = await completeReview(qId)
    setProgress(prev => ({
      ...prev,
      [String(qId)]: { ...prev[String(qId)], review_count: result.review_count, next_review: result.next_review },
    }))
    setLocalDoneIds(prev => new Set([...prev, qId]))
    setCompleting(null)
  }

  if (loading) return (
    <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading…</div>
  )

  const withProgress = allQ.map(q => ({ ...q, p: progress[String(q.id)] || {} }))
  const inSR = withProgress.filter(q => q.p.solved && q.p.next_review)
  const dueIdSet = new Set(dueList.map(d => d.id))
  const due = inSR.filter(q => dueIdSet.has(q.id))
  const upcoming = inSR.filter(q => !isDue(q.p.next_review))
    .sort((a, b) => a.p.next_review.localeCompare(b.p.next_review))

  // Pre-compute pattern groups for due and upcoming sections
  const pendingDue = due.filter(q => !localDoneIds.has(q.id))
  const dueByPattern = groupByPattern(pendingDue, exclusiveMap)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="Reviews (Supabase)" />}

      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">
        <Brain className="text-indigo-500" /> Spaced Repetition
      </h1>
      <p className="text-sm text-[var(--text-subtle)] mb-7">
        SR starts automatically when you mark a question <strong className="text-[var(--text-muted)]">Solved</strong>.
      </p>

      {/* SR stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-7">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <Flame size={20} className="text-orange-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-orange-500">{due.length}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-0.5 font-medium">Due (capped)</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <Clock size={20} className="text-indigo-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-indigo-500">{upcoming.length}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-0.5 font-medium">Scheduled</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <Trophy size={20} className="text-green-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-green-500">{inSR.length}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-0.5 font-medium">In SR</div>
        </div>
      </div>

      {/* ── Due for Review ─────────────────────────────────────────────────── */}
      {due.length > 0 && (
        <section className="mb-7">
          {/* Section header — makes crystal clear these are today's batch */}
          <div className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text)]">
                  <Flame size={15} className="text-orange-500" />
                  Today&apos;s Reviews
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs border border-orange-200 font-bold">
                    {pendingDue.length} left
                  </span>
                  {localDoneIds.size > 0 && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs border border-green-200 font-bold">
                      {localDoneIds.size} done ✓
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--text-subtle)] mt-1">
                  Grouped by pattern · Again &amp; Pass appear on each question
                </p>
              </div>
              {/* Start all — queues every pending question in pattern order */}
              {pendingDue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const ordered = dueByPattern.flatMap(({ items }) => items.map(q => q.id))
                    sessionStorage.setItem('lm_review_queue', JSON.stringify(ordered))
                    router.push(`/practice/${ordered[0]}?from=review`)
                  }}
                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Flame size={12} /> Start all {pendingDue.length}
                </button>
              )}
            </div>
          </div>

          {/* All done celebration */}
          {localDoneIds.size >= due.length ? (
            <div className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6 text-center shadow-md">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-lg font-black text-green-700 mb-1">All done for today!</h3>
              <p className="text-sm text-green-600 mb-5">You cleared all {due.length} review{due.length !== 1 ? 's' : ''}. Great work — your memory is getting stronger.</p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
              >
                <Home size={15} /> Back to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {dueByPattern.map(({ pattern, items }) => (
                <div key={pattern}>
                  {/* Pattern header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{pattern}</span>
                      <PriorityBadge pattern={pattern} />
                      <span className="text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('lm_review_queue', JSON.stringify(items.map(q => q.id)))
                        router.push(`/practice/${items[0].id}?from=review`)
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      Review all <CalendarCheck size={11} />
                    </button>
                  </div>

                  {/* Questions */}
                  <div className="space-y-2">
                    {items.map(q => (
                        <div
                          key={q.id}
                          onClick={() => {
                            sessionStorage.setItem('lm_review_queue', JSON.stringify(
                              due.filter(d => !localDoneIds.has(d.id)).map(d => d.id)
                            ))
                            router.push(`/practice/${q.id}?from=review`)
                          }}
                          className="flex items-center justify-between gap-2 flex-wrap rounded-xl px-4 py-3 cursor-pointer bg-indigo-50 border border-indigo-200 hover:border-indigo-400 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                            <span className="font-semibold text-sm truncate text-[var(--text)] group-hover:text-indigo-600">{q.title}</span>
                            <DifficultyBadge difficulty={q.difficulty} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-indigo-500 hidden sm:inline">Review #{(q.p.review_count || 0) + 1}</span>
                            <button
                              onClick={e => handleCompleteReview(q.id, e)}
                              disabled={completing === q.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              <CalendarCheck size={12} />
                              {completing === q.id ? 'Saving…' : 'Done'}
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {due.length === 0 && inSR.length > 0 && (
        <div className="mb-7 bg-green-50  border border-green-200  rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700 ">All caught up! 🎉</p>
            <p className="text-xs text-green-600 ">No reviews due. Check back for your next scheduled review.</p>
          </div>
        </div>
      )}


    </div>
  )
}

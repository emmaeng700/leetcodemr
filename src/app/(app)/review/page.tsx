'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getMasteryRunsByQuestion, getProgress, getDueReviews, completeReview } from '@/lib/db'
import { isDue, formatLocalDate } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'
import { Brain, CheckCircle, Clock, CalendarCheck, Flame, Trophy, TrendingUp, Home } from 'lucide-react'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
}

function daysUntil(nextReview: string) {
  const [y, m, d] = nextReview.split('-').map(Number)
  const rev = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((rev.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const STATUS_STYLE: Record<string, string> = {
  mastered: 'bg-green-100  text-green-700  border-green-300 ',
  revised:  'bg-orange-100  text-orange-700  border-orange-300 ',
  reviewed: 'bg-yellow-100  text-yellow-700  border-yellow-300 ',
  learnt:   'bg-blue-100  text-blue-700  border-blue-300 ',
}

const STATUS_META: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  learnt:   { bg: 'bg-blue-50  border-blue-200 ',    text: 'text-blue-600 ',   label: 'Hard for me', emoji: '📘' },
  reviewed: { bg: 'bg-yellow-50  border-yellow-200 ', text: 'text-yellow-600 ', label: 'Getting there', emoji: '📙' },
  revised:  { bg: 'bg-orange-50  border-orange-200 ', text: 'text-orange-600 ', label: 'Easy for me', emoji: '📒' },
  mastered: { bg: 'bg-green-50  border-green-200 ',   text: 'text-green-600 ',  label: 'Mastered', emoji: '📗' },
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

// ─── Status bucket with pattern sub-groups ────────────────────────────────────

const STATUS_PATTERN_PAGE = 4

function StatusBucket({
  status,
  questions,
  exclusiveMap,
  runs,
  onNavigate,
}: {
  status: string
  questions: any[]
  exclusiveMap: Record<number, string>
  runs: Record<string, number>
  onNavigate: (id: number) => void
}) {
  const meta = STATUS_META[status]
  const patternGroups = useMemo(() => groupByPattern(questions, exclusiveMap), [questions, exclusiveMap])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!questions.length) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-subtle)]">
          <span>{meta.emoji}</span>
          <span>{meta.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.text}`}>
            {questions.length}
          </span>
        </p>
      </div>

      <div className="space-y-4">
        {patternGroups.map(({ pattern, items }) => {
          const isExpanded = expanded.has(pattern)
          const visible = isExpanded ? items : items.slice(0, STATUS_PATTERN_PAGE)
          const hidden = items.length - STATUS_PATTERN_PAGE
          return (
            <div key={pattern}>
              <p className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wider mb-1.5 px-1">
                {pattern} · {items.length}
              </p>
              <div className="space-y-1.5">
                {visible.map(q => (
                  <div
                    key={q.id}
                    onClick={() => onNavigate(q.id)}
                    className="flex items-center justify-between gap-2 flex-wrap bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-400/60 hover:shadow-md hover:shadow-[var(--accent-glow)] transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                      <span className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-indigo-500 transition-colors">{q.title}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[status]}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-[var(--text-subtle)] hidden sm:inline">
                        {Math.min(runs[String(q.id)] ?? 0, 3)}/3
                      </span>
                      {q.p?.solved && q.p?.next_review && (
                        <span className="text-xs text-[var(--text-subtle)] hidden sm:inline">
                          {isDue(q.p.next_review) ? '🔴 Due' : `📅 ${formatLocalDate(q.p.next_review)}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {items.length > STATUS_PATTERN_PAGE && (
                <button
                  type="button"
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    next.has(pattern) ? next.delete(pattern) : next.add(pattern)
                    return next
                  })}
                  className="mt-1.5 ml-1 text-xs font-semibold text-[var(--text-subtle)] hover:text-indigo-400 transition-colors"
                >
                  {isExpanded ? 'Show less ↑' : `Show ${hidden} more ↓`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const online = useOnlineStatus()
  const [allQ, setAllQ] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [runs, setRuns] = useState<Record<string, number>>({})
  const [dueList, setDueList] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const [localDoneIds, setLocalDoneIds] = useState<Set<number>>(new Set())
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getMasteryRunsByQuestion(),
      getDueReviews(),
    ]).then(([qs, prog, mr, due]) => {
      setAllQ(qs)
      setProgress(prog)
      setRuns(mr)
      setDueList(due)
      setLoading(false)
    }).catch(e => {
      console.error('[review] load failed:', e)
      setLoading(false)
    })
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

  const masteryBucket = (n: number) =>
    n >= 3 ? 'mastered' : n >= 2 ? 'revised' : n >= 1 ? 'reviewed' : 'learnt'

  const statusCounts = Object.keys(STATUS_META).reduce((acc: Record<string, number>, k) => {
    acc[k] = 0; return acc
  }, {})
  for (const q of withProgress) {
    const b = masteryBucket(runs[String(q.id)] ?? 0)
    statusCounts[b] = (statusCounts[b] || 0) + 1
  }

  // Pre-compute pattern groups for due and upcoming sections
  const pendingDue = due.filter(q => !localDoneIds.has(q.id))
  const dueByPattern = groupByPattern(pendingDue, exclusiveMap)
  const upcomingByPattern = groupByPattern(upcoming, exclusiveMap)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="Reviews (Supabase)" />}

      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">
        <Brain className="text-indigo-500" /> Spaced Repetition
      </h1>
      <p className="text-sm text-[var(--text-subtle)] mb-7">
        SR starts automatically when you mark a question <strong className="text-[var(--text-muted)]">Solved</strong>.
      </p>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} className={`rounded-xl border p-4 text-center ${meta.bg}`}>
            <div className={`text-3xl font-black ${meta.text}`}>{statusCounts[key] || 0}</div>
            <div className="text-xs text-[var(--text-subtle)] mt-1 font-medium">{meta.label}</div>
          </div>
        ))}
      </div>

      {/* SR stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-7">
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
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Flame size={15} className="text-orange-500" />
              Today's Reviews
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
              Today's scheduled batch · grouped by pattern · Again &amp; Pass appear when you open a question
            </p>
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
                    {items.map(q => {
                      const reps = Math.min(runs[String(q.id)] ?? 0, 3)
                      const canFinishFromHere = reps >= 3
                      return (
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
                            <span className="text-xs font-bold text-cyan-600">{reps}/3</span>
                            <button
                              onClick={e => {
                                if (!canFinishFromHere) {
                                  e.stopPropagation()
                                  sessionStorage.setItem('lm_review_queue', JSON.stringify(
                                    due.filter(d => !localDoneIds.has(d.id)).map(d => d.id)
                                  ))
                                  router.push(`/practice/${q.id}?from=review`)
                                  return
                                }
                                handleCompleteReview(q.id, e)
                              }}
                              disabled={completing === q.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              <CalendarCheck size={12} />
                              {completing === q.id ? 'Saving…' : canFinishFromHere ? 'Done' : 'Open'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
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

      {/* ── Upcoming Reviews ───────────────────────────────────────────────── */}
      {upcomingByPattern.length > 0 && (
        <section className="mb-7">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Clock size={15} className="text-indigo-500" /> Upcoming Reviews
              <span className="text-xs text-[var(--text-subtle)] font-mono">· {upcoming.length}</span>
            </h2>
            <p className="text-xs text-[var(--text-subtle)] mt-1">
              Not yet due — tap to do an <strong>early review</strong>: complete 3 reps and the date advances automatically
            </p>
          </div>
          <div className="space-y-4">
            {upcomingByPattern.map(({ pattern, items }) => (
              <div key={pattern}>
                <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  {pattern}
                  <span className="text-[11px] normal-case tracking-normal font-mono">· {items.length}</span>
                </p>
                <div className="space-y-1.5">
                  {items.map(q => {
                    const daysLeft = daysUntil(q.p.next_review)
                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          sessionStorage.setItem('lm_review_queue', JSON.stringify(items.map((q2: any) => q2.id)))
                          router.push(`/practice/${q.id}?from=early-review`)
                        }}
                        className="flex items-center justify-between gap-2 flex-wrap bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2.5 cursor-pointer hover:border-violet-400/60 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                          <span className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-violet-600">{q.title}</span>
                          <DifficultyBadge difficulty={q.difficulty} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[var(--text-subtle)]">
                            📅 {formatLocalDate(q.p.next_review)}
                            {daysLeft === 1 ? ' · tomorrow' : daysLeft > 1 ? ` · in ${daysLeft}d` : ''}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                            early review
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── All Questions by Status → Pattern ──────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-[var(--text)] mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-[var(--text-muted)]" /> All Questions by Status
        </h2>
        {(['mastered', 'revised', 'reviewed', 'learnt'] as const).map(st => {
          const qs = withProgress.filter(q => masteryBucket(runs[String(q.id)] ?? 0) === st)
          return (
            <StatusBucket
              key={st}
              status={st}
              questions={qs}
              exclusiveMap={exclusiveMap}
              runs={runs}
              onNavigate={id => router.push(`/practice/${id}`)}
            />
          )
        })}
      </section>
    </div>
  )
}

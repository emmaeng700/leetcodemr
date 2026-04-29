'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getDailyReviewCapChicago, getMasteryRunsByQuestion, getProgress, getDueReviews, completeReview } from '@/lib/db'
import { isDue, formatLocalDate } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import { Brain, CheckCircle, Clock, CalendarCheck, Flame, Trophy, TrendingUp, ChevronLeft, ChevronRight, Home } from 'lucide-react'

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

const PAGE_SIZE = 5

// Paginated card list for a status bucket
function StatusBucket({
  status,
  questions,
  runs,
  onNavigate,
}: {
  status: string
  questions: any[]
  runs: Record<string, number>
  onNavigate: (id: number) => void
}) {
  const [page, setPage] = useState(0)
  const meta = STATUS_META[status]
  const totalPages = Math.ceil(questions.length / PAGE_SIZE)
  const slice = questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (!questions.length) return null

  return (
    <div className="mb-6">
      {/* Bucket header */}
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-subtle)]">
          <span>{meta.emoji}</span>
          <span>{meta.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.text}`}>
            {questions.length}
          </span>
        </p>
        {totalPages > 1 && (
          <span className="text-xs text-[var(--text-subtle)]">
            {page + 1} / {totalPages}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {slice.map(q => (
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
                Runs {runs[String(q.id)] ?? 0}/4
              </span>
              {q.p.solved && q.p.next_review && (
                <span className="text-xs text-[var(--text-subtle)] hidden sm:inline">
                  {isDue(q.p.next_review) ? '🔴 Due' : `📅 ${formatLocalDate(q.p.next_review)}`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Prev / Next */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          {/* dot indicators */}
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`rounded-full transition-all ${i === page ? 'w-4 h-2 bg-indigo-500' : 'w-2 h-2 bg-[var(--bg-muted)] hover:bg-[var(--text-subtle)]'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

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
      getDueReviews(), // triggers spreading + returns capped list
    ]).then(([qs, prog, mr, due]) => {
      setAllQ(qs)
      setProgress(prog)
      setRuns(mr)
      setDueList(due)
      setLoading(false)
    }).catch((e) => {
      console.error('[review] load failed:', e)
      setLoading(false)
    })
  }, [])

  const handleCompleteReview = async (qId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleting(qId)
    const result = await completeReview(qId)
    setProgress(prev => ({
      ...prev,
      [String(qId)]: {
        ...prev[String(qId)],
        review_count: result.review_count,
        next_review: result.next_review,
      },
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
    n >= 4 ? 'mastered' : n >= 3 ? 'revised' : n >= 2 ? 'reviewed' : 'learnt'

  const statusCounts = Object.keys(STATUS_META).reduce((acc: Record<string, number>, k) => {
    acc[k] = 0; return acc
  }, {})
  for (const q of withProgress) {
    const b = masteryBucket(runs[String(q.id)] ?? 0)
    statusCounts[b] = (statusCounts[b] || 0) + 1
  }

  const upcomingBuckets: Record<string, typeof upcoming> = {}
  upcoming.forEach(q => {
    const days = daysUntil(q.p.next_review)
    const label =
      days <= 1  ? 'Tomorrow'
      : days <= 7  ? `In ${days} days`
      : days <= 14 ? 'Next week'
      : days <= 30 ? 'This month'
      : 'Later'
    if (!upcomingBuckets[label]) upcomingBuckets[label] = []
    upcomingBuckets[label].push(q)
  })

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

      {/* Due now */}
      {due.length > 0 && (
        <section className="mb-7">
          <h2 className="text-sm font-bold text-[var(--text)] mb-3 flex items-center gap-2">
            <Flame size={15} className="text-orange-500" /> Due for Review
            <span className="px-2 py-0.5 bg-orange-100  text-orange-600  rounded-full text-xs border border-orange-200 ">
              {due.length - localDoneIds.size}/{due.length}
            </span>
          </h2>

          {/* 🎉 All done celebration */}
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
            <div className="space-y-2">
              {due.map(q => {
                const isDone = localDoneIds.has(q.id)
                return (
                  <div
                    key={q.id}
                    onClick={() => !isDone && (() => {
                      sessionStorage.setItem('lm_review_queue', JSON.stringify(due.filter(d => !localDoneIds.has(d.id)).map(d => d.id)))
                      router.push(`/practice/${q.id}?from=review`)
                    })()}
                    className={`flex items-center justify-between gap-2 flex-wrap rounded-xl px-4 py-3 transition-all group ${
                      isDone
                        ? 'bg-green-50 border border-green-200 opacity-60 cursor-default'
                        : 'bg-indigo-50 border border-indigo-200 cursor-pointer hover:border-indigo-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isDone
                        ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                        : <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                      }
                      <span className={`font-semibold text-sm truncate ${isDone ? 'text-green-700 line-through' : 'text-[var(--text)] group-hover:text-indigo-600'}`}>{q.title}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isDone && <span className="text-xs text-indigo-500 hidden sm:inline">Review #{(q.p.review_count || 0) + 1}</span>}
                      {isDone ? (
                        <span className="text-xs text-green-600 font-semibold">✓ Done</span>
                      ) : (
                        <button
                          onClick={e => handleCompleteReview(q.id, e)}
                          disabled={completing === q.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          <CalendarCheck size={12} />
                          {completing === q.id ? 'Saving…' : 'Done'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
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

      {/* Upcoming */}
      {Object.keys(upcomingBuckets).length > 0 && (
        <section className="mb-7">
          <h2 className="text-sm font-bold text-[var(--text)] mb-3 flex items-center gap-2">
            <Clock size={15} className="text-indigo-500" /> Upcoming Reviews
          </h2>
          <div className="space-y-4">
            {Object.entries(upcomingBuckets).map(([bucket, questions]) => (
              <div key={bucket}>
                <p className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-widest mb-2">{bucket}</p>
                <div className="space-y-1.5">
                  {questions.map(q => (
                    <div
                      key={q.id}
                      onClick={() => router.push(`/practice/${q.id}`)}
                      className="flex items-center justify-between gap-2 flex-wrap bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2.5 cursor-pointer hover:border-indigo-400/60 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                        <span className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-indigo-500">{q.title}</span>
                        <DifficultyBadge difficulty={q.difficulty} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--text-subtle)] hidden sm:inline">
                          📅 {formatLocalDate(q.p.next_review)}
                        </span>
                        <span className="text-xs text-indigo-500 hidden sm:inline">
                          Review #{(q.p.review_count || 0) + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All by status — paginated */}
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
              runs={runs}
              onNavigate={id => router.push(`/practice/${id}`)}
            />
          )
        })}
      </section>
    </div>
  )
}

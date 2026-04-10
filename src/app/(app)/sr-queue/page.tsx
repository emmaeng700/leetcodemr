'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, CheckCircle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { getDailyReviewCapChicago, getDueReviews, getProgress, getStudyPlan, completeReview } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

interface Question { id: number; title: string; difficulty: string; tags: string[] }
type Urgency = 'overdue' | 'today' | 'soon' | 'later' | 'none'
interface RowItem { q: Question; p: Record<string, any> }

const PAGE_SIZE = 5

function QuestionRow({ q, p, urgency, completing, onDone }: {
  q: Question; p: Record<string, any>; urgency: Urgency
  completing: number | null; onDone: (id: number) => void
}) {
  const days = p.next_review ? daysUntil(p.next_review) : null

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-soft)] last:border-b-0 hover:bg-[var(--bg-muted)] transition-colors ${completing === q.id ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
          <Link href={`/practice/${q.id}`} className="font-semibold text-sm text-[var(--text)] hover:text-indigo-500 truncate transition-colors">{q.title}</Link>
          <DifficultyBadge difficulty={q.difficulty} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] flex-wrap">
          <span className="text-[var(--text-subtle)]">Review #{(p.review_count ?? 0) + 1}</span>
          {days !== null && (
            <span className={
              urgency === 'overdue' ? 'text-red-500 font-semibold' :
              urgency === 'today'   ? 'text-orange-500 font-semibold' :
              urgency === 'soon'    ? 'text-yellow-600 dark:text-yellow-400' :
                                     'text-[var(--text-subtle)]'
            }>
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Due in ${days}d`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/practice/${q.id}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
          Practice <ArrowRight size={11} />
        </Link>
        {(urgency === 'overdue' || urgency === 'today') && (
          <button
            onClick={() => onDone(q.id)}
            disabled={completing === q.id}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30 text-xs font-semibold hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-40"
          >
            <CheckCircle size={11} /> Done
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, items, urgency, accentCls, completing, onDone }: {
  title: string; items: RowItem[]; urgency: Urgency; accentCls: string
  completing: number | null; onDone: (id: number) => void
}) {
  const [page, setPage] = useState(0)
  if (!items.length) return null

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className={`px-4 py-2.5 border-b border-[var(--border)] ${accentCls} flex items-center justify-between`}>
        <span className="text-sm font-bold">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">{items.length} question{items.length !== 1 ? 's' : ''}</span>
          {totalPages > 1 && (
            <span className="text-xs opacity-60">{page + 1}/{totalPages}</span>
          )}
        </div>
      </div>

      {/* Rows */}
      {slice.map(({ q, p }) => (
        <QuestionRow key={q.id} q={q} p={p} urgency={urgency} completing={completing} onDone={onDone} />
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-soft)]">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={12} /> Prev
          </button>
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
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function SRQueueInner() {
  const online = useOnlineStatus()
  const searchParams = useSearchParams()
  const search = (searchParams.get('search') || '').trim().toLowerCase()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [dueList, setDueList] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getStudyPlan(),
    ]).then(([qs, prog, plan]) => {
      setQuestions(qs)
      setProgress(prog)
      setPlanOrder(plan?.question_order?.length ? plan.question_order : (qs as Question[]).map(q => q.id))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    // Keep SR Queue consistent with the app caps by reading the capped due list.
    // This also triggers the "spread forward" logic in db.getDueReviews().
    getDueReviews().then(setDueList).catch(() => {})
  }, [])

  const handleDone = useCallback(async (qId: number) => {
    if (!online) return
    setCompleting(qId)
    const result = await completeReview(qId)
    setProgress(prev => ({
      ...prev,
      [String(qId)]: { ...prev[String(qId)], review_count: result.review_count, next_review: result.next_review },
    }))
    // Refresh capped due list after marking done.
    try { setDueList(await getDueReviews()) } catch { /* ignore */ }
    setCompleting(null)
  }, [online])

  if (loading) return (
    <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading…</div>
  )

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))
  const solved: RowItem[] = planOrder
    .map(id => ({ q: qMap[id], p: progress[String(id)] }))
    .filter(({ q, p }) => q && p?.solved)

  const cap = getDailyReviewCapChicago()
  const dueIds = new Set(dueList.map(d => d.id))
  const todayQueue = solved.filter(({ q }) => dueIds.has(q.id))
  const overdue    = todayQueue.filter(({ p }) => p.next_review && daysUntil(p.next_review) < 0)
  const dueToday   = todayQueue.filter(({ p }) => p.next_review && daysUntil(p.next_review) === 0)
  const soon       = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) > 0 && daysUntil(p.next_review) <= 7)
  const later      = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) > 7)
  const none       = solved.filter(({ p }) => !p.next_review)

  const matchesSearch = ({ q }: RowItem) => {
    if (!search) return true
    const byId = search.replace(/^#/, '')
    return String(q.id).includes(byId) || q.title.toLowerCase().includes(search)
  }

  const overdueF  = overdue.filter(matchesSearch)
  const dueTodayF = dueToday.filter(matchesSearch)
  const soonF     = soon.filter(matchesSearch)
  const laterF    = later.filter(matchesSearch)
  const noneF     = none.filter(matchesSearch)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="SR Queue (Supabase)" />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
          <RefreshCw className="text-indigo-500" size={22} /> SR Queue
        </h1>
        <p className="text-sm text-[var(--text-subtle)] mt-1">
          {solved.length} solved · {todayQueue.length} due now (capped at {cap}/day)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {[
          { label: 'Overdue',   count: overdue.length,             color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30' },
          { label: 'Due today', count: dueToday.length,            color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-500/30' },
          { label: 'This week', count: soon.length,                color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-500/30' },
          { label: 'Later',     count: later.length + none.length, color: 'text-[var(--text-muted)]',           bg: 'bg-[var(--bg-card)] border-[var(--border)]' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
            <p className={`text-lg sm:text-xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-[var(--text-subtle)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {solved.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-subtle)]">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No solved questions yet — solve some and they'll appear here on a review schedule.</p>
        </div>
      ) : (
        <>
          <Section title="🔴 Overdue"        items={overdueF}  urgency="overdue" accentCls="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"         completing={completing} onDone={handleDone} />
          <Section title="🟡 Due Today"      items={dueTodayF} urgency="today"   accentCls="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" completing={completing} onDone={handleDone} />
          <Section title="📅 This Week"      items={soonF}     urgency="soon"    accentCls="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400" completing={completing} onDone={handleDone} />
          <Section title="⏳ Later"          items={laterF}    urgency="later"   accentCls="bg-[var(--bg-muted)] text-[var(--text-muted)]"                           completing={completing} onDone={handleDone} />
          {noneF.length > 0 && (
            <Section title="— Not scheduled" items={noneF}     urgency="none"    accentCls="bg-[var(--bg-muted)] text-[var(--text-subtle)]"                          completing={completing} onDone={handleDone} />
          )}
        </>
      )}
    </div>
  )
}

export default function SRQueuePage() {
  return (
    <Suspense fallback={<div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading…</div>}>
      <SRQueueInner />
    </Suspense>
  )
}

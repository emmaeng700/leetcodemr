'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, CheckCircle, ArrowRight } from 'lucide-react'
import { getProgress, getStudyPlan, completeReview } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// Mirror of srInterval from db.ts: alternates +5/+9 starting at 7
function srInterval(n: number): number {
  return Math.floor(n / 2) * 14 + (n % 2 === 0 ? 7 : 12)
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

interface Question { id: number; title: string; difficulty: string; tags: string[] }
type Urgency = 'overdue' | 'today' | 'soon' | 'later' | 'none'

interface RowItem { q: Question; p: Record<string, any> }

function QuestionRow({ q, p, urgency, completing, onDone }: {
  q: Question; p: Record<string, any>; urgency: Urgency
  completing: number | null; onDone: (id: number) => void
}) {
  const days = p.next_review ? daysUntil(p.next_review) : null
  const nextInterval = srInterval((p.review_count ?? 0) + 1)
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${completing === q.id ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
          <Link href={`/practice/${q.id}`} className="font-semibold text-sm text-gray-800 hover:text-indigo-600 truncate">{q.title}</Link>
          <DifficultyBadge difficulty={q.difficulty} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] flex-wrap">
          <span className="text-gray-400">Review #{(p.review_count ?? 0) + 1}</span>
          {days !== null && (
            <span className={
              urgency === 'overdue' ? 'text-red-500 font-semibold' :
              urgency === 'today'   ? 'text-orange-500 font-semibold' :
              urgency === 'soon'    ? 'text-yellow-600' : 'text-gray-400'
            }>
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Due in ${days}d`}
            </span>
          )}
          <span className="text-gray-300">→ after review: +{nextInterval}d</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/practice/${q.id}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          Practice <ArrowRight size={11} />
        </Link>
        {(urgency === 'overdue' || urgency === 'today') && (
          <button
            onClick={() => onDone(q.id)}
            disabled={completing === q.id}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-40"
          >
            <CheckCircle size={11} /> Done
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, items, urgency, accent, completing, onDone }: {
  title: string; items: RowItem[]; urgency: Urgency; accent: string
  completing: number | null; onDone: (id: number) => void
}) {
  if (!items.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className={`px-4 py-2.5 border-b ${accent} flex items-center justify-between`}>
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs opacity-70">{items.length} question{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.map(({ q, p }) => (
        <QuestionRow key={q.id} q={q} p={p} urgency={urgency} completing={completing} onDone={onDone} />
      ))}
    </div>
  )
}

export default function SRQueuePage() {
  const online = useOnlineStatus()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [planOrder, setPlanOrder] = useState<number[]>([])
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

  const handleDone = useCallback(async (qId: number) => {
    setCompleting(qId)
    const result = await completeReview(qId)
    setProgress(prev => ({
      ...prev,
      [String(qId)]: { ...prev[String(qId)], review_count: result.review_count, next_review: result.next_review },
    }))
    setCompleting(null)
  }, [])

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading…</div>

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))
  const solved: RowItem[] = planOrder
    .map(id => ({ q: qMap[id], p: progress[String(id)] }))
    .filter(({ q, p }) => q && p?.solved)

  const overdue  = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) < 0)
  const dueToday = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) === 0)
  const soon     = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) > 0 && daysUntil(p.next_review) <= 7)
  const later    = solved.filter(({ p }) => p.next_review && daysUntil(p.next_review) > 7)
  const none     = solved.filter(({ p }) => !p.next_review)

  const dueCount = overdue.length + dueToday.length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="SR Queue (Supabase)" />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <RefreshCw className="text-indigo-600" size={22} /> SR Queue
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {solved.length} solved · {dueCount} due now · review schedule uses your 7→12→21→26… formula
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          { label: 'Overdue',    count: overdue.length,              color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
          { label: 'Due today',  count: dueToday.length,             color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
          { label: 'This week',  count: soon.length,                 color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
          { label: 'Later',      count: later.length + none.length,  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
            <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {solved.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No solved questions yet — solve some and they'll appear here on a review schedule.</p>
        </div>
      ) : (
        <>
          <Section title="🔴 Overdue"    items={overdue}  urgency="overdue" accent="bg-red-50 border-red-100 text-red-700"       completing={completing} onDone={handleDone} />
          <Section title="🟡 Due Today"  items={dueToday} urgency="today"   accent="bg-orange-50 border-orange-100 text-orange-700" completing={completing} onDone={handleDone} />
          <Section title="📅 This Week"  items={soon}     urgency="soon"    accent="bg-yellow-50 border-yellow-100 text-yellow-700" completing={completing} onDone={handleDone} />
          <Section title="⏳ Later"      items={later}    urgency="later"   accent="bg-gray-50 border-gray-100 text-gray-700"      completing={completing} onDone={handleDone} />
          {none.length > 0 && <Section title="— Not scheduled" items={none} urgency="none" accent="bg-gray-50 border-gray-100 text-gray-600" completing={completing} onDone={handleDone} />}
        </>
      )}
    </div>
  )
}

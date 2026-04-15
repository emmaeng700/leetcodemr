'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Brain, ChevronRight, Loader2, Calendar, Clock } from 'lucide-react'
import DifficultyBadge from '@/components/DifficultyBadge'
import { getSrScheduleWindow } from '@/lib/db'

type Question = { id: number; title: string; slug: string; difficulty: string; tags: string[] }

function todayISOChicago() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export default function PileupPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [rows, setRows] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [qs, sched] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getSrScheduleWindow(45),
        ])
        if (cancelled) return
        setQuestions(qs as Question[])
        setRows(sched)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const qMap = useMemo(() => Object.fromEntries(questions.map(q => [q.id, q])), [questions])
  const today = todayISOChicago()
  const due = rows.filter(r => r.next_review <= today)
  const upcoming = rows.filter(r => r.next_review > today)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-56px)] text-[var(--text-subtle)] text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-16">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-indigo-600 dark:text-indigo-300" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-[var(--text)]">Pileup</h1>
          <p className="text-xs text-[var(--text-subtle)]">
            Extra SR reviews (due + upcoming). Reviewing early moves them forward in the spaced-rep cycle.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Due"
          icon={<Clock size={14} className="text-red-500" />}
          subtitle={`${due.length} item${due.length !== 1 ? 's' : ''} (≤ today)`}
          items={due}
          qMap={qMap}
          accent="red"
        />
        <Section
          title="Upcoming"
          icon={<Calendar size={14} className="text-indigo-500" />}
          subtitle={`${upcoming.length} item${upcoming.length !== 1 ? 's' : ''} (next 45 days)`}
          items={upcoming}
          qMap={qMap}
          accent="indigo"
        />
      </div>

      <p className="text-[11px] text-[var(--text-subtle)] mt-4">
        Tip: click a review → submit Accepted (or use SR Pass/Again) to update `next_review`.
      </p>
    </div>
  )
}

function Section({
  title,
  icon,
  subtitle,
  items,
  qMap,
  accent,
}: {
  title: string
  icon: React.ReactNode
  subtitle: string
  items: Array<{ id: number; review_count: number; next_review: string }>
  qMap: Record<number, Question | undefined>
  accent: 'red' | 'indigo'
}) {
  const border =
    accent === 'red'
      ? 'border-red-200 dark:border-red-500/30'
      : 'border-indigo-200 dark:border-indigo-500/30'

  return (
    <div className={`bg-[var(--bg-card)] rounded-xl border ${border} shadow-sm overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[var(--border-soft)] flex items-center gap-2">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--text)] leading-tight">{title}</p>
          <p className="text-[11px] text-[var(--text-subtle)]">{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-[var(--text-subtle)]">
          Nothing here.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {items.map(r => {
            const q = qMap[r.id]
            return (
              <Link
                key={`${r.id}:${r.next_review}`}
                href={`/practice/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)]/60 transition-colors"
              >
                <span className="text-xs font-mono text-[var(--text-subtle)] shrink-0">#{r.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {q?.title ?? 'Question'}
                  </p>
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    Review #{(r.review_count ?? 0) + 1} · scheduled {r.next_review}
                  </p>
                </div>
                {q?.difficulty && <DifficultyBadge difficulty={q.difficulty} />}
                <ChevronRight size={14} className="text-[var(--text-subtle)] shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


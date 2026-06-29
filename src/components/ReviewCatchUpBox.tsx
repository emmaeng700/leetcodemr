'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export type ReviewCatchUpItem = {
  id: number
  title: string
  review_count: number
  next_review: string
}

type Accent = 'amber' | 'emerald' | 'purple' | 'indigo'

const ACCENT: Record<Accent, { box: string; label: string; chip: string; chipHover: string; text: string }> = {
  amber: {
    box: 'bg-amber-50 border-amber-200',
    label: 'text-amber-800',
    chip: 'bg-white border-amber-200 text-amber-800',
    chipHover: 'hover:border-amber-400',
    text: 'text-amber-700',
  },
  emerald: {
    box: 'bg-amber-50 border-amber-200',
    label: 'text-amber-800',
    chip: 'bg-white border-emerald-200 text-emerald-800',
    chipHover: 'hover:border-emerald-400',
    text: 'text-emerald-700',
  },
  purple: {
    box: 'bg-amber-50 border-amber-200',
    label: 'text-amber-800',
    chip: 'bg-white border-purple-200 text-purple-800',
    chipHover: 'hover:border-purple-400',
    text: 'text-purple-700',
  },
  indigo: {
    box: 'bg-amber-50 border-amber-200',
    label: 'text-amber-800',
    chip: 'bg-white border-indigo-200 text-indigo-800',
    chipHover: 'hover:border-indigo-400',
    text: 'text-indigo-700',
  },
}

type Props = {
  setLabel: string
  items: ReviewCatchUpItem[]
  hrefFor: (id: number) => string
  daysOverdue: (nextReview: string) => string
  accent?: Accent
  hubHref?: string
  hubLabel?: string
}

/** Amber catch-up box for rolled-forward reviews — hidden when empty. */
export default function ReviewCatchUpBox({
  setLabel,
  items,
  hrefFor,
  daysOverdue,
  accent = 'amber',
  hubHref,
  hubLabel,
}: Props) {
  if (items.length === 0) return null
  const c = ACCENT[accent]
  return (
    <div className={`rounded-xl border p-3 mb-3 ${c.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${c.label}`}>
          ?? Review catch-up · {setLabel}
        </p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
          {items.length} rolled forward
        </span>
      </div>
      <p className={`text-[10px] mb-2 ${c.text}`}>
        Missed from earlier days — finish these to clear catch-up.
      </p>
      <div className="flex flex-wrap gap-2">
        {hubHref && hubLabel && (
          <Link
            href={hubHref}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${c.chip} ${c.chipHover}`}
          >
            {hubLabel} <ArrowRight size={12} />
          </Link>
        )}
        {items.map(q => (
          <Link
            key={q.id}
            href={hrefFor(q.id)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs transition-all text-left ${c.chip} ${c.chipHover}`}
          >
            <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
            <span className="font-semibold truncate max-w-[140px]">{q.title}</span>
            <span className={`text-xs ${c.text}`}>
              · Review #{q.review_count + 1} · {daysOverdue(q.next_review)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

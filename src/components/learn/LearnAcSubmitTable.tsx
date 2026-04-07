'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react'
import { getAcSubmitCounts } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'

const PAGE_SIZE = 10

interface Q {
  id: number
  title: string
  slug: string
  difficulty: string
}

function sortPriority(count: number): number {
  if (count < 3) return 0
  if (count < 6) return 1
  if (count < 10) return 2
  return 3
}

function tierLabel(count: number): string {
  if (count < 3) return '< 3 AC'
  if (count < 6) return '3–5 AC'
  if (count < 10) return '6–9 AC'
  return '10+ AC'
}

/** Second section on Learn: AC submit counts for the full library (paginated). */
export default function LearnAcSubmitTable() {
  const [questions, setQuestions] = useState<Q[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [qs, ac] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getAcSubmitCounts(),
        ])
        if (cancelled) return
        setQuestions(qs as Q[])
        setCounts(ac)
      } catch {
        setQuestions([])
        setCounts({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const out = questions.map(q => ({
      ...q,
      count: counts[String(q.id)] ?? 0,
    }))
    out.sort((a, b) => {
      const pa = sortPriority(a.count)
      const pb = sortPriority(b.count)
      if (pa !== pb) return pa - pb
      if (a.count !== b.count) return a.count - b.count
      return a.id - b.id
    })
    return out
  }, [questions, counts])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  useEffect(() => {
    setPage(p => Math.min(p, totalPages - 1))
  }, [totalPages])

  const safePage = Math.min(page, totalPages - 1)
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
        <Loader2 className="animate-spin" size={18} />
        Loading submit counts…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-gray-800">
            <Send size={16} className="text-indigo-500" />
            Accepted submit counts
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Submit → Accepted from Practice, Learn, Speedster, or LeetCode API. Sorted: &lt;3, then 3–5, then 6–9, then
            10+ AC.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs">
        <span className="text-gray-600">
          <span className="font-bold text-gray-900">{rows.length}</span> questions ·{' '}
          <span className="font-mono font-semibold">
            {safePage + 1} / {totalPages}
          </span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-800 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-800 disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Diff</th>
              <th className="px-3 py-2">Band</th>
              <th className="px-3 py-2 text-right">AC</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {slice.map(row => (
              <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-gray-400">#{row.id}</td>
                <td className="max-w-[12rem] px-3 py-2 text-xs font-semibold text-gray-800 sm:max-w-none">
                  <span className="line-clamp-2 sm:line-clamp-none">{row.title}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <DifficultyBadge difficulty={row.difficulty} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      row.count < 3
                        ? 'bg-amber-100 text-amber-900'
                        : row.count < 6
                          ? 'bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200/80'
                          : row.count < 10
                            ? 'bg-green-50 text-green-800 ring-1 ring-green-200/80'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tierLabel(row.count)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm font-bold tabular-nums text-gray-900">
                  {row.count}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Link
                    href={`/practice/${row.id}`}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

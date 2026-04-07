'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getAcSubmitCounts } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'

const PAGE_SIZE = 10

interface Q {
  id: number
  title: string
  slug: string
  difficulty: string
}

/** Lower = show first: <3, then <6, then <10, then 10+ */
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

export default function LearnAcSubmissionsPage() {
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
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center gap-2 text-gray-400">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-indigo-50/40 to-white">
      <div className="mx-auto max-w-5xl px-4 py-8 pb-16">
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Learn</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">Accepted submit counts</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                Tracks how many times you pressed <strong>Submit</strong> and got <strong>Accepted</strong> on each
                problem (Practice, Learn, Speedster, LeetCode API). The table lists every problem in your library;
                priority groups put problems with fewer AC submits first so you can grind reps.
              </p>
            </div>
            <Link href="/learn" className="shrink-0 text-sm font-bold text-indigo-600 hover:underline">
              ← Learn hub
            </Link>
          </div>
          <ul className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <li>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
              First: &lt; 3 AC
            </li>
            <li>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-400" />
              Then: 3–5 AC
            </li>
            <li>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-400" />
              Then: 6–9 AC
            </li>
            <li>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300" />
              Last: 10+ AC
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-gray-600">
            <span className="font-bold text-gray-900">{rows.length}</span> questions ·{' '}
            <span className="font-mono font-semibold">
              Page {safePage + 1} / {totalPages}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-sm transition hover:border-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-sm transition hover:border-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/90 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Priority band</th>
                <th className="px-4 py-3 text-right">AC submits</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {slice.map(row => (
                <tr key={row.id} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-indigo-50/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400">#{row.id}</td>
                  <td className="max-w-[min(40vw,14rem)] px-4 py-3 font-semibold text-gray-900 sm:max-w-none">
                    <span className="line-clamp-2 sm:line-clamp-none">{row.title}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DifficultyBadge difficulty={row.difficulty} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
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
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-base font-bold tabular-nums text-gray-900">
                    {row.count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/practice/${row.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Practice →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

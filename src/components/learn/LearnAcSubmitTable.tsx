'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react'

const PAGE_SIZE = 10

interface Q {
  id: number
  title: string
  slug: string
}

/** Second section on Learn: AC counts from LeetCode submission history (session), mapped to library ids. */
export default function LearnAcSubmitTable({ onSolve }: { onSolve?: (questionId: number) => void }) {
  const [questions, setQuestions] = useState<Q[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const qs = (await fetch('/questions_full.json').then(r => r.json())) as Q[]
        if (cancelled) return
        setQuestions(qs.map(q => ({ id: q.id, title: q.title, slug: q.slug })))

        const session = typeof window !== 'undefined' ? localStorage.getItem('lc_session') ?? '' : ''
        const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('lc_csrf') ?? '' : ''

        const acRes = await fetch('/api/leetcode/ac-counts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, csrfToken }),
        })
        const acJson = (await acRes.json()) as { bySlug?: Record<string, number>; error?: string }
        if (cancelled) return

        if (acJson.error === 'no_session') {
          setCounts({})
          setLoadError('Add your LeetCode session (same as the editor) to load accurate AC counts.')
        } else if (acJson.error) {
          setCounts({})
          setLoadError(acJson.error)
        } else {
          setCounts(acJson.bySlug ?? {})
        }
      } catch {
        if (!cancelled) {
          setQuestions([])
          setCounts({})
          setLoadError('Could not load counts.')
        }
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
      count: counts[q.slug] ?? 0,
    }))
    out.sort((a, b) => {
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
        Loading submission counts from LeetCode…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-black text-gray-800">
          <Send size={16} className="text-indigo-500" />
          Accepted submits per problem
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-gray-500">
          AC counts come from your LeetCode account’s submission history (Accepted only). Uses the same session as Run /
          Submit.
        </p>
        {loadError && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {loadError}
          </p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs">
        <span className="text-gray-600">
          <span className="font-bold text-gray-900">{rows.length}</span> problems ·{' '}
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
        <table className="w-full min-w-[380px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="whitespace-nowrap px-2 py-2 text-right">Solve</th>
              <th className="px-3 py-2 text-right">AC</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(row => (
              <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-gray-400">#{row.id}</td>
                <td className="max-w-[12rem] px-3 py-2 text-xs font-semibold text-gray-800 sm:max-w-none">
                  <span className="line-clamp-2 sm:line-clamp-none">{row.title}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {onSolve ? (
                    <button
                      type="button"
                      onClick={() => onSolve(row.id)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      Solve
                    </button>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm font-bold tabular-nums text-gray-900">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

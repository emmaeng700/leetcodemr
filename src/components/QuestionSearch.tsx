'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ExternalLink, Search } from 'lucide-react'

type Q = { id: number; title: string; slug?: string }

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export default function QuestionSearch({ className = '' }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const supportsFiltering =
    pathname === '/' || pathname === '/flashcards' || pathname === '/sr-queue' || pathname.startsWith('/learn')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<Q[] | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/questions_full.json', { cache: 'force-cache' })
        if (!res.ok) return
        const data = (await res.json()) as any[]
        if (cancelled) return
        setQuestions(
          (data ?? []).map(q => ({ id: Number(q.id), title: String(q.title ?? ''), slug: q.slug ?? undefined }))
        )
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onDocDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('touchstart', onDocDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
    }
  }, [])

  const matches = useMemo(() => {
    const qn = normalize(query)
    if (!qn || !questions?.length) return []
    const byId = qn.replace(/^#/, '')
    return questions
      .filter(q => {
        if (byId && String(q.id).includes(byId)) return true
        return normalize(q.title).includes(qn)
      })
      .slice(0, 8)
  }, [query, questions])

  function applyToCurrentPage(q: string) {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const trimmed = q.trim()
    if (!trimmed) p.delete('search')
    else p.set('search', trimmed)
    setOpen(false)
    router.push(`${pathname}${p.toString() ? `?${p.toString()}` : ''}`)
  }

  function goTo(id: number) {
    setOpen(false)
    setQuery('')
    router.push(`/question/${id}`)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (supportsFiltering) {
              applyToCurrentPage(query)
            } else {
              const first = matches[0]
              if (first) goTo(first.id)
            }
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Filter this page… (#id or title)"
        className="w-full pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 bg-slate-800 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
      />

      {open && query.trim().length > 0 && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-800 shadow-2xl shadow-black/40">
          {matches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">No matches</div>
          ) : (
            matches.map(q => (
              <div key={q.id} className="flex items-stretch border-b border-white/5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => (supportsFiltering ? applyToCurrentPage(`#${q.id}`) : goTo(q.id))}
                  className="flex-1 text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                  title={supportsFiltering ? 'Filter current page' : 'Open question'}
                >
                  <div className="text-sm font-medium text-slate-200">
                    <span className="text-slate-500 mr-1">#{q.id}</span>
                    {q.title}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => goTo(q.id)}
                  className="px-3 py-2 text-slate-600 hover:text-indigo-400 hover:bg-white/5 transition-colors"
                  title="Open question"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

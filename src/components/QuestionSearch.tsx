'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ExternalLink, Search } from 'lucide-react'
import { getSet2Questions, getSet3Questions } from '@/lib/questionSets'
import { learnHrefForSetQuestion } from '@/lib/dailyExtension'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'

type SearchQ = { id: number; title: string; slug?: string; set: 1 | 2 | 3 }

export default function QuestionSearch({ className = '' }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const supportsFiltering =
    pathname === '/questions' || pathname === '/flashcards' || pathname === '/sr-queue' || pathname.startsWith('/learn')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<SearchQ[] | null>(null)
  const [set2Questions, setSet2Questions] = useState<import('@/lib/questionSets').SetQuestion[]>([])
  const [set3Questions, setSet3Questions] = useState<import('@/lib/questionSets').SetQuestion[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/questions_full.json', { cache: 'force-cache' })
        if (!res.ok) return
        const main = (await res.json()) as { id: number; title: string; slug?: string }[]
        if (cancelled) return
        const mainIds = new Set(main.map(q => q.id))
        const s2 = getSet2Questions(mainIds, main)
        const s3 = getSet3Questions(mainIds, main)
        setSet2Questions(s2)
        setSet3Questions(s3)
        setQuestions([
          ...main.map(q => ({
            id: Number(q.id),
            title: String(q.title ?? ''),
            slug: q.slug,
            set: 1 as const,
          })),
          ...s2.map(q => ({ id: q.id, title: q.title, slug: q.slug, set: 2 as const })),
          ...s3.map(q => ({ id: q.id, title: q.title, slug: q.slug, set: 3 as const })),
        ])
      } catch {
        /* ignore */
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
    if (!query.trim() || !questions?.length) return []
    return questions.filter(q => matchesQuestionSearch(q, query)).slice(0, 10)
  }, [query, questions])

  function applyToCurrentPage(q: string) {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const trimmed = q.trim()
    if (!trimmed) p.delete('search')
    else p.set('search', trimmed)
    setOpen(false)
    router.push(`${pathname}${p.toString() ? `?${p.toString()}` : ''}`)
  }

  function goTo(q: SearchQ) {
    setOpen(false)
    setQuery('')
    if (q.set === 1) {
      router.push(`/practice/${q.id}`)
      return
    }
    router.push(learnHrefForSetQuestion(q.id, q.set, set2Questions, set3Questions))
  }

  const setLabel = (set: 1 | 2 | 3) =>
    set === 1 ? 'Set 1' : set === 2 ? 'Set 2' : 'Set 3'

  const setBadgeClass = (set: 1 | 2 | 3) =>
    set === 1
      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
      : set === 2
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-purple-100 text-purple-700 border-purple-200'

  return (
    <div ref={containerRef} className={`relative z-30 isolate ${className}`}>
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] pointer-events-none" />
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
              if (first) goTo(first)
            }
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search all questions… (#id or title)"
        className="w-full pl-9 pr-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] bg-[var(--bg-input)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
      />

      {open && query.trim().length > 0 && (
        <div className="absolute z-[40] mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] opacity-100 shadow-2xl ring-1 ring-black/5">
          {matches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-subtle)]">No matches</div>
          ) : (
            matches.map(q => (
              <div key={`${q.set}-${q.id}`} className="flex items-stretch border-b border-[var(--border-soft)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => goTo(q)}
                  className="flex-1 text-left px-4 py-2.5 hover:bg-[var(--bg-muted)] transition-colors"
                  title="Open question"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${setBadgeClass(q.set)}`}>
                      {setLabel(q.set)}
                    </span>
                    <span className="text-[var(--text-subtle)] shrink-0">#{q.id}</span>
                    <span className="truncate">{q.title}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => goTo(q)}
                  className="px-3 py-2 text-[var(--text-subtle)] hover:text-indigo-500 hover:bg-[var(--bg-muted)] transition-colors"
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

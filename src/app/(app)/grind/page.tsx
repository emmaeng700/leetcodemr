'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, PenLine } from 'lucide-react'
import GrindEditor from '@/components/GrindEditor'
import DifficultyBadge from '@/components/DifficultyBadge'
import { buildGrindQuestions, loadQuestionsFullJson, type GrindQuestion } from '@/lib/grindQuestions'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { ensureGrindStarterCached } from '@/lib/grindStarter'
import { readCachedStarter } from '@/lib/grindStorage'

const SET_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  2: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  3: 'bg-purple-100 text-purple-700 border-purple-200',
}

function GrindInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const [questions, setQuestions] = useState<GrindQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(sp.get('search') || '')
  const [listOpen, setListOpen] = useState(false)
  const prefetchRef = useRef(false)

  const selectedId = Number(sp.get('id') || '0')

  useEffect(() => {
    async function load() {
      try {
        const qs = await loadQuestionsFullJson()
        const { getSet2Questions, getSet3Questions } = await import('@/lib/questionSets')
        const mainIds = new Set(qs.map(q => q.id))
        const set2 = getSet2Questions(mainIds, qs)
        const set3 = getSet3Questions(mainIds, qs)
        setQuestions(buildGrindQuestions(qs, set2, set3))
      } catch {
        setQuestions([])
      }
      setLoading(false)
    }
    void load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return questions
    return questions.filter(q => matchesQuestionSearch(q, search))
  }, [questions, search])

  const selected = useMemo(() => {
    if (selectedId > 0) return questions.find(q => q.id === selectedId) ?? null
    return filtered[0] ?? questions[0] ?? null
  }, [questions, filtered, selectedId])

  const selectedIndex = selected ? questions.findIndex(q => q.id === selected.id) : -1

  useEffect(() => {
    if (loading || questions.length === 0 || selectedId > 0) return
    const first = filtered[0] ?? questions[0]
    if (!first) return
    const params = new URLSearchParams(sp.toString())
    params.set('id', String(first.id))
    router.replace(`/grind?${params.toString()}`, { scroll: false })
  }, [loading, questions, filtered, selectedId, sp, router])

  useEffect(() => {
    if (loading || !selected || prefetchRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    prefetchRef.current = true

    const needFetch = questions.filter(
      q => q.set !== 1 && !readCachedStarter(q.id, 'python3') && !readCachedStarter(q.id, 'cpp'),
    )
    let i = 0
    const tick = async () => {
      if (i >= needFetch.length) return
      const q = needFetch[i++]
      await Promise.all([
        ensureGrindStarterCached(q, 'python3'),
        ensureGrindStarterCached(q, 'cpp'),
      ])
      setTimeout(tick, 400)
    }
    setTimeout(tick, 800)
  }, [loading, questions, selected])

  function selectQuestion(q: GrindQuestion) {
    const params = new URLSearchParams(sp.toString())
    params.set('id', String(q.id))
    router.replace(`/grind?${params.toString()}`, { scroll: false })
    setListOpen(false)
  }

  function go(delta: number) {
    if (selectedIndex < 0) return
    const next = questions[selectedIndex + delta]
    if (next) selectQuestion(next)
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(sp.toString())
    if (search.trim()) params.set('search', search.trim())
    else params.delete('search')
    const first = filtered[0]
    if (first) params.set('id', String(first.id))
    router.replace(`/grind?${params.toString()}`, { scroll: false })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-sm text-[var(--text-subtle)] animate-pulse">
        Loading grind workspace...
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3 min-h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <PenLine size={18} className="text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[var(--text)] leading-tight">The Grind</h1>
            <p className="text-[10px] text-[var(--text-subtle)]">
              Write solutions from memory | {questions.length} questions | works offline
            </p>
          </div>
        </div>

        <form onSubmit={onSearchSubmit} className="flex-1 flex gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by #id or title..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setListOpen(v => !v)}
            className="lg:hidden px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-muted)] shrink-0"
          >
            {listOpen ? 'Hide' : 'List'}
          </button>
        </form>

        {selected && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={selectedIndex <= 0}
              onClick={() => go(-1)}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[var(--text-subtle)] font-mono px-1">
              {selectedIndex + 1}/{questions.length}
            </span>
            <button
              type="button"
              disabled={selectedIndex >= questions.length - 1}
              onClick={() => go(1)}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <aside
          className={`${
            listOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-64 xl:w-72 shrink-0 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden max-h-48 lg:max-h-none`}
        >
          <div className="px-3 py-2 border-b border-[var(--border-soft)] text-xs text-[var(--text-subtle)] shrink-0">
            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ' matching search' : ''}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {filtered.map(q => {
              const active = selected?.id === q.id
              return (
                <button
                  key={`${q.set}-${q.id}`}
                  type="button"
                  onClick={() => selectQuestion(q)}
                  className={`w-full text-left px-3 py-2 border-b border-[var(--border-soft)] transition-colors ${
                    active ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${SET_BADGE[q.set]}`}>
                      S{q.set}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-subtle)] shrink-0">#{q.id}</span>
                    <span className="text-xs font-medium truncate text-[var(--text)]">{q.title}</span>
                  </div>
                  <div className="mt-0.5">
                    <DifficultyBadge difficulty={q.difficulty} />
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 min-h-[50dvh] lg:min-h-0 flex flex-col">
          {selected ? (
            <GrindEditor key={selected.id} question={selected} className="flex-1 min-h-0 h-full" />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-subtle)]">
              Search or pick a question to start grinding.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GrindPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-sm text-[var(--text-subtle)] animate-pulse">
          Loading...
        </div>
      }
    >
      <GrindInner />
    </Suspense>
  )
}

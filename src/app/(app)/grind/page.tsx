'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, PenLine, ExternalLink } from 'lucide-react'
import GrindEditor from '@/components/GrindEditor'
import GrindConnectivityBanner from '@/components/GrindConnectivityBanner'
import GrindCountStrip from '@/components/GrindCountStrip'
import GrindListDivider from '@/components/GrindListDivider'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import { buildGrindQuestions, loadQuestionsFullJson, loadPlaybookMap, loadGrindQuestionsBundle, type GrindQuestion } from '@/lib/grindQuestions'
import { migrateAllGrindDrafts } from '@/lib/grindMigration'
import { grindListWithDividers, grindSummaryCounts } from '@/lib/grindList'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { ensureGrindStarterCached } from '@/lib/grindStarter'
import { readCachedStarter, readGrindLastQuestionId, writeGrindLastQuestionId } from '@/lib/grindStorage'
import { useMobileViewport } from '@/hooks/useMobileViewport'

const SET_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  2: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  3: 'bg-purple-100 text-purple-700 border-purple-200',
}

function GrindInner() {
  const { height: vvHeight, keyboardOpen } = useMobileViewport()
  const sp = useSearchParams()
  const router = useRouter()
  const [questions, setQuestions] = useState<GrindQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(() => {
    const fromUrl = Number(sp.get('id') || '0')
    if (fromUrl > 0) return fromUrl
    return readGrindLastQuestionId() ?? 0
  })
  const [listOpen, setListOpen] = useState(false)
  const prefetchRef = useRef(false)

  const spKey = sp.toString()

  function grindHref(id: number) {
    return `/grind?id=${id}`
  }

  // Search is local-only; strip legacy ?search= from shared/bookmarked URLs.
  useEffect(() => {
    if (!sp.get('search')) return
    setSearch('')
    const id = sp.get('id')
    const href = id ? grindHref(Number(id)) : '/grind'
    window.history.replaceState(window.history.state, '', href)
    router.replace(href, { scroll: false })
  }, [spKey, sp, router])

  useEffect(() => {
    const fromUrl = Number(sp.get('id') || '0')
    if (fromUrl > 0) {
      setSelectedId(fromUrl)
      writeGrindLastQuestionId(fromUrl)
    }
  }, [spKey, sp])

  useEffect(() => {
    if (loading || questions.length === 0) return

    const urlId = Number(sp.get('id') || '0')
    const savedId = readGrindLastQuestionId()
    let targetId = urlId > 0 ? urlId : (savedId ?? 0)

    if (targetId > 0 && !questions.some(q => q.id === targetId)) {
      targetId = questions[0]?.id ?? 0
    } else if (targetId <= 0) {
      targetId = questions[0]?.id ?? 0
    }
    if (targetId <= 0) return

    writeGrindLastQuestionId(targetId)
    setSelectedId(targetId)
    if (urlId !== targetId) {
      router.replace(grindHref(targetId), { scroll: false })
    }
  }, [loading, questions, spKey, router])

  useEffect(() => {
    async function load() {
      try {
        const bundled = await loadGrindQuestionsBundle()
        if (bundled.length > 0) {
          migrateAllGrindDrafts(bundled)
          setQuestions(bundled)
          setLoading(false)
          return
        }

        const qs = await loadQuestionsFullJson()
        const { getSet2Questions, getSet3Questions } = await import('@/lib/questionSets')
        const mainIds = new Set(qs.map(q => q.id))
        const set2 = getSet2Questions(mainIds, qs)
        const set3 = getSet3Questions(mainIds, qs)
        const playbookMap = await loadPlaybookMap()
        const built = buildGrindQuestions(qs, set2, set3, playbookMap)
        migrateAllGrindDrafts(built)
        setQuestions(built)
      } catch {
        const bundled = await loadGrindQuestionsBundle()
        if (bundled.length > 0) migrateAllGrindDrafts(bundled)
        setQuestions(bundled)
      }
      setLoading(false)
    }
    void load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return questions
    return questions.filter(q => matchesQuestionSearch(q, search))
  }, [questions, search])

  const listEntries = useMemo(() => grindListWithDividers(filtered), [filtered])
  const summary = useMemo(() => grindSummaryCounts(filtered), [filtered])

  const selected = useMemo(() => {
    if (selectedId > 0) return questions.find(q => q.id === selectedId) ?? null
    return filtered[0] ?? questions[0] ?? null
  }, [questions, filtered, selectedId])

  const navList = useMemo(() => {
    if (!search.trim()) return questions
    if (selected && !filtered.some(q => q.id === selected.id)) return questions
    return filtered
  }, [search, filtered, questions, selected])
  const navIndex = selected ? navList.findIndex(q => q.id === selected.id) : -1

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

  function navigateToQuestion(q: GrindQuestion) {
    writeGrindLastQuestionId(q.id)
    setSelectedId(q.id)
    const href = grindHref(q.id)
    window.history.replaceState(window.history.state, '', href)
    router.replace(href, { scroll: false })
  }

  function selectQuestion(q: GrindQuestion) {
    navigateToQuestion(q)
    setListOpen(false)
  }

  function go(delta: number) {
    if (navIndex < 0) return
    const next = navList[navIndex + delta]
    if (next) navigateToQuestion(next)
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const first = filtered[0]
    if (first) navigateToQuestion(first)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-sm text-[var(--text-subtle)] animate-pulse">
        Loading grind workspace...
      </div>
    )
  }

  const mobileShellStyle =
    vvHeight != null && keyboardOpen
      ? {
          height: vvHeight,
          maxHeight: vvHeight,
          overflow: 'hidden',
        }
      : undefined

  return (
    <div
      className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3 h-[calc(100dvh-3.5rem)]"
      style={mobileShellStyle}
    >
      <GrindConnectivityBanner questionId={selected?.id} />

      <div className={`flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 relative z-[45] ${keyboardOpen ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <PenLine size={18} className="text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[var(--text)] leading-tight">The Grind</h1>
            <p className="text-[10px] text-[var(--text-subtle)]">
              PDF study order | {questions.length} questions | Set 1 then 2 then 3
            </p>
            <div className="mt-1 hidden sm:block">
              <GrindCountStrip counts={summary} />
            </div>
            <div className="mt-1 sm:hidden">
              <GrindCountStrip counts={summary} compact />
            </div>
          </div>
        </div>

        <form onSubmit={onSearchSubmit} className="flex-1 flex gap-1.5 min-w-0 items-center">
          {selected && (
            <button
              type="button"
              disabled={navIndex <= 0}
              onClick={() => go(-1)}
              aria-label="Previous question"
              className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-30 shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by #id or title..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-indigo-400"
            />
          </div>
          {selected && (
            <>
              <button
                type="button"
                disabled={navIndex < 0 || navIndex >= navList.length - 1}
                onClick={() => go(1)}
                aria-label="Next question"
                className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-30 shrink-0"
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-[10px] text-[var(--text-subtle)] font-mono shrink-0 tabular-nums">
                {navIndex + 1}/{navList.length}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setListOpen(v => !v)}
            className="lg:hidden px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-muted)] shrink-0"
          >
            {listOpen ? 'Hide' : 'List'}
          </button>
        </form>
      </div>

      <div className="flex flex-1 min-h-0 gap-3 relative">
        {listOpen && (
          <button
            type="button"
            aria-label="Close question list"
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setListOpen(false)}
          />
        )}
        <aside
          className={`${
            listOpen ? 'flex' : 'hidden'
          } lg:flex fixed lg:relative z-50 lg:z-auto bottom-0 left-0 right-0 lg:inset-auto
            w-full lg:w-64 xl:w-72 shrink-0 flex-col h-full min-h-0
            rounded-t-2xl lg:rounded-xl
            border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden
            max-h-[55dvh] lg:max-h-full shadow-[0_-8px_32px_rgba(0,0,0,0.2)] lg:shadow-none`}
        >
          <div className="px-3 py-2 border-b border-[var(--border-soft)] text-xs text-[var(--text-subtle)] shrink-0">
            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ' matching search' : ''}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {listEntries.map(entry => {
              if (entry.type === 'divider') {
                return <GrindListDivider key={entry.key} entry={entry} />
              }
              const q = entry.q
              const active = selected?.id === q.id
              const lcHref = leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))
              return (
                <div
                  key={entry.key}
                  className={`flex items-stretch border-b border-[var(--border-soft)] ${
                    active ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectQuestion(q)}
                    className="flex-1 min-w-0 text-left px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${SET_BADGE[q.set]}`}>
                        S{q.set}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-subtle)] shrink-0">#{q.id}</span>
                      <span className="text-xs font-medium truncate text-[var(--text)]">{q.title}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <DifficultyBadge difficulty={q.difficulty} />
                      {q.pattern && <PriorityBadge pattern={q.pattern} />}
                    </div>
                  </button>
                  <a
                    href={lcHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open on LeetCode"
                    aria-label={`Open ${q.title} on LeetCode`}
                    className="shrink-0 self-center px-2 py-2 text-[var(--text-subtle)] hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              )
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
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

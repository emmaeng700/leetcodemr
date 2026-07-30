'use client'

import Link from 'next/link'
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GrindEditor from '@/components/GrindEditor'
import GrindConnectivityBanner from '@/components/GrindConnectivityBanner'
import GrindCountStrip, {
  DEFAULT_GRIND_FILTERS,
  grindQuestionMatchesFilters,
  type GrindFilterState,
} from '@/components/GrindCountStrip'
import GrindListDivider from '@/components/GrindListDivider'
import { GrindLangProvider, useGrindLang } from '@/components/grind/GrindLangContext'
import { buildGrindQuestions, loadQuestionsFullJson, loadPlaybookMap, loadGrindQuestionsBundle, type GrindQuestion } from '@/lib/grindQuestions'
import { migrateAllGrindDrafts } from '@/lib/grindMigration'
import { grindListWithDividers, ltsListWithDividers, grindSummaryCounts, type GrindListEntry } from '@/lib/grindList'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { ensureGrindStarterCached } from '@/lib/grindStarter'
import { readCachedStarter, writeGrindLastQuestionId, fetchGrindLastQuestionFromCloud } from '@/lib/grindStorage'
import {
  readAllGrindResetCounts,
  readGrindResetCount,
  loadAndMergeGrindResetCounts,
  syncAllGrindResetsToSupabase,
  GRIND_RESET_CHANGED,
} from '@/lib/grindResets'
import {
  prefetchGrindLcAcceptedForOffline,
  stopGrindLcAcceptedPrefetch,
  type GrindLcAcceptedPrefetchProgress,
} from '@/lib/grindLcAccepted'
import {
  ensureLcSessionForSync,
  readLcListSync,
  syncLeetCodeListAccepted,
} from '@/lib/leetcodeListSync'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import FastListsPanel from '@/components/FastListsPanel'
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'

function grindHref(id: number) {
  return `/grind?id=${id}`
}

function priorityFromSection(section: string | null): string | null {
  if (!section) return null
  const m = section.match(/^(High|Mid|Low) /)
  return m ? m[1] : null
}

function diffClass(d: string) {
  if (d === 'Easy') return 'grind-diff-easy'
  if (d === 'Medium') return 'grind-diff-medium'
  return 'grind-diff-hard'
}

function prioClass(p: string) {
  if (p === 'High') return 'grind-prio-high'
  if (p === 'Mid') return 'grind-prio-mid'
  return 'grind-prio-low'
}

function GrindAppShell({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div className="grind-app" style={style}>
      <Suspense fallback={null}>
        <GrindConnectivityBanner />
      </Suspense>
      {children}
    </div>
  )
}

/**
 * Memoized so the 700+ rows don't re-render (and re-diff) on unrelated page
 * state changes — keyboard/viewport ticks, cache-progress banner updates, etc.
 */
const GrindQuestionList = memo(function GrindQuestionList({
  listEntries,
  activeId,
  resetCounts,
  onSelect,
  activeRowRef,
}: {
  listEntries: GrindListEntry[]
  activeId: number
  resetCounts: Record<number, number>
  onSelect: (q: GrindQuestion) => void
  activeRowRef: React.MutableRefObject<HTMLDivElement | null>
}) {
  return (
    <div className="grind-list">
      {listEntries.map(entry => {
        if (entry.type === 'divider') {
          return <GrindListDivider key={entry.key} entry={entry} />
        }
        const q = entry.q
        const active = activeId === q.id
        const pri = priorityFromSection(q.section)
        const lcHref = leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))
        return (
          <div
            key={entry.key}
            ref={active ? activeRowRef : undefined}
            className={`grind-q-wrap ${active ? 'on' : ''}`}
          >
            <button type="button" className="grind-q" onClick={() => onSelect(q)}>
              <div className="flex items-center gap-1 min-w-0">
                <span className={`grind-set-badge grind-set-${q.set}`}>S{q.set}</span>
                <span className="grind-q-id">#{q.id}</span>
                <span className="grind-q-title">{q.title}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                <span className={`grind-pill ${diffClass(q.difficulty)}`}>{q.difficulty}</span>
                {pri && <span className={`grind-pill ${prioClass(pri)}`}>{pri}</span>}
                {(resetCounts[q.id] ?? 0) > 0 && (
                  <span className="grind-q-reset" title={`Reset ${resetCounts[q.id]} times`}>
                    ↺{resetCounts[q.id]}
                  </span>
                )}
              </div>
            </button>
            <a
              href={lcHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on LeetCode"
              aria-label={`Open ${q.title} on LeetCode`}
              className="grind-q-lc"
            >
              LC
            </a>
          </div>
        )
      })}
    </div>
  )
})

function GrindInner() {
  const { height: vvHeight, keyboardOpen } = useMobileViewport()
  const online = useOnlineStatus()
  const { lang, setLang } = useGrindLang()
  const sp = useSearchParams()
  const router = useRouter()
  const [questions, setQuestions] = useState<GrindQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [grindFilters, setGrindFilters] = useState<GrindFilterState>(() => ({
    ...DEFAULT_GRIND_FILTERS,
    difficulties: new Set(DEFAULT_GRIND_FILTERS.difficulties),
    priorities: new Set(DEFAULT_GRIND_FILTERS.priorities),
    sets: new Set(DEFAULT_GRIND_FILTERS.sets),
  }))
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(() => {
    const fromUrl = Number(sp.get('id') || '0')
    return fromUrl > 0 ? fromUrl : 0
  })
  const [listOpen, setListOpen] = useState(false)
  const [fastListOpen, setFastListOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [ltsSort, setLtsSort] = useState(true)
  const [resetCounts, setResetCounts] = useState<Record<number, number>>(() => readAllGrindResetCounts())
  const prefetchRef = useRef(false)
  const cloudInitRef = useRef(false)
  const activeRowRef = useRef<HTMLDivElement | null>(null)
  const [acCacheProgress, setAcCacheProgress] = useState<GrindLcAcceptedPrefetchProgress | null>(null)
  const acProgressLastTsRef = useRef(0)

  const spKey = sp.toString()

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

  useEffect(() => {
    const refreshCounts = () => {
      void loadAndMergeGrindResetCounts()
        .then(setResetCounts)
        .catch(() => setResetCounts(readAllGrindResetCounts()))
    }
    refreshCounts()
    const onOnline = () => {
      void syncAllGrindResetsToSupabase()
        .then(() => loadAndMergeGrindResetCounts())
        .then(setResetCounts)
        .catch(() => setResetCounts(readAllGrindResetCounts()))
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshCounts()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener(GRIND_RESET_CHANGED, refreshCounts)
    window.addEventListener('pageshow', refreshCounts)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener(GRIND_RESET_CHANGED, refreshCounts)
      window.removeEventListener('pageshow', refreshCounts)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (!grindQuestionMatchesFilters(q, grindFilters)) return false
      if (search.trim() && !matchesQuestionSearch(q, search)) return false
      return true
    })
  }, [questions, search, grindFilters])

  const ltsOrdered = useMemo(() => {
    if (!ltsSort) return filtered
    const secSize = new Map<string, number>()
    for (const q of questions) {
      if (!q.section) continue
      const key = `${q.section}|${q.set}`
      secSize.set(key, (secSize.get(key) ?? 0) + 1)
    }
    const priOrd: Record<string, number> = { High: 0, Mid: 1, Low: 2 }
    const diffOrd: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
    const band = (n: number) => n >= 16 ? 0 : n >= 10 ? 1 : n >= 5 ? 2 : 3
    const SEC_RE = /^(High|Mid|Low) (Easy|Medium|Hard) - /
    return [...filtered].sort((a, b) => {
      const ma = SEC_RE.exec(a.section ?? '')
      const mb = SEC_RE.exec(b.section ?? '')
      const po = (priOrd[ma?.[1] ?? ''] ?? 9) - (priOrd[mb?.[1] ?? ''] ?? 9)
      if (po !== 0) return po
      const na = secSize.get(`${a.section}|${a.set}`) ?? 0
      const nb = secSize.get(`${b.section}|${b.set}`) ?? 0
      const bo = band(na) - band(nb)
      if (bo !== 0) return bo
      const dif = (diffOrd[ma?.[2] ?? ''] ?? 9) - (diffOrd[mb?.[2] ?? ''] ?? 9)
      if (dif !== 0) return dif
      if (na !== nb) return nb - na
      if (a.set !== b.set) return a.set - b.set
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pi = DISPLAY_PATTERN_ORDER.indexOf(a.pattern as any ?? '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pj = DISPLAY_PATTERN_ORDER.indexOf(b.pattern as any ?? '')
      if (pi !== pj) return pi - pj
      return a.id - b.id
    })
  }, [filtered, ltsSort, questions])

  const filterBase = useMemo(() => {
    return questions.filter(q =>
      grindQuestionMatchesFilters(q, { ...grindFilters, pattern: 'all' }),
    )
  }, [questions, grindFilters])

  const listEntries = useMemo(
    () => ltsSort ? ltsListWithDividers(ltsOrdered) : grindListWithDividers(ltsOrdered),
    [ltsOrdered, ltsSort],
  )

  // Must live after ltsOrdered is declared to avoid temporal dead zone
  useEffect(() => {
    if (loading || questions.length === 0) return

    const urlId = Number(sp.get('id') || '0')

    // URL id always wins — no cloud fetch needed
    if (urlId > 0) {
      const id = questions.some(q => q.id === urlId) ? urlId : (questions[0]?.id ?? 0)
      if (id <= 0) return
      writeGrindLastQuestionId(id)
      setSelectedId(id)
      return
    }

    // Filter / sort changed after init — keep current selection if still valid
    if (cloudInitRef.current) {
      setSelectedId(prev => {
        if (ltsOrdered.some(q => q.id === prev)) return prev
        const fallback = ltsOrdered[0]?.id ?? questions[0]?.id ?? 0
        if (fallback > 0) writeGrindLastQuestionId(fallback)
        return fallback
      })
      return
    }

    // First load, no URL id — set LtS first immediately then swap to cloud value
    cloudInitRef.current = true
    const defaultId = ltsOrdered[0]?.id ?? questions[0]?.id ?? 0
    if (defaultId <= 0) return
    setSelectedId(defaultId)
    router.replace(grindHref(defaultId), { scroll: false })

    fetchGrindLastQuestionFromCloud().then(cloudId => {
      if (!cloudId) {
        writeGrindLastQuestionId(defaultId)
        return
      }
      const resumeId = questions.some(q => q.id === cloudId) ? cloudId : defaultId
      writeGrindLastQuestionId(resumeId)
      setSelectedId(resumeId)
      router.replace(grindHref(resumeId), { scroll: false })
    })
  }, [loading, questions, ltsOrdered, spKey, router])

  const summary = useMemo(() => grindSummaryCounts(filterBase), [filterBase])
  const patternCounts = useMemo(() => summary.byPattern, [summary])

  const selected = useMemo(() => {
    if (selectedId > 0) {
      const fromFiltered = ltsOrdered.find(q => q.id === selectedId)
      if (fromFiltered) return fromFiltered
      return questions.find(q => q.id === selectedId) ?? null
    }
    return ltsOrdered[0] ?? questions[0] ?? null
  }, [questions, ltsOrdered, selectedId])

  const navList = useMemo(() => {
    if (selected && !ltsOrdered.some(q => q.id === selected.id)) return questions
    return ltsOrdered.length ? ltsOrdered : questions
  }, [ltsOrdered, questions, selected])
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

  // Background-cache accepted LeetCode solutions for offline Grind.
  useEffect(() => {
    if (loading || questions.length === 0 || !online) {
      stopGrindLcAcceptedPrefetch()
      if (!online) setAcCacheProgress(null)
      return
    }

    let cancelled = false
    void (async () => {
      await ensureLcSessionForSync()
      if (cancelled) return

      // Need solved IDs so we only download accepted code for problems you AC'd.
      if (!readLcListSync()?.solvedIds?.length) {
        const { session, csrf } = await ensureLcSessionForSync()
        if (session && csrf) {
          await syncLeetCodeListAccepted(questions, session, csrf)
        }
      }
      if (cancelled) return

      await prefetchGrindLcAcceptedForOffline(
        questions.map(q => ({ id: q.id, slug: q.slug })),
        lang,
        p => {
          if (cancelled) return
          // The prefetch reports progress on every item; throttle running
          // updates to ~1/s so the banner doesn't re-render the page constantly.
          const now = Date.now()
          if (p.running && now - acProgressLastTsRef.current < 1000) return
          acProgressLastTsRef.current = now
          setAcCacheProgress(p)
        },
      )
    })()

    return () => {
      cancelled = true
      stopGrindLcAcceptedPrefetch()
    }
  }, [loading, questions, online, lang])

  const navigateToQuestion = useCallback((q: GrindQuestion) => {
    writeGrindLastQuestionId(q.id)
    setSelectedId(q.id)
    const href = grindHref(q.id)
    window.history.replaceState(window.history.state, '', href)
    router.replace(href, { scroll: false })
  }, [router])

  const selectQuestion = useCallback((q: GrindQuestion) => {
    navigateToQuestion(q)
    setListOpen(false)
  }, [navigateToQuestion])

  function go(delta: number) {
    if (navIndex < 0) return
    const next = navList[navIndex + delta]
    if (next) navigateToQuestion(next)
  }

  const handleReset = useCallback((id: number) => {
    setResetCounts(prev => ({ ...prev, [id]: readGrindResetCount(id) }))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const el = activeRowRef.current
    if (!el) return
    // Keep the selected row visible when picking from search / prev-next / deep links.
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    })
  }, [selectedId, listOpen, loading, listEntries.length])

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const first = ltsOrdered[0]
    if (first) navigateToQuestion(first)
  }

  if (loading) {
    return (
      <GrindAppShell>
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c7086] animate-pulse">
          Loading grind workspace...
        </div>
      </GrindAppShell>
    )
  }

  const shellStyle =
    vvHeight != null && keyboardOpen
      ? { height: vvHeight, maxHeight: vvHeight, overflow: 'hidden' as const }
      : undefined

  return (
    <GrindAppShell style={shellStyle}>
      <header className={`grind-header ${keyboardOpen ? 'hidden md:flex' : ''}`}>
        <div className="grind-header-top">
          <div className="grind-header-title">
            <h1>The Grind</h1>
            <p className="grind-header-sub">
              LtS order | {questions.length} questions | High → Mid → Low priority
            </p>
          </div>
          {online && (
            <nav className="grind-exit-nav" aria-label="Leave grind workspace">
              <Link href="/daily" className="grind-chip grind-chip-primary">
                Daily
              </Link>
              <Link href="/questions" className="grind-chip">
                Questions
              </Link>
            </nav>
          )}
          <div className="grind-langs">
            <button
              type="button"
              className={lang === 'python3' ? 'on-py' : ''}
              aria-label="Python"
              onClick={() => setLang('python3')}
            >
              Py
            </button>
            <button
              type="button"
              className={lang === 'cpp' ? 'on-cpp' : ''}
              aria-label="C++"
              onClick={() => setLang('cpp')}
            >
              C++
            </button>
          </div>
        </div>
        <GrindCountStrip
          counts={summary}
          patternCounts={patternCounts}
          filters={grindFilters}
          onChange={nextFilters => {
            setLtsSort(false)
            setGrindFilters(nextFilters)
            const newFiltered = questions.filter(q => {
              if (!grindQuestionMatchesFilters(q, nextFilters)) return false
              if (search.trim() && !matchesQuestionSearch(q, search)) return false
              return true
            })
            if (newFiltered.length > 0 && !newFiltered.some(q => q.id === selectedId)) {
              navigateToQuestion(newFiltered[0])
            }
          }}
        />

        <form onSubmit={onSearchSubmit} className="grind-search-row">
          <button
            type="button"
            disabled={!selected || navIndex <= 0}
            onClick={() => go(-1)}
            aria-label="Previous question"
            className="grind-chip grind-nav-btn"
          >
            &#8249;
          </button>
          <input
            className="grind-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search #id or title..."
            autoComplete="off"
          />
          <button
            type="button"
            disabled={!selected || navIndex < 0 || navIndex >= navList.length - 1}
            onClick={() => go(1)}
            aria-label="Next question"
            className="grind-chip grind-nav-btn"
          >
            &#8250;
          </button>
          {selected && (
            <span className="grind-nav-count">
              {navIndex + 1}/{navList.length}
            </span>
          )}
          <button
            type="button"
            className={`grind-chip ${fastListOpen ? 'grind-chip-primary' : ''}`}
            onClick={() => { setFastListOpen(v => !v); setListOpen(false) }}
          >
            Fast
          </button>
          <button
            type="button"
            className="grind-chip grind-mob-only"
            onClick={() => { setListOpen(v => !v); setFastListOpen(false) }}
          >
            {listOpen ? 'Hide' : 'List'}
          </button>
        </form>
      </header>

      {online && acCacheProgress && acCacheProgress.total > 0 && (
        <div className="grind-cache-banner" role="status">
          {acCacheProgress.running ? (
            <>
              Caching accepted solutions for offline (syncs across devices)…{' '}
              <strong className="tabular-nums">
                {acCacheProgress.done}/{acCacheProgress.total}
              </strong>
              {' '}({acCacheProgress.cached} ready)
            </>
          ) : (
            <>
              Offline + cloud cache ready:{' '}
              <strong className="tabular-nums">{acCacheProgress.cached}</strong>
              {' '}accepted solution{acCacheProgress.cached === 1 ? '' : 's'} for {lang === 'python3' ? 'Python' : 'C++'}
            </>
          )}
        </div>
      )}

      <div className="grind-body">
        <button
          type="button"
          aria-label="Close question list"
          className={`grind-list-backdrop ${listOpen ? 'open' : ''} lg:hidden`}
          onClick={() => setListOpen(false)}
        />
        <aside className={`grind-list-wrap ${listOpen || fastListOpen ? 'open' : ''}`}>
          {fastListOpen ? (
            <FastListsPanel
              questions={questions}
              activeFilters={grindFilters}
              onSelect={nextFilters => {
                setLtsSort(false)
                setGrindFilters(nextFilters)
                setFastListOpen(false)
                const newFiltered = questions.filter(q =>
                  grindQuestionMatchesFilters(q, nextFilters),
                )
                if (newFiltered.length > 0) navigateToQuestion(newFiltered[0])
              }}
              onClose={() => setFastListOpen(false)}
              onLtsCollect={filter => {
                const priorities: Set<'High' | 'Mid' | 'Low'> = filter
                  ? new Set([filter])
                  : new Set(['High', 'Mid', 'Low'])
                const nextFilters: GrindFilterState = {
                  pattern: 'all',
                  difficulties: new Set(['Easy', 'Medium', 'Hard']),
                  priorities,
                  sets: new Set([1, 2, 3]),
                }
                // Compute LtS order immediately to navigate to first question
                const pool = questions.filter(q => grindQuestionMatchesFilters(q, nextFilters))
                const secSize = new Map<string, number>()
                for (const q of questions) {
                  if (!q.section) continue
                  secSize.set(`${q.section}|${q.set}`, (secSize.get(`${q.section}|${q.set}`) ?? 0) + 1)
                }
                const priOrd: Record<string, number> = { High: 0, Mid: 1, Low: 2 }
                const diffOrd: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
                const band = (n: number) => n >= 16 ? 0 : n >= 10 ? 1 : n >= 5 ? 2 : 3
                const SEC_RE = /^(High|Mid|Low) (Easy|Medium|Hard) - /
                const sorted = [...pool].sort((a, b) => {
                  const ma = SEC_RE.exec(a.section ?? '')
                  const mb = SEC_RE.exec(b.section ?? '')
                  const po = (priOrd[ma?.[1] ?? ''] ?? 9) - (priOrd[mb?.[1] ?? ''] ?? 9)
                  if (po !== 0) return po
                  const na = secSize.get(`${a.section}|${a.set}`) ?? 0
                  const nb = secSize.get(`${b.section}|${b.set}`) ?? 0
                  const bo = band(na) - band(nb)
                  if (bo !== 0) return bo
                  const dif = (diffOrd[ma?.[2] ?? ''] ?? 9) - (diffOrd[mb?.[2] ?? ''] ?? 9)
                  if (dif !== 0) return dif
                  if (na !== nb) return nb - na
                  if (a.set !== b.set) return a.set - b.set
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pi = DISPLAY_PATTERN_ORDER.indexOf(a.pattern as any ?? '')
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pj = DISPLAY_PATTERN_ORDER.indexOf(b.pattern as any ?? '')
                  if (pi !== pj) return pi - pj
                  return a.id - b.id
                })
                setLtsSort(true)
                setGrindFilters(nextFilters)
                setFastListOpen(false)
                if (sorted[0]) navigateToQuestion(sorted[0])
              }}
            />
          ) : (
            <>
              <div className="grind-list-head">
                {ltsOrdered.length} question{ltsOrdered.length !== 1 ? 's' : ''}
                {search.trim() ||
                grindFilters.pattern !== 'all' ||
                grindFilters.difficulties.size < 3 ||
                grindFilters.priorities.size < 3 ||
                grindFilters.sets.size < 3
                  ? ' matching filters'
                  : ''}
              </div>
              <GrindQuestionList
                listEntries={listEntries}
                activeId={selected?.id ?? 0}
                resetCounts={resetCounts}
                onSelect={selectQuestion}
                activeRowRef={activeRowRef}
              />
            </>
          )}
        </aside>

        <div className="grind-editor min-h-0">
          {selected ? (
            <GrindEditor
              key={selected.id}
              question={selected}
              className="flex-1 min-h-0 h-full"
              onReset={handleReset}
              startExpanded={portalOpen}
              onExpandedChange={setPortalOpen}
              onShowList={() => { setListOpen(v => !v); setFastListOpen(false) }}
              onPrev={navIndex > 0 ? () => go(-1) : undefined}
              onNext={navIndex >= 0 && navIndex < navList.length - 1 ? () => go(1) : undefined}
              hasPrev={navIndex > 0}
              hasNext={navIndex >= 0 && navIndex < navList.length - 1}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#6c7086] p-4">
              Search or pick a question to start grinding.
            </div>
          )}
        </div>
      </div>

      <footer className={`grind-footer ${keyboardOpen ? 'hidden md:block' : ''}`}>
        {online
          ? `${questions.length} questions · write from memory`
          : 'Offline · saved locally · write from memory'}
      </footer>
    </GrindAppShell>
  )
}

export default function GrindPage() {
  return (
    <Suspense
      fallback={
        <div className="grind-app items-center justify-center text-sm text-[#6c7086] animate-pulse">
          Loading...
        </div>
      }
    >
      <GrindLangProvider>
        <GrindInner />
      </GrindLangProvider>
    </Suspense>
  )
}

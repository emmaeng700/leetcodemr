'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GrindEditor from '@/components/GrindEditor'
import GrindConnectivityBanner from '@/components/GrindConnectivityBanner'
import GrindCountStrip from '@/components/GrindCountStrip'
import GrindListDivider from '@/components/GrindListDivider'
import { GrindLangProvider, useGrindLang } from '@/components/grind/GrindLangContext'
import { buildGrindQuestions, loadQuestionsFullJson, loadPlaybookMap, loadGrindQuestionsBundle, type GrindQuestion } from '@/lib/grindQuestions'
import { migrateAllGrindDrafts } from '@/lib/grindMigration'
import { grindListWithDividers, grindSummaryCounts } from '@/lib/grindList'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { ensureGrindStarterCached } from '@/lib/grindStarter'
import { readCachedStarter, readGrindLastQuestionId, writeGrindLastQuestionId } from '@/lib/grindStorage'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

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

function GrindInner() {
  const { height: vvHeight, keyboardOpen } = useMobileViewport()
  const online = useOnlineStatus()
  const { lang, setLang } = useGrindLang()
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
      <div className="grind-app items-center justify-center text-sm text-[#6c7086] animate-pulse">
        Loading grind workspace...
      </div>
    )
  }

  const shellStyle =
    vvHeight != null && keyboardOpen
      ? { height: vvHeight, maxHeight: vvHeight, overflow: 'hidden' as const }
      : undefined

  return (
    <div className="grind-app" style={shellStyle}>
      <GrindConnectivityBanner questionId={selected?.id} />

      <header className={`grind-header ${keyboardOpen ? 'hidden md:flex' : ''}`}>
        <div className="grind-header-top">
          <div className="grind-header-title">
            <h1>The Grind</h1>
            <p className="grind-header-sub">
              PDF study order | {questions.length} questions | Set 1 then 2 then 3
            </p>
            <GrindCountStrip counts={summary} />
          </div>
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
            className="grind-chip grind-mob-only"
            onClick={() => setListOpen(v => !v)}
          >
            {listOpen ? 'Hide' : 'List'}
          </button>
        </form>
      </header>

      <div className="grind-body">
        <button
          type="button"
          aria-label="Close question list"
          className={`grind-list-backdrop ${listOpen ? 'open' : ''} lg:hidden`}
          onClick={() => setListOpen(false)}
        />
        <aside className={`grind-list-wrap ${listOpen ? 'open' : ''}`}>
          <div className="grind-list-head">
            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ' matching search' : ''}
          </div>
          <div className="grind-list">
            {listEntries.map(entry => {
              if (entry.type === 'divider') {
                return <GrindListDivider key={entry.key} entry={entry} />
              }
              const q = entry.q
              const active = selected?.id === q.id
              const pri = priorityFromSection(q.section)
              const lcHref = leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))
              return (
                <div key={entry.key} className={`grind-q-wrap ${active ? 'on' : ''}`}>
                  <button type="button" className="grind-q" onClick={() => selectQuestion(q)}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`grind-set-badge grind-set-${q.set}`}>S{q.set}</span>
                      <span className="text-[0.58rem] text-[#6c7086] font-mono shrink-0">#{q.id}</span>
                      <span className="text-[0.68rem] truncate">{q.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                      <span className={`grind-pill ${diffClass(q.difficulty)}`}>{q.difficulty}</span>
                      {pri && <span className={`grind-pill ${prioClass(pri)}`}>{pri}</span>}
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
        </aside>

        <div className="grind-editor min-h-0">
          {selected ? (
            <GrindEditor key={selected.id} question={selected} className="flex-1 min-h-0 h-full" />
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
    </div>
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

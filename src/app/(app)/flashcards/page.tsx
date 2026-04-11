'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw, Layers, CheckCircle, Circle } from 'lucide-react'
import { getFcVisited, addFcVisited, getProgress } from '@/lib/db'
import { shuffle, stripScripts } from '@/lib/utils'
import { DIFFICULTY_LEVELS, QUESTION_SOURCES, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import QuestionImage from '@/components/QuestionImage'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
  description?: string
}

function FlashcardsInner() {
  const searchParams = useSearchParams()
  const initDiff    = searchParams.get('diff')    || 'All'
  const initSource  = searchParams.get('source')  || 'All'
  const initSearch  = searchParams.get('search')  || ''
  const initStarred = searchParams.get('starred') === '1'
  const initTagsRaw = searchParams.get('tags')    || ''
  const initTags    = initTagsRaw ? initTagsRaw.split(',') : []
  const initSolvedParam = searchParams.get('solved')
  const initSolved: null | boolean = initSolvedParam === 'true' ? true : initSolvedParam === 'false' ? false : null

  const [all, setAll] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, { solved?: boolean; starred?: boolean; status?: string | null }>>({})
  const [deck, setDeck] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterDiff, setFilterDiff] = useState(initDiff)
  const [filterSource, setFilterSource] = useState(initSource)
  const [filterPattern, setFilterPattern] = useState<string | null>(
    initTags.length > 0 ? (QUICK_PATTERNS.find(p => p.tags.some(t => initTags.includes(t)))?.name ?? null) : null
  )
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const filterNavKeyRef = useRef<string | null>(null)
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const [qs, vis, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getFcVisited(),
        getProgress(),
      ])
      setAll(qs)
      setProgress(prog)
      setVisited(vis)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let filtered = all
    if (filterDiff !== 'All') filtered = filtered.filter(q => q.difficulty === filterDiff)
    if (filterSource !== 'All') filtered = filtered.filter(q => (q.source || []).includes(filterSource))
    if (initSearch) {
      const s = initSearch.toLowerCase()
      const byId = s.replace(/^#/, '')
      filtered = filtered.filter(q => q.title.toLowerCase().includes(s) || String(q.id).includes(byId))
    }
    if (filterPattern) {
      const exclusiveMap = buildExclusivePatternMap(all)
      filtered = filtered.filter(q => exclusiveMap[q.id] === filterPattern)
    }
    if (initStarred) filtered = filtered.filter(q => progress[q.id]?.starred)
    if (initSolved === true)  filtered = filtered.filter(q => progress[q.id]?.solved)
    if (initSolved === false) filtered = filtered.filter(q => !progress[q.id]?.solved)
    const next = isShuffled ? shuffle(filtered) : filtered
    setDeck(next)
    const navKey = `${filterDiff}|${filterSource}|${filterPattern}|${isShuffled}|${initSearch}|${initStarred}|${initSolved}|${all.length}`
    if (filterNavKeyRef.current !== navKey) {
      filterNavKeyRef.current = navKey
      setIdx(0)
      setFlipped(false)
    } else {
      setIdx(i => Math.min(i, Math.max(0, next.length - 1)))
    }
  }, [filterDiff, filterSource, filterPattern, all, isShuffled, initSearch, initStarred, initSolved, progress])

  const q = deck[idx] || null

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    fadeSwap(() => setFlipped(f => !f))
  }, [fadeSwap])

  const go = useCallback((dir: number) => {
    fadeSwap(() => {
      setFlipped(false)
      setIdx(i => Math.max(0, Math.min(deck.length - 1, i + dir)))
    })
  }, [deck.length, fadeSwap])

  const reset = () => fadeSwap(() => { setIdx(0); setFlipped(false) })

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, handleFlip])

  // Reset description when card changes
  useEffect(() => {
    if (!q?.slug) return
    setLcContent(lcCacheRef.current[q.slug] ?? null)
    setIsPremium(false)
  }, [q?.slug])

  // Fetch live LeetCode description (same pattern as learn page)
  useEffect(() => {
    if (!q?.slug) return
    if (lcCacheRef.current[q.slug]) { setLcContent(lcCacheRef.current[q.slug]); return }
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const session   = typeof window !== 'undefined' ? localStorage.getItem('lc_session')  || '' : ''
    const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('lc_csrf')     || '' : ''
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug: q.slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[q.slug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.slug])

  // Pattern coverage for the active pattern filter (exclusive — each question in one pattern only)
  const exclusiveMapAll = filterPattern ? buildExclusivePatternMap(all) : null
  const patternAllQs = filterPattern && exclusiveMapAll
    ? all.filter(q => exclusiveMapAll[q.id] === filterPattern)
    : []
  const patternSolvedCount = patternAllQs.filter(q => progress[String(q.id)]?.solved).length
  const patternPct = patternAllQs.length ? Math.round((patternSolvedCount / patternAllQs.length) * 100) : 0

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading flashcards...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
              <Layers className="text-indigo-500" /> Flashcards
            </h1>
            <p className="text-xs text-[var(--text-subtle)] mt-0.5">
              Tap card to flip · ← → to navigate · Space to flip
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1.5 rounded-full">
            {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
          </span>
          <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 px-3 py-1.5 rounded-full flex items-center gap-1">
            <CheckCircle size={11} /> {visited.size} visited
          </span>
          <button
            onClick={() => setIsShuffled(s => !s)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-colors ${
              isShuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
            }`}
          >
            <Shuffle size={12} /> Shuffle
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:brightness-110 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Pattern coverage banner */}
      {filterPattern && patternAllQs.length > 0 && (
        <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${
          patternPct === 100
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-500/30'
            : 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-500/30'
        }`}>
          <span className="text-xl shrink-0">🧩</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--text)]">{filterPattern}</span>
              <span className={`text-xs font-bold ${patternPct === 100 ? 'text-green-500' : patternPct >= 50 ? 'text-indigo-400' : 'text-amber-500'}`}>
                {patternSolvedCount}/{patternAllQs.length} solved ({patternPct}%)
              </span>
            </div>
            <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${patternPct === 100 ? 'bg-green-500' : patternPct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                style={{ width: patternPct + '%' }}
              />
            </div>
            {patternPct < 100 && (
              <p className="text-[11px] text-[var(--text-subtle)] mt-1">
                {patternAllQs.length - patternSolvedCount} more to go — keep grinding 💪
              </p>
            )}
            {patternPct === 100 && (
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-1 font-semibold">
                ✅ Pattern complete! Move to the next one.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 space-y-2">
        {/* Solved status */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString())
              sp.delete('solved')
              window.history.replaceState(null, '', sp.toString() ? `/flashcards?${sp.toString()}` : '/flashcards')
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              initSolved === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-400'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString())
              sp.set('solved', 'true')
              window.history.replaceState(null, '', `/flashcards?${sp.toString()}`)
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              initSolved === true ? 'bg-green-600 text-white border-green-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-green-400'
            }`}
          >
            Solved
          </button>
          <button
            type="button"
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString())
              sp.set('solved', 'false')
              window.history.replaceState(null, '', `/flashcards?${sp.toString()}`)
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              initSolved === false ? 'bg-orange-600 text-white border-orange-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-orange-400'
            }`}
          >
            Unsolved
          </button>
        </div>

        {/* Difficulty + Source */}
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LEVELS.map(d => (
            <button key={d} onClick={() => setFilterDiff(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
              }`}>
              {d}
            </button>
          ))}
          <span className="w-px bg-white/10 shrink-0" />
          {QUESTION_SOURCES.map(s => (
            <button key={s.value} onClick={() => setFilterSource(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterSource === s.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Pattern filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterPattern(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              !filterPattern ? 'bg-cyan-700 text-white border-cyan-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:border-cyan-500/50'
            }`}>
            All Patterns
          </button>
          {QUICK_PATTERNS.map(p => (
            <button key={p.name} onClick={() => setFilterPattern(filterPattern === p.name ? null : p.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterPattern === p.name ? 'bg-cyan-700 text-white border-cyan-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:border-cyan-500/50'
              }`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {deck.length === 0 && (
        <div className="text-center py-20 text-[var(--text-subtle)] text-sm">No questions match this filter.</div>
      )}

      {q && (
        <>
          {/* Card */}
          <div
            onClick={handleFlip}
            className="cursor-pointer select-none"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
          >
            {!flipped ? (
              /* FRONT */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-[var(--border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    {(q.source || []).map(s => (
                      <span key={s} className="text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/20">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const next = new Set(visited)
                        if (next.has(q.id)) { next.delete(q.id) } else { next.add(q.id); addFcVisited(q.id) }
                        setVisited(next)
                      }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        visited.has(q.id) ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/40' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
                      }`}
                    >
                      {visited.has(q.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                    </button>
                    <span className="hidden sm:inline text-xs text-[var(--text-subtle)] font-medium">Tap to reveal →</span>
                  </div>
                </div>

                <div className="px-5 pt-3 pb-1">
                  <h2 className="text-base font-bold text-[var(--text)]">{q.title}</h2>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(q.tags || []).map(tag => (
                      <span key={tag} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Live LeetCode description (same as learn page) */}
                <div className="px-5 pb-4 mt-2" onClick={e => e.stopPropagation()}>
                  {lcContent ? (
                    <div className="lc-description text-sm text-[var(--text)]"
                      dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                  ) : lcLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                      <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-2" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    </div>
                  ) : isPremium ? (
                    <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium question — <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">view on LeetCode ↗</a></p>
                  ) : (
                    <QuestionImage questionId={q.id} alt={q.title} className="bg-[var(--bg-muted)]" />
                  )}
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-500/40 shadow-xl shadow-indigo-900/20 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-900/30">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="text-sm font-bold text-indigo-700 truncate">{q.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); handleFlip() }}
                      className="text-xs text-indigo-400 font-medium"
                    >
                      ← Flip back
                    </button>
                  </div>
                </div>

                {/* Stop propagation so language tabs / copy don't accidentally flip the card */}
                <div className="p-4" onClick={e => e.stopPropagation()}>
                  <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[160px] sm:max-w-none">
              {deck.length <= 15 ? (
                deck.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setIdx(i); setFlipped(false) }}
                    className={`rounded-full transition-all ${
                      i === idx ? 'w-4 h-4 bg-indigo-500' : 'w-3 h-3 bg-[var(--bg-muted)] hover:brightness-125'
                    }`}
                  />
                ))
              ) : (
                <span className="text-xs text-[var(--text-subtle)] font-mono">{idx + 1} / {deck.length}</span>
              )}
            </div>

            <button
              onClick={() => go(1)}
              disabled={idx === deck.length - 1}
              className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading flashcards...</div>}>
      <FlashcardsInner />
    </Suspense>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw, Layers, CheckCircle, Circle, Code2 } from 'lucide-react'
import { getFcVisited, addFcVisited } from '@/lib/db'
import { getSetProgress, type SetQProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import { learnHrefForSetQuestion } from '@/lib/dailyExtension'
import { shuffle, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { DIFFICULTY_LEVELS, DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import QuestionImage from '@/components/QuestionImage'
import BestAnswersDeck from '@/components/BestAnswersDeck'

interface Props { set: 2 | 3 }

export default function SetFlashcardsTab({ set }: Props) {
  const [allQuestions, setAllQuestions] = useState<SetQuestion[]>([])
  const [set2Questions, setSet2Questions] = useState<SetQuestion[]>([])
  const [set3Questions, setSet3Questions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<Record<string, SetQProgress>>({})
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [idx, setIdx] = useState(0)
  const [filterDiff, setFilterDiff] = useState('All')
  const [filterPattern, setFilterPattern] = useState<string | null>(null)
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [sessionSeen, setSessionSeen] = useState<Set<number>>(new Set())
  const filterNavKeyRef = useRef<string | null>(null)

  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [cardExpanded, setCardExpanded] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

  const exclusiveMapAll = useMemo(() => buildExclusivePatternMap(allQuestions), [allQuestions])
  const sortedPatterns = useMemo(
    () => (QUICK_PATTERNS as unknown as { name: string; tags: readonly string[] }[])
      .slice()
      .sort((a, b) =>
        DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
        DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number])
      ),
    []
  )

  useEffect(() => {
    async function load() {
      const [main, vis] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getFcVisited(),
      ])
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const s2 = getSet2Questions(mainIds, main)
      const s3 = getSet3Questions(mainIds, main)
      setSet2Questions(s2)
      setSet3Questions(s3)
      setAllQuestions(set === 2 ? s2 : s3)
      setProgress(getSetProgress(set))
      setVisited(vis)
      setLoading(false)
    }
    load()
  }, [set])

  const deck = useMemo(() => {
    let filtered = allQuestions
    if (filterDiff !== 'All') filtered = filtered.filter(q => q.difficulty === filterDiff)
    if (filterPattern) filtered = filtered.filter(q => exclusiveMapAll[q.id] === filterPattern)
    if (isShuffled) return shuffle(filtered)
    return filtered
  }, [allQuestions, filterDiff, filterPattern, isShuffled, exclusiveMapAll])

  useEffect(() => {
    const navKey = `${filterDiff}|${filterPattern}|${isShuffled}|${allQuestions.length}`
    if (filterNavKeyRef.current !== navKey) {
      filterNavKeyRef.current = navKey
      setIdx(0)
      setFlipped(false)
    } else {
      setIdx(i => Math.min(i, Math.max(0, deck.length - 1)))
    }
  }, [deck.length, filterDiff, filterPattern, isShuffled, allQuestions.length])

  const q = deck[idx] ?? null

  useEffect(() => {
    if (q?.id != null) setSessionSeen(prev => new Set([...prev, q.id]))
  }, [q?.id])

  useEffect(() => {
    if (!q?.slug) return
    const titleSlug = resolveLeetCodeSlug(q.id, q.slug)
    setLcContent(lcCacheRef.current[titleSlug] ?? null)
    setIsPremium(false)
    setCardExpanded(false)
  }, [q?.id, q?.slug])

  useEffect(() => {
    if (!q?.slug) return
    const titleSlug = resolveLeetCodeSlug(q.id, q.slug)
    if (lcCacheRef.current[titleSlug]) { setLcContent(lcCacheRef.current[titleSlug]); return }
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
        variables: { titleSlug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[titleSlug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.id, q?.slug])

  const patternAllQs = filterPattern
    ? allQuestions.filter(q => exclusiveMapAll[q.id] === filterPattern)
    : []
  const patternSolvedCount = patternAllQs.filter(q => progress[String(q.id)]?.solved).length
  const patternPct = patternAllQs.length ? Math.round((patternSolvedCount / patternAllQs.length) * 100) : 0

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    fadeSwap(() => setFlipped(f => !f))
  }, [fadeSwap])

  const go = useCallback((dir: number) => {
    fadeSwap(() => { setFlipped(false); setIdx(i => Math.max(0, Math.min(deck.length - 1, i + dir))) })
  }, [deck.length, fadeSwap])

  const reset = () => fadeSwap(() => { setIdx(0); setFlipped(false) })

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

  if (loading) return (
    <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading flashcards...</div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
              <Layers className="text-indigo-500" /> Flashcards — Set {set}
            </h1>
            <p className="text-xs text-[var(--text-subtle)] mt-0.5">
              Tap card to flip · ← → to navigate · Space to flip
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-full">
            {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
          </span>
          <span className="bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-full flex items-center gap-1">
            <CheckCircle size={11} /> {deck.filter(dq => visited.has(dq.id)).length}/{deck.length} visited
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

      {filterPattern && patternAllQs.length > 0 && (
        <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${
          patternPct === 100
            ? 'bg-green-50 border-green-200'
            : 'bg-violet-50 border-violet-200'
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
          </div>
        </div>
      )}

      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LEVELS.map(d => (
            <button key={d} onClick={() => setFilterDiff(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterPattern(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              !filterPattern ? 'bg-cyan-700 text-white border-cyan-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:border-cyan-500/50'
            }`}>
            All Patterns
          </button>
          {sortedPatterns.map(p => (
            <button key={p.name} onClick={() => setFilterPattern(filterPattern === p.name ? null : p.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterPattern === p.name ? 'bg-cyan-700 text-white border-cyan-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:border-cyan-500/50'
              }`}>
              {p.name}
              <PriorityBadge pattern={p.name} active={filterPattern === p.name} />
            </button>
          ))}
        </div>
      </div>

      {deck.length === 0 && (
        <div className="text-center py-20 text-[var(--text-subtle)] text-sm">No questions match this filter.</div>
      )}

      {q && (
        <>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[160px] sm:max-w-none">
              {deck.length <= 15 ? deck.map((_, i) => (
                <button key={i} onClick={() => { setIdx(i); setFlipped(false) }}
                  className={`rounded-full transition-all ${i === idx ? 'w-4 h-4 bg-indigo-500' : 'w-3 h-3 bg-[var(--bg-muted)] hover:brightness-125'}`} />
              )) : (
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

          <Link
            href={learnHrefForSetQuestion(q.id, set, set2Questions, set3Questions) + '?from=flashcards'}
            className="mb-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
          >
            <Code2 size={15} /> Code it →
          </Link>

          <div
            onClick={handleFlip}
            className="cursor-pointer select-none"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
          >
            {!flipped ? (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-[var(--border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <PriorityBadge pattern={exclusiveMapAll[q.id] ?? ''} />
                  </div>
                  <div className="flex items-center gap-2">
                    {sessionSeen.has(q.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-400 border border-indigo-200 font-semibold shrink-0">seen</span>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const next = new Set(visited)
                        if (next.has(q.id)) { next.delete(q.id) } else { next.add(q.id); addFcVisited(q.id) }
                        setVisited(next)
                      }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        visited.has(q.id) ? 'bg-green-100 text-green-600 border-green-300' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
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

                <div className="px-5 pb-4 mt-2" onClick={e => e.stopPropagation()}>
                  {lcContent ? (
                    <>
                      <div className={`relative ${!cardExpanded ? 'max-h-[200px] overflow-hidden' : ''}`}>
                        <div className="lc-description text-sm text-[var(--text)]"
                          dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                        {!cardExpanded && (
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--bg-card)] to-transparent pointer-events-none" />
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setCardExpanded(v => !v) }}
                        className="mt-2 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        {cardExpanded ? '↑ Show less' : '↓ Show more'}
                      </button>
                    </>
                  ) : lcLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                      <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-2" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    </div>
                  ) : isPremium ? (
                    <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium question — <a href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">view on LeetCode ↗</a></p>
                  ) : (
                    <QuestionImage questionId={q.id} alt={q.title} className="bg-[var(--bg-muted)]" />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-500/40 shadow-xl shadow-indigo-900/20 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-indigo-200 bg-indigo-50">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <PriorityBadge pattern={exclusiveMapAll[q.id] ?? ''} />
                    <span className="text-sm font-bold text-indigo-700 truncate">{q.title}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleFlip() }}
                    className="text-xs text-indigo-400 font-medium shrink-0"
                  >
                    ← Flip back
                  </button>
                </div>
                <div className="p-4" onClick={e => e.stopPropagation()}>
                  <BestAnswersDeck
                    questionId={q.id}
                    slug={resolveLeetCodeSlug(q.id, q.slug)}
                    active={flipped}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

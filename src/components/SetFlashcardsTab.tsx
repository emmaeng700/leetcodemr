'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink, CheckCircle, Circle, Star, RotateCcw } from 'lucide-react'
import { getSetProgress, updateSetQProgress, type SetQProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'
import { resolveLeetCodeSlug, stripScripts, leetCodeUrl } from '@/lib/utils'

interface Props { set: 2 | 3 }

type DiffFilter = 'All' | 'Easy' | 'Medium' | 'Hard'

export default function SetFlashcardsTab({ set }: Props) {
  const [allQuestions, setAllQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<Record<string, SetQProgress>>({})
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [idx, setIdx] = useState(0)
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('All')
  const [catFilter, setCatFilter] = useState<string>('All')

  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [cardExpanded, setCardExpanded] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds) : getSet3Questions(mainIds)
      setAllQuestions(qs)
      setProgress(getSetProgress(set))
      setLoading(false)
    }
    load()
  }, [set])

  const categories = ['All', ...Array.from(new Set(allQuestions.map(q => q.category))).sort()]

  const deck = allQuestions.filter(q => {
    if (diffFilter !== 'All' && q.difficulty !== diffFilter) return false
    if (catFilter !== 'All' && q.category !== catFilter) return false
    return true
  })

  const q = deck[idx] ?? null

  // Reset LC description when card changes
  useEffect(() => {
    if (!q?.slug) return
    const titleSlug = resolveLeetCodeSlug(q.id, q.slug)
    setLcContent(lcCacheRef.current[titleSlug] ?? null)
    setIsPremium(false)
    setCardExpanded(false)
  }, [q?.id, q?.slug])

  // Fetch live LeetCode description
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

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 160)
  }, [])

  const go = useCallback((dir: number) => {
    fadeSwap(() => { setFlipped(false); setIdx(i => Math.max(0, Math.min(deck.length - 1, i + dir))) })
  }, [deck.length, fadeSwap])

  useEffect(() => { setIdx(0); setFlipped(false) }, [diffFilter, catFilter])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  function toggleSolved(qId: number) {
    const cur = progress[String(qId)]
    const updated = updateSetQProgress(set, qId, { solved: !cur?.solved })
    setProgress(prev => ({ ...prev, [String(qId)]: updated }))
  }

  function toggleStar(qId: number) {
    const cur = progress[String(qId)]
    const updated = updateSetQProgress(set, qId, { starred: !cur?.starred })
    setProgress(prev => ({ ...prev, [String(qId)]: updated }))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm animate-pulse">
      Loading flashcards…
    </div>
  )

  const solvedCount = deck.filter(q => progress[String(q.id)]?.solved).length
  const solutionBase = set === 2 ? '/neetcode' : '/algomaster'
  const solutionLabel = set === 2 ? 'NeetCode' : 'AlgoMaster'
  const solutionColor = set === 2 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-black text-[var(--text)] text-base">Flashcards — Set {set}</h2>
          <p className="text-xs text-[var(--text-subtle)] mt-0.5">
            {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`} · {solvedCount} solved · Tap card to flip
          </p>
        </div>
        <button onClick={() => { setIdx(0); setFlipped(false) }}
          className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
            <button key={d} onClick={() => setDiffFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                diffFilter === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                catFilter === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-400'
              }`}>
              {c}
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
            <button onClick={() => go(-1)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-400 transition-colors"
              style={{ opacity: idx === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={15} /> Prev
            </button>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[160px]">
              {deck.length <= 15 ? deck.map((_, i) => (
                <button key={i} onClick={() => { setIdx(i); setFlipped(false) }}
                  className={`rounded-full transition-all ${i === idx ? 'w-4 h-4 bg-indigo-500' : 'w-3 h-3 bg-[var(--bg-muted)] hover:brightness-125'}`} />
              )) : (
                <span className="text-xs text-[var(--text-subtle)] font-mono">{idx + 1} / {deck.length}</span>
              )}
            </div>
            <button onClick={() => go(1)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              style={{ opacity: idx === deck.length - 1 ? 0.3 : 1 }}>
              Next <ChevronRight size={15} />
            </button>
          </div>

          <div onClick={() => setFlipped(f => !f)}
            className="cursor-pointer select-none"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.16s ease' }}>

            {!flipped ? (
              /* FRONT */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2 border-b border-[var(--border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{q.category}</span>
                  </div>
                  <span className="text-xs text-[var(--text-subtle)]">Tap to flip →</span>
                </div>
                <div className="px-5 pt-4 pb-2">
                  <h3 className="text-lg font-bold text-[var(--text)]">{q.title}</h3>
                </div>
                {/* Live LeetCode description */}
                <div className="px-5 pb-4" onClick={e => e.stopPropagation()}>
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
                        className="mt-2 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
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
                    <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium — <a href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">view on LeetCode ↗</a></p>
                  ) : null}
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-400/50 shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2 border-b border-indigo-200 bg-indigo-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="font-bold text-sm text-indigo-700">{q.title}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation() }} className="text-xs text-indigo-400">← Flip back</button>
                </div>
                <div className="px-5 py-5 space-y-3" onClick={e => e.stopPropagation()}>
                  <Link href={`${solutionBase}/${q.slug}`}
                    className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl ${solutionColor} text-white font-semibold text-sm transition-colors`}>
                    <ExternalLink size={14} /> View Solution on {solutionLabel}
                  </Link>
                  <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors">
                    <ExternalLink size={14} /> Open on LeetCode
                  </a>
                  <div className="flex gap-2">
                    <button onClick={() => toggleSolved(q.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        progress[String(q.id)]?.solved
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-green-400'
                      }`}>
                      {progress[String(q.id)]?.solved ? <><CheckCircle size={13} /> Solved</> : <><Circle size={13} /> Mark Solved</>}
                    </button>
                    <button onClick={() => toggleStar(q.id)}
                      className={`px-4 py-2.5 rounded-xl border transition-colors ${
                        progress[String(q.id)]?.starred
                          ? 'bg-yellow-400 text-white border-yellow-400'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-yellow-400'
                      }`}>
                      <Star size={14} fill={progress[String(q.id)]?.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

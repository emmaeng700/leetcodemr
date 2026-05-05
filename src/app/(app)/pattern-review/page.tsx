'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Clock, Layers } from 'lucide-react'
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'
import DifficultyBadge from '@/components/DifficultyBadge'

interface ReviewQuestion {
  id: number
  title: string
  slug: string
  solution_url: string
  key_insights: string
  space_and_time_complexity: string
  solution: string
  pattern: string
}

interface FullQuestion {
  id: number
  difficulty: string
}

export default function PatternReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewQuestion[]>([])
  const [diffMap, setDiffMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [activePattern, setActivePattern] = useState<string>(DISPLAY_PATTERN_ORDER[0])
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/quick_review_info.json').then(r => r.json()),
      fetch('/questions_full.json').then(r => r.json()),
    ]).then(([review, full]: [ReviewQuestion[], FullQuestion[]]) => {
      setReviewData(review)
      const dm: Record<number, string> = {}
      for (const q of full) dm[q.id] = q.difficulty
      setDiffMap(dm)
      setLoading(false)
    })
  }, [])

  // Group by pattern, ordered by DISPLAY_PATTERN_ORDER
  const grouped = useMemo(() => {
    const map: Record<string, ReviewQuestion[]> = {}
    for (const q of reviewData) {
      if (!map[q.pattern]) map[q.pattern] = []
      map[q.pattern].push(q)
    }
    return DISPLAY_PATTERN_ORDER
      .filter(p => map[p]?.length > 0)
      .map(p => ({ pattern: p, questions: map[p] }))
  }, [reviewData])

  const scrollToPattern = (pattern: string) => {
    setActivePattern(pattern)
    const el = sectionRefs.current[pattern]
    if (!el) return
    const container = scrollContainerRef.current
    if (container) {
      const top = el.offsetTop - 16
      container.scrollTo({ top, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleCard = (id: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Track active pattern on scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      for (const p of [...DISPLAY_PATTERN_ORDER].reverse()) {
        const el = sectionRefs.current[p]
        if (el && el.offsetTop - 80 <= container.scrollTop) {
          setActivePattern(p)
          return
        }
      }
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [grouped])

  if (loading) {
    return (
      <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">
        Loading pattern review…
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] overflow-y-auto">
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-3">
            <Layers size={12} />
            Patterns
          </div>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {grouped.map(({ pattern, questions }) => (
            <button
              key={pattern}
              type="button"
              onClick={() => scrollToPattern(pattern)}
              className={`w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePattern === pattern
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
              }`}
            >
              <span className="truncate">{pattern}</span>
              <span className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                activePattern === pattern
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'
              }`}>
                {questions.length}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Mobile pattern strip ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 whitespace-nowrap">
          {grouped.map(({ pattern, questions }) => (
            <button
              key={pattern}
              type="button"
              onClick={() => scrollToPattern(pattern)}
              className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                activePattern === pattern
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
              }`}
            >
              {pattern} <span className="opacity-70">·{questions.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-20 md:pb-8"
      >
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-2 mb-1">
              <BookOpen size={22} className="text-indigo-500" />
              Pattern Review
            </h1>
            <p className="text-sm text-[var(--text-subtle)]">
              {reviewData.length} questions across {grouped.length} patterns — ordered fewest to most.
              Expand any card for the full solution.
            </p>
          </div>

          {/* Pattern sections */}
          {grouped.map(({ pattern, questions }) => (
            <section
              key={pattern}
              ref={el => { sectionRefs.current[pattern] = el }}
              className="mb-10"
            >
              {/* Pattern header */}
              <div className="flex items-center gap-3 mb-3 sticky top-0 z-10 bg-[var(--bg)] py-2 -mx-4 px-4">
                <h2 className="text-base font-black text-[var(--text)]">{pattern}</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {questions.length} questions
                </span>
              </div>

              {/* Question cards */}
              <div className="space-y-3">
                {questions.map(q => {
                  const expanded = expandedCards.has(q.id)
                  const diff = diffMap[q.id]
                  const insights = q.key_insights
                    .split('\n')
                    .map(l => l.replace(/^[-•]\s*/, '').trim())
                    .filter(Boolean)
                  const [timeLine, spaceLine] = q.space_and_time_complexity
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean)

                  return (
                    <div
                      key={q.id}
                      className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
                    >
                      {/* Card header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleCard(q.id)}
                        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-[var(--bg-muted)]/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-xs font-mono text-[var(--text-subtle)]">#{q.id}</span>
                            {diff && <DifficultyBadge difficulty={diff} />}
                          </div>
                          <p className="text-sm font-bold text-[var(--text)] leading-snug">{q.title}</p>

                          {/* Key insights — always shown */}
                          <ul className="mt-2 space-y-1">
                            {insights.map((ins, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
                                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                                {ins}
                              </li>
                            ))}
                          </ul>

                          {/* Complexity pills */}
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {timeLine && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Clock size={9} />
                                {timeLine.replace('Time Complexity:', '').replace('Time:', '').trim()}
                              </span>
                            )}
                            {spaceLine && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                <Layers size={9} />
                                {spaceLine.replace('Space Complexity:', '').replace('Space:', '').trim()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <a
                            href={q.solution_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-[var(--text-subtle)] hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <span className="text-[var(--text-subtle)]">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </button>

                      {/* Expanded: full solution */}
                      {expanded && (
                        <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-muted)]/30">
                          <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-widest mb-2">Solution</p>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                            {q.solution}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

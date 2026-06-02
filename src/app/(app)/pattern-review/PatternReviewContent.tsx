'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ExternalLink, Layers, X, ChevronRight } from 'lucide-react'
import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import PriorityBadge from '@/components/PriorityBadge'
import DifficultyBadge from '@/components/DifficultyBadge'

interface ReviewQuestion {
  id: number
  title: string
  slug: string
  solution_url: string
  key_insights: string
  space_and_time_complexity?: string
  complexity?: string          // alternate field name used by some generator versions
  solution: string
  pattern: string
}

interface FullQuestion {
  id: number
  difficulty: string
  tags?: string[]
}

// Hub-safe version — uses h-full so the parent constrains the height.
export default function PatternReviewContent() {
  const [reviewData, setReviewData] = useState<ReviewQuestion[]>([])
  const [diffMap, setDiffMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [activePattern, setActivePattern] = useState<string>(DISPLAY_PATTERN_ORDER[0])
  const [mobileDrawer, setMobileDrawer] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/quick_review_info.json').then(r => r.json()),
      fetch('/questions_full.json').then(r => r.json()),
    ]).then(([review, full]: [ReviewQuestion[], FullQuestion[]]) => {
      // Build pattern map from full questions (exclusive assignment — same logic as the rest of the app)
      const patternMap = buildExclusivePatternMap(full as any[])

      // Merge derived pattern into each review entry when the JSON doesn't have it
      const merged: ReviewQuestion[] = (review as ReviewQuestion[]).map(q => ({
        ...q,
        pattern: q.pattern || patternMap[q.id] || '',
      }))

      setReviewData(merged)
      const dm: Record<number, string> = {}
      for (const q of full) dm[q.id] = q.difficulty
      setDiffMap(dm)
      setLoading(false)
    })
  }, [])

  // Group by pattern in DISPLAY_PATTERN_ORDER; within each pattern sort Easy → Medium → Hard
  const grouped = useMemo(() => {
    const DIFF_RANK: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
    const map: Record<string, ReviewQuestion[]> = {}
    for (const q of reviewData) {
      if (!map[q.pattern]) map[q.pattern] = []
      map[q.pattern].push(q)
    }
    return DISPLAY_PATTERN_ORDER
      .filter(p => map[p]?.length > 0)
      .map(p => ({
        pattern: p,
        questions: map[p].slice().sort((a, b) => {
          const da = DIFF_RANK[diffMap[a.id] ?? ''] ?? 1
          const db = DIFF_RANK[diffMap[b.id] ?? ''] ?? 1
          return da !== db ? da - db : a.id - b.id
        }),
      }))
  }, [reviewData, diffMap])

  const scrollToPattern = (pattern: string) => {
    setActivePattern(pattern)
    const el = sectionRefs.current[pattern]
    if (!el) return
    const container = scrollContainerRef.current
    if (container) {
      const elTop = el.getBoundingClientRect().top
      const containerTop = container.getBoundingClientRect().top
      const targetScroll = container.scrollTop + (elTop - containerTop) - 8
      container.scrollTo({ top: targetScroll, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Highlight active pattern on scroll (using getBoundingClientRect for accuracy)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      const containerTop = container.getBoundingClientRect().top
      for (const p of [...DISPLAY_PATTERN_ORDER].reverse()) {
        const el = sectionRefs.current[p]
        if (el && el.getBoundingClientRect().top - containerTop <= 60) {
          setActivePattern(p)
          return
        }
      }
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [grouped])

  // Close drawer on outside scroll
  useEffect(() => {
    if (mobileDrawer) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileDrawer])

  const activeGroup = grouped.find(g => g.pattern === activePattern)

  if (loading) {
    return (
      <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">
        Loading pattern review…
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] overflow-y-auto">
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-3 flex items-center gap-1">
            <Layers size={10} /> Patterns
          </p>
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
              <span className="truncate flex-1">{pattern}</span>
              <div className="flex items-center gap-1 shrink-0">
                <PriorityBadge pattern={pattern} />
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                  activePattern === pattern
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'
                }`}>
                  {questions.length}
                </span>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main scroll area ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text)] flex items-center gap-2 mb-1">
              <BookOpen size={20} className="text-indigo-500 shrink-0" />
              Pattern Review
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-subtle)]">
              {reviewData.length} questions across {grouped.length} patterns
            </p>
          </div>

          {grouped.map(({ pattern, questions }, gi) => {
            const pri = PATTERN_PRIORITY[pattern] ?? 'Low'
            const prevPri = gi > 0 ? (PATTERN_PRIORITY[grouped[gi - 1].pattern] ?? 'Low') : null
            const showTier = pri !== prevPri
            const tierStyles = {
              High: { pill: 'bg-red-50 text-red-700 border-red-200', line: 'bg-red-200', dot: '🔴' },
              Mid:  { pill: 'bg-amber-50 text-amber-700 border-amber-200', line: 'bg-amber-200', dot: '🟡' },
              Low:  { pill: 'bg-gray-100 text-gray-500 border-gray-200', line: 'bg-gray-200', dot: '⚪' },
            }[pri] ?? { pill: 'bg-gray-100 text-gray-500 border-gray-200', line: 'bg-gray-200', dot: '⚪' }
            return (
            <Fragment key={pattern}>
            {showTier && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 mt-4">
                <div className={`h-px flex-1 rounded-full ${tierStyles.line}`} />
                <span className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${tierStyles.pill}`}>
                  {tierStyles.dot} {pri} Priority Patterns
                </span>
                <div className={`h-px flex-1 rounded-full ${tierStyles.line}`} />
              </div>
            )}
            <section
              ref={el => { sectionRefs.current[pattern] = el }}
              className="mb-10 sm:mb-12"
            >
              {/* Pattern heading */}
              <div className="sticky top-0 z-10 bg-[var(--bg)] -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3 border-b border-[var(--border)]">
                <h2 className="text-sm sm:text-base font-black text-[var(--text)] truncate">{pattern}</h2>
                <PriorityBadge pattern={pattern} />
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {questions.length}
                </span>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {questions.map(q => {
                  const diff = diffMap[q.id]

                  const insights = q.key_insights
                    .split('\n')
                    .map(l => l.replace(/^[-•]\s*/, '').trim())
                    .filter(Boolean)

                  const complexityLines = (q.space_and_time_complexity || q.complexity || '')
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean)

                  return (
                    <div
                      key={q.id}
                      className="bg-[var(--bg-card)] rounded-xl sm:rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 flex items-start justify-between gap-2 border-b border-[var(--border)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-mono text-[var(--text-subtle)]">#{q.id}</span>
                            {diff && <DifficultyBadge difficulty={diff} />}
                          </div>
                          <p className="text-sm font-bold text-[var(--text)] leading-snug">{q.title}</p>
                        </div>
                        <a
                          href={q.solution_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded-lg text-[var(--text-subtle)] hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* Key Insights */}
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--border)]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-2">
                          Key Insights
                        </p>
                        <ul className="space-y-1.5">
                          {insights.map((ins, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)] leading-relaxed">
                              <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                              <span>{ins}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Complexity */}
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--border)] bg-[var(--bg-muted)]/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">
                          Complexity
                        </p>
                        <div className="space-y-1">
                          {complexityLines.map((line, i) => (
                            <p key={i} className="text-xs text-[var(--text-muted)] font-mono leading-relaxed break-words">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Solution */}
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                          Solution
                        </p>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                          {q.solution}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
            </Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Mobile: floating pattern picker button ── */}
      <button
        type="button"
        onClick={() => setMobileDrawer(true)}
        className="md:hidden fixed bottom-5 right-4 z-50 flex items-center gap-2 bg-indigo-600 text-white pl-3 pr-4 py-3 rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.5)] text-sm font-semibold active:scale-95 transition-transform"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <Layers size={15} />
        <span className="max-w-[140px] truncate">{activePattern}</span>
        <ChevronRight size={14} className="opacity-70 -rotate-90" />
      </button>

      {/* ── Mobile: bottom sheet drawer ── */}
      {mobileDrawer && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close pattern picker"
            className="md:hidden fixed inset-0 z-[95] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileDrawer(false)}
          />

          {/* Sheet */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-card)] rounded-t-2xl border-t border-[var(--border)] shadow-[0_-8px_40px_rgba(0,0,0,0.15)] flex flex-col"
            style={{ maxHeight: '75dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
              <div>
                <p className="text-sm font-bold text-[var(--text)]">Jump to Pattern</p>
                <p className="text-xs text-[var(--text-subtle)]">{grouped.length} patterns</p>
              </div>
              <button
                onClick={() => setMobileDrawer(false)}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pattern list */}
            <div className="overflow-y-auto overscroll-contain flex-1">
              <div className="px-3 py-2 space-y-1 pb-4">
                {grouped.map(({ pattern, questions }) => (
                  <button
                    key={pattern}
                    type="button"
                    onClick={() => { scrollToPattern(pattern); setMobileDrawer(false) }}
                    className={`w-full text-left flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      activePattern === pattern
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <span className="font-medium">{pattern}</span>
                    <span className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded-full ${
                      activePattern === pattern
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'
                    }`}>
                      {questions.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

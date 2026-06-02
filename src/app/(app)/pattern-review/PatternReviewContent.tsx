'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Layers, X } from 'lucide-react'
import { PATTERN_PRIORITY } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'

interface ReviewQuestion {
  id: number
  title: string
  slug: string
  solution_url: string
  key_insights: string
  space_and_time_complexity?: string
  complexity?: string
  solution: string
  pattern: string
}

interface FullQuestion {
  id: number
  difficulty: string
  tags?: string[]
}

// 9 rounds in priority+difficulty study order (matches the rest of the app)
const ROUNDS = [
  { key: 'High-Easy',   priority: 'High', diff: 'Easy',   dot: '🔴', diffDot: '🟢' },
  { key: 'High-Medium', priority: 'High', diff: 'Medium', dot: '🔴', diffDot: '🟡' },
  { key: 'High-Hard',   priority: 'High', diff: 'Hard',   dot: '🔴', diffDot: '🔴' },
  { key: 'Mid-Easy',    priority: 'Mid',  diff: 'Easy',   dot: '🟡', diffDot: '🟢' },
  { key: 'Mid-Medium',  priority: 'Mid',  diff: 'Medium', dot: '🟡', diffDot: '🟡' },
  { key: 'Mid-Hard',    priority: 'Mid',  diff: 'Hard',   dot: '🟡', diffDot: '🔴' },
  { key: 'Low-Easy',    priority: 'Low',  diff: 'Easy',   dot: '⚪', diffDot: '🟢' },
  { key: 'Low-Medium',  priority: 'Low',  diff: 'Medium', dot: '⚪', diffDot: '🟡' },
  { key: 'Low-Hard',    priority: 'Low',  diff: 'Hard',   dot: '⚪', diffDot: '🔴' },
]

const PRIORITY_PILL: Record<string, string> = {
  High: 'bg-red-50 text-red-700 border-red-200',
  Mid:  'bg-amber-50 text-amber-700 border-amber-200',
  Low:  'bg-gray-100 text-gray-600 border-gray-200',
}

// Hub-safe version — uses h-full so the parent constrains the height.
export default function PatternReviewContent() {
  const [reviewData, setReviewData]   = useState<ReviewQuestion[]>([])
  const [diffMap, setDiffMap]         = useState<Record<number, string>>({})
  const [patternMap, setPatternMap]   = useState<Record<number, string>>({})
  const [loading, setLoading]         = useState(true)
  const [activeRound, setActiveRound] = useState(ROUNDS[0].key)
  const [mobileDrawer, setMobileDrawer] = useState(false)
  const sectionRefs   = useRef<Record<string, HTMLElement | null>>({})
  const scrollRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/quick_review_info.json').then(r => r.json()),
      fetch('/questions_full.json').then(r => r.json()),
    ]).then(([review, full]: [ReviewQuestion[], FullQuestion[]]) => {
      const pm = buildExclusivePatternMap(full as any[])
      const dm: Record<number, string> = {}
      for (const q of full) dm[q.id] = q.difficulty
      const merged: ReviewQuestion[] = (review as ReviewQuestion[]).map(q => ({
        ...q,
        pattern: q.pattern || pm[q.id] || '',
      }))
      setReviewData(merged)
      setDiffMap(dm)
      setPatternMap(pm)
      setLoading(false)
    })
  }, [])

  // Group into 9 rounds
  const rounds = useMemo(() => {
    return ROUNDS.map(r => ({
      ...r,
      questions: reviewData.filter(q => {
        const pri = PATTERN_PRIORITY[q.pattern] ?? PATTERN_PRIORITY[patternMap[q.id] ?? ''] ?? ''
        const diff = diffMap[q.id] ?? ''
        return pri === r.priority && diff === r.diff
      }).sort((a, b) => a.id - b.id),
    }))
  }, [reviewData, diffMap, patternMap])

  const scrollTo = (key: string) => {
    setActiveRound(key)
    const el = sectionRefs.current[key]
    const container = scrollRef.current
    if (!el || !container) return
    let offset = 0
    let cur: HTMLElement | null = el
    while (cur && cur !== container) {
      offset += cur.offsetTop
      cur = cur.offsetParent as HTMLElement | null
    }
    container.scrollTo({ top: offset, behavior: 'smooth' })
    setMobileDrawer(false)
  }

  // Track active round on scroll
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      const top = container.getBoundingClientRect().top
      for (const r of [...ROUNDS].reverse()) {
        const el = sectionRefs.current[r.key]
        if (el && el.getBoundingClientRect().top - top <= 60) {
          setActiveRound(r.key)
          return
        }
      }
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [rounds])

  useEffect(() => {
    if (mobileDrawer) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileDrawer])

  if (loading) return (
    <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">
      Loading pattern review…
    </div>
  )

  const SidebarContent = () => (
    <nav className="flex-1 px-2 pb-4 space-y-0.5">
      {rounds.map(r => (
        <button
          key={r.key}
          type="button"
          onClick={() => scrollTo(r.key)}
          className={`w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeRound === r.key
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
          }`}
        >
          <span className="truncate flex-1">
            {r.dot} {r.priority} · {r.diffDot} {r.diff}
          </span>
          <span className="shrink-0 text-[10px] font-bold text-[var(--text-subtle)]">
            {r.questions.length}
          </span>
        </button>
      ))}
    </nav>
  )

  return (
    <div className="flex h-full overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] overflow-y-auto">
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-3 flex items-center gap-1">
            <Layers size={10} /> Rounds
          </p>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileDrawer && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileDrawer(false)} />
          <div className="fixed inset-y-0 left-0 w-56 bg-[var(--bg-card)] z-50 flex flex-col md:hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-xs font-bold text-[var(--text)]">Rounds</span>
              <button onClick={() => setMobileDrawer(false)}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <SidebarContent />
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile drawer toggle */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
          <button
            onClick={() => setMobileDrawer(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg-muted)]"
          >
            <Layers size={12} />
            {rounds.find(r => r.key === activeRound)?.dot}{' '}
            {rounds.find(r => r.key === activeRound)?.priority} · {rounds.find(r => r.key === activeRound)?.diff}
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 pb-24 md:pb-8">
          {rounds.map(r => (
            <section
              key={r.key}
              ref={el => { sectionRefs.current[r.key] = el }}
              className="mb-12"
            >
              {/* Round heading */}
              <div className="sticky top-0 z-10 bg-[var(--bg)] -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 mb-4 border-b border-[var(--border)] flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${PRIORITY_PILL[r.priority]}`}>
                  {r.dot} {r.priority}
                </span>
                <h2 className="text-sm font-black text-[var(--text)]">
                  {r.diffDot} {r.diff}
                </h2>
                <span className="text-[11px] font-bold text-[var(--text-subtle)] ml-auto">
                  {r.questions.length} questions
                </span>
              </div>

              {r.questions.length === 0 && (
                <p className="text-sm text-[var(--text-subtle)] py-4">No questions in this section.</p>
              )}

              <div className="space-y-4">
                {r.questions.map(q => {
                  const complexity = q.space_and_time_complexity || q.complexity || ''
                  const insightLines = (q.key_insights || '')
                    .split('\n').map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
                  const complexityLines = complexity
                    .split('\n').map(l => l.trim()).filter(Boolean)
                  const solutionParas = (q.solution || '')
                    .split('\n\n').map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)

                  return (
                    <div key={q.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                          <span className="font-bold text-sm text-[var(--text)] truncate">{q.title}</span>
                          <DifficultyBadge difficulty={diffMap[q.id] ?? ''} />
                        </div>
                        {q.solution_url && (
                          <a href={q.solution_url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
                            SimplyLeet <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      {/* Pattern badge */}
                      {q.pattern && (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-subtle)] border border-[var(--border)]">
                          🧩 {q.pattern}
                        </span>
                      )}

                      {/* Key Insights */}
                      {insightLines.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-1.5">Key Insights</p>
                          <ul className="space-y-1">
                            {insightLines.map((line, i) => (
                              <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)] leading-relaxed">
                                <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Complexity */}
                      {complexityLines.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-1.5">Complexity</p>
                          <ul className="space-y-0.5">
                            {complexityLines.map((line, i) => (
                              <li key={i} className="text-xs text-[var(--text-muted)]">{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Solution */}
                      {solutionParas.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-1.5">Solution</p>
                          <div className="space-y-1.5">
                            {solutionParas.map((para, i) => (
                              <p key={i} className="text-xs text-[var(--text-muted)] leading-relaxed">{para}</p>
                            ))}
                          </div>
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

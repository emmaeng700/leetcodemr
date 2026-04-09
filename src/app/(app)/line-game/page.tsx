'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { stripScripts } from '@/lib/utils'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Copy,
  Check,
  List,
} from 'lucide-react'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useClickOutside } from '@/hooks/useClickOutside'
import { getStudyPlan } from '@/lib/db'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { highlightPythonLine } from '@/lib/line-game/highlightPythonLine'
import {
  buildBlankPicks,
  linesFromPython,
  linesEquivalent,
  normalizeAnswerLine,
  formatStartHint,
  composeLineAnswer,
  splitLeadingIndent,
  type BlankPick,
} from '@/lib/line-game/pickBlankLines'
import DifficultyBadge from '@/components/DifficultyBadge'
import LineGameCodeInput from '@/components/LineGameCodeInput'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  python_solution?: string
}

interface BlankState {
  input: string
  attempts: number
  solved: boolean
  revealed: boolean
}

function HlLine({ html, className = '' }: { html: string; className?: string }) {
  return (
    <code
      className={`hljs language-python whitespace-pre-wrap break-all ${className}`}
      dangerouslySetInnerHTML={{ __html: stripScripts(html) }}
    />
  )
}

function LineGameQuestionPanel({
  question,
  picks,
  onAwardPoints,
  onResult,
  onNext,
  hasNext,
}: {
  question: Question
  picks: BlankPick[]
  onAwardPoints: (n: number) => void
  onResult?: (questionId: number, result: 'mastered' | 'solved' | 'revealed') => void
  onNext: () => void
  hasNext: boolean
}) {
  const [blankStates, setBlankStates] = useState<BlankState[]>(() =>
    picks.map(() => ({ input: '', attempts: 0, solved: false, revealed: false }))
  )
  const [copied, setCopied] = useState(false)
  const resultFiredRef = useRef(false)

  const lines = useMemo(() => linesFromPython(question.python_solution!), [question])
  const fullCode = question.python_solution ?? ''

  const blankAtLine = useMemo(() => {
    const m = new Map<number, number>()
    picks.forEach((p, bi) => m.set(p.lineIndex, bi))
    return m
  }, [picks])

  const questionDone = blankStates.length === picks.length && blankStates.every((s) => s.solved || s.revealed)

  // Fire onResult once when question is fully done
  useEffect(() => {
    if (questionDone && !resultFiredRef.current) {
      resultFiredRef.current = true
      const hasRevealed = blankStates.some(s => s.revealed)
      const allFirstTry = blankStates.every(s => s.solved && s.attempts === 0)
      const result = hasRevealed ? 'revealed' : allFirstTry ? 'mastered' : 'solved'
      onResult?.(question.id, result)
    }
  }, [questionDone, blankStates, question.id, onResult])

  const checkBlank = useCallback(
    (bi: number) => {
      setBlankStates((prev) => {
        const st = prev[bi]
        const spec = picks[bi]
        if (!st || st.solved || st.revealed) return prev

        const attempt = composeLineAnswer(spec.expected, st.input)
        if (linesEquivalent(attempt, spec.expected)) {
          const pts = st.attempts === 0 ? 3 : st.attempts === 1 ? 2 : 1
          queueMicrotask(() => onAwardPoints(pts))
          return prev.map((s, i) =>
            i === bi ? { ...s, solved: true, input: spec.expected } : s
          )
        }

        const nextAttempts = st.attempts + 1
        if (nextAttempts >= 3) {
          return prev.map((s, i) =>
            i === bi
              ? { ...s, attempts: 3, revealed: true, input: spec.expected }
              : s
          )
        }
        return prev.map((s, i) => (i === bi ? { ...s, attempts: nextAttempts } : s))
      })
    },
    [picks, onAwardPoints]
  )

  const copyAll = async () => {
    if (!fullCode) return
    await navigator.clipboard.writeText(fullCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const blanksRemaining = blankStates.filter((s) => !s.solved && !s.revealed).length

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
      <style>{`
        .line-game-code .hljs { background: transparent; color: #abb2bf; }
        ${CODE_HIGHLIGHT_TOKEN_CSS}
      `}</style>

      {/* Flashcard-style header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 font-mono">#{question.id}</span>
          <DifficultyBadge difficulty={question.difficulty} />
          <span className="text-sm font-bold text-indigo-700 truncate">{question.title}</span>
        </div>
        <a
          href={`https://leetcode.com/problems/${question.slug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline shrink-0"
        >
          LeetCode <ExternalLink size={12} />
        </a>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2.5 text-xs text-indigo-900 leading-relaxed space-y-2">
          <p>
            <span className="font-bold">Indentation:</span> The <span className="font-semibold">gray strip</span>{' '}
            is the line’s <em>outer</em> spaces from the real solution — you do not re-type those. Your field
            continues on the same column as the rest of the file; type the remainder of the line (e.g.{' '}
            <code className="text-[11px] bg-white/70 px-1 rounded">for index, num in …</code>).{' '}
            Editor matches Practice / LeetCode: <span className="font-semibold">Python highlighting</span>,{' '}
            <span className="font-semibold">Tab</span> indents (4 spaces),{' '}
            <span className="font-semibold">Ctrl+Space</span> opens completions — including names from the rest of
            this solution (same as the lines above/below). Then{' '}
            <kbd className="px-1 py-0.5 rounded bg-white border border-indigo-200 font-mono text-[10px]">
              Check
            </kbd>
            . Three wrong checks → reveal.
          </p>
          <p className="pt-1 border-t border-indigo-100/90">
            <span className="font-semibold">One blank = one line</span> from the solution (not the whole
            function). Extra spaces around commas/operators are ignored; names must match the reference.
          </p>
        </div>

        {/* Same shell as CodePanel: dark editor + toolbar */}
        <div className="rounded-xl border border-gray-700 bg-[#282c34] line-game-code overflow-x-auto overflow-y-visible">
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#21252b] border-b border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white">
                Python
              </span>
              <span className="text-xs text-gray-400">
                {picks.length} line{picks.length === 1 ? '' : 's'} to fill
                {blanksRemaining > 0 ? ` · ${blanksRemaining} open` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={copyAll}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors shrink-0"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="overflow-x-auto p-4 pt-3 pb-5 text-[11px] sm:text-[12px] md:text-[13px] leading-relaxed">
            {lines.map((line, li) => {
              const bi = blankAtLine.get(li)
              const lineNo = li + 1

              if (bi === undefined) {
                return (
                  <div
                    key={li}
                    className="flex gap-3 font-mono group hover:bg-white/[0.03] rounded-sm -mx-2 px-2 py-0.5"
                  >
                    <span className="text-[#636d83] select-none w-7 sm:w-8 text-right shrink-0 tabular-nums pt-px">
                      {lineNo}
                    </span>
                    <div className="flex-1 min-w-0 py-px">
                      <HlLine html={highlightPythonLine(line)} />
                    </div>
                  </div>
                )
              }

              const st = blankStates[bi]
              const spec = picks[bi]
              if (!st || !spec) {
                return (
                  <div key={li} className="flex gap-3 font-mono">
                    <span className="text-[#636d83] w-7 sm:w-8 text-right shrink-0">{lineNo}</span>
                    <pre className="m-0 flex-1">{line}</pre>
                  </div>
                )
              }

              const locked = st.solved
              const revealed = st.revealed
              const { indent, body } = splitLeadingIndent(spec.expected)
              const indentShown = indent.replace(/\t/g, '    ')
              const showIndentGutter = body.length > 0

              return (
                <div
                  key={li}
                  className="flex gap-3 font-mono group hover:bg-white/[0.03] rounded-sm -mx-2 px-2 py-0.5"
                >
                  <span className="text-[#636d83] select-none w-7 sm:w-8 text-right shrink-0 tabular-nums pt-px">
                    {lineNo}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {locked && (
                      <div className="flex items-start gap-1.5 py-px min-w-0">
                        <CheckCircle2
                          className="text-emerald-400 shrink-0 mt-0.5"
                          size={14}
                          aria-hidden
                        />
                        <HlLine html={highlightPythonLine(spec.expected)} />
                      </div>
                    )}
                    {revealed && !locked && (
                      <div className="flex items-start gap-1.5 py-px min-w-0">
                        <Circle className="text-amber-400 shrink-0 mt-0.5" size={14} aria-hidden />
                        <div className="flex-1 min-w-0 flex flex-wrap items-start justify-between gap-x-2 gap-y-0">
                          <HlLine html={highlightPythonLine(spec.expected)} />
                          <span className="text-[10px] uppercase tracking-wide text-amber-400/90 shrink-0">
                            revealed
                          </span>
                        </div>
                      </div>
                    )}
                    {!locked && !revealed && (
                      <>
                        <div className="flex min-h-[1.55em] items-stretch rounded-sm border border-indigo-500/35 bg-[#21252b]/70 focus-within:border-indigo-400/55 focus-within:ring-1 focus-within:ring-indigo-500/25">
                          {showIndentGutter ? (
                            <>
                              <span
                                className="shrink-0 select-none whitespace-pre border-r border-[#3e4451] px-2 py-1 text-[11px] sm:text-[12px] md:text-[13px] leading-relaxed text-[#5c6370]"
                                aria-hidden
                              >
                                {indentShown}
                              </span>
                              <LineGameCodeInput
                                className="min-w-0 flex-1 overflow-hidden rounded-r-sm [&_.cm-editor]:rounded-r-sm"
                                value={st.input}
                                completionContext={fullCode}
                                onChange={(v) =>
                                  setBlankStates((prev) => {
                                    const next = [...prev]
                                    next[bi] = { ...next[bi], input: v }
                                    return next
                                  })
                                }
                                placeholder="continue this line…"
                              />
                            </>
                          ) : (
                            <LineGameCodeInput
                              className="w-full overflow-hidden rounded-sm [&_.cm-editor]:rounded-sm"
                              value={st.input}
                              completionContext={fullCode}
                              onChange={(v) =>
                                setBlankStates((prev) => {
                                  const next = [...prev]
                                  next[bi] = { ...next[bi], input: v }
                                  return next
                                })
                              }
                              placeholder="type this line…"
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => checkBlank(bi)}
                            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-sm"
                          >
                            Check
                          </button>
                          <span className="text-[11px] text-[#7f848e]">Attempts {st.attempts}/3</span>
                        </div>
                        {st.attempts >= 1 && (
                          <p className="text-[11px] text-[#56b6c2]">
                            Stored line length (incl. indent): {normalizeAnswerLine(spec.expected).length}{' '}
                            chars — layout can differ if tokens match.
                          </p>
                        )}
                        {st.attempts >= 2 && (
                          <p className="text-[11px] text-[#e5c07b] font-mono break-all">
                            {formatStartHint(spec.expected)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {questionDone && (
        <div className="px-5 py-3 bg-indigo-50 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-indigo-800">All lines done for this question.</span>
          {hasNext ? (
            <button
              type="button"
              onClick={onNext}
              className="text-sm font-bold text-indigo-600 hover:underline"
            >
              Next question →
            </button>
          ) : (
            <span className="text-sm text-indigo-600">End of deck.</span>
          )}
        </div>
      )}
    </div>
  )
}

type MasteryLevel = 'mastered' | 'solved' | 'revealed'

function todayISO() {
  return new Date().toLocaleDateString('en-CA')
}

export default function LineGamePage() {
  const online = useOnlineStatus()
  const [all, setAll] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [planOrder, setPlanOrder] = useState<number[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [sessionScore, setSessionScore] = useState(0)
  const [showList, setShowList] = useState(false)
  const [streak, setStreak] = useState(0)
  const [mastery, setMastery] = useState<Record<number, MasteryLevel>>({})
  const [sessionSolved, setSessionSolved] = useState(0)
  const [sessionRevealed, setSessionRevealed] = useState(0)

  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  useEffect(() => {
    async function load() {
      const [qs, plan] = await Promise.all([
        fetch('/questions_full.json').then((r) => r.json()),
        getStudyPlan(),
      ])
      setAll(qs)
      setPlanOrder(plan?.question_order ?? null)
      setLoading(false)
    }
    load()
  }, [])

  // Load streak from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lm_game_streak') || '{}')
      const today = todayISO()
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
      if (stored.date === today) {
        setStreak(stored.count ?? 1)
      } else if (stored.date === yesterday) {
        const next = (stored.count ?? 0) + 1
        setStreak(next)
        localStorage.setItem('lm_game_streak', JSON.stringify({ date: today, count: next }))
      } else {
        setStreak(1)
        localStorage.setItem('lm_game_streak', JSON.stringify({ date: today, count: 1 }))
      }
    } catch {}
  }, [])

  // Load mastery from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lm_game_mastery') || '{}')
      setMastery(stored)
    } catch {}
  }, [])

  const handleResult = useCallback((questionId: number, result: MasteryLevel) => {
    setMastery(prev => {
      // Only upgrade mastery, never downgrade (mastered > solved > revealed)
      const rank = (r: MasteryLevel) => r === 'mastered' ? 3 : r === 'solved' ? 2 : 1
      const current = prev[questionId]
      if (current && rank(current) >= rank(result)) return prev
      const next = { ...prev, [questionId]: result }
      try { localStorage.setItem('lm_game_mastery', JSON.stringify(next)) } catch {}
      return next
    })
    if (result !== 'revealed') setSessionSolved(s => s + 1)
    else setSessionRevealed(s => s + 1)
  }, [])

  const byId = useMemo(() => {
    const m = new Map<number, Question>()
    for (const q of all) m.set(q.id, q)
    return m
  }, [all])

  const ordered = useMemo(() => {
    const order = planOrder?.length ? planOrder : defaultStudyQuestionOrder(all)
    return order.map((id) => byId.get(id)).filter(Boolean) as Question[]
  }, [all, byId, planOrder])

  const playable = useMemo(() => {
    return ordered.filter((q) => {
      const py = q.python_solution
      if (!py || !py.trim()) return false
      return buildBlankPicks(py) !== null
    })
  }, [ordered])

  const current = playable[idx] ?? null
  const picks = useMemo(
    () => (current?.python_solution ? buildBlankPicks(current.python_solution) : null),
    [current]
  )

  const awardPoints = useCallback((n: number) => {
    setSessionScore((s) => s + n)
  }, [])

  const go = useCallback((d: number) => {
    setIdx((i) => (i + d + playable.length) % playable.length)
  }, [playable.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (t.closest('.cm-editor')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  if (loading) {
    return (
      <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading line game…</div>
    )
  }

  if (!playable.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {!online && <OfflineBanner feature="Daily plan (Supabase)" />}
        <div className="text-4xl mb-3">🧩</div>
        <h1 className="text-xl font-black text-gray-800 mb-2">Line game</h1>
        <p className="text-gray-500 text-sm mb-6">
          No questions with enough Python lines to drill. Add solutions in{' '}
          <code className="text-indigo-600">questions_full.json</code> or try again later.
        </p>
        <Link href="/daily" className="text-indigo-600 font-semibold text-sm hover:underline">
          Daily plan →
        </Link>
      </div>
    )
  }

  const progressPct = Math.round(((idx + 1) / playable.length) * 100)

  const lineGameListItems = playable.map((pq, i) => {
    const m = mastery[pq.id]
    return (
      <button
        key={pq.id}
        type="button"
        onClick={() => { setIdx(i); setShowList(false) }}
        className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 border-b border-gray-50 ${i === idx ? 'bg-indigo-50' : ''}`}
      >
        <span className="shrink-0 tabular-nums text-xs font-mono text-gray-500">#{pq.id}</span>
        <span className="min-w-0 flex-1 truncate text-gray-700">{pq.title}</span>
        <span
          className={`text-xs font-semibold shrink-0 ${pq.difficulty === 'Easy' ? 'text-green-600' : pq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
        >
          {pq.difficulty[0]}
        </span>
        {m === 'mastered' && <span title="Mastered">🔥</span>}
        {m === 'solved' && <span title="Solved">✓</span>}
        {m === 'revealed' && <span title="Needs work">👀</span>}
      </button>
    )
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {!online && <OfflineBanner feature="Daily plan order (Supabase)" />}

      <header className="mb-8 rounded-2xl border border-gray-200/90 bg-white shadow-sm ring-1 ring-gray-100/80">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  aria-hidden
                >
                  <Sparkles size={22} strokeWidth={2} />
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Line game</h1>
                  <p className="mt-0.5 text-xs font-medium text-indigo-600/90">Fill blank lines from your Daily-order solutions</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-gray-600 sm:max-w-xl">
                <li className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                  <span>
                    Blanks work like syntax-colored flashcards: over{' '}
                    <span className="font-medium text-gray-700">70% of algorithm lines</span> are hidden
                    (highest-impact first, same order as Daily).
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                  <span>
                    <span className="font-medium text-gray-700">Gray strip</span> = outer indent. Editor matches
                    Practice: Python highlight, Tab, and completions.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                  <span>
                    <span className="font-medium text-gray-700">One blank = one line</span> — paste only that
                    line. Three wrong checks → reveal.
                  </span>
                </li>
              </ul>
            </div>
            <aside className="flex shrink-0 lg:justify-end">
              <div className="flex w-full flex-col justify-center rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/90 to-white px-6 py-5 text-center shadow-inner sm:w-auto sm:min-w-[9.5rem] lg:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-400">Score</p>
                <p className="mt-1 text-4xl font-bold tabular-nums leading-none text-indigo-700">{sessionScore}</p>
                {streak > 0 && (
                  <p className="mt-1 text-xs font-bold text-orange-500">🔥 {streak} day streak</p>
                )}
                <p className="mt-3 border-t border-indigo-100/80 pt-3 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-600">+3</span> first try ·{' '}
                  <span className="font-medium text-gray-600">+2</span> second ·{' '}
                  <span className="font-medium text-gray-600">+1</span> third
                </p>
                {(sessionSolved > 0 || sessionRevealed > 0) && (
                  <div className="mt-2 pt-2 border-t border-indigo-100/80 space-y-0.5">
                    {sessionSolved > 0 && (
                      <p className="text-[11px] text-green-600 font-semibold">✓ {sessionSolved} solved</p>
                    )}
                    {sessionRevealed > 0 && (
                      <p className="text-[11px] text-orange-500 font-semibold">👀 {sessionRevealed} revealed</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            Question {idx + 1} of {playable.length}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="mb-4 flex justify-end gap-2 overflow-visible">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30"
          aria-label="Previous question"
        >
          <ChevronLeft size={18} /> Prev
        </button>

        {/* Question list */}
        <div ref={listWrapRef} className="relative z-10">
          <button
            type="button"
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
          >
            <List size={16} />
            <span className="font-mono text-xs">{idx + 1}/{playable.length}</span>
          </button>
          {showList && (
            <>
              <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
              <div className={listDropdownMobilePanelClasses('right')}>{lineGameListItems}</div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-30"
          aria-label="Next question"
        >
          Next <ChevronRight size={18} />
        </button>
      </div>

      {current && picks && (
        <LineGameQuestionPanel
          key={current.id}
          question={current}
          picks={picks}
          onAwardPoints={awardPoints}
          onResult={handleResult}
          onNext={() => go(1)}
          hasNext={idx < playable.length - 1}
        />
      )}
    </div>
  )
}

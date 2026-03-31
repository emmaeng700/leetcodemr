'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getStudyPlan } from '@/lib/db'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'
import { highlightPythonLine } from '@/lib/line-game/highlightPythonLine'
import {
  buildBlankPicks,
  linesFromPython,
  linesEquivalent,
  normalizeAnswerLine,
  hintPrefix,
  type BlankPick,
} from '@/lib/line-game/pickBlankLines'
import DifficultyBadge from '@/components/DifficultyBadge'

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
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function LineGameQuestionPanel({
  question,
  picks,
  onAwardPoints,
  onNext,
  hasNext,
}: {
  question: Question
  picks: BlankPick[]
  onAwardPoints: (n: number) => void
  onNext: () => void
  hasNext: boolean
}) {
  const [blankStates, setBlankStates] = useState<BlankState[]>(() =>
    picks.map(() => ({ input: '', attempts: 0, solved: false, revealed: false }))
  )
  const [copied, setCopied] = useState(false)

  const lines = useMemo(() => linesFromPython(question.python_solution!), [question])
  const fullCode = question.python_solution ?? ''

  const blankAtLine = useMemo(() => {
    const m = new Map<number, number>()
    picks.forEach((p, bi) => m.set(p.lineIndex, bi))
    return m
  }, [picks])

  const questionDone = blankStates.length === picks.length && blankStates.every((s) => s.solved || s.revealed)

  const checkBlank = useCallback(
    (bi: number) => {
      setBlankStates((prev) => {
        const st = prev[bi]
        const spec = picks[bi]
        if (!st || st.solved || st.revealed) return prev

        if (linesEquivalent(st.input, spec.expected)) {
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

      <div className="p-4">
        {/* Same shell as CodePanel: dark editor + toolbar */}
        <div className="rounded-xl overflow-hidden border border-gray-700 bg-[#282c34] line-game-code">
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

              return (
                <div key={li} className="flex gap-3 font-mono my-2 first:mt-0">
                  <span className="text-[#636d83] select-none w-7 sm:w-8 text-right shrink-0 tabular-nums pt-2">
                    {lineNo}
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    {locked && (
                      <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/35 px-3 py-2 flex items-start gap-2">
                        <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                        <HlLine html={highlightPythonLine(spec.expected)} />
                      </div>
                    )}
                    {revealed && !locked && (
                      <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 flex items-start gap-2">
                        <Circle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                          <HlLine html={highlightPythonLine(spec.expected)} />
                          <span className="text-[10px] uppercase tracking-wide text-amber-400/90 shrink-0 pt-0.5">
                            revealed
                          </span>
                        </div>
                      </div>
                    )}
                    {!locked && !revealed && (
                      <>
                        <textarea
                          value={st.input}
                          onChange={(e) =>
                            setBlankStates((prev) => {
                              const next = [...prev]
                              next[bi] = { ...next[bi], input: e.target.value }
                              return next
                            })
                          }
                          rows={Math.min(8, Math.max(2, spec.expected.split('\n').length + 1))}
                          spellCheck={false}
                          className="w-full rounded-md bg-[#21252b] border border-indigo-500/45 text-[#abb2bf] placeholder:text-[#5c6370] px-3 py-2 font-mono text-[11px] sm:text-[12px] md:text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 resize-y min-h-[2.75rem] shadow-inner"
                          placeholder="Type the full line (indentation matters)…"
                        />
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
                            Hint: length (trimmed end) = {normalizeAnswerLine(spec.expected).length} chars
                          </p>
                        )}
                        {st.attempts >= 2 && (
                          <p className="text-[11px] text-[#e5c07b] font-mono">
                            Starts with {JSON.stringify(hintPrefix(spec.expected, 4))}
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

export default function LineGamePage() {
  const online = useOnlineStatus()
  const [all, setAll] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [planOrder, setPlanOrder] = useState<number[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [sessionScore, setSessionScore] = useState(0)

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
    setIdx((i) => Math.max(0, Math.min(playable.length - 1, i + d)))
  }, [playable.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {!online && <OfflineBanner feature="Daily plan order (Supabase)" />}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-black text-lg mb-1">
            <Sparkles size={22} />
            Line game
          </div>
          <p className="text-sm text-gray-500 max-w-xl">
            Syntax-colored like flashcards. Over 70% of each solution’s algorithm lines are blanked
            (highest-impact lines first; same order as Daily). Three checks per line, then reveal. Green =
            you knew it.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</div>
          <div className="text-2xl font-black text-indigo-600 tabular-nums">{sessionScore}</div>
          <div className="text-xs text-gray-400 mt-1">+3 / +2 / +1 by attempt</div>
        </div>
      </div>

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

      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={idx === 0}
          className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30"
          aria-label="Previous question"
        >
          <ChevronLeft size={18} /> Prev
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={idx >= playable.length - 1}
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
          onNext={() => go(1)}
          hasNext={idx < playable.length - 1}
        />
      )}
    </div>
  )
}

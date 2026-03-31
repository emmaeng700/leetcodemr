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
} from 'lucide-react'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getStudyPlan } from '@/lib/db'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
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

  const lines = useMemo(() => linesFromPython(question.python_solution!), [question])

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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 truncate">{question.title}</span>
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          <a
            href={`https://leetcode.com/problems/${question.slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
          >
            Open on LeetCode <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="p-4 font-mono text-sm leading-relaxed space-y-0.5 bg-gray-900 text-gray-100">
        {lines.map((line, li) => {
          const bi = blankAtLine.get(li)
          if (bi === undefined) {
            return (
              <pre key={li} className="whitespace-pre-wrap break-all text-gray-300 pl-0 m-0">
                {line || ' '}
              </pre>
            )
          }

          const st = blankStates[bi]
          const spec = picks[bi]
          if (!st || !spec) {
            return (
              <pre key={li} className="m-0">
                {line}
              </pre>
            )
          }

          const locked = st.solved
          const revealed = st.revealed

          return (
            <div key={li} className="my-2 space-y-2">
              {locked && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-950/80 border border-emerald-700/50 px-3 py-2">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <pre className="whitespace-pre-wrap break-all text-emerald-100 m-0 flex-1">
                    {spec.expected}
                  </pre>
                </div>
              )}
              {revealed && !locked && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-950/60 border border-amber-700/40 px-3 py-2">
                  <Circle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <pre className="whitespace-pre-wrap break-all text-amber-100 m-0 flex-1">
                    {spec.expected}
                  </pre>
                  <span className="text-xs text-amber-300 shrink-0">revealed</span>
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
                    rows={Math.min(6, Math.max(2, spec.expected.split('\n').length + 1))}
                    spellCheck={false}
                    className="w-full rounded-lg bg-gray-800 border border-indigo-500/50 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y min-h-[2.5rem]"
                    placeholder="Type the full line (including indentation)…"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => checkBlank(bi)}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500"
                    >
                      Check
                    </button>
                    <span className="text-xs text-gray-400">Attempts: {st.attempts}/3</span>
                  </div>
                  {st.attempts >= 1 && (
                    <p className="text-xs text-cyan-300">
                      Hint: line length (trimmed end) = {normalizeAnswerLine(spec.expected).length}{' '}
                      chars
                    </p>
                  )}
                  {st.attempts >= 2 && (
                    <p className="text-xs text-amber-200 font-mono">
                      Starts with:{' '}
                      <span className="text-amber-100">
                        {JSON.stringify(hintPrefix(spec.expected, 4))}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {questionDone && (
        <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
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
            <span className="text-sm text-indigo-600">You reached the end of the deck.</span>
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
          No questions with enough Python solution lines to blank out. Add solutions in{' '}
          <code className="text-indigo-600">questions_full.json</code> or check back later.
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
            Fill in the hidden lines (same order as your Daily plan, or Easy → Medium → Hard). Three
            checks per line, then the answer is shown. Green = locked in.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</div>
          <div className="text-2xl font-black text-indigo-600 tabular-nums">{sessionScore}</div>
          <div className="text-xs text-gray-400 mt-1">
            +3 / +2 / +1 by attempt (0 / 1 / 2 fails before correct)
          </div>
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
          className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 bg-white"
          aria-label="Previous question"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={idx >= playable.length - 1}
          className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 bg-white"
          aria-label="Next question"
        >
          <ChevronRight size={20} />
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

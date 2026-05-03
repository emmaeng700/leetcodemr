'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, CheckCircle2, ChevronRight, Lock, Trophy } from 'lucide-react'
import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { getMasteryRunsByQuestion, getProgress, resetMasteryRuns } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'

type Question = {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | string
  tags: string[]
}

const DIFF_RANK: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
type ImbibitionRow = {
  pattern: (typeof QUICK_PATTERNS)[number]['name']
  questions: Question[]
  unlockedThrough: number
  completed: number
}
const ORDERED_PATTERNS = QUICK_PATTERNS
  .slice()
  .sort(
    (a, b) =>
      DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
      DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number])
  )

export default function ImbibitionPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, { solved?: boolean }>>({})
  const [runs, setRuns] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [targetPattern, setTargetPattern] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setTargetPattern(params.get('pattern'))
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getMasteryRunsByQuestion(),
    ]).then(([qs, prog, masteryRuns]) => {
      setQuestions(qs as Question[])
      setProgress(prog)
      setRuns(masteryRuns)
      setLoading(false)
    }).catch((e) => {
      console.error('[imbibition] load failed:', e)
      setLoading(false)
    })
  }, [])

  const rows = useMemo(() => {
    const exclusiveMap = buildExclusivePatternMap(questions)
    const builtRows: ImbibitionRow[] = []
    for (const pattern of ORDERED_PATTERNS) {
      const solvedQs = questions
        .filter(q => exclusiveMap[q.id] === pattern.name && !!progress[String(q.id)]?.solved)
        .sort((a, b) => {
          const diff = (DIFF_RANK[a.difficulty] ?? 1) - (DIFF_RANK[b.difficulty] ?? 1)
          return diff !== 0 ? diff : a.id - b.id
        })

      const firstIncomplete = solvedQs.findIndex(q => (runs[String(q.id)] ?? 0) < 3)
      const unlockedThrough = solvedQs.length === 0 ? -1 : firstIncomplete === -1 ? solvedQs.length - 1 : firstIncomplete
      const completed = solvedQs.filter(q => (runs[String(q.id)] ?? 0) >= 3).length

      builtRows.push({
        pattern: pattern.name,
        questions: solvedQs,
        unlockedThrough,
        completed,
      })
    }

    return builtRows
  }, [questions, progress, runs])

  const totalSolved = rows.reduce((sum, row) => sum + row.questions.length, 0)
  const fullyImbibed = rows.reduce((sum, row) => sum + row.completed, 0)
  const activeCount = rows.filter(row => row.questions[row.unlockedThrough] && (runs[String(row.questions[row.unlockedThrough].id)] ?? 0) < 3).length

  useEffect(() => {
    if (loading || !targetPattern) return
    const el = sectionRefs.current[targetPattern]
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [loading, targetPattern, rows])

  const openQuestion = (row: { questions: Question[]; unlockedThrough: number }, idx: number) => {
    const laneIds = row.questions.map(q => q.id)
    sessionStorage.setItem('lm_imbibition_queue', JSON.stringify(laneIds))
    router.push(`/practice/${row.questions[idx].id}?from=imbibition`)
  }

  const handleResetAllRuns = async () => {
    if (resetting) return
    const ok = window.confirm('Reset all Imbibition /3 counters back to 0/3? Solved questions will stay solved.')
    if (!ok) return
    setResetting(true)
    const res = await resetMasteryRuns()
    if (!res.ok) {
      toast.error(`Couldn't reset Imbibition counters: ${res.error ?? 'unknown error'}`)
      setResetting(false)
      return
    }
    setRuns({})
    toast.success('All Imbibition counters reset to 0/3')
    setResetting(false)
  }

  if (loading) {
    return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading imbibition…</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">
        <Brain className="text-cyan-600" /> Imbibition
      </h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-subtle)]">
          Reinforce solved questions by topic. Each question must be solved <strong className="text-[var(--text-muted)]">3 times</strong> before the next one in that lane unlocks.
        </p>
        <button
          type="button"
          onClick={handleResetAllRuns}
          disabled={resetting}
          className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : 'Reset all /3 counters'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-black text-cyan-600">{rows.length}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-1 font-medium">Active Topics</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-black text-indigo-600">{fullyImbibed}/{totalSolved}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-1 font-medium">Questions at 3/3</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-1 font-medium">Current Frontline Questions</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No solved questions yet. Mark questions solved and they’ll appear here by topic.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map(row => (
            <section
              key={row.pattern}
              ref={(el) => { sectionRefs.current[row.pattern] = el }}
              className={`bg-[var(--bg-card)] rounded-2xl border p-4 sm:p-5 shadow-sm ${targetPattern === row.pattern ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-[var(--border)]'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[var(--text)]">{row.pattern}</h2>
                  <p className="text-xs text-[var(--text-subtle)] mt-0.5">
                    {row.completed}/{row.questions.length} fully imbibed
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold">
                    Left to right unlock
                  </span>
                </div>
              </div>

              {row.questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-6 text-sm text-[var(--text-subtle)]">
                  No solved questions here yet. Once you solve one in this pattern, it will enter the imbibition lane here.
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {row.questions.map((q, idx) => {
                  const questionRuns = runs[String(q.id)] ?? 0
                  const unlocked = idx <= row.unlockedThrough
                  const complete = questionRuns >= 3
                  const current = unlocked && !complete && idx === row.unlockedThrough
                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => openQuestion(row, idx)}
                      className={`shrink-0 w-[17rem] text-left rounded-2xl border p-4 transition-all ${
                        complete
                          ? 'bg-green-50 border-green-200 hover:border-green-300'
                          : current
                          ? 'bg-cyan-50 border-cyan-300 hover:border-cyan-400 shadow-sm'
                          : unlocked
                          ? 'bg-[var(--bg-card)] border-[var(--border)] hover:border-cyan-300'
                          : 'bg-[var(--bg-muted)]/60 border-[var(--border)] opacity-70 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-mono text-[var(--text-subtle)]">#{q.id}</span>
                        <DifficultyBadge difficulty={q.difficulty} />
                      </div>

                      <p className={`text-sm font-semibold leading-snug min-h-[2.75rem] ${complete ? 'text-green-700' : 'text-[var(--text)]'}`}>
                        {q.title}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                          complete
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : current
                            ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                            : unlocked
                            ? 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {complete ? '3/3 complete' : `${Math.min(questionRuns, 3)}/3 solves`}
                        </span>

                        {complete ? (
                          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                        ) : unlocked ? (
                          <ChevronRight size={16} className={current ? 'text-cyan-600 shrink-0' : 'text-[var(--text-subtle)] shrink-0'} />
                        ) : (
                          <Lock size={15} className="text-[var(--text-subtle)] shrink-0" />
                        )}
                      </div>

                      {current && (
                        <div className="mt-3 text-xs text-cyan-700 font-medium flex items-center gap-1.5">
                          <Trophy size={12} /> Current unlock point
                        </div>
                      )}
                    </button>
                  )
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

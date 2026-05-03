'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, CheckCircle2, ChevronRight, Lock, Trophy } from 'lucide-react'
import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { getMasteryRunsByQuestion, getProgress } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'

type Question = {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | string
  tags: string[]
}

const DIFF_RANK: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
const IMBIBITION_PATTERN_RANK = Object.fromEntries(
  DISPLAY_PATTERN_ORDER.map((pattern, idx) => [pattern, idx])
) as Record<string, number>
type ImbibitionRow = {
  pattern: (typeof QUICK_PATTERNS)[number]['name']
  questions: Question[]
  unlockedThrough: number
  completed: number
}

export default function ImbibitionPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, { solved?: boolean }>>({})
  const [runs, setRuns] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

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
    for (const pattern of QUICK_PATTERNS) {
      const solvedQs = questions
        .filter(q => exclusiveMap[q.id] === pattern.name && !!progress[String(q.id)]?.solved)
        .sort((a, b) => {
          const diff = (DIFF_RANK[a.difficulty] ?? 1) - (DIFF_RANK[b.difficulty] ?? 1)
          return diff !== 0 ? diff : a.id - b.id
        })

      if (!solvedQs.length) continue

      const firstIncomplete = solvedQs.findIndex(q => (runs[String(q.id)] ?? 0) < 3)
      const unlockedThrough = firstIncomplete === -1 ? solvedQs.length - 1 : firstIncomplete
      const completed = solvedQs.filter(q => (runs[String(q.id)] ?? 0) >= 3).length

      builtRows.push({
        pattern: pattern.name,
        questions: solvedQs,
        unlockedThrough,
        completed,
      })
    }

    return builtRows.sort((a, b) => {
      const aRank = IMBIBITION_PATTERN_RANK[a.pattern] ?? Number.MAX_SAFE_INTEGER
      const bRank = IMBIBITION_PATTERN_RANK[b.pattern] ?? Number.MAX_SAFE_INTEGER
      return aRank - bRank
    })
  }, [questions, progress, runs])

  const totalSolved = rows.reduce((sum, row) => sum + row.questions.length, 0)
  const fullyImbibed = rows.reduce((sum, row) => sum + row.completed, 0)
  const activeCount = rows.filter(row => row.questions[row.unlockedThrough] && (runs[String(row.questions[row.unlockedThrough].id)] ?? 0) < 3).length

  const openQuestion = (row: { questions: Question[]; unlockedThrough: number }, idx: number) => {
    const visibleIds = row.questions.slice(0, row.unlockedThrough + 1).map(q => q.id)
    sessionStorage.setItem('lm_imbibition_queue', JSON.stringify(visibleIds))
    router.push(`/practice/${row.questions[idx].id}?from=imbibition`)
  }

  if (loading) {
    return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading imbibition…</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">
        <Brain className="text-cyan-600" /> Imbibition
      </h1>
      <p className="text-sm text-[var(--text-subtle)] mb-6">
        Reinforce solved questions by topic. Each question must be solved <strong className="text-[var(--text-muted)]">3 times</strong> before the next one in that lane unlocks.
      </p>

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
            <section key={row.pattern} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 sm:p-5 shadow-sm">
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
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

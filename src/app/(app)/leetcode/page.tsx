'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Filter, Loader2, RefreshCw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import { PATTERN_PRIORITY, type PatternPriority } from '@/lib/constants'
import {
  buildGrindQuestions,
  loadGrindQuestionsBundle,
  loadPlaybookMap,
  loadQuestionsFullJson,
  type GrindQuestion,
} from '@/lib/grindQuestions'
import { grindListWithDividers, grindSummaryCounts } from '@/lib/grindList'
import {
  formatSyncTime,
  ensureLcSessionForSync,
  readLcListSync,
  syncLeetCodeListAccepted,
  type LcListSyncState,
} from '@/lib/leetcodeListSync'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'

type SetFilter = 'all' | 1 | 2 | 3
type DiffFilter = 'all' | 'Easy' | 'Medium' | 'Hard'
type PriorityFilter = 'all' | PatternPriority
type StatusFilter = 'all' | 'solved' | 'unsolved'

const SET_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Set 1',
  2: 'Set 2',
  3: 'Set 3',
}

const SET_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  3: 'bg-purple-50 text-purple-700 border-purple-200',
}

type DividerEntry = Extract<ReturnType<typeof grindListWithDividers>[number], { type: 'divider' }>
function LeetCodeListDivider({ entry }: { entry: DividerEntry }) {
  const base = 'px-3 py-2 flex items-center justify-between gap-3'
  const labelBase = 'min-w-0 truncate'
  const countBase = 'shrink-0 tabular-nums text-[10px] font-black px-2 py-0.5 rounded-full border'

  if (entry.variant === 'set') {
    return (
      <div className={`${base} bg-[var(--bg-muted)]/70`}>
        <span className={`${labelBase} text-[11px] font-black tracking-wide text-[var(--text)] uppercase`}>
          {entry.label}
        </span>
        <span className={`${countBase} border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)]`}>
          {entry.count}
        </span>
      </div>
    )
  }

  if (entry.variant === 'tier') {
    return (
      <div className={`${base} bg-[var(--bg-muted)]/45`}>
        <span className={`${labelBase} text-[11px] font-bold text-[var(--text-muted)]`}>
          {entry.label}
        </span>
        <span className={`${countBase} border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-subtle)]`}>
          {entry.count}
        </span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-[var(--bg-muted)]/25`}>
      <span className={`${labelBase} text-[10px] font-semibold text-[var(--text-subtle)]`}>
        {entry.label}
      </span>
      <span className={`${countBase} border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-subtle)]`}>
        {entry.count}
      </span>
    </div>
  )
}

function CountPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-[11px] font-semibold tabular-nums">
      <span className={color}>{label}</span>
      <span className="text-[var(--text-muted)]">{value}</span>
    </span>
  )
}

function CountStrip({ counts }: { counts: ReturnType<typeof grindSummaryCounts> }) {
  return (
    <div className="-mx-1 px-1 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        <CountPill label="Easy" value={counts.byDifficulty.Easy ?? 0} color="text-green-600" />
        <CountPill label="Medium" value={counts.byDifficulty.Medium ?? 0} color="text-yellow-700" />
        <CountPill label="Hard" value={counts.byDifficulty.Hard ?? 0} color="text-red-600" />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <CountPill label="High" value={counts.byPriority.High ?? 0} color="text-red-600" />
        <CountPill label="Mid" value={counts.byPriority.Mid ?? 0} color="text-orange-600" />
        <CountPill label="Low" value={counts.byPriority.Low ?? 0} color="text-gray-500" />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <CountPill label="S1" value={counts.bySet[1] ?? 0} color="text-indigo-600" />
        <CountPill label="S2" value={counts.bySet[2] ?? 0} color="text-emerald-600" />
        <CountPill label="S3" value={counts.bySet[3] ?? 0} color="text-purple-600" />
      </div>
    </div>
  )
}

function ProgressRing({ solved, total }: { solved: number; total: number }) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0
  const r = 42
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold text-[var(--text)] tabular-nums">{solved}/{total}</span>
        <span className="text-[10px] text-[var(--text-subtle)]">On LeetCode</span>
      </div>
    </div>
  )
}

export default function LeetCodeListPage() {
  const [questions, setQuestions] = useState<GrindQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [lcSync, setLcSync] = useState<LcListSyncState | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [search, setSearch] = useState('')
  const [setFilter, setSetFilter] = useState<SetFilter>('all')
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const solvedSet = useMemo(() => new Set(lcSync?.solvedIds ?? []), [lcSync])

  useEffect(() => {
    setLcSync(readLcListSync())
    async function load() {
      try {
        let rows = await loadGrindQuestionsBundle()
        if (rows.length === 0) {
          const qs = await loadQuestionsFullJson()
          const { getSet2Questions, getSet3Questions } = await import('@/lib/questionSets')
          const mainIds = new Set(qs.map(q => q.id))
          const set2 = getSet2Questions(mainIds, qs)
          const set3 = getSet3Questions(mainIds, qs)
          const playbookMap = await loadPlaybookMap()
          rows = buildGrindQuestions(qs, set2, set3, playbookMap)
        }
        setQuestions(rows)
      } catch {
        setQuestions([])
      }
      setLoading(false)
    }
    void load()
  }, [])

  const solvedFn = useCallback((q: GrindQuestion) => solvedSet.has(q.id), [solvedSet])

  const runSync = useCallback(async () => {
    if (syncing || questions.length === 0) return
    setSyncing(true)
    try {
      const { session, csrf } = await ensureLcSessionForSync()
      if (!session) {
        toast.error('No session found. MCP → Clipboard: tap Use on your saved token, then sync again.')
        return
      }
      const result = await syncLeetCodeListAccepted(questions, session, csrf)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const state = readLcListSync()
      setLcSync(state)
      toast.success(`Synced ${result.grindAcCount}/${questions.length} Sets 1-3 + ${result.totalAcProblems} total AC on LeetCode`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSyncing(false)
    }
  }, [questions, syncing])

  const patterns = useMemo(() => {
    const set = new Set<string>()
    for (const q of questions) {
      if (q.pattern) set.add(q.pattern)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [questions])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (!matchesQuestionSearch(q, search)) return false
      if (setFilter !== 'all' && q.set !== setFilter) return false
      if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false
      if (priorityFilter !== 'all') {
        const pri = q.pattern ? PATTERN_PRIORITY[q.pattern] : null
        if (pri !== priorityFilter) return false
      }
      if (patternFilter !== 'all' && q.pattern !== patternFilter) return false
      if (statusFilter === 'solved' && !solvedFn(q)) return false
      if (statusFilter === 'unsolved' && solvedFn(q)) return false
      return true
    })
  }, [questions, search, setFilter, diffFilter, priorityFilter, patternFilter, statusFilter, solvedFn])

  const listEntries = useMemo(() => grindListWithDividers(filtered), [filtered])

  const summary = useMemo(() => grindSummaryCounts(filtered), [filtered])
  const allSummary = useMemo(() => grindSummaryCounts(questions), [questions])

  const stats = useMemo(() => {
    const pool = setFilter === 'all' ? questions : questions.filter(q => q.set === setFilter)
    const solved = pool.filter(solvedFn).length
    const byDiff = (d: string) => {
      const rows = pool.filter(q => q.difficulty === d)
      return { total: rows.length, solved: rows.filter(solvedFn).length }
    }
    return {
      total: pool.length,
      solved,
      easy: byDiff('Easy'),
      medium: byDiff('Medium'),
      hard: byDiff('Hard'),
    }
  }, [questions, setFilter, solvedFn])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-[var(--text-subtle)] animate-pulse">
        Loading question list...
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ExternalLink size={32} className="mx-auto text-orange-400 mb-3" />
        <h1 className="text-lg font-bold text-[var(--text)]">LeetCode List</h1>
        <p className="mt-2 text-sm text-[var(--text-subtle)]">
          Could not load questions. Refresh the page or check that questions_full.json is available.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <aside className="lg:w-72 shrink-0">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink size={18} className="text-orange-500 shrink-0" />
              <div>
                <h1 className="text-base font-bold text-[var(--text)] leading-tight">LeetCode List</h1>
                <p className="text-[11px] text-[var(--text-subtle)]">Sets 1-3 | PDF study order</p>
              </div>
            </div>
            <ProgressRing solved={stats.solved} total={stats.total} />
            {lcSync?.syncedAt && (
              <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-muted)] px-3 py-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-subtle)]">Total AC</span>
                  <span className="tabular-nums font-semibold text-[var(--text)]">{lcSync.totalAcProblems ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span className="text-[var(--text-subtle)]">In Sets 1–3</span>
                  <span className="tabular-nums font-semibold text-[var(--text)]">
                    {lcSync.grindAcCount ?? (lcSync.solvedIds?.length ?? 0)}/{questions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span className="text-[var(--text-subtle)]">Extra (not in sets)</span>
                  <span className="tabular-nums font-semibold text-[var(--text)]">{lcSync.extraAcCount ?? 0}</span>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-green-600 font-semibold">Easy</span>
                <span className="tabular-nums text-[var(--text-muted)]">{stats.easy.solved}/{stats.easy.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-600 font-semibold">Medium</span>
                <span className="tabular-nums text-[var(--text-muted)]">{stats.medium.solved}/{stats.medium.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-500 font-semibold">Hard</span>
                <span className="tabular-nums text-[var(--text-muted)]">{stats.hard.solved}/{stats.hard.total}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void runSync()}
              disabled={syncing}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-60 transition"
            >
              {syncing
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />
              }
              {syncing ? 'Syncing from LeetCode...' : 'Sync from LeetCode'}
            </button>
            {lcSync?.syncedAt ? (
              <p className="mt-2 text-[10px] text-center text-[var(--text-subtle)]">
                Last sync: {formatSyncTime(lcSync.syncedAt)}
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-center text-amber-600">
                Tap sync to load AC status from leetcode.com
              </p>
            )}

            <p className="mt-3 text-[10px] text-[var(--text-subtle)] leading-relaxed">
              Checkmarks reflect your LeetCode AC history only. Does not change Learn, Daily, or Questions progress.
            </p>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
            <div className="p-3 border-b border-[var(--border-soft)] space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search questions..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                    showFilters
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <Filter size={14} />
                  Filters
                </button>
                <span className="text-xs text-[var(--text-subtle)] tabular-nums shrink-0">
                  {filtered.length} / {questions.length}
                </span>
              </div>

              <CountStrip counts={summary} />

              {showFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <select
                    value={String(setFilter)}
                    onChange={e => setSetFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as SetFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">All sets ({questions.length})</option>
                    <option value="1">Set 1 ({allSummary.bySet[1]})</option>
                    <option value="2">Set 2 ({allSummary.bySet[2]})</option>
                    <option value="3">Set 3 ({allSummary.bySet[3]})</option>
                  </select>
                  <select
                    value={diffFilter}
                    onChange={e => setDiffFilter(e.target.value as DiffFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">All difficulties</option>
                    <option value="Easy">Easy ({allSummary.byDifficulty.Easy ?? 0})</option>
                    <option value="Medium">Medium ({allSummary.byDifficulty.Medium ?? 0})</option>
                    <option value="Hard">Hard ({allSummary.byDifficulty.Hard ?? 0})</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value as PriorityFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">All priorities</option>
                    <option value="High">High ({allSummary.byPriority.High ?? 0})</option>
                    <option value="Mid">Mid ({allSummary.byPriority.Mid ?? 0})</option>
                    <option value="Low">Low ({allSummary.byPriority.Low ?? 0})</option>
                  </select>
                  <select
                    value={patternFilter}
                    onChange={e => setPatternFilter(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--border)] max-w-[12rem] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">All patterns</option>
                    {patterns.map(p => (
                      <option key={p} value={p}>{p} ({allSummary.byPattern[p] ?? 0})</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">All status</option>
                    <option value="solved">AC on LeetCode</option>
                    <option value="unsolved">Not on LeetCode</option>
                  </select>
                </div>
              )}
            </div>

            <div className="hidden sm:grid grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 px-3 py-2 border-b border-[var(--border-soft)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-subtle)] bg-[var(--bg-muted)]/50">
              <span />
              <span>Question</span>
              <span>Pattern</span>
              <span>Difficulty</span>
              <span>Set</span>
            </div>

            <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--text-subtle)]">No questions match your filters.</p>
              ) : (
                listEntries.map(entry => {
                  if (entry.type === 'divider') {
                    return (
                      <div key={entry.key} className="border-b border-[var(--border-soft)]">
                        <LeetCodeListDivider entry={entry} />
                      </div>
                    )
                  }

                  const q = entry.q
                  const solved = solvedFn(q)
                  const lcHref = leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))

                  return (
                    <div
                      key={entry.key}
                      className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 items-center px-3 py-2.5 border-b border-[var(--border-soft)] hover:bg-[var(--bg-muted)]/60 transition-colors"
                    >
                      <span className="flex justify-center">
                        {solved
                          ? <CheckCircle2 size={16} className="text-green-500" aria-label="AC on LeetCode" />
                          : <Circle size={16} className="text-[var(--text-subtle)]" aria-label="No AC on LeetCode" />
                        }
                      </span>
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <a
                          href={lcHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline truncate"
                        >
                          {q.id}. {q.title}
                        </a>
                        {q.pattern && <PriorityBadge pattern={q.pattern} className="sm:hidden" />}
                      </div>
                      <span className="hidden sm:block text-[10px] text-[var(--text-subtle)] truncate" title={q.pattern ?? ''}>
                        {q.pattern ?? '-'}
                      </span>
                      <span className="hidden sm:block">
                        <DifficultyBadge difficulty={q.difficulty} />
                      </span>
                      <span className="hidden sm:block">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${SET_BADGE[q.set]}`}>
                          {SET_LABEL[q.set]}
                        </span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'
import { grindListWithDividers, grindSummaryCounts, matchesStudyTier, SET_SHORT_LABEL, STUDY_TIER_ORDER, type StudyTier } from '@/lib/grindList'
import {
  formatSyncTime,
  ensureLcSessionForSync,
  readLcListSync,
  syncLeetCodeListAccepted,
  type LcListSyncState,
} from '@/lib/leetcodeListSync'
import { matchesQuestionSearch } from '@/lib/questionSearchMatch'
import { leetCodeListPracticeUrl, leetCodeListUrl, leetCodeUrl, openExternalLink, openExternalUrl, resolveLeetCodeSlug } from '@/lib/utils'

type SetFilter = 'all' | 1 | 2 | 3
type DiffFilter = 'all' | 'Easy' | 'Medium' | 'Hard'
type PriorityFilter = 'all' | PatternPriority
type TierFilter = 'all' | StudyTier
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

function buildLcListName(
  setFilter: SetFilter,
  tierFilter: TierFilter,
  patternFilter: string,
  diffFilter: DiffFilter,
  priorityFilter: PriorityFilter,
): string {
  const parts: string[] = []
  if (setFilter !== 'all') parts.push(SET_SHORT_LABEL[setFilter])
  if (tierFilter !== 'all') parts.push(tierFilter)
  if (patternFilter !== 'all') parts.push(patternFilter)
  else if (tierFilter === 'all' && diffFilter !== 'all') parts.push(diffFilter)
  else if (tierFilter === 'all' && priorityFilter !== 'all') parts.push(priorityFilter)
  return parts.length ? parts.join(' · ') : 'LeetMastery All 727'
}

function buildFilterLabel(
  setFilter: SetFilter,
  tierFilter: TierFilter,
  patternFilter: string,
  diffFilter: DiffFilter,
  priorityFilter: PriorityFilter,
): string {
  const parts: string[] = []
  parts.push(setFilter !== 'all' ? SET_SHORT_LABEL[setFilter] : 'All sets')
  if (tierFilter !== 'all') parts.push(tierFilter)
  if (patternFilter !== 'all') parts.push(patternFilter)
  else if (tierFilter === 'all' && diffFilter !== 'all') parts.push(diffFilter)
  else if (tierFilter === 'all' && priorityFilter !== 'all') parts.push(priorityFilter)
  return parts.join(' · ')
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

function CountPill({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string
  value: number
  color: string
  active?: boolean
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className={color}>{label}</span>
      <span className="text-[var(--text-muted)]">{value}</span>
    </>
  )
  const cls = `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums transition ${
    active
      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
      : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-muted)]'
  }`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }
  return <span className={cls}>{inner}</span>
}

function CountStrip({
  counts,
  setFilter,
  onSetFilter,
}: {
  counts: ReturnType<typeof grindSummaryCounts>
  setFilter: SetFilter
  onSetFilter: (set: SetFilter) => void
}) {
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
        <CountPill label="S1" value={counts.bySet[1] ?? 0} color="text-indigo-600" active={setFilter === 1} onClick={() => onSetFilter(setFilter === 1 ? 'all' : 1)} />
        <CountPill label="S2" value={counts.bySet[2] ?? 0} color="text-emerald-600" active={setFilter === 2} onClick={() => onSetFilter(setFilter === 2 ? 'all' : 2)} />
        <CountPill label="S3" value={counts.bySet[3] ?? 0} color="text-purple-600" active={setFilter === 3} onClick={() => onSetFilter(setFilter === 3 ? 'all' : 3)} />
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
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [lcListHashes, setLcListHashes] = useState<Record<string, string>>({})
  const [lcListLoading, setLcListLoading] = useState(false)

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
      if (!session || !csrf) {
        toast.error('No LC session — Clipboard → Use with cookie from leetcode.com')
        return
      }
      const result = await syncLeetCodeListAccepted(questions, session, csrf)
      if (result.error) {
        toast.error(result.error, { duration: 7000 })
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

  const lcListKey = useMemo(() => {
    const parts: string[] = []
    if (setFilter !== 'all') parts.push(`s${setFilter}`)
    if (tierFilter !== 'all') parts.push(tierFilter.replace(/\s+/g, '-').toLowerCase())
    else if (diffFilter !== 'all') parts.push(diffFilter.toLowerCase())
    if (tierFilter === 'all' && priorityFilter !== 'all') parts.push(priorityFilter.toLowerCase())
    if (patternFilter !== 'all') parts.push(patternFilter)
    return parts.length ? parts.join('|') : 'all'
  }, [setFilter, tierFilter, diffFilter, priorityFilter, patternFilter])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lm_lc_lists')
      if (raw) setLcListHashes(JSON.parse(raw))
    } catch {}
  }, [])

  const saveLcListHashes = (next: Record<string, string>) => {
    setLcListHashes(next)
    try { localStorage.setItem('lm_lc_lists', JSON.stringify(next)) } catch {}
  }

  const handleCreateLcList = async () => {
    if (lcListLoading) return
    setLcListLoading(true)
    try {
      const { session, csrf } = await ensureLcSessionForSync()
      if (!session || !csrf) {
        toast.error('No LC session — open Clipboard → Use with your leetcode.com Cookie')
        setLcListLoading(false)
        return
      }
      const listName = buildLcListName(setFilter, tierFilter, patternFilter, diffFilter, priorityFilter)
      const existingHash = lcListHashes[lcListKey] ?? null
      const res = await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          session,
          csrf,
          listName,
          existingHash,
          questions: filtered.map(q => ({ id: q.id, slug: q.slug })),
        }),
      })
      const data = await res.json()
      const slug = data.favoriteSlug ?? data.favoriteIdHash
      if (slug) {
        const listUrl = data.listUrl ?? leetCodeListUrl(slug)
        saveLcListHashes({ ...lcListHashes, [lcListKey]: slug })
        const openUrl = data.practiceUrl
          ?? (filtered[0]
            ? leetCodeListPracticeUrl(resolveLeetCodeSlug(filtered[0].id, filtered[0].slug), slug)
            : listUrl)
        openExternalUrl(openUrl)
        const added = data.verified ?? data.added ?? 0
        const total = data.total ?? filtered.length
        if (added < total) {
          toast.error(`Only ${added}/${total} added to LC list. Check LeetCode session.`)
        } else {
          toast.success(
            `"${listName}" ready — ${added} questions. Use ‹ › next to Problem List on LeetCode.`,
            { duration: 6000 },
          )
        }
      } else {
        const msg = data.code === 'lc_not_logged_in' || /not logged in/i.test(data.error ?? '')
          ? 'LeetCode session expired — open leetcode.com, copy Cookie (F12 → Network), then Clipboard → Use'
          : (data.error ?? 'Failed to create LC list')
        const detail = data.lcResponse && !/not logged in/i.test(data.error ?? '')
          ? ` — ${JSON.stringify(data.lcResponse).slice(0, 120)}`
          : ''
        toast.error(msg + detail, { duration: 7000 })
      }
    } catch {
      toast.error('Failed to create LC list')
    }
    setLcListLoading(false)
  }

  const handleDeleteLcList = async () => {
    if (lcListLoading) return
    const hash = lcListHashes[lcListKey]
    if (!hash) return
    setLcListLoading(true)
    try {
      const { session, csrf } = await ensureLcSessionForSync()
      await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', session, csrf, favoriteIdHash: hash }),
      })
      const next = { ...lcListHashes }
      delete next[lcListKey]
      saveLcListHashes(next)
      toast.success('LC list deleted')
    } catch {
      toast.error('Failed to delete LC list')
    }
    setLcListLoading(false)
  }

  const tierPool = useMemo(() => {
    return questions.filter(q => {
      if (setFilter !== 'all' && q.set !== setFilter) return false
      return true
    })
  }, [questions, setFilter])

  const tierSummary = useMemo(() => grindSummaryCounts(tierPool), [tierPool])

  const patternsInScope = useMemo(() => {
    const scoped = tierPool.filter(q => {
      if (tierFilter === 'all') return true
      return matchesStudyTier(q, tierFilter)
    })
    const counts = new Map<string, number>()
    for (const q of scoped) {
      if (q.pattern) counts.set(q.pattern, (counts.get(q.pattern) ?? 0) + 1)
    }
    return DISPLAY_PATTERN_ORDER
      .filter(p => counts.has(p))
      .map(p => ({ pattern: p, count: counts.get(p)! }))
  }, [tierPool, tierFilter])

  useEffect(() => {
    if (patternFilter === 'all') return
    if (!patternsInScope.some(p => p.pattern === patternFilter)) {
      setPatternFilter('all')
    }
  }, [patternsInScope, patternFilter])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (!matchesQuestionSearch(q, search)) return false
      if (setFilter !== 'all' && q.set !== setFilter) return false
      if (tierFilter !== 'all') {
        if (!matchesStudyTier(q, tierFilter)) return false
      } else {
        if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false
        if (priorityFilter !== 'all') {
          const pri = q.pattern ? PATTERN_PRIORITY[q.pattern] : null
          if (pri !== priorityFilter) return false
        }
      }
      if (patternFilter !== 'all' && q.pattern !== patternFilter) return false
      if (statusFilter === 'solved' && !solvedFn(q)) return false
      if (statusFilter === 'unsolved' && solvedFn(q)) return false
      return true
    })
  }, [questions, search, setFilter, tierFilter, diffFilter, priorityFilter, patternFilter, statusFilter, solvedFn])

  const listEntries = useMemo(() => grindListWithDividers(filtered), [filtered])

  const summary = useMemo(() => grindSummaryCounts(filtered), [filtered])
  const allSummary = useMemo(() => grindSummaryCounts(questions), [questions])

  const filterLabel = useMemo(
    () => buildFilterLabel(setFilter, tierFilter, patternFilter, diffFilter, priorityFilter),
    [setFilter, tierFilter, patternFilter, diffFilter, priorityFilter],
  )

  const tierChipLabel = useCallback(
    (tier: StudyTier) => (setFilter !== 'all' ? `${SET_SHORT_LABEL[setFilter]} ${tier}` : tier),
    [setFilter],
  )

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

                {/* Open as LeetCode List */}
                {lcListLoading ? (
                  <span className="text-xs text-[var(--text-subtle)] animate-pulse shrink-0">Creating…</span>
                ) : lcListHashes[lcListKey] ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {filtered[0] && (
                      <a
                        href={leetCodeListPracticeUrl(
                          resolveLeetCodeSlug(filtered[0].id, filtered[0].slug),
                          lcListHashes[lcListKey],
                        )}
                        onClick={e =>
                          openExternalLink(
                            e,
                            leetCodeListPracticeUrl(
                              resolveLeetCodeSlug(filtered[0].id, filtered[0].slug),
                              lcListHashes[lcListKey],
                            ),
                          )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open first filtered problem with list Prev/Next"
                        className="flex items-center gap-1 px-2.5 py-2 rounded-l-xl border border-orange-300 bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition"
                      >
                        <ExternalLink size={12} /> Practice
                      </a>
                    )}
                    <a
                      href={leetCodeListUrl(lcListHashes[lcListKey])}
                      onClick={e => openExternalLink(e, leetCodeListUrl(lcListHashes[lcListKey]))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 px-2.5 py-2 border border-orange-300 bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition ${filtered[0] ? 'border-l-0' : 'rounded-l-xl'}`}
                    >
                      <ExternalLink size={12} /> Open LC List
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLcList()}
                      title="Delete this LC list"
                      className="px-2 py-2 rounded-r-xl border border-l-0 border-orange-300 bg-orange-50 text-orange-300 hover:text-red-500 text-xs transition"
                    >
                      🗑
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCreateLcList()}
                    title={`Create a LeetCode Favorite List from these ${filtered.length} questions`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-orange-400 hover:text-orange-500 transition shrink-0"
                  >
                    <ExternalLink size={12} /> LC List +
                  </button>
                )}
              </div>

              <CountStrip counts={summary} setFilter={setFilter} onSetFilter={setSetFilter} />

              {(setFilter !== 'all' || tierFilter !== 'all' || patternFilter !== 'all') && (
                <p className="text-[11px] font-semibold text-indigo-700 truncate" title={filterLabel}>
                  {filterLabel}
                  <span className="font-normal text-[var(--text-subtle)] ml-1">({filtered.length})</span>
                </p>
              )}

              {showFilters && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-subtle)] shrink-0">Set</span>
                    {(['all', 1, 2, 3] as const).map(s => {
                      const active = setFilter === s
                      const count = s === 'all' ? questions.length : allSummary.bySet[s]
                      const label = s === 'all' ? 'All' : SET_SHORT_LABEL[s]
                      const color = s === 1 ? 'text-indigo-600' : s === 2 ? 'text-emerald-600' : s === 3 ? 'text-purple-600' : 'text-[var(--text-muted)]'
                      return (
                        <button
                          key={String(s)}
                          type="button"
                          onClick={() => setSetFilter(s)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full border tabular-nums transition ${
                            active
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                              : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          <span className={active ? '' : color}>{label}</span>
                          <span className="opacity-70 ml-1">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTierFilter('all')
                        setPatternFilter('all')
                      }}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full border transition ${
                        tierFilter === 'all'
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      All tiers
                    </button>
                    {STUDY_TIER_ORDER.map(tier => {
                      const count = tierSummary.byTier[tier] ?? 0
                      if (count === 0) return null
                      const active = tierFilter === tier
                      const pri = tier.startsWith('High') ? 'text-red-600' : tier.startsWith('Mid') ? 'text-orange-600' : 'text-gray-500'
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => {
                            setTierFilter(tier)
                            setDiffFilter('all')
                            setPriorityFilter('all')
                            setPatternFilter('all')
                          }}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full border tabular-nums transition ${
                            active
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                              : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          <span className={active ? '' : pri}>{tierChipLabel(tier)}</span>
                          <span className="opacity-70 ml-1">({count})</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                    value={tierFilter}
                    onChange={e => {
                      const next = e.target.value as TierFilter
                      setTierFilter(next)
                      if (next !== 'all') {
                        setDiffFilter('all')
                        setPriorityFilter('all')
                        setPatternFilter('all')
                      }
                    }}
                    className="text-xs rounded-lg border border-indigo-300 bg-indigo-50/50 px-2 py-1.5 text-[var(--text)] font-semibold"
                  >
                    <option value="all">Study tier (High Easy…)</option>
                    {STUDY_TIER_ORDER.map(tier => (
                      <option key={tier} value={tier}>
                        {tierChipLabel(tier)} ({tierSummary.byTier[tier] ?? 0})
                      </option>
                    ))}
                  </select>
                  <select
                    value={diffFilter}
                    disabled={tierFilter !== 'all'}
                    onChange={e => setDiffFilter(e.target.value as DiffFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)] disabled:opacity-45"
                  >
                    <option value="all">All difficulties</option>
                    <option value="Easy">Easy ({allSummary.byDifficulty.Easy ?? 0})</option>
                    <option value="Medium">Medium ({allSummary.byDifficulty.Medium ?? 0})</option>
                    <option value="Hard">Hard ({allSummary.byDifficulty.Hard ?? 0})</option>
                  </select>
                  <select
                    value={priorityFilter}
                    disabled={tierFilter !== 'all'}
                    onChange={e => setPriorityFilter(e.target.value as PriorityFilter)}
                    className="text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)] disabled:opacity-45"
                  >
                    <option value="all">All priorities</option>
                    <option value="High">High ({allSummary.byPriority.High ?? 0})</option>
                    <option value="Mid">Mid ({allSummary.byPriority.Mid ?? 0})</option>
                    <option value="Low">Low ({allSummary.byPriority.Low ?? 0})</option>
                  </select>
                  <select
                    value={patternFilter}
                    onChange={e => setPatternFilter(e.target.value)}
                    className="text-xs rounded-lg border border-[var(--border)] max-w-[14rem] bg-[var(--bg-input)] px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="all">
                      {tierFilter !== 'all'
                        ? `All patterns in ${tierChipLabel(tierFilter as StudyTier)}`
                        : 'All patterns'}
                    </option>
                    {patternsInScope.map(({ pattern, count }) => (
                      <option key={pattern} value={pattern}>{pattern} ({count})</option>
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
                  const lcSlug = resolveLeetCodeSlug(q.id, q.slug)
                  const listSlug = lcListHashes[lcListKey]
                  const lcHref = listSlug
                    ? leetCodeListPracticeUrl(lcSlug, listSlug)
                    : leetCodeUrl(lcSlug)

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
                          onClick={e => openExternalLink(e, lcHref)}
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

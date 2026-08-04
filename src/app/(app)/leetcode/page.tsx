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
import {
  applyBatchTicks,
  buildOrderedLcListName,
  DEFAULT_LC_NAME_ORDER,
  LC_BATCH_PRESETS,
  LC_DIFFICULTIES,
  LC_PRIORITIES,
  LC_NAME_PART_LABEL,
  moveNamePart,
  planBatchLcLists,
  planLtsLcLists,
  planPresetLcLists,
  readLcNameOrder,
  saveLcNameOrder,
  storageKeyForPlan,
  type LcBatchSplit,
  type LcDifficulty,
  type LcPriority,
  type LcNamePart,
} from '@/lib/lcListNaming'
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

const DIFF_LETTER_COLOR: Record<string, string> = {
  E: 'text-green-600',
  M: 'text-orange-500',
  H: 'text-red-500',
}

const DIFF_WORD_COLOR: Record<string, string> = {
  Easy: 'text-green-600',
  Medium: 'text-orange-500',
  Hard: 'text-red-500',
}

/**
 * Render a list name with the difficulty colored (E/Easy green, M/Medium
 * orange, H/Hard red) so tier tokens like HE / HM / HH are scannable.
 */
function ColoredListName({ name }: { name: string }) {
  const parts = name.split(' · ')
  return (
    <>
      {parts.map((part, i) => {
        const tier = /^([HML])([EMH])$/.exec(part)
        const fullTier = /^(High|Mid|Low) (Easy|Medium|Hard)$/.exec(part)
        const diffWords = part.split('+')
        const isDiffTag = diffWords.every(w => DIFF_WORD_COLOR[w])
        return (
          <span key={i}>
            {i > 0 && ' · '}
            {tier ? (
              <>
                {tier[1]}
                <span className={DIFF_LETTER_COLOR[tier[2]]}>{tier[2]}</span>
              </>
            ) : fullTier ? (
              <>
                {fullTier[1]}{' '}
                <span className={DIFF_WORD_COLOR[fullTier[2]]}>{fullTier[2]}</span>
              </>
            ) : isDiffTag ? (
              diffWords.map((w, j) => (
                <span key={j}>
                  {j > 0 && '+'}
                  <span className={DIFF_WORD_COLOR[w]}>{w}</span>
                </span>
              ))
            ) : (
              part
            )}
          </span>
        )
      })}
    </>
  )
}

function buildFilterLabel(
  setFilter: SetFilter,
  tierFilter: TierFilter,
  patternFilter: string,
  diffFilter: DiffFilter,
  priorityFilter: PriorityFilter,
  nameOrder: LcNamePart[] = DEFAULT_LC_NAME_ORDER,
): string {
  return buildOrderedLcListName(nameOrder, {
    set: setFilter === 'all' ? null : setFilter,
    tier: tierFilter === 'all' ? null : tierFilter,
    pattern: patternFilter === 'all' ? null : patternFilter,
  }) + (tierFilter === 'all' && patternFilter === 'all' && diffFilter !== 'all'
    ? ` · ${diffFilter}`
    : tierFilter === 'all' && patternFilter === 'all' && priorityFilter !== 'all'
      ? ` · ${priorityFilter}`
      : '')
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

const LTS_PRESET_IDS = ['lts-all', 'lts-high', 'lts-mid', 'lts-low']

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
  const [lcLists, setLcLists] = useState<Record<string, { slug: string; name: string }>>({})
  const [lcListLoading, setLcListLoading] = useState(false)
  const [nameOrder, setNameOrder] = useState<LcNamePart[]>(DEFAULT_LC_NAME_ORDER)
  const [showBatch, setShowBatch] = useState(false)
  const [showManagedLists, setShowManagedLists] = useState(false)
  const [lcRemoteLists, setLcRemoteLists] = useState<Array<{ idHash: string; slug?: string; name: string; questionCount: number; created?: string }> | null>(null)
  const [lcRemoteLoading, setLcRemoteLoading] = useState(false)
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set())
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<string | null>(null)
  const [batchSplit, setBatchSplit] = useState<LcBatchSplit>('pattern')
  /** null = use current page filters; otherwise a Set 1/2/3 all-patterns (etc.) preset */
  const [batchPresetId, setBatchPresetId] = useState<string | null>(null)
  const [batchDiffs, setBatchDiffs] = useState<Set<LcDifficulty>>(
    () => new Set(LC_DIFFICULTIES),
  )
  const [batchPriorities, setBatchPriorities] = useState<Set<LcPriority>>(
    () => new Set(LC_PRIORITIES),
  )
  const [batchProgress, setBatchProgress] = useState<string | null>(null)
  const [lcConflict, setLcConflict] = useState<
    | { mode: 'single'; listName: string; pendingBody: object }
    | { mode: 'batch';  listName: string }
    | null
  >(null)

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
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const migrated: Record<string, { slug: string; name: string }> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') {
            migrated[k] = { slug: v, name: k }
          } else if (v && typeof v === 'object' && 'slug' in v) {
            migrated[k] = v as { slug: string; name: string }
          }
        }
        setLcLists(migrated)
      }
    } catch {}
    setNameOrder(readLcNameOrder())
  }, [])

  const saveLcLists = (next: Record<string, { slug: string; name: string }>) => {
    setLcLists(next)
    try { localStorage.setItem('lm_lc_lists', JSON.stringify(next)) } catch {}
  }

  const updateNameOrder = (next: LcNamePart[]) => {
    setNameOrder(next)
    saveLcNameOrder(next)
  }

  const singleListName = useMemo(
    () =>
      buildOrderedLcListName(nameOrder, {
        set: setFilter === 'all' ? null : setFilter,
        tier: tierFilter === 'all' ? null : tierFilter,
        pattern: patternFilter === 'all' ? null : patternFilter,
      }),
    [nameOrder, setFilter, tierFilter, patternFilter],
  )

  const handleCreateLcListWithBody = async (requestBody: object, listName: string) => {
    const res = await fetch('/api/lc-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    const data = await res.json()

    if (data.code === 'lc_name_conflict') {
      setLcConflict({ mode: 'single', listName: data.conflictName ?? listName, pendingBody: requestBody })
      return
    }

    const slug = data.favoriteSlug ?? data.favoriteIdHash
    const usedName = data.resolvedName ?? listName

    if (slug && data.code !== 'lc_not_logged_in') {
      saveLcLists({ ...lcLists, [lcListKey]: { slug, name: usedName } })
      const openUrl = data.listUrl ?? leetCodeListUrl(slug)
      openExternalUrl(openUrl)
      toast.success(`"${usedName}" ready on LeetCode.`, { duration: 5000 })
    } else {
      const msg = data.code === 'lc_not_logged_in' || /not logged in/i.test(data.error ?? '')
        ? 'LeetCode session expired — open leetcode.com, copy Cookie (F12 → Network), then Clipboard → Use'
        : data.code === 'lc_name_taken'
          ? (data.error as string)
          : (data.error ?? 'Failed to create LC list')
      toast.error(msg, { duration: 7000 })
    }
  }

  const handleCreateLcList = async () => {
    if (lcListLoading || filtered.length === 0) return
    setLcListLoading(true)
    try {
      const listName = singleListName
      const existingEntry = lcLists[lcListKey] ?? null
      const { session, csrf } = await ensureLcSessionForSync()
      if (!session || !csrf) {
        toast.error('No LC session — open Clipboard → Use with your leetcode.com Cookie')
        setLcListLoading(false)
        return
      }
      await handleCreateLcListWithBody({
        action: 'create',
        session,
        csrf,
        listName,
        existingHash: existingEntry?.slug ?? null,
        questions: filtered.map(q => ({ id: q.id, slug: q.slug })),
      }, listName)
    } catch {
      toast.error('Failed to create LC list')
    }
    setLcListLoading(false)
  }

  const resolveConflict = async (conflictAction: 'overwrite' | 'rename') => {
    if (!lcConflict) return
    const conflict = lcConflict
    setLcConflict(null)
    if (conflict.mode === 'batch') {
      await handleBatchCreate(conflictAction)
    } else {
      setLcListLoading(true)
      try {
        await handleCreateLcListWithBody(
          { ...conflict.pendingBody, conflictAction },
          conflict.listName,
        )
      } catch {
        toast.error('Failed to create LC list')
      }
      setLcListLoading(false)
    }
  }

  const loadRemoteLists = async () => {
    setLcRemoteLoading(true)
    try {
      const { session, csrf } = await ensureLcSessionForSync()
      if (!session || !csrf) {
        toast.error('No LC session — open Clipboard → Use with your leetcode.com Cookie')
        return
      }
      const res = await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', session, csrf }),
      })
      const data = await res.json() as { ok?: boolean; lists?: Array<{ idHash: string; slug?: string; name: string; questionCount: number; created?: string }> }
      if (data.ok && data.lists) {
        const sorted = data.lists[0]?.created
          ? [...data.lists].sort((a, b) => {
              const ta = a.created ? new Date(a.created).getTime() : 0
              const tb = b.created ? new Date(b.created).getTime() : 0
              return ta - tb
            })
          : data.lists
        setLcRemoteLists(sorted)
      } else {
        toast.error('Failed to load lists from LeetCode')
      }
    } catch {
      toast.error('Failed to load lists from LeetCode')
    }
    setLcRemoteLoading(false)
  }

  const deleteListEntry = async (
    idHash: string,
    name: string,
    localKey?: string,
  ) => {
    if (lcListLoading) return
    setLcListLoading(true)
    try {
      const { session, csrf } = await ensureLcSessionForSync()
      const res = await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', session, csrf, favoriteIdHash: idHash, listName: name }),
      })
      const data = await res.json() as { ok?: boolean; lcDeleted?: boolean; lcDebug?: unknown }
      if (localKey) {
        const next = { ...lcLists }
        delete next[localKey]
        saveLcLists(next)
      }
      if (lcRemoteLists) {
        setLcRemoteLists(prev => prev?.filter(l => l.idHash !== idHash) ?? null)
      }
      if (data.lcDeleted) {
        toast.success(`"${name}" deleted from LeetCode`)
      } else {
        if (data.lcDebug) console.warn('[lc-list delete]', data.lcDebug)
        toast.success(`Removed${localKey ? ' locally' : ''} — may already be gone on LeetCode`)
      }
    } catch {
      toast.error('Failed to delete LC list')
    }
    setLcListLoading(false)
  }

  const deleteSelectedLists = async () => {
    if (lcListLoading || selectedListIds.size === 0 || !lcRemoteLists) return
    setLcListLoading(true)
    const toDelete = lcRemoteLists.filter(l => selectedListIds.has(l.idHash))
    const { session, csrf } = await ensureLcSessionForSync()
    let deleted = 0
    let failed = 0
    for (let i = 0; i < toDelete.length; i++) {
      const list = toDelete[i]
      setBatchDeleteProgress(`Deleting ${i + 1} / ${toDelete.length}…`)
      const localKey = Object.entries(lcLists).find(([, v]) => v.slug === list.idHash || v.name === list.name)?.[0]
      try {
        const res = await fetch('/api/lc-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', session, csrf, favoriteIdHash: list.slug ?? list.idHash, listName: list.name }),
        })
        const data = await res.json() as { ok?: boolean; lcDeleted?: boolean; lcDebug?: unknown }
        if (data.lcDebug) console.warn('[lc-list delete]', data.lcDebug)
        if (localKey) {
          const next = { ...lcLists }
          delete next[localKey]
          saveLcLists(next)
        }
        setLcRemoteLists(prev => prev?.filter(l => l.idHash !== list.idHash) ?? null)
        setSelectedListIds(prev => { const s = new Set(prev); s.delete(list.idHash); return s })
        deleted++
      } catch {
        failed++
      }
    }
    setBatchDeleteProgress(null)
    setLcListLoading(false)
    if (failed === 0) {
      toast.success(`${deleted} list${deleted !== 1 ? 's' : ''} deleted from LeetCode`)
    } else {
      toast.error(`${deleted} deleted, ${failed} failed`)
    }
  }

  const handleDeleteLcList = () => {
    const entry = lcLists[lcListKey]
    if (!entry) return
    void deleteListEntry(entry.slug, entry.name, lcListKey)
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
          let pri: string | null = q.pattern ? (PATTERN_PRIORITY[q.pattern] ?? null) : null
          if (!pri && q.section) {
            const m = q.section.match(/^(High|Mid|Low) /)
            if (m) pri = m[1]
          }
          if (pri !== priorityFilter) return false
        }
      }
      if (patternFilter !== 'all' && q.pattern !== patternFilter) return false
      if (statusFilter === 'solved' && !solvedFn(q)) return false
      if (statusFilter === 'unsolved' && solvedFn(q)) return false
      return true
    })
  }, [questions, search, setFilter, tierFilter, diffFilter, priorityFilter, patternFilter, statusFilter, solvedFn])

  const activeBatchPreset = useMemo(
    () => (batchPresetId ? LC_BATCH_PRESETS.find(p => p.id === batchPresetId) ?? null : null),
    [batchPresetId],
  )

  const batchScopeFilters = useMemo(
    () =>
      activeBatchPreset
        ? {
            setFilter: activeBatchPreset.setFilter,
            tierFilter: activeBatchPreset.tierFilter,
            patternFilter: activeBatchPreset.patternFilter,
          }
        : { setFilter, tierFilter, patternFilter },
    [activeBatchPreset, setFilter, tierFilter, patternFilter],
  )

  const batchSplitEffective = activeBatchPreset?.split ?? batchSplit

  const batchPlans = useMemo(() => {
    if (batchPresetId && LTS_PRESET_IDS.includes(batchPresetId)) {
      const pf = batchPresetId === 'lts-high' ? 'High'
               : batchPresetId === 'lts-mid'  ? 'Mid'
               : batchPresetId === 'lts-low'  ? 'Low'
               : undefined
      return planLtsLcLists(questions, pf)
    }
    if (activeBatchPreset) {
      return planPresetLcLists(questions, activeBatchPreset, nameOrder, batchDiffs, batchPriorities)
    }
    return applyBatchTicks(
      planBatchLcLists(filtered, batchSplit, nameOrder, {
        setFilter,
        tierFilter,
        patternFilter,
      }),
      batchDiffs,
      batchPriorities,
    )
  }, [
    activeBatchPreset,
    questions,
    filtered,
    batchSplit,
    nameOrder,
    setFilter,
    tierFilter,
    patternFilter,
    batchDiffs,
    batchPriorities,
  ])

  const toggleBatchDiff = (d: LcDifficulty) => {
    setBatchDiffs(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const toggleBatchPriority = (p: LcPriority) => {
    setBatchPriorities(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const handleBatchCreate = async (conflictAction?: 'overwrite' | 'rename') => {
    if (lcListLoading || batchPlans.length === 0) return
    setLcListLoading(true)
    setBatchProgress(`0 / ${batchPlans.length}`)
    let ok = 0
    let lists = { ...lcLists }
    let lastSlug: string | null = null

    try {
      const { session, csrf } = await ensureLcSessionForSync()
      if (!session || !csrf) {
        toast.error('No LC session — Clipboard → Use with cookie from leetcode.com')
        setLcListLoading(false)
        setBatchProgress(null)
        return
      }

      for (let i = 0; i < batchPlans.length; i++) {
        const plan = batchPlans[i]
        setBatchProgress(`${i + 1} / ${batchPlans.length}: ${plan.listName}`)
        const storageKey = (batchPresetId && LTS_PRESET_IDS.includes(batchPresetId))
          ? plan.key
          : storageKeyForPlan(
              plan,
              batchScopeFilters,
              batchSplitEffective,
              batchDiffs,
              batchPriorities,
            )
        const existingSlug = lists[storageKey]?.slug ?? null
        const res = await fetch('/api/lc-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            session,
            csrf,
            listName: plan.listName,
            existingHash: existingSlug,
            ...(conflictAction ? { conflictAction } : {}),
            questions: plan.questions.map(q => ({ id: q.id, slug: q.slug })),
          }),
        })
        const data = await res.json()
        if (data.code === 'lc_not_logged_in' || /not logged in/i.test(data.error ?? '')) {
          toast.error('LeetCode session expired mid-batch — paste a fresh cookie and retry')
          break
        }
        if (data.code === 'lc_name_conflict') {
          setBatchProgress(null)
          setLcListLoading(false)
          setLcConflict({ mode: 'batch', listName: data.conflictName ?? plan.listName })
          return
        }
        const slug = data.favoriteSlug ?? data.favoriteIdHash
        if (slug) {
          lists = { ...lists, [storageKey]: { slug, name: plan.listName } }
          lastSlug = slug
          ok++
        }
        if (i + 1 < batchPlans.length) await new Promise(r => setTimeout(r, 350))
      }

      saveLcLists(lists)
      if (ok > 0 && lastSlug) {
        openExternalUrl(leetCodeListUrl(lastSlug))
        toast.success(`Created ${ok}/${batchPlans.length} LC lists.`, { duration: 6000 })
      } else {
        toast.error('No lists were created')
      }
    } catch {
      toast.error('Batch create failed')
    }
    setBatchProgress(null)
    setLcListLoading(false)
  }

  const listEntries = useMemo(() => grindListWithDividers(filtered), [filtered])

  const summary = useMemo(() => grindSummaryCounts(filtered), [filtered])
  const allSummary = useMemo(() => grindSummaryCounts(questions), [questions])

  const filterLabel = useMemo(
    () => buildFilterLabel(setFilter, tierFilter, patternFilter, diffFilter, priorityFilter, nameOrder),
    [setFilter, tierFilter, patternFilter, diffFilter, priorityFilter, nameOrder],
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
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-800 leading-snug">
            <span className="font-semibold">Create lists here.</span>{' '}
            Filter first, set name order, then <span className="font-semibold">New List</span> (one)
            or <span className="font-semibold">Batch</span> (many by pattern / tier / set).
          </div>
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

                {/* Open / create LeetCode List */}
                {lcListLoading ? (
                  <span className="text-xs text-[var(--text-subtle)] animate-pulse shrink-0">
                    {batchProgress ?? 'Working…'}
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {lcLists[lcListKey] && (
                      <a
                        href={leetCodeListUrl(lcLists[lcListKey].slug)}
                        onClick={e => openExternalLink(e, leetCodeListUrl(lcLists[lcListKey].slug))}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open this list on LeetCode"
                        className="flex items-center gap-1 px-2.5 py-2 rounded-l-xl border border-orange-300 bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition"
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCreateLcList()}
                      title={`Create one LC list: ${singleListName} (${filtered.length})`}
                      className={`flex items-center gap-1 px-2.5 py-2 border border-orange-300 bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition ${
                        lcLists[lcListKey] ? 'border-l-0' : 'rounded-l-xl'
                      }`}
                    >
                      New List
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBatch(v => !v)}
                      title="Create many lists from the current filters"
                      className={`flex items-center gap-1 px-2.5 py-2 border border-l-0 border-orange-300 text-xs font-semibold transition ${
                        showBatch
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      }`}
                    >
                      Batch
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManagedLists(v => !v)}
                      title="See and manage all created lists"
                      className={`flex items-center gap-1 px-2.5 py-2 border border-l-0 border-orange-300 text-xs font-semibold transition ${
                        showManagedLists
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      }`}
                    >
                      Lists {Object.keys(lcLists).length > 0 && <span className="ml-0.5 tabular-nums">({Object.keys(lcLists).length})</span>}
                    </button>
                    {lcLists[lcListKey] ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteLcList()}
                        title="Delete this LC list"
                        className="px-2 py-2 rounded-r-xl border border-l-0 border-orange-300 bg-orange-50 text-orange-300 hover:text-red-500 text-xs transition"
                      >
                        🗑
                      </button>
                    ) : (
                      <span className="rounded-r-xl border border-l-0 border-orange-300 bg-orange-50 px-1 py-2" />
                    )}
                  </div>
                )}
              </div>

              {/* Name order + batch panel */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-[var(--text-subtle)] font-semibold shrink-0">Name order</span>
                {nameOrder.map((part, i) => (
                  <span key={part} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => updateNameOrder(moveNamePart(nameOrder, i, -1))}
                      className="px-1 rounded border border-[var(--border)] text-[var(--text-subtle)] disabled:opacity-30 hover:bg-[var(--bg-muted)]"
                      title="Move earlier"
                    >
                      ‹
                    </button>
                    <span className="px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 font-semibold">
                      {i + 1}. {LC_NAME_PART_LABEL[part]}
                    </span>
                    <button
                      type="button"
                      disabled={i === nameOrder.length - 1}
                      onClick={() => updateNameOrder(moveNamePart(nameOrder, i, 1))}
                      className="px-1 rounded border border-[var(--border)] text-[var(--text-subtle)] disabled:opacity-30 hover:bg-[var(--bg-muted)]"
                      title="Move later"
                    >
                      ›
                    </button>
                  </span>
                ))}
                <span className="text-[var(--text-subtle)] truncate ml-1" title={singleListName}>
                  → <ColoredListName name={singleListName} />
                </span>
              </div>

              {showBatch && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-orange-800 shrink-0">Priority</span>
                    {LC_PRIORITIES.map(p => {
                      const on = batchPriorities.has(p)
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleBatchPriority(p)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                            on
                              ? 'border-orange-400 bg-orange-100 text-orange-800'
                              : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-subtle)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          {on ? '✓ ' : ''}{p}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setBatchPriorities(new Set(LC_PRIORITIES))}
                      className="text-[10px] font-semibold text-orange-700 hover:underline"
                    >
                      All
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-orange-800 shrink-0">Difficulty</span>
                    {LC_DIFFICULTIES.map(d => {
                      const on = batchDiffs.has(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleBatchDiff(d)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                            on
                              ? 'border-orange-400 bg-orange-100 text-orange-800'
                              : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-subtle)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          {on ? '✓ ' : ''}{d}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setBatchDiffs(new Set(LC_DIFFICULTIES))}
                      className="text-[10px] font-semibold text-orange-700 hover:underline"
                    >
                      All
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-orange-800 shrink-0">Quick</span>
                    {LC_BATCH_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setBatchPresetId(preset.id)
                          setBatchSplit(preset.split)
                        }}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                          batchPresetId === preset.id
                            ? 'border-orange-400 bg-orange-100 text-orange-800'
                            : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatchPresetId(null)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                        batchPresetId === null
                          ? 'border-orange-400 bg-orange-100 text-orange-800'
                          : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      Current filters
                    </button>
                  </div>

                  {batchPresetId === null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-orange-800">Split filtered into</span>
                      {([
                        ['pattern', 'Pattern'],
                        ['tier', 'Priority Diff'],
                        ['set', 'Set'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setBatchSplit(value)
                            setBatchPresetId(null)
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                            batchSplit === value
                              ? 'border-orange-400 bg-orange-100 text-orange-800'
                              : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] text-orange-800/80 flex-1 min-w-[12rem]">
                      {activeBatchPreset
                        ? `${activeBatchPreset.label}: one LC list per ${activeBatchPreset.split}.`
                        : `Uses current filters as the pool, then one LC favorite per ${batchSplit}.`}
                      {' '}Priority: {[...batchPriorities].join('+') || 'none'}.
                      Difficulties: {[...batchDiffs].join('+') || 'none'}.
                      Names follow your order
                      {(batchDiffs.size > 0 && batchDiffs.size < 3) ||
                      (batchPriorities.size > 0 && batchPriorities.size < 3)
                        ? ' (+ priority/difficulty tags)'
                        : ''}.
                    </p>
                    <button
                      type="button"
                      disabled={lcListLoading || batchPlans.length === 0}
                      onClick={() => void handleBatchCreate()}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-orange-400 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition shrink-0"
                    >
                      Create {batchPlans.length} lists
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {batchPlans.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-subtle)]">No groups for this batch.</p>
                    ) : (
                      batchPlans.map(plan => (
                        <div
                          key={plan.key}
                          className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]"
                        >
                          <span className="font-semibold text-[var(--text)] truncate">
                            <ColoredListName name={plan.listName} />
                          </span>
                          <span className="tabular-nums text-[var(--text-subtle)] shrink-0">{plan.questions.length}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {showManagedLists && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-orange-800 flex-1">Your LeetCode Lists</span>
                    <button
                      type="button"
                      onClick={() => void loadRemoteLists()}
                      disabled={lcRemoteLoading || lcListLoading}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-orange-300 bg-white text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition"
                    >
                      {lcRemoteLoading ? 'Loading…' : lcRemoteLists ? 'Refresh from LC' : 'Load from LeetCode'}
                    </button>
                  </div>

                  {lcRemoteLists === null ? (
                    <p className="text-[11px] text-[var(--text-subtle)]">
                      Click <span className="font-semibold">Load from LeetCode</span> to see all your lists and delete any.
                    </p>
                  ) : lcRemoteLists.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-subtle)]">No lists found on LeetCode.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] text-orange-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={selectedListIds.size === lcRemoteLists.length}
                            ref={el => { if (el) el.indeterminate = selectedListIds.size > 0 && selectedListIds.size < lcRemoteLists.length }}
                            onChange={e => setSelectedListIds(e.target.checked ? new Set(lcRemoteLists.map(l => l.idHash)) : new Set())}
                            className="accent-orange-500"
                          />
                          {selectedListIds.size === lcRemoteLists.length ? 'Deselect all' : 'Select all'}
                        </label>
                        {selectedListIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => void deleteSelectedLists()}
                            disabled={lcListLoading}
                            className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
                          >
                            {batchDeleteProgress ?? `Delete ${selectedListIds.size}`}
                          </button>
                        )}
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {lcRemoteLists.map(list => {
                          const localKey = Object.entries(lcLists).find(([, v]) => v.slug === list.idHash || v.name === list.name)?.[0]
                          const checked = selectedListIds.has(list.idHash)
                          return (
                            <div
                              key={list.idHash}
                              className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg border transition ${checked ? 'bg-orange-100 border-orange-300' : 'bg-[var(--bg-card)] border-[var(--border-soft)]'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => setSelectedListIds(prev => {
                                  const s = new Set(prev)
                                  if (e.target.checked) s.add(list.idHash)
                                  else s.delete(list.idHash)
                                  return s
                                })}
                                className="accent-orange-500 shrink-0"
                              />
                              <a
                                href={leetCodeListUrl(list.idHash)}
                                onClick={e => openExternalLink(e, leetCodeListUrl(list.idHash))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 font-semibold text-orange-600 hover:underline truncate"
                                title={list.name}
                              >
                                <ColoredListName name={list.name} />
                              </a>
                              {list.questionCount > 0 && (
                                <span className="tabular-nums text-[var(--text-subtle)] shrink-0">{list.questionCount}q</span>
                              )}
                              {localKey && (
                                <span className="text-[9px] text-green-600 font-semibold shrink-0">app</span>
                              )}
                              <button
                                type="button"
                                disabled={lcListLoading}
                                onClick={() => void deleteListEntry(list.slug ?? list.idHash, list.name, localKey)}
                                title={`Delete "${list.name}" from LeetCode`}
                                className="shrink-0 text-orange-300 hover:text-red-500 disabled:opacity-40 transition px-1"
                              >
                                🗑
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              <CountStrip counts={summary} setFilter={setFilter} onSetFilter={setSetFilter} />

              {(setFilter !== 'all' || tierFilter !== 'all' || patternFilter !== 'all') && (
                <p className="text-[11px] font-semibold text-indigo-700 truncate" title={filterLabel}>
                  <ColoredListName name={filterLabel} />
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
                  const listSlug = lcLists[lcListKey]?.slug
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

      {lcConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-xl">
            <h2 className="text-sm font-bold text-[var(--text)] mb-1">List already exists</h2>
            <p className="text-xs text-[var(--text-subtle)] mb-4">
              A LeetCode list named <span className="font-semibold text-[var(--text)]">&ldquo;{lcConflict.listName}&rdquo;</span> already exists. What would you like to do?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => resolveConflict('overwrite')}
                className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2.5 transition-colors"
              >
                Delete existing and replace it
              </button>
              <button
                onClick={() => resolveConflict('rename')}
                className="w-full rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold py-2.5 transition-colors"
              >
                Create as new list (e.g. &ldquo;{lcConflict.listName} 2&rdquo;)
              </button>
              <button
                onClick={() => setLcConflict(null)}
                className="w-full rounded-xl border border-[var(--border)] text-[var(--text-subtle)] text-xs font-semibold py-2.5 hover:bg-[var(--bg-muted)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

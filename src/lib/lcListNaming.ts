import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY } from '@/lib/constants'
import {
  matchesStudyTier,
  questionStudyTier,
  SET_SHORT_LABEL,
  STUDY_TIER_ORDER,
  type StudyTier,
} from '@/lib/grindList'
import type { GrindQuestion } from '@/lib/grindQuestions'

export type LcNamePart = 'pattern' | 'tier' | 'set'
export type LcBatchSplit = 'pattern' | 'tier' | 'set'

/** User preference: Pattern · High Easy · Set 1 */
export const DEFAULT_LC_NAME_ORDER: LcNamePart[] = ['pattern', 'tier', 'set']

export const LC_NAME_PART_LABEL: Record<LcNamePart, string> = {
  pattern: 'Pattern',
  tier: 'Priority Diff',
  set: 'Set',
}

export const LC_NAME_ORDER_KEY = 'lm_lc_list_name_order'

export function readLcNameOrder(): LcNamePart[] {
  if (typeof window === 'undefined') return [...DEFAULT_LC_NAME_ORDER]
  try {
    const raw = localStorage.getItem(LC_NAME_ORDER_KEY)
    if (!raw) return [...DEFAULT_LC_NAME_ORDER]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_LC_NAME_ORDER]
    const valid = parsed.filter((p): p is LcNamePart =>
      p === 'pattern' || p === 'tier' || p === 'set',
    )
    const uniq = [...new Set(valid)]
    for (const p of DEFAULT_LC_NAME_ORDER) {
      if (!uniq.includes(p)) uniq.push(p)
    }
    return uniq.slice(0, 3) as LcNamePart[]
  } catch {
    return [...DEFAULT_LC_NAME_ORDER]
  }
}

export function saveLcNameOrder(order: LcNamePart[]) {
  try {
    localStorage.setItem(LC_NAME_ORDER_KEY, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}

export function moveNamePart(order: LcNamePart[], index: number, dir: -1 | 1): LcNamePart[] {
  const next = [...order]
  const j = index + dir
  if (j < 0 || j >= next.length) return order
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

type NameCtx = {
  set?: 1 | 2 | 3 | null
  tier?: string | null
  pattern?: string | null
}

export function buildOrderedLcListName(order: LcNamePart[], ctx: NameCtx): string {
  const map: Record<LcNamePart, string | null | undefined> = {
    pattern: ctx.pattern && ctx.pattern !== 'all' ? ctx.pattern : null,
    tier: ctx.tier && ctx.tier !== 'all' ? ctx.tier : null,
    set: ctx.set ? SET_SHORT_LABEL[ctx.set] : null,
  }
  const parts = order.map(p => map[p]).filter((x): x is string => !!x)
  return parts.length ? parts.join(' · ') : 'LeetMastery All 727'
}

export type BatchListPlan = {
  key: string
  listName: string
  questions: GrindQuestion[]
}

function commonSet(qs: GrindQuestion[]): 1 | 2 | 3 | null {
  if (!qs.length) return null
  const s = qs[0].set
  return qs.every(q => q.set === s) ? s : null
}

function commonTier(qs: GrindQuestion[]): string | null {
  if (!qs.length) return null
  const t = questionStudyTier(qs[0])
  if (!t) return null
  return qs.every(q => questionStudyTier(q) === t) ? t : null
}

function commonPattern(qs: GrindQuestion[]): string | null {
  if (!qs.length) return null
  const p = qs[0].pattern
  if (!p) return null
  return qs.every(q => q.pattern === p) ? p : null
}

/** Split filtered questions into one LC list plan per pattern / tier / set. */
export function planBatchLcLists(
  questions: GrindQuestion[],
  split: LcBatchSplit,
  nameOrder: LcNamePart[],
  filters: {
    setFilter: 'all' | 1 | 2 | 3
    tierFilter: 'all' | StudyTier
    patternFilter: string
  },
): BatchListPlan[] {
  const groups = new Map<string, GrindQuestion[]>()

  for (const q of questions) {
    let key: string | null = null
    if (split === 'pattern') key = q.pattern
    else if (split === 'tier') key = questionStudyTier(q)
    else key = String(q.set)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(q)
    groups.set(key, list)
  }

  let keys: string[] = [...groups.keys()]
  if (split === 'pattern') {
    const ordered = DISPLAY_PATTERN_ORDER.filter(p => groups.has(p))
    const rest = keys.filter(k => !(DISPLAY_PATTERN_ORDER as readonly string[]).includes(k)).sort()
    keys = [...ordered, ...rest]
  } else if (split === 'tier') {
    const ordered = STUDY_TIER_ORDER.filter(t => groups.has(t))
    const rest = keys.filter(k => !(STUDY_TIER_ORDER as readonly string[]).includes(k))
    keys = [...ordered, ...rest]
  } else {
    keys = ['1', '2', '3'].filter(k => groups.has(k))
  }

  return keys.map(key => {
    const qs = groups.get(key)!
    const set =
      filters.setFilter !== 'all'
        ? filters.setFilter
        : split === 'set'
          ? (Number(key) as 1 | 2 | 3)
          : commonSet(qs)
    const tier =
      filters.tierFilter !== 'all'
        ? filters.tierFilter
        : split === 'tier'
          ? key
          : commonTier(qs)
    const pattern =
      filters.patternFilter !== 'all'
        ? filters.patternFilter
        : split === 'pattern'
          ? key
          : commonPattern(qs)

    const listName = buildOrderedLcListName(nameOrder, { set, tier, pattern })
    return { key: `${split}:${key}`, listName, questions: qs }
  })
}

export function lcListStorageKey(parts: {
  set?: 1 | 2 | 3 | null
  tier?: string | null
  pattern?: string | null
  difficulties?: ReadonlySet<LcDifficulty> | null
}): string {
  const bits: string[] = []
  if (parts.set) bits.push(`s${parts.set}`)
  if (parts.tier && parts.tier !== 'all') bits.push(parts.tier.replace(/\s+/g, '-').toLowerCase())
  if (parts.pattern && parts.pattern !== 'all') bits.push(parts.pattern)
  const diffTag = parts.difficulties ? difficultyLabel(parts.difficulties) : null
  if (diffTag) bits.push(diffTag.toLowerCase())
  return bits.length ? bits.join('|') : 'all'
}

/** Infer storage key from a finished plan name context. */
export function storageKeyForPlan(
  plan: BatchListPlan,
  filters: {
    setFilter: 'all' | 1 | 2 | 3
    tierFilter: 'all' | StudyTier
    patternFilter: string
  },
  split: LcBatchSplit,
  difficulties?: ReadonlySet<LcDifficulty>,
): string {
  const qs = plan.questions
  const set =
    filters.setFilter !== 'all'
      ? filters.setFilter
      : split === 'set'
        ? (Number(plan.key.split(':')[1]) as 1 | 2 | 3)
        : commonSet(qs)
  const tier =
    filters.tierFilter !== 'all'
      ? filters.tierFilter
      : split === 'tier'
        ? plan.key.split(':').slice(1).join(':')
        : commonTier(qs)
  const pattern =
    filters.patternFilter !== 'all'
      ? filters.patternFilter
      : split === 'pattern'
        ? plan.key.split(':').slice(1).join(':')
        : commonPattern(qs)
  return lcListStorageKey({ set, tier, pattern, difficulties: difficulties ?? null })
}

export function priorityForPattern(pattern: string | null): string | null {
  if (!pattern) return null
  return PATTERN_PRIORITY[pattern as keyof typeof PATTERN_PRIORITY] ?? null
}

export function questionMatchesFilters(
  q: GrindQuestion,
  opts: {
    setFilter: 'all' | 1 | 2 | 3
    tierFilter: 'all' | StudyTier
    patternFilter: string
    difficulties?: ReadonlySet<LcDifficulty> | LcDifficulty[]
  },
): boolean {
  if (opts.setFilter !== 'all' && q.set !== opts.setFilter) return false
  if (opts.tierFilter !== 'all' && !matchesStudyTier(q, opts.tierFilter)) return false
  if (opts.patternFilter !== 'all' && q.pattern !== opts.patternFilter) return false
  if (opts.difficulties) {
    const set = opts.difficulties instanceof Set ? opts.difficulties : new Set(opts.difficulties)
    if (set.size > 0 && set.size < 3 && !set.has(q.difficulty as LcDifficulty)) return false
    if (set.size === 0) return false
  }
  return true
}

export type LcDifficulty = 'Easy' | 'Medium' | 'Hard'

export const LC_DIFFICULTIES: LcDifficulty[] = ['Easy', 'Medium', 'Hard']

export function difficultyLabel(diffs: ReadonlySet<LcDifficulty>): string | null {
  if (diffs.size === 0 || diffs.size === 3) return null
  return LC_DIFFICULTIES.filter(d => diffs.has(d)).join('+')
}

export function withDifficultySuffix(listName: string, diffs: ReadonlySet<LcDifficulty>): string {
  const label = difficultyLabel(diffs)
  if (!label) return listName
  if (listName === 'LeetMastery All 727') return label
  return `${listName} · ${label}`
}

export type LcBatchPreset = {
  id: string
  label: string
  setFilter: 'all' | 1 | 2 | 3
  tierFilter: 'all' | StudyTier
  patternFilter: string
  split: LcBatchSplit
}

/** One-click scopes (ignore page filters except for "current filters"). */
export const LC_BATCH_PRESETS: LcBatchPreset[] = [
  {
    id: 's1-patterns',
    label: 'Set 1 · all patterns',
    setFilter: 1,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 's2-patterns',
    label: 'Set 2 · all patterns',
    setFilter: 2,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 's3-patterns',
    label: 'Set 3 · all patterns',
    setFilter: 3,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 's1-tiers',
    label: 'Set 1 · all tiers',
    setFilter: 1,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'tier',
  },
  {
    id: 's2-tiers',
    label: 'Set 2 · all tiers',
    setFilter: 2,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'tier',
  },
  {
    id: 's3-tiers',
    label: 'Set 3 · all tiers',
    setFilter: 3,
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'tier',
  },
]

export function planPresetLcLists(
  allQuestions: GrindQuestion[],
  preset: LcBatchPreset,
  nameOrder: LcNamePart[],
  difficulties: ReadonlySet<LcDifficulty> = new Set(LC_DIFFICULTIES),
): BatchListPlan[] {
  const pool = allQuestions.filter(q =>
    questionMatchesFilters(q, {
      setFilter: preset.setFilter,
      tierFilter: preset.tierFilter,
      patternFilter: preset.patternFilter,
      difficulties,
    }),
  )
  return planBatchLcLists(pool, preset.split, nameOrder, {
    setFilter: preset.setFilter,
    tierFilter: preset.tierFilter,
    patternFilter: preset.patternFilter,
  })
    .map(plan => ({
      ...plan,
      listName: withDifficultySuffix(plan.listName, difficulties),
    }))
    .filter(plan => plan.questions.length > 0)
}

/** Apply difficulty ticks to an already-planned batch (e.g. current page filters). */
export function applyBatchDifficulties(
  plans: BatchListPlan[],
  difficulties: ReadonlySet<LcDifficulty>,
): BatchListPlan[] {
  return plans
    .map(plan => {
      const questions =
        difficulties.size === 0
          ? []
          : difficulties.size === 3
            ? plan.questions
            : plan.questions.filter(q => difficulties.has(q.difficulty as LcDifficulty))
      return {
        ...plan,
        questions,
        listName: withDifficultySuffix(plan.listName, difficulties),
      }
    })
    .filter(plan => plan.questions.length > 0)
}

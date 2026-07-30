import { DISPLAY_PATTERN_ORDER, resolveQuestionPriority } from '@/lib/constants'
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

const TIER_ABBREV: Record<string, string> = {
  'High Easy': 'HE', 'High Medium': 'HM', 'High Hard': 'HH',
  'Mid Easy': 'ME', 'Mid Medium': 'MM', 'Mid Hard': 'MH',
  'Low Easy': 'LE', 'Low Medium': 'LM', 'Low Hard': 'LH',
}

const LIST_SET_LABEL: Record<1 | 2 | 3, string> = { 1: 'S1', 2: 'S2', 3: 'S3' }

const PATTERN_ABBREV: Record<string, string> = {
  'Arrays & Hashing':    'A&H',
  'String':              'Str',
  'Two Pointers':        '2P',
  'Sliding Window':      'SW',
  'Sorting':             'Sort',
  'Binary Search':       'BS',
  'Matrix':              'Mtx',
  'Trees & BST':         'Trees',
  'DFS':                 'DFS',
  'Graphs':              'Gph',
  'BFS':                 'BFS',
  'Linked List':         'LL',
  'Stack':               'Stk',
  'Heap':                'Heap',
  'Trie':                'Trie',
  'Backtracking':        'BT',
  'Greedy':              'Grdy',
  'Dynamic Programming': 'DP',
  'Bit Manipulation':    'BitM',
  'Math':                'Math',
  'JavaScript':          'JS',
}

type NameCtx = {
  set?: 1 | 2 | 3 | null
  tier?: string | null
  pattern?: string | null
}

export function buildOrderedLcListName(order: LcNamePart[], ctx: NameCtx): string {
  const map: Record<LcNamePart, string | null | undefined> = {
    pattern: ctx.pattern && ctx.pattern !== 'all' ? (PATTERN_ABBREV[ctx.pattern] ?? ctx.pattern) : null,
    tier: ctx.tier && ctx.tier !== 'all' ? (TIER_ABBREV[ctx.tier] ?? ctx.tier) : null,
    set: ctx.set ? LIST_SET_LABEL[ctx.set] : null,
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
  priorities?: ReadonlySet<LcPriority> | null
}): string {
  const bits: string[] = []
  if (parts.set) bits.push(`s${parts.set}`)
  if (parts.tier && parts.tier !== 'all') bits.push(parts.tier.replace(/\s+/g, '-').toLowerCase())
  if (parts.pattern && parts.pattern !== 'all') bits.push(parts.pattern)
  const priTag = parts.priorities ? priorityLabel(parts.priorities) : null
  if (priTag) bits.push(`p-${priTag.toLowerCase()}`)
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
  priorities?: ReadonlySet<LcPriority>,
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
  return lcListStorageKey({
    set,
    tier,
    pattern,
    difficulties: difficulties ?? null,
    priorities: priorities ?? null,
  })
}

export function priorityForPattern(pattern: string | null): string | null {
  return resolveQuestionPriority({ pattern })
}

export function questionMatchesFilters(
  q: GrindQuestion,
  opts: {
    setFilter: 'all' | 1 | 2 | 3
    tierFilter: 'all' | StudyTier
    patternFilter: string
    difficulties?: ReadonlySet<LcDifficulty> | LcDifficulty[]
    priorities?: ReadonlySet<LcPriority> | LcPriority[]
  },
): boolean {
  if (opts.setFilter !== 'all' && q.set !== opts.setFilter) return false
  if (opts.tierFilter !== 'all' && !matchesStudyTier(q, opts.tierFilter)) return false
  if (opts.patternFilter !== 'all' && q.pattern !== opts.patternFilter) return false
  if (opts.difficulties) {
    const set = opts.difficulties instanceof Set ? opts.difficulties : new Set(opts.difficulties)
    if (set.size === 0) return false
    if (set.size < 3 && !set.has(q.difficulty as LcDifficulty)) return false
  }
  if (opts.priorities) {
    const set = opts.priorities instanceof Set ? opts.priorities : new Set(opts.priorities)
    if (set.size === 0) return false
    if (set.size < 3) {
      const pri = resolveQuestionPriority(q) as LcPriority | null
      if (!pri || !set.has(pri)) return false
    }
  }
  return true
}

export type LcDifficulty = 'Easy' | 'Medium' | 'Hard'
export type LcPriority = 'High' | 'Mid' | 'Low'

export const LC_DIFFICULTIES: LcDifficulty[] = ['Easy', 'Medium', 'Hard']
export const LC_PRIORITIES: LcPriority[] = ['High', 'Mid', 'Low']

export function difficultyLabel(diffs: ReadonlySet<LcDifficulty>): string | null {
  if (diffs.size === 0 || diffs.size === 3) return null
  return LC_DIFFICULTIES.filter(d => diffs.has(d)).join('+')
}

export function priorityLabel(pris: ReadonlySet<LcPriority>): string | null {
  if (pris.size === 0 || pris.size === 3) return null
  return LC_PRIORITIES.filter(p => pris.has(p)).join('+')
}

export function withBatchSuffixes(
  listName: string,
  difficulties: ReadonlySet<LcDifficulty>,
  priorities: ReadonlySet<LcPriority>,
): string {
  const tags = [priorityLabel(priorities), difficultyLabel(difficulties)].filter(Boolean) as string[]
  if (!tags.length) return listName
  if (listName === 'LeetMastery All 727') return tags.join(' · ')
  return `${listName} · ${tags.join(' · ')}`
}

export function withDifficultySuffix(listName: string, diffs: ReadonlySet<LcDifficulty>): string {
  return withBatchSuffixes(listName, diffs, new Set(LC_PRIORITIES))
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
    id: 'lts-all',
    label: 'LtS · All 727',
    setFilter: 'all',
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 'lts-high',
    label: 'LtS · High only',
    setFilter: 'all',
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 'lts-mid',
    label: 'LtS · Mid only',
    setFilter: 'all',
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
  {
    id: 'lts-low',
    label: 'LtS · Low only',
    setFilter: 'all',
    tierFilter: 'all',
    patternFilter: 'all',
    split: 'pattern',
  },
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

const LTS_PRIO_ORD: Record<string, number> = { High: 0, Mid: 1, Low: 2 }
const LTS_BAND_ORD: Record<string, number> = { long: 0, medium: 1, short: 2, tiny: 3 }
const LTS_DIFF_ORD: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
function ltsBand(n: number) {
  return n >= 16 ? 'long' : n >= 10 ? 'medium' : n >= 5 ? 'short' : 'tiny'
}

/**
 * Returns a single-item array: one LC list containing all questions (or only one
 * priority) sorted in LtS order — High→Mid→Low, 16+q→10-15q→5-9q→1-4q within
 * each priority, then Easy→Med→Hard, larger section first, S1→S2→S3, then pattern.
 */
export function planLtsLcLists(
  allQuestions: GrindQuestion[],
  priorityFilter?: 'High' | 'Mid' | 'Low',
): BatchListPlan[] {
  // First pass: compute section sizes so we can determine bands
  const secSize = new Map<string, number>()
  for (const q of allQuestions) {
    const tier = questionStudyTier(q)
    if (!tier || !q.pattern) continue
    const secKey = `${tier}|${q.set}|${q.pattern}`
    secSize.set(secKey, (secSize.get(secKey) ?? 0) + 1)
  }

  // Filter by priority if requested
  const pool = allQuestions.filter(q => {
    const tier = questionStudyTier(q)
    if (!tier || !q.pattern) return false
    if (priorityFilter && !tier.startsWith(priorityFilter)) return false
    return true
  })

  // Sort each question by its section's LtS position, then by id within section
  const sorted = [...pool].sort((a, b) => {
    const ta = questionStudyTier(a)!, tb = questionStudyTier(b)!
    const [pa, da] = ta.split(' '), [pb, db] = tb.split(' ')
    const po = (LTS_PRIO_ORD[pa] ?? 9) - (LTS_PRIO_ORD[pb] ?? 9)
    if (po !== 0) return po
    const na = secSize.get(`${ta}|${a.set}|${a.pattern}`) ?? 0
    const nb = secSize.get(`${tb}|${b.set}|${b.pattern}`) ?? 0
    const bo = (LTS_BAND_ORD[ltsBand(na)] ?? 9) - (LTS_BAND_ORD[ltsBand(nb)] ?? 9)
    if (bo !== 0) return bo
    const dif = (LTS_DIFF_ORD[da] ?? 9) - (LTS_DIFF_ORD[db] ?? 9)
    if (dif !== 0) return dif
    if (na !== nb) return nb - na  // larger section first
    if (a.set !== b.set) return a.set - b.set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pi = DISPLAY_PATTERN_ORDER.indexOf(a.pattern as any ?? '')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pj = DISPLAY_PATTERN_ORDER.indexOf(b.pattern as any ?? '')
    if (pi !== pj) return pi - pj
    return a.id - b.id  // stable within section
  })

  const listName = priorityFilter ? `LtS · ${priorityFilter}` : `LtS · All ${sorted.length}`
  const key = priorityFilter ? `lts-${priorityFilter.toLowerCase()}` : 'lts-all'
  return [{ key, listName, questions: sorted }]
}

export function planPresetLcLists(
  allQuestions: GrindQuestion[],
  preset: LcBatchPreset,
  nameOrder: LcNamePart[],
  difficulties: ReadonlySet<LcDifficulty> = new Set(LC_DIFFICULTIES),
  priorities: ReadonlySet<LcPriority> = new Set(LC_PRIORITIES),
): BatchListPlan[] {
  const pool = allQuestions.filter(q =>
    questionMatchesFilters(q, {
      setFilter: preset.setFilter,
      tierFilter: preset.tierFilter,
      patternFilter: preset.patternFilter,
      difficulties,
      priorities,
    }),
  )
  const tierInOrder = nameOrder.includes('tier')
  return planBatchLcLists(pool, preset.split, nameOrder, {
    setFilter: preset.setFilter,
    tierFilter: preset.tierFilter,
    patternFilter: preset.patternFilter,
  })
    .map(plan => {
      // If the tier is already embedded in the name (e.g. "HE"), the abbreviated
      // tier encodes both priority and difficulty — skip the redundant suffix.
      const tierCovered = tierInOrder && commonTier(plan.questions) !== null
      return {
        ...plan,
        listName: tierCovered
          ? plan.listName
          : withBatchSuffixes(plan.listName, difficulties, priorities),
      }
    })
    .filter(plan => plan.questions.length > 0)
}

/** Apply difficulty + priority ticks to an already-planned batch. */
export function applyBatchTicks(
  plans: BatchListPlan[],
  difficulties: ReadonlySet<LcDifficulty>,
  priorities: ReadonlySet<LcPriority>,
): BatchListPlan[] {
  return plans
    .map(plan => {
      const questions = plan.questions.filter(q => {
        if (difficulties.size === 0 || priorities.size === 0) return false
        if (difficulties.size < 3 && !difficulties.has(q.difficulty as LcDifficulty)) return false
        if (priorities.size < 3) {
          const pri = resolveQuestionPriority(q) as LcPriority | null
          if (!pri || !priorities.has(pri)) return false
        }
        return true
      })
      return {
        ...plan,
        questions,
        listName: withBatchSuffixes(plan.listName, difficulties, priorities),
      }
    })
    .filter(plan => plan.questions.length > 0)
}

/** @deprecated use applyBatchTicks */
export function applyBatchDifficulties(
  plans: BatchListPlan[],
  difficulties: ReadonlySet<LcDifficulty>,
): BatchListPlan[] {
  return applyBatchTicks(plans, difficulties, new Set(LC_PRIORITIES))
}

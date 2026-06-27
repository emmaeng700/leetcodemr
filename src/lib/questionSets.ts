import { PATTERN_PRIORITY } from './constants'
import { buildExclusivePatternMap } from './patternUtils'
import { studyOrder } from './studyOrder'
import { NEETCODE_250, NC250_TOTAL, ALL_NC250_IDS } from './neetcode250'
import { ALGOMASTER_600 } from './algomaster600'
export { NC250_TOTAL }
import ncExtraQuestions from '../../neetcode_extra_questions.json'
import am600ExtraQuestions from '../../am600_extra_questions.json'

export interface SetQuestion {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  category: string
  tags: string[]
}

/** All NeetCode 250 ids — Set 3 excludes these so Set 2/3 never overlap. */
export const NC250_ID_SET: Set<number> = ALL_NC250_IDS

export const NC250_EXCLUSIVE_TOTAL = NC250_TOTAL

/** @deprecated use NC250_ID_SET — Set 2/3 now use NeetCode 250. */
export const NC150_ID_SET = NC250_ID_SET
export const AM600_TOTAL = ALGOMASTER_600.reduce((n, c) => n + c.questions.length, 0)

/** Questions in a catalog list that are not in Set 1 (`questions_full.json`). */
export function countCatalogNotInSet1(
  catalog: ReadonlyArray<{ questions: ReadonlyArray<{ id: number }> }>,
  mainIds: Set<number>,
): number {
  return catalog.reduce(
    (n, cat) => n + cat.questions.filter(q => !mainIds.has(q.id)).length,
    0,
  )
}

export function countNc250NotInSet1(mainIds: Set<number>): number {
  return countCatalogNotInSet1(NEETCODE_250, mainIds)
}

/** @deprecated use countNc250NotInSet1 */
export function countNc150NotInSet1(mainIds: Set<number>): number {
  return countNc250NotInSet1(mainIds)
}

export function countAm600NotInSet1(mainIds: Set<number>): number {
  return countCatalogNotInSet1(ALGOMASTER_600, mainIds)
}

/** Union of Set 1 + exclusive Set 2 + exclusive Set 3 (pairwise disjoint by id). */
export function totalAppQuestionCount(
  set1Count: number,
  set2Count: number,
  set3Count: number,
): number {
  return set1Count + set2Count + set3Count
}

export type AppQuestionTotals = {
  set1Count: number
  set2Count: number
  set3Count: number
  total: number
  unionIds: Set<number>
}

/** Counts per set with union check — set2/set3 exclude Set 1; set3 also excludes all NC250 ids. */
export function computeAppQuestionTotals(
  mainQuestions: ReadonlyArray<{ id: number }>,
): AppQuestionTotals {
  const mainIds = new Set(mainQuestions.map(q => q.id))
  const set2 = getSet2Questions(mainIds, mainQuestions)
  const set3 = getSet3Questions(mainIds, mainQuestions)
  const unionIds = new Set<number>([
    ...mainIds,
    ...set2.map(q => q.id),
    ...set3.map(q => q.id),
  ])
  const set1Count = mainIds.size
  const set2Count = set2.length
  const set3Count = set3.length
  return {
    set1Count,
    set2Count,
    set3Count,
    total: set1Count + set2Count + set3Count,
    unionIds,
  }
}

type TaggedRow = { id: number; tags?: string[] }

/** Tags from main bank + scraped extra JSON (Set 2/3 questions often live only in extras). */
export function buildSetTagMap(mainQuestions: TaggedRow[]): Record<number, string[]> {
  const map: Record<number, string[]> = {}
  for (const q of [...mainQuestions, ...ncExtraQuestions, ...am600ExtraQuestions] as TaggedRow[]) {
    if (Array.isArray(q.tags) && q.tags.length > 0) map[q.id] = q.tags
  }
  return map
}

function rawSet2Questions(mainIds: Set<number>): Omit<SetQuestion, 'tags'>[] {
  return NEETCODE_250.flatMap(cat =>
    cat.questions
      .filter(q => !mainIds.has(q.id))
      .map(q => ({
        id: q.id,
        title: q.title,
        slug: q.slug,
        difficulty: q.difficulty,
        category: cat.name,
      }))
  )
}

function rawSet3Questions(mainIds: Set<number>): Omit<SetQuestion, 'tags'>[] {
  return ALGOMASTER_600.flatMap(cat =>
    cat.questions
      .filter(q => !NC250_ID_SET.has(q.id) && !mainIds.has(q.id))
      .map(q => ({
        id: q.id,
        title: q.title,
        slug: q.slug,
        difficulty: q.difficulty,
        category: cat.name,
      }))
  )
}

/** Attach tags and order by priority tier → difficulty → pattern (same as Learn 1). */
export function prepareSetQuestions(
  set: 2 | 3,
  mainQuestions: TaggedRow[],
  tagMap: Record<number, string[]> = buildSetTagMap(mainQuestions),
): SetQuestion[] {
  const mainIds = new Set(mainQuestions.map(q => q.id))
  const raw = set === 2 ? rawSet2Questions(mainIds) : rawSet3Questions(mainIds)
  const enriched: SetQuestion[] = raw.map(q => ({
    ...q,
    tags: tagMap[q.id] ?? [],
  }))
  const order = studyOrder(enriched)
  const byId = Object.fromEntries(enriched.map(q => [q.id, q]))
  return order.map(id => byId[id]).filter(Boolean)
}

export function getSet2Questions(mainIds: Set<number>, mainQuestions?: TaggedRow[]): SetQuestion[] {
  const main = mainQuestions?.length
    ? mainQuestions
    : Array.from(mainIds).map(id => ({ id }))
  return prepareSetQuestions(2, main)
}

export function getSet3Questions(mainIds: Set<number>, mainQuestions?: TaggedRow[]): SetQuestion[] {
  const main = mainQuestions?.length
    ? mainQuestions
    : Array.from(mainIds).map(id => ({ id }))
  return prepareSetQuestions(3, main)
}

export function buildSetExclusiveMap(questions: SetQuestion[]): Record<number, string> {
  // Use the authoritative category field (NeetCode / AM600 category) so the
  // pattern label, round headers, and stats all show the same grouping.
  // Fall back to tag-based mapping only if category is missing.
  const map: Record<number, string> = {}
  const unmatched: SetQuestion[] = []
  for (const q of questions) {
    if (q.category) {
      map[q.id] = q.category
    } else {
      unmatched.push(q)
    }
  }
  if (unmatched.length > 0) {
    const fallback = buildExclusivePatternMap(unmatched)
    Object.assign(map, fallback)
  }
  return map
}

/** Priority × difficulty round presets (indices into the given question list). */
export function buildPriorityDifficultyPresets(
  questions: Array<{ id: number; difficulty: string }>,
  exclusiveMap: Record<number, string>,
  opts?: { minCount?: number; labelSuffix?: string },
): { label: string; start: number; end: number }[] {
  const minCount = opts?.minCount ?? 1
  const suffix = opts?.labelSuffix ?? ' questions'
  const PRI = ['High', 'Mid', 'Low'] as const
  const DIFF = ['Easy', 'Medium', 'Hard'] as const
  const out: { label: string; start: number; end: number }[] = []
  for (const pri of PRI) {
    for (const diff of DIFF) {
      const indices = questions
        .map((q, i) => ({
          i,
          pri: PATTERN_PRIORITY[exclusiveMap[q.id] ?? ''] ?? null,
          diff: q.difficulty,
        }))
        .filter(x => x.pri === pri && x.diff === diff)
        .map(x => x.i)
      if (indices.length >= minCount) {
        out.push({
          label: `${pri} ${diff} (${indices.length}${suffix})`,
          start: indices[0],
          end: indices[indices.length - 1],
        })
      }
    }
  }
  return out
}

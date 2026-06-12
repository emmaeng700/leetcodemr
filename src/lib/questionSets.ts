import { PATTERN_PRIORITY } from './constants'
import { buildExclusivePatternMap } from './patternUtils'
import { studyOrder } from './studyOrder'
import { NEETCODE_150 } from './neetcode150'
import { ALGOMASTER_600 } from './algomaster600'
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

export const NC150_ID_SET: Set<number> = new Set(
  NEETCODE_150.flatMap(c => c.questions.map(q => q.id))
)

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
  return NEETCODE_150.flatMap(cat =>
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
      .filter(q => !NC150_ID_SET.has(q.id) && !mainIds.has(q.id))
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
  return buildExclusivePatternMap(questions)
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

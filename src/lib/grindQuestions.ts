import type { SetQuestion } from '@/lib/questionSets'
import { buildSetTagMap } from '@/lib/questionSets'
import { PATTERN_PRIORITY } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { studyOrder } from '@/lib/studyOrder'
import ncExtraQuestions from '../../neetcode_extra_questions.json'
import am600ExtraQuestions from '../../am600_extra_questions.json'

export type GrindQuestion = {
  set: 1 | 2 | 3
  id: number
  title: string
  slug: string
  difficulty: string
  /** Exclusive pattern name (same assignment as study PDFs). */
  pattern: string | null
  /** e.g. "High Easy - Arrays & Hashing" for list section headers. */
  section: string | null
  starterPython?: string
  starterCpp?: string
  /** STAR-LC interview approach script, baked in so it works fully offline. */
  interviewApproach?: string
}

type Set1Row = {
  id: number
  title: string
  slug: string
  difficulty: string
  tags?: string[]
  starter_python?: string
  starter_cpp?: string
}

type ExtraStarterRow = {
  id: number
  starter_python?: string
  starter_cpp?: string
}

const EXTRA_STARTERS: Record<number, { starterPython?: string; starterCpp?: string }> = {}
for (const q of [...ncExtraQuestions, ...am600ExtraQuestions] as ExtraStarterRow[]) {
  if (q.starter_python || q.starter_cpp) {
    EXTRA_STARTERS[q.id] = {
      starterPython: q.starter_python,
      starterCpp: q.starter_cpp,
    }
  }
}

function sectionLabel(pattern: string | null, difficulty: string): string | null {
  if (!pattern) return null
  const priority = PATTERN_PRIORITY[pattern as keyof typeof PATTERN_PRIORITY]
  if (!priority) return pattern
  return `${priority} ${difficulty} - ${pattern}`
}

function toGrindRow(
  set: 1 | 2 | 3,
  q: { id: number; title: string; slug: string; difficulty: string; starter_python?: string; starter_cpp?: string },
  patternMap: Record<number, string>,
  extraStarters?: { starterPython?: string; starterCpp?: string },
  playbookMap?: Record<number, string>,
): GrindQuestion {
  const pattern = patternMap[q.id] ?? null
  return {
    set,
    id: q.id,
    title: q.title,
    slug: q.slug,
    difficulty: q.difficulty,
    pattern,
    section: sectionLabel(pattern, q.difficulty),
    starterPython: q.starter_python ?? extraStarters?.starterPython,
    starterCpp: q.starter_cpp ?? extraStarters?.starterCpp,
    interviewApproach: playbookMap?.[q.id],
  }
}

/**
 * All 727 questions: Set 1 -> Set 2 -> Set 3.
 * Within each set: priority tier -> difficulty -> pattern (studyOrder.ts / PDF order).
 */
export function buildGrindQuestions(
  set1: Set1Row[],
  set2: SetQuestion[],
  set3: SetQuestion[],
  playbookMap: Record<number, string> = {},
): GrindQuestion[] {
  const tagMap = buildSetTagMap(set1)
  const rows: GrindQuestion[] = []

  const set1Tagged = set1.map(q => ({
    ...q,
    tags: q.tags ?? [],
  }))
  const set1PatternMap = buildExclusivePatternMap(set1Tagged)
  const set1Order = studyOrder(
    set1Tagged.map(q => ({ id: q.id, tags: q.tags, difficulty: q.difficulty })),
  )
  const set1ById = Object.fromEntries(set1Tagged.map(q => [q.id, q]))
  for (const id of set1Order) {
    const q = set1ById[id]
    if (q) rows.push(toGrindRow(1, q, set1PatternMap, undefined, playbookMap))
  }

  const set2Tagged = set2.map(q => ({ ...q, tags: tagMap[q.id] ?? q.tags ?? [] }))
  const set2PatternMap = buildExclusivePatternMap(set2Tagged)
  for (const q of set2) {
    rows.push(toGrindRow(2, q, set2PatternMap, EXTRA_STARTERS[q.id], playbookMap))
  }

  const set3Tagged = set3.map(q => ({ ...q, tags: tagMap[q.id] ?? q.tags ?? [] }))
  const set3PatternMap = buildExclusivePatternMap(set3Tagged)
  for (const q of set3) {
    rows.push(toGrindRow(3, q, set3PatternMap, EXTRA_STARTERS[q.id], playbookMap))
  }

  return rows
}

const SW_CACHE_FALLBACKS = ['lm-v12', 'lm-v11', 'lm-v10', 'lm-v9', 'lm-v8']

/** Load questions_full.json - uses service worker cache when offline. */
export async function loadQuestionsFullJson(): Promise<Set1Row[]> {
  try {
    const res = await fetch('/questions_full.json')
    if (res.ok) return res.json() as Promise<Set1Row[]>
  } catch {
    /* offline or network error */
  }

  if (typeof caches !== 'undefined') {
    for (const cacheName of SW_CACHE_FALLBACKS) {
      try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match('/questions_full.json')
        if (cached) return cached.json() as Promise<Set1Row[]>
      } catch {
        /* ignore */
      }
    }
  }

  throw new Error('Could not load questions (offline and not cached yet)')
}

/** Pre-built 727-question bundle (interview approach baked in) for offline Grind. */
export async function loadGrindQuestionsBundle(): Promise<GrindQuestion[]> {
  try {
    const res = await fetch('/grind_questions.json')
    if (res.ok) return res.json() as Promise<GrindQuestion[]>
  } catch {
    /* offline or network error */
  }

  if (typeof caches !== 'undefined') {
    for (const cacheName of SW_CACHE_FALLBACKS) {
      try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match('/grind_questions.json')
        if (cached) return cached.json() as Promise<GrindQuestion[]>
      } catch {
        /* ignore */
      }
    }
  }

  return []
}

type PlaybookEntry = { title: string; script: string }

/** Load playbook_data_all.json (all 727 interview approaches) - uses SW cache when offline. */
export async function loadPlaybookMap(): Promise<Record<number, string>> {
  const toMap = (json: Record<string, PlaybookEntry>): Record<number, string> => {
    const out: Record<number, string> = {}
    for (const [id, entry] of Object.entries(json)) out[Number(id)] = entry.script
    return out
  }

  try {
    const res = await fetch('/playbook_data_all.json')
    if (res.ok) return toMap(await res.json())
  } catch {
    /* offline or network error */
  }

  if (typeof caches !== 'undefined') {
    for (const cacheName of SW_CACHE_FALLBACKS) {
      try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match('/playbook_data_all.json')
        if (cached) return toMap(await cached.json())
      } catch {
        /* ignore */
      }
    }
  }

  return {}
}

import type { SetQuestion } from '@/lib/questionSets'
import ncExtraQuestions from '../../neetcode_extra_questions.json'
import am600ExtraQuestions from '../../am600_extra_questions.json'

export type GrindQuestion = {
  set: 1 | 2 | 3
  id: number
  title: string
  slug: string
  difficulty: string
  starterPython?: string
  starterCpp?: string
}

type Set1Row = {
  id: number
  title: string
  slug: string
  difficulty: string
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

/** All 727 app questions in set order (Set 1 -> Set 2 -> Set 3). */
export function buildGrindQuestions(
  set1: Set1Row[],
  set2: SetQuestion[],
  set3: SetQuestion[],
): GrindQuestion[] {
  const rows: GrindQuestion[] = []

  for (const q of set1) {
    rows.push({
      set: 1,
      id: q.id,
      title: q.title,
      slug: q.slug,
      difficulty: q.difficulty,
      starterPython: q.starter_python,
      starterCpp: q.starter_cpp,
    })
  }
  for (const q of set2) {
    const extra = EXTRA_STARTERS[q.id]
    rows.push({
      set: 2,
      id: q.id,
      title: q.title,
      slug: q.slug,
      difficulty: q.difficulty,
      starterPython: extra?.starterPython,
      starterCpp: extra?.starterCpp,
    })
  }
  for (const q of set3) {
    const extra = EXTRA_STARTERS[q.id]
    rows.push({
      set: 3,
      id: q.id,
      title: q.title,
      slug: q.slug,
      difficulty: q.difficulty,
      starterPython: extra?.starterPython,
      starterCpp: extra?.starterCpp,
    })
  }

  return rows.sort((a, b) => a.set - b.set || a.id - b.id)
}

/** Load questions_full.json — uses service worker cache when offline. */
export async function loadQuestionsFullJson(): Promise<Set1Row[]> {
  try {
    const res = await fetch('/questions_full.json')
    if (res.ok) return res.json() as Promise<Set1Row[]>
  } catch {
    /* offline or network error */
  }

  if (typeof caches !== 'undefined') {
    for (const cacheName of ['lm-v7', 'lm-v6']) {
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

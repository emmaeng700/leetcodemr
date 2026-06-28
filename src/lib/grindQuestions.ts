import type { SetQuestion } from '@/lib/questionSets'

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

/** All 727 app questions in set order (Set 1 ? Set 2 ? Set 3). */
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
    rows.push({
      set: 2,
      id: q.id,
      title: q.title,
      slug: q.slug,
      difficulty: q.difficulty,
    })
  }
  for (const q of set3) {
    rows.push({
      set: 3,
      id: q.id,
      title: q.title,
      slug: q.slug,
      difficulty: q.difficulty,
    })
  }

  return rows.sort((a, b) => a.set - b.set || a.id - b.id)
}

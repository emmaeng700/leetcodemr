import { NEETCODE_150 } from './neetcode150'
import { ALGOMASTER_600 } from './algomaster600'

export interface SetQuestion {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  category: string
}

export const NC150_ID_SET: Set<number> = new Set(
  NEETCODE_150.flatMap(c => c.questions.map(q => q.id))
)

const DIFF_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }

// Sort questions: preserve source category order, sort Easy→Medium→Hard within each category
function sortByCategoryThenDifficulty(qs: SetQuestion[], catOrder: string[]): SetQuestion[] {
  return [...qs].sort((a, b) => {
    const ci = catOrder.indexOf(a.category) - catOrder.indexOf(b.category)
    if (ci !== 0) return ci
    return (DIFF_ORDER[a.difficulty] ?? 0) - (DIFF_ORDER[b.difficulty] ?? 0)
  })
}

// Set 2: NeetCode 150 questions NOT in the main 331 questions_full.json
export function getSet2Questions(mainIds: Set<number>): SetQuestion[] {
  const catOrder = NEETCODE_150.map(c => c.name)
  const qs = NEETCODE_150.flatMap(cat =>
    cat.questions
      .filter(q => !mainIds.has(q.id))
      .map(q => ({ id: q.id, title: q.title, slug: q.slug, difficulty: q.difficulty, category: cat.name }))
  )
  return sortByCategoryThenDifficulty(qs, catOrder)
}

// Set 3: AlgoMaster 600 questions NOT in NeetCode 150 and NOT in main 331
export function getSet3Questions(mainIds: Set<number>): SetQuestion[] {
  const catOrder = ALGOMASTER_600.map(c => c.name)
  const qs = ALGOMASTER_600.flatMap(cat =>
    cat.questions
      .filter(q => !NC150_ID_SET.has(q.id) && !mainIds.has(q.id))
      .map(q => ({ id: q.id, title: q.title, slug: q.slug, difficulty: q.difficulty, category: cat.name }))
  )
  return sortByCategoryThenDifficulty(qs, catOrder)
}

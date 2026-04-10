import { QUICK_PATTERNS } from './constants'

export type PatternStat = {
  name: string
  tags: readonly string[]
  total: number
  solved: number
  mastered: number
  pct: number
  masteredPct: number
}

export function getPatternStats(
  questions: Array<{ id: number; tags: string[] }>,
  progress: Record<string, { solved?: boolean; status?: string | null }>
): PatternStat[] {
  return QUICK_PATTERNS.map(pattern => {
    const qs = questions.filter(q =>
      (q.tags || []).some(t => (pattern.tags as readonly string[]).includes(t))
    )
    const solved = qs.filter(q => progress[String(q.id)]?.solved).length
    const mastered = qs.filter(q => progress[String(q.id)]?.status === 'mastered').length
    const total = qs.length
    return {
      name: pattern.name,
      tags: pattern.tags,
      total,
      solved,
      mastered,
      pct: total > 0 ? Math.round((solved / total) * 100) : 0,
      masteredPct: total > 0 ? Math.round((mastered / total) * 100) : 0,
    }
  }).filter(p => p.total > 0)
}

export function getPatternForQuestion(tags: string[]): string | null {
  for (const pattern of QUICK_PATTERNS) {
    if ((tags || []).some(t => (pattern.tags as readonly string[]).includes(t))) return pattern.name
  }
  return null
}

/** Order questions pattern-by-pattern, Easy→Medium→Hard within each pattern. */
export function patternBasedStudyOrder(
  questions: Array<{ id: number; tags: string[]; difficulty: string }>
): number[] {
  const diffRank: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
  const result: number[] = []
  const used = new Set<number>()

  for (const pattern of QUICK_PATTERNS) {
    const patternQs = questions
      .filter(q => !used.has(q.id) && (q.tags || []).some(t => (pattern.tags as readonly string[]).includes(t)))
      .sort((a, b) => (diffRank[a.difficulty] ?? 1) - (diffRank[b.difficulty] ?? 1))
    for (const q of patternQs) {
      result.push(q.id)
      used.add(q.id)
    }
  }
  // Any unmatched questions (no recognized tags) go at the end
  for (const q of questions) {
    if (!used.has(q.id)) result.push(q.id)
  }
  return result
}

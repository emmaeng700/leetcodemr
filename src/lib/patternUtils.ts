import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from './constants'

export type PatternStat = {
  name: string
  tags: readonly string[]
  total: number
  solved: number
  mastered: number
  pct: number
  masteredPct: number
}

/**
 * Assigns each question to exactly ONE pattern — the first pattern in QUICK_PATTERNS
 * whose tags overlap the question's tags. Same logic as patternBasedStudyOrder.
 * Returns a map of questionId → patternName (undefined = no recognized pattern).
 */
export function buildExclusivePatternMap(
  questions: Array<{ id: number; tags: string[] }>,
  patternOrder: typeof QUICK_PATTERNS = QUICK_PATTERNS,
): Record<number, string> {
  const map: Record<number, string> = {}
  const used = new Set<number>()
  for (const pattern of patternOrder) {
    for (const q of questions) {
      if (used.has(q.id)) continue
      if ((q.tags || []).some(t => (pattern.tags as readonly string[]).includes(t))) {
        map[q.id] = pattern.name
        used.add(q.id)
      }
    }
  }
  return map
}

/**
 * Per-pattern stats using exclusive assignment — each question counted in exactly one pattern.
 */
export function getPatternStats(
  questions: Array<{ id: number; tags: string[] }>,
  progress: Record<string, { solved?: boolean; status?: string | null }>
): PatternStat[] {
  const exclusiveMap = buildExclusivePatternMap(questions)
  return QUICK_PATTERNS.map(pattern => {
    const qs = questions.filter(q => exclusiveMap[q.id] === pattern.name)
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

/** Returns the pattern name that exclusively owns this question (first match). */
export function getPatternForQuestion(tags: string[]): string | null {
  for (const pattern of QUICK_PATTERNS) {
    if ((tags || []).some(t => (pattern.tags as readonly string[]).includes(t))) return pattern.name
  }
  return null
}

/**
 * Order questions pattern-by-pattern, Easy→Medium→Hard within each pattern.
 * If startPatternName is provided, that pattern goes first; the rest follow
 * in their original order (wrapping around), so no pattern is skipped.
 */
export function patternBasedStudyOrder(
  questions: Array<{ id: number; tags: string[]; difficulty: string }>,
  startPatternName?: string | null
): number[] {
  const diffRank: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
  const result: number[] = []
  const used = new Set<number>()

  // Use the human-facing display order for study flow, while preserving the
  // exclusive-assignment logic elsewhere that still relies on QUICK_PATTERNS order.
  const patterns = [...QUICK_PATTERNS].sort(
    (a, b) =>
      DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
      DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number])
  )
  if (startPatternName) {
    const startIdx = patterns.findIndex(p => p.name === startPatternName)
    if (startIdx > 0) {
      const rotated = [...patterns.slice(startIdx), ...patterns.slice(0, startIdx)]
      patterns.splice(0, patterns.length, ...rotated)
    }
  }

  for (const pattern of patterns) {
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

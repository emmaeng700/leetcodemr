import { PATTERN_PRIORITY } from '@/lib/constants'
import type { GrindQuestion } from './grindQuestions'

export type GrindListEntry =
  | { type: 'divider'; label: string; key: string; variant: 'set' | 'section'; count: number }
  | { type: 'question'; q: GrindQuestion; key: string }

export type GrindSummaryCounts = {
  total: number
  bySet: Record<1 | 2 | 3, number>
  byDifficulty: Record<string, number>
  byPriority: Record<string, number>
  byPattern: Record<string, number>
}

const SET_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Set 1 - Main',
  2: 'Set 2 - NeetCode',
  3: 'Set 3 - AlgoMaster',
}

/** Totals per set, difficulty, priority tier, and pattern for the current question list. */
export function grindSummaryCounts(questions: GrindQuestion[]): GrindSummaryCounts {
  const bySet: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  const byDifficulty: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byPattern: Record<string, number> = {}

  for (const q of questions) {
    bySet[q.set]++
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1
    if (q.pattern) {
      byPattern[q.pattern] = (byPattern[q.pattern] ?? 0) + 1
      const pri = PATTERN_PRIORITY[q.pattern]
      if (pri) byPriority[pri] = (byPriority[pri] ?? 0) + 1
    }
  }

  return { total: questions.length, bySet, byDifficulty, byPriority, byPattern }
}

/** Sidebar rows with Set + study-order section dividers (matches PDF rounds). */
export function grindListWithDividers(questions: GrindQuestion[]): GrindListEntry[] {
  const setCounts = new Map<number, number>()
  const sectionCounts = new Map<string, number>()
  for (const q of questions) {
    setCounts.set(q.set, (setCounts.get(q.set) ?? 0) + 1)
    if (q.section) sectionCounts.set(q.section, (sectionCounts.get(q.section) ?? 0) + 1)
  }

  const out: GrindListEntry[] = []
  let lastSet = 0
  let lastSection: string | null = null

  for (const q of questions) {
    if (q.set !== lastSet) {
      out.push({
        type: 'divider',
        label: SET_LABEL[q.set],
        key: `set-${q.set}`,
        variant: 'set',
        count: setCounts.get(q.set) ?? 0,
      })
      lastSet = q.set
      lastSection = null
    }
    if (q.section && q.section !== lastSection) {
      out.push({
        type: 'divider',
        label: q.section,
        key: `sec-${q.set}-${q.section}`,
        variant: 'section',
        count: sectionCounts.get(q.section) ?? 0,
      })
      lastSection = q.section
    }
    out.push({ type: 'question', q, key: `q-${q.set}-${q.id}` })
  }

  return out
}

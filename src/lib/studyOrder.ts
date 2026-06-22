/**
 * Canonical study ordering for LeetMastery — import from here.
 * Changing this ONE file changes the question order across the entire app.
 *
 * Priority-grouped, difficulty-first:
 *
 *   Rounds 1-3  — High-priority patterns  (Arrays & Hashing, String, Two Pointers,
 *                  Sliding Window, Sorting, Binary Search, Matrix, Trees & BST, DFS,
 *                  Graphs, BFS)
 *                    Round 1 · Easy    Round 2 · Medium    Round 3 · Hard
 *
 *   Rounds 4-6  — Mid-priority patterns   (Linked List, Stack, Heap, Trie,
 *                  Backtracking, Greedy)
 *                    Round 4 · Easy    Round 5 · Medium    Round 6 · Hard
 *
 *   Rounds 7-9  — Low-priority patterns   (Dynamic Programming, Bit Manipulation,
 *                  Math, JavaScript)
 *                    Round 7 · Easy    Round 8 · Medium    Round 9 · Hard
 *
 * Within each round, patterns follow DISPLAY_PATTERN_ORDER.
 * Within each pattern bucket questions are sorted by id ascending.
 * Questions with no recognised pattern tags are appended at the very end.
 */

import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY, type PatternPriority } from './constants'
import { buildExclusivePatternMap } from './patternUtils'

const PRIORITY_TIERS: PatternPriority[] = ['High', 'Mid', 'Low']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const

export type StudyQuestion = { id: number; tags: string[]; difficulty: string }

export function studyOrder(questions: StudyQuestion[]): number[] {
  const exclusiveMap = buildExclusivePatternMap(questions)
  const result: number[] = []

  for (const priority of PRIORITY_TIERS) {
    const tierPatterns = DISPLAY_PATTERN_ORDER.filter(p => PATTERN_PRIORITY[p] === priority)
    for (const diff of DIFFICULTIES) {
      for (const patternName of tierPatterns) {
        const bucket = questions
          .filter(q => exclusiveMap[q.id] === patternName && q.difficulty === diff)
          .sort((a, b) => a.id - b.id)
        for (const q of bucket) result.push(q.id)
      }
    }
  }

  // Any question whose tags matched no pattern goes at the very end
  const placed = new Set(result)
  for (const q of questions) {
    if (!placed.has(q.id)) result.push(q.id)
  }

  return result
}

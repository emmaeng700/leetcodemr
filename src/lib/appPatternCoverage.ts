import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY, QUICK_PATTERNS } from './constants'
import { buildExclusivePatternMap, getPatternForQuestion } from './patternUtils'
import type { SetQuestion } from './questionSets'

/** NeetCode 250 category ? canonical Set 1 pattern name (when different). */
export const NC_PATTERN_MAP: Record<string, string> = {
  'Arrays & Hashing': 'Arrays & Hashing',
  'Two Pointers': 'Two Pointers',
  'Sliding Window': 'Sliding Window',
  Stack: 'Stack',
  'Binary Search': 'Binary Search',
  'Linked List': 'Linked List',
  Trees: 'Trees & BST',
  'Heap / Priority Queue': 'Heap',
  Backtracking: 'Backtracking',
  Tries: 'Trie',
  Graphs: 'Graphs',
  'Advanced Graphs': 'Graphs',
  '1-D Dynamic Programming': 'Dynamic Programming',
  '2-D Dynamic Programming': 'Dynamic Programming',
  Greedy: 'Greedy',
  Intervals: 'Sorting',
  'Math & Geometry': 'Math',
  'Bit Manipulation': 'Bit Manipulation',
}

/** AlgoMaster 600 category ? canonical pattern (unmapped names stay as their own row). */
export const AM600_PATTERN_MAP: Record<string, string> = {
  Arrays: 'Arrays & Hashing',
  Strings: 'String',
  'Hash Tables': 'Arrays & Hashing',
  'Prefix Sum': 'Arrays & Hashing',
  'Two Pointers': 'Two Pointers',
  'Fast and Slow Pointers': 'Linked List',
  'Sliding Window - Fixed Size': 'Sliding Window',
  'Sliding Window - Dynamic Size': 'Sliding Window',
  'Matrix (2D Array)': 'Matrix',
  'Linked List': 'Linked List',
  'LinkedList In-place Reversal': 'Linked List',
  Stacks: 'Stack',
  'Monotonic Stack': 'Stack',
  Queues: 'Stack',
  'Monotonic Queue': 'Stack',
  'Bucket Sort': 'Sorting',
  'Divide and Conquer': 'Sorting',
  'Merge Sort': 'Sorting',
  'QuickSort / QuickSelect': 'Sorting',
  'Binary Search': 'Binary Search',
  Backtracking: 'Backtracking',
  'Tree Traversal - Level Order': 'BFS',
  'Tree Traversal - Pre Order': 'Trees & BST',
  'Tree Traversal - In Order': 'Trees & BST',
  'Tree Traversal - Post-Order': 'Trees & BST',
  'BST / Ordered Set': 'Trees & BST',
  Tries: 'Trie',
  Heaps: 'Heap',
  'Two Heaps': 'Heap',
  'Top K Elements': 'Heap',
  Intervals: 'Sorting',
  Greedy: 'Greedy',
  'Depth First Search (DFS)': 'DFS',
  Recursion: 'DFS',
  'Breadth First Search (BFS)': 'BFS',
  'Topological Sort': 'Graphs',
  'Union Find': 'Graphs',
  'Minimum Spanning Tree': 'Graphs',
  'Shortest Path': 'Graphs',
  'Eulerian Circuit': 'Graphs',
  '1-D DP': 'Dynamic Programming',
  '0/1 Knapsack': 'Dynamic Programming',
  'Unbounded Knapsack': 'Dynamic Programming',
  'Longest Increasing Subsequence (LIS)': 'Dynamic Programming',
  '2D Grid DP': 'Dynamic Programming',
  'String DP': 'Dynamic Programming',
  'Tree / Graph DP': 'Dynamic Programming',
  'Bitmask DP': 'Dynamic Programming',
  'Digit DP': 'Dynamic Programming',
  'Probability DP': 'Dynamic Programming',
  'State Machine DP': 'Dynamic Programming',
  "Kadane's Algorithm": 'Dynamic Programming',
  'Bit Manipulation': 'Bit Manipulation',
  'Maths / Geometry': 'Math',
  'String Matching': 'String',
}

export type AppPatternStat = {
  name: string
  tags: readonly string[]
  total: number
  solved: number
  pct: number
}

type TaggedQuestion = { id: number; tags: string[] }

function patternForSet2(q: SetQuestion): string | null {
  if (q.tags?.length) {
    const fromTags = getPatternForQuestion(q.tags)
    if (fromTags) return fromTags
  }
  if (q.category) return NC_PATTERN_MAP[q.category] ?? q.category
  return null
}

function patternForSet3(q: SetQuestion): string | null {
  if (q.tags?.length) {
    const fromTags = getPatternForQuestion(q.tags)
    if (fromTags) return fromTags
  }
  if (q.category) return AM600_PATTERN_MAP[q.category] ?? q.category
  return null
}

function tagsForPattern(name: string): readonly string[] {
  const canonical = QUICK_PATTERNS.find(p => p.name === name)
  return canonical?.tags ?? [name]
}

function patternSortKey(name: string): [number, number, string] {
  const displayIdx = (DISPLAY_PATTERN_ORDER as readonly string[]).indexOf(name)
  const pri = PATTERN_PRIORITY[name] ?? 'Low'
  const priRank = pri === 'High' ? 0 : pri === 'Mid' ? 1 : 2
  return [displayIdx === -1 ? 999 : displayIdx, priRank, name]
}

/** Unified pattern stats across Set 1 + exclusive Set 2 + exclusive Set 3 (disjoint union). */
export function getAppPatternCoverageStats(
  set1Questions: TaggedQuestion[],
  set2Questions: SetQuestion[],
  set3Questions: SetQuestion[],
  set1Progress: Record<string, { solved?: boolean } | undefined>,
  set2Progress: Record<string, { solved?: boolean } | undefined>,
  set3Progress: Record<string, { solved?: boolean } | undefined>,
): AppPatternStat[] {
  const set1Map = buildExclusivePatternMap(set1Questions)
  const buckets = new Map<string, { total: number; solved: number }>()

  const bump = (pattern: string | null | undefined, solved: boolean) => {
    if (!pattern) return
    const cur = buckets.get(pattern) ?? { total: 0, solved: 0 }
    cur.total += 1
    if (solved) cur.solved += 1
    buckets.set(pattern, cur)
  }

  for (const q of set1Questions) {
    bump(set1Map[q.id], !!set1Progress[String(q.id)]?.solved)
  }
  for (const q of set2Questions) {
    bump(patternForSet2(q), !!set2Progress[String(q.id)]?.solved)
  }
  for (const q of set3Questions) {
    bump(patternForSet3(q), !!set3Progress[String(q.id)]?.solved)
  }

  return [...buckets.entries()]
    .map(([name, { total, solved }]) => ({
      name,
      tags: tagsForPattern(name),
      total,
      solved,
      pct: total > 0 ? Math.round((solved / total) * 100) : 0,
    }))
    .filter(p => p.total > 0)
    .sort((a, b) => {
      const [a0, a1, a2] = patternSortKey(a.name)
      const [b0, b1, b2] = patternSortKey(b.name)
      return a0 - b0 || a1 - b1 || a2.localeCompare(b2)
    })
}

export const DIFFICULTY_LEVELS = ['All', 'Easy', 'Medium', 'Hard'] as const

export const QUESTION_SOURCES = [
  { label: 'All',        value: 'All' },
  { label: 'Grind 169',  value: 'Grind 169' },
  { label: 'Denny Zhang', value: 'Denny Zhang' },
  { label: 'Premium 98', value: 'Premium 98' },
  { label: 'CodeSignal',  value: 'CodeSignal' },
] as const

// ORDER IS CRITICAL — each question is assigned to exactly ONE pattern (first match).
// Most specific / narrow patterns must come FIRST so they claim their questions before
// the broad catch-all patterns (String, Arrays & Hashing) get a chance.
export const QUICK_PATTERNS = [
  { name: 'Bit Manipulation',     tags: ['Bit Manipulation'] },
  { name: 'Trie',                 tags: ['Trie'] },
  { name: 'Heap',                 tags: ['Heap', 'Heap (Priority Queue)'] },
  { name: 'Stack',                tags: ['Stack', 'Monotonic Stack', 'Monotonic Queue'] },
  { name: 'Sliding Window',       tags: ['Sliding Window'] },
  { name: 'Backtracking',         tags: ['Backtracking'] },
  { name: 'Linked List',          tags: ['Linked List', 'Doubly-Linked List'] },
  // Trees & BST before DFS/BFS so tree problems are captured here, not in DFS/BFS
  { name: 'Trees & BST',          tags: ['Tree', 'Binary Tree', 'Binary Search Tree', 'BST'] },
  // DFS/BFS now only capture the remaining (graph) DFS/BFS problems
  { name: 'DFS',                  tags: ['DFS', 'Depth-First Search'] },
  { name: 'BFS',                  tags: ['BFS', 'Breadth-First Search'] },
  { name: 'Graphs',               tags: ['Graph', 'Union Find', 'Topological Sort'] },
  { name: 'Matrix',               tags: ['Matrix'] },
  { name: 'Two Pointers',         tags: ['Two Pointers'] },
  { name: 'Binary Search',        tags: ['Binary Search'] },
  { name: 'Dynamic Programming',  tags: ['Dynamic Programming', 'Memoization'] },
  { name: 'Greedy',               tags: ['Greedy'] },
  { name: 'Sorting',              tags: ['Sorting', 'Divide and Conquer'] },
  { name: 'Math',                 tags: ['Math', 'Number Theory', 'Simulation'] },
  // String before Arrays & Hashing — String questions rarely share the Array tag
  { name: 'String',               tags: ['String'] },
  // JavaScript-specific questions (closures, async, prototype, concurrency)
  { name: 'JavaScript',           tags: ['JavaScript', 'Concurrency'] },
  // Arrays & Hashing is intentionally LAST — catch-all for any remaining Array/Hash Table questions
  { name: 'Arrays & Hashing',     tags: ['Array', 'Hash Table', 'Prefix Sum'] },
] as const

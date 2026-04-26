export type NC150Question = {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  acceptance: number
}

export type NC150Category = {
  name: string
  emoji: string
  color: string
  questions: NC150Question[]
}

export const NEETCODE_150: NC150Category[] = [
  {
    name: 'Arrays & Hashing', emoji: '📦', color: 'indigo',
    questions: [
      { id: 217, title: 'Contains Duplicate', slug: 'contains-duplicate', difficulty: 'Easy', acceptance: 64.3 },
      { id: 242, title: 'Valid Anagram', slug: 'valid-anagram', difficulty: 'Easy', acceptance: 68.0 },
      { id: 1,   title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', acceptance: 57.4 },
      { id: 49,  title: 'Group Anagrams', slug: 'group-anagrams', difficulty: 'Medium', acceptance: 72.5 },
      { id: 347, title: 'Top K Frequent Elements', slug: 'top-k-frequent-elements', difficulty: 'Medium', acceptance: 66.3 },
      { id: 271, title: 'Encode and Decode Strings', slug: 'encode-and-decode-strings', difficulty: 'Medium', acceptance: 51.5 },
      { id: 238, title: 'Product of Array Except Self', slug: 'product-of-array-except-self', difficulty: 'Medium', acceptance: 68.8 },
      { id: 36,  title: 'Valid Sudoku', slug: 'valid-sudoku', difficulty: 'Medium', acceptance: 64.4 },
      { id: 128, title: 'Longest Consecutive Sequence', slug: 'longest-consecutive-sequence', difficulty: 'Medium', acceptance: 47.1 },
    ],
  },
  {
    name: 'Two Pointers', emoji: '👆', color: 'cyan',
    questions: [
      { id: 125, title: 'Valid Palindrome', slug: 'valid-palindrome', difficulty: 'Easy', acceptance: 53.2 },
      { id: 167, title: 'Two Sum II - Input Array Is Sorted', slug: 'two-sum-ii-input-array-is-sorted', difficulty: 'Medium', acceptance: 65.0 },
      { id: 15,  title: '3Sum', slug: '3sum', difficulty: 'Medium', acceptance: 39.0 },
      { id: 11,  title: 'Container With Most Water', slug: 'container-with-most-water', difficulty: 'Medium', acceptance: 59.9 },
      { id: 42,  title: 'Trapping Rain Water', slug: 'trapping-rain-water', difficulty: 'Hard', acceptance: 67.2 },
    ],
  },
  {
    name: 'Sliding Window', emoji: '🪟', color: 'sky',
    questions: [
      { id: 121, title: 'Best Time to Buy and Sell Stock', slug: 'best-time-to-buy-and-sell-stock', difficulty: 'Easy', acceptance: 56.7 },
      { id: 3,   title: 'Longest Substring Without Repeating Characters', slug: 'longest-substring-without-repeating-characters', difficulty: 'Medium', acceptance: 38.9 },
      { id: 424, title: 'Longest Repeating Character Replacement', slug: 'longest-repeating-character-replacement', difficulty: 'Medium', acceptance: 59.5 },
      { id: 567, title: 'Permutation in String', slug: 'permutation-in-string', difficulty: 'Medium', acceptance: 48.7 },
      { id: 76,  title: 'Minimum Window Substring', slug: 'minimum-window-substring', difficulty: 'Hard', acceptance: 47.4 },
      { id: 239, title: 'Sliding Window Maximum', slug: 'sliding-window-maximum', difficulty: 'Hard', acceptance: 48.7 },
    ],
  },
  {
    name: 'Stack', emoji: '🥞', color: 'orange',
    questions: [
      { id: 20,  title: 'Valid Parentheses', slug: 'valid-parentheses', difficulty: 'Easy', acceptance: 44.1 },
      { id: 155, title: 'Min Stack', slug: 'min-stack', difficulty: 'Medium', acceptance: 58.0 },
      { id: 150, title: 'Evaluate Reverse Polish Notation', slug: 'evaluate-reverse-polish-notation', difficulty: 'Medium', acceptance: 57.6 },
      { id: 739, title: 'Daily Temperatures', slug: 'daily-temperatures', difficulty: 'Medium', acceptance: 68.6 },
      { id: 853, title: 'Car Fleet', slug: 'car-fleet', difficulty: 'Medium', acceptance: 55.0 },
      { id: 84,  title: 'Largest Rectangle in Histogram', slug: 'largest-rectangle-in-histogram', difficulty: 'Hard', acceptance: 49.7 },
    ],
  },
  {
    name: 'Binary Search', emoji: '🔍', color: 'violet',
    questions: [
      { id: 704, title: 'Binary Search', slug: 'binary-search', difficulty: 'Easy', acceptance: 60.8 },
      { id: 74,  title: 'Search a 2D Matrix', slug: 'search-a-2d-matrix', difficulty: 'Medium', acceptance: 53.8 },
      { id: 875, title: 'Koko Eating Bananas', slug: 'koko-eating-bananas', difficulty: 'Medium', acceptance: 49.9 },
      { id: 153, title: 'Find Minimum in Rotated Sorted Array', slug: 'find-minimum-in-rotated-sorted-array', difficulty: 'Medium', acceptance: 54.1 },
      { id: 33,  title: 'Search in Rotated Sorted Array', slug: 'search-in-rotated-sorted-array', difficulty: 'Medium', acceptance: 44.4 },
      { id: 981, title: 'Time Based Key-Value Store', slug: 'time-based-key-value-store', difficulty: 'Medium', acceptance: 49.9 },
      { id: 4,   title: 'Median of Two Sorted Arrays', slug: 'median-of-two-sorted-arrays', difficulty: 'Hard', acceptance: 46.4 },
    ],
  },
  {
    name: 'Linked List', emoji: '🔗', color: 'teal',
    questions: [
      { id: 206, title: 'Reverse Linked List', slug: 'reverse-linked-list', difficulty: 'Easy', acceptance: 80.5 },
      { id: 21,  title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists', difficulty: 'Easy', acceptance: 68.2 },
      { id: 141, title: 'Linked List Cycle', slug: 'linked-list-cycle', difficulty: 'Easy', acceptance: 54.2 },
      { id: 143, title: 'Reorder List', slug: 'reorder-list', difficulty: 'Medium', acceptance: 65.1 },
      { id: 19,  title: 'Remove Nth Node From End of List', slug: 'remove-nth-node-from-end-of-list', difficulty: 'Medium', acceptance: 51.4 },
      { id: 138, title: 'Copy List with Random Pointer', slug: 'copy-list-with-random-pointer', difficulty: 'Medium', acceptance: 62.8 },
      { id: 2,   title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', acceptance: 48.3 },
      { id: 287, title: 'Find the Duplicate Number', slug: 'find-the-duplicate-number', difficulty: 'Medium', acceptance: 64.2 },
      { id: 146, title: 'LRU Cache', slug: 'lru-cache', difficulty: 'Medium', acceptance: 47.2 },
      { id: 23,  title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists', difficulty: 'Hard', acceptance: 59.4 },
      { id: 25,  title: 'Reverse Nodes in k-Group', slug: 'reverse-nodes-in-k-group', difficulty: 'Hard', acceptance: 65.9 },
    ],
  },
  {
    name: 'Trees', emoji: '🌳', color: 'green',
    questions: [
      { id: 226,  title: 'Invert Binary Tree', slug: 'invert-binary-tree', difficulty: 'Easy', acceptance: 80.0 },
      { id: 104,  title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree', difficulty: 'Easy', acceptance: 78.1 },
      { id: 543,  title: 'Diameter of Binary Tree', slug: 'diameter-of-binary-tree', difficulty: 'Easy', acceptance: 65.4 },
      { id: 110,  title: 'Balanced Binary Tree', slug: 'balanced-binary-tree', difficulty: 'Easy', acceptance: 58.2 },
      { id: 100,  title: 'Same Tree', slug: 'same-tree', difficulty: 'Easy', acceptance: 67.0 },
      { id: 572,  title: 'Subtree of Another Tree', slug: 'subtree-of-another-tree', difficulty: 'Easy', acceptance: 51.5 },
      { id: 235,  title: 'Lowest Common Ancestor of a Binary Search Tree', slug: 'lowest-common-ancestor-of-a-binary-search-tree', difficulty: 'Medium', acceptance: 70.5 },
      { id: 102,  title: 'Binary Tree Level Order Traversal', slug: 'binary-tree-level-order-traversal', difficulty: 'Medium', acceptance: 72.5 },
      { id: 199,  title: 'Binary Tree Right Side View', slug: 'binary-tree-right-side-view', difficulty: 'Medium', acceptance: 70.0 },
      { id: 1448, title: 'Count Good Nodes in Binary Tree', slug: 'count-good-nodes-in-binary-tree', difficulty: 'Medium', acceptance: 73.8 },
      { id: 98,   title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree', difficulty: 'Medium', acceptance: 35.7 },
      { id: 230,  title: 'Kth Smallest Element in a BST', slug: 'kth-smallest-element-in-a-bst', difficulty: 'Medium', acceptance: 76.7 },
      { id: 105,  title: 'Construct Binary Tree from Preorder and Inorder Traversal', slug: 'construct-binary-tree-from-preorder-and-inorder-traversal', difficulty: 'Medium', acceptance: 68.7 },
      { id: 124,  title: 'Binary Tree Maximum Path Sum', slug: 'binary-tree-maximum-path-sum', difficulty: 'Hard', acceptance: 42.2 },
      { id: 297,  title: 'Serialize and Deserialize Binary Tree', slug: 'serialize-and-deserialize-binary-tree', difficulty: 'Hard', acceptance: 60.6 },
    ],
  },
  {
    name: 'Heap / Priority Queue', emoji: '🏔️', color: 'rose',
    questions: [
      { id: 703,  title: 'Kth Largest Element in a Stream', slug: 'kth-largest-element-in-a-stream', difficulty: 'Easy', acceptance: 60.9 },
      { id: 1046, title: 'Last Stone Weight', slug: 'last-stone-weight', difficulty: 'Easy', acceptance: 66.4 },
      { id: 973,  title: 'K Closest Points to Origin', slug: 'k-closest-points-to-origin', difficulty: 'Medium', acceptance: 68.9 },
      { id: 215,  title: 'Kth Largest Element in an Array', slug: 'kth-largest-element-in-an-array', difficulty: 'Medium', acceptance: 68.9 },
      { id: 621,  title: 'Task Scheduler', slug: 'task-scheduler', difficulty: 'Medium', acceptance: 63.0 },
      { id: 355,  title: 'Design Twitter', slug: 'design-twitter', difficulty: 'Medium', acceptance: 44.5 },
      { id: 295,  title: 'Find Median from Data Stream', slug: 'find-median-from-data-stream', difficulty: 'Hard', acceptance: 54.4 },
    ],
  },
  {
    name: 'Backtracking', emoji: '🔙', color: 'amber',
    questions: [
      { id: 78,  title: 'Subsets', slug: 'subsets', difficulty: 'Medium', acceptance: 82.3 },
      { id: 39,  title: 'Combination Sum', slug: 'combination-sum', difficulty: 'Medium', acceptance: 76.4 },
      { id: 40,  title: 'Combination Sum II', slug: 'combination-sum-ii', difficulty: 'Medium', acceptance: 59.3 },
      { id: 46,  title: 'Permutations', slug: 'permutations', difficulty: 'Medium', acceptance: 81.9 },
      { id: 90,  title: 'Subsets II', slug: 'subsets-ii', difficulty: 'Medium', acceptance: 61.2 },
      { id: 22,  title: 'Generate Parentheses', slug: 'generate-parentheses', difficulty: 'Medium', acceptance: 78.6 },
      { id: 79,  title: 'Word Search', slug: 'word-search', difficulty: 'Medium', acceptance: 47.2 },
      { id: 131, title: 'Palindrome Partitioning', slug: 'palindrome-partitioning', difficulty: 'Medium', acceptance: 74.0 },
      { id: 17,  title: 'Letter Combinations of a Phone Number', slug: 'letter-combinations-of-a-phone-number', difficulty: 'Medium', acceptance: 65.9 },
      { id: 51,  title: 'N-Queens', slug: 'n-queens', difficulty: 'Hard', acceptance: 75.4 },
    ],
  },
  {
    name: 'Tries', emoji: '🔤', color: 'fuchsia',
    questions: [
      { id: 208, title: 'Implement Trie (Prefix Tree)', slug: 'implement-trie-prefix-tree', difficulty: 'Medium', acceptance: 69.4 },
      { id: 211, title: 'Design Add and Search Words Data Structure', slug: 'design-add-and-search-words-data-structure', difficulty: 'Medium', acceptance: 48.4 },
      { id: 212, title: 'Word Search II', slug: 'word-search-ii', difficulty: 'Hard', acceptance: 38.4 },
    ],
  },
  {
    name: 'Graphs', emoji: '🕸️', color: 'blue',
    questions: [
      { id: 200, title: 'Number of Islands', slug: 'number-of-islands', difficulty: 'Medium', acceptance: 64.2 },
      { id: 695, title: 'Max Area of Island', slug: 'max-area-of-island', difficulty: 'Medium', acceptance: 73.9 },
      { id: 133, title: 'Clone Graph', slug: 'clone-graph', difficulty: 'Medium', acceptance: 65.2 },
      { id: 286, title: 'Walls and Gates', slug: 'walls-and-gates', difficulty: 'Medium', acceptance: 63.9 },
      { id: 994, title: 'Rotting Oranges', slug: 'rotting-oranges', difficulty: 'Medium', acceptance: 58.5 },
      { id: 417, title: 'Pacific Atlantic Water Flow', slug: 'pacific-atlantic-water-flow', difficulty: 'Medium', acceptance: 60.9 },
      { id: 130, title: 'Surrounded Regions', slug: 'surrounded-regions', difficulty: 'Medium', acceptance: 45.2 },
      { id: 207, title: 'Course Schedule', slug: 'course-schedule', difficulty: 'Medium', acceptance: 51.3 },
      { id: 210, title: 'Course Schedule II', slug: 'course-schedule-ii', difficulty: 'Medium', acceptance: 55.4 },
      { id: 261, title: 'Graph Valid Tree', slug: 'graph-valid-tree', difficulty: 'Medium', acceptance: 50.0 },
      { id: 323, title: 'Number of Connected Components in an Undirected Graph', slug: 'number-of-connected-components-in-an-undirected-graph', difficulty: 'Medium', acceptance: 64.9 },
      { id: 684, title: 'Redundant Connection', slug: 'redundant-connection', difficulty: 'Medium', acceptance: 67.5 },
      { id: 127, title: 'Word Ladder', slug: 'word-ladder', difficulty: 'Hard', acceptance: 45.4 },
    ],
  },
  {
    name: 'Advanced Graphs', emoji: '🗺️', color: 'purple',
    questions: [
      { id: 743,  title: 'Network Delay Time', slug: 'network-delay-time', difficulty: 'Medium', acceptance: 60.2 },
      { id: 332,  title: 'Reconstruct Itinerary', slug: 'reconstruct-itinerary', difficulty: 'Hard', acceptance: 44.5 },
      { id: 1584, title: 'Min Cost to Connect All Points', slug: 'min-cost-to-connect-all-points', difficulty: 'Medium', acceptance: 70.8 },
      { id: 778,  title: 'Swim in Rising Water', slug: 'swim-in-rising-water', difficulty: 'Hard', acceptance: 67.8 },
      { id: 269,  title: 'Alien Dictionary', slug: 'alien-dictionary', difficulty: 'Hard', acceptance: 37.2 },
      { id: 787,  title: 'Cheapest Flights Within K Stops', slug: 'cheapest-flights-within-k-stops', difficulty: 'Medium', acceptance: 41.7 },
    ],
  },
  {
    name: '1-D Dynamic Programming', emoji: '📈', color: 'emerald',
    questions: [
      { id: 70,  title: 'Climbing Stairs', slug: 'climbing-stairs', difficulty: 'Easy', acceptance: 54.0 },
      { id: 746, title: 'Min Cost Climbing Stairs', slug: 'min-cost-climbing-stairs', difficulty: 'Easy', acceptance: 68.2 },
      { id: 198, title: 'House Robber', slug: 'house-robber', difficulty: 'Medium', acceptance: 53.2 },
      { id: 213, title: 'House Robber II', slug: 'house-robber-ii', difficulty: 'Medium', acceptance: 44.8 },
      { id: 5,   title: 'Longest Palindromic Substring', slug: 'longest-palindromic-substring', difficulty: 'Medium', acceptance: 37.7 },
      { id: 647, title: 'Palindromic Substrings', slug: 'palindromic-substrings', difficulty: 'Medium', acceptance: 72.7 },
      { id: 91,  title: 'Decode Ways', slug: 'decode-ways', difficulty: 'Medium', acceptance: 37.9 },
      { id: 322, title: 'Coin Change', slug: 'coin-change', difficulty: 'Medium', acceptance: 48.3 },
      { id: 152, title: 'Maximum Product Subarray', slug: 'maximum-product-subarray', difficulty: 'Medium', acceptance: 36.3 },
      { id: 139, title: 'Word Break', slug: 'word-break', difficulty: 'Medium', acceptance: 49.4 },
      { id: 300, title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence', difficulty: 'Medium', acceptance: 59.3 },
      { id: 416, title: 'Partition Equal Subset Sum', slug: 'partition-equal-subset-sum', difficulty: 'Medium', acceptance: 49.4 },
    ],
  },
  {
    name: '2-D Dynamic Programming', emoji: '🔢', color: 'lime',
    questions: [
      { id: 62,   title: 'Unique Paths', slug: 'unique-paths', difficulty: 'Medium', acceptance: 66.8 },
      { id: 1143, title: 'Longest Common Subsequence', slug: 'longest-common-subsequence', difficulty: 'Medium', acceptance: 59.1 },
      { id: 309,  title: 'Best Time to Buy and Sell Stock with Cooldown', slug: 'best-time-to-buy-and-sell-stock-with-cooldown', difficulty: 'Medium', acceptance: 62.0 },
      { id: 518,  title: 'Coin Change II', slug: 'coin-change-ii', difficulty: 'Medium', acceptance: 60.1 },
      { id: 494,  title: 'Target Sum', slug: 'target-sum', difficulty: 'Medium', acceptance: 52.1 },
      { id: 97,   title: 'Interleaving String', slug: 'interleaving-string', difficulty: 'Medium', acceptance: 43.9 },
      { id: 329,  title: 'Longest Increasing Path in a Matrix', slug: 'longest-increasing-path-in-a-matrix', difficulty: 'Hard', acceptance: 56.5 },
      { id: 115,  title: 'Distinct Subsequences', slug: 'distinct-subsequences', difficulty: 'Hard', acceptance: 51.8 },
      { id: 72,   title: 'Edit Distance', slug: 'edit-distance', difficulty: 'Medium', acceptance: 60.5 },
      { id: 312,  title: 'Burst Balloons', slug: 'burst-balloons', difficulty: 'Hard', acceptance: 63.3 },
      { id: 10,   title: 'Regular Expression Matching', slug: 'regular-expression-matching', difficulty: 'Hard', acceptance: 30.8 },
    ],
  },
  {
    name: 'Greedy', emoji: '💰', color: 'yellow',
    questions: [
      { id: 53,   title: 'Maximum Subarray', slug: 'maximum-subarray', difficulty: 'Medium', acceptance: 53.2 },
      { id: 55,   title: 'Jump Game', slug: 'jump-game', difficulty: 'Medium', acceptance: 40.8 },
      { id: 45,   title: 'Jump Game II', slug: 'jump-game-ii', difficulty: 'Medium', acceptance: 42.8 },
      { id: 134,  title: 'Gas Station', slug: 'gas-station', difficulty: 'Medium', acceptance: 47.9 },
      { id: 846,  title: 'Hand of Straights', slug: 'hand-of-straights', difficulty: 'Medium', acceptance: 57.9 },
      { id: 1899, title: 'Merge Triplets to Form Target Triplet', slug: 'merge-triplets-to-form-target-triplet', difficulty: 'Medium', acceptance: 69.0 },
      { id: 763,  title: 'Partition Labels', slug: 'partition-labels', difficulty: 'Medium', acceptance: 81.9 },
      { id: 678,  title: 'Valid Parenthesis String', slug: 'valid-parenthesis-string', difficulty: 'Medium', acceptance: 40.0 },
    ],
  },
  {
    name: 'Intervals', emoji: '📏', color: 'pink',
    questions: [
      { id: 57,   title: 'Insert Interval', slug: 'insert-interval', difficulty: 'Medium', acceptance: 45.1 },
      { id: 56,   title: 'Merge Intervals', slug: 'merge-intervals', difficulty: 'Medium', acceptance: 51.7 },
      { id: 435,  title: 'Non-overlapping Intervals', slug: 'non-overlapping-intervals', difficulty: 'Medium', acceptance: 57.0 },
      { id: 252,  title: 'Meeting Rooms', slug: 'meeting-rooms', difficulty: 'Easy', acceptance: 59.4 },
      { id: 253,  title: 'Meeting Rooms II', slug: 'meeting-rooms-ii', difficulty: 'Medium', acceptance: 52.6 },
      { id: 1851, title: 'Minimum Interval to Include Each Query', slug: 'minimum-interval-to-include-each-query', difficulty: 'Hard', acceptance: 54.3 },
    ],
  },
  {
    name: 'Math & Geometry', emoji: '📐', color: 'slate',
    questions: [
      { id: 48,   title: 'Rotate Image', slug: 'rotate-image', difficulty: 'Medium', acceptance: 79.6 },
      { id: 54,   title: 'Spiral Matrix', slug: 'spiral-matrix', difficulty: 'Medium', acceptance: 56.6 },
      { id: 73,   title: 'Set Matrix Zeroes', slug: 'set-matrix-zeroes', difficulty: 'Medium', acceptance: 62.8 },
      { id: 202,  title: 'Happy Number', slug: 'happy-number', difficulty: 'Easy', acceptance: 59.6 },
      { id: 66,   title: 'Plus One', slug: 'plus-one', difficulty: 'Easy', acceptance: 49.9 },
      { id: 50,   title: 'Pow(x, n)', slug: 'powx-n', difficulty: 'Medium', acceptance: 38.6 },
      { id: 43,   title: 'Multiply Strings', slug: 'multiply-strings', difficulty: 'Medium', acceptance: 44.0 },
      { id: 2013, title: 'Detect Squares', slug: 'detect-squares', difficulty: 'Medium', acceptance: 52.5 },
    ],
  },
  {
    name: 'Bit Manipulation', emoji: '⚡', color: 'red',
    questions: [
      { id: 136, title: 'Single Number', slug: 'single-number', difficulty: 'Easy', acceptance: 77.6 },
      { id: 191, title: 'Number of 1 Bits', slug: 'number-of-1-bits', difficulty: 'Easy', acceptance: 76.7 },
      { id: 338, title: 'Counting Bits', slug: 'counting-bits', difficulty: 'Easy', acceptance: 80.5 },
      { id: 190, title: 'Reverse Bits', slug: 'reverse-bits', difficulty: 'Easy', acceptance: 68.2 },
      { id: 268, title: 'Missing Number', slug: 'missing-number', difficulty: 'Easy', acceptance: 71.9 },
      { id: 371, title: 'Sum of Two Integers', slug: 'sum-of-two-integers', difficulty: 'Medium', acceptance: 55.4 },
      { id: 7,   title: 'Reverse Integer', slug: 'reverse-integer', difficulty: 'Medium', acceptance: 31.8 },
    ],
  },
]

export const ALL_NC150_IDS = new Set(
  NEETCODE_150.flatMap(c => c.questions.map(q => q.id))
)

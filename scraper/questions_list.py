"""
EXACT question list extracted from Interview_Prep_Master_Reference.docx
=====================================================================
  Part I  — Grind 169 (all 17 topic groups)            = 169 questions
  Part II — Denny Zhang Cheat Sheet problems            =  64 new unique
  Part III — LeetCode Premium Questions                 =  98 questions
  Part IV  — CodeSignal Prep List                       =  21 questions
=====================================================================
Every LeetCode problem explicitly named in the doc is included.
Duplicates across parts are merged — each question appears once.
Run `python3 questions_list.py` to verify counts.
"""

# ──────────────────────────────────────────────────────────────────────────────
# PART I — GRIND 169  (17 topic groups, exactly as listed in the doc)
# ──────────────────────────────────────────────────────────────────────────────

GRIND_169 = [

    # ── Arrays (24) ──────────────────────────────────────────────────────────
    {"id": 1,    "title": "Two Sum",                                 "slug": "two-sum",                                    "difficulty": "Easy",   "tags": ["Array", "Hash Table"],                  "source": ["Grind 169"]},
    {"id": 121,  "title": "Best Time to Buy and Sell Stock",         "slug": "best-time-to-buy-and-sell-stock",            "difficulty": "Easy",   "tags": ["Array", "Dynamic Programming"],          "source": ["Grind 169"]},
    {"id": 57,   "title": "Insert Interval",                         "slug": "insert-interval",                            "difficulty": "Medium", "tags": ["Array"],                                 "source": ["Grind 169"]},
    {"id": 15,   "title": "3Sum",                                    "slug": "3sum",                                       "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Sorting"],       "source": ["Grind 169"]},
    {"id": 238,  "title": "Product of Array Except Self",            "slug": "product-of-array-except-self",               "difficulty": "Medium", "tags": ["Array", "Prefix Sum"],                   "source": ["Grind 169"]},
    {"id": 39,   "title": "Combination Sum",                         "slug": "combination-sum",                            "difficulty": "Medium", "tags": ["Array", "Backtracking"],                 "source": ["Grind 169"]},
    {"id": 56,   "title": "Merge Intervals",                         "slug": "merge-intervals",                            "difficulty": "Medium", "tags": ["Array", "Sorting"],                      "source": ["Grind 169"]},
    {"id": 169,  "title": "Majority Element",                        "slug": "majority-element",                           "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Divide and Conquer", "Sorting", "Counting"], "source": ["Grind 169"]},
    {"id": 75,   "title": "Sort Colors",                             "slug": "sort-colors",                                "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Sorting"],       "source": ["Grind 169"]},
    {"id": 217,  "title": "Contains Duplicate",                      "slug": "contains-duplicate",                         "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Sorting"],        "source": ["Grind 169"]},
    {"id": 11,   "title": "Container With Most Water",               "slug": "container-with-most-water",                  "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Greedy"],       "source": ["Grind 169"]},
    {"id": 252,  "title": "Meeting Rooms",                           "slug": "meeting-rooms",                              "difficulty": "Easy",   "tags": ["Array", "Sorting"],                      "source": ["Grind 169"]},
    {"id": 134,  "title": "Gas Station",                             "slug": "gas-station",                                "difficulty": "Medium", "tags": ["Array", "Greedy"],                       "source": ["Grind 169"]},
    {"id": 128,  "title": "Longest Consecutive Sequence",            "slug": "longest-consecutive-sequence",               "difficulty": "Medium", "tags": ["Array", "Hash Table", "Union Find"],     "source": ["Grind 169"]},
    {"id": 189,  "title": "Rotate Array",                            "slug": "rotate-array",                               "difficulty": "Medium", "tags": ["Array", "Math", "Two Pointers"],         "source": ["Grind 169"]},
    {"id": 525,  "title": "Contiguous Array",                        "slug": "contiguous-array",                           "difficulty": "Medium", "tags": ["Array", "Hash Table", "Prefix Sum"],     "source": ["Grind 169"]},
    {"id": 560,  "title": "Subarray Sum Equals K",                   "slug": "subarray-sum-equals-k",                      "difficulty": "Medium", "tags": ["Array", "Hash Table", "Prefix Sum"],     "source": ["Grind 169"]},
    {"id": 759,  "title": "Employee Free Time",                      "slug": "employee-free-time",                         "difficulty": "Hard",   "tags": ["Array", "Sorting", "Heap"],              "source": ["Grind 169"]},
    {"id": 283,  "title": "Move Zeroes",                             "slug": "move-zeroes",                                "difficulty": "Easy",   "tags": ["Array", "Two Pointers"],                 "source": ["Grind 169"]},
    {"id": 253,  "title": "Meeting Rooms II",                        "slug": "meeting-rooms-ii",                           "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Greedy", "Sorting", "Heap"], "source": ["Grind 169"]},
    {"id": 239,  "title": "Sliding Window Maximum",                  "slug": "sliding-window-maximum",                     "difficulty": "Hard",   "tags": ["Array", "Queue", "Sliding Window", "Monotonic Queue"], "source": ["Grind 169"]},
    {"id": 977,  "title": "Squares of a Sorted Array",               "slug": "squares-of-a-sorted-array",                  "difficulty": "Easy",   "tags": ["Array", "Two Pointers", "Sorting"],       "source": ["Grind 169"]},
    {"id": 16,   "title": "3Sum Closest",                            "slug": "3sum-closest",                               "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Sorting"],       "source": ["Grind 169"]},
    {"id": 435,  "title": "Non-overlapping Intervals",               "slug": "non-overlapping-intervals",                  "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Greedy", "Sorting"], "source": ["Grind 169"]},

    # ── String (14) ──────────────────────────────────────────────────────────
    {"id": 125,  "title": "Valid Palindrome",                        "slug": "valid-palindrome",                           "difficulty": "Easy",   "tags": ["Two Pointers", "String"],                "source": ["Grind 169"]},
    {"id": 242,  "title": "Valid Anagram",                           "slug": "valid-anagram",                              "difficulty": "Easy",   "tags": ["Hash Table", "String", "Sorting"],       "source": ["Grind 169"]},
    {"id": 3,    "title": "Longest Substring Without Repeating Characters", "slug": "longest-substring-without-repeating-characters", "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Grind 169"]},
    {"id": 409,  "title": "Longest Palindrome",                      "slug": "longest-palindrome",                         "difficulty": "Easy",   "tags": ["Hash Table", "String", "Greedy"],        "source": ["Grind 169"]},
    {"id": 76,   "title": "Minimum Window Substring",                "slug": "minimum-window-substring",                   "difficulty": "Hard",   "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Grind 169"]},
    {"id": 8,    "title": "String to Integer (atoi)",                "slug": "string-to-integer-atoi",                     "difficulty": "Medium", "tags": ["String"],                                "source": ["Grind 169"]},
    {"id": 5,    "title": "Longest Palindromic Substring",           "slug": "longest-palindromic-substring",              "difficulty": "Medium", "tags": ["String", "Dynamic Programming"],         "source": ["Grind 169"]},
    {"id": 438,  "title": "Find All Anagrams in a String",           "slug": "find-all-anagrams-in-a-string",              "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Grind 169"]},
    {"id": 49,   "title": "Group Anagrams",                          "slug": "group-anagrams",                             "difficulty": "Medium", "tags": ["Array", "Hash Table", "String", "Sorting"], "source": ["Grind 169"]},
    {"id": 424,  "title": "Longest Repeating Character Replacement", "slug": "longest-repeating-character-replacement",    "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Grind 169"]},
    {"id": 14,   "title": "Longest Common Prefix",                   "slug": "longest-common-prefix",                      "difficulty": "Easy",   "tags": ["String", "Trie"],                        "source": ["Grind 169"]},
    {"id": 179,  "title": "Largest Number",                          "slug": "largest-number",                             "difficulty": "Medium", "tags": ["Array", "String", "Greedy", "Sorting"],   "source": ["Grind 169"]},
    {"id": 271,  "title": "Encode and Decode Strings",               "slug": "encode-and-decode-strings",                  "difficulty": "Medium", "tags": ["Array", "String", "Design"],             "source": ["Grind 169"]},
    {"id": 336,  "title": "Palindrome Pairs",                        "slug": "palindrome-pairs",                           "difficulty": "Hard",   "tags": ["Array", "Hash Table", "String", "Trie"], "source": ["Grind 169"]},

    # ── Matrix (5) ───────────────────────────────────────────────────────────
    {"id": 54,   "title": "Spiral Matrix",                           "slug": "spiral-matrix",                              "difficulty": "Medium", "tags": ["Array", "Matrix", "Simulation"],         "source": ["Grind 169"]},
    {"id": 36,   "title": "Valid Sudoku",                            "slug": "valid-sudoku",                               "difficulty": "Medium", "tags": ["Array", "Hash Table", "Matrix"],         "source": ["Grind 169"]},
    {"id": 48,   "title": "Rotate Image",                            "slug": "rotate-image",                               "difficulty": "Medium", "tags": ["Array", "Math", "Matrix"],               "source": ["Grind 169"]},
    {"id": 73,   "title": "Set Matrix Zeroes",                       "slug": "set-matrix-zeroes",                          "difficulty": "Medium", "tags": ["Array", "Hash Table", "Matrix"],         "source": ["Grind 169"]},
    {"id": 37,   "title": "Sudoku Solver",                           "slug": "sudoku-solver",                              "difficulty": "Hard",   "tags": ["Array", "Hash Table", "Backtracking", "Matrix"], "source": ["Grind 169"]},

    # ── Binary Search (8) ────────────────────────────────────────────────────
    {"id": 704,  "title": "Binary Search",                           "slug": "binary-search",                              "difficulty": "Easy",   "tags": ["Array", "Binary Search"],                "source": ["Grind 169"]},
    {"id": 278,  "title": "First Bad Version",                       "slug": "first-bad-version",                          "difficulty": "Easy",   "tags": ["Binary Search", "Interactive"],          "source": ["Grind 169"]},
    {"id": 33,   "title": "Search in Rotated Sorted Array",          "slug": "search-in-rotated-sorted-array",             "difficulty": "Medium", "tags": ["Array", "Binary Search"],                "source": ["Grind 169"]},
    {"id": 981,  "title": "Time Based Key-Value Store",              "slug": "time-based-key-value-store",                 "difficulty": "Medium", "tags": ["Hash Table", "String", "Binary Search", "Design"], "source": ["Grind 169"]},
    {"id": 1235, "title": "Maximum Profit in Job Scheduling",        "slug": "maximum-profit-in-job-scheduling",           "difficulty": "Hard",   "tags": ["Array", "Binary Search", "Dynamic Programming", "Sorting"], "source": ["Grind 169"]},
    {"id": 4,    "title": "Median of Two Sorted Arrays",             "slug": "median-of-two-sorted-arrays",                "difficulty": "Hard",   "tags": ["Array", "Binary Search", "Divide and Conquer"], "source": ["Grind 169"]},
    {"id": 74,   "title": "Search a 2D Matrix",                      "slug": "search-a-2d-matrix",                         "difficulty": "Medium", "tags": ["Array", "Binary Search", "Matrix"],      "source": ["Grind 169"]},
    {"id": 153,  "title": "Find Minimum in Rotated Sorted Array",    "slug": "find-minimum-in-rotated-sorted-array",       "difficulty": "Medium", "tags": ["Array", "Binary Search"],                "source": ["Grind 169"]},

    # ── Graph (21) ───────────────────────────────────────────────────────────
    {"id": 733,  "title": "Flood Fill",                              "slug": "flood-fill",                                 "difficulty": "Easy",   "tags": ["Array", "DFS", "BFS", "Matrix"],         "source": ["Grind 169"]},
    {"id": 542,  "title": "01 Matrix",                               "slug": "01-matrix",                                  "difficulty": "Medium", "tags": ["Array", "BFS", "Matrix"],                "source": ["Grind 169"]},
    {"id": 133,  "title": "Clone Graph",                             "slug": "clone-graph",                                "difficulty": "Medium", "tags": ["Hash Table", "DFS", "BFS", "Graph"],     "source": ["Grind 169"]},
    {"id": 207,  "title": "Course Schedule",                         "slug": "course-schedule",                            "difficulty": "Medium", "tags": ["DFS", "BFS", "Graph", "Topological Sort"], "source": ["Grind 169"]},
    {"id": 200,  "title": "Number of Islands",                       "slug": "number-of-islands",                          "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Union Find", "Matrix"], "source": ["Grind 169"]},
    {"id": 994,  "title": "Rotting Oranges",                         "slug": "rotting-oranges",                            "difficulty": "Medium", "tags": ["Array", "BFS", "Matrix"],                "source": ["Grind 169"]},
    {"id": 721,  "title": "Accounts Merge",                          "slug": "accounts-merge",                             "difficulty": "Medium", "tags": ["Array", "String", "DFS", "BFS", "Union Find"], "source": ["Grind 169"]},
    {"id": 127,  "title": "Word Ladder",                             "slug": "word-ladder",                                "difficulty": "Hard",   "tags": ["Hash Table", "String", "BFS"],           "source": ["Grind 169"]},
    {"id": 79,   "title": "Word Search",                             "slug": "word-search",                                "difficulty": "Medium", "tags": ["Array", "String", "Backtracking", "Matrix"], "source": ["Grind 169"]},
    {"id": 310,  "title": "Minimum Height Trees",                    "slug": "minimum-height-trees",                       "difficulty": "Medium", "tags": ["DFS", "BFS", "Graph", "Topological Sort"], "source": ["Grind 169"]},
    {"id": 417,  "title": "Pacific Atlantic Water Flow",             "slug": "pacific-atlantic-water-flow",                "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Matrix"],         "source": ["Grind 169"]},
    {"id": 1730, "title": "Shortest Path to Get Food",               "slug": "shortest-path-to-get-food",                  "difficulty": "Medium", "tags": ["Array", "BFS", "Matrix"],                "source": ["Grind 169"]},
    {"id": 261,  "title": "Graph Valid Tree",                        "slug": "graph-valid-tree",                           "difficulty": "Medium", "tags": ["DFS", "BFS", "Union Find", "Graph"],     "source": ["Grind 169"]},
    {"id": 210,  "title": "Course Schedule II",                      "slug": "course-schedule-ii",                         "difficulty": "Medium", "tags": ["DFS", "BFS", "Graph", "Topological Sort"], "source": ["Grind 169"]},
    {"id": 323,  "title": "Number of Connected Components in an Undirected Graph", "slug": "number-of-connected-components-in-an-undirected-graph", "difficulty": "Medium", "tags": ["DFS", "BFS", "Union Find", "Graph"], "source": ["Grind 169"]},
    {"id": 1197, "title": "Minimum Knight Moves",                    "slug": "minimum-knight-moves",                       "difficulty": "Medium", "tags": ["BFS"],                                   "source": ["Grind 169"]},
    {"id": 329,  "title": "Longest Increasing Path in a Matrix",     "slug": "longest-increasing-path-in-a-matrix",        "difficulty": "Hard",   "tags": ["Array", "DFS", "BFS", "Graph", "Topological Sort", "Memoization", "Matrix"], "source": ["Grind 169"]},
    {"id": 212,  "title": "Word Search II",                          "slug": "word-search-ii",                             "difficulty": "Hard",   "tags": ["Array", "String", "Backtracking", "Trie", "Matrix"], "source": ["Grind 169"]},
    {"id": 269,  "title": "Alien Dictionary",                        "slug": "alien-dictionary",                           "difficulty": "Hard",   "tags": ["Array", "String", "DFS", "BFS", "Graph", "Topological Sort"], "source": ["Grind 169"]},
    {"id": 815,  "title": "Bus Routes",                              "slug": "bus-routes",                                 "difficulty": "Hard",   "tags": ["Array", "Hash Table", "BFS"],            "source": ["Grind 169"]},
    {"id": 787,  "title": "Cheapest Flights Within K Stops",         "slug": "cheapest-flights-within-k-stops",            "difficulty": "Medium", "tags": ["Dynamic Programming", "DFS", "BFS", "Graph", "Heap"], "source": ["Grind 169"]},

    # ── Binary Search Tree (5) ───────────────────────────────────────────────
    {"id": 235,  "title": "Lowest Common Ancestor of a Binary Search Tree", "slug": "lowest-common-ancestor-of-a-binary-search-tree", "difficulty": "Medium", "tags": ["Tree", "DFS", "BST"],       "source": ["Grind 169"]},
    {"id": 98,   "title": "Validate Binary Search Tree",             "slug": "validate-binary-search-tree",                "difficulty": "Medium", "tags": ["Tree", "DFS", "BST"],                    "source": ["Grind 169"]},
    {"id": 230,  "title": "Kth Smallest Element in a BST",           "slug": "kth-smallest-element-in-a-bst",              "difficulty": "Medium", "tags": ["Tree", "DFS", "BST"],                    "source": ["Grind 169"]},
    {"id": 285,  "title": "Inorder Successor in BST",                "slug": "inorder-successor-in-bst",                   "difficulty": "Medium", "tags": ["Tree", "DFS", "BST"],                    "source": ["Grind 169"]},
    {"id": 108,  "title": "Convert Sorted Array to Binary Search Tree", "slug": "convert-sorted-array-to-binary-search-tree", "difficulty": "Easy",   "tags": ["Array", "Divide and Conquer", "Tree"], "source": ["Grind 169"]},

    # ── Binary Tree (18) ────────────────────────────────────────────────────
    {"id": 226,  "title": "Invert Binary Tree",                      "slug": "invert-binary-tree",                         "difficulty": "Easy",   "tags": ["Tree", "DFS", "BFS"],                    "source": ["Grind 169"]},
    {"id": 110,  "title": "Balanced Binary Tree",                    "slug": "balanced-binary-tree",                       "difficulty": "Easy",   "tags": ["Tree", "DFS"],                           "source": ["Grind 169"]},
    {"id": 102,  "title": "Binary Tree Level Order Traversal",       "slug": "binary-tree-level-order-traversal",          "difficulty": "Medium", "tags": ["Tree", "BFS"],                           "source": ["Grind 169"]},
    {"id": 236,  "title": "Lowest Common Ancestor of a Binary Tree", "slug": "lowest-common-ancestor-of-a-binary-tree",    "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Grind 169"]},
    {"id": 297,  "title": "Serialize and Deserialize Binary Tree",   "slug": "serialize-and-deserialize-binary-tree",      "difficulty": "Hard",   "tags": ["String", "Tree", "DFS", "BFS", "Design"], "source": ["Grind 169"]},
    {"id": 543,  "title": "Diameter of Binary Tree",                 "slug": "diameter-of-binary-tree",                    "difficulty": "Easy",   "tags": ["Tree", "DFS"],                           "source": ["Grind 169"]},
    {"id": 199,  "title": "Binary Tree Right Side View",             "slug": "binary-tree-right-side-view",                "difficulty": "Medium", "tags": ["Tree", "DFS", "BFS"],                    "source": ["Grind 169"]},
    {"id": 104,  "title": "Maximum Depth of Binary Tree",            "slug": "maximum-depth-of-binary-tree",               "difficulty": "Easy",   "tags": ["Tree", "DFS", "BFS"],                    "source": ["Grind 169"]},
    {"id": 105,  "title": "Construct Binary Tree from Preorder and Inorder Traversal", "slug": "construct-binary-tree-from-preorder-and-inorder-traversal", "difficulty": "Medium", "tags": ["Array", "Hash Table", "Tree", "DFS"], "source": ["Grind 169"]},
    {"id": 124,  "title": "Binary Tree Maximum Path Sum",            "slug": "binary-tree-maximum-path-sum",               "difficulty": "Hard",   "tags": ["Dynamic Programming", "Tree", "DFS"],    "source": ["Grind 169"]},
    {"id": 113,  "title": "Path Sum II",                             "slug": "path-sum-ii",                                "difficulty": "Medium", "tags": ["Backtracking", "Tree", "DFS"],           "source": ["Grind 169"]},
    {"id": 662,  "title": "Maximum Width of Binary Tree",            "slug": "maximum-width-of-binary-tree",               "difficulty": "Medium", "tags": ["Tree", "BFS"],                           "source": ["Grind 169"]},
    {"id": 100,  "title": "Same Tree",                               "slug": "same-tree",                                  "difficulty": "Easy",   "tags": ["Tree", "DFS", "BFS"],                    "source": ["Grind 169"]},
    {"id": 103,  "title": "Binary Tree Zigzag Level Order Traversal","slug": "binary-tree-zigzag-level-order-traversal",   "difficulty": "Medium", "tags": ["Tree", "BFS"],                           "source": ["Grind 169"]},
    {"id": 437,  "title": "Path Sum III",                            "slug": "path-sum-iii",                               "difficulty": "Medium", "tags": ["Tree", "DFS", "Prefix Sum"],             "source": ["Grind 169"]},
    {"id": 101,  "title": "Symmetric Tree",                          "slug": "symmetric-tree",                             "difficulty": "Easy",   "tags": ["Tree", "DFS", "BFS"],                    "source": ["Grind 169"]},
    {"id": 863,  "title": "All Nodes Distance K in Binary Tree",     "slug": "all-nodes-distance-k-in-binary-tree",        "difficulty": "Medium", "tags": ["Hash Table", "Tree", "DFS", "BFS"],      "source": ["Grind 169"]},
    {"id": 572,  "title": "Subtree of Another Tree",                 "slug": "subtree-of-another-tree",                    "difficulty": "Easy",   "tags": ["Tree", "DFS", "String Matching"],        "source": ["Grind 169"]},

    # ── Hash Table (3) ───────────────────────────────────────────────────────
    {"id": 383,  "title": "Ransom Note",                             "slug": "ransom-note",                                "difficulty": "Easy",   "tags": ["Hash Table", "String", "Counting"],      "source": ["Grind 169"]},
    {"id": 380,  "title": "Insert Delete GetRandom O(1)",            "slug": "insert-delete-getrandom-o1",                 "difficulty": "Medium", "tags": ["Array", "Hash Table", "Math", "Design"], "source": ["Grind 169"]},
    {"id": 41,   "title": "First Missing Positive",                  "slug": "first-missing-positive",                     "difficulty": "Hard",   "tags": ["Array", "Hash Table"],                   "source": ["Grind 169"]},

    # ── Recursion / Backtracking (6) ─────────────────────────────────────────
    {"id": 46,   "title": "Permutations",                            "slug": "permutations",                               "difficulty": "Medium", "tags": ["Array", "Backtracking"],                 "source": ["Grind 169"]},
    {"id": 78,   "title": "Subsets",                                 "slug": "subsets",                                    "difficulty": "Medium", "tags": ["Array", "Backtracking", "Bit Manipulation"], "source": ["Grind 169"]},
    {"id": 17,   "title": "Letter Combinations of a Phone Number",   "slug": "letter-combinations-of-a-phone-number",      "difficulty": "Medium", "tags": ["Hash Table", "String", "Backtracking"],  "source": ["Grind 169"]},
    {"id": 31,   "title": "Next Permutation",                        "slug": "next-permutation",                           "difficulty": "Medium", "tags": ["Array", "Two Pointers"],                 "source": ["Grind 169"]},
    {"id": 22,   "title": "Generate Parentheses",                    "slug": "generate-parentheses",                       "difficulty": "Medium", "tags": ["String", "Dynamic Programming", "Backtracking"], "source": ["Grind 169"]},
    {"id": 51,   "title": "N-Queens",                                "slug": "n-queens",                                   "difficulty": "Hard",   "tags": ["Array", "Backtracking"],                 "source": ["Grind 169"]},

    # ── Linked List (14) ────────────────────────────────────────────────────
    {"id": 21,   "title": "Merge Two Sorted Lists",                  "slug": "merge-two-sorted-lists",                     "difficulty": "Easy",   "tags": ["Linked List", "Recursion"],              "source": ["Grind 169"]},
    {"id": 141,  "title": "Linked List Cycle",                       "slug": "linked-list-cycle",                          "difficulty": "Easy",   "tags": ["Hash Table", "Linked List", "Two Pointers"], "source": ["Grind 169"]},
    {"id": 206,  "title": "Reverse Linked List",                     "slug": "reverse-linked-list",                        "difficulty": "Easy",   "tags": ["Linked List", "Recursion"],              "source": ["Grind 169"]},
    {"id": 876,  "title": "Middle of the Linked List",               "slug": "middle-of-the-linked-list",                  "difficulty": "Easy",   "tags": ["Linked List", "Two Pointers"],           "source": ["Grind 169"]},
    {"id": 146,  "title": "LRU Cache",                               "slug": "lru-cache",                                  "difficulty": "Medium", "tags": ["Hash Table", "Linked List", "Design"],   "source": ["Grind 169"]},
    {"id": 19,   "title": "Remove Nth Node From End of List",        "slug": "remove-nth-node-from-end-of-list",           "difficulty": "Medium", "tags": ["Linked List", "Two Pointers"],           "source": ["Grind 169"]},
    {"id": 24,   "title": "Swap Nodes in Pairs",                     "slug": "swap-nodes-in-pairs",                        "difficulty": "Medium", "tags": ["Linked List", "Recursion"],              "source": ["Grind 169"]},
    {"id": 328,  "title": "Odd Even Linked List",                    "slug": "odd-even-linked-list",                       "difficulty": "Medium", "tags": ["Linked List"],                           "source": ["Grind 169"]},
    {"id": 2,    "title": "Add Two Numbers",                         "slug": "add-two-numbers",                            "difficulty": "Medium", "tags": ["Linked List", "Math", "Recursion"],      "source": ["Grind 169"]},
    {"id": 148,  "title": "Sort List",                               "slug": "sort-list",                                  "difficulty": "Medium", "tags": ["Linked List", "Two Pointers", "Divide and Conquer", "Sorting", "Merge Sort"], "source": ["Grind 169"]},
    {"id": 234,  "title": "Palindrome Linked List",                  "slug": "palindrome-linked-list",                     "difficulty": "Easy",   "tags": ["Linked List", "Two Pointers", "Recursion"], "source": ["Grind 169"]},
    {"id": 143,  "title": "Reorder List",                            "slug": "reorder-list",                               "difficulty": "Medium", "tags": ["Linked List", "Two Pointers", "Stack", "Recursion"], "source": ["Grind 169"]},
    {"id": 61,   "title": "Rotate List",                             "slug": "rotate-list",                                "difficulty": "Medium", "tags": ["Linked List", "Two Pointers"],           "source": ["Grind 169"]},
    {"id": 25,   "title": "Reverse Nodes in k-Group",                "slug": "reverse-nodes-in-k-group",                   "difficulty": "Hard",   "tags": ["Linked List", "Recursion"],              "source": ["Grind 169"]},

    # ── Stack (14) ───────────────────────────────────────────────────────────
    {"id": 20,   "title": "Valid Parentheses",                       "slug": "valid-parentheses",                          "difficulty": "Easy",   "tags": ["String", "Stack"],                       "source": ["Grind 169"]},
    {"id": 232,  "title": "Implement Queue using Stacks",            "slug": "implement-queue-using-stacks",               "difficulty": "Easy",   "tags": ["Stack", "Design", "Queue"],              "source": ["Grind 169"]},
    {"id": 150,  "title": "Evaluate Reverse Polish Notation",        "slug": "evaluate-reverse-polish-notation",           "difficulty": "Medium", "tags": ["Array", "Math", "Stack"],                "source": ["Grind 169"]},
    {"id": 155,  "title": "Min Stack",                               "slug": "min-stack",                                  "difficulty": "Medium", "tags": ["Stack", "Design"],                       "source": ["Grind 169"]},
    {"id": 42,   "title": "Trapping Rain Water",                     "slug": "trapping-rain-water",                        "difficulty": "Hard",   "tags": ["Array", "Two Pointers", "Dynamic Programming", "Stack", "Monotonic Stack"], "source": ["Grind 169"]},
    {"id": 224,  "title": "Basic Calculator",                        "slug": "basic-calculator",                           "difficulty": "Hard",   "tags": ["Math", "String", "Stack", "Recursion"],  "source": ["Grind 169"]},
    {"id": 84,   "title": "Largest Rectangle in Histogram",          "slug": "largest-rectangle-in-histogram",             "difficulty": "Hard",   "tags": ["Array", "Stack", "Monotonic Stack"],     "source": ["Grind 169"]},
    {"id": 739,  "title": "Daily Temperatures",                      "slug": "daily-temperatures",                         "difficulty": "Medium", "tags": ["Array", "Stack", "Monotonic Stack"],     "source": ["Grind 169"]},
    {"id": 844,  "title": "Backspace String Compare",                "slug": "backspace-string-compare",                   "difficulty": "Easy",   "tags": ["Two Pointers", "String", "Stack", "Simulation"], "source": ["Grind 169"]},
    {"id": 895,  "title": "Maximum Frequency Stack",                 "slug": "maximum-frequency-stack",                    "difficulty": "Hard",   "tags": ["Hash Table", "Stack", "Design"],         "source": ["Grind 169"]},
    {"id": 394,  "title": "Decode String",                           "slug": "decode-string",                              "difficulty": "Medium", "tags": ["String", "Stack", "Recursion"],          "source": ["Grind 169"]},
    {"id": 735,  "title": "Asteroid Collision",                      "slug": "asteroid-collision",                         "difficulty": "Medium", "tags": ["Array", "Stack", "Simulation"],          "source": ["Grind 169"]},
    {"id": 32,   "title": "Longest Valid Parentheses",               "slug": "longest-valid-parentheses",                  "difficulty": "Hard",   "tags": ["String", "Dynamic Programming", "Stack"], "source": ["Grind 169"]},
    {"id": 227,  "title": "Basic Calculator II",                     "slug": "basic-calculator-ii",                        "difficulty": "Medium", "tags": ["Math", "String", "Stack"],               "source": ["Grind 169"]},

    # ── Queue (1) ────────────────────────────────────────────────────────────
    {"id": 362,  "title": "Design Hit Counter",                      "slug": "design-hit-counter",                         "difficulty": "Medium", "tags": ["Array", "Hash Table", "Binary Search", "Design", "Queue"], "source": ["Grind 169"]},

    # ── Heap (8) ─────────────────────────────────────────────────────────────
    {"id": 973,  "title": "K Closest Points to Origin",              "slug": "k-closest-points-to-origin",                 "difficulty": "Medium", "tags": ["Array", "Math", "Divide and Conquer", "Sorting", "Heap"], "source": ["Grind 169"]},
    {"id": 295,  "title": "Find Median from Data Stream",            "slug": "find-median-from-data-stream",               "difficulty": "Hard",   "tags": ["Two Pointers", "Design", "Sorting", "Heap"], "source": ["Grind 169"]},
    {"id": 23,   "title": "Merge k Sorted Lists",                    "slug": "merge-k-sorted-lists",                       "difficulty": "Hard",   "tags": ["Linked List", "Divide and Conquer", "Heap", "Merge Sort"], "source": ["Grind 169"]},
    {"id": 621,  "title": "Task Scheduler",                          "slug": "task-scheduler",                             "difficulty": "Medium", "tags": ["Array", "Hash Table", "Greedy", "Heap", "Counting"], "source": ["Grind 169"]},
    {"id": 692,  "title": "Top K Frequent Words",                    "slug": "top-k-frequent-words",                       "difficulty": "Medium", "tags": ["Hash Table", "String", "Trie", "Sorting", "Heap"], "source": ["Grind 169"]},
    {"id": 658,  "title": "Find K Closest Elements",                 "slug": "find-k-closest-elements",                    "difficulty": "Medium", "tags": ["Array", "Binary Search", "Sorting", "Heap", "Two Pointers"], "source": ["Grind 169"]},
    {"id": 215,  "title": "Kth Largest Element in an Array",         "slug": "kth-largest-element-in-an-array",            "difficulty": "Medium", "tags": ["Array", "Divide and Conquer", "Sorting", "Heap", "Quickselect"], "source": ["Grind 169"]},
    {"id": 632,  "title": "Smallest Range Covering Elements from K Lists", "slug": "smallest-range-covering-elements-from-k-lists", "difficulty": "Hard", "tags": ["Array", "Hash Table", "Greedy", "Heap", "Sliding Window", "Sorting"], "source": ["Grind 169"]},

    # ── Trie (4) ─────────────────────────────────────────────────────────────
    {"id": 208,  "title": "Implement Trie (Prefix Tree)",            "slug": "implement-trie-prefix-tree",                 "difficulty": "Medium", "tags": ["Hash Table", "String", "Design", "Trie"], "source": ["Grind 169"]},
    {"id": 139,  "title": "Word Break",                              "slug": "word-break",                                 "difficulty": "Medium", "tags": ["Array", "Hash Table", "String", "Dynamic Programming", "Trie", "Memoization"], "source": ["Grind 169"]},
    {"id": 211,  "title": "Design Add and Search Words Data Structure", "slug": "design-add-and-search-words-data-structure", "difficulty": "Medium", "tags": ["String", "DFS", "Design", "Trie"],   "source": ["Grind 169"]},
    {"id": 588,  "title": "Design In-Memory File System",            "slug": "design-in-memory-file-system",               "difficulty": "Hard",   "tags": ["Hash Table", "String", "Design", "Trie"], "source": ["Grind 169"]},

    # ── Dynamic Programming (12) ─────────────────────────────────────────────
    {"id": 53,   "title": "Maximum Subarray",                        "slug": "maximum-subarray",                           "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Divide and Conquer"], "source": ["Grind 169"]},
    {"id": 322,  "title": "Coin Change",                             "slug": "coin-change",                                "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "BFS"], "source": ["Grind 169"]},
    {"id": 70,   "title": "Climbing Stairs",                         "slug": "climbing-stairs",                            "difficulty": "Easy",   "tags": ["Math", "Dynamic Programming", "Memoization"], "source": ["Grind 169"]},
    {"id": 416,  "title": "Partition Equal Subset Sum",              "slug": "partition-equal-subset-sum",                 "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],         "source": ["Grind 169"]},
    {"id": 62,   "title": "Unique Paths",                            "slug": "unique-paths",                               "difficulty": "Medium", "tags": ["Math", "Dynamic Programming", "Combinatorics"], "source": ["Grind 169"]},
    {"id": 198,  "title": "House Robber",                            "slug": "house-robber",                               "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],         "source": ["Grind 169"]},
    {"id": 152,  "title": "Maximum Product Subarray",                "slug": "maximum-product-subarray",                   "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],         "source": ["Grind 169"]},
    {"id": 300,  "title": "Longest Increasing Subsequence",          "slug": "longest-increasing-subsequence",             "difficulty": "Medium", "tags": ["Array", "Binary Search", "Dynamic Programming"], "source": ["Grind 169"]},
    {"id": 55,   "title": "Jump Game",                               "slug": "jump-game",                                  "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Greedy"], "source": ["Grind 169"]},
    {"id": 221,  "title": "Maximal Square",                          "slug": "maximal-square",                             "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Matrix"], "source": ["Grind 169"]},
    {"id": 91,   "title": "Decode Ways",                             "slug": "decode-ways",                                "difficulty": "Medium", "tags": ["String", "Dynamic Programming"],        "source": ["Grind 169"]},
    {"id": 377,  "title": "Combination Sum IV",                      "slug": "combination-sum-iv",                         "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],         "source": ["Grind 169"]},

    # ── Binary / Bits (7) ───────────────────────────────────────────────────
    {"id": 67,   "title": "Add Binary",                              "slug": "add-binary",                                 "difficulty": "Easy",   "tags": ["Math", "String", "Bit Manipulation", "Simulation"], "source": ["Grind 169"]},
    {"id": 287,  "title": "Find the Duplicate Number",               "slug": "find-the-duplicate-number",                  "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Binary Search", "Bit Manipulation"], "source": ["Grind 169"]},
    {"id": 338,  "title": "Counting Bits",                           "slug": "counting-bits",                              "difficulty": "Easy",   "tags": ["Dynamic Programming", "Bit Manipulation"], "source": ["Grind 169"]},
    {"id": 191,  "title": "Number of 1 Bits",                        "slug": "number-of-1-bits",                           "difficulty": "Easy",   "tags": ["Divide and Conquer", "Bit Manipulation"], "source": ["Grind 169"]},
    {"id": 136,  "title": "Single Number",                           "slug": "single-number",                              "difficulty": "Easy",   "tags": ["Array", "Bit Manipulation"],            "source": ["Grind 169"]},
    {"id": 268,  "title": "Missing Number",                          "slug": "missing-number",                             "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Math", "Binary Search", "Bit Manipulation"], "source": ["Grind 169"]},
    {"id": 190,  "title": "Reverse Bits",                            "slug": "reverse-bits",                               "difficulty": "Easy",   "tags": ["Divide and Conquer", "Bit Manipulation"], "source": ["Grind 169"]},

    # ── Math (5) ────────────────────────────────────────────────────────────
    {"id": 13,   "title": "Roman to Integer",                        "slug": "roman-to-integer",                           "difficulty": "Easy",   "tags": ["Hash Table", "Math", "String"],         "source": ["Grind 169"]},
    {"id": 528,  "title": "Random Pick with Weight",                 "slug": "random-pick-with-weight",                    "difficulty": "Medium", "tags": ["Math", "Binary Search", "Prefix Sum", "Randomized"], "source": ["Grind 169"]},
    {"id": 50,   "title": "Pow(x, n)",                               "slug": "powx-n",                                     "difficulty": "Medium", "tags": ["Math", "Recursion"],                     "source": ["Grind 169"]},
    {"id": 7,    "title": "Reverse Integer",                         "slug": "reverse-integer",                            "difficulty": "Medium", "tags": ["Math"],                                  "source": ["Grind 169"]},
    {"id": 9,    "title": "Palindrome Number",                       "slug": "palindrome-number",                          "difficulty": "Easy",   "tags": ["Math"],                                  "source": ["Grind 169"]},
]

# ──────────────────────────────────────────────────────────────────────────────
# PART III — 98 LEETCODE PREMIUM QUESTIONS (exact from the doc)
# ──────────────────────────────────────────────────────────────────────────────

PREMIUM_98 = [
    {"id": 422,  "title": "Valid Word Square",                       "slug": "valid-word-square",                          "difficulty": "Easy",   "tags": ["Array", "Matrix"],                       "source": ["Premium 98"]},
    {"id": 249,  "title": "Group Shifted Strings",                   "slug": "group-shifted-strings",                      "difficulty": "Medium", "tags": ["Array", "Hash Table", "String"],         "source": ["Premium 98"]},
    {"id": 1056, "title": "Confusing Number",                        "slug": "confusing-number",                           "difficulty": "Easy",   "tags": ["Math"],                                  "source": ["Premium 98"]},
    {"id": 760,  "title": "Find Anagram Mappings",                   "slug": "find-anagram-mappings",                      "difficulty": "Easy",   "tags": ["Array", "Hash Table"],                   "source": ["Premium 98"]},
    {"id": 734,  "title": "Sentence Similarity",                     "slug": "sentence-similarity",                        "difficulty": "Easy",   "tags": ["Array", "Hash Table", "String"],         "source": ["Premium 98"]},
    {"id": 1086, "title": "Largest Unique Number",                   "slug": "largest-unique-number",                      "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Sorting"],        "source": ["Premium 98"]},
    {"id": 1165, "title": "Single Row Keyboard",                     "slug": "single-row-keyboard",                        "difficulty": "Easy",   "tags": ["Hash Table", "String"],                  "source": ["Premium 98"]},
    {"id": 1426, "title": "Counting Elements",                       "slug": "counting-elements",                          "difficulty": "Easy",   "tags": ["Array", "Hash Table"],                   "source": ["Premium 98"]},
    {"id": 1427, "title": "Perform String Shifts",                   "slug": "perform-string-shifts",                      "difficulty": "Easy",   "tags": ["Array", "Math", "String"],               "source": ["Premium 98"]},
    {"id": 346,  "title": "Moving Average from Data Stream",         "slug": "moving-average-from-data-stream",            "difficulty": "Easy",   "tags": ["Array", "Design", "Queue", "Data Stream"], "source": ["Premium 98"]},
    {"id": 271,  "title": "Encode and Decode Strings",               "slug": "encode-and-decode-strings",                  "difficulty": "Medium", "tags": ["Array", "String", "Design"],             "source": ["Premium 98", "Grind 169"]},
    {"id": 531,  "title": "Lonely Pixel I",                          "slug": "lonely-pixel-i",                             "difficulty": "Medium", "tags": ["Array", "Hash Table", "Matrix"],         "source": ["Premium 98"]},
    {"id": 311,  "title": "Sparse Matrix Multiplication",            "slug": "sparse-matrix-multiplication",               "difficulty": "Medium", "tags": ["Array", "Hash Table", "Matrix"],         "source": ["Premium 98"]},
    {"id": 723,  "title": "Candy Crush",                             "slug": "candy-crush",                                "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Matrix", "Simulation"], "source": ["Premium 98"]},
    {"id": 1198, "title": "Find Smallest Common Element in All Rows","slug": "find-smallest-common-element-in-all-rows",   "difficulty": "Medium", "tags": ["Array", "Hash Table", "Binary Search", "Matrix", "Counting"], "source": ["Premium 98"]},
    {"id": 1152, "title": "Analyze User Website Visit Pattern",      "slug": "analyze-user-website-visit-pattern",         "difficulty": "Medium", "tags": ["Array", "Hash Table", "Sorting"],        "source": ["Premium 98"]},
    {"id": 161,  "title": "One Edit Distance",                       "slug": "one-edit-distance",                          "difficulty": "Medium", "tags": ["Two Pointers", "String"],                "source": ["Premium 98"]},
    {"id": 280,  "title": "Wiggle Sort",                             "slug": "wiggle-sort",                                "difficulty": "Medium", "tags": ["Array", "Greedy", "Sorting"],            "source": ["Premium 98"]},
    {"id": 186,  "title": "Reverse Words in a String II",            "slug": "reverse-words-in-a-string-ii",               "difficulty": "Medium", "tags": ["Two Pointers", "String"],                "source": ["Premium 98"]},
    {"id": 1055, "title": "Shortest Way to Form String",             "slug": "shortest-way-to-form-string",                "difficulty": "Medium", "tags": ["Two Pointers", "String", "Binary Search"], "source": ["Premium 98"]},
    {"id": 1429, "title": "First Unique Number",                     "slug": "first-unique-number",                        "difficulty": "Medium", "tags": ["Array", "Hash Table", "Design", "Queue", "Data Stream"], "source": ["Premium 98"]},
    {"id": 408,  "title": "Valid Word Abbreviation",                 "slug": "valid-word-abbreviation",                    "difficulty": "Easy",   "tags": ["Two Pointers", "String"],                "source": ["Premium 98"]},
    {"id": 487,  "title": "Max Consecutive Ones II",                 "slug": "max-consecutive-ones-ii",                    "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Sliding Window"], "source": ["Premium 98"]},
    {"id": 159,  "title": "Longest Substring with At Most Two Distinct Characters", "slug": "longest-substring-with-at-most-two-distinct-characters", "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Premium 98"]},
    {"id": 340,  "title": "Longest Substring with At Most K Distinct Characters", "slug": "longest-substring-with-at-most-k-distinct-characters", "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Premium 98"]},
    {"id": 1100, "title": "Find K-Length Substrings with No Repeated Characters", "slug": "find-k-length-substrings-with-no-repeated-characters", "difficulty": "Medium", "tags": ["Hash Table", "String", "Sliding Window"], "source": ["Premium 98"]},
    {"id": 439,  "title": "Ternary Expression Parser",               "slug": "ternary-expression-parser",                  "difficulty": "Medium", "tags": ["String", "Stack", "Recursion"],          "source": ["Premium 98"]},
    {"id": 484,  "title": "Find Permutation",                        "slug": "find-permutation",                           "difficulty": "Medium", "tags": ["Array", "String", "Stack", "Greedy"],    "source": ["Premium 98"]},
    {"id": 772,  "title": "Basic Calculator III",                    "slug": "basic-calculator-iii",                       "difficulty": "Hard",   "tags": ["Math", "String", "Stack", "Recursion"],  "source": ["Premium 98"]},
    {"id": 1228, "title": "Missing Number in Arithmetic Progression","slug": "missing-number-in-arithmetic-progression",   "difficulty": "Easy",   "tags": ["Array", "Math"],                         "source": ["Premium 98"]},
    {"id": 1060, "title": "Missing Element in Sorted Array",         "slug": "missing-element-in-sorted-array",            "difficulty": "Medium", "tags": ["Array", "Binary Search"],                "source": ["Premium 98"]},
    {"id": 1533, "title": "Find the Index of the Large Integer",     "slug": "find-the-index-of-the-large-integer",        "difficulty": "Medium", "tags": ["Array", "Binary Search", "Interactive"], "source": ["Premium 98"]},
    {"id": 1474, "title": "Delete N Nodes After M Nodes of Linked List", "slug": "delete-n-nodes-after-m-nodes-of-a-linked-list", "difficulty": "Easy", "tags": ["Linked List"],                    "source": ["Premium 98"]},
    {"id": 708,  "title": "Insert into a Sorted Circular Linked List","slug": "insert-into-a-sorted-circular-linked-list",  "difficulty": "Medium", "tags": ["Linked List"],                          "source": ["Premium 98"]},
    {"id": 369,  "title": "Plus One Linked List",                    "slug": "plus-one-linked-list",                       "difficulty": "Medium", "tags": ["Linked List", "Math", "Recursion"],      "source": ["Premium 98"]},
    {"id": 430,  "title": "Flatten a Multilevel Doubly Linked List", "slug": "flatten-a-multilevel-doubly-linked-list",    "difficulty": "Medium", "tags": ["Linked List", "DFS", "Doubly Linked List"], "source": ["Premium 98"]},  # Print Immutable LL in Reverse equivalent
    {"id": 270,  "title": "Closest Binary Search Tree Value",        "slug": "closest-binary-search-tree-value",           "difficulty": "Easy",   "tags": ["Binary Search", "Tree", "DFS", "BST"],   "source": ["Premium 98"]},
    {"id": 314,  "title": "Binary Tree Vertical Order Traversal",    "slug": "binary-tree-vertical-order-traversal",       "difficulty": "Medium", "tags": ["Hash Table", "Tree", "BFS", "Sorting"],  "source": ["Premium 98"]},
    {"id": 1650, "title": "Lowest Common Ancestor of a Binary Tree III", "slug": "lowest-common-ancestor-of-a-binary-tree-iii", "difficulty": "Medium", "tags": ["Hash Table", "Tree", "Two Pointers"], "source": ["Premium 98"]},
    {"id": 298,  "title": "Binary Tree Longest Consecutive Sequence","slug": "binary-tree-longest-consecutive-sequence",   "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Premium 98"]},
    {"id": 549,  "title": "Binary Tree Longest Consecutive Sequence II", "slug": "binary-tree-longest-consecutive-sequence-ii", "difficulty": "Medium", "tags": ["Tree", "DFS"],                    "source": ["Premium 98"]},
    {"id": 250,  "title": "Count Univalue Subtrees",                 "slug": "count-univalue-subtrees",                    "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Premium 98"]},
    {"id": 1120, "title": "Maximum Average Subtree",                 "slug": "maximum-average-subtree",                    "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Premium 98"]},
    {"id": 545,  "title": "Boundary of Binary Tree",                 "slug": "boundary-of-binary-tree",                    "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Premium 98"]},
    {"id": 366,  "title": "Find Leaves of Binary Tree",              "slug": "find-leaves-of-binary-tree",                 "difficulty": "Medium", "tags": ["Tree", "DFS", "Sorting"],                "source": ["Premium 98"]},
    {"id": 255,  "title": "Verify Preorder Sequence in Binary Search Tree", "slug": "verify-preorder-sequence-in-binary-search-tree", "difficulty": "Medium", "tags": ["Array", "Tree", "BST", "Stack", "Monotonic Stack"], "source": ["Premium 98"]},
    {"id": 1214, "title": "Two Sum BSTs",                            "slug": "two-sum-bsts",                               "difficulty": "Medium", "tags": ["Two Pointers", "Binary Search", "Stack", "Tree", "DFS", "BST", "BFS"], "source": ["Premium 98"]},
    {"id": 333,  "title": "Largest BST Subtree",                     "slug": "largest-bst-subtree",                        "difficulty": "Medium", "tags": ["Dynamic Programming", "Tree", "DFS", "BST"], "source": ["Premium 98"]},
    {"id": 1490, "title": "Clone N-ary Tree",                        "slug": "clone-n-ary-tree",                           "difficulty": "Medium", "tags": ["Hash Table", "Tree", "DFS", "BFS"],      "source": ["Premium 98"]},
    {"id": 1506, "title": "Find Root of N-Ary Tree",                 "slug": "find-root-of-n-ary-tree",                    "difficulty": "Medium", "tags": ["Hash Table", "Bit Manipulation", "Tree", "DFS"], "source": ["Premium 98"]},
    {"id": 1522, "title": "Diameter of N-Ary Tree",                  "slug": "diameter-of-n-ary-tree",                     "difficulty": "Medium", "tags": ["Tree", "DFS"],                           "source": ["Premium 98"]},
    {"id": 272,  "title": "Closest Binary Search Tree Value II",     "slug": "closest-binary-search-tree-value-ii",        "difficulty": "Hard",   "tags": ["Two Pointers", "Stack", "Tree", "DFS", "BST", "Heap"], "source": ["Premium 98"]},
    {"id": 1086, "title": "High Five",                               "slug": "high-five",                                  "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Sorting", "Heap"], "source": ["Premium 98"]},
    {"id": 1167, "title": "Minimum Cost to Connect Sticks",          "slug": "minimum-cost-to-connect-sticks",             "difficulty": "Medium", "tags": ["Array", "Greedy", "Heap"],               "source": ["Premium 98"]},
    {"id": 1057, "title": "Campus Bikes",                            "slug": "campus-bikes",                               "difficulty": "Medium", "tags": ["Array", "Greedy", "Sorting", "Heap"],    "source": ["Premium 98"]},
    {"id": 358,  "title": "Rearrange String k Distance Apart",       "slug": "rearrange-string-k-distance-apart",          "difficulty": "Hard",   "tags": ["Hash Table", "String", "Greedy", "Sorting", "Heap", "Counting"], "source": ["Premium 98"]},
    {"id": 588,  "title": "Design In-Memory File System",            "slug": "design-in-memory-file-system",               "difficulty": "Hard",   "tags": ["Hash Table", "String", "Design", "Trie"], "source": ["Premium 98", "Grind 169"]},
    {"id": 642,  "title": "Design Search Autocomplete System",       "slug": "design-search-autocomplete-system",          "difficulty": "Hard",   "tags": ["String", "Design", "Trie", "Data Stream", "Heap"], "source": ["Premium 98"]},
    {"id": 286,  "title": "Walls and Gates",                         "slug": "walls-and-gates",                            "difficulty": "Medium", "tags": ["Array", "BFS", "Matrix"],                "source": ["Premium 98"]},
    {"id": 261,  "title": "Graph Valid Tree",                        "slug": "graph-valid-tree",                           "difficulty": "Medium", "tags": ["DFS", "BFS", "Union Find", "Graph"],     "source": ["Premium 98", "Grind 169"]},
    {"id": 323,  "title": "Number of Connected Components in an Undirected Graph", "slug": "number-of-connected-components-in-an-undirected-graph", "difficulty": "Medium", "tags": ["DFS", "BFS", "Union Find", "Graph"], "source": ["Premium 98", "Grind 169"]},
    {"id": 277,  "title": "Find the Celebrity",                      "slug": "find-the-celebrity",                         "difficulty": "Medium", "tags": ["Two Pointers", "Graph", "Interactive"],  "source": ["Premium 98"]},
    {"id": 582,  "title": "Kill Process",                            "slug": "kill-process",                               "difficulty": "Medium", "tags": ["Array", "Hash Table", "Tree", "DFS", "BFS"], "source": ["Premium 98"]},
    {"id": 1120, "title": "All Paths from Source Lead to Destination","slug": "all-paths-from-source-lead-to-destination",  "difficulty": "Medium", "tags": ["DFS", "Graph", "Topological Sort"],      "source": ["Premium 98"]},
    {"id": 1236, "title": "Web Crawler",                             "slug": "web-crawler",                                "difficulty": "Medium", "tags": ["String", "DFS", "BFS", "Interactive"],   "source": ["Premium 98"]},
    {"id": 694,  "title": "Number of Distinct Islands",              "slug": "number-of-distinct-islands",                 "difficulty": "Medium", "tags": ["Hash Table", "DFS", "BFS", "Union Find", "Hash Function"], "source": ["Premium 98"]},
    {"id": 1136, "title": "Parallel Courses",                        "slug": "parallel-courses",                           "difficulty": "Medium", "tags": ["Graph", "Topological Sort"],             "source": ["Premium 98"]},
    {"id": 490,  "title": "The Maze",                                "slug": "the-maze",                                   "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Matrix"],         "source": ["Premium 98"]},
    {"id": 505,  "title": "The Maze II",                             "slug": "the-maze-ii",                                "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Graph", "Matrix", "Heap", "Shortest Path"], "source": ["Premium 98"]},
    {"id": 1197, "title": "Minimum Knight Moves",                    "slug": "minimum-knight-moves",                       "difficulty": "Medium", "tags": ["BFS"],                                   "source": ["Premium 98", "Grind 169"]},
    {"id": 305,  "title": "Number of Islands II",                    "slug": "number-of-islands-ii",                       "difficulty": "Hard",   "tags": ["Array", "Hash Table", "Union Find", "Matrix"], "source": ["Premium 98"]},
    {"id": 499,  "title": "The Maze III",                            "slug": "the-maze-iii",                               "difficulty": "Hard",   "tags": ["Array", "DFS", "BFS", "Graph", "Matrix", "Heap", "Shortest Path"], "source": ["Premium 98"]},
    {"id": 317,  "title": "Shortest Distance from All Buildings",    "slug": "shortest-distance-from-all-buildings",       "difficulty": "Hard",   "tags": ["Array", "BFS", "Matrix"],                "source": ["Premium 98"]},
    {"id": 269,  "title": "Alien Dictionary",                        "slug": "alien-dictionary",                           "difficulty": "Hard",   "tags": ["Array", "String", "DFS", "BFS", "Graph", "Topological Sort"], "source": ["Premium 98", "Grind 169"]},
    {"id": 256,  "title": "Paint House",                             "slug": "paint-house",                                "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],          "source": ["Premium 98"]},
    {"id": 1762, "title": "Buildings With an Ocean View",            "slug": "buildings-with-an-ocean-view",               "difficulty": "Medium", "tags": ["Array", "Stack", "Monotonic Stack"],     "source": ["Premium 98"]},
    {"id": 163,  "title": "Missing Ranges",                          "slug": "missing-ranges",                             "difficulty": "Easy",   "tags": ["Array"],                                 "source": ["Premium 98"]},
    {"id": 1272, "title": "Remove Interval",                         "slug": "remove-interval",                            "difficulty": "Medium", "tags": ["Array"],                                 "source": ["Premium 98"]},
    {"id": 616,  "title": "Add Bold Tag in String",                  "slug": "add-bold-tag-in-string",                     "difficulty": "Medium", "tags": ["Array", "Hash Table", "String", "Trie"], "source": ["Premium 98"]},
    {"id": 252,  "title": "Meeting Rooms",                           "slug": "meeting-rooms",                              "difficulty": "Easy",   "tags": ["Array", "Sorting"],                      "source": ["Premium 98", "Grind 169"]},
    {"id": 253,  "title": "Meeting Rooms II",                        "slug": "meeting-rooms-ii",                           "difficulty": "Medium", "tags": ["Array", "Greedy", "Sorting", "Heap"],    "source": ["Premium 98", "Grind 169"]},
    # JS questions (82-88) — included for reference, no Python/C++ solution to scrape
    {"id": 2630, "title": "Memoize",                                 "slug": "memoize",                                    "difficulty": "Medium", "tags": ["JavaScript"],                            "source": ["Premium 98"]},
    {"id": 2636, "title": "Promise Pool",                            "slug": "promise-pool",                               "difficulty": "Medium", "tags": ["JavaScript", "Concurrency"],             "source": ["Premium 98"]},
    {"id": 2627, "title": "Debounce",                                "slug": "debounce",                                   "difficulty": "Medium", "tags": ["JavaScript"],                            "source": ["Premium 98"]},
    {"id": 2628, "title": "JSON Deep Equal",                         "slug": "json-deep-equal",                            "difficulty": "Medium", "tags": ["JavaScript"],                            "source": ["Premium 98"]},
    {"id": 2633, "title": "Convert Object to JSON String",           "slug": "convert-object-to-json-string",              "difficulty": "Medium", "tags": ["JavaScript"],                            "source": ["Premium 98"]},
    {"id": 2675, "title": "Array of Objects to Matrix",              "slug": "convert-an-array-of-objects-to-matrix",      "difficulty": "Medium", "tags": ["JavaScript", "Array"],                   "source": ["Premium 98"]},
    {"id": 2700, "title": "Differences Between Two Objects",         "slug": "differences-between-two-objects",            "difficulty": "Medium", "tags": ["JavaScript"],                            "source": ["Premium 98"]},
]

# ──────────────────────────────────────────────────────────────────────────────
# PART IV — CODESIGNAL PREP LIST (21 questions)
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# PART II — DENNY ZHANG CHEAT SHEET (every LeetCode problem named in the doc)
# Sections: Top 25 Code Templates, Top 30 Graph, Top 25 Binary Search,
#           Top 25 DP, OO Design Top 20, Typical Follow-up Variants
# ──────────────────────────────────────────────────────────────────────────────

DENNY_ZHANG = [
    # ── Top 25 Code Templates — BFS / DFS examples ───────────────────────────
    {"id": 695,  "title": "Max Area of Island",                          "slug": "max-area-of-island",                             "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Union Find", "Matrix"],         "source": ["Denny Zhang"]},
    {"id": 542,  "title": "01 Matrix",                                   "slug": "01-matrix",                                      "difficulty": "Medium", "tags": ["Array", "BFS", "Matrix"],                              "source": ["Denny Zhang"]},
    {"id": 130,  "title": "Surrounded Regions",                          "slug": "surrounded-regions",                             "difficulty": "Medium", "tags": ["Array", "DFS", "BFS", "Union Find", "Matrix"],         "source": ["Denny Zhang"]},
    {"id": 112,  "title": "Path Sum",                                    "slug": "path-sum",                                       "difficulty": "Easy",   "tags": ["Tree", "DFS", "BFS"],                                  "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Binary Search examples ───────────────────────
    {"id": 35,   "title": "Search Insert Position",                      "slug": "search-insert-position",                         "difficulty": "Easy",   "tags": ["Array", "Binary Search"],                              "source": ["Denny Zhang"]},
    {"id": 1011, "title": "Capacity to Ship Packages Within D Days",     "slug": "capacity-to-ship-packages-within-d-days",        "difficulty": "Medium", "tags": ["Array", "Binary Search"],                              "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Interval / Two Pointer examples ──────────────
    {"id": 986,  "title": "Interval List Intersections",                 "slug": "interval-list-intersections",                    "difficulty": "Medium", "tags": ["Array", "Two Pointers"],                               "source": ["Denny Zhang"]},
    {"id": 167,  "title": "Two Sum II - Input Array Is Sorted",          "slug": "two-sum-ii-input-array-is-sorted",               "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Binary Search"],              "source": ["Denny Zhang"]},
    {"id": 88,   "title": "Merge Sorted Array",                          "slug": "merge-sorted-array",                             "difficulty": "Easy",   "tags": ["Array", "Two Pointers", "Sorting"],                    "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Backtracking / Subset examples ───────────────
    {"id": 90,   "title": "Subsets II",                                  "slug": "subsets-ii",                                     "difficulty": "Medium", "tags": ["Array", "Backtracking", "Bit Manipulation"],           "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Linked List / Prefix Sum examples ────────────
    {"id": 1171, "title": "Remove Zero Sum Consecutive Nodes from Linked List", "slug": "remove-zero-sum-consecutive-nodes-from-linked-list", "difficulty": "Medium", "tags": ["Hash Table", "Linked List"],            "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Trie examples ────────────────────────────────
    {"id": 720,  "title": "Longest Word in Dictionary",                  "slug": "longest-word-in-dictionary",                     "difficulty": "Medium", "tags": ["Array", "Hash Table", "String", "Trie", "Sorting"],    "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Heap examples ────────────────────────────────
    {"id": 347,  "title": "Top K Frequent Elements",                     "slug": "top-k-frequent-elements",                        "difficulty": "Medium", "tags": ["Array", "Hash Table", "Divide and Conquer", "Sorting", "Heap", "Bucket Sort", "Counting", "Quickselect"], "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Base Conversion examples ─────────────────────
    {"id": 504,  "title": "Base 7",                                      "slug": "base-7",                                         "difficulty": "Easy",   "tags": ["Math"],                                                "source": ["Denny Zhang"]},
    {"id": 1017, "title": "Convert to Base -2",                          "slug": "convert-to-base-2",                              "difficulty": "Medium", "tags": ["Math"],                                                "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Monotone Stack/Queue examples ────────────────
    {"id": 1425, "title": "Constrained Subsequence Sum",                 "slug": "constrained-subsequence-sum",                    "difficulty": "Hard",   "tags": ["Array", "Dynamic Programming", "Queue", "Sliding Window", "Heap", "Monotonic Queue"], "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Sort By Function examples ────────────────────
    {"id": 1122, "title": "Relative Sort Array",                         "slug": "relative-sort-array",                            "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Sorting", "Counting Sort"],     "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Edit Distance / DP examples ──────────────────
    {"id": 1143, "title": "Longest Common Subsequence",                  "slug": "longest-common-subsequence",                     "difficulty": "Medium", "tags": ["String", "Dynamic Programming"],                       "source": ["Denny Zhang"]},
    {"id": 72,   "title": "Edit Distance",                               "slug": "edit-distance",                                  "difficulty": "Medium", "tags": ["String", "Dynamic Programming"],                       "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Monotonic Function + Binary Search ────────────
    {"id": 668,  "title": "Kth Smallest Number in Multiplication Table", "slug": "kth-smallest-number-in-multiplication-table",    "difficulty": "Hard",   "tags": ["Math", "Binary Search"],                               "source": ["Denny Zhang"]},
    {"id": 410,  "title": "Split Array Largest Sum",                     "slug": "split-array-largest-sum",                        "difficulty": "Hard",   "tags": ["Array", "Binary Search", "Dynamic Programming", "Greedy", "Prefix Sum"], "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Divide & Conquer / Merge Sort ────────────────
    {"id": 315,  "title": "Count of Smaller Numbers After Self",         "slug": "count-of-smaller-numbers-after-self",            "difficulty": "Hard",   "tags": ["Array", "Binary Search", "Divide and Conquer", "Binary Indexed Tree", "Segment Tree", "Merge Sort", "Ordered Set"], "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Line Sweep ───────────────────────────────────
    {"id": 218,  "title": "The Skyline Problem",                         "slug": "the-skyline-problem",                            "difficulty": "Hard",   "tags": ["Array", "Divide and Conquer", "Binary Indexed Tree", "Segment Tree", "Line Sweep", "Heap", "Ordered Set"], "source": ["Denny Zhang"]},

    # ── Top 25 Code Templates — Concurrency ──────────────────────────────────
    {"id": 1242, "title": "Web Crawler Multithreaded",                   "slug": "web-crawler-multithreaded",                      "difficulty": "Medium", "tags": ["DFS", "BFS", "Concurrency"],                           "source": ["Denny Zhang"]},

    # ── Typical Follow-up Variants ────────────────────────────────────────────
    {"id": 1074, "title": "Number of Submatrices That Sum to Target",    "slug": "number-of-submatrices-that-sum-to-target",       "difficulty": "Hard",   "tags": ["Array", "Hash Table", "Matrix", "Prefix Sum"],          "source": ["Denny Zhang"]},
    {"id": 501,  "title": "Find Mode in Binary Search Tree",             "slug": "find-mode-in-binary-search-tree",                "difficulty": "Easy",   "tags": ["Tree", "DFS", "BST"],                                  "source": ["Denny Zhang"]},

    # ── Top 30 Graph Problem Types ────────────────────────────────────────────
    {"id": 463,  "title": "Island Perimeter",                            "slug": "island-perimeter",                               "difficulty": "Easy",   "tags": ["Array", "DFS", "BFS", "Matrix"],                       "source": ["Denny Zhang"]},
    {"id": 685,  "title": "Redundant Connection II",                     "slug": "redundant-connection-ii",                        "difficulty": "Hard",   "tags": ["DFS", "BFS", "Union Find", "Graph"],                   "source": ["Denny Zhang"]},
    {"id": 773,  "title": "Sliding Puzzle",                              "slug": "sliding-puzzle",                                 "difficulty": "Hard",   "tags": ["Array", "BFS", "Matrix"],                              "source": ["Denny Zhang"]},
    {"id": 126,  "title": "Word Ladder II",                              "slug": "word-ladder-ii",                                 "difficulty": "Hard",   "tags": ["Hash Table", "String", "Backtracking", "BFS"],          "source": ["Denny Zhang"]},
    {"id": 1036, "title": "Escape a Large Maze",                         "slug": "escape-a-large-maze",                            "difficulty": "Hard",   "tags": ["Array", "Hash Table", "DFS", "BFS"],                   "source": ["Denny Zhang"]},
    {"id": 1192, "title": "Critical Connections in a Network",           "slug": "critical-connections-in-a-network",              "difficulty": "Hard",   "tags": ["DFS", "Graph", "Biconnected Component"],               "source": ["Denny Zhang"]},
    {"id": 1138, "title": "Alphabet Board Path",                         "slug": "alphabet-board-path",                            "difficulty": "Medium", "tags": ["Hash Table", "String"],                                "source": ["Denny Zhang"]},
    {"id": 785,  "title": "Is Graph Bipartite?",                         "slug": "is-graph-bipartite",                             "difficulty": "Medium", "tags": ["DFS", "BFS", "Union Find", "Graph"],                   "source": ["Denny Zhang"]},
    {"id": 996,  "title": "Number of Squareful Arrays",                  "slug": "number-of-squareful-arrays",                     "difficulty": "Hard",   "tags": ["Array", "Math", "Dynamic Programming", "Backtracking"], "source": ["Denny Zhang"]},
    {"id": 1153, "title": "String Transforms Into Another String",       "slug": "string-transforms-into-another-string",          "difficulty": "Hard",   "tags": ["Hash Table", "String", "Union Find"],                  "source": ["Denny Zhang"]},

    # ── Top 25 Binary Search Problem Types ───────────────────────────────────
    {"id": 374,  "title": "Guess Number Higher or Lower",                "slug": "guess-number-higher-or-lower",                   "difficulty": "Easy",   "tags": ["Math", "Binary Search", "Interactive"],                "source": ["Denny Zhang"]},
    {"id": 1062, "title": "Longest Repeating Substring",                 "slug": "longest-repeating-substring",                    "difficulty": "Medium", "tags": ["String", "Binary Search", "Dynamic Programming", "Rolling Hash", "Suffix Array", "Hash Function"], "source": ["Denny Zhang"]},
    {"id": 34,   "title": "Find First and Last Position of Element in Sorted Array", "slug": "find-first-and-last-position-of-element-in-sorted-array", "difficulty": "Medium", "tags": ["Array", "Binary Search"],     "source": ["Denny Zhang"]},
    {"id": 852,  "title": "Peak Index in a Mountain Array",              "slug": "peak-index-in-a-mountain-array",                 "difficulty": "Medium", "tags": ["Array", "Binary Search"],                              "source": ["Denny Zhang"]},
    {"id": 69,   "title": "Sqrt(x)",                                     "slug": "sqrtx",                                          "difficulty": "Easy",   "tags": ["Math", "Binary Search"],                               "source": ["Denny Zhang"]},
    {"id": 774,  "title": "Minimize Max Distance to Gas Station",        "slug": "minimize-max-distance-to-gas-station",           "difficulty": "Hard",   "tags": ["Array", "Binary Search"],                              "source": ["Denny Zhang"]},
    {"id": 962,  "title": "Maximum Width Ramp",                          "slug": "maximum-width-ramp",                             "difficulty": "Medium", "tags": ["Array", "Stack", "Monotonic Stack"],                   "source": ["Denny Zhang"]},

    # ── Top 25 Dynamic Programming Types ─────────────────────────────────────
    {"id": 516,  "title": "Longest Palindromic Subsequence",             "slug": "longest-palindromic-subsequence",                "difficulty": "Medium", "tags": ["String", "Dynamic Programming"],                       "source": ["Denny Zhang"]},
    {"id": 115,  "title": "Distinct Subsequences",                       "slug": "distinct-subsequences",                          "difficulty": "Hard",   "tags": ["String", "Dynamic Programming"],                       "source": ["Denny Zhang"]},
    {"id": 576,  "title": "Out of Boundary Paths",                       "slug": "out-of-boundary-paths",                          "difficulty": "Medium", "tags": ["Dynamic Programming"],                                 "source": ["Denny Zhang"]},
    {"id": 10,   "title": "Regular Expression Matching",                 "slug": "regular-expression-matching",                    "difficulty": "Hard",   "tags": ["String", "Dynamic Programming", "Recursion"],          "source": ["Denny Zhang"]},
    {"id": 1000, "title": "Minimum Cost to Merge Stones",                "slug": "minimum-cost-to-merge-stones",                   "difficulty": "Hard",   "tags": ["Array", "Dynamic Programming"],                        "source": ["Denny Zhang"]},
    {"id": 312,  "title": "Burst Balloons",                              "slug": "burst-balloons",                                 "difficulty": "Hard",   "tags": ["Array", "Dynamic Programming"],                        "source": ["Denny Zhang"]},
    {"id": 309,  "title": "Best Time to Buy and Sell Stock with Cooldown", "slug": "best-time-to-buy-and-sell-stock-with-cooldown", "difficulty": "Medium", "tags": ["Array", "Dynamic Programming"],                     "source": ["Denny Zhang"]},
    {"id": 123,  "title": "Best Time to Buy and Sell Stock III",         "slug": "best-time-to-buy-and-sell-stock-iii",            "difficulty": "Hard",   "tags": ["Array", "Dynamic Programming"],                        "source": ["Denny Zhang"]},
    {"id": 64,   "title": "Minimum Path Sum",                            "slug": "minimum-path-sum",                               "difficulty": "Medium", "tags": ["Array", "Dynamic Programming", "Matrix"],              "source": ["Denny Zhang"]},
    {"id": 132,  "title": "Palindrome Partitioning II",                  "slug": "palindrome-partitioning-ii",                     "difficulty": "Hard",   "tags": ["String", "Dynamic Programming"],                       "source": ["Denny Zhang"]},

    # ── OO Design — Top 20 Systems ────────────────────────────────────────────
    {"id": 460,  "title": "LFU Cache",                                   "slug": "lfu-cache",                                      "difficulty": "Hard",   "tags": ["Hash Table", "Linked List", "Design", "Doubly-Linked List"], "source": ["Denny Zhang"]},
    {"id": 635,  "title": "Design Log Storage System",                   "slug": "design-log-storage-system",                      "difficulty": "Medium", "tags": ["Hash Table", "String", "Design", "Ordered Set"],       "source": ["Denny Zhang"]},
    {"id": 707,  "title": "Design Linked List",                          "slug": "design-linked-list",                             "difficulty": "Medium", "tags": ["Linked List", "Design"],                               "source": ["Denny Zhang"]},
    {"id": 716,  "title": "Max Stack",                                   "slug": "max-stack",                                      "difficulty": "Hard",   "tags": ["Stack", "Design", "Doubly-Linked List", "Ordered Set"], "source": ["Denny Zhang"]},
    {"id": 706,  "title": "Design HashMap",                              "slug": "design-hashmap",                                 "difficulty": "Easy",   "tags": ["Array", "Hash Table", "Linked List", "Design", "Hash Function"], "source": ["Denny Zhang"]},
    {"id": 622,  "title": "Design Circular Queue",                       "slug": "design-circular-queue",                          "difficulty": "Medium", "tags": ["Array", "Linked List", "Design", "Queue"],             "source": ["Denny Zhang"]},
    {"id": 307,  "title": "Range Sum Query - Mutable",                   "slug": "range-sum-query-mutable",                        "difficulty": "Medium", "tags": ["Array", "Design", "Binary Indexed Tree", "Segment Tree"], "source": ["Denny Zhang"]},
    {"id": 1166, "title": "Design File System",                          "slug": "design-file-system",                             "difficulty": "Medium", "tags": ["Hash Table", "String", "Design", "Trie"],              "source": ["Denny Zhang"]},
    {"id": 173,  "title": "Binary Search Tree Iterator",                 "slug": "binary-search-tree-iterator",                    "difficulty": "Medium", "tags": ["Stack", "Tree", "Design", "Binary Search Tree", "Iterator"], "source": ["Denny Zhang"]},
    {"id": 281,  "title": "Zigzag Iterator",                             "slug": "zigzag-iterator",                                "difficulty": "Medium", "tags": ["Array", "Design", "Queue", "Iterator"],                "source": ["Denny Zhang"]},
    {"id": 432,  "title": "All O'one Data Structure",                    "slug": "all-oone-data-structure",                        "difficulty": "Hard",   "tags": ["Hash Table", "Design", "Doubly-Linked List", "Linked List"], "source": ["Denny Zhang"]},
    {"id": 710,  "title": "Random Pick with Blacklist",                  "slug": "random-pick-with-blacklist",                     "difficulty": "Hard",   "tags": ["Array", "Hash Table", "Math", "Binary Search", "Sorting", "Randomized"], "source": ["Denny Zhang"]},
]

CODESIGNAL_21 = [
    {"id": 1534, "title": "Count Good Triplets",                     "slug": "count-good-triplets",                        "difficulty": "Easy",   "tags": ["Array", "Enumeration"],                  "source": ["CodeSignal"]},  # Find Occurrences variant
    {"id": 54,   "title": "Spiral Matrix",                           "slug": "spiral-matrix",                              "difficulty": "Medium", "tags": ["Array", "Matrix", "Simulation"],         "source": ["CodeSignal", "Grind 169"]},
    {"id": 128,  "title": "Longest Consecutive Sequence",            "slug": "longest-consecutive-sequence",               "difficulty": "Medium", "tags": ["Array", "Hash Table", "Union Find"],     "source": ["CodeSignal", "Grind 169"]},
    {"id": 59,   "title": "Spiral Matrix II",                        "slug": "spiral-matrix-ii",                           "difficulty": "Medium", "tags": ["Array", "Matrix", "Simulation"],         "source": ["CodeSignal"]},
    {"id": 454,  "title": "4Sum II",                                 "slug": "4sum-ii",                                    "difficulty": "Medium", "tags": ["Array", "Hash Table"],                   "source": ["CodeSignal"]},
    {"id": 48,   "title": "Rotate Image",                            "slug": "rotate-image",                               "difficulty": "Medium", "tags": ["Array", "Math", "Matrix"],               "source": ["CodeSignal", "Grind 169"]},
    {"id": 1010, "title": "Pairs of Songs With Total Durations Divisible by 60", "slug": "pairs-of-songs-with-total-durations-divisible-by-60", "difficulty": "Medium", "tags": ["Array", "Hash Table", "Counting"], "source": ["CodeSignal"]},
    {"id": 498,  "title": "Diagonal Traverse",                       "slug": "diagonal-traverse",                          "difficulty": "Medium", "tags": ["Array", "Matrix", "Simulation"],         "source": ["CodeSignal"]},
    {"id": 2131, "title": "Longest Palindrome by Concatenating Two Letter Words", "slug": "longest-palindrome-by-concatenating-two-letter-words", "difficulty": "Medium", "tags": ["Array", "Hash Table", "String", "Greedy", "Counting"], "source": ["CodeSignal"]},
    {"id": 566,  "title": "Reshape the Matrix",                      "slug": "reshape-the-matrix",                         "difficulty": "Easy",   "tags": ["Array", "Matrix", "Simulation"],         "source": ["CodeSignal"]},
    {"id": 954,  "title": "Array of Doubled Pairs",                  "slug": "array-of-doubled-pairs",                     "difficulty": "Medium", "tags": ["Array", "Hash Table", "Greedy", "Sorting"], "source": ["CodeSignal"]},
    {"id": 766,  "title": "Toeplitz Matrix",                         "slug": "toeplitz-matrix",                            "difficulty": "Easy",   "tags": ["Array", "Matrix"],                       "source": ["CodeSignal"]},
    {"id": 923,  "title": "3Sum With Multiplicity",                  "slug": "3sum-with-multiplicity",                     "difficulty": "Medium", "tags": ["Array", "Hash Table", "Two Pointers", "Sorting", "Counting"], "source": ["CodeSignal"]},
    {"id": 835,  "title": "Image Overlap",                           "slug": "image-overlap",                              "difficulty": "Medium", "tags": ["Array", "Matrix"],                       "source": ["CodeSignal"]},
    {"id": 1248, "title": "Count Number of Nice Subarrays",          "slug": "count-number-of-nice-subarrays",             "difficulty": "Medium", "tags": ["Array", "Hash Table", "Math", "Sliding Window", "Prefix Sum"], "source": ["CodeSignal"]},
    {"id": 2373, "title": "Largest Local Values in a Matrix",        "slug": "largest-local-values-in-a-matrix",           "difficulty": "Easy",   "tags": ["Array", "Matrix"],                       "source": ["CodeSignal"]},
    {"id": 532,  "title": "K-diff Pairs in an Array",                "slug": "k-diff-pairs-in-an-array",                   "difficulty": "Medium", "tags": ["Array", "Hash Table", "Two Pointers", "Binary Search", "Sorting"], "source": ["CodeSignal"]},
    {"id": 867,  "title": "Transpose Matrix",                        "slug": "transpose-matrix",                           "difficulty": "Easy",   "tags": ["Array", "Matrix", "Simulation"],         "source": ["CodeSignal"]},
    {"id": 1424, "title": "Diagonal Traverse II",                    "slug": "diagonal-traverse-ii",                       "difficulty": "Medium", "tags": ["Array", "Sorting", "Heap"],              "source": ["CodeSignal"]},
    {"id": 68,   "title": "Text Justification",                      "slug": "text-justification",                         "difficulty": "Hard",   "tags": ["Array", "String", "Simulation"],         "source": ["CodeSignal"]},
    {"id": 2563, "title": "Count the Number of Fair Pairs",          "slug": "count-the-number-of-fair-pairs",             "difficulty": "Medium", "tags": ["Array", "Two Pointers", "Binary Search", "Sorting"], "source": ["CodeSignal"]},
]

# ──────────────────────────────────────────────────────────────────────────────
# COMBINED & DE-DUPLICATED LIST (used by all scrapers)
# ──────────────────────────────────────────────────────────────────────────────

def _merge_sources(questions):
    """Merge duplicate IDs — combine their source lists."""
    seen = {}
    for q in questions:
        if q["id"] in seen:
            # Merge sources
            existing = seen[q["id"]]
            for src in q["source"]:
                if src not in existing["source"]:
                    existing["source"].append(src)
        else:
            seen[q["id"]] = dict(q)  # copy
    return sorted(seen.values(), key=lambda x: x["id"])


QUESTIONS = _merge_sources(GRIND_169 + DENNY_ZHANG + PREMIUM_98 + CODESIGNAL_21)


if __name__ == "__main__":
    g169_ids = {q["id"] for q in GRIND_169}
    dz_ids   = {q["id"] for q in DENNY_ZHANG}
    p98_ids  = {q["id"] for q in PREMIUM_98}
    cs_ids   = {q["id"] for q in CODESIGNAL_21}
    all_ids  = g169_ids | dz_ids | p98_ids | cs_ids

    print("=" * 50)
    print("  LeetMastery — Question Bank from your doc")
    print("=" * 50)
    print(f"  Part I  — Grind 169:             {len(GRIND_169)} entries")
    print(f"  Part II — Denny Zhang:           {len(DENNY_ZHANG)} entries ({len(dz_ids - g169_ids - p98_ids - cs_ids)} new unique)")
    print(f"  Part III — Premium 98:           {len(PREMIUM_98)} entries ({len(p98_ids - g169_ids - dz_ids - cs_ids)} new unique)")
    print(f"  Part IV — CodeSignal 21:         {len(CODESIGNAL_21)} entries ({len(cs_ids - g169_ids - dz_ids - p98_ids)} new unique)")
    print(f"\n  TOTAL UNIQUE QUESTIONS:          {len(QUESTIONS)}")
    print(f"  Appear in 2+ lists (merged):     {len([q for q in QUESTIONS if len(q['source']) > 1])}")
    print("=" * 50)

    from collections import Counter
    diff = Counter(q["difficulty"] for q in QUESTIONS)
    print(f"\n  Difficulty breakdown:")
    print(f"    Easy:   {diff['Easy']}")
    print(f"    Medium: {diff['Medium']}")
    print(f"    Hard:   {diff['Hard']}")

    print(f"\n  By source:")
    src_count = Counter()
    for q in QUESTIONS:
        for s in q["source"]:
            src_count[s] += 1
    for src, cnt in sorted(src_count.items()):
        print(f"    {src}: {cnt}")

    # Difficulty breakdown
    from collections import Counter
    diff = Counter(q["difficulty"] for q in QUESTIONS)
    print(f"\nDifficulty: Easy={diff['Easy']}  Medium={diff['Medium']}  Hard={diff['Hard']}")

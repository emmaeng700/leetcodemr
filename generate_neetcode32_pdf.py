"""
LeetMastery — NeetCode 150 "Not in 331" PDF
32 questions grouped by NeetCode category.
Real scraped Python solutions from WalkCC · LeetDoocs · SimplyLeet · LeetCode.ca
plus handcrafted brute-force/optimal, key insights, complexity, and a
Quick Review section at the end (from neetcodereview.json).

Usage:
  python3 generate_neetcode32_pdf.py

Output: LeetMastery_NeetCode32_NotIn331.pdf
        public/neetcodereview.json  (also written)
"""

import json, re
from pathlib import Path

# ── Import shared rendering helpers ───────────────────────────────────────────
from generate_patterns_pdf import (
    build_styles, code_flowable, safe_xml,
    hl_xml, tok_color,
    INDIGO, GRAY_500, GRAY_700, GRAY_100, CODE_BG,
    DIFF_COLORS, MAX_W,
    PRINT_BANNER_BG, PRINT_CODE_FG,
)

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_LG = "/System/Library/Fonts/LucidaGrande.ttc"
_MN = "/System/Library/Fonts/Menlo.ttc"
try:
    pdfmetrics.registerFont(TTFont("LG",        _LG, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("LG-Bold",   _LG, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("Menlo",      _MN, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Menlo-Bold", _MN, subfontIndex=1))
except Exception:
    pass   # already registered by generate_patterns_pdf import

SCRIPT_DIR    = Path(__file__).parent
OUTPUT_PDF    = SCRIPT_DIR / "LeetMastery_NeetCode32_NotIn331.pdf"
OUTPUT_PRINT  = SCRIPT_DIR / "LeetMastery_NeetCode32_NotIn331_Print.pdf"
JSON_OUT      = SCRIPT_DIR / "public" / "neetcodereview.json"
SITES_CACHE   = SCRIPT_DIR / ".nc32_sites_cache.json"

# ── Site metadata (label + accent color) ──────────────────────────────────────
SITES = [
    {"key": "walkccc",    "label": "WalkCC",      "color": "#3B82F6"},
    {"key": "doocs",      "label": "LeetDoocs",    "color": "#10B981"},
    {"key": "simplyleet", "label": "SimplyLeet",   "color": "#A855F7"},
    {"key": "leetcodeca", "label": "LeetCode.ca",  "color": "#F97316"},
]

# ── Category colors ────────────────────────────────────────────────────────────
CAT_COLORS = {
    "Sliding Window":          "#06B6D4",
    "Stack":                   "#F59E0B",
    "Binary Search":           "#F97316",
    "Linked List":             "#EC4899",
    "Trees":                   "#16A34A",
    "Heap / Priority Queue":   "#A855F7",
    "Backtracking":            "#F43F5E",
    "Graphs":                  "#EF4444",
    "Advanced Graphs":         "#7C3AED",
    "1-D Dynamic Programming": "#D946EF",
    "2-D Dynamic Programming": "#9333EA",
    "Greedy":                  "#22C55E",
    "Intervals":               "#0EA5E9",
    "Math & Geometry":         "#64748B",
    "Bit Manipulation":        "#0F172A",
}

# ── All 32 NC150 questions not in the 331-library ─────────────────────────────
NC32 = [

  # ── Sliding Window ───────────────────────────────────────────────────────
  { "id": 567, "title": "Permutation in String", "slug": "permutation-in-string",
    "difficulty": "Medium", "category": "Sliding Window",
    "key_insights": [
      "Fixed window of exactly len(s1); slide one char at a time over s2.",
      "Track character counts for s1 and the current window as two arrays of 26.",
      "When window counts == s1 counts, a permutation exists — return True.",
      "On each slide: add new right char, remove leftmost char, compare arrays.",
      "Time O(n), Space O(1) — only 26-element arrays regardless of input size.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(n·k) — check every window of size len(s1)
from collections import Counter
class Solution:
    def checkInclusion(self, s1: str, s2: str) -> bool:
        k = len(s1)
        need = Counter(s1)
        for i in range(len(s2) - k + 1):
            if Counter(s2[i:i + k]) == need:
                return True
        return False""",
    "optimal": """\
# Optimal O(n) — fixed sliding window with 26-element arrays
class Solution:
    def checkInclusion(self, s1: str, s2: str) -> bool:
        if len(s1) > len(s2): return False
        need = [0] * 26
        have = [0] * 26
        for c in s1:
            need[ord(c) - ord('a')] += 1
        k = len(s1)
        for i, c in enumerate(s2):
            have[ord(c) - ord('a')] += 1
            if i >= k:
                have[ord(s2[i - k]) - ord('a')] -= 1
            if i >= k - 1 and have == need:
                return True
        return False""",
  },

  # ── Stack ─────────────────────────────────────────────────────────────────
  { "id": 853, "title": "Car Fleet", "slug": "car-fleet",
    "difficulty": "Medium", "category": "Stack",
    "key_insights": [
      "Sort cars by position descending (closest to target first).",
      "Compute time for each car: time = (target - pos) / speed.",
      "A car catches the one ahead only if its time <= that car's time.",
      "Use a stack of arrival times; pop when a car merges into the fleet ahead.",
      "Number of remaining stacks = number of distinct fleets.",
    ],
    "complexity": "Time: O(n log n)  |  Space: O(n)",
    "brute": """\
# Brute Force O(n^2) — simulate merging for every pair
class Solution:
    def carFleet(self, target: int, position: list, speed: list) -> int:
        pairs = sorted(zip(position, speed), reverse=True)
        fleets = 0
        times = [(target - p) / s for p, s in pairs]
        i = 0
        while i < len(times):
            fleets += 1
            t = times[i]; i += 1
            while i < len(times) and times[i] <= t:
                i += 1
        return fleets""",
    "optimal": """\
# Optimal O(n log n) — monotonic stack of arrival times
class Solution:
    def carFleet(self, target: int, position: list, speed: list) -> int:
        pairs = sorted(zip(position, speed), reverse=True)
        stack = []
        for pos, spd in pairs:
            t = (target - pos) / spd
            if not stack or t > stack[-1]:
                stack.append(t)
        return len(stack)""",
  },

  # ── Binary Search ─────────────────────────────────────────────────────────
  { "id": 875, "title": "Koko Eating Bananas", "slug": "koko-eating-bananas",
    "difficulty": "Medium", "category": "Binary Search",
    "key_insights": [
      "Binary search on the answer space k (1 to max(piles)).",
      "For a given k, hours needed = sum(ceil(pile/k)) for each pile.",
      "The feasibility function is monotone: higher k always takes fewer hours.",
      "Use math.ceil(pile/k) == (pile + k - 1) // k to avoid floats.",
      "Time O(n log m) where m = max pile size.",
    ],
    "complexity": "Time: O(n log m)  |  Space: O(1)",
    "brute": """\
# Brute Force O(n·m) — try every k from 1 to max(piles)
import math
class Solution:
    def minEatingSpeed(self, piles: list, h: int) -> int:
        for k in range(1, max(piles) + 1):
            if sum(math.ceil(p / k) for p in piles) <= h:
                return k""",
    "optimal": """\
# Optimal O(n log m) — binary search on k
import math
class Solution:
    def minEatingSpeed(self, piles: list, h: int) -> int:
        lo, hi = 1, max(piles)
        while lo < hi:
            mid = (lo + hi) // 2
            if sum(math.ceil(p / mid) for p in piles) <= h:
                hi = mid
            else:
                lo = mid + 1
        return lo""",
  },

  # ── Linked List ───────────────────────────────────────────────────────────
  { "id": 138, "title": "Copy List with Random Pointer",
    "slug": "copy-list-with-random-pointer",
    "difficulty": "Medium", "category": "Linked List",
    "key_insights": [
      "Two-pass hashmap: first create all clones, then wire next and random.",
      "O(1)-space trick: interleave clone nodes into original list, wire randoms, split.",
      "Interleave: A -> A' -> B -> B' -> ... then A'.random = A.random.next.",
      "Always handle None safely before dereferencing random pointers.",
      "Final split restores both lists while keeping clones linked correctly.",
    ],
    "complexity": "Time: O(n)  |  Space: O(n) hashmap  /  O(1) interleave",
    "brute": """\
# Brute Force O(n) space — two-pass hashmap
class Solution:
    def copyRandomList(self, head):
        if not head: return None
        mapping = {}
        curr = head
        while curr:
            mapping[curr] = Node(curr.val)
            curr = curr.next
        curr = head
        while curr:
            if curr.next:   mapping[curr].next   = mapping[curr.next]
            if curr.random: mapping[curr].random = mapping[curr.random]
            curr = curr.next
        return mapping[head]""",
    "optimal": """\
# Optimal O(1) space — interleave clones, wire randoms, split
class Solution:
    def copyRandomList(self, head):
        if not head: return None
        curr = head
        while curr:
            clone = Node(curr.val)
            clone.next = curr.next
            curr.next  = clone
            curr = clone.next
        curr = head
        while curr:
            if curr.random:
                curr.next.random = curr.random.next
            curr = curr.next.next
        dummy = Node(0)
        clone_curr = dummy
        curr = head
        while curr:
            clone_curr.next = curr.next
            curr.next = curr.next.next
            clone_curr = clone_curr.next
            curr = curr.next
        return dummy.next""",
  },

  # ── Trees ─────────────────────────────────────────────────────────────────
  { "id": 1448, "title": "Count Good Nodes in Binary Tree",
    "slug": "count-good-nodes-in-binary-tree",
    "difficulty": "Medium", "category": "Trees",
    "key_insights": [
      "A node is 'good' if no node on the path from root to it has a greater value.",
      "DFS with a running max_val parameter; count node if node.val >= max_val.",
      "Preorder traversal — process root before children so max propagates down.",
      "Space is O(h) for recursion stack; O(n) worst case on skewed tree.",
      "Root is always good (no ancestor to compare against).",
    ],
    "complexity": "Time: O(n)  |  Space: O(h)",
    "brute": """\
# DFS — track running max on each root-to-node path
class Solution:
    def goodNodes(self, root) -> int:
        def dfs(node, max_val):
            if not node: return 0
            good = 1 if node.val >= max_val else 0
            new_max = max(max_val, node.val)
            return good + dfs(node.left, new_max) + dfs(node.right, new_max)
        return dfs(root, float('-inf'))""",
    "optimal": """\
# Optimal O(n) — iterative DFS with explicit stack
from collections import deque
class Solution:
    def goodNodes(self, root) -> int:
        count = 0
        stack = [(root, float('-inf'))]
        while stack:
            node, max_val = stack.pop()
            if not node: continue
            if node.val >= max_val:
                count += 1
            new_max = max(max_val, node.val)
            stack.append((node.left, new_max))
            stack.append((node.right, new_max))
        return count""",
  },

  # ── Heap / Priority Queue ─────────────────────────────────────────────────
  { "id": 703, "title": "Kth Largest Element in a Stream",
    "slug": "kth-largest-element-in-a-stream",
    "difficulty": "Easy", "category": "Heap / Priority Queue",
    "key_insights": [
      "Maintain a min-heap of exactly k elements.",
      "The heap's minimum (top) is always the kth largest seen so far.",
      "On add: push to heap, then pop if size > k.",
      "Initialization: heapify all nums, then trim to k elements.",
      "Time O(log k) per add — much better than sorting O(n log n) each time.",
    ],
    "complexity": "Time: O(log k) per add  |  Space: O(k)",
    "brute": """\
# Brute Force O(n log n) per add — sort entire list each time
class KthLargest:
    def __init__(self, k: int, nums: list):
        self.k = k; self.data = nums[:]
    def add(self, val: int) -> int:
        self.data.append(val)
        self.data.sort(reverse=True)
        return self.data[self.k - 1]""",
    "optimal": """\
# Optimal O(log k) per add — fixed-size min-heap
import heapq
class KthLargest:
    def __init__(self, k: int, nums: list):
        self.k = k
        self.heap = nums[:]
        heapq.heapify(self.heap)
        while len(self.heap) > k:
            heapq.heappop(self.heap)
    def add(self, val: int) -> int:
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]""",
  },

  { "id": 1046, "title": "Last Stone Weight", "slug": "last-stone-weight",
    "difficulty": "Easy", "category": "Heap / Priority Queue",
    "key_insights": [
      "Always smash the two heaviest stones — use a max-heap.",
      "Python's heapq is a min-heap; negate values to simulate max-heap.",
      "If y > x: push (y - x) back; if y == x: both destroyed.",
      "Repeat until at most one stone remains.",
      "Time O(n log n) total for all smash operations.",
    ],
    "complexity": "Time: O(n log n)  |  Space: O(n)",
    "brute": """\
# Brute Force O(n^2) — sort array on each iteration
class Solution:
    def lastStoneWeight(self, stones: list) -> int:
        stones = stones[:]
        while len(stones) > 1:
            stones.sort()
            y, x = stones.pop(), stones.pop()
            if y != x: stones.append(y - x)
        return stones[0] if stones else 0""",
    "optimal": """\
# Optimal O(n log n) — max-heap via negation
import heapq
class Solution:
    def lastStoneWeight(self, stones: list) -> int:
        heap = [-s for s in stones]
        heapq.heapify(heap)
        while len(heap) > 1:
            y = -heapq.heappop(heap)
            x = -heapq.heappop(heap)
            if y != x: heapq.heappush(heap, -(y - x))
        return -heap[0] if heap else 0""",
  },

  { "id": 355, "title": "Design Twitter", "slug": "design-twitter",
    "difficulty": "Medium", "category": "Heap / Priority Queue",
    "key_insights": [
      "Store tweets as (timestamp, tweetId) per user; use a global counter.",
      "followee set per user includes the user themselves for easy feed retrieval.",
      "getNewsFeed: collect recent tweets from all followees, merge with a max-heap.",
      "Push (−timestamp, tweetId, userId, tweet_index) to get newest first.",
      "Only need top 10 across all followees — heap merges efficiently.",
    ],
    "complexity": "Time: O(f·t + 10 log f) per getNewsFeed  |  Space: O(u·t)",
    "brute": """\
# Brute Force — collect all tweets, sort, return top 10
from collections import defaultdict
class Twitter:
    def __init__(self):
        self.tweets = defaultdict(list); self.follows = defaultdict(set); self.time = 0
    def postTweet(self, userId, tweetId):
        self.tweets[userId].append((self.time, tweetId)); self.time += 1
    def getNewsFeed(self, userId):
        self.follows[userId].add(userId)
        feed = []
        for fid in self.follows[userId]: feed.extend(self.tweets[fid])
        feed.sort(reverse=True)
        return [tid for _, tid in feed[:10]]
    def follow(self, f, fd): self.follows[f].add(fd)
    def unfollow(self, f, fd): self.follows[f].discard(fd)""",
    "optimal": """\
# Optimal — heap merge over followees' most-recent tweets
import heapq
from collections import defaultdict
class Twitter:
    def __init__(self):
        self.tweets = defaultdict(list); self.follows = defaultdict(set); self.time = 0
    def postTweet(self, userId, tweetId):
        self.tweets[userId].append((self.time, tweetId)); self.time += 1
    def getNewsFeed(self, userId):
        self.follows[userId].add(userId)
        heap, res = [], []
        for fid in self.follows[userId]:
            tw = self.tweets[fid]
            if tw:
                idx = len(tw) - 1
                t, tid = tw[idx]
                heapq.heappush(heap, (-t, tid, fid, idx))
        while heap and len(res) < 10:
            neg_t, tid, fid, idx = heapq.heappop(heap)
            res.append(tid)
            if idx > 0:
                idx -= 1
                t, tid2 = self.tweets[fid][idx]
                heapq.heappush(heap, (-t, tid2, fid, idx))
        return res
    def follow(self, f, fd): self.follows[f].add(fd)
    def unfollow(self, f, fd): self.follows[f].discard(fd)""",
  },

  # ── Backtracking ──────────────────────────────────────────────────────────
  { "id": 40, "title": "Combination Sum II", "slug": "combination-sum-ii",
    "difficulty": "Medium", "category": "Backtracking",
    "key_insights": [
      "Each candidate may only be used once (unlike Combination Sum I).",
      "Sort first so duplicate values are adjacent — makes deduplication easy.",
      "Skip candidates[i] if i > start and candidates[i] == candidates[i-1].",
      "Backtrack: add current, recurse with i+1 (not i) to avoid reuse.",
      "Prune early when remaining sum goes below zero.",
    ],
    "complexity": "Time: O(2^n)  |  Space: O(n)",
    "brute": """\
# Brute — generate all subsets, filter those summing to target
from itertools import combinations
class Solution:
    def combinationSum2(self, candidates: list, target: int) -> list:
        res = set()
        candidates.sort()
        for r in range(1, len(candidates) + 1):
            for combo in combinations(candidates, r):
                if sum(combo) == target: res.add(combo)
        return [list(c) for c in res]""",
    "optimal": """\
# Optimal — backtracking with sort + duplicate skip
class Solution:
    def combinationSum2(self, candidates: list, target: int) -> list:
        candidates.sort(); res = []
        def backtrack(start, remain, path):
            if remain == 0: res.append(list(path)); return
            for i in range(start, len(candidates)):
                if candidates[i] > remain: break
                if i > start and candidates[i] == candidates[i-1]: continue
                path.append(candidates[i])
                backtrack(i + 1, remain - candidates[i], path)
                path.pop()
        backtrack(0, target, [])
        return res""",
  },

  { "id": 131, "title": "Palindrome Partitioning", "slug": "palindrome-partitioning",
    "difficulty": "Medium", "category": "Backtracking",
    "key_insights": [
      "Try every prefix of the remaining string; if it's a palindrome, recurse on the suffix.",
      "Precompute palindrome table: is_pal[i][j] in O(n^2) to speed up checks.",
      "Backtracking: append palindrome prefix to path, recurse, pop on return.",
      "Base case: start == len(s) means entire string partitioned — save path.",
      "Time O(n * 2^n) — at most 2^(n-1) partitions, each checked in O(n).",
    ],
    "complexity": "Time: O(n * 2^n)  |  Space: O(n^2)",
    "brute": """\
# Brute Force — backtrack with inline palindrome check
class Solution:
    def partition(self, s: str) -> list:
        res = []
        def backtrack(start, path):
            if start == len(s): res.append(list(path)); return
            for end in range(start + 1, len(s) + 1):
                part = s[start:end]
                if part == part[::-1]:
                    path.append(part); backtrack(end, path); path.pop()
        backtrack(0, [])
        return res""",
    "optimal": """\
# Optimal — precompute palindrome DP table, then backtrack
class Solution:
    def partition(self, s: str) -> list:
        n = len(s)
        dp = [[False]*n for _ in range(n)]
        for i in range(n): dp[i][i] = True
        for length in range(2, n+1):
            for i in range(n - length + 1):
                j = i + length - 1
                dp[i][j] = (s[i] == s[j]) if length == 2 else (s[i] == s[j] and dp[i+1][j-1])
        res = []
        def backtrack(start, path):
            if start == n: res.append(list(path)); return
            for end in range(start, n):
                if dp[start][end]:
                    path.append(s[start:end+1]); backtrack(end+1, path); path.pop()
        backtrack(0, [])
        return res""",
  },

  # ── Graphs ────────────────────────────────────────────────────────────────
  { "id": 684, "title": "Redundant Connection", "slug": "redundant-connection",
    "difficulty": "Medium", "category": "Graphs",
    "key_insights": [
      "Union-Find: maintain parent and rank arrays for n nodes.",
      "For each edge (u, v): if find(u) == find(v), this edge creates a cycle.",
      "Otherwise union(u, v) to merge their sets.",
      "Last redundant edge (first cycle-creating edge) is the answer.",
      "Path compression + union by rank gives near-O(1) per operation.",
    ],
    "complexity": "Time: O(n · alpha(n))  |  Space: O(n)",
    "brute": """\
# Brute Force O(n^2) — remove each edge, check if graph stays connected
from collections import defaultdict, deque
class Solution:
    def findRedundantConnection(self, edges: list) -> list:
        def connected(edges, n):
            g = defaultdict(list)
            for u, v in edges: g[u].append(v); g[v].append(u)
            visited, q = set(), deque([1])
            while q:
                node = q.popleft()
                if node in visited: continue
                visited.add(node); q.extend(g[node])
            return len(visited) == n
        n = len(edges)
        for i in range(n-1, -1, -1):
            if connected(edges[:i] + edges[i+1:], n): return edges[i]""",
    "optimal": """\
# Optimal — Union-Find with path compression + rank
class Solution:
    def findRedundantConnection(self, edges: list) -> list:
        n = len(edges)
        parent = list(range(n + 1)); rank = [0] * (n + 1)
        def find(x):
            while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
            return x
        def union(x, y):
            rx, ry = find(x), find(y)
            if rx == ry: return False
            if rank[rx] < rank[ry]: rx, ry = ry, rx
            parent[ry] = rx
            if rank[rx] == rank[ry]: rank[rx] += 1
            return True
        for u, v in edges:
            if not union(u, v): return [u, v]""",
  },

  # ── Advanced Graphs ───────────────────────────────────────────────────────
  { "id": 743, "title": "Network Delay Time", "slug": "network-delay-time",
    "difficulty": "Medium", "category": "Advanced Graphs",
    "key_insights": [
      "Dijkstra's algorithm from source node k to all other nodes.",
      "Use a min-heap (dist, node); relax edges greedily.",
      "After Dijkstra, answer = max(dist.values()); return -1 if any unreachable.",
      "Build adjacency list: graph[u].append((v, w)).",
      "Time O(E log V) with heap; Bellman-Ford O(VE) also works.",
    ],
    "complexity": "Time: O(E log V)  |  Space: O(V + E)",
    "brute": """\
# Brute Force O(V·E) — Bellman-Ford (relax all edges V-1 times)
class Solution:
    def networkDelayTime(self, times: list, n: int, k: int) -> int:
        dist = {i: float('inf') for i in range(1, n+1)}; dist[k] = 0
        for _ in range(n - 1):
            for u, v, w in times:
                if dist[u] + w < dist[v]: dist[v] = dist[u] + w
        res = max(dist.values())
        return res if res < float('inf') else -1""",
    "optimal": """\
# Optimal O(E log V) — Dijkstra with min-heap
import heapq
from collections import defaultdict
class Solution:
    def networkDelayTime(self, times: list, n: int, k: int) -> int:
        graph = defaultdict(list)
        for u, v, w in times: graph[u].append((v, w))
        dist = {}; heap = [(0, k)]
        while heap:
            d, node = heapq.heappop(heap)
            if node in dist: continue
            dist[node] = d
            for nei, w in graph[node]:
                if nei not in dist: heapq.heappush(heap, (d + w, nei))
        return max(dist.values()) if len(dist) == n else -1""",
  },

  { "id": 332, "title": "Reconstruct Itinerary", "slug": "reconstruct-itinerary",
    "difficulty": "Hard", "category": "Advanced Graphs",
    "key_insights": [
      "Eulerian path problem: visit every edge exactly once starting from JFK.",
      "Sort adjacency lists lexicographically so we greedily pick smallest dest.",
      "Hierholzer's algorithm: DFS, append to result only when backtracking.",
      "Reverse result at end — appended in reverse Eulerian order.",
      "If stuck before using all edges, the recursive DFS handles this automatically.",
    ],
    "complexity": "Time: O(E log E)  |  Space: O(E)",
    "brute": """\
# DFS backtracking (iterative Hierholzer)
from collections import defaultdict
class Solution:
    def findItinerary(self, tickets: list) -> list:
        graph = defaultdict(list)
        for src, dst in sorted(tickets): graph[src].append(dst)
        result = []; stack = ["JFK"]
        while stack:
            while graph[stack[-1]]:
                stack.append(graph[stack[-1]].pop(0))
            result.append(stack.pop())
        return result[::-1]""",
    "optimal": """\
# Optimal O(E log E) — Hierholzer with sorted adjacency lists
from collections import defaultdict
class Solution:
    def findItinerary(self, tickets: list) -> list:
        graph = defaultdict(list)
        for src, dst in tickets: graph[src].append(dst)
        for src in graph: graph[src].sort(reverse=True)
        result = []; stack = ["JFK"]
        while stack:
            while graph[stack[-1]]:
                stack.append(graph[stack[-1]].pop())
            result.append(stack.pop())
        return result[::-1]""",
  },

  { "id": 1584, "title": "Min Cost to Connect All Points",
    "slug": "min-cost-to-connect-all-points",
    "difficulty": "Medium", "category": "Advanced Graphs",
    "key_insights": [
      "Minimum Spanning Tree on a complete graph where edge cost = Manhattan distance.",
      "Prim's: start from any node; grow MST by adding cheapest reachable edge.",
      "Maintain min-heap of (cost, node); skip already-visited nodes.",
      "O(n^2 log n) — every point connects to every other; n^2 edges total.",
      "Kruskal's works too but Prim's avoids sorting all O(n^2) edges upfront.",
    ],
    "complexity": "Time: O(n^2 log n)  |  Space: O(n^2)",
    "brute": """\
# Brute Force — Kruskal: generate all edges, sort, union-find
class Solution:
    def minCostConnectPoints(self, points: list) -> int:
        n = len(points); edges = []
        for i in range(n):
            for j in range(i+1, n):
                d = abs(points[i][0]-points[j][0]) + abs(points[i][1]-points[j][1])
                edges.append((d, i, j))
        edges.sort(); parent = list(range(n))
        def find(x):
            while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
            return x
        cost = used = 0
        for d, u, v in edges:
            ru, rv = find(u), find(v)
            if ru != rv: parent[ru] = rv; cost += d; used += 1
            if used == n-1: break
        return cost""",
    "optimal": """\
# Optimal O(n^2 log n) — Prim's with min-heap
import heapq
class Solution:
    def minCostConnectPoints(self, points: list) -> int:
        n = len(points); visited = set(); heap = [(0, 0)]; total = 0
        while len(visited) < n:
            cost, i = heapq.heappop(heap)
            if i in visited: continue
            visited.add(i); total += cost
            for j in range(n):
                if j not in visited:
                    d = abs(points[i][0]-points[j][0]) + abs(points[i][1]-points[j][1])
                    heapq.heappush(heap, (d, j))
        return total""",
  },

  { "id": 778, "title": "Swim in Rising Water", "slug": "swim-in-rising-water",
    "difficulty": "Hard", "category": "Advanced Graphs",
    "key_insights": [
      "Find path from (0,0) to (n-1,n-1) minimising the maximum elevation crossed.",
      "Dijkstra where 'cost' = max elevation on path (not sum).",
      "Relax: new_cost = max(dist[curr], grid[nr][nc]).",
      "Min-heap gives the path with smallest bottleneck elevation first.",
      "Binary search + BFS/DFS is an alternative O(n^2 log n) approach.",
    ],
    "complexity": "Time: O(n^2 log n)  |  Space: O(n^2)",
    "brute": """\
# Brute Force — binary search on answer t; BFS to check reachability
from collections import deque
class Solution:
    def swimInWater(self, grid: list) -> int:
        n = len(grid)
        def can_reach(t):
            if grid[0][0] > t: return False
            visited = {(0,0)}; q = deque([(0,0)])
            while q:
                r, c = q.popleft()
                if r == n-1 and c == n-1: return True
                for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:
                    nr, nc = r+dr, c+dc
                    if 0<=nr<n and 0<=nc<n and (nr,nc) not in visited and grid[nr][nc]<=t:
                        visited.add((nr,nc)); q.append((nr,nc))
            return False
        lo, hi = grid[0][0], n*n-1
        while lo < hi:
            mid = (lo+hi)//2
            if can_reach(mid): hi = mid
            else: lo = mid+1
        return lo""",
    "optimal": """\
# Optimal — Dijkstra with min-max cost
import heapq
class Solution:
    def swimInWater(self, grid: list) -> int:
        n = len(grid)
        dist = [[float('inf')]*n for _ in range(n)]
        dist[0][0] = grid[0][0]; heap = [(grid[0][0], 0, 0)]
        while heap:
            cost, r, c = heapq.heappop(heap)
            if cost > dist[r][c]: continue
            if r == n-1 and c == n-1: return cost
            for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:
                nr, nc = r+dr, c+dc
                if 0 <= nr < n and 0 <= nc < n:
                    new_cost = max(cost, grid[nr][nc])
                    if new_cost < dist[nr][nc]:
                        dist[nr][nc] = new_cost
                        heapq.heappush(heap, (new_cost, nr, nc))
        return dist[n-1][n-1]""",
  },

  # ── 1-D Dynamic Programming ───────────────────────────────────────────────
  { "id": 746, "title": "Min Cost Climbing Stairs", "slug": "min-cost-climbing-stairs",
    "difficulty": "Easy", "category": "1-D Dynamic Programming",
    "key_insights": [
      "dp[i] = minimum total cost to reach step i (0-indexed).",
      "dp[i] = cost[i] + min(dp[i-1], dp[i-2]).",
      "You can start at step 0 or step 1 (both valid entry points).",
      "Answer = min(dp[n-1], dp[n-2]) — you can step past the last stair.",
      "Compress to O(1) space by keeping only last two dp values.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(2^n) — pure recursion without memoisation
class Solution:
    def minCostClimbingStairs(self, cost: list) -> int:
        n = len(cost)
        def dfs(i):
            if i >= n: return 0
            return cost[i] + min(dfs(i+1), dfs(i+2))
        return min(dfs(0), dfs(1))""",
    "optimal": """\
# Optimal O(n) time O(1) space — two-variable DP
class Solution:
    def minCostClimbingStairs(self, cost: list) -> int:
        a, b = 0, 0
        for i in range(len(cost) - 1, -1, -1):
            curr = cost[i] + min(a, b); a, b = curr, a
        return min(a, b)""",
  },

  { "id": 213, "title": "House Robber II", "slug": "house-robber-ii",
    "difficulty": "Medium", "category": "1-D Dynamic Programming",
    "key_insights": [
      "Houses arranged in a circle: first and last cannot both be robbed.",
      "Split into two linear subproblems: houses[0..n-2] and houses[1..n-1].",
      "Run standard House Robber on each subarray; answer = max of both.",
      "Standard robber: dp[i] = max(dp[i-1], nums[i] + dp[i-2]).",
      "Edge case: n == 1 → return nums[0] directly.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(2^n) — recursive without memoisation
class Solution:
    def rob(self, nums: list) -> int:
        if len(nums) == 1: return nums[0]
        def rob_range(arr):
            def recurse(i):
                if i >= len(arr): return 0
                return max(arr[i] + recurse(i+2), recurse(i+1))
            return recurse(0)
        return max(rob_range(nums[:-1]), rob_range(nums[1:]))""",
    "optimal": """\
# Optimal O(n) time O(1) space — two linear passes
class Solution:
    def rob(self, nums: list) -> int:
        if len(nums) == 1: return nums[0]
        def rob_range(arr):
            a, b = 0, 0
            for n in arr: a, b = b, max(b, a + n)
            return b
        return max(rob_range(nums[:-1]), rob_range(nums[1:]))""",
  },

  { "id": 647, "title": "Palindromic Substrings", "slug": "palindromic-substrings",
    "difficulty": "Medium", "category": "1-D Dynamic Programming",
    "key_insights": [
      "Expand around every center: n odd-length centers and n-1 even-length centers.",
      "For each center, expand outward while chars match; count each valid palindrome.",
      "Total centers = 2n-1; each expansion is O(n) worst case → O(n^2) overall.",
      "O(1) space vs O(n^2) DP table — expansion is cleaner and equivalent.",
      "Manacher's algorithm achieves O(n) but overkill for interviews.",
    ],
    "complexity": "Time: O(n^2)  |  Space: O(1)",
    "brute": """\
# Brute Force O(n^3) — check every substring
class Solution:
    def countSubstrings(self, s: str) -> int:
        count = 0
        for i in range(len(s)):
            for j in range(i+1, len(s)+1):
                sub = s[i:j]
                if sub == sub[::-1]: count += 1
        return count""",
    "optimal": """\
# Optimal O(n^2) — expand around every center
class Solution:
    def countSubstrings(self, s: str) -> int:
        def expand(l, r):
            count = 0
            while l >= 0 and r < len(s) and s[l] == s[r]:
                count += 1; l -= 1; r += 1
            return count
        total = 0
        for i in range(len(s)):
            total += expand(i, i)    # odd
            total += expand(i, i+1)  # even
        return total""",
  },

  # ── 2-D Dynamic Programming ───────────────────────────────────────────────
  { "id": 518, "title": "Coin Change II", "slug": "coin-change-ii",
    "difficulty": "Medium", "category": "2-D Dynamic Programming",
    "key_insights": [
      "dp[a] = number of combinations to make amount a.",
      "For each coin, update dp[a] += dp[a - coin] for a from coin to amount.",
      "Process each coin completely before moving to next (avoid overcounting permutations).",
      "dp[0] = 1 (one way to make 0: use no coins).",
      "Outer loop over coins, inner over amounts — avoids counting permutations.",
    ],
    "complexity": "Time: O(amount * n)  |  Space: O(amount)",
    "brute": """\
# Brute Force O(2^amount) — pure recursion
class Solution:
    def change(self, amount: int, coins: list) -> int:
        def dfs(remaining, idx):
            if remaining == 0: return 1
            if remaining < 0 or idx == len(coins): return 0
            return dfs(remaining - coins[idx], idx) + dfs(remaining, idx + 1)
        return dfs(amount, 0)""",
    "optimal": """\
# Optimal O(amount * n) — 1D DP, outer = coins, inner = amounts
class Solution:
    def change(self, amount: int, coins: list) -> int:
        dp = [0] * (amount + 1); dp[0] = 1
        for coin in coins:
            for a in range(coin, amount + 1): dp[a] += dp[a - coin]
        return dp[amount]""",
  },

  { "id": 494, "title": "Target Sum", "slug": "target-sum",
    "difficulty": "Medium", "category": "2-D Dynamic Programming",
    "key_insights": [
      "Assign + or - to each number; count assignments yielding target.",
      "DFS with memo: state = (index, current_sum).",
      "Math shortcut: P - (total-P) = target → P = (total+target)/2.",
      "Reduces to 'count subsets summing to P' — standard 0/1 knapsack.",
      "If (total+target) is odd or target > total → 0 ways.",
    ],
    "complexity": "Time: O(n * total)  |  Space: O(n * total)",
    "brute": """\
# Brute Force O(2^n) — try all +/- assignments
class Solution:
    def findTargetSumWays(self, nums: list, target: int) -> int:
        def dfs(i, curr):
            if i == len(nums): return 1 if curr == target else 0
            return dfs(i+1, curr+nums[i]) + dfs(i+1, curr-nums[i])
        return dfs(0, 0)""",
    "optimal": """\
# Optimal O(n * total) — DP dict (sum -> ways)
class Solution:
    def findTargetSumWays(self, nums: list, target: int) -> int:
        dp = {0: 1}
        for n in nums:
            new_dp = {}
            for curr_sum, ways in dp.items():
                new_dp[curr_sum + n] = new_dp.get(curr_sum + n, 0) + ways
                new_dp[curr_sum - n] = new_dp.get(curr_sum - n, 0) + ways
            dp = new_dp
        return dp.get(target, 0)""",
  },

  { "id": 97, "title": "Interleaving String", "slug": "interleaving-string",
    "difficulty": "Medium", "category": "2-D Dynamic Programming",
    "key_insights": [
      "dp[i][j] = True if s1[:i] and s2[:j] can interleave to form s3[:i+j].",
      "Transition: dp[i][j] = (dp[i-1][j] and s1[i-1]==s3[i+j-1]) or (dp[i][j-1] and s2[j-1]==s3[i+j-1]).",
      "Base case: dp[0][0] = True.",
      "Can optimize to O(n) space using a 1D rolling array.",
      "Early return: if len(s1)+len(s2) != len(s3), always False.",
    ],
    "complexity": "Time: O(m * n)  |  Space: O(n)  [rolling array]",
    "brute": """\
# Brute Force O(2^(m+n)) — recursion without memoisation
class Solution:
    def isInterleave(self, s1: str, s2: str, s3: str) -> bool:
        if len(s1) + len(s2) != len(s3): return False
        def dfs(i, j, k):
            if k == len(s3): return True
            if i < len(s1) and s1[i] == s3[k] and dfs(i+1, j, k+1): return True
            if j < len(s2) and s2[j] == s3[k] and dfs(i, j+1, k+1): return True
            return False
        return dfs(0, 0, 0)""",
    "optimal": """\
# Optimal O(m*n) — 2D DP (rolling 1D array)
class Solution:
    def isInterleave(self, s1: str, s2: str, s3: str) -> bool:
        m, n = len(s1), len(s2)
        if m + n != len(s3): return False
        dp = [False] * (n + 1); dp[0] = True
        for j in range(1, n+1): dp[j] = dp[j-1] and s2[j-1] == s3[j-1]
        for i in range(1, m+1):
            dp[0] = dp[0] and s1[i-1] == s3[i-1]
            for j in range(1, n+1):
                dp[j] = ((dp[j]   and s1[i-1] == s3[i+j-1]) or
                          (dp[j-1] and s2[j-1] == s3[i+j-1]))
        return dp[n]""",
  },

  # ── Greedy ────────────────────────────────────────────────────────────────
  { "id": 45, "title": "Jump Game II", "slug": "jump-game-ii",
    "difficulty": "Medium", "category": "Greedy",
    "key_insights": [
      "Greedy: make the fewest jumps by always jumping as far as possible.",
      "Track 'farthest' reachable from current range and 'end' of current jump.",
      "When i reaches 'end': increment jumps, set end = farthest.",
      "Never need to actually jump — just count how many range expansions occur.",
      "Guaranteed to reach last index (per problem constraints).",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(n^2) — BFS layer by layer
from collections import deque
class Solution:
    def jump(self, nums: list) -> int:
        n = len(nums)
        if n == 1: return 0
        dist = [-1] * n; dist[0] = 0; q = deque([0])
        while q:
            i = q.popleft()
            for j in range(i+1, min(i+nums[i]+1, n)):
                if dist[j] == -1:
                    dist[j] = dist[i] + 1
                    if j == n-1: return dist[j]
                    q.append(j)
        return dist[n-1]""",
    "optimal": """\
# Optimal O(n) — greedy range expansion
class Solution:
    def jump(self, nums: list) -> int:
        jumps = farthest = end = 0
        for i in range(len(nums) - 1):
            farthest = max(farthest, i + nums[i])
            if i == end: jumps += 1; end = farthest
        return jumps""",
  },

  { "id": 846, "title": "Hand of Straights", "slug": "hand-of-straights",
    "difficulty": "Medium", "category": "Greedy",
    "key_insights": [
      "If len(hand) % groupSize != 0: impossible immediately.",
      "Count frequencies; iterate sorted unique keys.",
      "For each smallest remaining card, try to form a group of groupSize consecutive cards.",
      "Decrement counts greedily; if any required card has count 0, return False.",
      "Time O(n log n) due to sorting.",
    ],
    "complexity": "Time: O(n log n)  |  Space: O(n)",
    "brute": """\
# Brute Force O(n^2) — repeatedly find and remove groups
class Solution:
    def isNStraightHand(self, hand: list, groupSize: int) -> bool:
        if len(hand) % groupSize: return False
        hand = sorted(hand)
        while hand:
            start = hand[0]
            for i in range(groupSize):
                try: hand.remove(start + i)
                except ValueError: return False
        return True""",
    "optimal": """\
# Optimal O(n log n) — Counter + sorted keys
from collections import Counter
class Solution:
    def isNStraightHand(self, hand: list, groupSize: int) -> bool:
        if len(hand) % groupSize: return False
        count = Counter(hand)
        for card in sorted(count):
            n = count[card]
            if n > 0:
                for i in range(groupSize):
                    count[card + i] -= n
                    if count[card + i] < 0: return False
        return True""",
  },

  { "id": 1899, "title": "Merge Triplets to Form Target Triplet",
    "slug": "merge-triplets-to-form-target-triplet",
    "difficulty": "Medium", "category": "Greedy",
    "key_insights": [
      "Merging = taking element-wise maximum of selected triplets.",
      "A triplet is valid only if none of its elements exceed the corresponding target.",
      "Invalid triplets can only hurt: they'd force some element above target.",
      "From valid triplets, take element-wise max — check if it equals target.",
      "O(n) single pass: filter invalid, accumulate max, compare to target.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(2^n) — try all subsets of triplets
class Solution:
    def mergeTriplets(self, triplets: list, target: list) -> bool:
        for mask in range(1, 1 << len(triplets)):
            merged = [0, 0, 0]
            for i in range(len(triplets)):
                if mask & (1 << i): merged = [max(merged[j], triplets[i][j]) for j in range(3)]
            if merged == target: return True
        return False""",
    "optimal": """\
# Optimal O(n) — filter invalid triplets, take element-wise max
class Solution:
    def mergeTriplets(self, triplets: list, target: list) -> bool:
        res = [0, 0, 0]
        for t in triplets:
            if t[0] <= target[0] and t[1] <= target[1] and t[2] <= target[2]:
                res = [max(res[i], t[i]) for i in range(3)]
        return res == target""",
  },

  { "id": 763, "title": "Partition Labels", "slug": "partition-labels",
    "difficulty": "Medium", "category": "Greedy",
    "key_insights": [
      "Each letter must appear in exactly one partition.",
      "Precompute last occurrence of every character.",
      "Greedily extend current partition's end to max(end, last[char]).",
      "When index reaches end: partition complete, append size, start new one.",
      "O(n) time — single pass after O(n) precomputation.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(n^2) — validate each possible cut point
class Solution:
    def partitionLabels(self, s: str) -> list:
        res, start = [], 0
        for i in range(len(s)):
            seen = set(s[start:i+1])
            if all(s.rfind(c) < i+1 for c in seen):
                res.append(i - start + 1); start = i + 1
        return res""",
    "optimal": """\
# Optimal O(n) — last occurrence + greedy extend
class Solution:
    def partitionLabels(self, s: str) -> list:
        last = {c: i for i, c in enumerate(s)}
        res = []; start = end = 0
        for i, c in enumerate(s):
            end = max(end, last[c])
            if i == end: res.append(end - start + 1); start = end + 1
        return res""",
  },

  { "id": 678, "title": "Valid Parenthesis String", "slug": "valid-parenthesis-string",
    "difficulty": "Medium", "category": "Greedy",
    "key_insights": [
      "Track a range [lo, hi] of possible open parenthesis counts.",
      "'(' → lo+1, hi+1; ')' → lo-1, hi-1; '*' → lo-1, hi+1 (clamp lo to 0).",
      "If hi < 0: too many ')' — impossible, return False.",
      "Clamp lo to 0 (open count can't be negative).",
      "Valid if lo == 0 at the end.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force O(3^n) — try all replacements of '*'
class Solution:
    def checkValidString(self, s: str) -> bool:
        def valid(s):
            bal = 0
            for c in s:
                if c == '(': bal += 1
                elif c == ')': bal -= 1;
                if bal < 0: return False
            return bal == 0
        def dfs(i, curr):
            if i == len(s): return valid(curr)
            if s[i] != '*': return dfs(i+1, curr+s[i])
            return dfs(i+1, curr+'(') or dfs(i+1, curr+')') or dfs(i+1, curr)
        return dfs(0, '')""",
    "optimal": """\
# Optimal O(n) — track range [lo, hi] of open counts
class Solution:
    def checkValidString(self, s: str) -> bool:
        lo = hi = 0
        for c in s:
            if c == '(':   lo += 1; hi += 1
            elif c == ')': lo -= 1; hi -= 1
            else:          lo -= 1; hi += 1
            if hi < 0: return False
            lo = max(lo, 0)
        return lo == 0""",
  },

  # ── Intervals ─────────────────────────────────────────────────────────────
  { "id": 1851, "title": "Minimum Interval to Include Each Query",
    "slug": "minimum-interval-to-include-each-query",
    "difficulty": "Hard", "category": "Intervals",
    "key_insights": [
      "Sort intervals by start; sort queries (keeping original indices).",
      "Sweep queries left to right; add all intervals whose start <= query to heap.",
      "Heap stores (size, end) — smallest interval size on top.",
      "Pop expired intervals (end < query) before reading the answer.",
      "If heap empty after pops: answer is -1 for this query.",
    ],
    "complexity": "Time: O((n+q) log n)  |  Space: O(n + q)",
    "brute": """\
# Brute Force O(n*q) — for each query check all intervals
class Solution:
    def minInterval(self, intervals: list, queries: list) -> list:
        res = []
        for q in queries:
            best = -1
            for l, r in intervals:
                if l <= q <= r:
                    size = r - l + 1
                    if best == -1 or size < best: best = size
            res.append(best)
        return res""",
    "optimal": """\
# Optimal O((n+q) log n) — sort + min-heap sweep
import heapq
class Solution:
    def minInterval(self, intervals: list, queries: list) -> list:
        intervals.sort()
        indexed_q = sorted(enumerate(queries), key=lambda x: x[1])
        res = [-1] * len(queries); heap = []; i = 0
        for orig_idx, q in indexed_q:
            while i < len(intervals) and intervals[i][0] <= q:
                l, r = intervals[i]; heapq.heappush(heap, (r - l + 1, r)); i += 1
            while heap and heap[0][1] < q: heapq.heappop(heap)
            if heap: res[orig_idx] = heap[0][0]
        return res""",
  },

  # ── Math & Geometry ───────────────────────────────────────────────────────
  { "id": 202, "title": "Happy Number", "slug": "happy-number",
    "difficulty": "Easy", "category": "Math & Geometry",
    "key_insights": [
      "Sum of squares of digits; repeat until 1 or cycle detected.",
      "Use a seen set — if we revisit a number it's an infinite loop.",
      "Floyd's cycle detection: slow (one step) and fast (two steps) pointers.",
      "For any unhappy number, the cycle always passes through 4.",
      "O(log n) per step — number of digits decreases rapidly.",
    ],
    "complexity": "Time: O(log n)  |  Space: O(log n)  [O(1) with Floyd's]",
    "brute": """\
# Brute Force — set to detect cycle
class Solution:
    def isHappy(self, n: int) -> bool:
        def digit_sq_sum(x): return sum(int(d)**2 for d in str(x))
        seen = set()
        while n != 1:
            if n in seen: return False
            seen.add(n); n = digit_sq_sum(n)
        return True""",
    "optimal": """\
# Optimal O(1) space — Floyd's cycle detection
class Solution:
    def isHappy(self, n: int) -> bool:
        def step(x): return sum(int(d)**2 for d in str(x))
        slow, fast = n, step(n)
        while fast != 1 and slow != fast:
            slow = step(slow); fast = step(step(fast))
        return fast == 1""",
  },

  { "id": 66, "title": "Plus One", "slug": "plus-one",
    "difficulty": "Easy", "category": "Math & Geometry",
    "key_insights": [
      "Traverse from right; if digit < 9, increment and return.",
      "If digit == 9, set to 0 and carry over to next position.",
      "If all digits are 9 (e.g. [9,9,9]): array becomes all 0s, prepend 1.",
      "No need to convert to integer — handle carry in place.",
      "O(n) time, O(1) extra space.",
    ],
    "complexity": "Time: O(n)  |  Space: O(1)",
    "brute": """\
# Brute Force — convert to int, add 1, convert back
class Solution:
    def plusOne(self, digits: list) -> list:
        return [int(d) for d in str(int(''.join(map(str, digits))) + 1)]""",
    "optimal": """\
# Optimal O(n) — in-place carry propagation
class Solution:
    def plusOne(self, digits: list) -> list:
        for i in range(len(digits) - 1, -1, -1):
            if digits[i] < 9: digits[i] += 1; return digits
            digits[i] = 0
        return [1] + digits""",
  },

  { "id": 43, "title": "Multiply Strings", "slug": "multiply-strings",
    "difficulty": "Medium", "category": "Math & Geometry",
    "key_insights": [
      "Digits at positions i and j contribute to result positions i+j and i+j+1.",
      "Allocate result array of length m+n; multiply each pair of digits.",
      "Propagate carries from right to left after all multiplications.",
      "Trim leading zeros; return '0' if result is all zeros.",
      "Avoids overflow — works entirely in integer digit arithmetic.",
    ],
    "complexity": "Time: O(m * n)  |  Space: O(m + n)",
    "brute": """\
# Brute Force — Python's built-in big integers
class Solution:
    def multiply(self, num1: str, num2: str) -> str:
        return str(int(num1) * int(num2))""",
    "optimal": """\
# Optimal O(m*n) — grade school multiplication without big int
class Solution:
    def multiply(self, num1: str, num2: str) -> str:
        m, n = len(num1), len(num2); res = [0] * (m + n)
        for i in range(m - 1, -1, -1):
            for j in range(n - 1, -1, -1):
                mul = int(num1[i]) * int(num2[j]); p1, p2 = i + j, i + j + 1
                total = mul + res[p2]; res[p2] = total % 10; res[p1] += total // 10
        result = ''.join(map(str, res)).lstrip('0')
        return result or '0'""",
  },

  { "id": 2013, "title": "Detect Squares", "slug": "detect-squares",
    "difficulty": "Medium", "category": "Math & Geometry",
    "key_insights": [
      "Store all added points in a Counter (point -> count) and a set of x-coords.",
      "For each query (px, py): enumerate all x3 as potential diagonal x-coord.",
      "Square side = abs(x3 - px), must be > 0.",
      "Other two corners: (px, py ± side) and (x3, py ± side).",
      "Multiply counts of the 3 corners (query point is not stored).",
    ],
    "complexity": "Time: O(n) per query  |  Space: O(n)",
    "brute": """\
# Brute Force O(n^2) per query — enumerate all point pairs as diagonals
from collections import Counter
class DetectSquares:
    def __init__(self): self.pts = Counter()
    def add(self, point: list) -> None: self.pts[tuple(point)] += 1
    def count(self, point: list) -> int:
        px, py = point; res = 0
        for (x1, y1), c1 in self.pts.items():
            for (x2, y2), c2 in self.pts.items():
                if abs(x1-px) == abs(y1-py) and abs(x1-px) > 0:
                    if x2 == x1 and y2 == py:
                        res += c1 * c2 * self.pts.get((px, y1), 0)
        return res""",
    "optimal": """\
# Optimal O(n) per query — enumerate diagonal x-coordinate
from collections import Counter, defaultdict
class DetectSquares:
    def __init__(self): self.pts = Counter(); self.x_set = defaultdict(set)
    def add(self, point: list) -> None:
        x, y = point; self.pts[(x, y)] += 1; self.x_set[x].add(y)
    def count(self, point: list) -> int:
        px, py = point; res = 0
        for x3 in self.x_set:
            side = abs(x3 - px)
            if side == 0: continue
            for dy in (side, -side):
                res += (self.pts[(x3, py)] * self.pts[(x3, py+dy)] * self.pts[(px, py+dy)])
        return res""",
  },

  # ── Bit Manipulation ──────────────────────────────────────────────────────
  { "id": 371, "title": "Sum of Two Integers", "slug": "sum-of-two-integers",
    "difficulty": "Medium", "category": "Bit Manipulation",
    "key_insights": [
      "XOR gives the sum of bits without carry: a ^ b.",
      "AND gives carry positions: (a & b) << 1.",
      "Repeat until carry is 0 — at most 32 iterations.",
      "Python has arbitrary precision ints; mask with 0xFFFFFFFF to stay 32-bit.",
      "Convert back to signed: if result > 0x7FFFFFFF, apply ~(result ^ 0xFFFFFFFF).",
    ],
    "complexity": "Time: O(1)  |  Space: O(1)",
    "brute": """\
# Full adder simulation with 32-bit masking
class Solution:
    def getSum(self, a: int, b: int) -> int:
        MASK = 0xFFFFFFFF; MAX = 0x7FFFFFFF
        while b & MASK:
            carry = (a & b) << 1; a = a ^ b; b = carry
        return a if a <= MAX else ~(a ^ MASK)""",
    "optimal": """\
# Optimal — cleaner 32-bit masking throughout
class Solution:
    def getSum(self, a: int, b: int) -> int:
        MASK = 0xFFFFFFFF; MAX = 0x7FFFFFFF
        while b:
            carry = ((a & b) << 1) & MASK
            a = (a ^ b) & MASK; b = carry
        return a if a <= MAX else ~(a ^ MASK)""",
  },
]


# ── Load scraped best answers from all 4 sites ────────────────────────────────
def load_sites_cache():
    if not SITES_CACHE.exists():
        print(f"WARNING: {SITES_CACHE} not found. Run scrape_nc32_sites.py first.")
        return {}
    return json.loads(SITES_CACHE.read_text())


# ── Write neetcodereview.json ─────────────────────────────────────────────────
def _is_prose(text: str) -> bool:
    """True if text looks like prose (not Python code)."""
    if not text or not text.strip():
        return False
    first = text.strip().split("\n")[0].strip()
    return not first.startswith(("class ", "def ", "# ", "import ", "from "))

def write_json():
    """Write (or merge-update) neetcodereview.json.
    Preserves scraped prose for key_insights / space_and_time_complexity / solution
    if they already exist in the file — never overwrites good prose with Python code.
    """
    # Load existing scraped data if present
    existing = {}
    if JSON_OUT.exists():
        for entry in json.loads(JSON_OUT.read_text()):
            existing[entry["slug"]] = entry

    review = []
    for q in NC32:
        ex = existing.get(q["slug"], {})

        # Preserve scraped prose; fall back to handcrafted if nothing scraped yet
        fallback_insights = "\n".join(f"- {ins}" for ins in q["key_insights"])
        insights = ex.get("key_insights") if ex.get("key_insights") else fallback_insights

        st = ex.get("space_and_time_complexity") if ex.get("space_and_time_complexity") else q["complexity"]

        # Only keep solution field if it's prose — never store Python code there
        scraped_sol = ex.get("solution", "")
        solution = scraped_sol if _is_prose(scraped_sol) else ""

        review.append({
            "id":                       q["id"],
            "title":                    q["title"],
            "slug":                     q["slug"],
            "solution_url":             f"https://www.simplyleet.com/{q['slug']}",
            "key_insights":             insights,
            "space_and_time_complexity": st,
            "solution":                 solution,
            "pattern":                  q["category"],
        })

    JSON_OUT.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(review)} entries to {JSON_OUT}")


# ── PDF rendering helpers ──────────────────────────────────────────────────────
def category_banner(cat_name, hex_color, printable=False):
    if printable:
        txt = Paragraph(
            f'<b>  {safe_xml(cat_name)}</b>',
            ParagraphStyle("cbn_p", fontSize=12, fontName="LG-Bold", textColor=HexColor("#000000")))
        bg = PRINT_BANNER_BG
    else:
        txt = Paragraph(
            f'<font color="white"><b>  {safe_xml(cat_name)}</b></font>',
            ParagraphStyle("cbn", fontSize=12, fontName="LG-Bold", textColor=white))
        bg = HexColor(hex_color)

    tbl = Table([[txt]], colWidths=[MAX_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        *([("BOX", (0,0), (-1,-1), 0.5, HexColor("#374151"))] if printable else []),
    ]))
    return tbl


def site_label_para(site_meta, printable=False):
    if printable:
        return Paragraph(
            f'<b>● {site_meta["label"]}  (Python)</b>',
            ParagraphStyle(
                f"sl_{site_meta['key']}_p", fontSize=8.5, fontName="LG-Bold",
                textColor=HexColor("#000000"), spaceBefore=6, spaceAfter=2))
    return Paragraph(
        f'<font color="{site_meta["color"]}"><b>● {site_meta["label"]}  (Python)</b></font>',
        ParagraphStyle(
            f"sl_{site_meta['key']}", fontSize=8.5, fontName="LG-Bold",
            textColor=HexColor(site_meta["color"]), spaceBefore=6, spaceAfter=2))


def render_question(q, styles, sites_cache, printable=False):
    flowables = []
    BLACK_COL = HexColor("#000000")

    # ── Title + difficulty badge ──────────────────────────────────────────────
    diff_key = q["difficulty"].lower()
    bg, fg = DIFF_COLORS.get(diff_key, (GRAY_100, GRAY_700))
    if printable:
        title_text = f'<b>#{q["id"]}  {safe_xml(q["title"])}</b>  [{q["difficulty"].upper()}]'
    else:
        title_text = (
            f'<b>#{q["id"]}  {safe_xml(q["title"])}</b>'
            f'   <font color="{fg.hexval()}" size="9"><b>{q["difficulty"].upper()}</b></font>'
        )
    flowables.append(Paragraph(title_text, styles["q_title"]))

    # ── Key insights ─────────────────────────────────────────────────────────
    for ins in q["key_insights"]:
        flowables.append(Paragraph(f"• {safe_xml(ins)}", styles["body"]))
    flowables.append(Spacer(1, 2))

    # ── Complexity ───────────────────────────────────────────────────────────
    cplx_label = '<b>Complexity — </b>' if printable else '<font color="#6B7280"><b>Complexity — </b></font>'
    flowables.append(Paragraph(f'{cplx_label}{safe_xml(q["complexity"])}', styles["body"]))
    flowables.append(Spacer(1, 6))

    # ── Handcrafted brute force ───────────────────────────────────────────────
    brute_color = "#000000" if printable else "#F59E0B"
    flowables.append(Paragraph(
        f'<font color="{brute_color}"><b>◼ Brute Force (Python)</b></font>',
        ParagraphStyle("bl", fontSize=9, fontName="LG-Bold", textColor=HexColor(brute_color))))
    flowables += code_flowable(q["brute"], "python", styles, printable=printable)

    # ── Handcrafted optimal ───────────────────────────────────────────────────
    opt_color = "#000000" if printable else "#61AFEF"
    flowables.append(Paragraph(
        f'<font color="{opt_color}"><b>◼ Optimal Solution (Python)</b></font>',
        ParagraphStyle("ol", fontSize=9, fontName="LG-Bold", textColor=HexColor(opt_color))))
    flowables += code_flowable(q["optimal"], "python", styles, printable=printable)

    # ── Best answers from all 4 sites ─────────────────────────────────────────
    slug  = q["slug"]
    entry = sites_cache.get(slug, {})

    has_site_answers = any(entry.get(s["key"]) for s in SITES)
    if has_site_answers:
        flowables.append(Spacer(1, 4))
        hdr_color = "#374151" if printable else "#9CA3AF"
        flowables.append(Paragraph(
            f'<font color="{hdr_color}"><b>★ Best Answers — All 4 Sites (Python only)</b></font>',
            ParagraphStyle("ba_hdr", fontSize=9.5, fontName="LG-Bold",
                           textColor=HexColor(hdr_color), spaceBefore=4)))

        for site_meta in SITES:
            codes = entry.get(site_meta["key"], [])
            if not codes:
                continue
            flowables.append(site_label_para(site_meta, printable=printable))
            for code_str in codes:
                flowables += code_flowable(code_str, "python", styles, printable=printable)

    hr_color = HexColor("#000000") if printable else HexColor("#374151")
    flowables.append(HRFlowable(
        width="100%", thickness=0.5, color=hr_color,
        spaceAfter=10, spaceBefore=6))
    return flowables


def _section_label(text, color="#4F46E5", printable=False):
    txt_color = "#000000" if printable else color
    return Paragraph(
        f'<font color="{txt_color}"><b>{text}</b></font>',
        ParagraphStyle(f"qr_sec_{text[:4]}", fontSize=9.5, fontName="LG-Bold",
                       textColor=HexColor(txt_color), spaceBefore=8, spaceAfter=3))

def build_quick_review_section(styles, printable=False):
    """Final section: full 3-part card per question — Key Insights, Space & Time, Solution."""
    if not JSON_OUT.exists():
        return []

    review_data = json.loads(JSON_OUT.read_text())
    review_by_slug = {r["slug"]: r for r in review_data}

    title_color = HexColor("#000000") if printable else HexColor("#4F46E5")
    flowables = [PageBreak()]
    flowables.append(Paragraph(
        f'<font color="{title_color.hexval()}"><b>Quick Review</b></font>',
        ParagraphStyle("qr_title", fontSize=24, fontName="LG-Bold",
                       textColor=title_color, alignment=TA_CENTER, spaceAfter=6)))
    flowables.append(Paragraph(
        "Key Insights · Space & Time · Solution — all 32 questions from neetcodereview.json",
        ParagraphStyle("qr_sub", fontSize=10, fontName="LG-Bold" if printable else "LG",
                       textColor=HexColor("#374151") if printable else GRAY_500,
                       alignment=TA_CENTER, spaceAfter=20)))

    for q in NC32:
        r = review_by_slug.get(q["slug"])
        if not r:
            continue

        hex_color = CAT_COLORS.get(q["category"], "#4F46E5")

        # ── Card header (colored banner) ──────────────────────────────────────
        fg_hex = "#000000" if printable else "white"
        header_tbl = Table([[Paragraph(
            f'<font color="{fg_hex}"><b>#{q["id"]}  {safe_xml(q["title"])}</b></font>'
            f'  <font color="{fg_hex}" size="8">[{q["difficulty"].upper()}]</font>'
            f'<br/><font color="{fg_hex}" size="8">{safe_xml(q["category"])}</font>',
            ParagraphStyle("qrc_hdr", fontSize=10.5, fontName="LG-Bold",
                           textColor=HexColor(fg_hex), leading=15)
        )]], colWidths=[MAX_W])
        hdr_bg = PRINT_BANNER_BG if printable else HexColor(hex_color)
        hdr_fg = "#000000" if printable else "white"
        header_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), hdr_bg),
            ("TOPPADDING",    (0,0), (-1,-1), 9),
            ("BOTTOMPADDING", (0,0), (-1,-1), 9),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("RIGHTPADDING",  (0,0), (-1,-1), 12),
            *([("BOX", (0,0), (-1,-1), 0.5, HexColor("#374151"))] if printable else []),
        ]))
        flowables.append(header_tbl)

        card_bg = HexColor("#FFFFFF") if printable else HexColor("#F9FAFB")
        card_style = TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), card_bg),
            ("TOPPADDING",    (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("RIGHTPADDING",  (0,0), (-1,-1), 12),
        ])
        lbl_color = "#000000" if printable else hex_color

        # ── Key Insights ──────────────────────────────────────────────────────
        flowables.append(_section_label("Key Insights", lbl_color, printable=printable))
        insights_text = r.get("key_insights", "")
        lines = [ln.strip() for ln in insights_text.split("\n") if ln.strip()]
        ins_rows = []
        for ln in lines:
            clean = ln.lstrip("- ").strip()
            if clean:
                ins_rows.append([Paragraph(f"• {safe_xml(clean)}", styles["body"])])
        if ins_rows:
            t = Table(ins_rows, colWidths=[MAX_W])
            t.setStyle(card_style)
            flowables.append(t)

        # ── Space & Time ──────────────────────────────────────────────────────
        st_text = r.get("space_and_time_complexity", q.get("complexity", ""))
        if st_text:
            flowables.append(_section_label("Space & Time", lbl_color, printable=printable))
            st_rows = []
            for line in st_text.split("\n"):
                line = line.strip()
                if line:
                    st_rows.append([Paragraph(safe_xml(line), styles["body"])])
            if st_rows:
                t = Table(st_rows, colWidths=[MAX_W])
                t.setStyle(card_style)
                flowables.append(t)

        # ── Solution prose ────────────────────────────────────────────────────
        sol_text = r.get("solution", "")
        if sol_text and not sol_text.strip().startswith(("class ", "def ", "#", "import ")):
            flowables.append(_section_label("Solution", lbl_color, printable=printable))
            sol_rows = []
            for para in sol_text.split("\n\n"):
                para = para.strip()
                if para:
                    sol_rows.append([Paragraph(safe_xml(para), styles["body"])])
            if sol_rows:
                t = Table(sol_rows, colWidths=[MAX_W])
                t.setStyle(card_style)
                flowables.append(t)

        hr_color = HexColor("#000000") if printable else HexColor("#E5E7EB")
        flowables.append(HRFlowable(
            width="100%", thickness=0.5, color=hr_color,
            spaceAfter=14, spaceBefore=6))

    return flowables


# ── Main build ────────────────────────────────────────────────────────────────
def build_pdf(printable=False):
    sites_cache = load_sites_cache()
    styles = build_styles(printable=printable)
    output = OUTPUT_PRINT if printable else OUTPUT_PDF

    txt_color = HexColor("#000000") if printable else GRAY_500

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold" if printable else "LG", 8)
        canvas.setFillColor(HexColor("#000000") if printable else GRAY_500)
        canvas.drawCentredString(
            letter[0] / 2, 0.4 * inch,
            f"LeetMastery — NeetCode 150 · Not in 331   |   Page {doc.page}"
        )
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.65*inch,   bottomMargin=0.65*inch,
    )

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────
    brand_color = HexColor("#000000") if printable else HexColor("#4F46E5")
    story.append(Spacer(1, 1.2*inch))
    story.append(Paragraph(
        f'<font color="{brand_color.hexval()}"><b>LeetMastery</b></font>',
        ParagraphStyle("brand", fontSize=14, fontName="LG-Bold",
                       textColor=brand_color, alignment=TA_CENTER, spaceAfter=4)))
    story.append(Paragraph(
        "NeetCode 150 — Not In 331",
        ParagraphStyle("ct", fontSize=32, fontName="LG-Bold",
                       textColor=HexColor("#000000") if printable else GRAY_700,
                       alignment=TA_CENTER, spaceAfter=10)))
    story.append(Paragraph(
        "32 questions in the NeetCode 150 list not in the app's local library.\n"
        "Brute force + optimal Python  ·  Real best answers from WalkCC, LeetDoocs, SimplyLeet & LeetCode.ca\n"
        "Key insights  ·  Complexity  ·  Quick Review section",
        ParagraphStyle("cs", fontSize=11, fontName="LG-Bold" if printable else "LG",
                       textColor=HexColor("#374151") if printable else GRAY_500,
                       alignment=TA_CENTER, leading=18)))
    story.append(Spacer(1, 0.5*inch))

    # Category overview table
    cats = {}
    for q in NC32:
        cats.setdefault(q["category"], []).append(q)
    stats_rows = [["Category", "Questions"]]
    for cat, qs in cats.items():
        diffs = ", ".join(f"{q['difficulty']}" for q in qs)
        stats_rows.append([cat, diffs])
    tbl = Table(stats_rows, colWidths=[2.5*inch, 4.5*inch])
    hdr_bg = PRINT_BANNER_BG if printable else INDIGO
    hdr_fg = HexColor("#000000") if printable else white
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), hdr_bg),
        ("TEXTCOLOR",  (0,0), (-1,0), hdr_fg),
        ("FONTNAME",   (0,0), (-1,0), "LG-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 9),
        ("FONTNAME",   (0,1), (-1,-1), "LG-Bold" if printable else "LG"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [HexColor("#F3F4F6"), white]),
        ("TEXTCOLOR",  (0,1), (-1,-1), HexColor("#000000") if printable else GRAY_700),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("GRID", (0,0), (-1,-1), 0.3 if printable else 0.3,
         HexColor("#000000") if printable else HexColor("#E5E7EB")),
    ]))
    story.append(tbl)
    story.append(PageBreak())

    # ── Questions by category ─────────────────────────────────────────────
    for cat_name, qs in cats.items():
        hex_color = CAT_COLORS.get(cat_name, "#4F46E5")
        story.append(category_banner(cat_name, hex_color, printable=printable))
        story.append(Spacer(1, 8))
        for q in qs:
            story += render_question(q, styles, sites_cache, printable=printable)
        story.append(PageBreak())

    # ── Quick Review section ───────────────────────────────────────────────
    story += build_quick_review_section(styles, printable=printable)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    total_sites = sum(
        sum(len(v) for v in sites_cache.get(q["slug"], {}).values())
        for q in NC32
    )
    print(f"PDF written → {output}  ({total_sites} scraped Python solutions embedded)")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--printable", action="store_true",
                        help="Generate print edition (black+bold, light bg)")
    parser.add_argument("--both", action="store_true",
                        help="Generate both colored and print editions")
    args = parser.parse_args()

    write_json()
    if args.both:
        build_pdf(printable=False)
        build_pdf(printable=True)
    elif args.printable:
        build_pdf(printable=True)
    else:
        build_pdf(printable=False)

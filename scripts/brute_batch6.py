"""
brute_batch6.py — Phase 2 rewrites for the 26 remaining same-algorithm pairs.
Each Phase 2 uses a DIFFERENT algorithm, data structure, or complexity class than Phase 4.
"""

BATCH6_FIX: dict[int, str] = {

# ── Q71 Simplify Path ──────────────────────────────────────────────────────────
# Phase 4: split('/') + stack  →  Phase 2: char-by-char build with regex-style
# repeated reduction (O(n²) passes until stable)
71: '''\
class _71_SimplifyPath_Brute:
    def simplifyPath(self, path: str) -> str:
        import re
        # Collapse consecutive slashes
        p = re.sub(r"/+", "/", path)
        if not p.endswith("/"): p += "/"
        # Repeatedly reduce /./  and  /dir/../  until no change (O(n) passes, O(n) each)
        prev = None
        while prev != p:
            prev = p
            p = re.sub(r"/[.]/", "/", p)
            p = re.sub(r"/[^/]+/[.][.]/", "/", p)
        # Strip trailing /.. and /.
        while p.endswith("/.."):
            cut = p.rfind("/", 0, len(p) - 3)
            p = (p[:cut] if cut > 0 else "") + "/"
        p = p.rstrip("/")
        return p or "/"
''',

# ── Q77 Combinations ──────────────────────────────────────────────────────────
# Phase 4: backtracking with pruning  →  Phase 2: enumerate all 2^n bitmasks,
# keep those with exactly k bits set  (O(2^n) vs O(C(n,k)))
77: '''\
class _77_Combinations_Brute:
    def combine(self, n: int, k: int) -> list:
        result = []
        for mask in range(1 << n):
            if bin(mask).count("1") == k:
                combo = [i + 1 for i in range(n) if mask & (1 << i)]
                result.append(combo)
        return result
''',

# ── Q90 Subsets II ────────────────────────────────────────────────────────────
# Phase 4: backtracking with skip-duplicate pruning  →  Phase 2: bitmask over
# all 2^n subsets, deduplicate via frozenset of sorted values  (O(2^n))
90: '''\
class _90_SubsetsII_Brute:
    def subsetsWithDup(self, nums: list) -> list:
        nums.sort()
        n = len(nums)
        seen = set()
        result = []
        for mask in range(1 << n):
            sub = tuple(nums[i] for i in range(n) if mask & (1 << i))
            if sub not in seen:
                seen.add(sub)
                result.append(list(sub))
        return result
''',

# ── Q95 Unique Binary Search Trees II ────────────────────────────────────────
# Phase 4: @lru_cache on (lo, hi) index bounds  →  Phase 2: pass explicit
# sorted number list, no memoization — exponential recomputation
95: '''\
class _95_UniqueBinarySearchTreesII_Brute:
    def generateTrees(self, n: int) -> list:
        def build(nums: list) -> list:
            if not nums:
                return [None]
            trees = []
            for i, root_val in enumerate(nums):
                for left in build(nums[:i]):
                    for right in build(nums[i + 1:]):
                        node = TreeNode(root_val)
                        node.left  = left
                        node.right = right
                        trees.append(node)
            return trees
        return build(list(range(1, n + 1)))
''',

# ── Q129 Sum Root to Leaf Numbers ─────────────────────────────────────────────
# Phase 4: DFS returning running numeric sum  →  Phase 2: collect every
# root-to-leaf path as a digit *string*, then convert and sum  (O(n·h))
129: '''\
class _129_SumRootToLeafNumbers_Brute:
    def sumNumbers(self, root) -> int:
        paths = []
        def collect(node, digits: list) -> None:
            if not node:
                return
            digits.append(str(node.val))
            if not node.left and not node.right:
                paths.append("".join(digits))
            collect(node.left,  digits)
            collect(node.right, digits)
            digits.pop()
        collect(root, [])
        return sum(int(p) for p in paths)
''',

# ── Q140 Word Break II ────────────────────────────────────────────────────────
# Phase 4: @lru_cache memoised recursion  →  Phase 2: pure backtracking,
# no cache, accumulates words in a path list  (exponential worst case)
140: '''\
class _140_WordBreakII_Brute:
    def wordBreak(self, s: str, wordDict: list) -> list:
        words = set(wordDict)
        result = []
        def backtrack(start: int, path: list) -> None:
            if start == len(s):
                result.append(" ".join(path))
                return
            for end in range(start + 1, len(s) + 1):
                word = s[start:end]
                if word in words:
                    path.append(word)
                    backtrack(end, path)
                    path.pop()
        backtrack(0, [])
        return result
''',

# ── Q226 Invert Binary Tree ────────────────────────────────────────────────────
# Phase 4: recursive DFS (swap post-order)  →  Phase 2: collect ALL nodes
# into a list first, then swap left/right in a separate pass  (two-phase)
226: '''\
class _226_InvertTree_Brute:
    def invertTree(self, root) -> object:
        all_nodes = []
        stack = [root] if root else []
        while stack:
            node = stack.pop()
            if node:
                all_nodes.append(node)
                stack.append(node.left)
                stack.append(node.right)
        for node in all_nodes:
            node.left, node.right = node.right, node.left
        return root
''',

# ── Q269 Alien Dictionary ─────────────────────────────────────────────────────
# Phase 4: BFS Kahn's algorithm (in-degree queue)  →  Phase 2: DFS topo sort
# with 3-state coloring (unvisited / in-stack / done)  — different algorithm
269: '''\
class _269_AlienDictionary_Brute:
    def alienOrder(self, words: list) -> str:
        from collections import defaultdict
        chars = {c for w in words for c in w}
        adj: dict = defaultdict(set)
        for i in range(len(words) - 1):
            w1, w2 = words[i], words[i + 1]
            if len(w1) > len(w2) and w1[:len(w2)] == w2:
                return ""
            for c1, c2 in zip(w1, w2):
                if c1 != c2:
                    adj[c1].add(c2)
                    break
        # DFS topological sort: 0=white, 1=grey (in-stack), 2=black (done)
        color = {c: 0 for c in chars}
        order: list = []
        def dfs(c: str) -> bool:
            if color[c] == 1: return False   # back-edge → cycle
            if color[c] == 2: return True
            color[c] = 1
            for nb in adj[c]:
                if not dfs(nb):
                    return False
            color[c] = 2
            order.append(c)
            return True
        for c in chars:
            if color[c] == 0 and not dfs(c):
                return ""
        return "".join(reversed(order))
''',

# ── Q277 Find the Celebrity ────────────────────────────────────────────────────
# Phase 4: O(n) two-pass elimination  →  Phase 2: O(n²) build trust-set then
# verify each candidate with all() checks
277: '''\
class _277_FindCelebrity_Brute:
    def findCelebrity(self, n: int) -> int:
        trust_pairs = {(a, b) for a, b in
                       [(i, j) for i in range(n) for j in range(n)
                        if i != j and knows(i, j)]}
        for candidate in range(n):
            trusted_by_all = all(
                (other, candidate) in trust_pairs
                for other in range(n) if other != candidate
            )
            trusts_nobody = not any(
                (candidate, other) in trust_pairs
                for other in range(n) if other != candidate
            )
            if trusted_by_all and trusts_nobody:
                return candidate
        return -1
''',

# ── Q332 Reconstruct Itinerary ────────────────────────────────────────────────
# Phase 4: Hierholzer's (heap-based Eulerian path, O(E log E))  →  Phase 2:
# true backtracking DFS — try each destination, undo if no complete route found
332: '''\
class _332_ReconstructItinerary_Brute:
    def findItinerary(self, tickets: list) -> list:
        from collections import defaultdict
        graph: dict = defaultdict(list)
        for a, b in sorted(tickets):
            graph[a].append(b)
        total = len(tickets) + 1
        result: list = []
        def dfs(airport: str, path: list) -> bool:
            if len(path) == total:
                result.extend(path)
                return True
            dests = graph[airport]
            for i, dest in enumerate(dests):
                dests.pop(i)
                path.append(dest)
                if dfs(dest, path):
                    return True
                path.pop()
                dests.insert(i, dest)
            return False
        dfs("JFK", ["JFK"])
        return result
''',

# ── Q472 Concatenated Words ───────────────────────────────────────────────────
# Phase 4: DP (build word_set incrementally by length)  →  Phase 2: recursive
# DFS per word with explicit word-count tracking  (no DP table)
472: '''\
class _472_ConcatenatedWords_Brute:
    def findAllConcatenatedWordsInADict(self, words: list) -> list:
        word_set = set(words)
        def can_form(word: str, count: int) -> bool:
            if not word:
                return count >= 2
            for end in range(1, len(word) + 1):
                if word[:end] in word_set and can_form(word[end:], count + 1):
                    return True
            return False
        return [w for w in words if w and can_form(w, 0)]
''',

# ── Q582 Kill Process ─────────────────────────────────────────────────────────
# Phase 4: BFS (queue, level-order kill propagation)  →  Phase 2: DFS
# recursive kill propagation (depth-first kill cascade)
582: '''\
class _582_KillProcess_Brute:
    def killProcess(self, pid: list, ppid: list, kill: int) -> list:
        from collections import defaultdict
        children: dict = defaultdict(list)
        for p, pp in zip(pid, ppid):
            children[pp].append(p)
        killed: list = []
        def dfs(proc: int) -> None:
            killed.append(proc)
            for child in children[proc]:
                dfs(child)
        dfs(kill)
        return killed
''',

# ── Q645 Set Mismatch ─────────────────────────────────────────────────────────
# Phase 4: O(n) Counter  →  Phase 2: sort then linear scan for duplicate and
# gap  (O(n log n), different algorithm structure)
645: '''\
class _645_SetMismatch_Brute:
    def findErrorNums(self, nums: list) -> list:
        n = len(nums)
        s = sorted(nums)
        duplicate = missing = -1
        for i in range(1, n):
            if s[i] == s[i - 1]:
                duplicate = s[i]
        for expected in range(1, n + 1):
            found = False
            for x in nums:
                if x == expected:
                    found = True
                    break
            if not found:
                missing = expected
                break
        return [duplicate, missing]
''',

# ── Q648 Replace Words ────────────────────────────────────────────────────────
# Phase 4: set of roots, try prefix lengths  →  Phase 2: Trie — insert all
# roots, then walk trie per word until end-marker found  (O(R·L) build)
648: '''\
class _648_ReplaceWords_Brute:
    def replaceWords(self, dictionary: list, sentence: str) -> str:
        trie: dict = {}
        for root in dictionary:
            node = trie
            for ch in root:
                node = node.setdefault(ch, {})
            node["$"] = True
        def shorten(word: str) -> str:
            node = trie
            for i, ch in enumerate(word):
                if ch not in node:
                    return word
                node = node[ch]
                if "$" in node:
                    return word[: i + 1]
            return word
        return " ".join(shorten(w) for w in sentence.split())
''',

# ── Q659 Split Array into Consecutive Subsequences ────────────────────────────
# Phase 4: O(n) greedy (Counter + end-counter)  →  Phase 2: O(n²) explicit
# sequence list — for each number, scan sequences for one ending at num-1
659: '''\
class _659_SplitArrayConsecutiveSubsequences_Brute:
    def isPossible(self, nums: list) -> bool:
        sequences: list = []          # each entry is the tail value of a live sequence
        lengths: list   = []          # parallel: current length of each sequence
        for num in nums:
            extended = False
            for i in range(len(sequences)):
                if sequences[i] == num - 1:
                    sequences[i] = num
                    lengths[i]  += 1
                    extended = True
                    break
            if not extended:
                sequences.append(num)
                lengths.append(1)
        return all(ln >= 3 for ln in lengths)
''',

# ── Q760 Find Anagram Mappings ────────────────────────────────────────────────
# Phase 4: O(n) hash map  →  Phase 2: O(n²) — for each value walk nums2
# left-to-right using a while loop to find first match
760: '''\
class _760_AnagramMappings_Brute:
    def anagramMappings(self, nums1: list, nums2: list) -> list:
        result = []
        for target in nums1:
            idx = 0
            while idx < len(nums2) and nums2[idx] != target:
                idx += 1
            result.append(idx)
        return result
''',

# ── Q931 Minimum Falling Path Sum ─────────────────────────────────────────────
# Phase 4: in-place bottom-up DP  →  Phase 2: top-down recursion + memo
# (different direction, different data structure)
931: '''\
class _931_MinFallingPathSum_Brute:
    def minFallingPathSum(self, matrix: list) -> int:
        from functools import lru_cache
        n = len(matrix)
        @lru_cache(None)
        def dp(r: int, c: int) -> int:
            if c < 0 or c >= n:
                return float("inf")
            if r == 0:
                return matrix[0][c]
            return matrix[r][c] + min(dp(r - 1, c - 1), dp(r - 1, c), dp(r - 1, c + 1))
        return min(dp(n - 1, c) for c in range(n))
''',

# ── Q939 Minimum Area Rectangle ───────────────────────────────────────────────
# Phase 4: O(n²) diagonal-pair check  →  Phase 2: O(n^4) enumerate every
# combination of 4 points and verify they form an axis-aligned rectangle
939: '''\
class _939_MinAreaRect_Brute:
    def minAreaRect(self, points: list) -> int:
        n = len(points)
        best = float("inf")
        for i in range(n):
            for j in range(i + 1, n):
                for k in range(j + 1, n):
                    for l in range(k + 1, n):
                        xs = {points[i][0], points[j][0], points[k][0], points[l][0]}
                        ys = {points[i][1], points[j][1], points[k][1], points[l][1]}
                        if len(xs) == 2 and len(ys) == 2:
                            w = max(xs) - min(xs)
                            h = max(ys) - min(ys)
                            best = min(best, w * h)
        return best if best != float("inf") else 0
''',

# ── Q997 Find the Town Judge ──────────────────────────────────────────────────
# Phase 4: O(n) single score array  →  Phase 2: O(n²) build full trust set,
# verify each candidate via all() generators
997: '''\
class _997_FindTheTownJudge_Brute:
    def findJudge(self, n: int, trust: list) -> int:
        trust_set = {(a, b) for a, b in trust}
        for candidate in range(1, n + 1):
            trusts_nobody = not any(
                (candidate, other) in trust_set
                for other in range(1, n + 1) if other != candidate
            )
            trusted_by_all = all(
                (other, candidate) in trust_set
                for other in range(1, n + 1) if other != candidate
            )
            if trusts_nobody and trusted_by_all:
                return candidate
        return -1
''',

# ── Q1004 Max Consecutive Ones III ────────────────────────────────────────────
# Phase 4: O(n) sliding window  →  Phase 2: O(n²) prefix-zero-sum array,
# check every (i,j) window — fundamentally different data structure
1004: '''\
class _1004_MaxConsecutiveOnesIII_Brute:
    def longestOnes(self, nums: list, k: int) -> int:
        n = len(nums)
        prefix = [0] * (n + 1)
        for i in range(n):
            prefix[i + 1] = prefix[i] + (1 if nums[i] == 0 else 0)
        best = 0
        for i in range(n):
            for j in range(i, n):
                if prefix[j + 1] - prefix[i] <= k:
                    best = max(best, j - i + 1)
        return best
''',

# ── Q1166 Design File System ──────────────────────────────────────────────────
# Phase 4: flat dict keyed by full path  →  Phase 2: Trie where each node
# stores children dict + value — different data structure entirely
1166: '''\
class _1166_DesignFileSystem_Brute:
    def __init__(self) -> None:
        self._root: dict = {"_v": None, "_c": {}}

    def createPath(self, path: str, value: int) -> bool:
        parts = path.strip("/").split("/")
        node = self._root
        for part in parts[:-1]:
            if part not in node["_c"]:
                return False
            node = node["_c"][part]
        last = parts[-1]
        if last in node["_c"]:
            return False
        node["_c"][last] = {"_v": value, "_c": {}}
        return True

    def get(self, path: str) -> int:
        parts = path.strip("/").split("/")
        node = self._root
        for part in parts:
            if part not in node["_c"]:
                return -1
            node = node["_c"][part]
        return node["_v"]
''',

# ── Q1236 Web Crawler ─────────────────────────────────────────────────────────
# Phase 4: BFS with deque  →  Phase 2: recursive DFS — different traversal
# order, different call structure (recursion vs iteration)
1236: '''\
class _1236_WebCrawler_Brute:
    def crawl(self, startUrl: str, htmlParser: object) -> list:
        def hostname(url: str) -> str:
            return url.split("/")[2]
        host = hostname(startUrl)
        visited: set = set()
        def dfs(url: str) -> None:
            if url in visited or hostname(url) != host:
                return
            visited.add(url)
            for link in htmlParser.getUrls(url):
                dfs(link)
        dfs(startUrl)
        return list(visited)
''',

# ── Q1262 Greatest Sum Divisible by Three ─────────────────────────────────────
# Phase 4: rolling DP by remainder  →  Phase 2: sort + greedy removal —
# take total sum, then remove minimum elements to reach next multiple of 3
1262: '''\
class _1262_GreatestSumDivisibleByThree_Brute:
    def maxSumDivThree(self, nums: list) -> int:
        total = sum(nums)
        if total % 3 == 0:
            return total
        r = total % 3
        by_mod: dict = {0: [], 1: [], 2: []}
        for x in sorted(nums):
            by_mod[x % 3].append(x)
        # Option A: remove r smallest elements with x%3 == r
        a = by_mod[r]
        loss_a = sum(a[:r]) if len(a) >= r else float("inf")
        # Option B: remove (3-r) smallest elements with x%3 == (3-r)
        b = by_mod[3 - r]
        loss_b = sum(b[:3 - r]) if len(b) >= 3 - r else float("inf")
        best_loss = min(loss_a, loss_b)
        return total - best_loss if best_loss != float("inf") else 0
''',

# ── Q1423 Maximum Points You Can Obtain from Cards ────────────────────────────
# Phase 4: O(n) minimum sliding window (find min-sum subarray of size n-k)  →
# Phase 2: O(k²) try all left/right splits with explicit sum() calls
1423: '''\
class _1423_MaximumPointsFromCards_Brute:
    def maxScore(self, cardPoints: list, k: int) -> int:
        n = len(cardPoints)
        best = 0
        for left_count in range(k + 1):
            right_count = k - left_count
            left_sum  = sum(cardPoints[:left_count])
            right_sum = sum(cardPoints[n - right_count:]) if right_count > 0 else 0
            best = max(best, left_sum + right_sum)
        return best
''',

# ── Q1424 Diagonal Traverse II ────────────────────────────────────────────────
# Phase 4: O(N) hash-group by diagonal key  →  Phase 2: O(N log N) collect
# all (diag, -row, val) triples and sort — different complexity class
1424: '''\
class _1424_DiagonalTraverseII_Brute:
    def findDiagonalOrder(self, nums: list) -> list:
        cells = []
        for i, row in enumerate(nums):
            for j, val in enumerate(row):
                cells.append((i + j, -i, val))
        cells.sort()
        return [val for _, _, val in cells]
''',

# ── Q1647 Minimum Deletions to Make Char Freq Unique ─────────────────────────
# Phase 4: sort freqs + taken set  →  Phase 2: max-heap — greedily reduce
# the largest duplicate frequency (priority-queue based)
1647: '''\
class _1647_MinDeletions_Brute:
    def minDeletions(self, s: str) -> int:
        import heapq
        from collections import Counter
        heap = [-f for f in Counter(s).values()]
        heapq.heapify(heap)
        deletions = 0
        seen: set = set()
        while heap:
            f = -heapq.heappop(heap)
            while f > 0 and f in seen:
                f -= 1
                deletions += 1
            if f > 0:
                seen.add(f)
        return deletions
''',

}

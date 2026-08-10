"""
fix_tree_phases.py — Fix 7 tree questions where Phase 2 and Phase 4
use the same algorithm (just different variable/recursion styles).

Each gets a Phase 2 that uses a fundamentally different approach:
  Q100  BFS serialise-and-compare  vs  DFS recursive comparison
  Q112  BFS with running sum       vs  DFS with remaining counter
  Q199  DFS right-first + depth    vs  BFS level-order inline check
  Q687  O(n²) per-node arm DFS     vs  O(n) post-order arm tracking
  Q1026 O(n²) all ancestor-pairs   vs  O(n) min/max carry-down DFS
  Q1376 BFS accumulated time       vs  DFS max-depth recursion
  Q1522 O(n²) per-pivot depth DFS  vs  O(n log n) sort-based DFS
"""
import json, re
from pathlib import Path

JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "grind_questions.json"


def replace_phase(code: str, n: int, new_content: str) -> str:
    lines = code.split("\n")
    start = end = None
    for i, l in enumerate(lines):
        if start is None and re.search(rf"PHASE\s*{n}\b", l): start = i
        elif start is not None and re.search(rf"PHASE\s*{n+1}\b", l): end = i; break
    if start is None:
        raise ValueError(f"Phase {n} not found")
    if end is None:
        end = len(lines)
    return "\n".join(lines[:start] + new_content.rstrip("\n").split("\n") + lines[end:])


FIXES = {

# ── Q100 Same Tree ────────────────────────────────────────────────────────
# Phase 4: DFS pairwise comparison via inner helper
# Phase 2: BFS serialize both trees to level-order lists, compare lists
100: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: serialize both trees with BFS level-order into lists
#  (including None sentinels) then compare the two lists.
#  O(n) time, O(n) space — very different structure from recursive DFS."
class _100_SameTree_Brute:
    def isSameTree(self, p, q) -> bool:
        from collections import deque
        def serialize(root) -> list:
            result, queue = [], deque([root])
            while queue:
                node = queue.popleft()
                if node:
                    result.append(node.val)
                    queue.append(node.left)
                    queue.append(node.right)
                else:
                    result.append(None)
            return result
        return serialize(p) == serialize(q)
'''),

# ── Q112 Path Sum ─────────────────────────────────────────────────────────
# Phase 4: DFS with `remaining` counter (subtract as we go)
# Phase 2: BFS carrying (node, cumulative_sum) pairs, check leaves
112: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: BFS level-order carrying (node, running_sum) pairs.
#  At each leaf check if running_sum == targetSum.
#  O(n) time, O(w) space (w = max width). BFS vs Phase 4's DFS."
class _112_PathSum_Brute:
    def hasPathSum(self, root, targetSum: int) -> bool:
        if not root:
            return False
        from collections import deque
        queue = deque([(root, root.val)])
        while queue:
            node, curr = queue.popleft()
            if not node.left and not node.right:
                if curr == targetSum:
                    return True
            if node.left:
                queue.append((node.left,  curr + node.left.val))
            if node.right:
                queue.append((node.right, curr + node.right.val))
        return False
'''),

# ── Q199 Binary Tree Right Side View ─────────────────────────────────────
# Phase 4: BFS, inline rightmost-of-level check
# Phase 2: DFS right-first with depth dict — first node seen at each depth wins
199: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: DFS visiting RIGHT child first.
#  Record the first node encountered at each depth — that is always the
#  rightmost node at that level. Build result from depth 0 upward.
#  O(n) time, O(h) stack. DFS vs Phase 4's BFS."
class _199_RightSideView_Brute:
    def rightSideView(self, root) -> list:
        first_at_depth: dict = {}
        def dfs(node, depth: int) -> None:
            if not node:
                return
            if depth not in first_at_depth:
                first_at_depth[depth] = node.val
            dfs(node.right, depth + 1)   # right first so rightmost wins
            dfs(node.left,  depth + 1)
        dfs(root, 0)
        return [first_at_depth[d] for d in range(len(first_at_depth))]
'''),

# ── Q687 Longest Univalue Path ────────────────────────────────────────────
# Phase 4: O(n) post-order tracking arm lengths inline
# Phase 2: O(n²) — for each node separately DFS its left/right subtrees
#          to measure same-value arm lengths, combine at each pivot
687: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: for every node as pivot, run separate DFS calls to measure
#  the longest same-value arm going down-left and down-right.
#  O(n²) — n pivots × O(n) arm DFS each. Much slower than Phase 4's O(n)."
class _687_LongestUnivaluePath_Brute:
    def longestUnivaluePath(self, root) -> int:
        def collect(node) -> list:
            if not node: return []
            return [node] + collect(node.left) + collect(node.right)

        def arm_len(node, val: int) -> int:
            if not node or node.val != val: return 0
            return 1 + max(arm_len(node.left, val), arm_len(node.right, val))

        best = 0
        for pivot in collect(root):
            left  = arm_len(pivot.left,  pivot.val)
            right = arm_len(pivot.right, pivot.val)
            best  = max(best, left + right)
        return best
'''),

# ── Q1026 Maximum Difference Between Node and Ancestor ───────────────────
# Phase 4: O(n) DFS carrying (path_min, path_max), returns max-min
# Phase 2: O(n²) — for every ancestor node, DFS all its descendants and
#          compute max |ancestor_val - descendant_val|
1026: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: for each node as ancestor, walk ALL its descendants via DFS
#  and compute max |ancestor.val - descendant.val|.
#  O(n²) — n ancestors × O(n) descendant scan each."
class _1026_MaxDifferenceBetweenNodeAndAncestor_Brute:
    def maxAncestorDiff(self, root) -> int:
        def all_nodes(node) -> list:
            if not node: return []
            return [node] + all_nodes(node.left) + all_nodes(node.right)

        def max_diff_below(ancestor_val: int, node) -> int:
            if not node: return 0
            return max(
                abs(ancestor_val - node.val),
                max_diff_below(ancestor_val, node.left),
                max_diff_below(ancestor_val, node.right),
            )

        best = 0
        for anc in all_nodes(root):
            best = max(best,
                       max_diff_below(anc.val, anc.left),
                       max_diff_below(anc.val, anc.right))
        return best
'''),

# ── Q1376 Time Needed to Inform All Employees ─────────────────────────────
# Phase 4: DFS returning max downstream inform-time
# Phase 2: BFS carrying accumulated time — each employee knows when they
#          received the message; we track the max finish time globally
1376: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: BFS from headID carrying (employee, time_info_arrived).
#  Enqueue all subordinates with time_arrived + informTime[manager].
#  Track the maximum arrival time seen across all leaves.
#  O(n) BFS vs Phase 4's O(n) DFS — different traversal order."
class _1376_TimeNeededToInformAllEmployees_Brute:
    def numOfMinutes(self, n: int, headID: int, manager: list, informTime: list) -> int:
        from collections import defaultdict, deque
        subordinates: dict = defaultdict(list)
        for emp, mgr in enumerate(manager):
            if mgr != -1:
                subordinates[mgr].append(emp)
        queue    = deque([(headID, 0)])     # (employee, time_message_arrived)
        max_time = 0
        while queue:
            emp, arrived = queue.popleft()
            finish = arrived + informTime[emp]
            max_time = max(max_time, finish)
            for sub in subordinates[emp]:
                queue.append((sub, finish))
        return max_time
'''),

# ── Q1522 Diameter of N-Ary Tree ──────────────────────────────────────────
# Phase 4: O(n log n) DFS sorting child heights, combine top-2
# Phase 2: O(n²) — for every node as pivot, independently compute the depth
#          of each child subtree with separate DFS calls, combine top-2
1522: (2, '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: for every node as pivot, run a separate DFS per child to
#  compute that child subtree's depth independently.
#  Combine the two greatest depths as the diameter through this pivot.
#  O(n²) — n pivots × O(n) depth DFS each. Phase 4 does it in O(n log n)."
class _1522_DiameterNaryTree_Brute:
    def diameter(self, root) -> int:
        def all_nodes(node) -> list:
            if not node: return []
            return [node] + [nd for c in node.children for nd in all_nodes(c)]

        def subtree_depth(node) -> int:
            if not node or not node.children: return 0
            return 1 + max(subtree_depth(c) for c in node.children)

        best = 0
        for pivot in all_nodes(root):
            depths = sorted(
                [subtree_depth(c) + 1 for c in pivot.children],
                reverse=True,
            )
            if len(depths) >= 2:
                best = max(best, depths[0] + depths[1])
            elif depths:
                best = max(best, depths[0])
        return best
'''),

}


with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

for qid, (phase_num, new_content) in FIXES.items():
    q = next((x for x in data if x["id"] == qid), None)
    if not q:
        print(f"  Q{qid}: NOT FOUND"); continue
    try:
        q["starterPython"] = replace_phase(q["starterPython"], phase_num, new_content)
        print(f"  Q{qid}: ✓")
    except ValueError as e:
        print(f"  Q{qid}: ERROR — {e}")

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print("\nDone.")

"""Problem-specific Phase 2 brute-force scripts keyed by LeetCode question id."""

# Each value is the comment body (lines starting with #, including quoted speech).
# Header "# PHASE 2 - BRUTE FORCE" is added by the fix script.

PHASE2_OVERRIDES: dict[str, str] = {}

def _add(qid: int, *lines: str) -> None:
    PHASE2_OVERRIDES[str(qid)] = "\n".join(f"# {line}" for line in lines) + "\n"


# --- batch 1: broken / critical (9) ---
_add(
    33,
    '"Let me start with brute force to lock in the logic.',
    " Scan left to right: for each index i, check if nums[i] == target.",
    " If not found after one full pass, return -1.",
    " Correct and easy to reason about, but the problem asks for O(log n) on a rotated sorted array.",
    " Time: O(n). Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    34,
    '"Let me start with brute force to lock in the logic.',
    " Run standard binary search once to find any index of target.",
    " Then expand left and right from that index while values still equal target.",
    " Works, but we can do both boundaries in one modified binary search pass.",
    " Time: O(log n) for search + O(k) for expansion. Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    49,
    '"Let me start with brute force to lock in the logic.',
    " For every pair of strings, sort both and check if the sorted forms match.",
    " If they match, put them in the same group; merge groups as we go.",
    " Correct, but comparing all pairs is expensive when n is large.",
    " Time: O(n^2 * m log m). Space: O(n * m).",
    ' Should I go ahead and optimize?"',
)
_add(
    153,
    '"Let me start with brute force to lock in the logic.',
    " Linear scan from index 0: track the smallest value seen so far.",
    " The first place where nums[i] > nums[i+1] marks the rotation pivot candidate.",
    " Return that minimum - correct on small inputs, but we can binary-search the pivot.",
    " Time: O(n). Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    217,
    '"Let me start with brute force to lock in the logic.',
    " Check every pair (i, j) with j > i; if nums[i] == nums[j], return true immediately.",
    " If no duplicate pair exists after all checks, return false.",
    " Simple and correct, but nested loops blow up on large arrays.",
    " Time: O(n^2). Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    315,
    '"Let me start with brute force to lock in the logic.',
    " For each index i, scan every element to its right and count how many are smaller than nums[i].",
    " Store those counts in an output array.",
    " Correct, but the inner scan makes this quadratic overall.",
    " Time: O(n^2). Space: O(1) besides output.",
    ' Should I go ahead and optimize?"',
)
_add(
    487,
    '"Let me start with brute force to lock in the logic.',
    " Try every substring with two nested indices left and right.",
    " Count zeros inside; if zeros <= 1, track the longest valid window.",
    " Correct, but checking all windows is O(n^2).",
    " Time: O(n^2). Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    1248,
    '"Let me start with brute force to lock in the logic.',
    " Enumerate every subarray with two loops; count how many have an odd number of 1s.",
    " Straightforward prefix/suffix parity check per window.",
    " Correct, but O(n^2) subarrays is too slow at n = 5*10^4.",
    " Time: O(n^2). Space: O(1).",
    ' Should I go ahead and optimize?"',
)

# --- batch 1: minor polish (9) ---
_add(
    108,
    '"Let me start with brute force to lock in the logic.',
    " Pick the middle element of nums as root, recursively build left from nums[:mid]",
    " and right from nums[mid+1:].",
    " Always produces a valid BST shape for a sorted input.",
    " Time: O(n log n) from repeated slicing. Space: O(n) for slices.",
    ' Should I go ahead and optimize?"',
)
_add(
    125,
    '"Let me start with the simplest correct approach.',
    " Copy every alphanumeric character into a cleaned list (lowercased),",
    " then compare the list to its reverse.",
    " Two passes over the string plus O(n) extra storage.",
    " Time: O(n). Space: O(n) for the cleaned copy.",
    ' Should I go ahead and optimize?"',
)
_add(
    169,
    '"Let me start with brute force to lock in the logic.',
    " Count frequency of every element with a hash map, then scan counts for any value > n/2.",
    " Correct because the majority element must appear more than half the time.",
    " Time: O(n). Space: O(n) for counts.",
    ' Should I go ahead and optimize?"',
)
_add(
    408,
    '"Let me start with brute force to lock in the logic.',
    " Expand the abbreviation letter-by-letter against word using two pointers.",
    " When we hit a digit in abbr, consume that many characters from word.",
    " Any mismatch ? false; both exhausted together ? true.",
    " Time: O(n). Space: O(1).",
    ' This is already optimal for the constraints - complexity stated clearly."',
)
_add(
    422,
    '"Let me start with brute force to lock in the logic.',
    " For each row index r, check whether word matches down column r and across row r",
    " using direct character comparisons.",
    " Four nested checks per candidate row - fine for small boards.",
    " Time: O(n * m * k) where k = len(word). Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    543,
    '"Let me start with brute force to lock in the logic.',
    " For every node, compute the height of its left and right subtrees recursively.",
    " Diameter through that node = left_height + right_height; track the global max.",
    " Recomputes heights repeatedly - correct but redundant work.",
    " Time: O(n^2) on skewed trees. Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    572,
    '"Let me start with brute force to lock in the logic.',
    " For every node in root, run the same-tree check against all of subRoot.",
    " If any starting node matches the entire subtree, return true.",
    " Correct, but rescans overlapping structure many times.",
    " Time: O(n * m). Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    977,
    '"Let me start with brute force to lock in the logic.',
    " Square every element, sort the resulting array ascending, return it.",
    " Two-pass: fill squares O(n), then sort O(n log n).",
    " Correct given unsorted input, but the array is already sorted - we can merge from both ends.",
    " Time: O(n log n). Space: O(n) for the squared copy.",
    ' Should I go ahead and optimize?"',
)
_add(
    1534,
    '"Let me start with brute force to lock in the logic.',
    " Three nested loops over indices (i, j, k) with i < j < k.",
    " Count the triplet when arr[i] + arr[j] + arr[k] <= a + b + c.",
    " Correct, but O(n^3) is too slow when n is up to 100.",
    " Time: O(n^3). Space: O(1).",
    ' Should I go ahead and optimize?"',
)

# --- batch 1: corrupted structure + graph/tree (20) ---
_add(
    133,
    '"Let me start with brute force to lock in the logic.',
    " BFS from the given node: maintain a map old_node -> new_node clone.",
    " When visiting neighbors, create clones on first sight and enqueue them.",
    " Straightforward graph copy - already the standard O(V+E) approach.",
    " Time: O(V + E). Space: O(V) for the clone map and queue.",
    ' Should I go ahead and optimize?"',
)
_add(
    200,
    '"Let me start with brute force to lock in the logic.',
    " Double loop over every grid cell. Whenever I see an unvisited \'1\',",
    " run DFS/BFS to mark the entire connected component sunk, then increment island count.",
    " Each cell visited once - correct and actually O(m*n) already.",
    " Time: O(m * n). Space: O(m * n) worst-case recursion stack or queue.",
    ' The flood-fill is the right approach; I\'ll keep it clean with in-place marking."',
)
_add(
    210,
    '"Let me start with brute force to lock in the logic.',
    " Topological sort via Kahn\'s BFS: compute indegree of every course,",
    " enqueue zero-indegree nodes, peel layers while decrementing neighbors.",
    " If we process all n courses, ordering exists; otherwise a cycle remains.",
    " Time: O(V + E). Space: O(V + E) for adjacency and indegree arrays.",
    ' Should I go ahead and optimize?"',
)
_add(
    261,
    '"Let me start with brute force to lock in the logic.',
    " Build adjacency from edges, run DFS from node 0 marking visited.",
    " After DFS, verify every node was visited and total edges equals n-1.",
    " Catches disconnected graphs and cycles in one pass.",
    " Time: O(n). Space: O(n) for adjacency + visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    310,
    '"Let me start with brute force to lock in the logic.',
    " Repeatedly peel all leaves layer by layer (nodes with degree 1), like peeling an onion.",
    " The last remaining nodes (0, 1, or 2) are the tree centroids / MHT roots.",
    " BFS leaf-removal is the standard O(n) approach for this problem.",
    " Time: O(n). Space: O(n) for adjacency and degree counts.",
    ' Should I go ahead and optimize?"',
)
_add(
    323,
    '"Let me start with brute force to lock in the logic.',
    " Union-Find: for each edge, union the two endpoints.",
    " Answer = n minus number of distinct roots after all unions.",
    " Simple DSU with path compression - O(n alpha(n)).",
    " Time: O(n alpha(n)). Space: O(n) for parent array.",
    ' Should I go ahead and optimize?"',
)
_add(
    490,
    '"Let me start with brute force to lock in the logic.',
    " DFS from entrance: at each empty cell try all 4 directions.",
    " Mark visited cells to avoid cycles; succeed if we reach the boundary.",
    " Correct path exploration on an m x n grid.",
    " Time: O(m * n). Space: O(m * n) visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    542,
    '"Let me start with brute force to lock in the logic.',
    " Multi-source BFS starting from every 0 simultaneously.",
    " First time each 1 cell is reached, its distance is minimal.",
    " Layer-by-layer BFS fills the dist matrix in one pass.",
    " Time: O(m * n). Space: O(m * n) queue + dist.",
    ' Should I go ahead and optimize?"',
)
_add(
    545,
    '"Let me start with brute force to lock in the logic.',
    " Collect four pieces separately: root val, left boundary nodes top-down,",
    " all leaves left-to-right, right boundary nodes bottom-up.",
    " Merge while skipping duplicate leaves already counted.",
    " Time: O(n). Space: O(h) recursion for leaf collection.",
    ' Should I go ahead and optimize?"',
)
_add(
    582,
    '"Let me start with brute force to lock in the logic.',
    " Build children map and indegree from the kill-pair list.",
    " BFS from the killed pid: enqueue all its direct children, then propagate kills downward.",
    " Every reachable process dies - simulates the cascade.",
    " Time: O(n). Space: O(n) for graph + queue.",
    ' Should I go ahead and optimize?"',
)
_add(
    662,
    '"Let me start with brute force to lock in the logic.',
    " BFS level-order traversal; at each level track min and max index assigned to nodes.",
    " Width of level = max_index - min_index + 1; answer is global max width.",
    " Straightforward queue-based level scan.",
    " Time: O(n). Space: O(w) queue width.",
    ' Should I go ahead and optimize?"',
)
_add(
    695,
    '"Let me start with brute force to lock in the logic.',
    " For each land cell, DFS to measure area of its island while marking visited.",
    " Track the maximum area seen across all components.",
    " Same flood-fill as Number of Islands, but accumulate area instead of count.",
    " Time: O(m * n). Space: O(m * n) stack worst case.",
    ' Should I go ahead and optimize?"',
)
_add(
    785,
    '"Let me start with brute force to lock in the logic.',
    " Try to 2-color the graph with BFS/DFS: assign color 0/1 alternating across edges.",
    " If any edge connects two nodes of the same color, graph is not bipartite.",
    " Standard coloring check on an undirected graph.",
    " Time: O(V + E). Space: O(V) color + visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    994,
    '"Let me start with brute force to lock in the logic.',
    " Multi-source BFS: enqueue all rotten oranges at minute 0.",
    " Each minute, rot all fresh neighbors; track elapsed minutes until no fresh remain.",
    " If fresh count > 0 after BFS ends, return -1.",
    " Time: O(m * n). Space: O(m * n) queue.",
    ' Should I go ahead and optimize?"',
)
_add(
    1120,
    '"Let me start with brute force to lock in the logic.',
    " Post-order DFS: for each node return (sum, count) of its subtree.",
    " Track max average = sum/count over all visited nodes.",
    " Recomputes subtree sums independently - correct O(n) post-order.",
    " Time: O(n). Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    1153,
    '"Let me start with brute force to lock in the logic.',
    " Build a map from each character to its index in the first string.",
    " Scan the second string left-to-right: next char must appear at a strictly higher index.",
    " If any char is missing or out of order, transformation is impossible.",
    " Time: O(n). Space: O(1) - fixed alphabet size 26.",
    ' Should I go ahead and optimize?"',
)
_add(
    1197,
    '"Let me start with brute force to lock in the logic.',
    " BFS on an infinite chessboard from (0,0) to (x,y).",
    " Enqueue all 8 knight moves each step; stop when target is reached.",
    " Layer count = minimum moves. Prune to first quadrant since moves are symmetric.",
    " Time: O(max(x,y)^2) BFS nodes. Space: O(max(x,y)^2) visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    1236,
    '"Let me start with brute force to lock in the logic.',
    " BFS from startUrl: fetch page, parse all links on same hostname, enqueue unvisited.",
    " Use a visited set keyed by URL string to avoid cycles.",
    " Standard single-threaded web crawler simulation.",
    " Time: O(V + E) pages + links. Space: O(V) visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    1242,
    '"Let me start with brute force to lock in the logic.',
    " Same BFS crawler as single-threaded, but dispatch each getLinks call to a worker thread.",
    " Shared visited set must be synchronized; join threads when queue is empty.",
    " Correct parallelism model for the LeetCode concurrency variant.",
    " Time: O(V + E) with parallel fetch. Space: O(V) visited + thread overhead.",
    ' Should I go ahead and optimize?"',
)
_add(
    1490,
    '"Let me start with brute force to lock in the logic.',
    " DFS clone: map each original node to a new node, recursively clone all children lists.",
    " First pass creates nodes on demand; second pass wires child pointers.",
    " Time: O(n). Space: O(n) for map + recursion.",
    ' Should I go ahead and optimize?"',
)

# --- batch 2: generic graph/tree/dp (remaining 28) ---
_add(
    124,
    '"Let me start with brute force to lock in the logic.',
    " At every node, compute max path sum through that node = node.val + max(0, left_gain) + max(0, right_gain).",
    " Recurse full tree; track global max. Recomputes subtree gains repeatedly without sharing.",
    " Time: O(n^2) worst case on skewed tree. Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    127,
    '"Let me start with brute force to lock in the logic.',
    " Build adjacency from word patterns (one-letter-apart neighbors).",
    " BFS from beginWord layer by layer until endWord is reached; each layer = one transformation.",
    " Visited set prevents revisiting words. Return BFS depth or 0 if unreachable.",
    " Time: O(N * L^2) where N = dictionary size, L = word length. Space: O(N).",
    ' Should I go ahead and optimize?"',
)
_add(
    128,
    '"Let me start with brute force to lock in the logic.',
    " Put all numbers in a hash set. For each num, if num-1 is not in set, walk num, num+1, num+2...",
    " counting streak length. Track longest streak.",
    " Each number visited once across all walks - O(n) with the set.",
    " Time: O(n). Space: O(n) set.",
    ' Should I go ahead and optimize?"',
)
_add(
    130,
    '"Let me start with brute force to lock in the logic.',
    " First pass: DFS from every border \'O\' and mark connected cells as safe (\'S\').",
    " Second pass: flip remaining \'O\' to \'X\'; restore safe cells back to \'O\'.",
    " Two-pass flood fill from boundary - standard O(m*n) approach.",
    " Time: O(m * n). Space: O(m * n) recursion.",
    ' Should I go ahead and optimize?"',
)
_add(
    207,
    '"Let me start with brute force to lock in the logic.',
    " Build adjacency + indegree; Kahn BFS peels zero-indegree courses layer by layer.",
    " If we finish fewer than numCourses nodes, a cycle exists ? return false.",
    " Same topological sort as Course Schedule II, but only need boolean completion.",
    " Time: O(V + E). Space: O(V + E).",
    ' Should I go ahead and optimize?"',
)
_add(
    269,
    '"Let me start with brute force to lock in the logic.',
    " Build graph: for each adjacent pair in words, record char order u before v.",
    " Topological sort the chars; if cycle detected, no valid order.",
    " Compare words character by character to infer edges.",
    " Time: O(C) total chars. Space: O(1) - 26 letters.",
    ' Should I go ahead and optimize?"',
)
_add(
    277,
    '"Let me start with brute force to lock in the logic.',
    " Ask every other person if they know celebrity; candidate must be known by all and know nobody.",
    " Two-pass elimination: first narrow to one candidate with O(n) knows() calls, then verify.",
    " Naive all-pairs check is O(n^2) knows() calls.",
    " Time: O(n^2) naive, O(n) with elimination. Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    286,
    '"Let me start with brute force to lock in the logic.',
    " Multi-source BFS from every gate simultaneously (distance 0).",
    " Fill empty rooms layer by layer with increasing distance.",
    " Each room reached once - standard BFS on grid.",
    " Time: O(m * n). Space: O(m * n) queue.",
    ' Should I go ahead and optimize?"',
)
_add(
    297,
    '"Let me start with brute force to lock in the logic.',
    " Serialize: preorder traversal with \'null\' markers for empty children ? comma string.",
    " Deserialize: split queue, rebuild tree recursively matching preorder order.",
    " Correct but string can be long; BFS level-order encoding is more compact.",
    " Time: O(n). Space: O(n) output string.",
    ' Should I go ahead and optimize?"',
)
_add(
    305,
    '"Let me start with brute force to lock in the logic.',
    " After each addLand, scan the whole grid and flood-fill count islands from scratch.",
    " k addLand calls each trigger full O(m*n) recount - too slow when k is large.",
    " Time: O(k * m * n). Space: O(m * n) per flood.",
    ' Should I go ahead and optimize?"',
)
_add(
    317,
    '"Let me start with brute force to lock in the logic.',
    " For each empty cell, BFS to sum distances to all buildings.",
    " Track total distance per cell; answer is cell with minimum total (must reach all buildings).",
    " Repeat BFS from every building - O(B * m * n) where B = buildings.",
    " Time: O(B * m * n). Space: O(m * n) BFS state.",
    ' Should I go ahead and optimize?"',
)
_add(
    329,
    '"Let me start with brute force to lock in the logic.',
    " DFS from every cell with memo: longest increasing path starting at (r,c).",
    " Only move to strictly larger neighbors; memo avoids recomputing subpaths.",
    " Without memo, pure DFS retries paths exponentially.",
    " Time: O(m * n) with memo. Space: O(m * n) memo + stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    333,
    '"Let me start with brute force to lock in the logic.',
    " For every node as root of a candidate subtree, validate BST property recursively",
    " (min/max bounds) and count nodes if valid. Track global max count.",
    " Revalidates overlapping subtrees - O(n^2) worst case.",
    " Time: O(n^2). Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    366,
    '"Let me start with brute force to lock in the logic.',
    " Repeatedly find all current leaves (no children), remove them, append to result level.",
    " Each round peels one tree layer - like reverse level-order.",
    " Time: O(n^2) if we rescan whole tree each round. Space: O(n) output.",
    ' Should I go ahead and optimize?"',
)
_add(
    410,
    '"Let me start with brute force to lock in the logic.',
    " Try every split of nums into k contiguous groups (DP over partition points).",
    " For each split, max subarray sum = largest group sum; minimize that over splits.",
    " State space explodes without binary search on the answer.",
    " Time: exponential / O(n^k) naive partitions. Space: O(n) recursion.",
    ' Should I go ahead and optimize?"',
)
_add(
    417,
    '"Let me start with brute force to lock in the logic.',
    " From each cell, DFS to see if it can reach both Pacific (top/left border) and Atlantic (bottom/right).",
    " Re-run DFS per cell - O((m*n)^2) naive.",
    " Time: O((m * n)^2) naive per-cell DFS. Space: O(m * n) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    437,
    '"Let me start with brute force to lock in the logic.',
    " Prefix-sum map: as DFS walks, track cumulative sum from root.",
    " At each node, add count of prefix sums equal to (current_sum - target) - includes paths through node.",
    " Backtrack prefix counts when leaving node.",
    " Time: O(n). Space: O(n) prefix map + stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    549,
    '"Let me start with brute force to lock in the logic.',
    " At each node, run DFS tracking consecutive count when child.val == parent.val + 1.",
    " Reset count when streak breaks. Track global max streak length.",
    " Visits every node once with O(n) DFS per starting node worst case O(n^2).",
    " Time: O(n^2) naive. Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    668,
    '"Let me start with brute force to lock in the logic.',
    " Collect all m*n products into a list, sort, return kth element.",
    " Correct but materializes every product - O(mn log(mn)) time and O(mn) space.",
    " Time: O(m * n * log(m * n)). Space: O(m * n).",
    ' Should I go ahead and optimize?"',
)
_add(
    685,
    '"Let me start with brute force to lock in the logic.',
    " Build indegree + parent map from edges. Node with indegree 2 is the duplicate child candidate.",
    " Detect cycle with DFS or union-find on the graph minus one suspicious edge.",
    " Try removing each duplicate edge until graph becomes a valid tree.",
    " Time: O(n) with careful case analysis. Space: O(n).",
    ' Should I go ahead and optimize?"',
)
_add(
    694,
    '"Let me start with brute force to lock in the logic.',
    " DFS each island; encode shape as a string of moves (U/D/L/R) from start cell.",
    " Add shape string to a set - distinct shapes = set size.",
    " Must normalize starting cell and direction encoding consistently.",
    " Time: O(m * n). Space: O(m * n) shapes.",
    ' Should I go ahead and optimize?"',
)
_add(
    710,
    '"Let me start with brute force to lock in the logic.',
    " Store all non-blacklisted ids in a list; pick random index.",
    " If blacklist is small, filter on each pick - O(n) per draw.",
    " Time: O(n) per pick naive. Space: O(n) whitelist.",
    ' Should I go ahead and optimize?"',
)
_add(
    721,
    '"Let me start with brute force to lock in the logic.',
    " Union-Find on emails: union every email in the same account list.",
    " Group emails by root parent; sort each merged list for output.",
    " Time: O(N log N) for sorting emails. Space: O(N) DSU.",
    ' Should I go ahead and optimize?"',
)
_add(
    773,
    '"Let me start with brute force to lock in the logic.',
    " BFS on board states: encode 2x3 board as tuple string; enqueue all legal swaps of \'0\'.",
    " First time we reach target state, return move count.",
    " State space is at most 6! = 720 permutations.",
    " Time: O(6!). Space: O(6!) visited states.",
    ' Should I go ahead and optimize?"',
)
_add(
    774,
    '"Let me start with brute force to lock in the logic.',
    " Binary search on the maximum distance between adjacent stations.",
    " For candidate d, check if we can add k stations so all gaps <= d (greedy fill).",
    " Brute: try every real-valued spacing without binary search - continuous search space.",
    " Time: O(n * precision) naive scan. Space: O(1).",
    ' Should I go ahead and optimize?"',
)
_add(
    815,
    '"Let me start with brute force to lock in the logic.',
    " Build stop->routes map. BFS from source stop; each hop can board any route containing current stop.",
    " Track min buses to reach target; mark routes visited to avoid reboarding.",
    " Time: O(R * S) routes and stops. Space: O(R + S).",
    ' Should I go ahead and optimize?"',
)
_add(
    863,
    '"Let me start with brute force to lock in the logic.',
    " Build parent map via BFS/DFS from target. For each query node, walk parent pointers",
    " until reaching target; collect distance. O(n) per query naive.",
    " Time: O(n * Q) for Q queries. Space: O(n) parent map.",
    ' Should I go ahead and optimize?"',
)
_add(
    1036,
    '"Let me start with brute force to lock in the logic.',
    " BFS from start cell; at each step try all 4 directions.",
    " Track visited cells; if we revisit within <= 500 moves, we are in a loop ? false.",
    " If we escape bounds within 500 steps per problem rule ? true.",
    " Time: O(m * n * 500) worst case. Space: O(m * n) visited.",
    ' Should I go ahead and optimize?"',
)
_add(
    1074,
    '"Let me start with brute force to lock in the logic.',
    " Compute 2D prefix sums, then enumerate all submatrix top-left and bottom-right corners.",
    " For each submatrix, O(1) range sum check against target.",
    " Four nested loops over corners - O(n^2 * m^2) submatrices.",
    " Time: O(n^2 * m^2). Space: O(n * m) prefix grid.",
    ' Should I go ahead and optimize?"',
)
_add(
    1136,
    '"Let me start with brute force to lock in the logic.',
    " Topological sort with indegree: each semester take all courses whose prerequisites are done.",
    " Increment semester count each round; if no course can be taken but some remain, impossible.",
    " Same Kahn BFS layered by semester.",
    " Time: O(V + E). Space: O(V + E).",
    ' Should I go ahead and optimize?"',
)
_add(
    1192,
    '"Let me start with brute force to lock in the logic.',
    " Find bridges with Tarjan low-link DFS: edge (u,v) is critical if low[v] > disc[u].",
    " One DFS pass tracks discovery time and lowest reachable.",
    " Naive alternative: remove each edge and test connectivity - O(E * (V+E)).",
    " Time: O(V + E) with Tarjan. Space: O(V + E).",
    ' Should I go ahead and optimize?"',
)
_add(
    1235,
    '"Let me start with brute force to lock in the logic.',
    " Sort jobs by end time. DP over index: dp[i] = max profit taking job i plus best non-overlapping before i.",
    " For each i, scan all j < i for compatibility - O(n^2) DP.",
    " Time: O(n^2). Space: O(n) DP + sort.",
    ' Should I go ahead and optimize?"',
)
_add(
    1522,
    '"Let me start with brute force to lock in the logic.',
    " Two-pass DFS diameter: for each node, longest path through it = sum of top two child depths.",
    " Same as binary tree diameter but children list instead of left/right.",
    " Time: O(n). Space: O(h) stack.",
    ' Should I go ahead and optimize?"',
)
_add(
    1650,
    '"Let me start with brute force to lock in the logic.',
    " Each node has a parent pointer. Walk both nodes up with a visited set until they meet.",
    " First node seen twice is LCA. Like intersecting two linked lists.",
    " Time: O(h). Space: O(h) visited set.",
    ' Should I go ahead and optimize?"',
)

"""
LeetMastery — Pattern Recognition Cheat Sheet  COLORED
Rich per-pattern colors, dark code panels, all text bold.
Superscripts (O(2^n), 10^9) rendered correctly — no black boxes.

Usage:
  python3 generate_cheatsheet_colored.py
  -> LeetMastery_Cheatsheet_Colored.pdf
"""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUTPUT = Path(__file__).parent / "LeetMastery_Cheatsheet_Colored.pdf"

DARK      = HexColor("#0F172A")
GRAY_700  = HexColor("#374151")
GRAY_200  = HexColor("#E5E7EB")
GRAY_100  = HexColor("#F3F4F6")
WHITE     = white

# ── Unicode superscript → ReportLab <super> markup ──────────────────────────
SUPER_MAP = {
    'ⁿ': '<super>n</super>',
    '⁰': '<super>0</super>', '¹': '<super>1</super>', '²': '<super>2</super>',
    '³': '<super>3</super>', '⁴': '<super>4</super>', '⁵': '<super>5</super>',
    '⁶': '<super>6</super>', '⁷': '<super>7</super>', '⁸': '<super>8</super>',
    '⁹': '<super>9</super>',
}

def esc(s: str) -> str:
    """Escape &, <, > for code blocks (literal text only, no markup)."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def rt(s: str) -> str:
    """Rich text: escape &, convert Unicode superscripts to ReportLab markup."""
    s = s.replace("&", "&amp;")
    for uni, tag in SUPER_MAP.items():
        s = s.replace(uni, tag)
    return s

def dark_panel(hex_color: str, factor: float = 0.20) -> HexColor:
    """Very dark tint of the pattern color — for code box backgrounds."""
    c = HexColor(hex_color)
    r = max(8, int(c.red   * factor * 255))
    g = max(8, int(c.green * factor * 255))
    b = max(8, int(c.blue  * factor * 255))
    return HexColor("#{:02X}{:02X}{:02X}".format(r, g, b))

def header_color(hex_color: str) -> HexColor:
    """Darken bright colors so white header text stays readable (contrast >= 3:1)."""
    c = HexColor(hex_color)
    lum = 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue
    if lum < 0.50:
        return c   # already dark enough for white text
    # Darken by ~45 % to push luminance below 0.50
    f = 0.55
    r = int(c.red * f * 255)
    g = int(c.green * f * 255)
    b = int(c.blue * f * 255)
    return HexColor("#{:02X}{:02X}{:02X}".format(r, g, b))


# ── Pattern data (same order as original cheatsheet, fewest → most qs) ───────
PATTERNS = [
    {
        "name": "Graphs",        "color": "#EF4444",  "qs": 5,
        "signals": ["Weighted shortest path", "Cycle in undirected graph (Union-Find)",
                    "Dependencies / prereqs (topo sort)", "SCC / bridges"],
        "trick": "Dijkstra for weighted SP. Union-Find for connectivity. Topo sort for ordering.",
        "code": "dist={n:inf for n in g}; dist[src]=0; pq=[(0,src)]\nwhile pq:\n  d,u=heappop(pq)\n  for v,w in g[u]:\n    if d+w<dist[v]: dist[v]=d+w; heappush(pq,(dist[v],v))",
        "time": "O(E log V)", "space": "O(V+E)",
        "classics": ["Cheapest Flights K Stops", "Network Delay Time", "Redundant Connection", "Alien Dictionary"],
    },
    {
        "name": "Greedy",        "color": "#22C55E",  "qs": 6,
        "signals": ["Maximize/minimize over intervals", "Local choice never hurts globally",
                    "Sort first, then single scan", "Jump game / scheduling"],
        "trick": "Sort by a key (end time, reach, price). Prove greedy is safe, then code it.",
        "code": "intervals.sort(key=lambda x:x[0])\nres=[intervals[0]]\nfor s,e in intervals[1:]:\n  if s<=res[-1][1]: res[-1][1]=max(res[-1][1],e)\n  else: res.append([s,e])",
        "time": "O(n log n)", "space": "O(1)",
        "classics": ["Jump Game", "Gas Station", "Merge Intervals", "Meeting Rooms II", "Task Scheduler"],
    },
    {
        "name": "JavaScript",    "color": "#EAB308",  "qs": 7,
        "signals": ["Closure / variable capture", "Prototype / class implementation",
                    "Async / Promise / event loop", "Throttle / debounce / memoize"],
        "trick": "Closures capture the reference, not value. Use let in loops. Arrow functions inherit this.",
        "code": "function memoize(fn){\n  const cache=new Map();\n  return (...args)=>{\n    const k=JSON.stringify(args);\n    if(!cache.has(k)) cache.set(k,fn(...args));\n    return cache.get(k);\n  };\n}",
        "time": "O(1) cached", "space": "O(n) cache",
        "classics": ["Memoize", "Debounce", "Promise Pool", "Curry", "Deep Equal"],
    },
    {
        "name": "String",        "color": "#0EA5E9",  "qs": 8,
        "signals": ["Longest / shortest substring with condition",
                    "Anagram / palindrome", "Pattern matching in text", "Encode / decode"],
        "trick": "Char freq array (size 26) beats hash map. Expand around centre for palindromes.",
        "code": "res=''\nfor i in range(len(s)):\n  for l,r in [(i,i),(i,i+1)]:\n    while l>=0 and r<len(s) and s[l]==s[r]: l-=1;r+=1\n    if r-l-1>len(res): res=s[l+1:r]",
        "time": "O(n)–O(n\u00b2)", "space": "O(1)–O(n)",
        "classics": ["Longest Palindromic Substring", "Min Window Substring", "Valid Anagram", "Encode & Decode"],
    },
    {
        "name": "Sliding Window","color": "#06B6D4",  "qs": 9,
        "signals": ["Longest/shortest contiguous subarray or substring",
                    "Subarray with sum/distinct chars/anagram condition", "Fixed window of size k"],
        "trick": "Expand r always. Shrink l only when window violates constraint. Track state incrementally.",
        "code": "l=0\nfor r in range(len(s)):\n  # add s[r] to state\n  while window_invalid:\n    # remove s[l]; l+=1\n    pass\n  res=max(res, r-l+1)",
        "time": "O(n)", "space": "O(k)",
        "classics": ["Longest Substring Without Repeating", "Min Window Substring", "Best Time Buy & Sell"],
    },
    {
        "name": "Sorting",       "color": "#84CC16",  "qs": 9,
        "signals": ["Custom ordering (freq, digits, interval)", "k-th element in O(n) avg",
                    "Merge sorted arrays / count inversions"],
        "trick": "Sorting first turns O(n\u00b2) brute into O(n log n). Quickselect for k-th in O(n) avg.",
        "code": "# Quickselect (k-th largest)\ndef qs(a,k):\n  p=a[len(a)//2]\n  lo,mi,hi=[x for x in a if x>p],[x for x in a if x==p],[x for x in a if x<p]\n  if k<=len(lo): return qs(lo,k)\n  if k<=len(lo)+len(mi): return p\n  return qs(hi,k-len(lo)-len(mi))",
        "time": "O(n log n) sort / O(n) quickselect", "space": "O(n)",
        "classics": ["Kth Largest Element", "Sort Colors", "Largest Number", "Merge Intervals"],
    },
    {
        "name": "Bit Manipulation","color": "#4F46E5","qs": 10,
        "signals": ["Single number among pairs", "Power of 2 / count set bits",
                    "Generate all 2\u207f subsets with bitmask", "XOR properties"],
        "trick": "a XOR a=0; a XOR 0=a. n&(n-1) clears lowest set bit. 1<<i tests bit i.",
        "code": "# XOR to find single number\nres=0\nfor n in nums: res^=n\nreturn res\n\n# count set bits\nc=0\nwhile n: n&=n-1; c+=1",
        "time": "O(n) or O(1)", "space": "O(1)",
        "classics": ["Single Number", "Number of 1 Bits", "Counting Bits", "Missing Number", "Sum of Two Integers"],
    },
    {
        "name": "BFS",           "color": "#3B82F6",  "qs": 10,
        "signals": ["Shortest path in unweighted graph / grid", "Minimum steps / hops",
                    "Level-order traversal", "Spread simulation (fire, rot)"],
        "trick": "Each BFS level = one step. First time you reach the target = shortest path.",
        "code": "from collections import deque\nq=deque([start]); vis={start}; steps=0\nwhile q:\n  for _ in range(len(q)):\n    u=q.popleft()\n    for v in graph[u]:\n      if v not in vis: vis.add(v);q.append(v)\n  steps+=1",
        "time": "O(V+E)", "space": "O(V)",
        "classics": ["Word Ladder", "Rotting Oranges", "Walls and Gates", "Binary Tree Level Order"],
    },
    {
        "name": "Backtracking",  "color": "#F43F5E",  "qs": 10,
        "signals": ["Generate ALL combinations / permutations / subsets",
                    "Constraint satisfaction (N-Queens, Sudoku)", "'How many ways' with pruning"],
        "trick": "Choose -> recurse -> unchoose. Prune BEFORE recursing to eliminate exponential branches.",
        "code": "def bt(start, path):\n  if is_solution(path): res.append(list(path)); return\n  for i in range(start, len(choices)):\n    if not valid(choices[i], path): continue\n    path.append(choices[i])\n    bt(i+1, path)\n    path.pop()",
        "time": "O(2\u207f) or O(n!)", "space": "O(n)",
        "classics": ["Subsets", "Combination Sum", "Permutations", "Palindrome Partitioning", "N-Queens"],
    },
    {
        "name": "Trie",          "color": "#7C3AED",  "qs": 12,
        "signals": ["Prefix search / autocomplete", "'Starts with' queries over word list",
                    "Word dictionary with wildcard (.)", "Max XOR pair (binary trie)"],
        "trick": "Each node = children dict + isEnd flag. Insert/search both O(L), L = word length.",
        "code": "class Node:\n  def __init__(self): self.c={}; self.end=False\nroot=Node()\ndef insert(w):\n  n=root\n  for ch in w: n=n.c.setdefault(ch,Node())\n  n.end=True",
        "time": "O(L) per op", "space": "O(total chars)",
        "classics": ["Implement Trie", "Add & Search Words", "Word Search II"],
    },
    {
        "name": "Math",          "color": "#64748B",  "qs": 12,
        "signals": ["Prime / GCD / LCM / factorial", "Digit manipulation",
                    "Modular arithmetic (mod 10\u2079+7)", "Geometry / coordinates"],
        "trick": "math.gcd(a,b). Fast power: x**n%mod in O(log n). Sieve for all primes to n.",
        "code": "# Fast modular exponentiation\ndef pow_mod(x,n,mod):\n  res=1; x%=mod\n  while n>0:\n    if n&1: res=res*x%mod\n    x=x*x%mod; n>>=1\n  return res",
        "time": "O(log n)–O(n log log n)", "space": "O(1)–O(n)",
        "classics": ["Pow(x,n)", "Count Primes", "Happy Number", "Excel Sheet Column"],
    },
    {
        "name": "Arrays & Hashing","color": "#4F46E5","qs": 18,
        "signals": ["Find pair/triple with target sum", "Duplicates or frequency counts",
                    "Group by property (anagram, prefix)", "O(1) lookup over unsorted data"],
        "trick": "Trade O(n\u00b2) time -> O(n) by storing seen values or counts in a hash map.",
        "code": "seen={}\nfor i,x in enumerate(nums):\n  if target-x in seen:\n    return [seen[target-x],i]\n  seen[x]=i",
        "time": "O(n)", "space": "O(n)",
        "classics": ["Two Sum", "Group Anagrams", "Top K Frequent", "Longest Consecutive"],
    },
    {
        "name": "Two Pointers",  "color": "#10B981",  "qs": 19,
        "signals": ["Sorted array / string", "Pair/triplet with target sum",
                    "In-place removal or compression", "Palindrome check"],
        "trick": "l & r start at opposite ends, converge based on comparison — replaces inner loop.",
        "code": "l,r=0,len(a)-1\nwhile l<r:\n  if a[l]+a[r]==target: return [l,r]\n  elif a[l]+a[r]<target: l+=1\n  else: r-=1",
        "time": "O(n)", "space": "O(1)",
        "classics": ["3Sum", "Container With Most Water", "Trapping Rain Water", "Valid Palindrome"],
    },
    {
        "name": "Matrix",        "color": "#059669",  "qs": 20,
        "signals": ["2D grid — flood fill, spreading, reachability",
                    "Rotate / transpose / spiral traverse", "Count regions or mark cells"],
        "trick": "Treat grid as graph. BFS/DFS with 4-directional neighbours. (r,c) as node id.",
        "code": "dirs=[(0,1),(0,-1),(1,0),(-1,0)]\ndef dfs(r,c):\n  if not(0<=r<m and 0<=c<n): return\n  if vis[r][c] or grid[r][c]!=t: return\n  vis[r][c]=True\n  for dr,dc in dirs: dfs(r+dr,c+dc)",
        "time": "O(m\u00b7n)", "space": "O(m\u00b7n)",
        "classics": ["Set Matrix Zeroes", "Spiral Matrix", "Rotate Image", "Word Search", "01 Matrix"],
    },
    {
        "name": "Heap",          "color": "#A855F7",  "qs": 20,
        "signals": ["k-th largest / smallest", "Top-k frequent elements",
                    "Merge k sorted lists", "Running median from stream"],
        "trick": "Min-heap of size k keeps k largest seen. heappushpop stays bounded in O(log k).",
        "code": "import heapq\nheap=[]\nfor x in nums:\n  heapq.heappush(heap,x)\n  if len(heap)>k: heapq.heappop(heap)\nreturn heap[0]  # k-th largest",
        "time": "O(n log k)", "space": "O(k)",
        "classics": ["Kth Largest Element", "Top K Frequent", "Find Median from Stream", "Merge K Sorted Lists"],
    },
    {
        "name": "Linked List",   "color": "#EC4899",  "qs": 23,
        "signals": ["Reverse list / sub-list in-place", "Detect / remove cycle",
                    "Merge two sorted lists", "Find middle or k-th from end"],
        "trick": "Dummy head eliminates edge cases. Fast/slow pointers find middle & cycle in O(1) space.",
        "code": "slow=fast=head\nwhile fast and fast.next:\n  slow=slow.next\n  fast=fast.next.next\n# slow is at the middle",
        "time": "O(n)", "space": "O(1)",
        "classics": ["Reverse Linked List", "Merge Two Sorted Lists", "Linked List Cycle", "Reorder List"],
    },
    {
        "name": "DFS",           "color": "#6366F1",  "qs": 23,
        "signals": ["Connected components / island counting", "Explore all paths or reachable nodes",
                    "Cycle detection (directed graph)", "Topological order"],
        "trick": "Mark visited BEFORE recursing. Use state 0/1/2 for directed-graph cycle detection.",
        "code": "vis=set()\ndef dfs(node):\n  if node in vis: return\n  vis.add(node)\n  for nb in graph[node]: dfs(nb)\nfor n in all_nodes:\n  if n not in vis: dfs(n)",
        "time": "O(V+E)", "space": "O(V)",
        "classics": ["Number of Islands", "Pacific Atlantic", "Course Schedule", "Clone Graph"],
    },
    {
        "name": "Binary Search", "color": "#F97316",  "qs": 24,
        "signals": ["Sorted array — find target / first position", "'Minimize the maximum' / 'feasible at k?'",
                    "Monotone yes/no search space", "O(log n) required"],
        "trick": "If you can write feasible(k) that is monotone, binary search on the answer space.",
        "code": "lo,hi=0,len(nums)-1\nwhile lo<=hi:\n  mid=(lo+hi)//2\n  if feasible(mid): hi=mid-1\n  else: lo=mid+1\nreturn lo",
        "time": "O(log n)", "space": "O(1)",
        "classics": ["Binary Search", "Search Rotated Array", "Koko Eating Bananas", "Median of Two Sorted"],
    },
    {
        "name": "Dynamic Programming","color": "#D946EF","qs": 24,
        "signals": ["Count ways / min cost / max value", "Overlapping subproblems",
                    "Optimal substructure", "Take vs skip / match vs skip decisions"],
        "trick": "Define dp[i] clearly, write recurrence, set base case. Bottom-up avoids stack overflow.",
        "code": "# House Robber template\ndp=[0]*(n+1)\ndp[0]=0; dp[1]=nums[0]\nfor i in range(2,n+1):\n  dp[i]=max(dp[i-1], dp[i-2]+nums[i-1])\nreturn dp[n]",
        "time": "O(n)–O(n\u00b7W)", "space": "O(n)->O(1) rolling",
        "classics": ["Climbing Stairs", "Coin Change", "LCS", "Edit Distance", "Partition Equal Subset"],
    },
    {
        "name": "Stack",         "color": "#F59E0B",  "qs": 25,
        "signals": ["Next greater / smaller element", "Balanced parentheses",
                    "Evaluate expression (RPN, calculator)", "Monotone stack needed"],
        "trick": "Stack holds 'unresolved' elements. Pop when the current element resolves them.",
        "code": "stack=[]\nfor x in arr:\n  while stack and stack[-1]<x:\n    result[stack.pop()]=x\n  stack.append(x)",
        "time": "O(n)", "space": "O(n)",
        "classics": ["Daily Temperatures", "Valid Parentheses", "Largest Rectangle in Histogram", "Min Stack"],
    },
    {
        "name": "Trees & BST",   "color": "#16A34A",  "qs": 37,
        "signals": ["Any tree traversal (pre/in/post/level)", "Path sum, diameter, LCA, max depth",
                    "BST: validate, k-th smallest, successor", "Construct tree from traversals"],
        "trick": "DFS returning a value propagates info bottom-up in one O(n) pass. Inorder BST = sorted.",
        "code": "def dfs(node):\n  if not node: return base_case\n  L=dfs(node.left)\n  R=dfs(node.right)\n  # update global answer if needed\n  return combine(node.val,L,R)",
        "time": "O(n)", "space": "O(h)",
        "classics": ["Max Depth", "Diameter", "Validate BST", "LCA", "Binary Tree Max Path Sum", "Serialize"],
    },
]


def make_pdf():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.38 * inch,
        rightMargin=0.38 * inch,
        topMargin=0.34 * inch,
        bottomMargin=0.28 * inch,
    )
    PW  = letter[0] - 0.76 * inch   # usable page width
    GAP = 0.10 * inch
    COL = (PW - GAP) / 2            # each column width

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    title_s = S("ti", fontSize=11, fontName="Helvetica-Bold",
                textColor=DARK, alignment=TA_CENTER, spaceAfter=1)
    sub_s   = S("su", fontSize=6.5, fontName="Helvetica-Bold",
                textColor=HexColor("#6B7280"), alignment=TA_CENTER, spaceAfter=4)
    foot_s  = S("fo", fontSize=6, fontName="Helvetica-Bold",
                textColor=HexColor("#6B7280"), alignment=TA_CENTER)

    def make_card(pat):
        c_hex  = pat["color"]
        hdr_bg = header_color(c_hex)       # darkened if bright
        panel  = dark_panel(c_hex, 0.20)   # very dark for code box
        cw     = COL - 2                   # inner content width

        # ── Header: full color bg, white bold text ────────────────────────────
        hdr_name = Paragraph(
            f'<font color="white"><b>{rt(pat["name"])}</b></font>  '
            f'<font size="5.5" color="#E0E7FF"><b>({pat["qs"]} qs)</b></font>',
            S(f"hn{c_hex}", fontSize=7.5, fontName="Helvetica-Bold",
              textColor=WHITE, leading=9),
        )
        hdr_cx = Paragraph(
            f'<font color="#E0E7FF"><b>{rt(pat["time"])}  ·  {rt(pat["space"])}</b></font>',
            S(f"hc{c_hex}", fontSize=5.8, fontName="Helvetica-Bold",
              textColor=WHITE, leading=9, alignment=TA_RIGHT),
        )
        hdr = Table([[hdr_name, hdr_cx]], colWidths=[cw * 0.57, cw * 0.43])
        hdr.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), hdr_bg),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))

        # ── Body ─────────────────────────────────────────────────────────────
        body = []

        # "Spot it when:"
        body.append(Paragraph(
            f'<font color="{c_hex}"><b>Spot it when:</b></font>',
            S(f"sl{c_hex}", fontSize=6, fontName="Helvetica-Bold",
              textColor=HexColor(c_hex), leading=8, spaceAfter=1),
        ))
        for sig in pat["signals"]:
            body.append(Paragraph(
                f"<b>&#8226;</b> {rt(sig)}",
                S(f"sb{c_hex}{sig[:4]}", fontSize=5.8, fontName="Helvetica-Bold",
                  textColor=DARK, leading=7.2, leftIndent=4, spaceAfter=0),
            ))

        # Key trick
        body.append(Spacer(1, 2))
        body.append(Paragraph(
            f'<font color="{c_hex}"><b>Key trick:</b></font>  <b>{rt(pat["trick"])}</b>',
            S(f"tr{c_hex}", fontSize=5.8, fontName="Helvetica-Bold",
              textColor=DARK, leading=7.2),
        ))

        # Code block — dark panel, white Courier-Bold
        body.append(Spacer(1, 2))
        code_p = Paragraph(
            esc(pat["code"]).replace("\n", "<br/>"),
            S(f"cd{c_hex}", fontSize=5.4, fontName="Courier-Bold",
              textColor=WHITE, leading=6.8, leftIndent=2),
        )
        code_box = Table([[code_p]], colWidths=[cw - 8])
        code_box.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), panel),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 3),
        ]))
        body.append(code_box)

        # Classics
        body.append(Spacer(1, 2))
        body.append(Paragraph(
            f'<font color="{c_hex}"><b>Classics:</b></font>  '
            + "  <b>·</b>  ".join(f"<b>{rt(cl)}</b>" for cl in pat["classics"]),
            S(f"cl{c_hex}", fontSize=5.5, fontName="Helvetica-Bold",
              textColor=GRAY_700, leading=6.8),
        ))

        body_cell = Table([[body]], colWidths=[cw])
        body_cell.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), WHITE),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("BOX",           (0, 0), (-1, -1), 0.3, GRAY_200),
        ]))

        return [hdr, body_cell, Spacer(1, 4)]

    # ── 2-column grid ─────────────────────────────────────────────────────────
    left  = [item for i, p in enumerate(PATTERNS) if i % 2 == 0 for item in make_card(p)]
    right = [item for i, p in enumerate(PATTERNS) if i % 2 == 1 for item in make_card(p)]

    while len(right) < len(left): right.append(Spacer(1, 1))
    while len(left)  < len(right): left.append(Spacer(1, 1))

    grid = Table(list(zip(left, right)), colWidths=[COL, COL])
    grid.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (0, -1),  int(GAP)),
        ("RIGHTPADDING",  (1, 0), (1, -1),  0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    story = []
    story.append(Paragraph(
        "LeetMastery — Pattern Recognition Cheat Sheet",
        title_s,
    ))
    story.append(Paragraph(
        "21 patterns · ordered fewest → most questions · "
        "signals tell you WHAT to reach for — practice builds HOW",
        sub_s,
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_200, spaceAfter=5))
    story.append(grid)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.3, color=GRAY_200, spaceAfter=2))
    story.append(Paragraph("LeetMastery · leetcodemr.com", foot_s))

    doc.build(story)
    kb = OUTPUT.stat().st_size // 1024
    print(f"  {OUTPUT}  ({kb} KB, {_page_count(OUTPUT)} page(s))")


def _page_count(path: Path) -> int:
    try:
        from pypdf import PdfReader
        return len(PdfReader(str(path)).pages)
    except Exception:
        return "?"


if __name__ == "__main__":
    make_pdf()

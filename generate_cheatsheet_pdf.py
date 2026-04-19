"""
LeetMastery — Pattern Recognition Cheat Sheet (2 pages)
For each pattern: signals, key trick, template snippet, complexity, classics.
Ordered by ascending question count (fewest → most).

Usage:
  python3 generate_cheatsheet_pdf.py
  → LeetMastery_Cheatsheet.pdf
"""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable,
)

OUTPUT = Path(__file__).parent / "LeetMastery_Cheatsheet.pdf"

GRAY_900 = HexColor("#111827")
GRAY_700 = HexColor("#374151")
GRAY_500 = HexColor("#6B7280")
GRAY_200 = HexColor("#E5E7EB")
GRAY_100 = HexColor("#F3F4F6")
WHITE    = white


def esc(s):
    return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")


# ── Pattern data  (ordered: fewest questions → most) ──────────────────────────
PATTERNS = [
    {
        "name": "Graphs",       "color": "#EF4444",   "qs": 5,
        "signals": ["Weighted shortest path","Cycle in undirected graph (Union-Find)",
                    "Dependencies / prereqs (topo sort)","SCC / bridges"],
        "trick": "Dijkstra for weighted SP. Union-Find for connectivity. Topo sort for ordering.",
        "code": "dist={n:inf for n in g}; dist[src]=0; pq=[(0,src)]\nwhile pq:\n  d,u=heappop(pq)\n  for v,w in g[u]:\n    if d+w<dist[v]: dist[v]=d+w; heappush(pq,(dist[v],v))",
        "time": "O(E log V)", "space": "O(V+E)",
        "classics": ["Cheapest Flights K Stops","Network Delay Time","Redundant Connection","Alien Dictionary"],
    },
    {
        "name": "Greedy",       "color": "#22C55E",   "qs": 6,
        "signals": ["Maximize/minimize over intervals","Local choice never hurts globally",
                    "Sort first, then single scan","Jump game / scheduling"],
        "trick": "Sort by a key (end time, reach, price). Prove greedy is safe, then code it.",
        "code": "intervals.sort(key=lambda x:x[0])\nres=[intervals[0]]\nfor s,e in intervals[1:]:\n  if s<=res[-1][1]: res[-1][1]=max(res[-1][1],e)\n  else: res.append([s,e])",
        "time": "O(n log n)", "space": "O(1)",
        "classics": ["Jump Game","Gas Station","Merge Intervals","Meeting Rooms II","Task Scheduler"],
    },
    {
        "name": "JavaScript",   "color": "#EAB308",   "qs": 7,
        "signals": ["Closure / variable capture","Prototype / class implementation",
                    "Async / Promise / event loop","Throttle / debounce / memoize"],
        "trick": "Closures capture the reference, not value. Use let in loops. Arrow functions inherit this.",
        "code": "function memoize(fn){\n  const cache=new Map();\n  return (...args)=>{\n    const k=JSON.stringify(args);\n    if(!cache.has(k)) cache.set(k,fn(...args));\n    return cache.get(k);\n  };\n}",
        "time": "O(1) cached", "space": "O(n) cache",
        "classics": ["Memoize","Debounce","Promise Pool","Curry","Deep Equal"],
    },
    {
        "name": "String",       "color": "#0EA5E9",   "qs": 8,
        "signals": ["Longest / shortest substring with condition",
                    "Anagram / palindrome","Pattern matching in text","Encode / decode"],
        "trick": "Char freq array (size 26) beats hash map. Expand around centre for palindromes.",
        "code": "res=''\nfor i in range(len(s)):\n  for l,r in [(i,i),(i,i+1)]:\n    while l>=0 and r<len(s) and s[l]==s[r]: l-=1;r+=1\n    if r-l-1>len(res): res=s[l+1:r]",
        "time": "O(n)–O(n²)", "space": "O(1)–O(n)",
        "classics": ["Longest Palindromic Substring","Min Window Substring","Valid Anagram","Encode & Decode"],
    },
    {
        "name": "Sliding Window","color": "#06B6D4",   "qs": 9,
        "signals": ["Longest/shortest contiguous subarray or substring",
                    "Subarray with sum/distinct chars/anagram condition","Fixed window of size k"],
        "trick": "Expand r always. Shrink l only when window violates constraint. Track state incrementally.",
        "code": "l=0\nfor r in range(len(s)):\n  # add s[r] to state\n  while window_invalid:\n    # remove s[l]; l+=1\n    pass\n  res=max(res, r-l+1)",
        "time": "O(n)", "space": "O(k)",
        "classics": ["Longest Substring Without Repeating","Min Window Substring","Best Time Buy & Sell"],
    },
    {
        "name": "Sorting",      "color": "#84CC16",   "qs": 9,
        "signals": ["Custom ordering (freq, digits, interval)","k-th element in O(n) avg",
                    "Merge sorted arrays / count inversions"],
        "trick": "Sorting first turns O(n²) brute into O(n log n). Quickselect for k-th in O(n) avg.",
        "code": "# Quickselect (k-th largest)\ndef qs(a,k):\n  p=a[len(a)//2]\n  lo,mi,hi=[x for x in a if x>p],[x for x in a if x==p],[x for x in a if x<p]\n  if k<=len(lo): return qs(lo,k)\n  if k<=len(lo)+len(mi): return p\n  return qs(hi,k-len(lo)-len(mi))",
        "time": "O(n log n) sort / O(n) quickselect", "space": "O(n)",
        "classics": ["Kth Largest Element","Sort Colors","Largest Number","Merge Intervals"],
    },
    {
        "name": "Bit Manipulation","color": "#0F172A", "qs": 10,
        "signals": ["Single number among pairs","Power of 2 / count set bits",
                    "Generate all 2ⁿ subsets with bitmask","XOR properties"],
        "trick": "a XOR a=0; a XOR 0=a. n&(n-1) clears lowest set bit. 1&lt;&lt;i tests bit i.",
        "code": "# XOR to find single number\nres=0\nfor n in nums: res^=n\nreturn res\n\n# count set bits\nc=0\nwhile n: n&=n-1; c+=1",
        "time": "O(n) or O(1)", "space": "O(1)",
        "classics": ["Single Number","Number of 1 Bits","Counting Bits","Missing Number","Sum of Two Integers"],
    },
    {
        "name": "BFS",          "color": "#3B82F6",   "qs": 10,
        "signals": ["Shortest path in unweighted graph / grid","Minimum steps / hops",
                    "Level-order traversal","Spread simulation (fire, rot)"],
        "trick": "Each BFS level = one step. First time you reach the target = shortest path.",
        "code": "from collections import deque\nq=deque([start]); vis={start}; steps=0\nwhile q:\n  for _ in range(len(q)):\n    u=q.popleft()\n    for v in graph[u]:\n      if v not in vis: vis.add(v);q.append(v)\n  steps+=1",
        "time": "O(V+E)", "space": "O(V)",
        "classics": ["Word Ladder","Rotting Oranges","Walls and Gates","Binary Tree Level Order"],
    },
    {
        "name": "Backtracking", "color": "#F43F5E",   "qs": 10,
        "signals": ["Generate ALL combinations / permutations / subsets",
                    "Constraint satisfaction (N-Queens, Sudoku)","'How many ways' with pruning"],
        "trick": "Choose → recurse → unchoose. Prune BEFORE recursing to eliminate exponential branches.",
        "code": "def bt(start, path):\n  if is_solution(path): res.append(list(path)); return\n  for i in range(start, len(choices)):\n    if not valid(choices[i], path): continue\n    path.append(choices[i])\n    bt(i+1, path)\n    path.pop()",
        "time": "O(2ⁿ) or O(n!)", "space": "O(n)",
        "classics": ["Subsets","Combination Sum","Permutations","Palindrome Partitioning","N-Queens"],
    },
    {
        "name": "Trie",         "color": "#7C3AED",   "qs": 12,
        "signals": ["Prefix search / autocomplete","'Starts with' queries over word list",
                    "Word dictionary with wildcard (.)","Max XOR pair (binary trie)"],
        "trick": "Each node = children dict + isEnd flag. Insert/search both O(L), L = word length.",
        "code": "class Node:\n  def __init__(self): self.c={}; self.end=False\nroot=Node()\ndef insert(w):\n  n=root\n  for ch in w: n=n.c.setdefault(ch,Node())\n  n.end=True",
        "time": "O(L) per op", "space": "O(total chars)",
        "classics": ["Implement Trie","Add & Search Words","Word Search II"],
    },
    {
        "name": "Math",         "color": "#64748B",   "qs": 12,
        "signals": ["Prime / GCD / LCM / factorial","Digit manipulation",
                    "Modular arithmetic (mod 10⁹+7)","Geometry / coordinates"],
        "trick": "math.gcd(a,b). Fast power: x**n%mod in O(log n). Sieve for all primes to n.",
        "code": "# Fast modular exponentiation\ndef pow_mod(x,n,mod):\n  res=1; x%=mod\n  while n>0:\n    if n&1: res=res*x%mod\n    x=x*x%mod; n>>=1\n  return res",
        "time": "O(log n)–O(n log log n)", "space": "O(1)–O(n)",
        "classics": ["Pow(x,n)","Count Primes","Happy Number","Excel Sheet Column"],
    },
    {
        "name": "Arrays & Hashing","color": "#4F46E5","qs": 18,
        "signals": ["Find pair/triple with target sum","Duplicates or frequency counts",
                    "Group by property (anagram, prefix)","O(1) lookup over unsorted data"],
        "trick": "Trade O(n²) time → O(n) by storing seen values or counts in a hash map.",
        "code": "seen={}\nfor i,x in enumerate(nums):\n  if target-x in seen:\n    return [seen[target-x],i]\n  seen[x]=i",
        "time": "O(n)", "space": "O(n)",
        "classics": ["Two Sum","Group Anagrams","Top K Frequent","Longest Consecutive"],
    },
    {
        "name": "Two Pointers", "color": "#10B981",   "qs": 19,
        "signals": ["Sorted array / string","Pair/triplet with target sum",
                    "In-place removal or compression","Palindrome check"],
        "trick": "l & r start at opposite ends, converge based on comparison — replaces inner loop.",
        "code": "l,r=0,len(a)-1\nwhile l<r:\n  if a[l]+a[r]==target: return [l,r]\n  elif a[l]+a[r]<target: l+=1\n  else: r-=1",
        "time": "O(n)", "space": "O(1)",
        "classics": ["3Sum","Container With Most Water","Trapping Rain Water","Valid Palindrome"],
    },
    {
        "name": "Matrix",       "color": "#059669",   "qs": 20,
        "signals": ["2D grid — flood fill, spreading, reachability",
                    "Rotate / transpose / spiral traverse","Count regions or mark cells"],
        "trick": "Treat grid as graph. BFS/DFS with 4-directional neighbours. (r,c) as node id.",
        "code": "dirs=[(0,1),(0,-1),(1,0),(-1,0)]\ndef dfs(r,c):\n  if not(0<=r<m and 0<=c<n): return\n  if vis[r][c] or grid[r][c]!=t: return\n  vis[r][c]=True\n  for dr,dc in dirs: dfs(r+dr,c+dc)",
        "time": "O(m·n)", "space": "O(m·n)",
        "classics": ["Set Matrix Zeroes","Spiral Matrix","Rotate Image","Word Search","01 Matrix"],
    },
    {
        "name": "Heap",         "color": "#A855F7",   "qs": 20,
        "signals": ["k-th largest / smallest","Top-k frequent elements",
                    "Merge k sorted lists","Running median from stream"],
        "trick": "Min-heap of size k keeps k largest seen. heappushpop stays bounded in O(log k).",
        "code": "import heapq\nheap=[]\nfor x in nums:\n  heapq.heappush(heap,x)\n  if len(heap)>k: heapq.heappop(heap)\nreturn heap[0]  # k-th largest",
        "time": "O(n log k)", "space": "O(k)",
        "classics": ["Kth Largest Element","Top K Frequent","Find Median from Stream","Merge K Sorted Lists"],
    },
    {
        "name": "Linked List",  "color": "#EC4899",   "qs": 23,
        "signals": ["Reverse list / sub-list in-place","Detect / remove cycle",
                    "Merge two sorted lists","Find middle or k-th from end"],
        "trick": "Dummy head eliminates edge cases. Fast/slow pointers find middle & cycle in O(1) space.",
        "code": "slow=fast=head\nwhile fast and fast.next:\n  slow=slow.next\n  fast=fast.next.next\n# slow is at the middle",
        "time": "O(n)", "space": "O(1)",
        "classics": ["Reverse Linked List","Merge Two Sorted Lists","Linked List Cycle","Reorder List"],
    },
    {
        "name": "DFS",          "color": "#6366F1",   "qs": 23,
        "signals": ["Connected components / island counting","Explore all paths or reachable nodes",
                    "Cycle detection (directed graph)","Topological order"],
        "trick": "Mark visited BEFORE recursing. Use state 0/1/2 for directed-graph cycle detection.",
        "code": "vis=set()\ndef dfs(node):\n  if node in vis: return\n  vis.add(node)\n  for nb in graph[node]: dfs(nb)\nfor n in all_nodes:\n  if n not in vis: dfs(n)",
        "time": "O(V+E)", "space": "O(V)",
        "classics": ["Number of Islands","Pacific Atlantic Water Flow","Course Schedule","Clone Graph"],
    },
    {
        "name": "Binary Search","color": "#F97316",    "qs": 24,
        "signals": ["Sorted array — find target / first position","'Minimize the maximum' / 'feasible at k?'",
                    "Monotone yes/no search space","O(log n) required"],
        "trick": "If you can write feasible(k) that is monotone, binary search on the answer space.",
        "code": "lo,hi=0,len(nums)-1\nwhile lo<=hi:\n  mid=(lo+hi)//2\n  if feasible(mid): hi=mid-1\n  else: lo=mid+1\nreturn lo",
        "time": "O(log n)", "space": "O(1)",
        "classics": ["Binary Search","Search Rotated Array","Koko Eating Bananas","Median of Two Sorted Arrays"],
    },
    {
        "name": "Dynamic Programming","color": "#D946EF","qs": 24,
        "signals": ["Count ways / min cost / max value","Overlapping subproblems",
                    "Optimal substructure","Take vs skip / match vs skip decisions"],
        "trick": "Define dp[i] clearly, write recurrence, set base case. Bottom-up avoids stack overflow.",
        "code": "# House Robber template\ndp=[0]*(n+1)\ndp[0]=0; dp[1]=nums[0]\nfor i in range(2,n+1):\n  dp[i]=max(dp[i-1], dp[i-2]+nums[i-1])\nreturn dp[n]",
        "time": "O(n)–O(n·W)", "space": "O(n)→O(1) rolling",
        "classics": ["Climbing Stairs","Coin Change","LCS","Edit Distance","Partition Equal Subset Sum"],
    },
    {
        "name": "Stack",        "color": "#F59E0B",   "qs": 25,
        "signals": ["Next greater / smaller element","Balanced parentheses",
                    "Evaluate expression (RPN, calculator)","Monotone stack needed"],
        "trick": "Stack holds 'unresolved' elements. Pop when the current element resolves them.",
        "code": "stack=[]\nfor x in arr:\n  while stack and stack[-1]<x:\n    result[stack.pop()]=x\n  stack.append(x)",
        "time": "O(n)", "space": "O(n)",
        "classics": ["Daily Temperatures","Valid Parentheses","Largest Rectangle in Histogram","Min Stack"],
    },
    {
        "name": "Trees & BST",  "color": "#16A34A",   "qs": 37,
        "signals": ["Any tree traversal (pre/in/post/level)","Path sum, diameter, LCA, max depth",
                    "BST: validate, k-th smallest, successor","Construct tree from traversals"],
        "trick": "DFS returning a value propagates info bottom-up in one O(n) pass. Inorder BST = sorted.",
        "code": "def dfs(node):\n  if not node: return base_case\n  L=dfs(node.left)\n  R=dfs(node.right)\n  # update global answer if needed\n  return combine(node.val,L,R)",
        "time": "O(n)", "space": "O(h)",
        "classics": ["Max Depth","Diameter","Validate BST","LCA","Binary Tree Max Path Sum","Serialize"],
    },
]


def make_pdf():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.42*inch,
        rightMargin=0.42*inch,
        topMargin=0.38*inch,
        bottomMargin=0.32*inch,
    )
    PW = letter[0] - 0.84*inch          # usable page width
    GAP = 0.12*inch
    COL = (PW - GAP) / 2               # each column width

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    title_s  = S("ti", fontSize=14, fontName="Helvetica-Bold",
                 textColor=GRAY_900, alignment=TA_CENTER, spaceAfter=1)
    sub_s    = S("su", fontSize=7.5, fontName="Helvetica",
                 textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=6)
    foot_s   = S("fo", fontSize=6.5, fontName="Helvetica",
                 textColor=GRAY_500, alignment=TA_CENTER)

    def make_card(pat):
        c   = HexColor(pat["color"])
        cw  = COL - 2          # inner content width

        # ── Header band — print-friendly: light bg + coloured left stripe ────
        color_hex = pat["color"]
        hdr_name = Paragraph(
            f'<font color="{color_hex}"><b>{pat["name"]}</b></font>  '
            f'<font size="6" color="#6B7280">({pat["qs"]} qs)</font>',
            S("hn", fontSize=8, fontName="Helvetica-Bold", textColor=GRAY_900, leading=10)
        )
        hdr_cx = Paragraph(
            f"<b>{esc(pat['time'])}  ·  {pat['space']}</b>",
            S("hc", fontSize=6.5, fontName="Helvetica-Bold", textColor=GRAY_500,
              leading=10, alignment=TA_RIGHT)
        )
        hdr = Table([[hdr_name, hdr_cx]], colWidths=[cw*0.58, cw*0.42])
        hdr.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
            ("TOPPADDING",    (0,0),(-1,-1), 3),
            ("BOTTOMPADDING", (0,0),(-1,-1), 3),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
            ("RIGHTPADDING",  (0,0),(-1,-1), 5),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("LINEBEFORE",    (0,0),(0,-1),  4, c),
            ("BOX",           (0,0),(-1,-1), 0.4, GRAY_200),
        ]))

        # ── Body ──────────────────────────────────────────────────────────────
        body = []

        # Signals
        body.append(Paragraph(
            "<b>Spot it when:</b>",
            S("sl", fontSize=6.5, fontName="Helvetica-Bold",
              textColor=c, leading=8, spaceAfter=1)
        ))
        for sig in pat["signals"]:
            body.append(Paragraph(
                f"• {esc(sig)}",
                S("sb", fontSize=6.2, fontName="Helvetica",
                  textColor=GRAY_700, leading=8, leftIndent=4, spaceAfter=0)
            ))

        # Trick
        body.append(Spacer(1,2))
        body.append(Paragraph(
            f"<b>Key trick:</b> <i>{esc(pat['trick'])}</i>",
            S("tr", fontSize=6.2, fontName="Helvetica",
              textColor=GRAY_700, leading=8)
        ))

        # Code
        body.append(Spacer(1,2))
        code_html = esc(pat["code"]).replace("\n","<br/>")
        code_p = Paragraph(
            code_html,
            S("cd", fontSize=5.6, fontName="Courier",
              textColor=GRAY_700, leading=7, leftIndent=3)
        )
        code_box = Table([[code_p]], colWidths=[cw-8])
        code_box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
            ("TOPPADDING",    (0,0),(-1,-1), 3),
            ("BOTTOMPADDING", (0,0),(-1,-1), 3),
            ("LEFTPADDING",   (0,0),(-1,-1), 3),
            ("RIGHTPADDING",  (0,0),(-1,-1), 3),
            ("BOX",           (0,0),(-1,-1), 0.3, GRAY_200),
        ]))
        body.append(code_box)

        # Classics
        body.append(Spacer(1,2))
        body.append(Paragraph(
            "<b>Classics:</b>  " + "  ·  ".join(pat["classics"]),
            S("cl", fontSize=5.8, fontName="Helvetica",
              textColor=GRAY_500, leading=7)
        ))

        body_cell = Table([[body]], colWidths=[cw])
        body_cell.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), WHITE),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 5),
            ("RIGHTPADDING",  (0,0),(-1,-1), 5),
            ("BOX",           (0,0),(-1,-1), 0.4, GRAY_200),
        ]))

        return [hdr, body_cell, Spacer(1, 5)]

    # ── Build two-column grid ─────────────────────────────────────────────────
    left_items  = [item for i,p in enumerate(PATTERNS) if i%2==0 for item in make_card(p)]
    right_items = [item for i,p in enumerate(PATTERNS) if i%2==1 for item in make_card(p)]

    # Equalise lengths
    while len(right_items) < len(left_items): right_items.append(Spacer(1,1))
    while len(left_items)  < len(right_items): left_items.append(Spacer(1,1))

    # Each row of the 2-col grid is a pair of items
    grid_rows = list(zip(left_items, right_items))
    grid = Table(grid_rows, colWidths=[COL, COL])
    grid.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (1,0),(1,-1),  0),
        ("RIGHTPADDING",  (0,0),(0,-1),  int(GAP)),
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
    ]))

    story = []
    story.append(Paragraph("LeetMastery — Pattern Recognition Cheat Sheet", title_s))
    story.append(Paragraph(
        "21 patterns · ordered fewest → most questions · "
        "signals tell you WHAT to reach for — practice builds HOW",
        sub_s
    ))
    story.append(HRFlowable(width="100%", thickness=0.7, color=GRAY_200, spaceAfter=7))
    story.append(grid)
    story.append(Spacer(1,5))
    story.append(HRFlowable(width="100%", thickness=0.4, color=GRAY_200, spaceAfter=3))
    story.append(Paragraph("LeetMastery · leetcodemr.com", foot_s))

    doc.build(story)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT}  ({kb} KB)")


if __name__ == "__main__":
    make_pdf()

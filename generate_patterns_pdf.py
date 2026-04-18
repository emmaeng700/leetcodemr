"""
LeetMastery — PDF by Pattern (Final version)
• Descriptions with images from Doocs (fastly.jsdelivr.net CDN)
• All languages from SimplyLeet · WalkCC · LeetDoocs · LeetCode.ca
• LeetCode editorial text where free (56/331)
• 21 patterns, Easy → Medium → Hard within each

Usage:
  python3 generate_patterns_pdf.py              # colored (screen) → LeetMastery_By_Pattern.pdf
  python3 generate_patterns_pdf.py --printable  # light bg + dark code → LeetMastery_By_Pattern_Print.pdf
  python3 generate_patterns_pdf.py --both       # build both after one fetch pass

See docs/pattern-pdf.md for inputs/cache files.
"""

import argparse, json, os, re, time, io
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import urlopen, Request

from PIL import Image as PILImage

from pygments import lex
from pygments.lexers import get_lexer_by_name, PythonLexer
from pygments.util import ClassNotFound
from pygments.token import Token, Keyword, Name, Comment, String, Number, Operator, Punctuation

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, Image as RLImage,
)
from reportlab.lib.enums import TA_CENTER

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
QUESTIONS    = SCRIPT_DIR / "public" / "questions_full.json"
OUTPUT_PDF   = SCRIPT_DIR / "LeetMastery_By_Pattern.pdf"
OUTPUT_PDF_PRINT = SCRIPT_DIR / "LeetMastery_By_Pattern_Print.pdf"
# Printable: light gray code boxes, monochrome tokens (better on B&W / home printers)
PRINT_CODE_FG = "#111827"
PRINT_INLINE_CODE = "#374151"
DOOCS_CACHE  = SCRIPT_DIR / ".doocs_cache.json"       # desc HTML + all-lang blocks from Doocs
SITES_CACHE  = SCRIPT_DIR / ".full_langs_cache.json"  # all sites, all languages
LC_CACHE     = SCRIPT_DIR / ".lc_content_cache.json"  # editorial (already populated)
IMG_DIR      = SCRIPT_DIR / ".img_cache"
IMG_DIR.mkdir(exist_ok=True)

MAX_W = 7.0 * inch

# ── Colors ─────────────────────────────────────────────────────────────────────
INDIGO     = HexColor("#4F46E5")
GRAY_100   = HexColor("#F3F4F6")
GRAY_700   = HexColor("#374151")
GRAY_500   = HexColor("#6B7280")
GREEN      = HexColor("#16A34A")
CODE_BG    = HexColor("#282C34")
EXAMPLE_BG = HexColor("#F9FAFB")
PRINT_CODE_BG = HexColor("#F3F4F6")
PRINT_BANNER_BG = HexColor("#E5E7EB")

DIFF_COLORS = {
    "easy":   (HexColor("#D1FAE5"), HexColor("#065F46")),
    "medium": (HexColor("#FEF3C7"), HexColor("#92400E")),
    "hard":   (HexColor("#FEE2E2"), HexColor("#991B1B")),
}

LANG_COLOR = {
    "python":"#61AFEF","cpp":"#C678DD","java":"#E5A50A",
    "javascript":"#E5C07B","typescript":"#56B6C2","go":"#00ADD8",
    "rust":"#DEA584","kotlin":"#A855F7","swift":"#F05138",
    "ruby":"#E06C75","scala":"#DC2626","csharp":"#9B4F96",
    "php":"#777BB4","c":"#A8B9CC",
}
LANG_LABEL = {
    "python":"Python","cpp":"C++","java":"Java","javascript":"JavaScript",
    "typescript":"TypeScript","go":"Go","rust":"Rust","kotlin":"Kotlin",
    "swift":"Swift","ruby":"Ruby","scala":"Scala","csharp":"C#","php":"PHP","c":"C",
}
DEFAULT_LANG_COLOR = "#ABB2BF"

SITES = [
    {"key":"simplyleet","label":"SimplyLeet", "color":"#A855F7"},
    {"key":"walkccc",   "label":"WalkCC",      "color":"#3B82F6"},
    {"key":"doocs",     "label":"LeetDoocs",   "color":"#10B981"},
    {"key":"leetcodeca","label":"LeetCode.ca", "color":"#F97316"},
]

# ── Pattern signature detection ────────────────────────────────────────────────
# Each entry: list of regex snippets; more matches = stronger evidence the code uses that pattern.
PATTERN_SIGS = {
    "Bit Manipulation":    [r'\^', r'&\s', r'<<', r'>>', r'\bbin\(', r'~(?:n|num|x)\b'],
    "Trie":                [r'TrieNode', r'children\s*=\s*\{', r'def insert', r'def search.*Trie'],
    "Heap":                [r'heapq', r'heappush', r'heappop', r'PriorityQueue'],
    "Stack":               [r'stack\s*=\s*\[\]', r'stack\.append', r'stack\.pop\(\)', r'monoton'],
    "Sliding Window":      [r'window\s*[+\-]=', r'for\s+r\s+in\s+range.*l\s*\+=',
                            r'(?:l|left)\s*\+=\s*1.*(?:r|right)', r'shrink.*window'],
    "Backtracking":        [r'\bbacktrack\b', r'def\s+bt\b', r'def\s+back\b', r'def\s+dfs.*path'],
    "Linked List":         [r'ListNode', r'\.next\s*=', r'dummy\s*=\s*ListNode', r'\bprev\b.*\bnext\b'],
    "Trees & BST":         [r'TreeNode', r'\.left\b', r'\.right\b', r'\broot\b',
                            r'def\s+(?:dfs|inorder|preorder|postorder|traverse)'],
    "DFS":                 [r'\bdef\s+dfs\b', r'visited\s*=\s*set\(\)', r'def\s+helper.*node'],
    "BFS":                 [r'from collections import deque', r'\.popleft\(\)', r'queue\s*=\s*deque'],
    "Graphs":              [r'\bgraph\b\s*=', r'\badj\b\s*=', r'UnionFind', r'def\s+find\b.*def\s+union\b'],
    "Matrix":              [r'directions\s*=', r'dr\s*,\s*dc', r'grid\s*\[r\]',
                            r'rows\s*,\s*cols', r'\(0,1\).*\(0,-1\)'],
    "Two Pointers":        [r'left\s*,\s*right\s*=\s*0', r'l\s*,\s*r\s*=\s*0',
                            r'while\s+l(?:eft)?\s*<\s*r(?:ight)?'],
    "Binary Search":       [r'lo\s*,\s*hi\s*=', r'left\s*,\s*right\s*=.*len',
                            r'mid\s*=.*(?:lo|left|l).*\+.*(?:hi|right|r).*//\s*2', r'bisect\b'],
    "Dynamic Programming": [r'dp\s*=\s*\[', r'dp\s*=\s*\{', r'@lru_cache', r'@cache\b',
                            r'functools\.cache', r'\bdp\[', r'\bmemo\b'],
    "Greedy":              [r'\.sort\(\)', r'intervals\.sort', r'sorted\(', r'\bgreedy\b'],
    "Sorting":             [r'def\s+merge\b', r'merge_sort', r'sorted\(', r'def\s+quick'],
    "Math":                [r'math\.\w+', r'\bgcd\b', r'n\s*%\s*\d', r'\bprime\b', r'\bfactorial\b'],
    "String":              [r'Counter\(s\b', r's\[i\].*s\[j\]', r'ord\(', r'chr\(', r'\.split\('],
    "JavaScript":          [r'closure', r'prototype', r'setTimeout', r'Promise', r'async'],
    "Arrays & Hashing":    [r'Counter\(', r'defaultdict', r'seen\s*=\s*\{', r'freq\s*=\s*\{',
                            r'hashmap\b', r'hash_map\b'],
}

def score_for_pattern(code, pattern_name):
    return sum(1 for sig in PATTERN_SIGS.get(pattern_name, []) if re.search(sig, code))

def best_pattern_block(all_blocks, pattern_name):
    """Return (score, block) of best-matching scraped block for the pattern."""
    best_score, best_block = 0, None
    for b in all_blocks:
        if b['lang'] not in ('python', 'java', 'cpp'): continue
        score = score_for_pattern(b['code'], pattern_name)
        if score > best_score:
            best_score, best_block = score, b
    return best_score, best_block

# Scalar params that are unlikely to be the primary data structure
_SCALARS = {'k','n','m','p','q','a','b','x','y','z','target','val','limit',
            'max_','min_','low','high','idx','pos','count'}

def _first_arr_param(param_names):
    """Pick the most likely 'array/string' parameter from a method's param list."""
    for p in param_names:
        if p.lower() not in _SCALARS:
            return p
    return param_names[0] if param_names else 'nums'

def gen_brute_force_python(q, pattern_name):
    """Generate a brute-force Python skeleton for interview prep."""
    starter = q.get('starter_python', '') or ''
    # Find first non-trivial method signature inside class Solution
    sig_m = re.search(r'class Solution:.*?(    def\s+\w+\s*\(self(?:,\s*([^)]*))?\):)',
                      starter, re.S)
    if not sig_m:
        return None
    sig_line   = sig_m.group(1)                        # e.g. "    def twoSum(self, nums, target):"
    raw_params = (sig_m.group(2) or '').strip()
    param_names = [p.strip().split(':')[0].strip().split('=')[0].strip()
                   for p in raw_params.split(',') if p.strip()]
    fp = _first_arr_param(param_names)                 # first non-scalar param
    i8 = '        '                                    # 8-space indent inside method

    bodies = {
        "Arrays & Hashing": (
            f"{i8}# Brute Force O(n^2) - check all pairs without a hash map\n"
            f"{i8}n = len({fp})\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        # process pair {fp}[i], {fp}[j]\n"
            f"{i8}        pass\n"
            f"{i8}return []  # adjust return"
        ),
        "Two Pointers": (
            f"{i8}# Brute Force O(n^2) - nested loops instead of two pointers\n"
            f"{i8}n = len({fp})\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        # check {fp}[i] and {fp}[j]\n"
            f"{i8}        pass"
        ),
        "Sliding Window": (
            f"{i8}# Brute Force O(n^2) - enumerate all windows\n"
            f"{i8}n = len({fp})\n"
            f"{i8}best = 0\n"
            f"{i8}for l in range(n):\n"
            f"{i8}    window_state = 0  # reset per left boundary\n"
            f"{i8}    for r in range(l, n):\n"
            f"{i8}        window_state += {fp}[r]  # expand right\n"
            f"{i8}        best = max(best, r - l + 1)  # adjust metric\n"
            f"{i8}return best"
        ),
        "Binary Search": (
            f"{i8}# Brute Force O(n) - linear scan instead of binary search\n"
            f"{i8}for i, val in enumerate({fp}):\n"
            f"{i8}    if val == target:  # adjust condition\n"
            f"{i8}        return i\n"
            f"{i8}return -1"
        ),
        "Stack": (
            f"{i8}# Brute Force O(n^2) - simulate without stack via inner loop\n"
            f"{i8}n = len({fp})\n"
            f"{i8}result = [-1] * n\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        if {fp}[j] > {fp}[i]:  # first greater element\n"
            f"{i8}            result[i] = {fp}[j]\n"
            f"{i8}            break\n"
            f"{i8}return result"
        ),
        "Dynamic Programming": (
            f"{i8}# Brute Force O(2^n) - plain recursion, no memoisation\n"
            f"{i8}def recurse(i):\n"
            f"{i8}    if i >= len({fp}):\n"
            f"{i8}        return 0  # base case - adjust\n"
            f"{i8}    take = {fp}[i] + recurse(i + 1)  # include element\n"
            f"{i8}    skip = recurse(i + 1)              # exclude element\n"
            f"{i8}    return max(take, skip)             # adjust combinator\n"
            f"{i8}return recurse(0)"
        ),
        "Backtracking": (
            f"{i8}# Brute Force - exhaustive backtracking without pruning\n"
            f"{i8}results = []\n"
            f"{i8}def backtrack(start, path):\n"
            f"{i8}    results.append(list(path))\n"
            f"{i8}    for i in range(start, len({fp})):\n"
            f"{i8}        path.append({fp}[i])\n"
            f"{i8}        backtrack(i + 1, path)\n"
            f"{i8}        path.pop()\n"
            f"{i8}backtrack(0, [])\n"
            f"{i8}return results"
        ),
        "Linked List": (
            f"{i8}# Brute Force - collect into list, manipulate, rebuild\n"
            f"{i8}vals = []\n"
            f"{i8}curr = {fp}\n"
            f"{i8}while curr:\n"
            f"{i8}    vals.append(curr.val)\n"
            f"{i8}    curr = curr.next\n"
            f"{i8}# --- modify vals as needed ---\n"
            f"{i8}dummy = ListNode(0)\n"
            f"{i8}curr = dummy\n"
            f"{i8}for v in vals:\n"
            f"{i8}    curr.next = ListNode(v)\n"
            f"{i8}    curr = curr.next\n"
            f"{i8}return dummy.next"
        ),
        "Trees & BST": (
            f"{i8}# Brute Force - collect all values, then process list\n"
            f"{i8}vals = []\n"
            f"{i8}def collect(node):\n"
            f"{i8}    if not node: return\n"
            f"{i8}    collect(node.left)\n"
            f"{i8}    vals.append(node.val)\n"
            f"{i8}    collect(node.right)\n"
            f"{i8}collect({fp})\n"
            f"{i8}# process sorted vals list\n"
            f"{i8}return vals[0] if vals else 0  # adjust"
        ),
        "DFS": (
            f"{i8}# Brute Force - DFS from every unvisited node\n"
            f"{i8}visited = set()\n"
            f"{i8}count = 0\n"
            f"{i8}def dfs(node):\n"
            f"{i8}    visited.add(node)\n"
            f"{i8}    for nb in graph.get(node, []):  # adjust graph var\n"
            f"{i8}        if nb not in visited:\n"
            f"{i8}            dfs(nb)\n"
            f"{i8}for node in range(n):  # adjust range\n"
            f"{i8}    if node not in visited:\n"
            f"{i8}        dfs(node)\n"
            f"{i8}        count += 1\n"
            f"{i8}return count"
        ),
        "BFS": (
            f"{i8}# Brute Force - BFS layer by layer without shortcuts\n"
            f"{i8}from collections import deque\n"
            f"{i8}queue = deque([0])  # adjust start node\n"
            f"{i8}visited = {{0}}\n"
            f"{i8}steps = 0\n"
            f"{i8}while queue:\n"
            f"{i8}    for _ in range(len(queue)):\n"
            f"{i8}        node = queue.popleft()\n"
            f"{i8}        for nb in graph[node]:  # adjust graph\n"
            f"{i8}            if nb not in visited:\n"
            f"{i8}                visited.add(nb)\n"
            f"{i8}                queue.append(nb)\n"
            f"{i8}    steps += 1\n"
            f"{i8}return steps"
        ),
        "Graphs": (
            f"{i8}# Brute Force - try all paths via exhaustive DFS\n"
            f"{i8}visited = set()\n"
            f"{i8}def dfs(node):\n"
            f"{i8}    if node == dst: return True  # adjust terminal\n"
            f"{i8}    visited.add(node)\n"
            f"{i8}    for nxt in graph.get(node, []):\n"
            f"{i8}        if nxt not in visited and dfs(nxt):\n"
            f"{i8}            return True\n"
            f"{i8}    visited.remove(node)\n"
            f"{i8}    return False\n"
            f"{i8}return dfs(src)  # adjust src/dst"
        ),
        "Matrix": (
            f"{i8}# Brute Force O(m^2 * n^2) - flood fill from every cell\n"
            f"{i8}m, n = len({fp}), len({fp}[0])\n"
            f"{i8}result = 0\n"
            f"{i8}for r in range(m):\n"
            f"{i8}    for c in range(n):\n"
            f"{i8}        visited = set()\n"
            f"{i8}        def flood(r, c):\n"
            f"{i8}            if (r,c) in visited or not (0<=r<m and 0<=c<n): return\n"
            f"{i8}            visited.add((r,c))\n"
            f"{i8}            for dr,dc in [(0,1),(0,-1),(1,0),(-1,0)]:\n"
            f"{i8}                flood(r+dr, c+dc)\n"
            f"{i8}        flood(r, c)\n"
            f"{i8}        result = max(result, len(visited))  # adjust metric\n"
            f"{i8}return result"
        ),
        "Heap": (
            f"{i8}# Brute Force O(n^2) - sort repeatedly instead of heap\n"
            f"{i8}data = list({fp})\n"
            f"{i8}result = []\n"
            f"{i8}for _ in range(k):  # adjust iterations\n"
            f"{i8}    data.sort()\n"
            f"{i8}    result.append(data.pop(0))  # take smallest\n"
            f"{i8}return result"
        ),
        "Trie": (
            f"{i8}# Brute Force O(n*m) - linear scan through all words\n"
            f"{i8}matches = []\n"
            f"{i8}for word in words:  # adjust input name\n"
            f"{i8}    if word.startswith(prefix):  # adjust condition\n"
            f"{i8}        matches.append(word)\n"
            f"{i8}return matches"
        ),
        "Bit Manipulation": (
            f"{i8}# Brute Force - check/set each bit with loops\n"
            f"{i8}result = 0\n"
            f"{i8}for i in range(32):\n"
            f"{i8}    bit = (n >> i) & 1  # adjust input var\n"
            f"{i8}    # process bit, then reconstruct\n"
            f"{i8}    result |= (bit << i)\n"
            f"{i8}return result"
        ),
        "Greedy": (
            f"{i8}# Brute Force O(n!) - try all orderings\n"
            f"{i8}from itertools import permutations\n"
            f"{i8}best = float('inf')\n"
            f"{i8}for perm in permutations({fp}):\n"
            f"{i8}    cost = sum(perm)  # adjust cost function\n"
            f"{i8}    best = min(best, cost)\n"
            f"{i8}return best"
        ),
        "Sorting": (
            f"{i8}# Brute Force O(n^2) - bubble sort\n"
            f"{i8}arr = list({fp})\n"
            f"{i8}n = len(arr)\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(n - i - 1):\n"
            f"{i8}        if arr[j] > arr[j + 1]:\n"
            f"{i8}            arr[j], arr[j + 1] = arr[j + 1], arr[j]\n"
            f"{i8}return arr"
        ),
        "Math": (
            f"{i8}# Brute Force - iterate all candidates\n"
            f"{i8}for i in range(2, n + 1):  # adjust range\n"
            f"{i8}    is_valid = all(i % j != 0 for j in range(2, i))\n"
            f"{i8}    if is_valid:\n"
            f"{i8}        pass  # process prime / valid number\n"
            f"{i8}return 0  # adjust"
        ),
        "String": (
            f"{i8}# Brute Force O(n^2) - check all substrings\n"
            f"{i8}n = len({fp})\n"
            f"{i8}best = ''\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n + 1):\n"
            f"{i8}        sub = {fp}[i:j]\n"
            f"{i8}        # check condition on sub\n"
            f"{i8}        if len(sub) > len(best):  # adjust\n"
            f"{i8}            best = sub\n"
            f"{i8}return best"
        ),
        "JavaScript": (
            f"{i8}# Brute Force: not applicable - JavaScript closure/prototype problem\n"
            f"{i8}pass"
        ),
    }

    body = bodies.get(
        pattern_name,
        f"{i8}# Brute Force O(n^2) - exhaustive search without optimisation\n"
        f"{i8}n = len({fp}) if hasattr({fp}, '__len__') else int({fp})\n"
        f"{i8}result = None\n"
        f"{i8}# TODO: implement brute force here\n"
        f"{i8}return result"
    )

    return f"# Brute Force Approach\nclass Solution:\n{sig_line}\n{body}"

# ── One Dark palette ───────────────────────────────────────────────────────────
ONE_DARK = {
    Token:"#ABB2BF", Comment:"#5C6370",
    Keyword:"#C678DD", Keyword.Declaration:"#C678DD", Keyword.Namespace:"#C678DD",
    Keyword.Type:"#E5C07B", Keyword.Constant:"#D19A66",
    Name.Builtin:"#E5C07B", Name.Builtin.Pseudo:"#E06C75",
    Name.Class:"#E5C07B", Name.Function:"#61AFEF", Name.Decorator:"#61AFEF",
    Name.Exception:"#E06C75", String:"#98C379", String.Doc:"#5C6370",
    String.Escape:"#56B6C2", Number:"#D19A66",
    Operator:"#56B6C2", Operator.Word:"#C678DD", Punctuation:"#ABB2BF",
}
def tok_color(ttype):
    while ttype is not Token:
        if ttype in ONE_DARK: return ONE_DARK[ttype]
        ttype = ttype.parent
    return ONE_DARK[Token]

# ── 21 QUICK_PATTERNS ─────────────────────────────────────────────────────────
QUICK_PATTERNS = [
    {"name":"Bit Manipulation",    "tags":["Bit Manipulation"],                                        "color":HexColor("#0F172A"),"hex":"#0F172A"},
    {"name":"Trie",                "tags":["Trie"],                                                    "color":HexColor("#7C3AED"),"hex":"#7C3AED"},
    {"name":"Heap",                "tags":["Heap","Heap (Priority Queue)"],                            "color":HexColor("#A855F7"),"hex":"#A855F7"},
    {"name":"Stack",               "tags":["Stack","Monotonic Stack","Monotonic Queue"],               "color":HexColor("#F59E0B"),"hex":"#F59E0B"},
    {"name":"Sliding Window",      "tags":["Sliding Window"],                                          "color":HexColor("#06B6D4"),"hex":"#06B6D4"},
    {"name":"Backtracking",        "tags":["Backtracking"],                                            "color":HexColor("#F43F5E"),"hex":"#F43F5E"},
    {"name":"Linked List",         "tags":["Linked List","Doubly-Linked List"],                       "color":HexColor("#EC4899"),"hex":"#EC4899"},
    {"name":"Trees & BST",         "tags":["Tree","Binary Tree","Binary Search Tree","BST"],           "color":GREEN,              "hex":"#16A34A"},
    {"name":"DFS",                 "tags":["DFS","Depth-First Search"],                               "color":HexColor("#6366F1"),"hex":"#6366F1"},
    {"name":"BFS",                 "tags":["BFS","Breadth-First Search"],                             "color":HexColor("#3B82F6"),"hex":"#3B82F6"},
    {"name":"Graphs",              "tags":["Graph","Union Find","Topological Sort"],                  "color":HexColor("#EF4444"),"hex":"#EF4444"},
    {"name":"Matrix",              "tags":["Matrix"],                                                  "color":HexColor("#059669"),"hex":"#059669"},
    {"name":"Two Pointers",        "tags":["Two Pointers"],                                            "color":HexColor("#10B981"),"hex":"#10B981"},
    {"name":"Binary Search",       "tags":["Binary Search"],                                           "color":HexColor("#F97316"),"hex":"#F97316"},
    {"name":"Dynamic Programming", "tags":["Dynamic Programming","Memoization"],                      "color":HexColor("#D946EF"),"hex":"#D946EF"},
    {"name":"Greedy",              "tags":["Greedy"],                                                  "color":HexColor("#22C55E"),"hex":"#22C55E"},
    {"name":"Sorting",             "tags":["Sorting","Divide and Conquer"],                           "color":HexColor("#84CC16"),"hex":"#84CC16"},
    {"name":"Math",                "tags":["Math","Number Theory","Simulation"],                      "color":HexColor("#64748B"),"hex":"#64748B"},
    {"name":"String",              "tags":["String"],                                                  "color":HexColor("#0EA5E9"),"hex":"#0EA5E9"},
    {"name":"JavaScript",          "tags":["JavaScript","Concurrency"],                               "color":HexColor("#EAB308"),"hex":"#EAB308"},
    {"name":"Arrays & Hashing",    "tags":["Array","Hash Table","Prefix Sum"],                        "color":INDIGO,             "hex":"#4F46E5"},
]
DIFF_ORDER = {"Easy":0,"Medium":1,"Hard":2}

UA = {
    "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept":"text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language":"en-US,en;q=0.5",
}

# ── HTTP helper ────────────────────────────────────────────────────────────────
def _fetch(url, timeout=15):
    try:
        req = Request(url, headers=UA)
        with urlopen(req, timeout=timeout) as r:
            if r.status != 200: return None
            return r.read().decode("utf-8", errors="replace")
    except Exception:
        return None

# ── Language helpers ───────────────────────────────────────────────────────────
LANG_NORM = {
    "python":"python","python3":"python","python2":"python","py":"python",
    "c++":"cpp","cpp":"cpp","java":"java",
    "javascript":"javascript","js":"javascript",
    "typescript":"typescript","ts":"typescript",
    "go":"go","golang":"go","rust":"rust",
    "kotlin":"kotlin","swift":"swift","ruby":"ruby",
    "scala":"scala","csharp":"csharp","c#":"csharp","cs":"csharp",
    "php":"php","dart":"dart","c":"c",
    "bash":"bash","shell":"bash","sh":"bash",
    "nim":"nim","elixir":"elixir","racket":"racket","r":"r",
}
SKIP_LANGS = {"bash","shell","sh","text","json","xml","html","css","unknown",""}

def _norm(lang): return LANG_NORM.get(lang.lower().strip(), lang.lower().strip())

def _detect(code):
    if re.search(r"\bimport\s+java\.", code): return "java"
    if re.search(r"\b(?:ArrayList|HashMap|HashSet|LinkedList|TreeMap|ArrayDeque|PriorityQueue)\b", code): return "java"
    if re.search(r"\bpublic\s+(?:int|long|boolean|void|String|List|Map|char|double|float|Integer|Long)\b", code): return "java"
    if re.search(r"\bpublic\s+class\s+Solution\b", code): return "java"
    if re.search(r"\busing\s+System\b|\bIList<|IDictionary<|IEnumerable<", code): return "csharp"
    if re.search(r":\s*(?:number|string|boolean)\[\]|:\s*number\s*[,;)=]|:\s*string\s*[,;)=]", code): return "typescript"
    if re.search(r"@param\s*\{|\bvar\s+\w+\s*=\s*function\b", code): return "javascript"
    if re.search(r"\buse\s+std::|\bimpl\s+Solution\b|fn\s+\w+\s*\(|\blet\s+mut\b", code): return "rust"
    if re.search(r"^package\s+\w+", code, re.M): return "go"
    if re.search(r"\bfunc\s+\w+\(", code) and re.search(r"\[\]int|\[\]string|map\[", code): return "go"
    if re.search(r"\bimport\s+scala\.|\bobject\s+Solution\b", code): return "scala"
    if re.search(r"\bfun\s+\w+\s*\(|\blistOf\(|\bmapOf\(|\barrayOf\(", code): return "kotlin"
    if re.search(r"\bdef\s+\w+\b", code) and re.search(r"\bend\b", code) and not re.search(r"class Solution\s*\{", code): return "ruby"
    if re.search(r"#include\s*[<\"]", code): return "cpp"
    if re.search(r"\bvector\s*<|\bunordered_map\s*<|\bstd::", code): return "cpp"
    if re.search(r"\bint\s+main\s*\(", code): return "cpp"
    if re.search(r"class\s+Solution\s*:", code): return "python"
    if re.search(r"\bdef\s+\w+\s*\([^)]*self", code): return "python"
    if re.search(r"^\s*from\s+\w+\s+import\b", code, re.M): return "python"
    if re.search(r"^\s*import\s+\w+$", code, re.M) and not re.search(r"[{};]", code): return "python"
    if re.search(r"class\s+Solution\s*\{", code) and not re.search(r"\bpublic\b", code): return "cpp"
    return "unknown"

def _clean_code(raw):
    raw = re.sub(r"<span[^>]*>","",raw); raw = re.sub(r"</span>","",raw)
    raw = re.sub(r"<[^>]+>","",raw)
    for o,n in [("&lt;","<"),("&gt;",">"),("&amp;","&"),("&quot;",'"'),
                ("&#39;","'"),("&nbsp;"," "),("&#x27;","'"),("&#x2F;","/")]:
        raw = raw.replace(o,n)
    return raw.strip()

# ── Image downloading ──────────────────────────────────────────────────────────
def _img_filename(url):
    name = re.sub(r"[^a-zA-Z0-9._-]","_", url.split("?")[0].split("/")[-1])
    return name[:80] or "img.jpg"

def download_image(url):
    fpath = IMG_DIR / _img_filename(url)
    if fpath.exists():
        try: return PILImage.open(fpath)
        except Exception: pass
    try:
        req = Request(url, headers={"User-Agent": UA["User-Agent"]})
        with urlopen(req, timeout=15) as r:
            data = r.read()
        img = PILImage.open(io.BytesIO(data))
        # Convert palette images to RGB for saving as JPEG
        if img.mode in ("P","RGBA","LA"):
            img = img.convert("RGB")
        img.save(fpath)
        return img
    except Exception:
        return None

def rl_image(url, max_w=MAX_W - 0.5*inch):
    """Download and return a ReportLab Image flowable, scaled to fit."""
    pil = download_image(url)
    if not pil: return None
    w_px, h_px = pil.size
    if w_px == 0 or h_px == 0: return None
    scale = min(max_w / w_px, 4*inch / h_px, 1.0)
    dw, dh = w_px*scale, h_px*scale
    fpath = IMG_DIR / _img_filename(url)
    try: return RLImage(str(fpath), width=dw, height=dh)
    except Exception: return None

# ── Doocs scraper — description + all-language solutions ──────────────────────
def scrape_doocs_full(qid):
    """
    Fetch Doocs page for question {qid}.
    Returns dict: {desc_html: str|None, blocks: [{code,lang}]}
    """
    html = _fetch(f"https://leetcode.doocs.org/en/lc/{qid}/")
    if not html:
        return {"desc_html": None, "blocks": []}

    # ── Description between markers ──────────────────────────────────────────
    desc_html = None
    dm = re.search(r"<!-- description:start -->([\s\S]*?)<!-- description:end -->", html, re.I)
    if dm:
        desc_html = dm.group(1).strip()

    # ── All language code blocks (highlight table) ────────────────────────────
    blocks, seen = [], set()
    for td in re.finditer(r'<td[^>]+class="[^"]*\bcode\b[^"]*"[^>]*>', html, re.I):
        sl = html[td.start():td.start()+8000]
        cm = re.search(r"<code[^>]*>([\s\S]*?)</code>", sl)
        if not cm: continue
        code = _clean_code(cm.group(1))
        if len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        lang = _detect(code)
        if lang not in SKIP_LANGS and lang != "unknown":
            blocks.append({"code": code, "lang": lang})

    return {"desc_html": desc_html, "blocks": blocks}

# ── Other site scrapers ────────────────────────────────────────────────────────
def _blocks_class(html):
    blocks, seen = [], set()
    for m in re.finditer(r'<code[^>]+class="[^"]*language-([a-zA-Z0-9+#]+)[^"]*"[^>]*>([\s\S]*?)</code>', html, re.I):
        lang = _norm(m.group(1))
        if lang in SKIP_LANGS: continue
        code = _clean_code(m.group(2))
        if len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        blocks.append({"code": code, "lang": lang})
    return blocks

def _blocks_table(html):
    blocks, seen = [], set()
    for td in re.finditer(r'<td[^>]+class="[^"]*\bcode\b[^"]*"[^>]*>', html, re.I):
        sl = html[td.start():td.start()+8000]
        cm = re.search(r"<code[^>]*>([\s\S]*?)</code>", sl)
        if not cm: continue
        code = _clean_code(cm.group(1))
        if len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        lang = _detect(code)
        if lang not in SKIP_LANGS and lang != "unknown":
            blocks.append({"code": code, "lang": lang})
    return blocks

def _blocks_generic(html):
    blocks, seen = [], set()
    for m in re.finditer(r"<pre[^>]*>([\s\S]*?)</pre>", html, re.I):
        code = _clean_code(m.group(1))
        if re.match(r"^\d[\d\s]*$", code) or len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        lang = _detect(code)
        if lang not in SKIP_LANGS and lang != "unknown":
            blocks.append({"code": code, "lang": lang})
    return blocks

def scrape_simplyleet(slug):
    html = _fetch(f"https://www.simplyleet.com/{slug}")
    if not html: return []
    return _blocks_class(html) or _blocks_generic(html)

def scrape_walkccc(qid):
    html = _fetch(f"https://walkccc.me/LeetCode/problems/{qid}/")
    if not html: return []
    return _blocks_table(html) or _blocks_generic(html)

_LC_CA_MAP = {}
def _build_lcca():
    global _LC_CA_MAP
    if _LC_CA_MAP: return
    print("    Building LeetCode.ca sitemap…")
    html = _fetch("https://leetcode.ca/sitemap.xml")
    if not html: return
    for m in re.finditer(r"<loc>(https://leetcode\.ca/\d{4}-\d{2}-\d{2}-(\d+)-[^<]+)</loc>", html):
        _LC_CA_MAP[m.group(2)] = m.group(1)
    print(f"    LeetCode.ca: {len(_LC_CA_MAP)} entries")

def scrape_leetcodeca(qid):
    _build_lcca()
    url = _LC_CA_MAP.get(str(qid))
    if not url: return []
    html = _fetch(url)
    if not html: return []
    return _blocks_class(html) or _blocks_generic(html)

# ── Cache loaders/savers ───────────────────────────────────────────────────────
def _load(p): return json.load(open(p)) if Path(p).exists() else {}
def _save(p, d): json.dump(d, open(p,"w"), indent=2)

# ── Fetch Doocs (description + blocks) ────────────────────────────────────────
def fetch_doocs(questions):
    cache = _load(DOOCS_CACHE)
    to_fetch = [q for q in questions if str(q["id"]) not in cache]
    if not to_fetch:
        print(f"  Doocs cache complete ({len(cache)} entries).")
        return cache

    print(f"  Fetching {len(to_fetch)} questions from Doocs (desc + solutions)…")
    done = desc_found = 0

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(scrape_doocs_full, q["id"]): q["id"] for q in to_fetch}
        for fut in as_completed(futs):
            qid = futs[fut]
            result = fut.result()
            cache[str(qid)] = result
            done += 1
            if result.get("desc_html"): desc_found += 1
            if done % 50 == 0 or done == len(to_fetch):
                print(f"    {done}/{len(to_fetch)}  descriptions:{desc_found}  "
                      f"blocks:{sum(len(v.get('blocks',[])) for v in cache.values())}")
            if done % 10 == 0: time.sleep(0.3)

    _save(DOOCS_CACHE, cache)
    print(f"  Doocs: {desc_found} descriptions, "
          f"{sum(len(v.get('blocks',[])) for v in cache.values())} code blocks")
    return cache

# ── Fetch all other sites ──────────────────────────────────────────────────────
def fetch_all_sites(questions, doocs_cache):
    """Fetch SimplyLeet, WalkCC, LeetCode.ca (Doocs already fetched separately)."""
    cache = _load(SITES_CACHE)
    to_fetch = [q for q in questions if q["slug"] not in cache]
    if not to_fetch:
        print(f"  Sites cache complete ({len(cache)} entries).")
        return cache

    _build_lcca()
    print(f"  Fetching {len(to_fetch)} questions × 3 sites (SimplyLeet, WalkCC, LeetCode.ca)…")
    done = 0

    def fetch_one(q):
        entry = {
            "simplyleet": scrape_simplyleet(q["slug"]),
            "walkccc":    scrape_walkccc(q["id"]),
            "leetcodeca": scrape_leetcodeca(q["id"]),
        }
        # inject Doocs blocks from the dedicated Doocs cache
        entry["doocs"] = doocs_cache.get(str(q["id"]), {}).get("blocks", [])
        time.sleep(0.05)
        return q["slug"], entry

    with ThreadPoolExecutor(max_workers=5) as pool:
        futs = {pool.submit(fetch_one, q): q["slug"] for q in to_fetch}
        for fut in as_completed(futs):
            slug, entry = fut.result()
            cache[slug] = entry
            done += 1
            if done % 50 == 0 or done == len(to_fetch):
                print(f"    {done}/{len(to_fetch)}")
            if done % 8 == 0: time.sleep(0.5)

    _save(SITES_CACHE, cache)
    return cache

# ── Pattern grouping ───────────────────────────────────────────────────────────
def build_groups(questions):
    assigned = set()
    groups = []
    for p in QUICK_PATTERNS:
        ptags = set(p["tags"])
        qs = [q for q in questions
              if q["id"] not in assigned and set(q.get("tags",[])) & ptags]
        for q in qs: assigned.add(q["id"])
        qs.sort(key=lambda q: DIFF_ORDER.get(q.get("difficulty",""),3))
        groups.append((p, qs))
    leftover = [q for q in questions if q["id"] not in assigned]
    if leftover:
        leftover.sort(key=lambda q: DIFF_ORDER.get(q.get("difficulty",""),3))
        groups.append(({"name":"Other","color":GRAY_500,"hex":"#6B7280"}, leftover))
    return groups

# ── Syntax highlighting ────────────────────────────────────────────────────────
def hl_xml(code, lang, printable=False):
    try: lexer = get_lexer_by_name(lang, stripnl=False)
    except ClassNotFound: lexer = PythonLexer(stripnl=False)
    orig = code.split("\n")[:80]
    tokens = list(lex("\n".join(orig), lexer))
    xml_lines, cur = [], []
    for ttype, value in tokens:
        color = PRINT_CODE_FG if printable else tok_color(ttype)
        safe = value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        parts = safe.split("\n")
        for i, part in enumerate(parts):
            if part: cur.append(f'<font color="{color}">{part}</font>')
            if i < len(parts)-1:
                xml_lines.append("".join(cur)); cur = []
    if cur: xml_lines.append("".join(cur))
    final = []
    for i, xl in enumerate(xml_lines):
        raw = orig[i].replace("\t","    ") if i < len(orig) else ""
        prefix = "&nbsp;" * (len(raw)-len(raw.lstrip(" ")))
        final.append(prefix+xl)
    return "<br/>".join(final)

# ── PDF styles ─────────────────────────────────────────────────────────────────
def build_styles(printable=False):
    code_fg = HexColor(PRINT_CODE_FG) if printable else HexColor("#ABB2BF")
    return {
        "cover_title": ParagraphStyle("ct", fontSize=36, textColor=INDIGO,
            alignment=TA_CENTER, spaceAfter=12, fontName="Helvetica-Bold"),
        "cover_sub":   ParagraphStyle("cs", fontSize=13, textColor=GRAY_500,
            alignment=TA_CENTER, spaceAfter=6, fontName="Helvetica"),
        "q_title":     ParagraphStyle("qt", fontSize=14, textColor=GRAY_700,
            fontName="Helvetica-Bold", spaceAfter=4),
        "body":        ParagraphStyle("bd", fontSize=9.5, textColor=GRAY_700,
            fontName="Helvetica", leading=15, spaceAfter=4),
        "code":        ParagraphStyle("cd", fontSize=7.5, textColor=code_fg,
            fontName="Courier", leading=11.5),
        "editorial":   ParagraphStyle("ed", fontSize=9.5, textColor=GRAY_700,
            fontName="Helvetica", leading=14, spaceAfter=4),
        "toc_entry":   ParagraphStyle("te", fontSize=9.5, textColor=GRAY_700,
            fontName="Helvetica", spaceAfter=2, leading=13),
    }

# ── PDF helpers ────────────────────────────────────────────────────────────────
def diff_badge(difficulty=""):
    key = difficulty.lower() if difficulty else "easy"
    bg, fg = DIFF_COLORS.get(key,(GRAY_100,GRAY_700))
    tbl = Table([[Paragraph(difficulty.upper() or "—",
                            ParagraphStyle("b", fontSize=8, fontName="Helvetica-Bold", textColor=fg))]],
                colWidths=[0.7*inch])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),bg),("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
    ]))
    return tbl

def site_banner(label, hex_color, printable=False):
    if printable:
        fg = HexColor(PRINT_CODE_FG)
        tbl = Table([[Paragraph(
            f'<font color="{PRINT_CODE_FG}"><b>{label}</b></font>',
            ParagraphStyle("slbl", fontSize=10, fontName="Helvetica-Bold", textColor=fg)
        )]], colWidths=[MAX_W])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1), PRINT_BANNER_BG),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),10),
        ]))
        return tbl
    tbl = Table([[Paragraph(
        f'<font color="white"><b>{label}</b></font>',
        ParagraphStyle("slbl", fontSize=10, fontName="Helvetica-Bold", textColor=white)
    )]], colWidths=[MAX_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),HexColor(hex_color)),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),10),
    ]))
    return tbl

def code_flowable(code, lang, styles, printable=False):
    if not code or not code.strip(): return []
    if printable:
        accent = HexColor(PRINT_CODE_FG)
    else:
        accent = HexColor(LANG_COLOR.get(lang, DEFAULT_LANG_COLOR))
    lbl    = LANG_LABEL.get(lang, lang.upper())
    label  = Paragraph(f"◼ {lbl}",
                       ParagraphStyle("lbl", fontSize=9, fontName="Helvetica-Bold", textColor=accent))
    xml   = hl_xml(code, lang, printable=printable)
    lines = xml.split("<br/>")
    result = [label]
    bg = PRINT_CODE_BG if printable else CODE_BG
    for i in range(0, len(lines), 25):
        cell = Paragraph("<br/>".join(lines[i:i+25]), styles["code"])
        tbl  = Table([[cell]], colWidths=[MAX_W])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1), bg),
            ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("BOX",(0,0),(-1,-1),0.25, GRAY_500 if printable else GRAY_700),
        ]))
        result.append(tbl)
    result.append(Spacer(1,5))
    return result

def safe_xml(t):
    return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

# ── HTML description → flowables ───────────────────────────────────────────────
def _inline(html, printable=False):
    """Convert inline HTML to ReportLab XML."""
    code_col = PRINT_INLINE_CODE if printable else "#E06C75"
    html = re.sub(r"<strong[^>]*>(.*?)</strong>", r"<b>\1</b>", html, flags=re.S|re.I)
    html = re.sub(r"<b[^>]*>(.*?)</b>",           r"<b>\1</b>", html, flags=re.S|re.I)
    html = re.sub(r"<em[^>]*>(.*?)</em>",          r"<i>\1</i>", html, flags=re.S|re.I)
    html = re.sub(r"<i[^>]*>(.*?)</i>",            r"<i>\1</i>", html, flags=re.S|re.I)
    html = re.sub(r"<sup[^>]*>(.*?)</sup>", r"<super>\1</super>", html, flags=re.S|re.I)
    html = re.sub(r"<sub[^>]*>(.*?)</sub>", r"<sub>\1</sub>",   html, flags=re.S|re.I)

    def _code_sub(m):
        return (
            f'<font name="Courier" size="9" color="{code_col}">'
            f'{safe_xml(re.sub(chr(60)+r"[^>]+>","",m.group(1)))}</font>'
        )

    html = re.sub(r"<code[^>]*>(.*?)</code>", _code_sub, html, flags=re.S|re.I)
    html = re.sub(r"<br\s*/?>", "<br/>", html, flags=re.I)
    html = re.sub(r"<a[^>]*>(.*?)</a>", r"\1", html, flags=re.S|re.I)
    html = re.sub(r"<[^>]+>", "", html)
    html = html.replace("&nbsp;"," ").replace("&lt;","<").replace("&gt;",">").replace("&amp;","&")
    return re.sub(r"\s{2,}"," ",html).strip()

def desc_to_flowables(desc_html, styles, printable=False):
    """Parse Doocs description HTML (between markers) into ReportLab flowables."""
    if not desc_html: return []
    flowables = []
    desc_html = desc_html.replace("\r\n","\n").replace("\r","\n")

    # Process block by block
    pos = 0
    block_re = re.compile(
        r"(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|"   # glightbox anchor (wraps img)
        r"(<img[^>]*/?>)|"                                    # bare img
        r"(<pre[^>]*>)([\s\S]*?)(</pre>)|"                   # pre/example
        r"(<ul[^>]*>)([\s\S]*?)(</ul>)|"                     # unordered list
        r"(<ol[^>]*>)([\s\S]*?)(</ol>)|"                     # ordered list
        r"(<p[^>]*>)([\s\S]*?)(</p>)|"                       # paragraph
        r"(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)",             # headings h2-h6
        re.I
    )

    for m in block_re.finditer(desc_html):
        # glightbox anchor containing image
        if m.group(1):
            src = re.search(r'href=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I)
            if not src:
                src = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I)
            if src:
                # Skip badge/shield images
                url = src.group(1)
                if "shields.io" in url or "badge" in url.lower(): continue
                img_fl = rl_image(url)
                if img_fl:
                    flowables += [Spacer(1,4), img_fl, Spacer(1,4)]
            continue

        # bare <img>
        if m.group(2):
            src = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(2), re.I)
            if src:
                url = src.group(1)
                if "shields.io" not in url and "badge" not in url.lower():
                    img_fl = rl_image(url)
                    if img_fl:
                        flowables += [Spacer(1,4), img_fl, Spacer(1,4)]
            continue

        # <pre> — example block
        if m.group(4) is not None:
            raw = _clean_code(m.group(4) or "").strip()
            if raw:
                safe = raw.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                lines = safe.split("\n")
                pre_bg = PRINT_CODE_BG if printable else EXAMPLE_BG
                cell = Paragraph("<br/>".join(lines),
                                 ParagraphStyle("pre", fontName="Courier", fontSize=8.5,
                                                textColor=GRAY_700, leading=13,
                                                backColor=pre_bg,
                                                leftIndent=8, rightIndent=8,
                                                spaceBefore=2, spaceAfter=4,
                                                borderPadding=(6,8,6,8)))
                flowables.append(cell)
            continue

        # <ul>
        if m.group(7) is not None:
            for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(7) or "", re.I):
                text = _inline(li, printable).strip()
                if text:
                    flowables.append(Paragraph(f"• {text}",
                        ParagraphStyle("li", fontName="Helvetica", fontSize=9.5,
                                       textColor=GRAY_700, leading=14,
                                       leftIndent=14, spaceAfter=2)))
            continue

        # <ol>
        if m.group(10) is not None:
            for i, li in enumerate(re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(10) or "", re.I), 1):
                text = _inline(li, printable).strip()
                if text:
                    flowables.append(Paragraph(f"{i}. {text}",
                        ParagraphStyle("oli", fontName="Helvetica", fontSize=9.5,
                                       textColor=GRAY_700, leading=14,
                                       leftIndent=14, spaceAfter=2)))
            continue

        # <p>
        if m.group(13) is not None:
            inner = m.group(13) or ""
            # Image inside <p> (glightbox anchor or bare img)
            img_src = re.search(r'(?:src|href)=["\x27](https://fastly\.jsdelivr[^"\x27>\s]+)["\x27]', inner, re.I)
            if img_src:
                url = img_src.group(1)
                if "shields.io" not in url and "badge" not in url.lower():
                    img_fl = rl_image(url)
                    if img_fl:
                        flowables += [Spacer(1,4), img_fl, Spacer(1,4)]
                continue
            text = _inline(inner, printable).strip()
            if text and text != " ":
                try:
                    flowables.append(Paragraph(text, styles["body"]))
                except Exception:
                    flowables.append(Paragraph(safe_xml(re.sub(r"<[^>]+>","",text)), styles["body"]))
            continue

        # <h2-6>
        if m.group(16) is not None:
            text = _inline(m.group(16) or "", printable).strip()
            if text:
                flowables.append(Paragraph(f"<b>{safe_xml(text)}</b>",
                    ParagraphStyle("hdr", fontName="Helvetica-Bold", fontSize=11,
                                   textColor=GRAY_700, leading=16, spaceAfter=3, spaceBefore=6)))
            continue

    return flowables

# ── Editorial text → flowables ─────────────────────────────────────────────────
def editorial_to_flowables(content, styles, printable=False):
    if not content: return []
    # Strip video/iframe
    content = re.sub(r"<div[^>]*class=\"[^\"]*video[^\"]*\"[^>]*>[\s\S]*?</div>","",content,flags=re.I)
    content = re.sub(r"<iframe[\s\S]*?(?:/>|</iframe>)","",content,flags=re.I)
    content = re.sub(r"\[TOC\]","",content)
    # Markdown → inline markup
    content = re.sub(r"^#{1,6}\s*(.+)$", r"\n__H__\1__EH__\n", content, flags=re.M)
    content = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", content)
    content = re.sub(r"\*(.+?)\*",     r"<i>\1</i>", content)
    _cc = PRINT_INLINE_CODE if printable else "#E06C75"
    content = re.sub(
        r"`([^`]+)`",
        lambda m: f'<font name="Courier" size="9" color="{_cc}">{safe_xml(m.group(1))}</font>',
        content,
    )
    content = re.sub(r"\$\$(.+?)\$\$", r"<i>\1</i>", content)

    flowables = []
    for block in re.split(r"\n{2,}", content.strip()):
        block = block.strip()
        if not block: continue
        if "__H__" in block:
            text = re.sub(r"__H__|__EH__","",block)
            text = re.sub(r"<[^>]+>","",text).strip()
            if text:
                flowables.append(Paragraph(f"<b>{safe_xml(text)}</b>",
                    ParagraphStyle("eh", fontName="Helvetica-Bold", fontSize=11,
                                   textColor=INDIGO, leading=16, spaceAfter=3, spaceBefore=8)))
        else:
            block = re.sub(r"<(?!b>|/b>|i>|/i>|br/>|font|/font|super|/super|sub>|/sub>)[^>]+>","",block)
            block = block.replace("&nbsp;"," ").replace("\n"," ").strip()
            if block:
                try:
                    flowables.append(Paragraph(block, styles["editorial"]))
                except Exception:
                    flowables.append(Paragraph(safe_xml(re.sub(r"<[^>]+>","",block)), styles["editorial"]))
    return flowables

# ── Per-question PDF block ─────────────────────────────────────────────────────
def build_question_block(q, styles, doocs_cache, sites_cache, lc_cache, pattern=None, printable=False):
    story = []
    slug  = q.get("slug","")
    qid   = q["id"]
    doocs = doocs_cache.get(str(qid), {})
    sites = sites_cache.get(slug, {})
    lc    = lc_cache.get(slug, {})
    pattern_name = pattern["name"] if pattern else ""
    pattern_hex  = pattern.get("hex","#6366F1") if pattern else "#6366F1"

    # Header
    meta = Table([[
        Paragraph(f"<font color='#6B7280'>#{qid}</font>",
                  ParagraphStyle("mn", fontSize=10, fontName="Helvetica")),
        diff_badge(q.get("difficulty","")),
        Paragraph("", ParagraphStyle("sp", fontSize=10, fontName="Helvetica")),
    ]], colWidths=[0.7*inch, 0.85*inch, 5.45*inch])
    meta.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),3),
    ]))
    story.append(meta)
    story.append(Paragraph(safe_xml(q["title"]), styles["q_title"]))

    # Links
    links = [
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#10B981">LeetDoocs</a>',
        f'<a href="https://www.simplyleet.com/{slug}" color="#A855F7">SimplyLeet</a>',
        f'<a href="https://walkccc.me/LeetCode/problems/{qid}/" color="#3B82F6">WalkCC</a>',
        f'<a href="https://leetcode.com/problems/{slug}/" color="#F97316">LeetCode</a>',
        f'<a href="https://leetcode.com/problems/{slug}/editorial/" color="#6366F1">Editorial</a>',
    ]
    story.append(Paragraph("  ·  ".join(links),
                           ParagraphStyle("lnk", fontSize=8, fontName="Helvetica", spaceAfter=4)))
    if q.get("tags"):
        story.append(Paragraph(
            f"<font color='#6366F1'>{'  ·  '.join(q['tags'][:10])}</font>",
            ParagraphStyle("tg", fontSize=8, fontName="Helvetica", spaceAfter=3)
        ))
    if q.get("source"):
        story.append(Paragraph(
            f"<font color='#9CA3AF'>Lists: {' | '.join(q['source'])}</font>",
            ParagraphStyle("src", fontSize=8, fontName="Helvetica", spaceAfter=6)
        ))

    # ── Description (from Doocs with images) ─────────────────────────────────
    desc_html = doocs.get("desc_html")
    if desc_html:
        story.append(Paragraph("<b>Problem:</b>",
                               ParagraphStyle("ph", fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)))
        story += desc_to_flowables(desc_html, styles, printable)
        story.append(Spacer(1,4))
    else:
        # Fallback: LC GraphQL description or stored text
        lc_desc = lc.get("desc_html")
        stored  = q.get("description","").strip()
        if lc_desc:
            story.append(Paragraph("<b>Problem:</b>",
                                   ParagraphStyle("ph", fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)))
            story += desc_to_flowables(lc_desc, styles, printable)
        elif stored:
            story.append(Paragraph("<b>Problem:</b>",
                                   ParagraphStyle("ph", fontSize=10, fontName="Helvetica-Bold", spaceAfter=3)))
            clean = re.sub(r"\n"," ", stored)
            story.append(Paragraph(safe_xml(clean), styles["body"]))

    # ── Brute Force (always shown first, for interview prep) ─────────────────
    bf = gen_brute_force_python(q, pattern_name)
    if bf:
        story.append(site_banner(f">> Brute Force  [{pattern_name}]  Interview Prep", "#DC2626", printable))
        story += code_flowable(bf, "python", styles, printable)

    # ── Community solutions from all 4 sites (all languages) ─────────────────
    merged = dict(sites)
    merged["doocs"] = doocs.get("blocks", [])

    all_blocks: list = []
    for site_cfg in SITES:
        sk     = site_cfg["key"]
        blocks = merged.get(sk, [])
        if not blocks: continue
        all_blocks.extend(blocks)
        story.append(site_banner(site_cfg["label"], site_cfg["color"], printable))
        for b in blocks:
            story += code_flowable(b["code"], b["lang"], styles, printable)

    # ── Pattern Solution (highlighted) — scraped match or stored fallback ────
    score, pat_block = best_pattern_block(all_blocks, pattern_name)
    story.append(Spacer(1, 4))
    if score > 0 and pat_block:
        story.append(site_banner(f"[*] {pattern_name} — Pattern Solution  (matched from community answers)", pattern_hex, printable))
        story += code_flowable(pat_block["code"], pat_block["lang"], styles, printable)
    else:
        # Fall back to stored solution — curated per pattern
        stored_py  = q.get("python_solution","").strip()
        stored_cpp = q.get("cpp_solution","").strip()
        story.append(site_banner(f"[*] {pattern_name} — Pattern Solution  (stored optimal)", pattern_hex, printable))
        if stored_py:
            story += code_flowable(stored_py,  "python", styles, printable)
        if stored_cpp:
            story += code_flowable(stored_cpp, "cpp",    styles, printable)

    story += [Spacer(1,8), HRFlowable(width="100%", thickness=0.5, color=GRAY_100), Spacer(1,10)]
    return story

# ── PDF generator ──────────────────────────────────────────────────────────────
def generate_pdf(questions, doocs_cache, sites_cache, lc_cache, output, printable=False):
    groups = build_groups(questions)
    styles = build_styles(printable)

    doc = SimpleDocTemplate(
        str(output), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — By Pattern", author="Emmanuel Oppong",
    )

    free_ed   = sum(1 for v in lc_cache.values() if v.get("editorial"))
    desc_doocs = sum(1 for v in doocs_cache.values() if v.get("desc_html"))
    img_count  = len(list(IMG_DIR.glob("*")))
    story = [
        Spacer(1, 2*inch),
        Paragraph("LeetMastery", styles["cover_title"]),
        Paragraph("Study Guide — Organised by Pattern", styles["cover_sub"]),
        Paragraph("  ·  ".join(p["name"] for p in QUICK_PATTERNS),
                  ParagraphStyle("pl", fontSize=9, textColor=GRAY_500,
                                 alignment=TA_CENTER, fontName="Helvetica", leading=16, spaceAfter=6)),
        Spacer(1, 0.3*inch),
        Paragraph("LeetDoocs  ·  SimplyLeet  ·  WalkCC  ·  LeetCode.ca", styles["cover_sub"]),
        Paragraph(f"All languages  ·  {desc_doocs} Doocs descriptions  ·  {img_count} embedded images",
                  styles["cover_sub"]),
        Paragraph(f"LeetCode editorials: {free_ed}/331 free  ·  Easy → Medium → Hard", styles["cover_sub"]),
        Paragraph(f"{len(questions)} Questions  ·  21 Patterns", styles["cover_sub"]),
    ]
    if printable:
        story.append(Paragraph(
            "Print edition — light code panels, monochrome syntax (better on B/W home printers)",
            ParagraphStyle(
                "pe", fontSize=10, textColor=GRAY_700, alignment=TA_CENTER,
                spaceAfter=10, fontName="Helvetica-Oblique",
            ),
        ))
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("<b>Table of Contents</b>",
                           ParagraphStyle("th", fontSize=16, fontName="Helvetica-Bold",
                                          textColor=INDIGO, spaceAfter=12)))
    dc_map = {"Easy":"#16A34A","Medium":"#D97706","Hard":"#DC2626"}
    for pat, qs in groups:
        if not qs: continue
        story.append(Paragraph(
            f"<font color='{pat['hex']}'><b>{pat['name']}</b></font>  "
            f"<font color='#9CA3AF'>({len(qs)} questions)</font>",
            ParagraphStyle("ts", fontSize=11, fontName="Helvetica-Bold", spaceAfter=2, spaceBefore=6)
        ))
        for q in qs:
            dc = dc_map.get(q.get("difficulty",""),"#6B7280")
            diff_tag = q.get("difficulty","")
            story.append(Paragraph(
                f"<font color='#9CA3AF'>#{q['id']}</font>  {safe_xml(q['title'])}  "
                f"<font color='{dc}'>[{diff_tag}]</font>",
                styles["toc_entry"]
            ))
    story.append(PageBreak())

    # Pattern sections
    total = sum(len(qs) for _,qs in groups); done = 0
    for pat, qs in groups:
        if not qs: continue
        story.append(PageBreak())
        if printable:
            banner = Table([[Paragraph(
                f"<font color='#111827'><b>{pat['name']}</b>  <font size='11'>— {len(qs)} questions</font></font>",
                ParagraphStyle("bshp", fontSize=20, fontName="Helvetica-Bold", textColor=HexColor("#111827")),
            )]], colWidths=[MAX_W])
            banner.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,-1), PRINT_BANNER_BG),
                ("TOPPADDING",(0,0),(-1,-1),18),("BOTTOMPADDING",(0,0),(-1,-1),18),
                ("LEFTPADDING",(0,0),(-1,-1),16),
                ("BOX",(0,0),(-1,-1),0.75, GRAY_500),
            ]))
        else:
            banner = Table([[Paragraph(
                f"<font color='white'><b>{pat['name']}</b>  <font size='11'>— {len(qs)} questions</font></font>",
                ParagraphStyle("bsh", fontSize=20, fontName="Helvetica-Bold", textColor=white),
            )]], colWidths=[MAX_W])
            banner.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,-1),pat["color"]),
                ("TOPPADDING",(0,0),(-1,-1),18),("BOTTOMPADDING",(0,0),(-1,-1),18),
                ("LEFTPADDING",(0,0),(-1,-1),16),
            ]))
        story += [banner, Spacer(1,16)]
        for q in qs:
            story += build_question_block(
                q, styles, doocs_cache, sites_cache, lc_cache, pattern=pat, printable=printable,
            )
            done += 1
        print(f"  [{done:3d}/{total}] {pat['name']} ✓")

    print("  Writing PDF…")
    doc.build(story)
    kb = os.path.getsize(output)//1024
    print(f"\n✅  {output}")
    print(f"    {kb} KB ({kb//1024} MB)")
    print(f"    {desc_doocs}/331 Doocs descriptions  ·  {img_count} images embedded")
    print(f"    {free_ed}/331 free LeetCode editorials")

    print("\n📊 Per-site language distribution:")
    all_cache = {**sites_cache}
    for slug, e in all_cache.items():
        e["doocs"] = doocs_cache.get(
            next((str(q["id"]) for q in questions if q["slug"]==slug), ""), {}
        ).get("blocks", [])
    for s in SITES:
        sk = s["key"]
        lmap = {}
        for e in all_cache.values():
            for b in e.get(sk,[]):
                l = b.get("lang","?")
                lmap[l] = lmap.get(l,0)+1
        top = sorted(lmap.items(), key=lambda x:-x[1])[:6]
        covered = sum(1 for e in all_cache.values() if e.get(sk))
        print(f"   {s['label']:12s}  Qs:{covered:3d}  {', '.join(f'{l}:{n}' for l,n in top)}")

    print("\n📊 Patterns (E=Easy M=Medium H=Hard):")
    for pat, qs in groups:
        e = sum(1 for q in qs if q.get("difficulty")=="Easy")
        m = sum(1 for q in qs if q.get("difficulty")=="Medium")
        h = sum(1 for q in qs if q.get("difficulty")=="Hard")
        print(f"   {pat['name']:25s}  {len(qs):3d}  E:{e} M:{m} H:{h}")


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build LeetMastery pattern PDF(s).")
    ap.add_argument(
        "--printable", "-p",
        action="store_true",
        help=f"Only build print-friendly PDF → {OUTPUT_PDF_PRINT.name}",
    )
    ap.add_argument(
        "--both", "-b",
        action="store_true",
        help=f"Build screen + print PDFs → {OUTPUT_PDF.name} and {OUTPUT_PDF_PRINT.name}",
    )
    ap.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Override output path (single-PDF modes only; ignored with --both)",
    )
    args = ap.parse_args()

    if not QUESTIONS.exists():
        raise SystemExit(f"✗ Not found: {QUESTIONS}")
    with open(QUESTIONS) as f: questions = json.load(f)
    print(f"Loaded {len(questions)} questions.\n")

    print("Step 1/3 — Doocs (descriptions + solutions)…")
    doocs_cache = fetch_doocs(questions)

    print("\nStep 2/3 — SimplyLeet, WalkCC, LeetCode.ca…")
    sites_cache = fetch_all_sites(questions, doocs_cache)

    print("\nStep 3/3 — Building PDF…")
    lc_cache = _load(LC_CACHE)

    if args.both:
        print("\n  (screen / syntax colors)")
        generate_pdf(questions, doocs_cache, sites_cache, lc_cache, OUTPUT_PDF, printable=False)
        print("\n  (print-friendly)")
        generate_pdf(questions, doocs_cache, sites_cache, lc_cache, OUTPUT_PDF_PRINT, printable=True)
    elif args.printable:
        out = args.output or OUTPUT_PDF_PRINT
        generate_pdf(questions, doocs_cache, sites_cache, lc_cache, out, printable=True)
    else:
        out = args.output or OUTPUT_PDF
        generate_pdf(questions, doocs_cache, sites_cache, lc_cache, out, printable=False)

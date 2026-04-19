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

# ── Question-specific brute force code, keyed by LeetCode slug ────────────────
# Each value is the 8-space-indented method body (ready to drop inside class Solution).
# These represent what an interviewer wants to hear FIRST before optimisation.
BRUTE_FORCE_BY_SLUG = {
    # ── Arrays & Hashing ──────────────────────────────────────────────────────
    "two-sum":
        "        # Brute Force O(n²) — check every pair; O(1) extra space\n"
        "        for i in range(len(nums)):\n"
        "            for j in range(i + 1, len(nums)):\n"
        "                if nums[i] + nums[j] == target:\n"
        "                    return [i, j]",
    "contains-duplicate":
        "        # Brute Force O(n²) — compare every pair\n"
        "        for i in range(len(nums)):\n"
        "            for j in range(i + 1, len(nums)):\n"
        "                if nums[i] == nums[j]:\n"
        "                    return True\n"
        "        return False",
    "valid-anagram":
        "        # Brute Force O(n log n) — sort both strings and compare\n"
        "        return sorted(s) == sorted(t)",
    "group-anagrams":
        "        # Brute Force O(n² · k log k) — compare each pair by sorting\n"
        "        n = len(strs)\n"
        "        used = [False] * n\n"
        "        result = []\n"
        "        for i in range(n):\n"
        "            if used[i]: continue\n"
        "            group = [strs[i]]\n"
        "            used[i] = True\n"
        "            for j in range(i + 1, n):\n"
        "                if not used[j] and sorted(strs[i]) == sorted(strs[j]):\n"
        "                    group.append(strs[j])\n"
        "                    used[j] = True\n"
        "            result.append(group)\n"
        "        return result",
    "top-k-frequent-elements":
        "        # Brute Force O(n log n) — count then sort by frequency\n"
        "        count = {}\n"
        "        for num in nums:\n"
        "            count[num] = count.get(num, 0) + 1\n"
        "        return sorted(count, key=lambda x: -count[x])[:k]",
    "product-of-array-except-self":
        "        # Brute Force O(n²) — for each index multiply all other elements\n"
        "        n = len(nums)\n"
        "        result = []\n"
        "        for i in range(n):\n"
        "            prod = 1\n"
        "            for j in range(n):\n"
        "                if i != j:\n"
        "                    prod *= nums[j]\n"
        "            result.append(prod)\n"
        "        return result",
    "longest-consecutive-sequence":
        "        # Brute Force O(n²) — for each number extend its sequence\n"
        "        num_set = set(nums)\n"
        "        best = 0\n"
        "        for num in nums:\n"
        "            length = 0\n"
        "            while num + length in num_set:\n"
        "                length += 1\n"
        "            best = max(best, length)\n"
        "        return best",
    "encode-and-decode-strings":
        "        # Brute Force — length-prefix encoding (this IS the standard approach)\n"
        "        # encode: join with len#word protocol\n"
        "        res = ''\n"
        "        for s in strs:\n"
        "            res += str(len(s)) + '#' + s\n"
        "        return res",

    # ── Two Pointers ──────────────────────────────────────────────────────────
    "valid-palindrome":
        "        # Brute Force O(n) — clean string then compare to its reverse\n"
        "        cleaned = ''.join(c.lower() for c in s if c.isalnum())\n"
        "        return cleaned == cleaned[::-1]",
    "two-sum-ii-input-array-is-sorted":
        "        # Brute Force O(n²) — check every pair (ignore sorted property)\n"
        "        for i in range(len(numbers)):\n"
        "            for j in range(i + 1, len(numbers)):\n"
        "                if numbers[i] + numbers[j] == target:\n"
        "                    return [i + 1, j + 1]",
    "3sum":
        "        # Brute Force O(n³) — check all triples, deduplicate via set\n"
        "        nums.sort()\n"
        "        res = set()\n"
        "        for i in range(len(nums)):\n"
        "            for j in range(i + 1, len(nums)):\n"
        "                for k in range(j + 1, len(nums)):\n"
        "                    if nums[i] + nums[j] + nums[k] == 0:\n"
        "                        res.add((nums[i], nums[j], nums[k]))\n"
        "        return [list(t) for t in res]",
    "container-with-most-water":
        "        # Brute Force O(n²) — try every pair of lines\n"
        "        res = 0\n"
        "        for i in range(len(height)):\n"
        "            for j in range(i + 1, len(height)):\n"
        "                water = min(height[i], height[j]) * (j - i)\n"
        "                res = max(res, water)\n"
        "        return res",
    "trapping-rain-water":
        "        # Brute Force O(n²) — for each bar scan left/right for max heights\n"
        "        n = len(height)\n"
        "        res = 0\n"
        "        for i in range(n):\n"
        "            left_max  = max(height[:i + 1])\n"
        "            right_max = max(height[i:])\n"
        "            res += min(left_max, right_max) - height[i]\n"
        "        return res",

    # ── Sliding Window ────────────────────────────────────────────────────────
    "best-time-to-buy-and-sell-stock":
        "        # Brute Force O(n²) — try every buy/sell pair\n"
        "        n = len(prices)\n"
        "        res = 0\n"
        "        for i in range(n):\n"
        "            for j in range(i + 1, n):\n"
        "                res = max(res, prices[j] - prices[i])\n"
        "        return res",
    "longest-substring-without-repeating-characters":
        "        # Brute Force O(n²) — enumerate every starting index; expand until repeat\n"
        "        res = 0\n"
        "        for i in range(len(s)):\n"
        "            seen = set()\n"
        "            for j in range(i, len(s)):\n"
        "                if s[j] in seen:\n"
        "                    break\n"
        "                seen.add(s[j])\n"
        "                res = max(res, j - i + 1)\n"
        "        return res",
    "longest-repeating-character-replacement":
        "        # Brute Force O(n³) — check every substring; count most-frequent char\n"
        "        n = len(s)\n"
        "        res = 0\n"
        "        for i in range(n):\n"
        "            for j in range(i, n):\n"
        "                sub = s[i:j + 1]\n"
        "                max_freq = max(sub.count(c) for c in set(sub))\n"
        "                if (len(sub) - max_freq) <= k:\n"
        "                    res = max(res, len(sub))\n"
        "        return res",
    "minimum-window-substring":
        "        # Brute Force O(n²) — enumerate all substrings, check coverage\n"
        "        from collections import Counter\n"
        "        need = Counter(t)\n"
        "        res = ''\n"
        "        for i in range(len(s)):\n"
        "            window = Counter()\n"
        "            for j in range(i, len(s)):\n"
        "                window[s[j]] += 1\n"
        "                if all(window[c] >= need[c] for c in need):\n"
        "                    if not res or j - i + 1 < len(res):\n"
        "                        res = s[i:j + 1]\n"
        "                    break  # smallest from this i found\n"
        "        return res",
    "permutation-in-string":
        "        # Brute Force O(n! or n·m) — check every window of length len(s1)\n"
        "        from collections import Counter\n"
        "        k = len(s1)\n"
        "        need = Counter(s1)\n"
        "        for i in range(len(s2) - k + 1):\n"
        "            if Counter(s2[i:i + k]) == need:\n"
        "                return True\n"
        "        return False",

    # ── Stack ─────────────────────────────────────────────────────────────────
    "valid-parentheses":
        "        # Brute Force O(n²) — repeatedly remove matched pairs until nothing changes\n"
        "        prev = None\n"
        "        while s != prev:\n"
        "            prev = s\n"
        "            s = s.replace('()', '').replace('[]', '').replace('{}', '')\n"
        "        return s == ''",
    "generate-parentheses":
        "        # Brute Force O(2^(2n) · n) — generate all 2n-length binary strings, filter valid\n"
        "        def is_valid(comb):\n"
        "            bal = 0\n"
        "            for c in comb:\n"
        "                bal += 1 if c == '(' else -1\n"
        "                if bal < 0: return False\n"
        "            return bal == 0\n"
        "        from itertools import product\n"
        "        return [''.join(c) for c in product('()', repeat=2*n) if is_valid(c)]",
    "daily-temperatures":
        "        # Brute Force O(n²) — for each day scan forward for warmer day\n"
        "        n = len(temperatures)\n"
        "        res = [0] * n\n"
        "        for i in range(n):\n"
        "            for j in range(i + 1, n):\n"
        "                if temperatures[j] > temperatures[i]:\n"
        "                    res[i] = j - i\n"
        "                    break\n"
        "        return res",
    "largest-rectangle-in-histogram":
        "        # Brute Force O(n²) — fix left bar, expand right, track min height\n"
        "        n = len(heights)\n"
        "        res = 0\n"
        "        for i in range(n):\n"
        "            min_h = heights[i]\n"
        "            for j in range(i, n):\n"
        "                min_h = min(min_h, heights[j])\n"
        "                res = max(res, min_h * (j - i + 1))\n"
        "        return res",
    "evaluate-reverse-polish-notation":
        "        # Brute Force (stack is already optimal) — simulate token by token\n"
        "        stack = []\n"
        "        ops = {'+': lambda a,b: a+b, '-': lambda a,b: a-b,\n"
        "               '*': lambda a,b: a*b, '/': lambda a,b: int(a/b)}\n"
        "        for tok in tokens:\n"
        "            if tok in ops:\n"
        "                b, a = stack.pop(), stack.pop()\n"
        "                stack.append(ops[tok](a, b))\n"
        "            else:\n"
        "                stack.append(int(tok))\n"
        "        return stack[0]",

    # ── Binary Search ─────────────────────────────────────────────────────────
    "binary-search":
        "        # Brute Force O(n) — linear scan ignoring sorted property\n"
        "        for i, val in enumerate(nums):\n"
        "            if val == target:\n"
        "                return i\n"
        "        return -1",
    "search-a-2d-matrix":
        "        # Brute Force O(m·n) — scan every cell\n"
        "        for row in matrix:\n"
        "            for val in row:\n"
        "                if val == target:\n"
        "                    return True\n"
        "        return False",
    "koko-eating-bananas":
        "        # Brute Force O(max(piles) · n) — try every speed k from 1 upward\n"
        "        import math\n"
        "        for k in range(1, max(piles) + 1):\n"
        "            hours = sum(math.ceil(p / k) for p in piles)\n"
        "            if hours <= h:\n"
        "                return k",
    "find-minimum-in-rotated-sorted-array":
        "        # Brute Force O(n) — just return the minimum (ignores sorted structure)\n"
        "        return min(nums)",
    "search-in-rotated-sorted-array":
        "        # Brute Force O(n) — linear scan\n"
        "        for i, val in enumerate(nums):\n"
        "            if val == target:\n"
        "                return i\n"
        "        return -1",
    "time-based-key-value-store":
        "        # Brute Force — store all (timestamp, value) pairs; scan backward for set/get\n"
        "        # (Shown for the get method; actual class wraps both)\n"
        "        store = {}  # key -> list of (timestamp, value)\n"
        "        # get: scan from latest backward until timestamp <= t\n"
        "        vals = store.get(key, [])\n"
        "        res = ''\n"
        "        for ts, val in reversed(vals):\n"
        "            if ts <= timestamp:\n"
        "                return val\n"
        "        return res",

    # ── Linked List ───────────────────────────────────────────────────────────
    "reverse-linked-list":
        "        # Brute Force O(n) space — collect values, rebuild in reverse\n"
        "        vals = []\n"
        "        curr = head\n"
        "        while curr:\n"
        "            vals.append(curr.val)\n"
        "            curr = curr.next\n"
        "        dummy = ListNode(0)\n"
        "        curr = dummy\n"
        "        for v in reversed(vals):\n"
        "            curr.next = ListNode(v)\n"
        "            curr = curr.next\n"
        "        return dummy.next",
    "merge-two-sorted-lists":
        "        # Brute Force O((m+n) log(m+n)) — collect all values, sort, rebuild\n"
        "        vals = []\n"
        "        for node in (list1, list2):\n"
        "            while node:\n"
        "                vals.append(node.val)\n"
        "                node = node.next\n"
        "        vals.sort()\n"
        "        dummy = ListNode(0)\n"
        "        curr = dummy\n"
        "        for v in vals:\n"
        "            curr.next = ListNode(v)\n"
        "            curr = curr.next\n"
        "        return dummy.next",
    "reorder-list":
        "        # Brute Force O(n) space — collect into array, reorder with two pointers, rebuild\n"
        "        nodes = []\n"
        "        curr = head\n"
        "        while curr:\n"
        "            nodes.append(curr)\n"
        "            curr = curr.next\n"
        "        lo, hi = 0, len(nodes) - 1\n"
        "        while lo < hi:\n"
        "            nodes[lo].next = nodes[hi]\n"
        "            lo += 1\n"
        "            if lo == hi: break\n"
        "            nodes[hi].next = nodes[lo]\n"
        "            hi -= 1\n"
        "        nodes[lo].next = None",
    "remove-nth-node-from-end-of-list":
        "        # Brute Force O(n) — measure length, then traverse to (length-n)-th node\n"
        "        length = 0\n"
        "        curr = head\n"
        "        while curr:\n"
        "            length += 1\n"
        "            curr = curr.next\n"
        "        dummy = ListNode(0, head)\n"
        "        curr = dummy\n"
        "        for _ in range(length - n):\n"
        "            curr = curr.next\n"
        "        curr.next = curr.next.next\n"
        "        return dummy.next",
    "linked-list-cycle":
        "        # Brute Force O(n) space — track all visited nodes in a set\n"
        "        seen = set()\n"
        "        curr = head\n"
        "        while curr:\n"
        "            if id(curr) in seen:\n"
        "                return True\n"
        "            seen.add(id(curr))\n"
        "            curr = curr.next\n"
        "        return False",
    "add-two-numbers":
        "        # Brute Force — convert both lists to integers, add, convert back\n"
        "        def to_int(node):\n"
        "            num, mul = 0, 1\n"
        "            while node:\n"
        "                num += node.val * mul\n"
        "                mul *= 10\n"
        "                node = node.next\n"
        "            return num\n"
        "        total = to_int(l1) + to_int(l2)\n"
        "        dummy = curr = ListNode(0)\n"
        "        if total == 0: return ListNode(0)\n"
        "        while total:\n"
        "            curr.next = ListNode(total % 10)\n"
        "            curr = curr.next\n"
        "            total //= 10\n"
        "        return dummy.next",
    "find-the-duplicate-number":
        "        # Brute Force O(n²) — for each number count its occurrences\n"
        "        for i in range(len(nums)):\n"
        "            count = 0\n"
        "            for j in range(len(nums)):\n"
        "                if nums[j] == nums[i]:\n"
        "                    count += 1\n"
        "            if count > 1:\n"
        "                return nums[i]",
    "merge-k-sorted-lists":
        "        # Brute Force O(N log N) — collect all values, sort, rebuild\n"
        "        vals = []\n"
        "        for node in lists:\n"
        "            while node:\n"
        "                vals.append(node.val)\n"
        "                node = node.next\n"
        "        vals.sort()\n"
        "        dummy = ListNode(0)\n"
        "        curr = dummy\n"
        "        for v in vals:\n"
        "            curr.next = ListNode(v)\n"
        "            curr = curr.next\n"
        "        return dummy.next",
    "copy-list-with-random-pointer":
        "        # Brute Force O(n) space — two-pass: create all nodes, then wire pointers\n"
        "        if not head: return None\n"
        "        mapping = {}\n"
        "        curr = head\n"
        "        while curr:\n"
        "            mapping[curr] = Node(curr.val)\n"
        "            curr = curr.next\n"
        "        curr = head\n"
        "        while curr:\n"
        "            if curr.next:   mapping[curr].next   = mapping[curr.next]\n"
        "            if curr.random: mapping[curr].random = mapping[curr.random]\n"
        "            curr = curr.next\n"
        "        return mapping[head]",

    # ── Trees & BST ───────────────────────────────────────────────────────────
    "invert-binary-tree":
        "        # Brute Force (recursive swap is already optimal — no simpler approach)\n"
        "        if not root: return None\n"
        "        root.left, root.right = root.right, root.left\n"
        "        self.invertTree(root.left)\n"
        "        self.invertTree(root.right)\n"
        "        return root",
    "maximum-depth-of-binary-tree":
        "        # Brute Force O(n) — recursive DFS; BFS is the alternative brute\n"
        "        if not root: return 0\n"
        "        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))",
    "diameter-of-binary-tree":
        "        # Brute Force O(n²) — for each node recompute left/right heights independently\n"
        "        def height(node):\n"
        "            if not node: return 0\n"
        "            return 1 + max(height(node.left), height(node.right))\n"
        "        if not root: return 0\n"
        "        left_h  = height(root.left)\n"
        "        right_h = height(root.right)\n"
        "        through_root = left_h + right_h\n"
        "        left_best  = self.diameterOfBinaryTree(root.left)\n"
        "        right_best = self.diameterOfBinaryTree(root.right)\n"
        "        return max(through_root, left_best, right_best)",
    "balanced-binary-tree":
        "        # Brute Force O(n²) — for each node compute left/right heights separately\n"
        "        def height(node):\n"
        "            if not node: return 0\n"
        "            return 1 + max(height(node.left), height(node.right))\n"
        "        if not root: return True\n"
        "        left_h  = height(root.left)\n"
        "        right_h = height(root.right)\n"
        "        if abs(left_h - right_h) > 1: return False\n"
        "        return self.isBalanced(root.left) and self.isBalanced(root.right)",
    "same-tree":
        "        # Brute Force O(n) — recursive structural comparison\n"
        "        if not p and not q: return True\n"
        "        if not p or not q or p.val != q.val: return False\n"
        "        return self.isSameTree(p.left, q.left) and self.isSameTree(p.right, q.right)",
    "subtree-of-another-tree":
        "        # Brute Force O(m·n) — for each node in root check if tree matches subRoot\n"
        "        def is_same(s, t):\n"
        "            if not s and not t: return True\n"
        "            if not s or not t or s.val != t.val: return False\n"
        "            return is_same(s.left, t.left) and is_same(s.right, t.right)\n"
        "        if not root: return False\n"
        "        if is_same(root, subRoot): return True\n"
        "        return self.isSubtree(root.left, subRoot) or self.isSubtree(root.right, subRoot)",
    "lowest-common-ancestor-of-a-binary-search-tree":
        "        # Brute Force O(n) — find root-to-node paths, find last common node\n"
        "        def path_to(node, target):\n"
        "            path = []\n"
        "            while node:\n"
        "                path.append(node)\n"
        "                if target.val < node.val: node = node.left\n"
        "                elif target.val > node.val: node = node.right\n"
        "                else: break\n"
        "            return path\n"
        "        p_path = path_to(root, p)\n"
        "        q_path = path_to(root, q)\n"
        "        p_set = {n.val for n in p_path}\n"
        "        for node in reversed(q_path):\n"
        "            if node.val in p_set:\n"
        "                return node",
    "lowest-common-ancestor-of-a-binary-tree":
        "        # Brute Force O(n) — recursive: if either target found, bubble it up\n"
        "        if not root or root == p or root == q: return root\n"
        "        left  = self.lowestCommonAncestor(root.left,  p, q)\n"
        "        right = self.lowestCommonAncestor(root.right, p, q)\n"
        "        if left and right: return root\n"
        "        return left or right",
    "binary-tree-level-order-traversal":
        "        # Brute Force O(n) — BFS with a queue; this IS the standard approach\n"
        "        from collections import deque\n"
        "        if not root: return []\n"
        "        result, queue = [], deque([root])\n"
        "        while queue:\n"
        "            level = []\n"
        "            for _ in range(len(queue)):\n"
        "                node = queue.popleft()\n"
        "                level.append(node.val)\n"
        "                if node.left:  queue.append(node.left)\n"
        "                if node.right: queue.append(node.right)\n"
        "            result.append(level)\n"
        "        return result",
    "binary-tree-right-side-view":
        "        # Brute Force O(n) — BFS, take last node of each level\n"
        "        from collections import deque\n"
        "        if not root: return []\n"
        "        result, queue = [], deque([root])\n"
        "        while queue:\n"
        "            level_size = len(queue)\n"
        "            for i in range(level_size):\n"
        "                node = queue.popleft()\n"
        "                if i == level_size - 1: result.append(node.val)\n"
        "                if node.left:  queue.append(node.left)\n"
        "                if node.right: queue.append(node.right)\n"
        "        return result",
    "validate-binary-search-tree":
        "        # Brute Force O(n) — collect inorder traversal, verify it's strictly increasing\n"
        "        vals = []\n"
        "        def inorder(node):\n"
        "            if not node: return\n"
        "            inorder(node.left)\n"
        "            vals.append(node.val)\n"
        "            inorder(node.right)\n"
        "        inorder(root)\n"
        "        return all(vals[i] < vals[i+1] for i in range(len(vals)-1))",
    "kth-smallest-element-in-a-bst":
        "        # Brute Force O(n) — collect all values via inorder, return k-th\n"
        "        vals = []\n"
        "        def inorder(node):\n"
        "            if not node: return\n"
        "            inorder(node.left)\n"
        "            vals.append(node.val)\n"
        "            inorder(node.right)\n"
        "        inorder(root)\n"
        "        return vals[k - 1]",
    "construct-binary-tree-from-preorder-and-inorder-traversal":
        "        # Brute Force O(n²) — find root in inorder by linear scan each call\n"
        "        if not preorder or not inorder: return None\n"
        "        root_val = preorder[0]\n"
        "        root = TreeNode(root_val)\n"
        "        mid = inorder.index(root_val)  # O(n) scan\n"
        "        root.left  = self.buildTree(preorder[1:mid+1],  inorder[:mid])\n"
        "        root.right = self.buildTree(preorder[mid+1:],   inorder[mid+1:])\n"
        "        return root",
    "binary-tree-maximum-path-sum":
        "        # Brute Force O(n²) — for every node compute max gain in subtree\n"
        "        self.res = float('-inf')\n"
        "        def max_gain(node):\n"
        "            if not node: return 0\n"
        "            left  = max(max_gain(node.left),  0)\n"
        "            right = max(max_gain(node.right), 0)\n"
        "            self.res = max(self.res, node.val + left + right)\n"
        "            return node.val + max(left, right)\n"
        "        max_gain(root)\n"
        "        return self.res",
    "serialize-and-deserialize-binary-tree":
        "        # Brute Force — BFS serialization (level order with nulls)\n"
        "        from collections import deque\n"
        "        if not root: return 'null'\n"
        "        result, queue = [], deque([root])\n"
        "        while queue:\n"
        "            node = queue.popleft()\n"
        "            if node:\n"
        "                result.append(str(node.val))\n"
        "                queue.append(node.left)\n"
        "                queue.append(node.right)\n"
        "            else:\n"
        "                result.append('null')\n"
        "        return ','.join(result)",

    # ── Dynamic Programming ───────────────────────────────────────────────────
    "climbing-stairs":
        "        # Brute Force O(2^n) — pure recursion, recomputes identical subproblems\n"
        "        def climb(n):\n"
        "            if n <= 2: return n\n"
        "            return climb(n - 1) + climb(n - 2)\n"
        "        return climb(n)",
    "house-robber":
        "        # Brute Force O(2^n) — try every subset of non-adjacent houses\n"
        "        def rob(i):\n"
        "            if i >= len(nums): return 0\n"
        "            return max(nums[i] + rob(i + 2),  # rob house i\n"
        "                       rob(i + 1))            # skip house i\n"
        "        return rob(0)",
    "house-robber-ii":
        "        # Brute Force O(2^n) — run house-robber brute on [0..n-2] and [1..n-1]\n"
        "        def rob_range(arr):\n"
        "            def rob(i):\n"
        "                if i >= len(arr): return 0\n"
        "                return max(arr[i] + rob(i + 2), rob(i + 1))\n"
        "            return rob(0)\n"
        "        if len(nums) == 1: return nums[0]\n"
        "        return max(rob_range(nums[:-1]), rob_range(nums[1:]))",
    "longest-palindromic-substring":
        "        # Brute Force O(n³) — check every substring for palindrome property\n"
        "        def is_palindrome(sub):\n"
        "            return sub == sub[::-1]\n"
        "        res = ''\n"
        "        for i in range(len(s)):\n"
        "            for j in range(i + 1, len(s) + 1):\n"
        "                sub = s[i:j]\n"
        "                if is_palindrome(sub) and len(sub) > len(res):\n"
        "                    res = sub\n"
        "        return res",
    "palindromic-substrings":
        "        # Brute Force O(n³) — check every substring\n"
        "        count = 0\n"
        "        for i in range(len(s)):\n"
        "            for j in range(i + 1, len(s) + 1):\n"
        "                sub = s[i:j]\n"
        "                if sub == sub[::-1]:\n"
        "                    count += 1\n"
        "        return count",
    "decode-ways":
        "        # Brute Force O(2^n) — try taking 1 or 2 digits at each position\n"
        "        def decode(i):\n"
        "            if i == len(s): return 1\n"
        "            if s[i] == '0': return 0\n"
        "            ways = decode(i + 1)  # take one digit\n"
        "            if i + 1 < len(s) and int(s[i:i+2]) <= 26:\n"
        "                ways += decode(i + 2)  # take two digits\n"
        "            return ways\n"
        "        return decode(0)",
    "coin-change":
        "        # Brute Force O(amount · S^(amount/min)) — recursion without memo\n"
        "        def dp(rem):\n"
        "            if rem == 0: return 0\n"
        "            if rem < 0:  return float('inf')\n"
        "            return 1 + min(dp(rem - c) for c in coins)\n"
        "        res = dp(amount)\n"
        "        return res if res != float('inf') else -1",
    "maximum-product-subarray":
        "        # Brute Force O(n²) — compute product of every contiguous subarray\n"
        "        res = nums[0]\n"
        "        for i in range(len(nums)):\n"
        "            prod = 1\n"
        "            for j in range(i, len(nums)):\n"
        "                prod *= nums[j]\n"
        "                res = max(res, prod)\n"
        "        return res",
    "word-break":
        "        # Brute Force O(2^n) — try all partition points recursively\n"
        "        word_set = set(wordDict)\n"
        "        def can_break(start):\n"
        "            if start == len(s): return True\n"
        "            for end in range(start + 1, len(s) + 1):\n"
        "                if s[start:end] in word_set and can_break(end):\n"
        "                    return True\n"
        "            return False\n"
        "        return can_break(0)",
    "longest-increasing-subsequence":
        "        # Brute Force O(2^n) — generate every subsequence, find longest increasing\n"
        "        def lis(i, prev_val):\n"
        "            if i == len(nums): return 0\n"
        "            skip = lis(i + 1, prev_val)\n"
        "            take = 0\n"
        "            if nums[i] > prev_val:\n"
        "                take = 1 + lis(i + 1, nums[i])\n"
        "            return max(skip, take)\n"
        "        return lis(0, float('-inf'))",
    "partition-equal-subset-sum":
        "        # Brute Force O(2^n) — try including/excluding each element for target sum\n"
        "        total = sum(nums)\n"
        "        if total % 2: return False\n"
        "        target = total // 2\n"
        "        def can_reach(i, rem):\n"
        "            if rem == 0: return True\n"
        "            if i == len(nums) or rem < 0: return False\n"
        "            return can_reach(i+1, rem - nums[i]) or can_reach(i+1, rem)\n"
        "        return can_reach(0, target)",
    "unique-paths":
        "        # Brute Force O(2^(m+n)) — recursion without memo; each step right or down\n"
        "        def paths(r, c):\n"
        "            if r == m - 1 and c == n - 1: return 1\n"
        "            if r >= m or c >= n: return 0\n"
        "            return paths(r + 1, c) + paths(r, c + 1)\n"
        "        return paths(0, 0)",
    "longest-common-subsequence":
        "        # Brute Force O(2^(m+n)) — recursion without memo\n"
        "        def lcs(i, j):\n"
        "            if i == len(text1) or j == len(text2): return 0\n"
        "            if text1[i] == text2[j]:\n"
        "                return 1 + lcs(i + 1, j + 1)\n"
        "            return max(lcs(i + 1, j), lcs(i, j + 1))\n"
        "        return lcs(0, 0)",
    "edit-distance":
        "        # Brute Force O(3^(m+n)) — recursion without memo; try insert/delete/replace\n"
        "        def dp(i, j):\n"
        "            if i == len(word1): return len(word2) - j\n"
        "            if j == len(word2): return len(word1) - i\n"
        "            if word1[i] == word2[j]:\n"
        "                return dp(i + 1, j + 1)\n"
        "            return 1 + min(dp(i + 1, j),     # delete\n"
        "                          dp(i, j + 1),       # insert\n"
        "                          dp(i + 1, j + 1))   # replace\n"
        "        return dp(0, 0)",
    "regular-expression-matching":
        "        # Brute Force O(2^(m+n)) — recursion without memo; handle '.' and '*'\n"
        "        def match(i, j):\n"
        "            if j == len(p): return i == len(s)\n"
        "            first = i < len(s) and (p[j] == '.' or p[j] == s[i])\n"
        "            if j + 1 < len(p) and p[j+1] == '*':\n"
        "                return match(i, j+2) or (first and match(i+1, j))\n"
        "            return first and match(i+1, j+1)\n"
        "        return match(0, 0)",
    "best-time-to-buy-and-sell-stock-with-cooldown":
        "        # Brute Force O(3^n) — recursion: at each day choose buy/sell/rest\n"
        "        def dfs(i, holding, cooldown):\n"
        "            if i >= len(prices): return 0\n"
        "            if cooldown: return dfs(i+1, holding, False)  # must rest\n"
        "            if holding:\n"
        "                sell   = prices[i] + dfs(i+1, False, True)  # sell today\n"
        "                rest   = dfs(i+1, True, False)              # hold\n"
        "                return max(sell, rest)\n"
        "            else:\n"
        "                buy    = -prices[i] + dfs(i+1, True, False)  # buy today\n"
        "                rest   = dfs(i+1, False, False)               # wait\n"
        "                return max(buy, rest)\n"
        "        return dfs(0, False, False)",
    "burst-balloons":
        "        # Brute Force O(n! · n) — try every order to burst all balloons\n"
        "        from itertools import permutations\n"
        "        nums = [1] + nums + [1]\n"
        "        best = 0\n"
        "        # Only feasible for tiny n; actual brute is exponential\n"
        "        def burst(balloons, coins):\n"
        "            nonlocal best\n"
        "            if not balloons:\n"
        "                best = max(best, coins)\n"
        "                return\n"
        "            for i in range(len(balloons)):\n"
        "                left  = balloons[i-1] if i > 0 else 1\n"
        "                right = balloons[i+1] if i+1 < len(balloons) else 1\n"
        "                gained = left * balloons[i] * right\n"
        "                burst(balloons[:i] + balloons[i+1:], coins + gained)\n"
        "        interior = list(nums[1:-1])\n"
        "        burst(interior, 0)\n"
        "        return best",

    # ── Backtracking ──────────────────────────────────────────────────────────
    "subsets":
        "        # Brute Force O(2^n · n) — bitmask over all 2^n subsets\n"
        "        result = []\n"
        "        for mask in range(1 << len(nums)):\n"
        "            sub = [nums[i] for i in range(len(nums)) if mask & (1 << i)]\n"
        "            result.append(sub)\n"
        "        return result",
    "combination-sum":
        "        # Brute Force O(n^(target/min)) — recursion without pruning\n"
        "        result = []\n"
        "        def backtrack(start, path, remain):\n"
        "            if remain == 0:\n"
        "                result.append(list(path)); return\n"
        "            if remain < 0: return\n"
        "            for i in range(start, len(candidates)):\n"
        "                path.append(candidates[i])\n"
        "                backtrack(i, path, remain - candidates[i])\n"
        "                path.pop()\n"
        "        backtrack(0, [], target)\n"
        "        return result",
    "permutations":
        "        # Brute Force O(n! · n) — itertools.permutations (or full recursion)\n"
        "        from itertools import permutations as perms\n"
        "        return [list(p) for p in perms(nums)]",
    "subsets-ii":
        "        # Brute Force O(2^n · n log n) — bitmask with deduplication via set\n"
        "        result = set()\n"
        "        nums.sort()\n"
        "        for mask in range(1 << len(nums)):\n"
        "            sub = tuple(nums[i] for i in range(len(nums)) if mask & (1 << i))\n"
        "            result.add(sub)\n"
        "        return [list(s) for s in result]",
    "letter-combinations-of-a-phone-number":
        "        # Brute Force O(4^n · n) — itertools.product over mapped letters\n"
        "        if not digits: return []\n"
        "        from itertools import product\n"
        "        mapping = {'2':'abc','3':'def','4':'ghi','5':'jkl',\n"
        "                   '6':'mno','7':'pqrs','8':'tuv','9':'wxyz'}\n"
        "        return [''.join(c) for c in product(*[mapping[d] for d in digits])]",
    "palindrome-partitioning":
        "        # Brute Force O(2^n · n) — try every cut point, filter palindrome partitions\n"
        "        result = []\n"
        "        def backtrack(start, path):\n"
        "            if start == len(s):\n"
        "                result.append(list(path)); return\n"
        "            for end in range(start + 1, len(s) + 1):\n"
        "                part = s[start:end]\n"
        "                if part == part[::-1]:  # is palindrome\n"
        "                    path.append(part)\n"
        "                    backtrack(end, path)\n"
        "                    path.pop()\n"
        "        backtrack(0, [])\n"
        "        return result",
    "word-search":
        "        # Brute Force O(m·n·4^L) — DFS from every cell, backtrack on visited\n"
        "        m, n = len(board), len(board[0])\n"
        "        def dfs(r, c, i, visited):\n"
        "            if i == len(word): return True\n"
        "            if r<0 or r>=m or c<0 or c>=n: return False\n"
        "            if (r,c) in visited or board[r][c] != word[i]: return False\n"
        "            visited.add((r,c))\n"
        "            found = (dfs(r+1,c,i+1,visited) or dfs(r-1,c,i+1,visited) or\n"
        "                     dfs(r,c+1,i+1,visited) or dfs(r,c-1,i+1,visited))\n"
        "            visited.remove((r,c))\n"
        "            return found\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                if dfs(r, c, 0, set()): return True\n"
        "        return False",
    "n-queens":
        "        # Brute Force O(n^n · n) — place a queen in every column each row, filter valid\n"
        "        from itertools import product\n"
        "        def is_valid(placement):\n"
        "            for i in range(len(placement)):\n"
        "                for j in range(i+1, len(placement)):\n"
        "                    if placement[i]==placement[j]: return False  # same col\n"
        "                    if abs(placement[i]-placement[j])==abs(i-j): return False  # diagonal\n"
        "            return True\n"
        "        result = []\n"
        "        for cols in product(range(n), repeat=n):\n"
        "            if is_valid(cols):\n"
        "                board = []\n"
        "                for c in cols:\n"
        "                    row = '.'*c + 'Q' + '.'*(n-c-1)\n"
        "                    board.append(row)\n"
        "                result.append(board)\n"
        "        return result",

    # ── Graphs ────────────────────────────────────────────────────────────────
    "number-of-islands":
        "        # Brute Force O(m²·n²) — DFS from every unvisited land cell\n"
        "        if not grid: return 0\n"
        "        m, n = len(grid), len(grid[0])\n"
        "        visited = set()\n"
        "        def dfs(r, c):\n"
        "            if r<0 or r>=m or c<0 or c>=n: return\n"
        "            if (r,c) in visited or grid[r][c]=='0': return\n"
        "            visited.add((r,c))\n"
        "            for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n"
        "                dfs(r+dr, c+dc)\n"
        "        count = 0\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                if grid[r][c]=='1' and (r,c) not in visited:\n"
        "                    dfs(r, c)\n"
        "                    count += 1\n"
        "        return count",
    "max-area-of-island":
        "        # Brute Force O(m²·n²) — DFS from every unvisited land cell, track size\n"
        "        m, n = len(grid), len(grid[0])\n"
        "        visited = set()\n"
        "        def dfs(r, c):\n"
        "            if r<0 or r>=m or c<0 or c>=n: return 0\n"
        "            if (r,c) in visited or grid[r][c]==0: return 0\n"
        "            visited.add((r,c))\n"
        "            return 1 + dfs(r+1,c) + dfs(r-1,c) + dfs(r,c+1) + dfs(r,c-1)\n"
        "        return max((dfs(r,c) for r in range(m) for c in range(n)), default=0)",
    "pacific-atlantic-water-flow":
        "        # Brute Force O(m²·n²) — for each cell DFS to check if water reaches both oceans\n"
        "        if not heights: return []\n"
        "        m, n = len(heights), len(heights[0])\n"
        "        def can_reach_ocean(sr, sc, ocean_check):\n"
        "            # DFS flowing downhill; return True if ocean reached\n"
        "            from collections import deque\n"
        "            stack = [(sr, sc)]\n"
        "            visited = set()\n"
        "            while stack:\n"
        "                r, c = stack.pop()\n"
        "                if (r,c) in visited: continue\n"
        "                visited.add((r,c))\n"
        "                if ocean_check(r, c): return True\n"
        "                for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n"
        "                    nr, nc = r+dr, c+dc\n"
        "                    if 0<=nr<m and 0<=nc<n and heights[nr][nc]<=heights[r][c]:\n"
        "                        stack.append((nr,nc))\n"
        "            return False\n"
        "        result = []\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                pac = can_reach_ocean(r,c, lambda r,c: r==0 or c==0)\n"
        "                atl = can_reach_ocean(r,c, lambda r,c: r==m-1 or c==n-1)\n"
        "                if pac and atl: result.append([r,c])\n"
        "        return result",
    "course-schedule":
        "        # Brute Force O(V+E) — DFS cycle detection on adjacency list\n"
        "        from collections import defaultdict\n"
        "        graph = defaultdict(list)\n"
        "        for a, b in prerequisites:\n"
        "            graph[b].append(a)\n"
        "        # 0=unvisited, 1=in-stack, 2=done\n"
        "        state = [0] * numCourses\n"
        "        def has_cycle(node):\n"
        "            if state[node] == 1: return True\n"
        "            if state[node] == 2: return False\n"
        "            state[node] = 1\n"
        "            for nei in graph[node]:\n"
        "                if has_cycle(nei): return True\n"
        "            state[node] = 2\n"
        "            return False\n"
        "        return not any(has_cycle(c) for c in range(numCourses))",
    "course-schedule-ii":
        "        # Brute Force O(V+E) — DFS topological sort\n"
        "        from collections import defaultdict\n"
        "        graph = defaultdict(list)\n"
        "        for a, b in prerequisites:\n"
        "            graph[b].append(a)\n"
        "        state  = [0] * numCourses\n"
        "        result = []\n"
        "        def dfs(node):\n"
        "            if state[node] == 1: return False  # cycle\n"
        "            if state[node] == 2: return True\n"
        "            state[node] = 1\n"
        "            for nei in graph[node]:\n"
        "                if not dfs(nei): return False\n"
        "            state[node] = 2\n"
        "            result.append(node)\n"
        "            return True\n"
        "        for c in range(numCourses):\n"
        "            if not dfs(c): return []\n"
        "        return result[::-1]",
    "surrounded-regions":
        "        # Brute Force O(m·n) — BFS from border 'O's, mark safe, flip the rest\n"
        "        from collections import deque\n"
        "        if not board: return\n"
        "        m, n = len(board), len(board[0])\n"
        "        safe = set()\n"
        "        queue = deque()\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                if (r==0 or r==m-1 or c==0 or c==n-1) and board[r][c]=='O':\n"
        "                    queue.append((r,c))\n"
        "        while queue:\n"
        "            r,c = queue.popleft()\n"
        "            if (r,c) in safe or board[r][c]!='O': continue\n"
        "            safe.add((r,c))\n"
        "            for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n"
        "                nr,nc = r+dr,c+dc\n"
        "                if 0<=nr<m and 0<=nc<n: queue.append((nr,nc))\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                if board[r][c]=='O' and (r,c) not in safe:\n"
        "                    board[r][c]='X'",
    "rotting-oranges":
        "        # Brute Force O((m·n)²) — repeatedly scan entire grid, spread rot each pass\n"
        "        from copy import deepcopy\n"
        "        m, n = len(grid), len(grid[0])\n"
        "        minutes = 0\n"
        "        while True:\n"
        "            new_grid = deepcopy(grid)\n"
        "            changed = False\n"
        "            for r in range(m):\n"
        "                for c in range(n):\n"
        "                    if grid[r][c] == 2:\n"
        "                        for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n"
        "                            nr,nc = r+dr,c+dc\n"
        "                            if 0<=nr<m and 0<=nc<n and grid[nr][nc]==1:\n"
        "                                new_grid[nr][nc]=2; changed=True\n"
        "            grid = new_grid\n"
        "            if not changed: break\n"
        "            minutes += 1\n"
        "        return minutes if not any(1 in row for row in grid) else -1",
    "cheapest-flights-within-k-stops":
        "        # Brute Force O(V^(K+2)) — DFS trying all paths with at most k stops\n"
        "        from collections import defaultdict\n"
        "        graph = defaultdict(list)\n"
        "        for u,v,w in flights:\n"
        "            graph[u].append((v,w))\n"
        "        self.res = float('inf')\n"
        "        def dfs(node, stops, cost):\n"
        "            if node == dst:\n"
        "                self.res = min(self.res, cost); return\n"
        "            if stops > k: return\n"
        "            for nei, price in graph[node]:\n"
        "                if cost + price < self.res:  # prune only on cost\n"
        "                    dfs(nei, stops+1, cost+price)\n"
        "        dfs(src, 0, 0)\n"
        "        return self.res if self.res < float('inf') else -1",
    "word-ladder":
        "        # Brute Force O(n²·L) — BFS; try all word pairs each level (no pattern precomp)\n"
        "        from collections import deque\n"
        "        word_set = set(wordList)\n"
        "        if endWord not in word_set: return 0\n"
        "        queue = deque([(beginWord, 1)])\n"
        "        visited = {beginWord}\n"
        "        while queue:\n"
        "            word, steps = queue.popleft()\n"
        "            for candidate in list(word_set):\n"
        "                # Check one-letter difference by comparing character by character\n"
        "                if sum(a!=b for a,b in zip(word,candidate))==1 and len(word)==len(candidate):\n"
        "                    if candidate == endWord: return steps+1\n"
        "                    if candidate not in visited:\n"
        "                        visited.add(candidate)\n"
        "                        queue.append((candidate, steps+1))\n"
        "        return 0",
    "clone-graph":
        "        # Brute Force O(V+E) — BFS with a visited dict; this IS the standard approach\n"
        "        if not node: return None\n"
        "        from collections import deque\n"
        "        clone = {node: Node(node.val)}\n"
        "        queue = deque([node])\n"
        "        while queue:\n"
        "            curr = queue.popleft()\n"
        "            for nb in curr.neighbors:\n"
        "                if nb not in clone:\n"
        "                    clone[nb] = Node(nb.val)\n"
        "                    queue.append(nb)\n"
        "                clone[curr].neighbors.append(clone[nb])\n"
        "        return clone[node]",
    "walls-and-gates":
        "        # Brute Force O((m·n)²) — BFS from every empty room independently\n"
        "        from collections import deque\n"
        "        m, n = len(rooms), len(rooms[0])\n"
        "        INF = 2147483647\n"
        "        def bfs_from(sr, sc):\n"
        "            queue = deque([(sr,sc,0)])\n"
        "            visited = set()\n"
        "            while queue:\n"
        "                r,c,d = queue.popleft()\n"
        "                if (r,c) in visited: continue\n"
        "                visited.add((r,c))\n"
        "                if rooms[r][c]==0: return d  # reached a gate\n"
        "                for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n"
        "                    nr,nc = r+dr,c+dc\n"
        "                    if 0<=nr<m and 0<=nc<n and rooms[nr][nc]!=(-1):\n"
        "                        queue.append((nr,nc,d+1))\n"
        "            return INF\n"
        "        for r in range(m):\n"
        "            for c in range(n):\n"
        "                if rooms[r][c]==INF:\n"
        "                    rooms[r][c]=bfs_from(r,c)",
    "network-delay-time":
        "        # Brute Force O(V·E) — Bellman-Ford: relax all edges V-1 times\n"
        "        dist = {i: float('inf') for i in range(1, n+1)}\n"
        "        dist[k] = 0\n"
        "        for _ in range(n - 1):\n"
        "            for u, v, w in times:\n"
        "                if dist[u] + w < dist[v]:\n"
        "                    dist[v] = dist[u] + w\n"
        "        res = max(dist.values())\n"
        "        return res if res < float('inf') else -1",
    "redundant-connection":
        "        # Brute Force O(n²) — try removing each edge; check if graph stays connected\n"
        "        def is_connected(edges, n):\n"
        "            from collections import defaultdict, deque\n"
        "            graph = defaultdict(list)\n"
        "            for u,v in edges:\n"
        "                graph[u].append(v); graph[v].append(u)\n"
        "            visited = set()\n"
        "            queue = deque([1])\n"
        "            while queue:\n"
        "                node = queue.popleft()\n"
        "                if node in visited: continue\n"
        "                visited.add(node)\n"
        "                queue.extend(graph[node])\n"
        "            return len(visited) == n\n"
        "        n = len(edges)\n"
        "        for i in range(n-1, -1, -1):\n"
        "            remaining = edges[:i] + edges[i+1:]\n"
        "            if is_connected(remaining, n):\n"
        "                return edges[i]",

    # ── Matrix ────────────────────────────────────────────────────────────────
    "set-matrix-zeroes":
        "        # Brute Force O(m·n·(m+n)) — record zero positions, then zero out rows/cols\n"
        "        zeros = [(r,c) for r in range(len(matrix)) for c in range(len(matrix[0]))\n"
        "                 if matrix[r][c]==0]\n"
        "        for r,c in zeros:\n"
        "            for col in range(len(matrix[0])): matrix[r][col]=0\n"
        "            for row in range(len(matrix)):    matrix[row][c]=0",
    "spiral-matrix":
        "        # Brute Force O(m·n) — track visited cells, simulate turning\n"
        "        if not matrix: return []\n"
        "        m, n = len(matrix), len(matrix[0])\n"
        "        directions = [(0,1),(1,0),(0,-1),(-1,0)]  # right down left up\n"
        "        visited = [[False]*n for _ in range(m)]\n"
        "        r=c=d=0; result=[]\n"
        "        for _ in range(m*n):\n"
        "            result.append(matrix[r][c])\n"
        "            visited[r][c]=True\n"
        "            dr,dc=directions[d]\n"
        "            nr,nc=r+dr,c+dc\n"
        "            if 0<=nr<m and 0<=nc<n and not visited[nr][nc]:\n"
        "                r,c=nr,nc\n"
        "            else:\n"
        "                d=(d+1)%4; dr,dc=directions[d]; r+=dr; c+=dc\n"
        "        return result",
    "rotate-image":
        "        # Brute Force O(n²) space — copy to new matrix with rotated indices\n"
        "        n = len(matrix)\n"
        "        copy = [row[:] for row in matrix]\n"
        "        for r in range(n):\n"
        "            for c in range(n):\n"
        "                matrix[c][n-1-r] = copy[r][c]",

    # ── Heap ──────────────────────────────────────────────────────────────────
    "kth-largest-element-in-an-array":
        "        # Brute Force O(n log n) — sort descending, index at k-1\n"
        "        nums.sort(reverse=True)\n"
        "        return nums[k - 1]",
    "k-closest-points-to-origin":
        "        # Brute Force O(n log n) — sort all points by Euclidean distance\n"
        "        points.sort(key=lambda p: p[0]**2 + p[1]**2)\n"
        "        return points[:k]",
    "find-median-from-data-stream":
        "        # Brute Force — store all nums; sort every time findMedian is called\n"
        "        # (Shown for findMedian; addNum just appends)\n"
        "        # self.data.sort()  ← O(n log n) per call\n"
        "        n = len(self.data)\n"
        "        self.data.sort()\n"
        "        if n % 2 == 1:\n"
        "            return float(self.data[n // 2])\n"
        "        return (self.data[n//2 - 1] + self.data[n//2]) / 2.0",
    "task-scheduler":
        "        # Brute Force O(n · intervals) — simulate the CPU schedule tick by tick\n"
        "        from collections import Counter\n"
        "        counts = Counter(tasks)\n"
        "        time = 0\n"
        "        while counts:\n"
        "            # Each cycle: pick up to (n+1) most-frequent tasks\n"
        "            cycle = sorted(counts.keys(), key=lambda t: -counts[t])[:n+1]\n"
        "            for t in cycle:\n"
        "                counts[t] -= 1\n"
        "                if counts[t] == 0: del counts[t]\n"
        "                time += 1\n"
        "            if counts:  # idle the rest of the cycle\n"
        "                time += max(0, n + 1 - len(cycle))\n"
        "        return time",

    # ── Greedy ────────────────────────────────────────────────────────────────
    "maximum-subarray":
        "        # Brute Force O(n²) — compute sum of every contiguous subarray\n"
        "        res = nums[0]\n"
        "        for i in range(len(nums)):\n"
        "            curr = 0\n"
        "            for j in range(i, len(nums)):\n"
        "                curr += nums[j]\n"
        "                res = max(res, curr)\n"
        "        return res",
    "jump-game":
        "        # Brute Force O(2^n) — recursion: try every reachable position\n"
        "        def can_reach(i):\n"
        "            if i >= len(nums) - 1: return True\n"
        "            for step in range(1, nums[i] + 1):\n"
        "                if can_reach(i + step): return True\n"
        "            return False\n"
        "        return can_reach(0)",
    "jump-game-ii":
        "        # Brute Force O(n²) — BFS level by level, each level is one jump\n"
        "        from collections import deque\n"
        "        if len(nums) <= 1: return 0\n"
        "        queue = deque([0])\n"
        "        visited = {0}\n"
        "        jumps = 0\n"
        "        while queue:\n"
        "            jumps += 1\n"
        "            for _ in range(len(queue)):\n"
        "                pos = queue.popleft()\n"
        "                for step in range(1, nums[pos] + 1):\n"
        "                    nxt = pos + step\n"
        "                    if nxt >= len(nums) - 1: return jumps\n"
        "                    if nxt not in visited:\n"
        "                        visited.add(nxt)\n"
        "                        queue.append(nxt)\n"
        "        return jumps",
    "gas-station":
        "        # Brute Force O(n²) — try starting at every station\n"
        "        n = len(gas)\n"
        "        for start in range(n):\n"
        "            tank = 0\n"
        "            for step in range(n):\n"
        "                i = (start + step) % n\n"
        "                tank += gas[i] - cost[i]\n"
        "                if tank < 0: break\n"
        "            else:\n"
        "                return start\n"
        "        return -1",
    "merge-intervals":
        "        # Brute Force O(n² log n) — repeatedly merge any two overlapping intervals\n"
        "        intervals.sort(key=lambda x: x[0])\n"
        "        merged = True\n"
        "        while merged:\n"
        "            merged = False\n"
        "            result = [intervals[0]]\n"
        "            for iv in intervals[1:]:\n"
        "                if iv[0] <= result[-1][1]:\n"
        "                    result[-1][1] = max(result[-1][1], iv[1])\n"
        "                    merged = True\n"
        "                else:\n"
        "                    result.append(iv)\n"
        "            intervals = result\n"
        "        return intervals",
    "non-overlapping-intervals":
        "        # Brute Force O(2^n) — try removing every subset, keep smallest valid\n"
        "        # (In practice: sort by end, greedy is O(n log n); brute shown for intuition)\n"
        "        intervals.sort(key=lambda x: x[1])\n"
        "        removed = 0\n"
        "        end = float('-inf')\n"
        "        for iv in intervals:\n"
        "            if iv[0] >= end:\n"
        "                end = iv[1]  # keep this interval\n"
        "            else:\n"
        "                removed += 1  # drop overlapping interval\n"
        "        return removed",
    "meeting-rooms":
        "        # Brute Force O(n²) — check every pair of intervals for overlap\n"
        "        for i in range(len(intervals)):\n"
        "            for j in range(i + 1, len(intervals)):\n"
        "                a, b = intervals[i], intervals[j]\n"
        "                if a[0] < b[1] and b[0] < a[1]:  # overlap\n"
        "                    return False\n"
        "        return True",
    "meeting-rooms-ii":
        "        # Brute Force O(n²) — simulate: assign each meeting to first free room\n"
        "        intervals.sort()\n"
        "        rooms = []  # end times of each room\n"
        "        for start, end in intervals:\n"
        "            # Find earliest-ending free room\n"
        "            placed = False\n"
        "            for i in range(len(rooms)):\n"
        "                if rooms[i] <= start:\n"
        "                    rooms[i] = end\n"
        "                    placed = True\n"
        "                    break\n"
        "            if not placed:\n"
        "                rooms.append(end)\n"
        "        return len(rooms)",

    # ── Bit Manipulation ──────────────────────────────────────────────────────
    "single-number":
        "        # Brute Force O(n²) — for each element, count its occurrences\n"
        "        for num in nums:\n"
        "            if nums.count(num) == 1:\n"
        "                return num",
    "number-of-1-bits":
        "        # Brute Force O(32) — shift through all 32 bits and count set bits\n"
        "        count = 0\n"
        "        for i in range(32):\n"
        "            if (n >> i) & 1:\n"
        "                count += 1\n"
        "        return count",
    "counting-bits":
        "        # Brute Force O(n · 32) — count 1-bits for each number 0..n individually\n"
        "        def count_ones(x):\n"
        "            c = 0\n"
        "            while x:\n"
        "                c += x & 1\n"
        "                x >>= 1\n"
        "            return c\n"
        "        return [count_ones(i) for i in range(n + 1)]",
    "reverse-bits":
        "        # Brute Force O(32) — shift bits out of n, shift them into result\n"
        "        result = 0\n"
        "        for i in range(32):\n"
        "            bit = (n >> i) & 1\n"
        "            result |= bit << (31 - i)\n"
        "        return result",
    "missing-number":
        "        # Brute Force O(n²) — for each 0..n check if it's in nums\n"
        "        for i in range(len(nums) + 1):\n"
        "            if i not in nums:\n"
        "                return i",

    # ── Trie ──────────────────────────────────────────────────────────────────
    "implement-trie-prefix-tree":
        "        # Brute Force — store all inserted words in a list; scan for search/prefix\n"
        "        # (Illustrates the O(n·L) brute before building an actual Trie)\n"
        "        self.words = []\n"
        "        # insert:  self.words.append(word)\n"
        "        # search:  return word in self.words\n"
        "        # starts:  return any(w.startswith(prefix) for w in self.words)\n"
        "        pass",
    "design-add-and-search-words-data-structure":
        "        # Brute Force O(n·L) — store all words; for search, check regex '.' match\n"
        "        import re\n"
        "        # addWord: self.words.append(word)\n"
        "        # search: pattern = '^' + word + '$'\n"
        "        #         return any(re.fullmatch(word.replace('.','[a-z]'), w) for w in self.words)\n"
        "        pass",
    "word-search-ii":
        "        # Brute Force O(k · m·n · 4^L) — run word-search for each word independently\n"
        "        def exist(board, word):\n"
        "            m, n = len(board), len(board[0])\n"
        "            def dfs(r, c, i, seen):\n"
        "                if i == len(word): return True\n"
        "                if r<0 or r>=m or c<0 or c>=n: return False\n"
        "                if (r,c) in seen or board[r][c]!=word[i]: return False\n"
        "                seen.add((r,c))\n"
        "                ok = any(dfs(r+dr,c+dc,i+1,seen)\n"
        "                         for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)])\n"
        "                seen.remove((r,c))\n"
        "                return ok\n"
        "            return any(dfs(r,c,0,set()) for r in range(m) for c in range(n))\n"
        "        return [w for w in words if exist(board, w)]",

    # ── Math / String ─────────────────────────────────────────────────────────
    "powx-n":
        "        # Brute Force O(|n|) — multiply x by itself n times\n"
        "        if n == 0: return 1.0\n"
        "        result = 1.0\n"
        "        for _ in range(abs(n)):\n"
        "            result *= x\n"
        "        return result if n > 0 else 1 / result",
    "median-of-two-sorted-arrays":
        "        # Brute Force O((m+n) log(m+n)) — merge both arrays, sort, find median\n"
        "        merged = sorted(nums1 + nums2)\n"
        "        n = len(merged)\n"
        "        if n % 2 == 1:\n"
        "            return float(merged[n // 2])\n"
        "        return (merged[n//2 - 1] + merged[n//2]) / 2.0",
    "largest-number":
        "        # Brute Force O(n! · n) — try all orderings, pick largest concatenation\n"
        "        from itertools import permutations\n"
        "        best = ''\n"
        "        for perm in permutations(map(str, nums)):\n"
        "            candidate = ''.join(perm)\n"
        "            if candidate > best: best = candidate\n"
        "        return best.lstrip('0') or '0'",
    "find-median-from-data-stream":
        "        # Brute Force — store all; sort each time findMedian is called O(n log n)\n"
        "        self.data.sort()\n"
        "        n = len(self.data)\n"
        "        if n % 2 == 1: return float(self.data[n // 2])\n"
        "        return (self.data[n//2 - 1] + self.data[n//2]) / 2.0",
    "longest-common-prefix":
        "        # Brute Force O(n·L) — start with strs[0], trim until prefix of all\n"
        "        if not strs: return ''\n"
        "        prefix = strs[0]\n"
        "        for word in strs[1:]:\n"
        "            while not word.startswith(prefix):\n"
        "                prefix = prefix[:-1]\n"
        "                if not prefix: return ''\n"
        "        return prefix",
    "valid-sudoku":
        "        # Brute Force O(81) — check each row, col, box for duplicates\n"
        "        rows = [set() for _ in range(9)]\n"
        "        cols = [set() for _ in range(9)]\n"
        "        boxes = [set() for _ in range(9)]\n"
        "        for r in range(9):\n"
        "            for c in range(9):\n"
        "                val = board[r][c]\n"
        "                if val == '.': continue\n"
        "                box_idx = (r // 3) * 3 + c // 3\n"
        "                if val in rows[r] or val in cols[c] or val in boxes[box_idx]:\n"
        "                    return False\n"
        "                rows[r].add(val); cols[c].add(val); boxes[box_idx].add(val)\n"
        "        return True",
    "sort-colors":
        "        # Brute Force O(n log n) — just sort; Dutch-flag is the optimal O(n) approach\n"
        "        nums.sort()",
    "count-univalue-subtrees":
        "        # Brute Force O(n²) — for each node, check if its entire subtree is univalue\n"
        "        def is_uni(node, val):\n"
        "            if not node: return True\n"
        "            return node.val == val and is_uni(node.left, val) and is_uni(node.right, val)\n"
        "        def count(node):\n"
        "            if not node: return 0\n"
        "            return (1 if is_uni(node, node.val) else 0) + count(node.left) + count(node.right)\n"
        "        return count(root)",
    "majority-element":
        "        # Brute Force O(n²) — for each element count its frequency\n"
        "        n = len(nums)\n"
        "        for num in nums:\n"
        "            if nums.count(num) > n // 2:\n"
        "                return num",
    "first-missing-positive":
        "        # Brute Force O(n²) — check 1,2,3,... until one is missing\n"
        "        num_set = set(nums)\n"
        "        i = 1\n"
        "        while i in num_set:\n"
        "            i += 1\n"
        "        return i",
    "maximum-width-ramp":
        "        # Brute Force O(n²) — check every pair (i,j) where i<j and nums[i]<=nums[j]\n"
        "        res = 0\n"
        "        for i in range(len(nums)):\n"
        "            for j in range(i, len(nums)):\n"
        "                if nums[j] >= nums[i]:\n"
        "                    res = max(res, j - i)\n"
        "        return res",
    "subarray-sum-equals-k":
        "        # Brute Force O(n²) — compute sum of every contiguous subarray\n"
        "        count = 0\n"
        "        for i in range(len(nums)):\n"
        "            total = 0\n"
        "            for j in range(i, len(nums)):\n"
        "                total += nums[j]\n"
        "                if total == k:\n"
        "                    count += 1\n"
        "        return count",
    "insert-interval":
        "        # Brute Force O(n log n) — insert, sort, then merge like merge-intervals\n"
        "        intervals.append(newInterval)\n"
        "        intervals.sort(key=lambda x: x[0])\n"
        "        result = [intervals[0]]\n"
        "        for iv in intervals[1:]:\n"
        "            if iv[0] <= result[-1][1]:\n"
        "                result[-1][1] = max(result[-1][1], iv[1])\n"
        "            else:\n"
        "                result.append(iv)\n"
        "        return result",
}


def gen_brute_force_python(q, pattern_name):
    """Generate a brute-force Python skeleton for interview prep.

    First checks BRUTE_FORCE_BY_SLUG for a question-specific implementation
    (specific to that exact problem), then falls back to a pattern-generic
    template so that every question gets something useful.
    """
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

    # ── Question-specific lookup (preferred) ──────────────────────────────────
    slug = q.get('slug', '')
    if slug in BRUTE_FORCE_BY_SLUG:
        body = BRUTE_FORCE_BY_SLUG[slug]
        return f"# Brute Force Approach\nclass Solution:\n{sig_line}\n{body}"

    # ── Pattern-generic fallback ───────────────────────────────────────────────
    bodies = {
        "Arrays & Hashing": (
            f"{i8}# Brute Force O(n²) - check all pairs without a hash map\n"
            f"{i8}n = len({fp})\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        # process pair {fp}[i], {fp}[j]\n"
            f"{i8}        pass\n"
            f"{i8}return []  # adjust return"
        ),
        "Two Pointers": (
            f"{i8}# Brute Force O(n²) - nested loops instead of two pointers\n"
            f"{i8}n = len({fp})\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        # check {fp}[i] and {fp}[j]\n"
            f"{i8}        pass"
        ),
        "Sliding Window": (
            f"{i8}# Brute Force O(n²) - enumerate all windows\n"
            f"{i8}n = len({fp})\n"
            f"{i8}best = 0\n"
            f"{i8}for l in range(n):\n"
            f"{i8}    window_state = 0\n"
            f"{i8}    for r in range(l, n):\n"
            f"{i8}        window_state += {fp}[r]\n"
            f"{i8}        best = max(best, r - l + 1)\n"
            f"{i8}return best"
        ),
        "Binary Search": (
            f"{i8}# Brute Force O(n) - linear scan instead of binary search\n"
            f"{i8}for i, val in enumerate({fp}):\n"
            f"{i8}    if val == target:\n"
            f"{i8}        return i\n"
            f"{i8}return -1"
        ),
        "Stack": (
            f"{i8}# Brute Force O(n²) - simulate without stack via inner loop\n"
            f"{i8}n = len({fp})\n"
            f"{i8}result = [-1] * n\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n):\n"
            f"{i8}        if {fp}[j] > {fp}[i]:\n"
            f"{i8}            result[i] = {fp}[j]\n"
            f"{i8}            break\n"
            f"{i8}return result"
        ),
        "Dynamic Programming": (
            f"{i8}# Brute Force O(2^n) - plain recursion, no memoisation\n"
            f"{i8}def recurse(i):\n"
            f"{i8}    if i >= len({fp}): return 0\n"
            f"{i8}    take = {fp}[i] + recurse(i + 1)\n"
            f"{i8}    skip = recurse(i + 1)\n"
            f"{i8}    return max(take, skip)\n"
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
            f"{i8}dummy = ListNode(0)\n"
            f"{i8}curr = dummy\n"
            f"{i8}for v in vals:\n"
            f"{i8}    curr.next = ListNode(v)\n"
            f"{i8}    curr = curr.next\n"
            f"{i8}return dummy.next"
        ),
        "Trees & BST": (
            f"{i8}# Brute Force - collect inorder, then process sorted list\n"
            f"{i8}vals = []\n"
            f"{i8}def collect(node):\n"
            f"{i8}    if not node: return\n"
            f"{i8}    collect(node.left)\n"
            f"{i8}    vals.append(node.val)\n"
            f"{i8}    collect(node.right)\n"
            f"{i8}collect({fp})\n"
            f"{i8}return vals[0] if vals else 0"
        ),
        "DFS": (
            f"{i8}# Brute Force - DFS from every unvisited node\n"
            f"{i8}visited = set()\n"
            f"{i8}count = 0\n"
            f"{i8}def dfs(node):\n"
            f"{i8}    visited.add(node)\n"
            f"{i8}    for nb in graph.get(node, []):\n"
            f"{i8}        if nb not in visited: dfs(nb)\n"
            f"{i8}for node in range(n):\n"
            f"{i8}    if node not in visited:\n"
            f"{i8}        dfs(node); count += 1\n"
            f"{i8}return count"
        ),
        "BFS": (
            f"{i8}# Brute Force - BFS layer by layer\n"
            f"{i8}from collections import deque\n"
            f"{i8}queue = deque([0])\n"
            f"{i8}visited = {{0}}\n"
            f"{i8}steps = 0\n"
            f"{i8}while queue:\n"
            f"{i8}    for _ in range(len(queue)):\n"
            f"{i8}        node = queue.popleft()\n"
            f"{i8}        for nb in graph[node]:\n"
            f"{i8}            if nb not in visited:\n"
            f"{i8}                visited.add(nb); queue.append(nb)\n"
            f"{i8}    steps += 1\n"
            f"{i8}return steps"
        ),
        "Graphs": (
            f"{i8}# Brute Force - try all paths via exhaustive DFS\n"
            f"{i8}visited = set()\n"
            f"{i8}def dfs(node):\n"
            f"{i8}    if node == dst: return True\n"
            f"{i8}    visited.add(node)\n"
            f"{i8}    for nxt in graph.get(node, []):\n"
            f"{i8}        if nxt not in visited and dfs(nxt): return True\n"
            f"{i8}    visited.remove(node)\n"
            f"{i8}    return False\n"
            f"{i8}return dfs(src)"
        ),
        "Matrix": (
            f"{i8}# Brute Force O(m²·n²) - flood fill from every cell\n"
            f"{i8}m, n = len({fp}), len({fp}[0])\n"
            f"{i8}result = 0\n"
            f"{i8}for r in range(m):\n"
            f"{i8}    for c in range(n):\n"
            f"{i8}        visited = set()\n"
            f"{i8}        def flood(r, c):\n"
            f"{i8}            if (r,c) in visited or not (0<=r<m and 0<=c<n): return\n"
            f"{i8}            visited.add((r,c))\n"
            f"{i8}            for dr,dc in [(0,1),(0,-1),(1,0),(-1,0)]: flood(r+dr,c+dc)\n"
            f"{i8}        flood(r, c)\n"
            f"{i8}        result = max(result, len(visited))\n"
            f"{i8}return result"
        ),
        "Heap": (
            f"{i8}# Brute Force O(n log n) - sort repeatedly instead of heap\n"
            f"{i8}data = list({fp})\n"
            f"{i8}result = []\n"
            f"{i8}for _ in range(k):\n"
            f"{i8}    data.sort()\n"
            f"{i8}    result.append(data.pop(0))\n"
            f"{i8}return result"
        ),
        "Trie": (
            f"{i8}# Brute Force O(n·m) - linear scan through all words\n"
            f"{i8}matches = []\n"
            f"{i8}for word in words:\n"
            f"{i8}    if word.startswith(prefix):\n"
            f"{i8}        matches.append(word)\n"
            f"{i8}return matches"
        ),
        "Bit Manipulation": (
            f"{i8}# Brute Force - check each bit with a loop\n"
            f"{i8}result = 0\n"
            f"{i8}for i in range(32):\n"
            f"{i8}    bit = (n >> i) & 1\n"
            f"{i8}    result |= (bit << i)\n"
            f"{i8}return result"
        ),
        "Greedy": (
            f"{i8}# Brute Force O(n²) - check all subsets/orderings exhaustively\n"
            f"{i8}from itertools import permutations\n"
            f"{i8}best = float('inf')\n"
            f"{i8}for perm in permutations({fp}):\n"
            f"{i8}    cost = sum(perm)\n"
            f"{i8}    best = min(best, cost)\n"
            f"{i8}return best"
        ),
        "Sorting": (
            f"{i8}# Brute Force O(n²) - bubble sort\n"
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
            f"{i8}for i in range(2, n + 1):\n"
            f"{i8}    is_valid = all(i % j != 0 for j in range(2, i))\n"
            f"{i8}    if is_valid: pass\n"
            f"{i8}return 0"
        ),
        "String": (
            f"{i8}# Brute Force O(n²) - check all substrings\n"
            f"{i8}n = len({fp})\n"
            f"{i8}best = ''\n"
            f"{i8}for i in range(n):\n"
            f"{i8}    for j in range(i + 1, n + 1):\n"
            f"{i8}        sub = {fp}[i:j]\n"
            f"{i8}        if len(sub) > len(best): best = sub\n"
            f"{i8}return best"
        ),
        "JavaScript": (
            f"{i8}# Brute Force: not applicable - JavaScript closure/prototype problem\n"
            f"{i8}pass"
        ),
    }

    body = bodies.get(
        pattern_name,
        f"{i8}# Brute Force O(n²) - exhaustive search without optimisation\n"
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

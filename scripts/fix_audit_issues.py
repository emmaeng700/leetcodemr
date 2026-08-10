"""
fix_audit_issues.py — Targeted fixes for issues found in the hardcore audit.

Problems being fixed:
  Q1242 — phases out of order; Phase 4 has no class; Phase 2 == Phase 4
  Q843  — Phase 2 and Phase 4 use the same candidate-filter algorithm
  Q761  — Phase 2 and Phase 4 use the same recursive sort structure
  Q1153 — Phase 2 and Phase 4 use the same O(n) mapping dict logic
  Q2627, Q2628, Q2630, Q2633, Q2636, Q2675, Q2700 — JS questions with no Python code
"""
import json, re
from pathlib import Path

JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "grind_questions.json"

# ── patch helpers ────────────────────────────────────────────────────────────

def replace_phase_block(code: str, phase_num: int, new_content: str) -> str:
    """Replace the Phase N block (between its header and the next PHASE header)."""
    lines = code.split("\n")
    start = end = None
    for i, line in enumerate(lines):
        if start is None and re.search(rf"PHASE\s*{phase_num}\b", line):
            start = i
        elif start is not None and re.search(rf"PHASE\s*{phase_num + 1}\b", line):
            end = i
            break
    if start is None:
        raise ValueError(f"Phase {phase_num} not found")
    if end is None:
        end = len(lines)
    new_lines = new_content.rstrip("\n").split("\n")
    return "\n".join(lines[:start] + new_lines + lines[end:])


def patch_question(data: list, qid: int, fn) -> None:
    q = next((x for x in data if x["id"] == qid), None)
    if not q:
        print(f"  Q{qid}: NOT FOUND — skipped")
        return
    q["starterPython"] = fn(q["starterPython"])
    print(f"  Q{qid}: ✓")


# ════════════════════════════════════════════════════════════════════════════
# Q1242 — Web Crawler Multithreaded
# Problem: phases scrambled; Phase 4 has no class; Phase 2 ≈ Phase 4
# Fix: rebuild the entire starterPython with correct phase order
# ════════════════════════════════════════════════════════════════════════════
Q1242_CODE = '''\
from typing import List, Optional

class Solution:
    def crawl(self, startUrl, htmlParser):
        # Write your solution here
        pass



# -- Interview Approach - STAR-LC --
# PHASE 1 — CLARIFY
# "Same as #1236 but with multi-threading because getUrls() is I/O-bound and slow.
#  Use threads to fetch pages in parallel. Thread-safe visited set required. Right?"

# PHASE 2 — BRUTE FORCE
# "Brute force: sequential BFS, one page at a time, fully blocking.
#  Simple but slow — every getUrls() call blocks the whole crawler.
#  Time: O(V + E) wall-clock dominated by network latency. Space: O(V)."
class _1242_WebCrawlerMultithreaded_Brute:
    def crawl(self, startUrl: str, htmlParser) -> List[str]:
        # Sequential BFS — no concurrency, each getUrls() call blocks until done
        domain = startUrl.split("/")[2]
        visited = {startUrl}
        queue = [startUrl]
        while queue:
            url = queue.pop(0)
            for link in htmlParser.getUrls(url):
                if link not in visited and link.split("/")[2] == domain:
                    visited.add(link)
                    queue.append(link)
        return list(visited)

# PHASE 3 — OPTIMIZE
# Say: "Sequential BFS blocks on every I/O call. Use threads so all pending pages
#  are fetched in parallel. Key insight: getUrls() is I/O-bound — GIL is released
#  during the blocking call, so Python threads give real concurrency here.
#  Use ThreadPoolExecutor to dispatch one thread per URL. Protect visited with a Lock."

# PHASE 4 — CLEAN CODE (multithreaded BFS)
# "Now I'll implement with ThreadPoolExecutor for parallel I/O."
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

class _1242_WebCrawlerMultithreaded:
    def crawl(self, startUrl: str, htmlParser) -> List[str]:
        domain = startUrl.split("/")[2]
        visited = {startUrl}
        lock    = threading.Lock()

        def fetch(url: str) -> List[str]:
            new_urls = []
            for link in htmlParser.getUrls(url):
                if link.split("/")[2] != domain:
                    continue
                with lock:
                    if link not in visited:
                        visited.add(link)
                        new_urls.append(link)
            return new_urls

        frontier = [startUrl]
        with ThreadPoolExecutor(max_workers=16) as pool:
            while frontier:
                futures = {pool.submit(fetch, url): url for url in frontier}
                frontier = []
                for fut in as_completed(futures):
                    frontier.extend(fut.result())
        return list(visited)

# PHASE 5 — TEST & DEBUG
# Say: "Let me trace from 'http://news.yahoo.com/news'."
# Sequential BFS: queue=[start]. Pop start → getUrls → filter domain → enqueue new.
# Multithreaded: same BFS but each frontier batch is fetched in parallel.
# WHY lock: visited is shared across threads — race condition without lock.
# WHY ThreadPoolExecutor: manages thread pool, collects results with Future.

# PHASE 6 — COMPLEXITY & FOLLOW-UP
# "Time: O(V + E) wall-clock but latency amortized by parallelism.
#  Space: O(V) visited + thread pool overhead.
#  Follow-up: distributed crawl — consistent hashing by domain across machines."
'''


# ════════════════════════════════════════════════════════════════════════════
# Q843 — Guess the Word
# Problem: same candidate-filter algorithm (just first vs random pick)
# Fix: Phase 2 uses a boolean-mask array (no list rebuild), very different structure
# ════════════════════════════════════════════════════════════════════════════
def fix_q843(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: track live candidates with a boolean mask array.
#  Always pick the first alive candidate — no smart selection.
#  Filter by setting alive[i]=False for any word inconsistent with the score.
#  O(n) per round via linear scan. Space: O(n) for the mask."
class _843_GuessTheWord_Brute:
    def findSecretWord(self, wordlist, master) -> None:
        def match(a: str, b: str) -> int:
            return sum(x == y for x, y in zip(a, b))
        n = len(wordlist)
        alive = [True] * n          # boolean mask — different structure from candidates list
        for _ in range(10):
            pick_idx = next((i for i in range(n) if alive[i]), None)
            if pick_idx is None:
                return
            score = master.guess(wordlist[pick_idx])
            if score == 6:
                return
            alive[pick_idx] = False
            for i in range(n):
                if alive[i] and match(wordlist[i], wordlist[pick_idx]) != score:
                    alive[i] = False
'''
    return replace_phase_block(code, 2, new_p2)


# ════════════════════════════════════════════════════════════════════════════
# Q761 — Special Binary String
# Problem: same recursive scan structure in both phases (balance counter)
# Fix: Phase 2 uses explicit stack to match '1'/'0' brackets — different structure
# ════════════════════════════════════════════════════════════════════════════
def fix_q761(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: use an explicit stack to match '1' opens with '0' closes,
#  finding the boundaries of maximal special strings.
#  When stack empties we found a complete special — recurse on its inner part.
#  O(n log n) due to sorting. Stack approach vs Phase 4's balance counter."
class _761_SpecialBinaryString_Brute:
    def makeLargestSpecial(self, s: str) -> str:
        def sort_specials(string: str) -> str:
            stack = []          # indices of unmatched '1's
            parts = []
            for j, ch in enumerate(string):
                if ch == "1":
                    stack.append(j)
                else:
                    open_j = stack.pop()
                    if not stack:           # stack empty → maximal special found
                        inner = sort_specials(string[open_j + 1 : j])
                        parts.append("1" + inner + "0")
            return "".join(sorted(parts, reverse=True))
        return sort_specials(s)
'''
    return replace_phase_block(code, 2, new_p2)


# ════════════════════════════════════════════════════════════════════════════
# Q1153 — String Transforms Into Another String
# Problem: both phases use the same O(n) mapping dict logic
# Fix: Phase 2 uses O(n²) all-pairs consistency check — different complexity class
# ════════════════════════════════════════════════════════════════════════════
def fix_q1153(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: O(n²) pairwise check — for every pair (i, j), if str1[i]==str1[j]
#  then str2[i] must equal str2[j] (consistency). No dict needed.
#  Still need ≥1 unused char in str2 as intermediate buffer.
#  Time: O(n²). Space: O(1) extra."
class _1153_StringTransformsAnother_Brute:
    def canConvert(self, str1: str, str2: str) -> bool:
        if str1 == str2:
            return True
        n = len(str1)
        for i in range(n):
            for j in range(n):
                if str1[i] == str1[j] and str2[i] != str2[j]:
                    return False
        return len(set(str2)) < 26
'''
    return replace_phase_block(code, 2, new_p2)


# ════════════════════════════════════════════════════════════════════════════
# JS questions — add Python class definitions to Phase 2 and Phase 4
# All these questions have only commented-out JS code, no Python classes.
# ════════════════════════════════════════════════════════════════════════════

# ── Q2627 Debounce ────────────────────────────────────────────────────────
def fix_q2627(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: poll-based debounce — busy-wait in a background thread checking
#  whether t ms have elapsed since the last call. Simple but wastes CPU with polling.
#  O(1) per invocation, but the polling thread runs continuously."
import threading, time
class _2627_Debounce_Brute:
    def debounce(self, fn, t: int):
        last_time = [None]
        last_args = [None]
        lock = threading.Lock()
        def poll():
            while True:
                time.sleep(t / 2000.0)
                with lock:
                    if last_time[0] and time.time() - last_time[0] >= t / 1000.0:
                        fn(*last_args[0])
                        last_time[0] = None
        threading.Thread(target=poll, daemon=True).start()
        def debounced(*args):
            with lock:
                last_time[0] = time.time()
                last_args[0] = args
        return debounced
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Timer-based: cancel+restart a threading.Timer on each call.
#  O(1) per invocation. No background polling — event-driven."
import threading
class _2627_Debounce:
    def debounce(self, fn, t: int):
        timer = [None]
        def debounced(*args):
            if timer[0]:
                timer[0].cancel()
            timer[0] = threading.Timer(t / 1000.0, fn, args=args)
            timer[0].start()
        return debounced
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2628 JSON Deep Equal ─────────────────────────────────────────────────
def fix_q2628(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: serialize both values to JSON strings and compare.
#  Wrong for objects because key order may differ. O(n) time but unreliable.
#  Then fall back to recursive comparison — O(n²) worst case without type guard."
import json as _json
class _2628_JSONDeepEqual_Brute:
    def areDeeplyEqual(self, o1, o2) -> bool:
        try:
            return _json.dumps(o1, sort_keys=True) == _json.dumps(o2, sort_keys=True)
        except TypeError:
            pass
        # Fallback: brute O(n²) element-wise comparison for lists
        if type(o1) != type(o2):
            return False
        if isinstance(o1, dict):
            if set(o1) != set(o2):
                return False
            return all(self.areDeeplyEqual(o1[k], o2[k]) for k in o1)
        if isinstance(o1, list):
            if len(o1) != len(o2):
                return False
            return all(self.areDeeplyEqual(a, b) for a, b in zip(o1, o2))
        return o1 == o2
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Recursive type dispatch — O(n) single pass, no serialization."
class _2628_JSONDeepEqual:
    def areDeeplyEqual(self, o1, o2) -> bool:
        if type(o1) is not type(o2):
            return False
        if isinstance(o1, dict):
            return (set(o1) == set(o2) and
                    all(self.areDeeplyEqual(o1[k], o2[k]) for k in o1))
        if isinstance(o1, list):
            return (len(o1) == len(o2) and
                    all(self.areDeeplyEqual(a, b) for a, b in zip(o1, o2)))
        return o1 == o2
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2630 Memoize ─────────────────────────────────────────────────────────
def fix_q2630(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: store all (args, result) pairs in a list; scan linearly on each call.
#  O(n) per lookup (n = number of distinct prior calls). Simple but slow."
class _2630_Memoize_Brute:
    def memoize(self, fn):
        cache = []          # list of (args_tuple, result) — O(n) scan
        def memoized(*args):
            for stored_args, result in cache:
                if stored_args == args:
                    return result
            result = fn(*args)
            cache.append((args, result))
            return result
        return memoized
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Hash map keyed by args tuple — O(1) average lookup."
class _2630_Memoize:
    def memoize(self, fn):
        cache = {}
        def memoized(*args):
            if args not in cache:
                cache[args] = fn(*args)
            return cache[args]
        return memoized
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2633 Convert Object to JSON String ──────────────────────────────────
def fix_q2633(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: use Python's json.dumps — handles all types but may not match
#  LeetCode's expected format exactly (e.g. None vs null handling differs).
#  O(n) but relies on stdlib rather than manual type dispatch."
import json as _json
class _2633_ConvertObjectToJSONString_Brute:
    def jsonStringify(self, value) -> str:
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            return '"' + value.replace('"', '\\\\"') + '"'
        if isinstance(value, list):
            return "[" + ",".join(self.jsonStringify(v) for v in value) + "]"
        if isinstance(value, dict):
            pairs = ','.join(
                '"' + str(k) + '":' + self.jsonStringify(v)
                for k, v in value.items()
            )
            return "{" + pairs + "}"
        return "null"
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Clean recursive type dispatch with match-style elif chain."
class _2633_ConvertObjectToJSONString:
    def jsonStringify(self, value) -> str:
        if value is None:           return "null"
        if isinstance(value, bool): return "true" if value else "false"
        if isinstance(value, (int, float)): return str(value)
        if isinstance(value, str):  return '"' + value + '"'
        if isinstance(value, list):
            return "[" + ",".join(self.jsonStringify(v) for v in value) + "]"
        # dict
        items = ",".join(
            f'"{k}":{self.jsonStringify(v)}' for k, v in value.items()
        )
        return "{" + items + "}"
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2636 Promise Pool ────────────────────────────────────────────────────
def fix_q2636(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: run all coroutines at once with asyncio.gather — no concurrency limit.
#  Simple but may overwhelm resources if too many concurrent tasks."
import asyncio
class _2636_PromisePool_Brute:
    async def promisePool(self, functions: list, n: int) -> None:
        # No limit — fire everything simultaneously (brute force)
        await asyncio.gather(*(fn() for fn in functions))
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Semaphore limits concurrency to n tasks at a time."
import asyncio
class _2636_PromisePool:
    async def promisePool(self, functions: list, n: int) -> None:
        sem = asyncio.Semaphore(n)
        async def run(fn):
            async with sem:
                await fn()
        await asyncio.gather(*(run(fn) for fn in functions))
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2675 Array of Objects to Matrix ─────────────────────────────────────
def fix_q2675(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: collect all keys by scanning every object O(n*k),
#  sort them, then build each row by checking every object for every key.
#  O(n*k²) due to repeated key lookup across unsorted structure."
class _2675_ArrayOfObjectsToMatrix_Brute:
    def jsonToMatrix(self, arr: list) -> list:
        def flatten(obj, prefix=""):
            result = {}
            if isinstance(obj, dict):
                for k, v in obj.items():
                    key = prefix + ("." if prefix else "") + str(k)
                    result.update(flatten(v, key))
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    key = prefix + ("." if prefix else "") + str(i)
                    result.update(flatten(v, key))
            else:
                result[prefix] = obj
            return result
        flat_objects = [flatten(obj) for obj in arr]
        # Collect all unique keys by scanning every flattened object (O(n*k))
        all_keys = []
        seen_keys = set()
        for obj in flat_objects:
            for k in obj:
                if k not in seen_keys:
                    seen_keys.add(k)
                    all_keys.append(k)
        all_keys.sort()
        header = ["id"] + all_keys
        rows = [header]
        for i, obj in enumerate(flat_objects):
            row = [i] + [obj.get(k, "") for k in all_keys]
            rows.append(row)
        return rows
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Flatten all objects, collect keys into a set O(n*k), sort once, build matrix."
class _2675_ArrayOfObjectsToMatrix:
    def jsonToMatrix(self, arr: list) -> list:
        def flatten(obj, prefix=""):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    key = (prefix + "." if prefix else "") + str(k)
                    yield from flatten(v, key)
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    key = (prefix + "." if prefix else "") + str(i)
                    yield from flatten(v, key)
            else:
                yield prefix, obj
        flat = [{k: v for k, v in flatten(obj)} for obj in arr]
        keys = sorted({k for obj in flat for k in obj})
        header = ["id"] + keys
        rows = [header]
        for i, obj in enumerate(flat):
            rows.append([i] + [obj.get(k, "") for k in keys])
        return rows
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ── Q2700 Differences Between Two Objects ────────────────────────────────
def fix_q2700(code: str) -> str:
    new_p2 = '''\
# PHASE 2 — BRUTE FORCE
# "Brute force: flatten both objects to key→value dicts, then compare all keys.
#  O(n*d) to flatten (n keys, d depth), O(n) to compare — simple but two-pass."
class _2700_DifferencesBetweenTwoObjects_Brute:
    def diffObjects(self, obj1, obj2) -> dict:
        def flatten(obj, prefix=""):
            out = {}
            if isinstance(obj, dict):
                for k, v in obj.items():
                    key = (prefix + "." if prefix else "") + str(k)
                    out.update(flatten(v, key))
            elif isinstance(obj, list):
                pass  # arrays are treated as leaf values
            else:
                out[prefix] = obj
            return out
        flat1 = flatten(obj1)
        flat2 = flatten(obj2)
        all_keys = set(flat1) | set(flat2)
        diff = {}
        for k in all_keys:
            v1 = flat1.get(k)
            v2 = flat2.get(k)
            if v1 != v2 and k:
                # Rebuild nested structure for this key
                parts = k.split(".")
                node = diff
                for part in parts[:-1]:
                    node = node.setdefault(part, {})
                node[parts[-1]] = [v1, v2]
        return diff
'''
    new_p4 = '''\
# PHASE 4 — CLEAN CODE
# "Single-pass recursive diff — only descend into dicts, treat arrays as leaves."
class _2700_DifferencesBetweenTwoObjects:
    def diffObjects(self, obj1, obj2) -> dict:
        if not isinstance(obj1, dict) or not isinstance(obj2, dict):
            return {} if obj1 == obj2 else {"": [obj1, obj2]}
        result = {}
        all_keys = set(obj1) | set(obj2)
        for k in all_keys:
            if k not in obj1:
                result[k] = [None, obj2[k]]
            elif k not in obj2:
                result[k] = [obj1[k], None]
            else:
                sub = self.diffObjects(obj1[k], obj2[k])
                if sub:
                    result[k] = sub
                elif obj1[k] != obj2[k]:
                    result[k] = [obj1[k], obj2[k]]
        return result
'''
    code = replace_phase_block(code, 2, new_p2)
    code = replace_phase_block(code, 4, new_p4)
    return code


# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════
with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

print("Applying fixes…")
patch_question(data, 1242, lambda c: Q1242_CODE)   # full rebuild
patch_question(data, 843,  fix_q843)
patch_question(data, 761,  fix_q761)
patch_question(data, 1153, fix_q1153)
patch_question(data, 2627, fix_q2627)
patch_question(data, 2628, fix_q2628)
patch_question(data, 2630, fix_q2630)
patch_question(data, 2633, fix_q2633)
patch_question(data, 2636, fix_q2636)
patch_question(data, 2675, fix_q2675)
patch_question(data, 2700, fix_q2700)

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print("\nDone. Re-running audit…\n")

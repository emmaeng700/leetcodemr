"""
Scrape WalkCC + LeetDoocs + SimplyLeet + LeetCode.ca for the 32 NC150 "not in 331" questions.
Python solutions only. Saves to .nc32_sites_cache.json

Usage:
  python3 scrape_nc32_sites.py
"""

import json, re, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

SCRIPT_DIR  = Path(__file__).parent
CACHE_FILE  = SCRIPT_DIR / ".nc32_sites_cache.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# ── NC32 question list (id + slug) ─────────────────────────────────────────────
NC32_QUESTIONS = [
    {"id": 567,  "slug": "permutation-in-string"},
    {"id": 853,  "slug": "car-fleet"},
    {"id": 875,  "slug": "koko-eating-bananas"},
    {"id": 138,  "slug": "copy-list-with-random-pointer"},
    {"id": 1448, "slug": "count-good-nodes-in-binary-tree"},
    {"id": 703,  "slug": "kth-largest-element-in-a-stream"},
    {"id": 1046, "slug": "last-stone-weight"},
    {"id": 355,  "slug": "design-twitter"},
    {"id": 40,   "slug": "combination-sum-ii"},
    {"id": 131,  "slug": "palindrome-partitioning"},
    {"id": 684,  "slug": "redundant-connection"},
    {"id": 743,  "slug": "network-delay-time"},
    {"id": 332,  "slug": "reconstruct-itinerary"},
    {"id": 1584, "slug": "min-cost-to-connect-all-points"},
    {"id": 778,  "slug": "swim-in-rising-water"},
    {"id": 746,  "slug": "min-cost-climbing-stairs"},
    {"id": 213,  "slug": "house-robber-ii"},
    {"id": 647,  "slug": "palindromic-substrings"},
    {"id": 518,  "slug": "coin-change-ii"},
    {"id": 494,  "slug": "target-sum"},
    {"id": 97,   "slug": "interleaving-string"},
    {"id": 45,   "slug": "jump-game-ii"},
    {"id": 846,  "slug": "hand-of-straights"},
    {"id": 1899, "slug": "merge-triplets-to-form-target-triplet"},
    {"id": 763,  "slug": "partition-labels"},
    {"id": 678,  "slug": "valid-parenthesis-string"},
    {"id": 1851, "slug": "minimum-interval-to-include-each-query"},
    {"id": 202,  "slug": "happy-number"},
    {"id": 66,   "slug": "plus-one"},
    {"id": 43,   "slug": "multiply-strings"},
    {"id": 2013, "slug": "detect-squares"},
    {"id": 371,  "slug": "sum-of-two-integers"},
]

SKIP_LANGS = {"text", "unknown", "plaintext", "none", ""}

# ── Helpers ────────────────────────────────────────────────────────────────────
def _fetch(url, session):
    try:
        r = session.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None

def _clean(raw):
    t = re.sub(r'<span[^>]*>', '', raw)
    t = re.sub(r'</span>', '', t)
    t = re.sub(r'<code[^>]*>', '', t)
    t = re.sub(r'</code>', '', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = t.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    t = t.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    t = t.replace('&#x27;', "'").replace('&#x2F;', '/')
    return t.strip()

def _norm_lang(raw):
    m = {"python": "python", "python3": "python", "python2": "python", "py": "python",
         "c++": "cpp", "cplusplus": "cpp", "cpp": "cpp"}
    return m.get(raw.lower().strip(), raw.lower().strip())

def _detect(code):
    if re.search(r'class Solution\s*:', code): return "python"
    if re.search(r'def \w+\s*\(', code): return "python"
    if re.search(r'from \w+ import|import \w+\s*$', code, re.M): return "python"
    if re.search(r'#include|vector\s*<|std::', code): return "cpp"
    if re.search(r'class Solution\s*\{', code): return "cpp"
    return "unknown"

def _python_only(blocks):
    """Filter to Python only, deduplicated."""
    seen, result = set(), []
    for b in blocks:
        lang = _norm_lang(b.get("lang", ""))
        if lang != "python":
            lang = _detect(b["code"])
        if lang != "python":
            continue
        key = b["code"][:120]
        if key in seen:
            continue
        seen.add(key)
        result.append(b["code"])
    return result

# ── Site scrapers ──────────────────────────────────────────────────────────────
def _blocks_table(html):
    """WalkCC / LeetDoocs — code from <td class="code">."""
    blocks = []
    for td in re.finditer(r'<td[^>]+class="[^"]*\bcode\b[^"]*"[^>]*>', html, re.I):
        sl = html[td.start(): td.start() + 10000]
        cm = re.search(r'<code[^>]*>([\s\S]*?)</code>', sl)
        if not cm: continue
        code = _clean(cm.group(1))
        if len(code) < 60: continue
        blocks.append({"code": code, "lang": _detect(code)})
    return blocks

def _blocks_class(html):
    """SimplyLeet / LeetCode.ca — <code class="language-X">."""
    blocks = []
    seen = set()
    for m in re.finditer(r'<code([^>]*)>([\s\S]*?)</code>', html, re.I):
        attrs = m.group(1)
        lm = re.search(r'language-([a-zA-Z0-9+#]+)', attrs, re.I)
        if not lm: continue
        lang = _norm_lang(lm.group(1))
        code = _clean(m.group(2))
        if len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        blocks.append({"code": code, "lang": lang})
    return blocks

def _blocks_generic(html):
    blocks = []
    seen = set()
    for m in re.finditer(r'<pre[^>]*>([\s\S]*?)</pre>', html, re.I):
        lm = re.search(r'language-([a-zA-Z0-9+#]+)', m.group(0), re.I)
        code = _clean(m.group(1))
        if re.match(r'^\d[\d\s]*$', code) or len(code) < 60: continue
        key = code[:80]
        if key in seen: continue
        seen.add(key)
        lang = _norm_lang(lm.group(1)) if lm else _detect(code)
        blocks.append({"code": code, "lang": lang})
    return blocks

def scrape_walkccc(qid, session):
    html = _fetch(f"https://walkccc.me/LeetCode/problems/{qid}/", session)
    if not html: return []
    return _python_only(_blocks_table(html) or _blocks_generic(html))

def scrape_doocs(qid, session):
    html = _fetch(f"https://leetcode.doocs.org/en/lc/{qid}/", session)
    if not html: return []
    return _python_only(_blocks_table(html) or _blocks_generic(html))

def scrape_simplyleet(slug, session):
    html = _fetch(f"https://www.simplyleet.com/{slug}", session)
    if not html: return []
    return _python_only(_blocks_class(html) or _blocks_generic(html))

_LCCA_MAP = {}
def _build_lcca_map(session):
    global _LCCA_MAP
    if _LCCA_MAP: return
    print("  Building LeetCode.ca sitemap…")
    html = _fetch("https://leetcode.ca/sitemap.xml", session)
    if not html: return
    for m in re.finditer(r'<loc>(https://leetcode\.ca/\d{4}-\d{2}-\d{2}-(\d+)-[^<]+)</loc>', html):
        _LCCA_MAP[m.group(2)] = m.group(1)
    print(f"  LeetCode.ca: {len(_LCCA_MAP)} entries found")

def scrape_leetcodeca(qid, session):
    url = _LCCA_MAP.get(str(qid))
    if not url: return []
    html = _fetch(url, session)
    if not html: return []
    return _python_only(_blocks_class(html) or _blocks_generic(html))

# ── Main ────────────────────────────────────────────────────────────────────────
def run():
    # Load existing cache
    cache = {}
    if CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text())

    to_fetch = [q for q in NC32_QUESTIONS if q["slug"] not in cache]

    if not to_fetch:
        print(f"Cache complete — {len(cache)} entries. Nothing to fetch.")
        return cache

    print(f"Fetching {len(to_fetch)} questions from 4 sites…")

    with requests.Session() as session:
        _build_lcca_map(session)

        total = len(to_fetch)
        for i, q in enumerate(to_fetch, 1):
            qid  = q["id"]
            slug = q["slug"]
            print(f"  [{i}/{total}] {slug} (#{qid})…", end=" ", flush=True)

            walkccc    = scrape_walkccc(qid, session)
            doocs      = scrape_doocs(qid, session)
            simplyleet = scrape_simplyleet(slug, session)
            leetcodeca = scrape_leetcodeca(qid, session)

            entry = {
                "walkccc":    walkccc,
                "doocs":      doocs,
                "simplyleet": simplyleet,
                "leetcodeca": leetcodeca,
            }
            total_py = sum(len(v) for v in entry.values())
            print(f"walk={len(walkccc)} doocs={len(doocs)} simply={len(simplyleet)} lcca={len(leetcodeca)} → {total_py} python")

            cache[slug] = entry
            CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")

            time.sleep(0.8)

    print(f"\nDone. {len(cache)} entries saved to {CACHE_FILE.name}")
    return cache

if __name__ == "__main__":
    run()

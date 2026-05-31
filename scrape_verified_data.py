"""
scrape_verified_data.py
========================
Re-scrapes all 331 questions from:
  • LeetDoocs  — correct descriptions + multi-lang solutions (uses real LC IDs)
  • WalkCC     — clean Python / Java / C++ solutions (uses real LC IDs)
  • SimplyLeet — key insights, complexity, solution text, Python code (uses slugs)

Writes / updates:
  .doocs_cache.json
  .full_langs_cache.json
  public/quick_review_info.json

Usage:
  python3 scrape_verified_data.py
  python3 scrape_verified_data.py --force   # re-fetch even if already cached
"""
import json, re, sys, time, html as _html
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
FORCE      = '--force' in sys.argv
DELAY      = 0.8          # seconds between requests per worker
MAX_WORKERS = 5

H = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0',
    'Accept-Language': 'en-US,en;q=0.9',
}

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent
QUESTIONS   = json.loads((ROOT / 'public/questions_full.json').read_text())
DOOCS_PATH  = ROOT / '.doocs_cache.json'
LANGS_PATH  = ROOT / '.full_langs_cache.json'
QR_PATH     = ROOT / 'public/quick_review_info.json'

doocs_cache = json.loads(DOOCS_PATH.read_text()) if DOOCS_PATH.exists() else {}
langs_cache = json.loads(LANGS_PATH.read_text()) if LANGS_PATH.exists() else {}
qr_list     = json.loads(QR_PATH.read_text()) if QR_PATH.exists() else []
qr_cache    = {q['slug']: q for q in qr_list}

# Real LeetCode ID mapping (built from LeetCode public API)
# slug → real frontend_question_id
try:
    r = requests.get('https://leetcode.com/api/problems/all/', headers=H, timeout=20)
    SLUG_TO_LCID = {s['stat']['question__title_slug']: s['stat']['frontend_question_id']
                    for s in r.json()['stat_status_pairs']}
    print(f"Fetched real LC IDs: {len(SLUG_TO_LCID)} problems")
except Exception as e:
    print(f"Warning: couldn't fetch LC ID map ({e}), using local IDs")
    SLUG_TO_LCID = {}

def real_id(q):
    return SLUG_TO_LCID.get(q['slug'], q['id'])

# ── LeetDoocs scraper ─────────────────────────────────────────────────────────
def _clean_code(text: str) -> str:
    """Strip line-number prefix from WalkCC / LeetDoocs code blocks."""
    lines = []
    for ln in text.split('\n'):
        # Remove leading digits + spaces that are line numbers
        ln2 = re.sub(r'^\s*\d+\s', '', ln)
        lines.append(ln2)
    return '\n'.join(lines).strip()

def _detect_lang_from_code(code: str) -> str:
    c = code.strip()
    if 'def ' in c and ('self' in c or 'cls' in c):   return 'python'
    if 'function ' in c or '=>' in c:                   return 'javascript'
    if 'public int' in c or 'public List' in c or 'public String' in c: return 'java'
    if 'vector<' in c or '#include' in c or '::' in c: return 'cpp'
    if 'func ' in c and 'return' in c:                  return 'go'
    if 'fn ' in c and '->' in c:                        return 'rust'
    if 'class Solution:' in c and 'def ' in c:          return 'python'
    return 'unknown'

def scrape_doocs(q) -> dict | None:
    rid = real_id(q)
    url = f'https://leetcode.doocs.org/en/lc/{rid}/'
    try:
        r = requests.get(url, headers=H, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')
        article = soup.select_one('.md-content article')
        if not article:
            return None

        # ── Description: everything before first "Solutions" h2 ──────────────
        desc_parts = []
        collecting = True
        for el in article.children:
            if not hasattr(el, 'name'):
                continue
            if el.name in ('h2', 'h3'):
                txt = el.get_text().lower()
                if any(w in txt for w in ('solution', 'approach', 'note', 'hint')):
                    collecting = False
            # Skip edit button and nav tags at top
            if el.name == 'a' and 'md-content__button' in el.get('class', []):
                continue
            if el.name == 'nav':
                continue
            if collecting:
                desc_parts.append(str(el))

        desc_html = '\n'.join(desc_parts).strip()

        # ── Code blocks: tabbed sets ──────────────────────────────────────────
        blocks = []
        for tabset in article.select('.tabbed-set'):
            labels = [lb.get_text().strip() for lb in tabset.select('.tabbed-labels label')]
            tab_blocks = tabset.select('.tabbed-content .tabbed-block')
            for i, (label, block) in enumerate(zip(labels, tab_blocks)):
                pre = block.select_one('pre code') or block.select_one('pre')
                if not pre:
                    continue
                code = pre.get_text()
                code = _clean_code(code)
                if not code:
                    continue
                lang = label.lower().replace('c++', 'cpp').replace('c#', 'csharp')
                blocks.append({'lang': lang, 'code': code})

        return {'desc_html': desc_html, 'blocks': blocks}
    except Exception:
        return None

# ── WalkCC scraper ────────────────────────────────────────────────────────────
def scrape_walkccc(q) -> list:
    rid = real_id(q)
    url = f'https://walkccc.me/LeetCode/problems/{rid}/'
    try:
        r = requests.get(url, headers=H, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        blocks = []
        for tabset in soup.select('.tabbed-set'):
            labels = [lb.get_text().strip() for lb in tabset.select('.tabbed-labels label')]
            tab_blocks = tabset.select('.tabbed-content .tabbed-block')
            for label, block in zip(labels, tab_blocks):
                pre = block.select_one('pre code') or block.select_one('pre')
                if not pre:
                    continue
                code = pre.get_text()
                code = _clean_code(code)
                if not code:
                    continue
                lang = label.lower().replace('c++', 'cpp').replace('c#', 'csharp')
                blocks.append({'lang': lang, 'code': code})
        return blocks
    except Exception:
        return []

# ── SimplyLeet scraper ────────────────────────────────────────────────────────
def _section_text(soup, heading: str) -> str:
    """Extract text content of the section following the given h2 heading."""
    for h2 in soup.find_all('h2'):
        if heading.lower() in h2.get_text().lower():
            parts = []
            for sib in h2.next_siblings:
                if sib.name == 'h2':
                    break
                if hasattr(sib, 'get_text'):
                    t = sib.get_text('\n', strip=True)
                    if t:
                        parts.append(t)
            return '\n'.join(parts).strip()
    return ''

def _section_codes(soup) -> list:
    """Extract code blocks from 'Code Solutions' section."""
    blocks = []
    in_section = False
    for el in soup.find_all(['h2', 'pre', 'code']):
        if el.name == 'h2':
            in_section = 'code' in el.get_text().lower()
            continue
        if in_section and el.name == 'pre':
            code = el.get_text().strip()
            if code:
                lang = _detect_lang_from_code(code)
                blocks.append({'lang': lang, 'code': code})
    return blocks

def scrape_simplyleet(q) -> dict:
    url = f'https://www.simplyleet.com/{q["slug"]}'
    try:
        r = requests.get(url, headers=H, timeout=15)
        if r.status_code != 200:
            return {}
        soup = BeautifulSoup(r.text, 'html.parser')

        desc    = _section_text(soup, 'Problem Description')
        ki      = _section_text(soup, 'Key Insights')
        cx      = _section_text(soup, 'Space and Time')
        sol     = _section_text(soup, 'Solution')
        codes   = _section_codes(soup)

        return {
            'id':           q['id'],
            'title':        q['title'],
            'slug':         q['slug'],
            'solution_url': url,
            'key_insights': ki,
            'complexity':   cx,
            'solution':     sol,
            '_desc':        desc,   # may be used to cross-check
            '_codes':       codes,  # Python code from SimplyLeet
        }
    except Exception:
        return {}

# ── Worker ────────────────────────────────────────────────────────────────────
def process(q):
    slug = q['slug']
    qid  = str(q['id'])
    rid  = real_id(q)

    results = {}

    # LeetDoocs
    if FORCE or qid not in doocs_cache or real_id(q) != q['id']:
        d = scrape_doocs(q)
        if d:
            results['doocs'] = d
        time.sleep(DELAY)

    # WalkCC
    wcc = scrape_walkccc(q)
    if wcc:
        results['walkccc'] = wcc
    time.sleep(DELAY)

    # SimplyLeet
    if FORCE or slug not in qr_cache:
        sl = scrape_simplyleet(q)
        if sl:
            results['simplyleet'] = sl
        time.sleep(DELAY)
    else:
        sl = None

    return q, results, sl

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"Scraping {len(QUESTIONS)} questions from LeetDoocs + WalkCC + SimplyLeet...")
    print(f"Force mode: {FORCE}")
    print()

    ok = err = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(process, q): q for q in QUESTIONS}
        for i, fut in enumerate(as_completed(futures), 1):
            q, results, sl_data = fut.result()
            slug = q['slug']
            qid  = str(q['id'])

            # Update doocs cache
            if 'doocs' in results and results['doocs']:
                doocs_cache[qid] = results['doocs']

            # Update langs cache
            entry = dict(langs_cache.get(slug, {}))
            if 'walkccc' in results:
                entry['walkccc'] = results['walkccc']

            # Merge SimplyLeet Python code into langs
            if sl_data and sl_data.get('_codes'):
                py_blocks = [b for b in sl_data['_codes']
                             if b['lang'] in ('python', 'python3')]
                if py_blocks:
                    entry['simplyleet'] = py_blocks

            if entry:
                langs_cache[slug] = entry

            # Update QR cache
            if sl_data and sl_data.get('key_insights'):
                qr_cache[slug] = {
                    'id':           q['id'],
                    'title':        q['title'],
                    'slug':         slug,
                    'solution_url': sl_data.get('solution_url', ''),
                    'key_insights': sl_data.get('key_insights', ''),
                    'complexity':   sl_data.get('complexity', ''),
                    'solution':     sl_data.get('solution', ''),
                }

            ok += 1
            if i % 20 == 0 or i == len(QUESTIONS):
                print(f"  [{i:3d}/{len(QUESTIONS)}] {q['title'][:40]:<40} "
                      f"doocs={'✓' if 'doocs' in results else '–'} "
                      f"walkcc={'✓' if results.get('walkccc') else '–'} "
                      f"sl={'✓' if sl_data and sl_data.get('key_insights') else '–'}")

                # Save incrementally every 20 questions
                DOOCS_PATH.write_text(json.dumps(doocs_cache, ensure_ascii=False, indent=2))
                LANGS_PATH.write_text(json.dumps(langs_cache, ensure_ascii=False, indent=2))
                qr_out = [qr_cache[s] for s in qr_cache
                          if isinstance(qr_cache[s], dict) and 'slug' in qr_cache[s]]
                QR_PATH.write_text(json.dumps(qr_out, ensure_ascii=False, indent=2))

    # Final save
    DOOCS_PATH.write_text(json.dumps(doocs_cache, ensure_ascii=False, indent=2))
    LANGS_PATH.write_text(json.dumps(langs_cache, ensure_ascii=False, indent=2))
    qr_out = [qr_cache[s] for s in qr_cache
              if isinstance(qr_cache[s], dict) and 'slug' in qr_cache[s]]
    QR_PATH.write_text(json.dumps(qr_out, ensure_ascii=False, indent=2))

    print(f"\nDone. {ok} processed, {err} errors.")
    print(f"doocs_cache: {len(doocs_cache)} entries")
    print(f"langs_cache: {len(langs_cache)} entries")
    print(f"quick_review: {len(qr_out)} entries")

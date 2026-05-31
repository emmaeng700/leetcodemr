"""
scrape_missing_code.py
======================
Targeted re-scrape for questions missing SimplyLeet or LC.ca Python code.
Also fixes the language detector (Python without self/cls was misidentified).

Run:  python3 scrape_missing_code.py
"""
import json, re, time
from pathlib import Path
import re
import requests
from bs4 import BeautifulSoup

H = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                   'AppleWebKit/537.36 Chrome/120.0'}

ROOT       = Path(__file__).parent
QS         = json.loads((ROOT / 'public/questions_full.json').read_text())
LANGS_PATH = ROOT / '.full_langs_cache.json'
langs      = json.loads(LANGS_PATH.read_text())

# Real LC ID mapping
SLUG_TO_LCID = json.loads(open('/tmp/slug_to_lcid.json').read())
LCA_URL_MAP  = {int(k): v for k,v in json.loads(open('/tmp/lca_url_map.json').read()).items()}

def real_id(q):
    return SLUG_TO_LCID.get(q['slug'], q['id'])

# ── Language detector ─────────────────────────────────────────────────────────
def detect_lang(code: str) -> str:
    """Content-based language detection using regex to avoid comment false-positives."""
    c = code.strip()
    # Python: 'def ' at start of a line (avoids matching '# Define a function')
    if re.search(r'^\s*def \w', c, re.MULTILINE) or 'class Solution:' in c:
        return 'python'
    if re.search(r'\bfunction\s+\w', c) or ('=>' in c and '{' in c):
        return 'javascript'
    if 'public int' in c or 'public List' in c or 'public String' in c or 'public boolean' in c:
        return 'java'
    if 'public:' in c or 'vector<' in c or '#include' in c:
        return 'cpp'
    if re.search(r'\bfunc \w', c) and ('return' in c or '->' in c):
        return 'go'
    if 'fn ' in c and '->' in c:
        return 'rust'
    return 'unknown'

def detect_lang_from_class(classes: str) -> str:
    """Trust explicit language-* CSS class (SimplyLeet uses these reliably)."""
    c = classes.lower()
    if 'python' in c:   return 'python'
    if 'javascript' in c: return 'javascript'
    if 'typescript' in c: return 'typescript'
    if 'java' in c:     return 'java'
    if 'cpp' in c or 'c++' in c: return 'cpp'
    if 'go' in c:       return 'go'
    return 'unknown'

# ── SimplyLeet scraper ────────────────────────────────────────────────────────
def scrape_sl_code(slug: str) -> list:
    """Extract Python code from SimplyLeet's Code Solutions section."""
    url = f'https://www.simplyleet.com/{slug}'
    try:
        r = requests.get(url, headers=H, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')

        blocks = []
        in_code_section = False
        seen = set()

        for el in soup.find_all(['h2', 'h3', 'pre', 'code']):
            if el.name in ('h2', 'h3'):
                in_code_section = 'code' in el.get_text().lower()
                continue
            if not in_code_section:
                continue

            # Prefer <code class="language-*"> over bare <pre>
            txt = el.get_text().strip()
            if len(txt) < 20 or txt in seen:
                continue

            classes = ' '.join(el.get('class') or [])
            is_explicit = 'language-' in classes
            is_bare_pre = el.name == 'pre' and not el.find('code')

            if is_explicit:
                # Trust the CSS class — avoids comment false-positives
                lang = detect_lang_from_class(classes)
            elif is_bare_pre:
                lang = detect_lang(txt)
            else:
                continue

            if lang not in ('unknown',):
                seen.add(txt)
                blocks.append({'lang': lang, 'code': txt})

        return blocks
    except Exception as e:
        print(f"  SimplyLeet error for {slug}: {e}")
        return []

# ── LC.ca scraper ─────────────────────────────────────────────────────────────
def scrape_lca_code(q) -> list:
    """Scrape Python (and other lang) code from LC.ca using sitemap URL."""
    rid = real_id(q)
    url = LCA_URL_MAP.get(rid)
    if not url:
        return []
    try:
        r = requests.get(url, headers=H, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        article = soup.find('article') or soup.find('main') or soup

        blocks = []
        seen = set()
        for el in article.find_all('pre'):
            # Skip if this pre contains a code child (avoid dups)
            if el.find('code'):
                # Use the code child text
                inner = el.find('code')
                txt = inner.get_text().strip()
            else:
                txt = el.get_text().strip()

            if len(txt) < 20 or txt in seen:
                continue
            lang = detect_lang(txt)
            if lang != 'unknown':
                seen.add(txt)
                blocks.append({'lang': lang, 'code': txt})
        return blocks
    except Exception as e:
        print(f"  LC.ca error for {q['slug']}: {e}")
        return []

# ── Find questions that need fixing ──────────────────────────────────────────
def needs_sl(q):
    entry = langs.get(q['slug'], {})
    py = [b for b in entry.get('simplyleet', [])
          if b.get('lang','').lower() in ('python','python3','py')]
    return len(py) == 0

def needs_lca(q):
    entry = langs.get(q['slug'], {})
    py = [b for b in entry.get('leetcodeca', [])
          if b.get('lang','').lower() in ('python','python3','py')]
    return len(py) == 0

to_fix_sl  = [q for q in QS if needs_sl(q)]
to_fix_lca = [q for q in QS if needs_lca(q) and q.get('tags') and
              # Skip JS-only questions (they won't have Python on LC.ca)
              not all(t.lower() in ('javascript','typescript') for t in q.get('tags',[]))]

print(f"Questions needing SimplyLeet re-scrape: {len(to_fix_sl)}")
for q in to_fix_sl: print(f"  #{q['id']} {q['title']}")
print(f"\nQuestions needing LC.ca re-scrape (non-JS): {len(to_fix_lca)}")
for q in to_fix_lca: print(f"  #{q['id']} {q['title']}")

# ── Re-scrape ─────────────────────────────────────────────────────────────────
updated = 0

print("\n--- SimplyLeet ---")
for q in to_fix_sl:
    slug = q['slug']
    blocks = scrape_sl_code(slug)
    py = [b for b in blocks if b['lang'] in ('python','python3','py')]
    entry = dict(langs.get(slug, {}))
    if py:
        entry['simplyleet'] = py
        langs[slug] = entry
        updated += 1
        print(f"  ✓ #{q['id']} {q['title']}: {len(py)} Python block(s)")
        print(f"      {py[0]['code'][:60].strip()}")
    else:
        all_langs = [b['lang'] for b in blocks]
        print(f"  ✗ #{q['id']} {q['title']}: no Python (found {all_langs})")
    time.sleep(0.8)

print("\n--- LC.ca ---")
for q in to_fix_lca:
    slug = q['slug']
    blocks = scrape_lca_code(q)
    py = [b for b in blocks if b['lang'] in ('python','python3','py')]
    entry = dict(langs.get(slug, {}))
    if py:
        entry['leetcodeca'] = py   # store only python for PDF use
        langs[slug] = entry
        updated += 1
        print(f"  ✓ #{q['id']} {q['title']}: {len(py)} Python block(s)")
        print(f"      {py[0]['code'][:60].strip()}")
    else:
        all_langs = [b['lang'] for b in blocks]
        print(f"  ✗ #{q['id']} {q['title']}: no Python (found {all_langs})")
    time.sleep(0.8)

# ── Save ─────────────────────────────────────────────────────────────────────
LANGS_PATH.write_text(json.dumps(langs, ensure_ascii=False, indent=2))
print(f"\nDone. Updated {updated} entries → {LANGS_PATH.name}")

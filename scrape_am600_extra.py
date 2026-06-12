"""
scrape_am600_extra.py
─────────────────────
Scrapes the AlgoMaster-600 questions that are NOT in the existing 331-question
set AND not in NeetCode 150 (370 questions), filling in all data needed to run
generate_better_pdf.py:

  • am600_extra_questions.json   — same schema as questions_full.json
  • .full_langs_cache.json       — updated with walkccc / doocs / simplyleet / leetcodeca blocks
  • .doocs_cache.json            — updated with desc_html + code blocks from LeetDoocs

Resumable: already-cached questions are skipped on re-runs.
Run:  python3 scrape_am600_extra.py
      python3 scrape_am600_extra.py --limit 20   (process first N missing)
"""

import json, re, sys, time, textwrap
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ─── Paths ────────────────────────────────────────────────────────────────────
HERE            = Path(__file__).parent
QUESTIONS_331   = HERE / 'public' / 'questions_full.json'
AM600_EXTRA_OUT = HERE / 'am600_extra_questions.json'
SITES_CACHE     = HERE / '.full_langs_cache.json'
DOOCS_CACHE     = HERE / '.doocs_cache.json'

# ─── Parse AM600 from TypeScript ─────────────────────────────────────────────
def load_am600() -> list[dict]:
    ts = (HERE / 'src' / 'lib' / 'algomaster600.ts').read_text()
    entries = re.findall(
        r"\{ id: (\d+), title: '((?:[^'\\]|\\.)+)', slug: '([^']+)', difficulty: '(Easy|Medium|Hard)' \}",
        ts,
    )
    return [{'id': int(i), 'title': t.replace("\\'", "'"), 'slug': s, 'difficulty': d}
            for i, t, s, d in entries]


def _load_nc150_ids() -> set[int]:
    ts = (HERE / 'src' / 'lib' / 'neetcode150.ts').read_text()
    return {int(m) for m in re.findall(r'\{ id: (\d+),\s+title:', ts)}


# ─── HTTP helpers ─────────────────────────────────────────────────────────────
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/124.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

def get(url: str, *, timeout=15, retries=3, delay=1.5) -> requests.Response | None:
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f'    429 rate-limited → sleeping {wait}s')
                time.sleep(wait)
            else:
                return r          # caller handles non-200
        except Exception as e:
            print(f'    GET error ({url}): {e}')
            time.sleep(delay * (attempt + 1))
    return None


def post_json(url: str, payload: dict, *, timeout=15) -> dict | None:
    try:
        r = requests.post(url, json=payload, headers={**HEADERS,
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com/',
        }, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f'    POST error ({url}): {e}')
    return None


# ─── LeetCode GraphQL ─────────────────────────────────────────────────────────
LC_GQL = 'https://leetcode.com/graphql'
GQL_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    difficulty
    content
    topicTags { name }
    codeSnippets { langSlug code }
  }
}
"""

def fetch_lc(slug: str) -> dict | None:
    data = post_json(LC_GQL, {'query': GQL_QUERY, 'variables': {'titleSlug': slug}})
    if data:
        return (data.get('data') or {}).get('question')
    return None


def extract_starter(snippets: list, *lang_slugs) -> str:
    for ls in lang_slugs:
        for s in (snippets or []):
            if s.get('langSlug', '').lower() == ls:
                return s.get('code', '')
    return ''


# ─── Code-block extractor (shared by walkccc / simplyleet / leetcodeca) ───────
def extract_code_blocks(soup: BeautifulSoup, *, lang_hint: str = '') -> list[dict]:
    blocks = []
    seen = set()
    for el in soup.find_all('code') + soup.find_all('pre'):
        text = el.get_text()
        clean = text.strip()
        if len(clean) < 20 or clean in seen:
            continue
        seen.add(clean)
        # detect language from class or content heuristics
        cls = ' '.join(el.get('class', []))
        if 'python' in cls.lower() or clean.startswith('class Solution') and 'def ' in clean:
            lang = 'python'
        elif 'cpp' in cls.lower() or '#include' in clean or 'vector<' in clean:
            lang = 'cpp'
        elif 'java' in cls.lower() and 'public' in clean:
            lang = 'java'
        elif lang_hint:
            lang = lang_hint
        else:
            lang = 'python' if ('def ' in clean and ':' in clean) else 'cpp'
        blocks.append({'code': clean, 'lang': lang})
    return blocks


# ─── WalkCC ───────────────────────────────────────────────────────────────────
def fetch_walkccc(qid: int) -> list[dict]:
    r = get(f'https://walkccc.me/LeetCode/problems/{qid}/')
    if not r or r.status_code != 200:
        return []
    soup = BeautifulSoup(r.text, 'html.parser')
    blocks = []
    seen = set()
    # WalkCC wraps code in <div class="highlight"> or <code> inside tab panels
    for pre in soup.select('div.highlight pre, pre > code, .tabbed-content pre'):
        text = pre.get_text().strip()
        if len(text) < 20 or text in seen:
            continue
        seen.add(text)
        parent_cls = ' '.join(pre.parent.get('class', []))
        if 'python' in parent_cls.lower() or ('def ' in text and ':' in text):
            lang = 'python'
        elif 'cpp' in parent_cls.lower() or '#include' in text or 'vector<' in text:
            lang = 'cpp'
        elif 'java' in parent_cls.lower():
            lang = 'java'
        else:
            lang = 'python' if ('def ' in text and ':' in text) else 'unknown'
        blocks.append({'code': text, 'lang': lang})
    return blocks


# ─── SimplyLeet ───────────────────────────────────────────────────────────────
def fetch_simplyleet(slug: str) -> list[dict]:
    r = get(f'https://www.simplyleet.com/{slug}')
    if not r or r.status_code != 200:
        return []
    soup = BeautifulSoup(r.text, 'html.parser')
    return extract_code_blocks(soup, lang_hint='python')


# ─── LeetDoocs ────────────────────────────────────────────────────────────────
def fetch_doocs(qid: int) -> dict:
    """Returns {'desc_html': str, 'blocks': [{code, lang}]}"""
    r = get(f'https://leetcode.doocs.org/en/lc/{qid}/')
    if not r or r.status_code != 200:
        return {}
    soup = BeautifulSoup(r.text, 'html.parser')
    # Description: usually inside <div class="question-content"> or similar
    desc_el = (soup.find(class_='question-content')
               or soup.find(id='question-content')
               or soup.find('article'))
    desc_html = str(desc_el) if desc_el else ''
    # Code blocks
    blocks = []
    seen = set()
    for pre in soup.select('pre > code, .highlight pre'):
        text = pre.get_text().strip()
        if len(text) < 15 or text in seen:
            continue
        seen.add(text)
        cls = ' '.join(pre.get('class', []) + pre.parent.get('class', []))
        if 'python' in cls.lower() or ('def ' in text and ':' in text and 'class Solution' in text):
            lang = 'python'
        elif 'cpp' in cls.lower() or '#include' in text:
            lang = 'cpp'
        elif 'java' in cls.lower():
            lang = 'java'
        else:
            lang = 'python' if ('def ' in text and 'return' in text) else 'unknown'
        blocks.append({'code': text, 'lang': lang})
    return {'desc_html': desc_html, 'blocks': blocks}


# ─── LC.ca ────────────────────────────────────────────────────────────────────
def fetch_leetcodeca(qid: int, slug: str) -> list[dict]:
    # LC.ca URL pattern: https://leetcode.ca/all/{id}-{Title-With-Dashes}.html
    # or just https://leetcode.ca/{id}/
    for url in [
        f'https://leetcode.ca/all/{qid}-{slug}.html',
        f'https://leetcode.ca/{qid}/',
    ]:
        r = get(url)
        if r and r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            return extract_code_blocks(soup, lang_hint='python')
    return []


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    limit = None
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == '--limit' and i + 1 < len(args):
            limit = int(args[i + 1])

    # Load existing data
    q331_ids  = {q['id'] for q in json.loads(QUESTIONS_331.read_text())}
    nc150_ids = _load_nc150_ids()

    already_have = q331_ids | nc150_ids

    am600 = load_am600()
    to_scrape = [q for q in am600 if q['id'] not in already_have]
    print(f'AM600 total: {len(am600)}  |  in 331 or NC150: {len(am600)-len(to_scrape)}  |  to scrape: {len(to_scrape)}')

    # Load caches
    extra: list[dict] = json.loads(AM600_EXTRA_OUT.read_text()) if AM600_EXTRA_OUT.exists() else []
    extra_ids = {q['id'] for q in extra}

    sites: dict = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs: dict = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}

    remaining = [q for q in to_scrape if q['id'] not in extra_ids]
    if limit is not None:
        remaining = remaining[:limit]

    already = len(extra_ids & {q['id'] for q in to_scrape})
    print(f'Already scraped: {already}  |  remaining: {len(remaining)}')
    if not remaining:
        print('Nothing left to scrape.')
        return

    total = len(remaining)
    for idx, q in enumerate(remaining, 1):
        qid  = q['id']
        slug = q['slug']
        print(f'\n[{idx}/{total}]  #{qid}  {q["title"]}  ({q["difficulty"]})')

        # ── LeetCode GraphQL: description + tags + starter ──────────────────
        lc_data  = None
        desc_html = ''
        tags      = []
        starter_py = ''
        starter_cpp = ''

        lc_data = fetch_lc(slug)
        if lc_data:
            raw_content = lc_data.get('content') or ''
            desc_html   = raw_content
            tags        = [t['name'] for t in lc_data.get('topicTags') or []]
            snippets    = lc_data.get('codeSnippets') or []
            starter_py  = extract_starter(snippets, 'python3', 'python')
            starter_cpp = extract_starter(snippets, 'cpp')
            print(f'    LC: {len(tags)} tags, desc={len(desc_html)}ch, starter_py={bool(starter_py)}')
        else:
            print('    LC: no data (premium or rate-limited)')
        time.sleep(0.8)

        # ── WalkCC ──────────────────────────────────────────────────────────
        wcc_blocks = fetch_walkccc(qid)
        sites.setdefault(slug, {})['walkccc'] = wcc_blocks
        py_wcc = [b for b in wcc_blocks if b['lang'] == 'python']
        print(f'    WalkCC: {len(wcc_blocks)} blocks ({len(py_wcc)} python)')
        time.sleep(0.8)

        # ── SimplyLeet ──────────────────────────────────────────────────────
        sl_blocks = fetch_simplyleet(slug)
        sites[slug]['simplyleet'] = sl_blocks
        print(f'    SimplyLeet: {len(sl_blocks)} blocks')
        time.sleep(0.8)

        # ── LeetDoocs ───────────────────────────────────────────────────────
        doocs_data = fetch_doocs(qid)
        if doocs_data:
            doocs[str(qid)] = {
                'desc_html': doocs_data.get('desc_html', desc_html),
                'blocks':    doocs_data.get('blocks', []),
            }
            sites[slug]['doocs'] = doocs_data.get('blocks', [])
            # Use doocs desc_html if LC failed
            if not desc_html and doocs_data.get('desc_html'):
                desc_html = doocs_data['desc_html']
            py_doocs = [b for b in doocs_data.get('blocks', []) if b['lang'] == 'python']
            print(f'    Doocs: {len(doocs_data.get("blocks", []))} blocks ({len(py_doocs)} python)')
        else:
            # Still store LC desc_html in doocs cache so PDF can render it
            if desc_html:
                doocs[str(qid)] = {'desc_html': desc_html, 'blocks': []}
            sites[slug]['doocs'] = []
            print('    Doocs: no data')
        time.sleep(0.8)

        # ── LC.ca ────────────────────────────────────────────────────────────
        lca_blocks = fetch_leetcodeca(qid, slug)
        sites[slug]['leetcodeca'] = lca_blocks
        print(f'    LC.ca: {len(lca_blocks)} blocks')
        time.sleep(0.6)

        # ── Best Python fallback ─────────────────────────────────────────────
        py_fallback = ''
        for site_key in ('doocs', 'walkccc', 'simplyleet', 'leetcodeca'):
            for b in sites[slug].get(site_key, []):
                if b.get('lang') == 'python' and len(b['code']) > 20:
                    py_fallback = b['code']
                    break
            if py_fallback:
                break

        # ── Assemble question record ─────────────────────────────────────────
        record: dict = {
            'id':             qid,
            'title':          q['title'],
            'slug':           slug,
            'difficulty':     q['difficulty'],
            'description':    desc_html,
            'tags':           tags,
            'url':            f'https://leetcode.com/problems/{slug}/',
            'doocs_url':      f'https://leetcode.doocs.org/en/lc/{qid}/',
            'source':         ['AlgoMaster 600'],
            'python_solution': py_fallback,
            'cpp_solution':   '',
            'explanation':    '',
            'solution_url':   f'https://www.simplyleet.com/{slug}',
            'starter_python': starter_py,
            'starter_cpp':    starter_cpp,
        }
        extra.append(record)
        extra_ids.add(qid)

        # ── Save after every question (resumable) ────────────────────────────
        AM600_EXTRA_OUT.write_text(json.dumps(extra, ensure_ascii=False, indent=2))
        SITES_CACHE.write_text(json.dumps(sites, ensure_ascii=False, indent=2))
        DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))

    print(f'\n✓  Scraped {len(extra)} / {len(to_scrape)} AM600-extra questions')
    print(f'   {AM600_EXTRA_OUT}')
    print(f'   Sites cache: {len(sites)} slugs')
    print(f'   Doocs cache: {len(doocs)} IDs')


if __name__ == '__main__':
    main()

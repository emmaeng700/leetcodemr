"""
scrape_neetcode_extra.py
────────────────────────
Scrapes the NeetCode-150 questions that are NOT already in:
  • questions_full.json  (the 331 set)

Saves to:
  • neetcode_extra_questions.json  — same schema as questions_full.json
  • .full_langs_cache.json         — updated with walkccc / doocs / simplyleet / leetcodeca
  • .doocs_cache.json              — updated with desc_html + code blocks

Resumable: already-cached questions are skipped on re-runs.
Run:  python3 scrape_neetcode_extra.py
      python3 scrape_neetcode_extra.py --limit 5
"""

import json, re, sys, time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ─── Paths ────────────────────────────────────────────────────────────────────
HERE              = Path(__file__).parent
QUESTIONS_331     = HERE / 'public' / 'questions_full.json'
NEETCODE_EXTRA_OUT= HERE / 'neetcode_extra_questions.json'
SITES_CACHE       = HERE / '.full_langs_cache.json'
DOOCS_CACHE       = HERE / '.doocs_cache.json'

# ─── Parse NeetCode 150 from TypeScript ──────────────────────────────────────
def load_nc150() -> list[dict]:
    ts = (HERE / 'src' / 'lib' / 'neetcode150.ts').read_text()
    entries = re.findall(
        r"\{ id: (\d+),\s+title: '([^']+)', slug: '([^']+)', difficulty: '(Easy|Medium|Hard)', acceptance: ([\d.]+) \}",
        ts,
    )
    return [{'id': int(i), 'title': t, 'slug': s, 'difficulty': d, 'acceptance': float(a)}
            for i, t, s, d, a in entries]


# ─── HTTP helpers (same as am600 scraper) ─────────────────────────────────────
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

def get(url: str, *, timeout=15, retries=3, delay=1.5):
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
                return r
        except Exception as e:
            print(f'    GET error ({url}): {e}')
            time.sleep(delay * (attempt + 1))
    return None

def post_json(url: str, payload: dict, *, timeout=15):
    try:
        r = requests.post(url, json=payload, headers={**HEADERS,
            'Content-Type': 'application/json', 'Referer': 'https://leetcode.com/'
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
    questionFrontendId title difficulty content
    topicTags { name }
    codeSnippets { langSlug code }
  }
}
"""

def fetch_lc(slug: str):
    data = post_json(LC_GQL, {'query': GQL_QUERY, 'variables': {'titleSlug': slug}})
    if data:
        return (data.get('data') or {}).get('question')
    return None

def extract_starter(snippets, *lang_slugs) -> str:
    for ls in lang_slugs:
        for s in (snippets or []):
            if s.get('langSlug', '').lower() == ls:
                return s.get('code', '')
    return ''


# ─── Solution scrapers ────────────────────────────────────────────────────────
def extract_code_blocks(soup, *, lang_hint='') -> list[dict]:
    blocks, seen = [], set()
    for el in soup.find_all('code') + soup.find_all('pre'):
        clean = el.get_text().strip()
        if len(clean) < 20 or clean in seen:
            continue
        seen.add(clean)
        cls = ' '.join(el.get('class', []))
        if 'python' in cls.lower() or (clean.startswith('class Solution') and 'def ' in clean):
            lang = 'python'
        elif 'cpp' in cls.lower() or '#include' in clean or 'vector<' in clean:
            lang = 'cpp'
        elif 'java' in cls.lower() and 'public' in clean:
            lang = 'java'
        else:
            lang = lang_hint or ('python' if ('def ' in clean and ':' in clean) else 'cpp')
        blocks.append({'code': clean, 'lang': lang})
    return blocks

def fetch_walkccc(qid: int) -> list[dict]:
    r = get(f'https://walkccc.me/LeetCode/problems/{qid}/')
    if not r or r.status_code != 200:
        return []
    soup = BeautifulSoup(r.text, 'html.parser')
    blocks, seen = [], set()
    for pre in soup.select('div.highlight pre, pre > code, .tabbed-content pre'):
        text = pre.get_text().strip()
        if len(text) < 20 or text in seen:
            continue
        seen.add(text)
        parent_cls = ' '.join(pre.parent.get('class', []))
        if 'python' in parent_cls.lower() or ('def ' in text and ':' in text):
            lang = 'python'
        elif 'cpp' in parent_cls.lower() or '#include' in text:
            lang = 'cpp'
        else:
            lang = 'python' if ('def ' in text and ':' in text) else 'unknown'
        blocks.append({'code': text, 'lang': lang})
    return blocks

def fetch_simplyleet(slug: str) -> list[dict]:
    r = get(f'https://www.simplyleet.com/{slug}')
    if not r or r.status_code != 200:
        return []
    return extract_code_blocks(BeautifulSoup(r.text, 'html.parser'), lang_hint='python')

def fetch_doocs(qid: int) -> dict:
    r = get(f'https://leetcode.doocs.org/en/lc/{qid}/')
    if not r or r.status_code != 200:
        return {}
    soup = BeautifulSoup(r.text, 'html.parser')
    desc_el = (soup.find(class_='question-content') or soup.find(id='question-content')
               or soup.find('article'))
    desc_html = str(desc_el) if desc_el else ''
    blocks, seen = [], set()
    for pre in soup.select('pre > code, .highlight pre'):
        text = pre.get_text().strip()
        if len(text) < 15 or text in seen:
            continue
        seen.add(text)
        cls = ' '.join(pre.get('class', []) + pre.parent.get('class', []))
        if 'python' in cls.lower() or ('def ' in text and 'class Solution' in text):
            lang = 'python'
        elif 'cpp' in cls.lower() or '#include' in text:
            lang = 'cpp'
        else:
            lang = 'python' if ('def ' in text and 'return' in text) else 'unknown'
        blocks.append({'code': text, 'lang': lang})
    return {'desc_html': desc_html, 'blocks': blocks}

def fetch_leetcodeca(qid: int, slug: str) -> list[dict]:
    for url in [f'https://leetcode.ca/all/{qid}-{slug}.html', f'https://leetcode.ca/{qid}/']:
        r = get(url)
        if r and r.status_code == 200:
            return extract_code_blocks(BeautifulSoup(r.text, 'html.parser'), lang_hint='python')
    return []


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    limit = None
    for i, a in enumerate(args):
        if a == '--limit' and i + 1 < len(args):
            limit = int(args[i + 1])

    # Only skip questions already in the 331 set; scrape everything else independently
    q331_ids  = {q['id'] for q in json.loads(QUESTIONS_331.read_text())}

    nc150      = load_nc150()
    to_scrape  = [q for q in nc150 if q['id'] not in q331_ids]
    print(f'NeetCode 150 total: {len(nc150)}  |  in 331: {len(nc150)-len(to_scrape)}  |  not in 331: {len(to_scrape)}')

    # Load outputs
    out: list[dict] = json.loads(NEETCODE_EXTRA_OUT.read_text()) if NEETCODE_EXTRA_OUT.exists() else []
    done_ids  = {q['id'] for q in out}
    sites     = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs     = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}

    remaining = [q for q in to_scrape if q['id'] not in done_ids]
    if limit is not None:
        remaining = remaining[:limit]

    already = len(done_ids & {q['id'] for q in to_scrape})
    print(f'Already scraped: {already}  |  remaining: {len(remaining)}')
    if not remaining:
        print('Nothing left to scrape.')
        return

    total = len(remaining)
    for idx, q in enumerate(remaining, 1):
        qid, slug = q['id'], q['slug']
        print(f'\n[{idx}/{total}]  #{qid}  {q["title"]}  ({q["difficulty"]})')

        # LeetCode GraphQL
        lc_data = fetch_lc(slug)
        desc_html = starter_py = starter_cpp = ''
        tags = []
        if lc_data:
            desc_html   = lc_data.get('content') or ''
            tags        = [t['name'] for t in lc_data.get('topicTags') or []]
            snippets    = lc_data.get('codeSnippets') or []
            starter_py  = extract_starter(snippets, 'python3', 'python')
            starter_cpp = extract_starter(snippets, 'cpp')
            print(f'    LC: {len(tags)} tags, desc={len(desc_html)}ch')
        else:
            print('    LC: no data (premium or rate-limited)')
        time.sleep(0.8)

        # WalkCC
        wcc = fetch_walkccc(qid)
        sites.setdefault(slug, {})['walkccc'] = wcc
        print(f'    WalkCC: {len(wcc)} blocks ({len([b for b in wcc if b["lang"]=="python"])} py)')
        time.sleep(0.8)

        # SimplyLeet
        sl = fetch_simplyleet(slug)
        sites[slug]['simplyleet'] = sl
        print(f'    SimplyLeet: {len(sl)} blocks')
        time.sleep(0.8)

        # LeetDoocs
        dd = fetch_doocs(qid)
        if dd:
            doocs[str(qid)] = {'desc_html': dd.get('desc_html', desc_html), 'blocks': dd.get('blocks', [])}
            sites[slug]['doocs'] = dd.get('blocks', [])
            if not desc_html and dd.get('desc_html'):
                desc_html = dd['desc_html']
            print(f'    Doocs: {len(dd.get("blocks",[]))} blocks ({len([b for b in dd.get("blocks",[]) if b["lang"]=="python"])} py)')
        else:
            if desc_html:
                doocs[str(qid)] = {'desc_html': desc_html, 'blocks': []}
            sites[slug]['doocs'] = []
            print('    Doocs: no data')
        time.sleep(0.8)

        # LC.ca
        lca = fetch_leetcodeca(qid, slug)
        sites[slug]['leetcodeca'] = lca
        print(f'    LC.ca: {len(lca)} blocks')
        time.sleep(0.6)

        # Best Python fallback
        py_fallback = ''
        for sk in ('doocs', 'walkccc', 'simplyleet', 'leetcodeca'):
            for b in sites[slug].get(sk, []):
                if b.get('lang') == 'python' and len(b['code']) > 20:
                    py_fallback = b['code']
                    break
            if py_fallback:
                break

        record = {
            'id':             qid,
            'title':          q['title'],
            'slug':           slug,
            'difficulty':     q['difficulty'],
            'description':    desc_html,
            'tags':           tags,
            'url':            f'https://leetcode.com/problems/{slug}/',
            'doocs_url':      f'https://leetcode.doocs.org/en/lc/{qid}/',
            'source':         ['NeetCode 150'],
            'python_solution': py_fallback,
            'cpp_solution':   '',
            'explanation':    '',
            'solution_url':   f'https://www.simplyleet.com/{slug}',
            'starter_python': starter_py,
            'starter_cpp':    starter_cpp,
        }
        out.append(record)
        done_ids.add(qid)

        NEETCODE_EXTRA_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        SITES_CACHE.write_text(json.dumps(sites, ensure_ascii=False, indent=2))
        DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))

    print(f'\n✓  Scraped {len(out)} / {len(to_scrape)} NeetCode-extra questions')
    print(f'   {NEETCODE_EXTRA_OUT}')


if __name__ == '__main__':
    main()

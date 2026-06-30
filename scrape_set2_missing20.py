"""
scrape_set2_missing20.py
─────────────────────────
Scrapes the 20 Set 2 (NeetCode 250) questions that have starter code
(grind_missing_starters.json) but no saved LeetCode problem description
anywhere in the repo. Same schema/pipeline as scrape_am600_extra.py.

Output: set2_missing_extra.json  (same schema as questions_full.json)
Resumable: already-scraped questions are skipped on re-runs.
Run:  python3 scrape_set2_missing20.py
"""

import json, time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

HERE     = Path(__file__).parent
OUT_FILE = HERE / 'set2_missing_extra.json'

QUESTIONS = [
    {'id': 52,   'title': 'N-Queens II',                              'slug': 'n-queens-ii',                              'difficulty': 'Hard'},
    {'id': 473,  'title': 'Matchsticks to Square',                    'slug': 'matchsticks-to-square',                    'difficulty': 'Medium'},
    {'id': 649,  'title': 'Dota2 Senate',                             'slug': 'dota2-senate',                             'difficulty': 'Medium'},
    {'id': 705,  'title': 'Design HashSet',                           'slug': 'design-hashset',                           'difficulty': 'Easy'},
    {'id': 860,  'title': 'Lemonade Change',                          'slug': 'lemonade-change',                          'difficulty': 'Easy'},
    {'id': 877,  'title': 'Stone Game',                                'slug': 'stone-game',                               'difficulty': 'Medium'},
    {'id': 881,  'title': 'Boats to Save People',                     'slug': 'boats-to-save-people',                     'difficulty': 'Medium'},
    {'id': 913,  'title': 'Stone Game III',                            'slug': 'stone-game-iii',                           'difficulty': 'Hard'},
    {'id': 953,  'title': 'Verifying an Alien Dictionary',            'slug': 'verifying-an-alien-dictionary',            'difficulty': 'Easy'},
    {'id': 997,  'title': 'Find the Town Judge',                      'slug': 'find-the-town-judge',                      'difficulty': 'Easy'},
    {'id': 1137, 'title': 'N-th Tribonacci Number',                   'slug': 'n-th-tribonacci-number',                   'difficulty': 'Easy'},
    {'id': 1140, 'title': 'Stone Game II',                             'slug': 'stone-game-ii',                            'difficulty': 'Medium'},
    {'id': 1325, 'title': 'Delete Leaves With a Given Value',         'slug': 'delete-leaves-with-a-given-value',         'difficulty': 'Medium'},
    {'id': 1863, 'title': 'Sum of All Subset XOR Totals',             'slug': 'sum-of-all-subset-xor-totals',             'difficulty': 'Easy'},
    {'id': 1929, 'title': 'Concatenation of Array',                   'slug': 'concatenation-of-array',                   'difficulty': 'Easy'},
    {'id': 2392, 'title': 'Build a Matrix With Conditions',           'slug': 'build-a-matrix-with-conditions',           'difficulty': 'Hard'},
    {'id': 2707, 'title': 'Extra Characters in a String',             'slug': 'extra-characters-in-a-string',             'difficulty': 'Medium'},
    {'id': 2709, 'title': 'Greatest Common Divisor Traversal',        'slug': 'greatest-common-divisor-traversal',        'difficulty': 'Hard'},
    {'id': 2807, 'title': 'Insert Greatest Common Divisors in Linked List', 'slug': 'insert-greatest-common-divisors-in-linked-list', 'difficulty': 'Medium'},
    {'id': 3133, 'title': 'Minimum Array End',                        'slug': 'minimum-array-end',                        'difficulty': 'Medium'},
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/124.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

def get(url, *, timeout=15, retries=3, delay=1.5):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f'    429 rate-limited - sleeping {wait}s')
                time.sleep(wait)
            else:
                return r
        except Exception as e:
            print(f'    GET error ({url}): {e}')
            time.sleep(delay * (attempt + 1))
    return None

def post_json(url, payload, *, timeout=15):
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

def fetch_lc(slug):
    data = post_json(LC_GQL, {'query': GQL_QUERY, 'variables': {'titleSlug': slug}})
    if data:
        return (data.get('data') or {}).get('question')
    return None

def extract_starter(snippets, *lang_slugs):
    for ls in lang_slugs:
        for s in (snippets or []):
            if s.get('langSlug', '').lower() == ls:
                return s.get('code', '')
    return ''

def fetch_doocs(qid):
    r = get(f'https://leetcode.doocs.org/en/lc/{qid}/')
    if not r or r.status_code != 200:
        return ''
    soup = BeautifulSoup(r.text, 'html.parser')
    desc_el = (soup.find(class_='question-content')
               or soup.find(id='question-content')
               or soup.find('article'))
    return str(desc_el) if desc_el else ''

def main():
    existing = json.loads(OUT_FILE.read_text()) if OUT_FILE.exists() else []
    existing_ids = {q['id'] for q in existing}

    remaining = [q for q in QUESTIONS if q['id'] not in existing_ids]
    print(f'Total: {len(QUESTIONS)}  |  already scraped: {len(existing_ids)}  |  remaining: {len(remaining)}')
    if not remaining:
        print('Nothing left to scrape.')
        return

    for idx, q in enumerate(remaining, 1):
        qid, slug = q['id'], q['slug']
        print(f'\n[{idx}/{len(remaining)}]  #{qid}  {q["title"]}  ({q["difficulty"]})')

        desc_html, tags, starter_py, starter_cpp = '', [], '', ''
        lc_data = fetch_lc(slug)
        if lc_data:
            desc_html = lc_data.get('content') or ''
            tags = [t['name'] for t in lc_data.get('topicTags') or []]
            snippets = lc_data.get('codeSnippets') or []
            starter_py = extract_starter(snippets, 'python3', 'python')
            starter_cpp = extract_starter(snippets, 'cpp')
            print(f'    LC: {len(tags)} tags, desc={len(desc_html)}ch, starter_py={bool(starter_py)}')
        else:
            print('    LC: no data, trying doocs fallback')
        time.sleep(0.8)

        if not desc_html:
            desc_html = fetch_doocs(qid)
            print(f'    Doocs fallback: desc={len(desc_html)}ch')
            time.sleep(0.8)

        record = {
            'id': qid,
            'title': q['title'],
            'slug': slug,
            'difficulty': q['difficulty'],
            'description': desc_html,
            'tags': tags,
            'url': f'https://leetcode.com/problems/{slug}/',
            'doocs_url': f'https://leetcode.doocs.org/en/lc/{qid}/',
            'source': ['NeetCode 250'],
            'python_solution': '',
            'cpp_solution': '',
            'explanation': '',
            'solution_url': f'https://www.simplyleet.com/{slug}',
            'starter_python': starter_py,
            'starter_cpp': starter_cpp,
        }
        existing.append(record)
        existing_ids.add(qid)
        OUT_FILE.write_text(json.dumps(existing, ensure_ascii=False, indent=2))

    print(f'\n✓  Scraped {len(existing)} / {len(QUESTIONS)} -> {OUT_FILE}')
    no_desc = [q['id'] for q in existing if not q.get('description')]
    if no_desc:
        print(f'   Still missing description: {no_desc}')

if __name__ == '__main__':
    main()

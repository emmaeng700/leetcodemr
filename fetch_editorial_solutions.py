#!/usr/bin/env python3
"""
fetch_editorial_solutions.py
Fetch LeetCode official editorial Python solutions for all questions in grind_questions.json.

Usage:
    python3 fetch_editorial_solutions.py --session "LEETCODE_SESSION=xxx; csrftoken=yyy"

Get the cookie string from browser DevTools → Application → Cookies → leetcode.com.
Copy the full Cookie header value (you need LEETCODE_SESSION and csrftoken at minimum).

Output: .editorial_cache.json  {qid_str → {'approaches': [{'title': str, 'code': str}]}}
"""
import json, re, time, sys, argparse
from pathlib import Path
import urllib.request, urllib.error

SCRIPT_DIR  = Path(__file__).parent
GRIND_JSON  = SCRIPT_DIR / 'public' / 'grind_questions.json'
CACHE_FILE  = SCRIPT_DIR / '.editorial_cache.json'
GRAPHQL_URL = 'https://leetcode.com/graphql/'

QUERY_SOLUTION = '''
query officialSolution($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    solution {
      content
    }
  }
}
'''

QUERY_UGC = '''
query ugcSolution($questionSlug: String!) {
  ugcArticleOfficialSolutionArticle(questionSlug: $questionSlug) {
    content
  }
}
'''


# ── Markdown parsing ───────────────────────────────────────────────────────────

def _first_python(text: str) -> str:
    for lang in ('python3', 'python'):
        m = re.search(rf'```{lang}\s*\n(.*?)```', text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ''


def parse_approaches(content: str) -> list:
    """Return [{'title': str, 'code': str}, ...] for each approach that has Python code."""
    content = content or ''
    # Some editorials use HTML; strip obvious tags for regex matching.
    content = re.sub(r'<[^>]+>', ' ', content)

    # Split on "## Approach N …" or "### Approach …" headers.
    parts = re.split(r'(?m)^#{1,4}\s*(Approach\s+[^\n]+)', content)

    approaches = []
    if len(parts) <= 1:
        # No approach headers — treat the whole thing as one solution.
        code = _first_python(content)
        if code:
            approaches.append({'title': 'Solution', 'code': code})
    else:
        # parts = [preamble, title1, body1, title2, body2, ...]
        for i in range(1, len(parts), 2):
            title = parts[i].strip(' :*#')
            body  = parts[i + 1] if i + 1 < len(parts) else ''
            code  = _first_python(body)
            if code:
                approaches.append({'title': title, 'code': code})
        # If no approach had Python, try the whole content.
        if not approaches:
            code = _first_python(content)
            if code:
                approaches.append({'title': 'Solution', 'code': code})

    return approaches


# ── GraphQL fetch ──────────────────────────────────────────────────────────────

def _extract_csrftoken(cookie: str) -> str:
    """Pull csrftoken value out of a cookie string."""
    m = re.search(r'csrftoken=([^;]+)', cookie)
    return m.group(1).strip() if m else ''


def _post(slug: str, cookie: str, query: str, variables: dict) -> dict:
    """POST one GraphQL query; return the parsed JSON or {}."""
    csrf = _extract_csrftoken(cookie)
    payload = json.dumps({'query': query, 'variables': variables}).encode()
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=payload,
        headers={
            'Content-Type':   'application/json',
            'Referer':        f'https://leetcode.com/problems/{slug}/solution/',
            'Origin':         'https://leetcode.com',
            'User-Agent':     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Cookie':         cookie,
            'x-csrftoken':    csrf,
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f'    HTTP {e.code}')
    except Exception as e:
        print(f'    Error: {e}')
    return {}


def fetch_editorial(slug: str, cookie: str) -> list:
    """Return approaches list (may be empty if no editorial / no Python code)."""
    content = ''

    # Try the legacy question.solution field first.
    data = _post(slug, cookie, QUERY_SOLUTION, {'titleSlug': slug})
    question = (data.get('data') or {}).get('question') or {}
    solution = question.get('solution') or {}
    content = solution.get('content', '') if isinstance(solution, dict) else ''

    # Fall back to the newer ugcArticle endpoint if legacy returned nothing.
    if not content:
        data2 = _post(slug, cookie, QUERY_UGC, {'questionSlug': slug})
        ugc = (data2.get('data') or {}).get('ugcArticleOfficialSolutionArticle') or {}
        content = ugc.get('content', '') if isinstance(ugc, dict) else ''

    return parse_approaches(content)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--session', required=True,
                    help='Full Cookie header string from browser DevTools '
                         '(e.g. "LEETCODE_SESSION=xxx; csrftoken=yyy")')
    ap.add_argument('--force', action='store_true',
                    help='Re-fetch even if already cached')
    ap.add_argument('--limit', type=int, default=0,
                    help='Stop after N questions (0 = all, for testing)')
    args = ap.parse_args()

    if not GRIND_JSON.exists():
        raise SystemExit(f'✗ Not found: {GRIND_JSON}')

    questions = json.loads(GRIND_JSON.read_text())
    cache: dict = {}
    if CACHE_FILE.exists() and not args.force:
        cache = json.loads(CACHE_FILE.read_text())

    total  = len(questions)
    done   = 0
    hits   = 0
    misses = 0

    for i, q in enumerate(questions):
        qid  = str(q['id'])
        slug = q.get('slug', '')
        if not slug:
            continue
        if qid in cache and not args.force:
            done += 1
            continue
        if args.limit and done >= args.limit:
            break

        approaches = fetch_editorial(slug, args.session)
        cache[qid] = {'approaches': approaches}

        if approaches:
            hits += 1
            titles = ', '.join(a['title'][:30] for a in approaches)
            print(f'  [{i+1}/{total}] #{qid} {q["title"][:35]:<35} '
                  f'→ {len(approaches)} approach(es): {titles}')
        else:
            misses += 1
            print(f'  [{i+1}/{total}] #{qid} {q["title"][:35]:<35} → no editorial')

        done += 1
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
        time.sleep(0.4)   # polite delay

    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    print(f'\nDone  ·  {hits} with Python editorial  ·  {misses} without  '
          f'·  {len(cache)} total in cache\n→ {CACHE_FILE}')


if __name__ == '__main__':
    main()

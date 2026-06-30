#!/usr/bin/env python3
"""
Fetch LeetCode starters for Grind questions missing bundled starter_python,
build _check examples, and write grind_missing_starters.json.

Run:  python3 scripts/scrape_grind_missing_starters.py
      python3 scripts/scrape_grind_missing_starters.py --dry-run
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
GRIND_QUESTIONS = ROOT / 'public' / 'grind_questions.json'
OUT_PATH = ROOT / 'grind_missing_starters.json'
PLAYBOOK_PATH = ROOT / 'public' / 'playbook_data_all.json'
AM600_EXTRA = ROOT / 'am600_extra_questions.json'
DOOCS_CACHE = ROOT / '.doocs_cache.json'

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    ),
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com/',
}

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

INTERVIEW_MARKER = '# -- Interview Approach - STAR-LC --'


def load_fix_starters():
    path = ROOT / 'scripts' / 'fix_starters.py'
    spec = importlib.util.spec_from_file_location('fix_starters', path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def html_to_description(html: str) -> str:
    if not html:
        return ''
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all(['nav', 'aside', 'script', 'style']):
        tag.decompose()
    for sup in soup.find_all('sup'):
        sup.replace_with(f'^{sup.get_text()}')
    for sub in soup.find_all('sub'):
        sub.replace_with(f'_{sub.get_text()}')
    for pre in soup.find_all('pre'):
        pre.replace_with('\n' + pre.get_text() + '\n')
    for br in soup.find_all('br'):
        br.replace_with('\n')
    for block in soup.find_all(['p', 'li', 'div', 'h1', 'h2', 'h3', 'ul', 'ol']):
        block.append('\n')
    text = soup.get_text(separator=' ')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def snippet_for(snippets: list[dict] | None, *langs: str) -> str:
    for lang in langs:
        for s in snippets or []:
            if s.get('langSlug', '').lower() == lang.lower():
                return (s.get('code') or '').replace('\t', '    ').strip()
    return ''


def stubify_python(code: str) -> str:
    """Turn a full solution into a write-from-memory starter (signatures + pass)."""
    lines = code.replace('\t', '    ').splitlines()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if re.match(r'^\s*def\s+\w+', line) and line.rstrip().endswith(':'):
            out.append(line)
            indent = ' ' * (len(line) - len(line.lstrip()) + 4)
            out.append(f'{indent}# Write your solution here')
            out.append(f'{indent}pass')
            continue
        if stripped.startswith('class ') or stripped.startswith('@'):
            out.append(line)
            continue
        if stripped.startswith('"""') or stripped.startswith("'''"):
            continue
        if stripped.startswith('from ') or stripped.startswith('import '):
            if stripped not in {l.strip() for l in out}:
                out.insert(0, line)
            continue
    body = '\n'.join(out).strip() + '\n'
    if 'from typing import' not in body:
        body = 'from typing import List, Optional\n\n' + body
    return body


def pick_python_starter(blocks: list[dict]) -> str:
    for b in blocks or []:
        code = (b.get('code') or '').strip()
        if len(code) < 20:
            continue
        if 'class ' in code and 'def ' in code:
            return stubify_python(code)
    return ''


def load_am600_by_id() -> dict[int, dict]:
    if not AM600_EXTRA.exists():
        return {}
    return {q['id']: q for q in json.loads(AM600_EXTRA.read_text(encoding='utf-8'))}


def load_doocs_blocks(qid: int) -> list[dict]:
    if not DOOCS_CACHE.exists():
        return []
    entry = json.loads(DOOCS_CACHE.read_text(encoding='utf-8')).get(str(qid), {})
    return entry.get('blocks') or []


def ensure_python_passes(code: str) -> str:
    lines = code.splitlines()
    out: list[str] = []
    for i, line in enumerate(lines):
        out.append(line)
        if re.match(r'^\s+def\s+\w+', line) and line.rstrip().endswith(':'):
            nxt = lines[i + 1] if i + 1 < len(lines) else ''
            if not nxt.strip() or not re.match(r'^\s{4,}\S', nxt):
                indent = ' ' * (len(line) - len(line.lstrip()) + 4)
                out.append(f'{indent}# Write your solution here')
                out.append(f'{indent}pass')
    body = '\n'.join(out).strip() + '\n'
    if 'from typing import' not in body:
        body = 'from typing import List, Optional\n\n' + body
    return body


def append_interview(starter: str, script: str | None) -> str:
    if not script or not script.strip():
        return starter
    if INTERVIEW_MARKER in starter or '# PHASE 1' in starter:
        return starter
    base = starter.rstrip()
    last_check = -1
    for i, line in enumerate(base.splitlines()):
        if line.strip().startswith('_check('):
            last_check = i
    if last_check >= 0:
        base = '\n'.join(base.splitlines()[: last_check + 1])
    return f'{base}\n\n\n\n{INTERVIEW_MARKER}\n{script.strip()}\n'


def fetch_lc(slug: str) -> dict | None:
    try:
        r = requests.post(
            LC_GQL,
            json={'query': GQL_QUERY, 'variables': {'titleSlug': slug}},
            headers=HEADERS,
            timeout=20,
        )
        if r.status_code != 200:
            return None
        return (r.json().get('data') or {}).get('question')
    except Exception as exc:
        print(f'    fetch error: {exc}')
        return None


def build_starter(q: dict, fix_mod, playbook: dict[str, dict], am600: dict[int, dict]) -> dict:
    slug = q['slug']
    qid = q['id']
    print(f'  #{qid} {slug}')

    lc = fetch_lc(slug)
    time.sleep(0.9)

    snippets = (lc or {}).get('codeSnippets') or []
    starter_py = snippet_for(snippets, 'python3', 'python')
    starter_cpp = snippet_for(snippets, 'cpp', 'c++')

    desc = html_to_description((lc or {}).get('content') or '')
    if not desc and qid in am600:
        desc = html_to_description(am600[qid].get('description') or '')

    source = 'leetcode'
    if not starter_py:
        starter_py = pick_python_starter(load_doocs_blocks(qid))
        if starter_py:
            source = 'doocs'
            print('    python: doocs stub')

    if starter_py:
        starter_py = ensure_python_passes(starter_py)
        record = {
            'id': qid,
            'title': q['title'],
            'slug': slug,
            'description': desc,
            'starter_python': starter_py,
        }
        fixed, changes = fix_mod.fix_question(record)
        starter_py = fixed.get('starter_python') or starter_py
        if source == 'leetcode':
            print(f'    python: {len(starter_py)} chars ({", ".join(changes) or "ok"})')
    else:
        starter_py = (
            'from typing import List, Optional\n\n'
            'class Solution:\n'
            '    def solve(self):\n'
            '        # Write your solution here\n'
            '        pass\n\n'
            f'{fix_mod.CHECK_HELPER}\n'
            'sol = Solution()\n'
            f'# TODO: add _check examples for {q["title"]}\n'
        )
        print('    python: generic fallback')

    script = (playbook.get(str(qid)) or {}).get('script')
    starter_py = append_interview(starter_py, script)

    if not starter_cpp:
        starter_cpp = (
            'class Solution {\n'
            'public:\n'
            '    void solve() {\n'
            '        // Write your solution here\n'
            '    }\n'
            '};\n'
        )

    return {
        'id': qid,
        'slug': slug,
        'title': q['title'],
        'set': q.get('set'),
        'source': source,
        'starter_python': starter_py,
        'starter_cpp': starter_cpp,
    }


def missing_questions(grind: list[dict]) -> list[dict]:
    return [q for q in grind if not q.get('starterPython')]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='Re-scrape all rows in grind_missing_starters.json')
    args = parser.parse_args()

    grind = json.loads(GRIND_QUESTIONS.read_text(encoding='utf-8'))
    missing = missing_questions(grind)
    print(f'Missing starterPython in grind bundle: {len(missing)} / {len(grind)}')

    if args.dry_run:
        for q in missing:
            print(f'  #{q["id"]} set {q["set"]} {q["slug"]}')
        return 0

    fix_mod = load_fix_starters()
    playbook = json.loads(PLAYBOOK_PATH.read_text(encoding='utf-8'))
    am600 = load_am600_by_id()

    existing: dict[int, dict] = {}
    if OUT_PATH.exists() and not args.force:
        for row in json.loads(OUT_PATH.read_text(encoding='utf-8')):
            existing[row['id']] = row

    targets = missing if not args.force else [
        q for q in grind if q['id'] in existing or not q.get('starterPython')
    ]

    # Always refresh the 34 known-missing ids
    missing_ids = {q['id'] for q in missing}
    scrape_list = [q for q in grind if q['id'] in missing_ids]

    for q in scrape_list:
        row = build_starter(q, fix_mod, playbook, am600)
        if row.get('starter_python'):
            existing[q['id']] = row

    out = [existing[k] for k in sorted(existing)]
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

    ok = sum(1 for r in out if r.get('starter_python'))
    print(f'\nWrote {OUT_PATH} ({len(out)} rows, {ok} with starter_python)')
    return 0


if __name__ == '__main__':
    sys.exit(main())

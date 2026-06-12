"""
generate_neetcode_pdf.py
─────────────────────────
Generates a NeetCode-150 study PDF in the same 2×1 landscape format as
generate_better_pdf.py.  Uses all 150 questions (118 from questions_full.json,
32 from neetcode_extra_questions.json) organised by NC150 category.

Output: neetcode.pdf

Usage:
  python3 generate_neetcode_pdf.py
"""

import json, re, sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# ─── Import the shared rendering engine ──────────────────────────────────────
import generate_better_pdf as _base

_base.INNER_PDF      = SCRIPT_DIR / '_neetcode_inner.pdf'
_base.OUTPUT_PDF     = SCRIPT_DIR / 'neetcode.pdf'
_base._COVER_TITLE   = 'NeetCode 150'
_base._COVER_SUBTITLE = 'Priority-Grouped · Category-Ordered · 2×1 Landscape'

# ─── NeetCode 150 category → priority mapping ────────────────────────────────
NC150_PRIORITY = {
    # High ── core fundamentals
    'Arrays & Hashing':        'High',
    'Two Pointers':            'High',
    'Sliding Window':          'High',
    'Binary Search':           'High',
    'Intervals':               'High',
    'Trees':                   'High',
    'Graphs':                  'High',
    'Advanced Graphs':         'High',
    # Mid ── important patterns
    'Linked List':             'Mid',
    'Stack':                   'Mid',
    'Heap / Priority Queue':   'Mid',
    'Tries':                   'Mid',
    'Backtracking':            'Mid',
    'Greedy':                  'Mid',
    # Low ── advanced topics
    '1-D Dynamic Programming': 'Low',
    '2-D Dynamic Programming': 'Low',
    'Bit Manipulation':        'Low',
    'Math & Geometry':         'Low',
}

# Display order within each priority tier (same as file order)
NC150_ORDER = [
    'Arrays & Hashing', 'Two Pointers', 'Sliding Window', 'Binary Search',
    'Intervals', 'Trees', 'Graphs', 'Advanced Graphs',
    'Linked List', 'Stack', 'Heap / Priority Queue', 'Tries', 'Backtracking', 'Greedy',
    '1-D Dynamic Programming', '2-D Dynamic Programming', 'Bit Manipulation', 'Math & Geometry',
]


def load_nc150_category_map() -> dict[int, str]:
    """Returns {qid: category_name} for all 150 NC150 questions."""
    ts = (SCRIPT_DIR / 'src' / 'lib' / 'neetcode150.ts').read_text()
    cat_map: dict[int, str] = {}
    current_cat = ''
    for line in ts.splitlines():
        m_cat = re.search(r"name: '((?:[^'\\]|\\.)+)'", line)
        if m_cat and 'emoji' in line:
            current_cat = m_cat.group(1).replace("\\'", "'")
        m_id = re.search(r'\{ id: (\d+),', line)
        if m_id and current_cat:
            cat_map[int(m_id.group(1))] = current_cat
    return cat_map


def load_questions() -> tuple[list, dict, dict]:
    """
    Returns (questions, sites, doocs).
    Merges questions_full.json + neetcode_extra_questions.json, filtered to NC150.
    """
    nc150_ids = set(load_nc150_category_map().keys())

    base_qs  = json.loads((SCRIPT_DIR / 'public' / 'questions_full.json').read_text())
    extra_qs = json.loads((SCRIPT_DIR / 'neetcode_extra_questions.json').read_text()) \
               if (SCRIPT_DIR / 'neetcode_extra_questions.json').exists() else []

    by_id: dict[int, dict] = {}
    for q in base_qs:
        if q['id'] in nc150_ids:
            by_id[q['id']] = q
    for q in extra_qs:
        if q['id'] in nc150_ids and q['id'] not in by_id:
            by_id[q['id']] = q

    questions = list(by_id.values())

    sites = json.loads((SCRIPT_DIR / '.full_langs_cache.json').read_text()) \
            if (SCRIPT_DIR / '.full_langs_cache.json').exists() else {}
    doocs = json.loads((SCRIPT_DIR / '.doocs_cache.json').read_text()) \
            if (SCRIPT_DIR / '.doocs_cache.json').exists() else {}

    from generate_patterns_pdf import repair_doocs_cache
    n = repair_doocs_cache(doocs)
    if n:
        (SCRIPT_DIR / '.doocs_cache.json').write_text(json.dumps(doocs, ensure_ascii=False, indent=2))

    return questions, sites, doocs


def build_rounds(questions: list, cat_map: dict[int, str]) -> list:
    """Build 9-round structure using NC150 categories as patterns."""
    ROUNDS = [
        (1, 'High', 'Easy'), (2, 'High', 'Medium'), (3, 'High', 'Hard'),
        (4, 'Mid',  'Easy'), (5, 'Mid',  'Medium'),  (6, 'Mid',  'Hard'),
        (7, 'Low',  'Easy'), (8, 'Low',  'Medium'),  (9, 'Low',  'Hard'),
    ]
    result = []
    for round_num, priority, difficulty in ROUNDS:
        tier_cats = [c for c in NC150_ORDER if NC150_PRIORITY.get(c) == priority]
        pattern_groups = []
        for cat_name in tier_cats:
            qs = [q for q in questions
                  if cat_map.get(q['id']) == cat_name
                  and q.get('difficulty') == difficulty]
            qs.sort(key=lambda q: q['id'])
            if qs:
                pattern_groups.append(({'name': cat_name, 'tags': [], 'color': '#6B7280', 'hex': '#6B7280'}, qs))
        result.append((round_num, priority, difficulty, pattern_groups))
    return result


if __name__ == '__main__':
    print('Loading NeetCode 150 data…')
    cat_map = load_nc150_category_map()
    questions, sites, doocs = load_questions()
    print(f'  {len(questions)} / 150 questions loaded  ·  sites: {len(sites)}  ·  doocs: {len(doocs)}')

    print('Building rounds…')
    rounds = build_rounds(questions, cat_map)
    for rn, pri, diff, pgs in rounds:
        total = sum(len(qs) for _, qs in pgs)
        cats  = ', '.join(p['name'] for p, _ in pgs)
        print(f'  Round {rn}  {pri:4s} {diff:7s}  {total:3d} q  [{cats}]')

    print('\nBuilding inner mini-page PDF…')
    n_pages, round_page_registry, pat_page_registry = _base.build_inner_pdf(rounds, sites, doocs)

    print('Analysing inner PDF for link structure…')
    page_types, qid_first_page, toc_link_rects, toc_section_rects = (
        _base._analyze_inner_for_links(_base.INNER_PDF, rounds)
    )

    print('Imposing 2×1 landscape…')
    _base.impose_2x1_landscape(_base.INNER_PDF, _base.OUTPUT_PDF)

    print('Adding hyperlinks…')
    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    _base._add_links_2x1(
        _base.OUTPUT_PDF, page_types, qid_first_page, toc_link_rects, toc_section_rects,
        round_page_registry, pat_page_registry,
        qid_difficulty=qid_difficulty,
    )

    _base.INNER_PDF.unlink(missing_ok=True)
    kb = _base.OUTPUT_PDF.stat().st_size // 1024
    print(f'\nDone → {_base.OUTPUT_PDF}  ({kb:,} KB)  ·  {n_pages} mini-pages')

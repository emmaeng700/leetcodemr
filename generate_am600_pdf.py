"""
generate_am600_pdf.py
──────────────────────
Generates an AlgoMaster-600 study PDF in the same 2×1 landscape format as
generate_better_pdf.py.  Uses all 599 AM600 questions sourced from:
  • questions_full.json          (228 in both AM600 and the 331 set)
  • am600_extra_questions.json   (343 not in 331 or NC150)
  • neetcode_extra_questions.json (28 in NC150 but not 331, also in AM600)

Organised by AM600 category (56 categories grouped into High/Mid/Low priority).

Output: am600.pdf

Usage:
  python3 generate_am600_pdf.py
"""

import json, re, sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# ─── Import the shared rendering engine ──────────────────────────────────────
import generate_better_pdf as _base

_base.INNER_PDF      = SCRIPT_DIR / '_am600_inner.pdf'
_base.OUTPUT_PDF     = SCRIPT_DIR / 'am600.pdf'
_base._COVER_TITLE   = 'AlgoMaster 600'
_base._COVER_SUBTITLE = 'Priority-Grouped · Category-Ordered · 2×1 Landscape'

# ─── AM600 category → priority mapping ───────────────────────────────────────
AM600_PRIORITY = {
    # ── High ── core fundamentals, most frequently tested ──────────────────
    'Arrays':                              'High',
    'Strings':                             'High',
    'Hash Tables':                         'High',
    'Two Pointers':                        'High',
    'Sliding Window - Fixed Size':         'High',
    'Sliding Window - Dynamic Size':       'High',
    'Binary Search':                       'High',
    'Stacks':                              'High',
    'Tree Traversal - Level Order':        'High',
    'Tree Traversal - Pre Order':          'High',
    'Tree Traversal - In Order':           'High',
    'Tree Traversal - Post-Order':         'High',
    'Depth First Search (DFS)':            'High',
    'Breadth First Search (BFS)':          'High',
    'Linked List':                         'High',
    # ── Mid ── important patterns ──────────────────────────────────────────
    'Bit Manipulation':                    'Mid',
    'Prefix Sum':                          'Mid',
    "Kadane's Algorithm":                   'Mid',
    'Matrix (2D Array)':                   'Mid',
    'LinkedList In-place Reversal':        'Mid',
    'Fast and Slow Pointers':              'Mid',
    'Monotonic Stack':                     'Mid',
    'Queues':                              'Mid',
    'Monotonic Queue':                     'Mid',
    'Recursion':                           'Mid',
    'Divide and Conquer':                  'Mid',
    'Merge Sort':                          'Mid',
    'QuickSort / QuickSelect':             'Mid',
    'Backtracking':                        'Mid',
    'BST / Ordered Set':                   'Mid',
    'Tries':                               'Mid',
    'Heaps':                               'Mid',
    'Two Heaps':                           'Mid',
    'Top K Elements':                      'Mid',
    'Intervals':                           'Mid',
    'K-Way Merge':                         'Mid',
    'Data Structure Design':               'Mid',
    'Greedy':                              'Mid',
    'Topological Sort':                    'Mid',
    'Union Find':                          'Mid',
    'Minimum Spanning Tree':               'Mid',
    'Shortest Path':                       'Mid',
    # ── Low ── advanced / specialised topics ──────────────────────────────
    'Bucket Sort':                         'Low',
    'Eulerian Circuit':                    'Low',
    '1-D DP':                              'Low',
    '0/1 Knapsack':                        'Low',
    'Unbounded Knapsack':                  'Low',
    'Longest Increasing Subsequence (LIS)': 'Low',
    '2D Grid DP':                          'Low',
    'String DP':                           'Low',
    'Tree / Graph DP':                     'Low',
    'Bitmask DP':                          'Low',
    'Digit DP':                            'Low',
    'Probability DP':                      'Low',
    'State Machine DP':                    'Low',
    'Maths / Geometry':                    'Low',
    'String Matching':                     'Low',
    'Binary Indexed Tree / Segment Tree':  'Low',
    'Line Sweep':                          'Low',
}

# Category display order (mirrors algomaster600.ts file order)
AM600_ORDER = [
    # High
    'Arrays', 'Strings', 'Hash Tables', 'Two Pointers',
    'Sliding Window - Fixed Size', 'Sliding Window - Dynamic Size',
    'Binary Search', 'Stacks',
    'Tree Traversal - Level Order', 'Tree Traversal - Pre Order',
    'Tree Traversal - In Order', 'Tree Traversal - Post-Order',
    'Depth First Search (DFS)', 'Breadth First Search (BFS)', 'Linked List',
    # Mid
    'Bit Manipulation', 'Prefix Sum', "Kadane's Algorithm", 'Matrix (2D Array)',
    'LinkedList In-place Reversal', 'Fast and Slow Pointers',
    'Monotonic Stack', 'Queues', 'Monotonic Queue',
    'Recursion', 'Divide and Conquer', 'Merge Sort', 'QuickSort / QuickSelect',    'Backtracking', 'BST / Ordered Set', 'Tries', 'Heaps', 'Two Heaps', 'Top K Elements',
    'Intervals', 'K-Way Merge', 'Data Structure Design', 'Greedy',
    'Topological Sort', 'Union Find', 'Minimum Spanning Tree', 'Shortest Path',
    # Low
    'Bucket Sort', 'Eulerian Circuit',
    '1-D DP', '0/1 Knapsack', 'Unbounded Knapsack', 'Longest Increasing Subsequence (LIS)',
    '2D Grid DP', 'String DP', 'Tree / Graph DP', 'Bitmask DP',
    'Digit DP', 'Probability DP', 'State Machine DP',
    'Maths / Geometry', 'String Matching', 'Binary Indexed Tree / Segment Tree', 'Line Sweep',
]


def load_am600_category_map() -> dict[int, str]:
    """Returns {qid: category_name} for all 599 AM600 questions."""
    ts = (SCRIPT_DIR / 'src' / 'lib' / 'algomaster600.ts').read_text()
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
    Merges all three data sources, filtered to AM600 question IDs.
    """
    am600_ids = set(load_am600_category_map().keys())

    base_qs   = json.loads((SCRIPT_DIR / 'public' / 'questions_full.json').read_text())
    am600_ext = json.loads((SCRIPT_DIR / 'am600_extra_questions.json').read_text()) \
                if (SCRIPT_DIR / 'am600_extra_questions.json').exists() else []
    nc150_ext = json.loads((SCRIPT_DIR / 'neetcode_extra_questions.json').read_text()) \
                if (SCRIPT_DIR / 'neetcode_extra_questions.json').exists() else []

    by_id: dict[int, dict] = {}
    for q in base_qs:
        if q['id'] in am600_ids:
            by_id[q['id']] = q
    for q in am600_ext:
        if q['id'] in am600_ids and q['id'] not in by_id:
            by_id[q['id']] = q
    for q in nc150_ext:
        if q['id'] in am600_ids and q['id'] not in by_id:
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
    """Build 9-round structure using AM600 categories as patterns."""
    ROUNDS = [
        (1, 'High', 'Easy'), (2, 'High', 'Medium'), (3, 'High', 'Hard'),
        (4, 'Mid',  'Easy'), (5, 'Mid',  'Medium'),  (6, 'Mid',  'Hard'),
        (7, 'Low',  'Easy'), (8, 'Low',  'Medium'),  (9, 'Low',  'Hard'),
    ]
    result = []
    for round_num, priority, difficulty in ROUNDS:
        tier_cats = [c for c in AM600_ORDER if AM600_PRIORITY.get(c) == priority]
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
    print('Loading AlgoMaster 600 data…')
    cat_map = load_am600_category_map()
    questions, sites, doocs = load_questions()
    print(f'  {len(questions)} / 599 questions loaded  ·  sites: {len(sites)}  ·  doocs: {len(doocs)}')

    missing = set(cat_map.keys()) - {q['id'] for q in questions}
    if missing:
        print(f'  Warning: {len(missing)} AM600 question(s) have no scraped data: {sorted(missing)[:10]}...')

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

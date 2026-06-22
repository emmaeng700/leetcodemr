"""
LeetMastery — Batch STAR-LC Interview Approach Generator
=========================================================
Generates 6-phase interview scripts for all questions missing from playbook_data.json.
Processes in batches of 10, saves after each batch, skips already-done questions.

Usage:
  python3 generate_playbook_batch.py
  python3 generate_playbook_batch.py --dry-run   # show plan only, no API calls
"""

import json, re, sys, time
from pathlib import Path
import anthropic

SCRIPT_DIR   = Path(__file__).parent
PLAYBOOK_PATH = SCRIPT_DIR / 'public' / 'playbook_data.json'
QUESTIONS_PATH = SCRIPT_DIR / 'public' / 'questions_full.json'
DOOCS_PATH   = SCRIPT_DIR / '.doocs_cache.json'

DRY_RUN    = '--dry-run' in sys.argv
BATCH_SIZE = 10

# ─── Pattern / priority maps ──────────────────────────────────────────────────
from generate_patterns_pdf import QUICK_PATTERNS

PATTERN_PRIORITY = {
    'Arrays & Hashing':'High','String':'High','Two Pointers':'High',
    'Sliding Window':'High','Sorting':'High','Binary Search':'High',
    'Matrix':'High','Trees & BST':'High','DFS':'High','Graphs':'High','BFS':'High',
    'Linked List':'Mid','Stack':'Mid','Heap':'Mid','Trie':'Mid',
    'Backtracking':'Mid','Greedy':'Mid',
    'Dynamic Programming':'Low','Bit Manipulation':'Low','Math':'Low','JavaScript':'Low',
}
DISPLAY_PATTERN_ORDER = [
    'Arrays & Hashing','String','Two Pointers','Sliding Window','Sorting',
    'Binary Search','Matrix','Trees & BST','DFS','Graphs','BFS',
    'Linked List','Stack','Heap','Trie','Backtracking','Greedy',
    'Dynamic Programming','Bit Manipulation','Math','JavaScript',
]
PRI_ORD  = {'High': 0, 'Mid': 1, 'Low': 2}
DIFF_ORD = {'Easy': 0, 'Medium': 1, 'Hard': 2}

# ─── Example script (used in prompt as format reference) ─────────────────────
_EXAMPLE = '''# PHASE 1 — CLARIFY
# "We have a sorted list of non-overlapping intervals. Insert a new interval,
#  merging wherever it overlaps. Return the result sorted."
#
# "[[1,3],[6,9]], newInterval=[2,5]:
#  [2,5] overlaps [1,3] → merge to [1,5]. [6,9] doesn't overlap → keep."

# PHASE 2 — BRUTE FORCE
# "Append the new interval, sort by start, run a standard merge pass.
#  Time: O(n log n). Space: O(n). Should I optimize?"

class _57_InsertInterval_Brute:
    def insert(self, intervals, newInterval):
        intervals.append(newInterval)
        intervals.sort()
        result = [intervals[0]]
        for s, e in intervals[1:]:
            if result[-1][1] >= s:
                result[-1][1] = max(result[-1][1], e)
            else:
                result.append([s, e])
        return result

# PHASE 3 — OPTIMIZE
# "Input is already sorted — exploit that to avoid the sort.
#  Three O(n) phases: add non-overlapping left side, merge overlapping middle,
#  add non-overlapping right side."

# PHASE 4 — CLEAN CODE

class _57_InsertInterval:
    def insert(self, intervals, newInterval):
        result = []
        i, n = 0, len(intervals)
        while i < n and intervals[i][1] < newInterval[0]:
            result.append(intervals[i]); i += 1
        while i < n and intervals[i][0] <= newInterval[1]:
            newInterval[0] = min(newInterval[0], intervals[i][0])
            newInterval[1] = max(newInterval[1], intervals[i][1]); i += 1
        result.append(newInterval)
        result.extend(intervals[i:])
        return result

# PHASE 5 — TEST & DEBUG
# intervals=[[1,3],[6,9]], new=[2,5]:
#   Phase1: [1,3] ends at 3>=2 → stop. Phase2: merge [1,3] → [1,5]. → [[1,5],[6,9]] ✓

# PHASE 6 — COMPLEXITY & FOLLOW-UP
# "Time O(n) — one pass. Space O(n) for output.
#  If the list weren't sorted, we'd need the brute O(n log n) sort approach.
#  Follow-up: merge all overlapping intervals (LC56) is essentially the same idea."'''

# ─── Build exclusive pattern map ──────────────────────────────────────────────
def build_excl_map(questions):
    excl = {}
    for p in QUICK_PATTERNS:
        ptags = set(p['tags'])
        for q in questions:
            if q['id'] not in excl and set(q.get('tags', [])) & ptags:
                excl[q['id']] = p['name']
    return excl

# ─── Strip HTML to plain text for the prompt ──────────────────────────────────
def html_to_text(html: str) -> str:
    text = re.sub(r'<pre[^>]*>(.*?)</pre>', lambda m: '\n```\n' + re.sub(r'<[^>]+>','',m.group(1)) + '\n```', html, flags=re.S)
    text = re.sub(r'<li[^>]*>(.*?)</li>', lambda m: '• ' + re.sub(r'<[^>]+>','',m.group(1)).strip(), text, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'\xa0', ' ', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# ─── Build prompt for a batch of questions ────────────────────────────────────
def build_prompt(batch: list, doocs: dict) -> str:
    parts = [
        'You are generating STAR-LC interview approach scripts for LeetCode problems.',
        'Each script has exactly 6 phases in this format (follow the example precisely):\n',
        f'EXAMPLE (question #57):\n```\n{_EXAMPLE}\n```\n',
        'RULES:',
        '- Use inner helper functions instead of self.method() for recursive calls.',
        '- Class names must use the pattern: _<id>_<TitleNoCamelCase> and _<id>_<Title>_Brute',
        '- Phase 1 CLARIFY: restate problem + trace 1-2 examples from the actual problem.',
        '- Phase 2 BRUTE FORCE: describe brute approach + small working code.',
        '- Phase 3 OPTIMIZE: explain the key insight + pseudocode.',
        '- Phase 4 CLEAN CODE: final clean Python solution only (no self.method recursion).',
        '- Phase 5 TEST: trace 2-3 cases from the actual problem examples.',
        '- Phase 6 COMPLEXITY: time/space + 1-2 follow-ups.',
        '- Keep each phase concise — fits on a mini study card.',
        '- Output ONLY valid JSON: {"results": [{"id": <int>, "title": "<UPPER (pattern)>", "script": "<script>"}]}',
        '- Escape newlines as \\n and quotes as \\" inside JSON strings.',
        '\nGenerate scripts for these questions:\n',
    ]
    for q in batch:
        qid  = q['id']
        desc = html_to_text(doocs.get(str(qid), {}).get('desc_html', '') or q.get('content', ''))
        parts.append(f'---\nID: {qid}\nTitle: {q["title"]}\nDifficulty: {q["difficulty"]}\nPattern: {q["_pattern"]}\nTags: {", ".join(q.get("tags", [])[:6])}\nDescription:\n{desc[:1200]}\n')
    parts.append('\nOutput only the JSON object. No markdown fences, no explanation.')
    return '\n'.join(parts)

# ─── Call Claude API ──────────────────────────────────────────────────────────
def generate_batch(client, batch: list, doocs: dict, attempt: int = 1) -> list:
    prompt = build_prompt(batch, doocs)
    try:
        msg = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=8000,
            messages=[{'role': 'user', 'content': prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip any accidental markdown fences
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return data.get('results', [])
    except json.JSONDecodeError as e:
        print(f'  ⚠ JSON parse error (attempt {attempt}): {e}')
        if attempt < 3:
            time.sleep(5)
            return generate_batch(client, batch, doocs, attempt + 1)
        return []
    except Exception as e:
        print(f'  ⚠ API error (attempt {attempt}): {e}')
        if attempt < 3:
            time.sleep(10)
            return generate_batch(client, batch, doocs, attempt + 1)
        return []

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print('Loading data…')
    pb    = json.loads(PLAYBOOK_PATH.read_text())
    qs    = json.loads(QUESTIONS_PATH.read_text())
    doocs = json.loads(DOOCS_PATH.read_text())

    done  = set(int(k) for k in pb if pb[k].get('script', '').strip())
    excl  = build_excl_map(qs)

    missing = [q for q in qs if q['id'] not in done]
    for q in missing:
        q['_pattern'] = excl.get(q['id'], 'Unknown')

    missing.sort(key=lambda q: (
        PRI_ORD.get(PATTERN_PRIORITY.get(q['_pattern'], ''), 9),
        DIFF_ORD.get(q.get('difficulty', ''), 9),
        q['id'],
    ))

    print(f'  {len(done)} already done  |  {len(missing)} to generate')
    if not missing:
        print('Nothing to do.')
        return

    # Show plan
    from collections import Counter
    groups = Counter(
        f'{PATTERN_PRIORITY.get(q["_pattern"],"?")} {q["difficulty"]}'
        for q in missing
    )
    for grp in ['High Easy','High Medium','High Hard',
                'Mid Easy','Mid Medium','Mid Hard',
                'Low Easy','Low Medium','Low Hard']:
        if groups[grp]:
            print(f'  {grp}: {groups[grp]}')

    if DRY_RUN:
        print('\n--dry-run: no API calls made.')
        for i, q in enumerate(missing[:20], 1):
            print(f'  {i:3}. #{q["id"]:4} [{q["difficulty"]:6}] {q["_pattern"]:22} {q["title"]}')
        if len(missing) > 20:
            print(f'  ... and {len(missing)-20} more')
        return

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    batches = [missing[i:i+BATCH_SIZE] for i in range(0, len(missing), BATCH_SIZE)]
    total_done = 0

    for bi, batch in enumerate(batches, 1):
        ids = [q['id'] for q in batch]
        print(f'\nBatch {bi}/{len(batches)} — #{ids[0]}…#{ids[-1]} ({len(batch)} questions)…')

        results = generate_batch(client, batch, doocs)

        if not results:
            print(f'  ✗ Batch {bi} failed — skipping')
            continue

        saved = 0
        for r in results:
            qid    = int(r.get('id', 0))
            script = r.get('script', '').strip()
            title  = r.get('title', '').strip()
            if not script or not qid:
                continue
            pb[str(qid)] = {'title': title, 'script': script}
            saved += 1
            total_done += 1

        # Save after every batch
        PLAYBOOK_PATH.write_text(json.dumps(pb, ensure_ascii=False, indent=2))
        print(f'  ✓ {saved}/{len(batch)} saved  ({total_done} total so far)')

        # Rate-limit pause between batches
        if bi < len(batches):
            time.sleep(2)

    print(f'\nDone — {total_done} new scripts generated.')
    print(f'Playbook now has {sum(1 for v in pb.values() if v.get("script","").strip())} / {len(qs)} questions.')

if __name__ == '__main__':
    main()

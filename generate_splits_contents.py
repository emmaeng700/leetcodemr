#!/usr/bin/env python3
"""
generate_splits_contents.py
Standalone script that generates ONLY the cover + learner note + master
contents pages from the ALL Splits PDF — without building all 700+ question pages.

Output: ~/Desktop/pdf study splits/Study Splits/Contents - 00 ALL Splits.pdf
"""

import sys as _sys
import os, re, json, tempfile, shutil
from pathlib import Path
from collections import defaultdict

from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

_orig_argv = _sys.argv[:]
_sys.argv = [_sys.argv[0], '--all']
from generate_better_pdf import (
    _impose_1up, _analyze_inner_for_links,
    S, USE_W, USE_H, MP_W, MP_H, MG, hr, _inner_ps, safe_xml,
    PageCounter,
)
from generate_mega_splits import _add_overview_qid_links
from generate_patterns_pdf import QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load
_sys.argv = _orig_argv

SCRIPT_DIR = Path(__file__).parent
GRIND_JSON = SCRIPT_DIR / 'public' / 'grind_questions.json'
OUTPUT_DIR = Path.home() / 'Desktop' / 'pdf study splits' / 'Study Splits'
OUTPUT_FILE = OUTPUT_DIR / 'Contents - 00 ALL Splits.pdf'

PATTERN_ORDER = PATTERN_DISPLAY_ORDER
PAT_COLOR = {p['name']: p['hex'] for p in QUICK_PATTERNS}
PAT_OBJ   = {p['name']: p         for p in QUICK_PATTERNS}

PATTERN_ABBREV = {
    'Arrays & Hashing': 'A&H', 'String': 'Str', 'Two Pointers': '2P',
    'Sliding Window': 'SW', 'Sorting': 'Sort', 'Binary Search': 'BS',
    'Matrix': 'Mtx', 'Trees & BST': 'Trees', 'DFS': 'DFS', 'Graphs': 'Gph',
    'BFS': 'BFS', 'Linked List': 'LL', 'Stack': 'Stk', 'Heap': 'Heap',
    'Trie': 'Trie', 'Backtracking': 'BT', 'Greedy': 'Grdy',
    'Dynamic Programming': 'DP', 'Bit Manipulation': 'BitM',
    'Math': 'Math', 'JavaScript': 'JS',
}
DIFF_ABBREV  = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}
PRIORITY_HEX = {'High': '#EF4444', 'Mid': '#EAB308', 'Low': '#6366F1'}
DIFF_COL     = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}
GRAY_300     = HexColor('#D1D5DB')
GRAY_600     = '#4B5563'
BAND_HEX     = {
    'tiny':   '#16A34A',
    'short':  '#059669',
    'medium': '#D97706',
    'long':   '#DC2626',
}


def build_sections(questions: list) -> list:
    bucket: dict = defaultdict(list)
    for q in questions:
        section = q.get('section') or ''
        pat = q.get('pattern')
        s = q.get('set', 1)
        m = re.match(r'^(High|Mid|Low) (Easy|Medium|Hard)', section)
        if not m or not pat:
            continue
        bucket[(m.group(1), m.group(2), s, pat)].append(q)

    for key in bucket:
        bucket[key].sort(key=lambda q: q.get('id', 0))

    sections, rn = [], 0
    for priority in ['High', 'Mid', 'Low']:
        for s in [1, 2, 3]:
            for diff in ['Easy', 'Medium', 'Hard']:
                pat_groups = []
                for pat in PATTERN_ORDER:
                    qs = bucket.get((priority, diff, s, pat))
                    if qs:
                        obj = PAT_OBJ.get(pat, {'name': pat, 'hex': PAT_COLOR.get(pat, '#6366F1')})
                        pat_groups.append((obj, qs))
                if pat_groups:
                    rn += 1
                    sections.append((rn, priority, diff, s, pat_groups))
    return sections


def build_pattern_splits(sections: list) -> list:
    """Flatten rounds into the 138 pattern-level splits (priority, diff, set, pat, n)."""
    items = []
    for _rn, priority, diff, set_num, pat_groups in sections:
        for pat_obj, qs in pat_groups:
            items.append({
                'n': len(qs),
                'priority': priority,
                'diff': diff,
                'set': set_num,
                'pat': pat_obj['name'],
                'abbr': PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name']),
                'hex': pat_obj.get('hex', '#6366F1'),
            })
    return items


def build_qid_to_sec_field(sections: list) -> dict:
    """Map each question id → shared Size Roster checkbox field name."""
    out = {}
    for _rn, priority, diff, set_num, pat_groups in sections:
        tier = f'{priority[0]}{DIFF_ABBREV.get(diff, diff[:1])}'
        for pat_obj, qs in pat_groups:
            abbr = PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name'])
            field = f'ln_sec_{abbr}_S{set_num}_{tier}_{len(qs)}q'
            for q in qs:
                out[int(q['id'])] = field
    return out


PRIORITY_ORDER = {'High': 0, 'Mid': 1, 'Low': 2}
DIFF_ORDER     = {'Easy': 0, 'Medium': 1, 'Hard': 2}


def _band_for(n: int) -> str:
    if n <= 4:
        return 'tiny'
    if n <= 9:
        return 'short'
    if n <= 15:
        return 'medium'
    return 'long'


def _band_label(band: str) -> str:
    return {
        'tiny':   '1–4q  ·  tiny wins',
        'short':  '5–9q  ·  short sections',
        'medium': '10–15q  ·  solid blocks',
        'long':   '16+q  ·  deep work',
    }[band]


def _sort_key_asc(it: dict):
    """High → Mid → Low, then Easy → Med → Hard, then larger n, then S1 → S2 → S3."""
    return (
        PRIORITY_ORDER.get(it['priority'], 9),
        DIFF_ORDER.get(it['diff'], 9),
        -it['n'],
        it['set'],
        it['pat'],
    )


def _sort_key_desc(it: dict):
    """Same as asc for priority/diff; within that, larger n first."""
    return (
        PRIORITY_ORDER.get(it['priority'], 9),
        DIFF_ORDER.get(it['diff'], 9),
        -it['n'],
        it['set'],
        it['pat'],
    )


def _split_label(it: dict) -> str:
    d = DIFF_ABBREV.get(it['diff'], it['diff'][:1])
    # Leading spaces leave room for a post-imposed checkbox on the left.
    return (
        f'&nbsp;&nbsp;&nbsp;&nbsp;'
        f'<font color="{it["hex"]}"><b>{safe_xml(it["abbr"])}</b></font>'
        f'  S{it["set"]} {it["priority"][0]}{d}  '
        f'<font color="{GRAY_600}">{it["n"]}q</font>'
    )


def _append_band_list(story, items: list, band: str, order: str, key_prefix: str,
                      with_checks: bool = False):
    band_items = [it for it in items if _band_for(it['n']) == band]
    if not band_items:
        return
    band_items = sorted(
        band_items,
        key=_sort_key_desc if order == 'desc' else _sort_key_asc,
    )
    hx = BAND_HEX[band]
    story.append(Paragraph(
        f'<font color="{hx}"><b>{_band_label(band)}</b></font>'
        f'  <font color="{GRAY_600}">({len(band_items)} sections)</font>',
        _inner_ps(f'{key_prefix}_{band}_h', 'body', spaceBefore=3, spaceAfter=1),
    ))
    if with_checks:
        # One section per line so each gets its own checkbox.
        # Insert a small priority subhead when the priority group changes.
        cur_pri = None
        for i, it in enumerate(band_items, 1):
            if it['priority'] != cur_pri:
                cur_pri = it['priority']
                pri_hex = PRIORITY_HEX[cur_pri]
                story.append(Paragraph(
                    f'<font color="{pri_hex}"><b>{cur_pri}</b></font>',
                    _inner_ps(f'{key_prefix}_{band}_{cur_pri}_h', 'body_sm',
                              spaceBefore=1.5, spaceAfter=0.3),
                ))
            story.append(Paragraph(
                _split_label(it),
                _inner_ps(f'{key_prefix}_{band}_{i}', 'body_sm', spaceAfter=0.4),
            ))
    else:
        cur_pri = None
        row = []
        for i, it in enumerate(band_items, 1):
            if it['priority'] != cur_pri:
                if row:
                    story.append(Paragraph(
                        '   ·   '.join(row),
                        _inner_ps(f'{key_prefix}_{band}_{i}_flush', 'body_sm', spaceAfter=0.5),
                    ))
                    row = []
                cur_pri = it['priority']
                pri_hex = PRIORITY_HEX[cur_pri]
                story.append(Paragraph(
                    f'<font color="{pri_hex}"><b>{cur_pri}</b></font>',
                    _inner_ps(f'{key_prefix}_{band}_{cur_pri}_h', 'body_sm',
                              spaceBefore=1.5, spaceAfter=0.3),
                ))
            d = DIFF_ABBREV.get(it['diff'], it['diff'][:1])
            row.append(
                f'<font color="{it["hex"]}"><b>{safe_xml(it["abbr"])}</b></font>'
                f'  S{it["set"]} {it["priority"][0]}{d}  '
                f'<font color="{GRAY_600}">{it["n"]}q</font>'
            )
            if len(row) == 2 or i == len(band_items):
                story.append(Paragraph(
                    '   ·   '.join(row),
                    _inner_ps(f'{key_prefix}_{band}_{i}', 'body_sm', spaceAfter=0.5),
                ))
                row = []


def append_learner_note(story, sections: list) -> None:
    """Motivation page(s): size-sorted paths through the 138 pattern splits."""
    items = build_pattern_splits(sections)
    n_all = len(items)
    tiny = sum(1 for it in items if _band_for(it['n']) == 'tiny')
    short = sum(1 for it in items if _band_for(it['n']) == 'short')
    medium = sum(1 for it in items if _band_for(it['n']) == 'medium')
    long_ = sum(1 for it in items if _band_for(it['n']) == 'long')
    under10 = tiny + short

    story.append(Paragraph(
        '<b>Note to the Learner</b>',
        _inner_ps('ln_title', 'title', spaceAfter=2),
    ))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        f'These {n_all} pattern sections are not equal in size. '
        f'<b>{under10}</b> have under 10 questions — quick wins you can finish in one sitting. '
        f'Use size to choose your pace. Tick any section below as you clear it '
        f'(saved with the PDF).',
        _inner_ps('ln_intro', 'body_sm', spaceAfter=2, alignment=TA_LEFT),
    ))

    # Strategy — Large → Small roster only
    card = Table([[Paragraph(
        '<font color="white"><b>Study order — Heavy first (Large → Small)</b></font>',
        _inner_ps('ln_card_b', 'body_sm', alignment=TA_CENTER, textColor=white),
    )]], colWidths=[USE_W])
    card.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), HexColor('#1E3A8A')),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(Spacer(1, 2))
    story.append(card)
    story.append(Paragraph(
        'Knock out the 16+ and 10–15 sections while focus is freshest, '
        'then zoom through the under-10s for a fast finish.',
        _inner_ps('ln_body_b', 'body_sm', spaceBefore=1, spaceAfter=1),
    ))

    story.append(Spacer(1, 2))
    story.append(Paragraph(
        f'<font color="{BAND_HEX["tiny"]}"><b>1–4q:</b></font> {tiny}   ·   '
        f'<font color="{BAND_HEX["short"]}"><b>5–9q:</b></font> {short}   ·   '
        f'<font color="{BAND_HEX["medium"]}"><b>10–15q:</b></font> {medium}   ·   '
        f'<font color="{BAND_HEX["long"]}"><b>16+:</b></font> {long_}',
        _inner_ps('ln_counts', 'body_sm', alignment=TA_CENTER, spaceAfter=2),
    ))
    story.append(PageBreak())

    story.append(Paragraph(
        '<b>Size Roster — Large → Small</b>',
        _inner_ps('ln_desc_title', 'title', spaceAfter=2),
    ))
    story.append(Paragraph(
        'Tick sections as you finish them.',
        _inner_ps('ln_desc_sub', 'body_sm', spaceAfter=1),
    ))
    story.append(hr(GRAY_300, 0.4))
    for band in ('long', 'medium', 'short', 'tiny'):
        _append_band_list(story, items, band, 'desc', 'desc', with_checks=True)


def _add_learner_note_checkboxes(pdf_path: Path) -> None:
    """
    Draw a checkbox left of each roster line on the Size Roster pages.
    Same section → same field name as Contents checkboxes so ticks stay in sync.
    """
    import fitz

    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    from generate_better_pdf import TOC_CB_PT, TOC_CB_GAP
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    # Match "S1 HE" / "S2 MM" style tokens on roster lines
    set_tier_re = re.compile(r'^S([123])$')
    tier_re = re.compile(r'^[HML][EMH]$')
    nq_re = re.compile(r'^(\d+)q$')

    doc = fitz.open(str(pdf_path))
    n_boxes = 0
    # Sticky once we hit a Size Roster — continuation pages keep the list but
    # drop the band header, so a per-page header check would skip them.
    in_roster = False
    for pg_idx, page in enumerate(doc):
        text = page.get_text('text')
        if (
            'Size Roster' in text
            or 'tiny wins' in text
            or 'short sections' in text
            or 'solid blocks' in text
            or 'deep work' in text
        ):
            in_roster = True
        if not in_roster:
            continue

        words = list(page.get_text('words'))  # x0,y0,x1,y1,word,block,line,word_no
        # Group by (block, line)
        lines: dict = defaultdict(list)
        for w in words:
            lines[(w[5], w[6])].append(w)

        seen_y: set = set()
        for (_b, _ln), ws in lines.items():
            ws = sorted(ws, key=lambda w: w[0])
            toks = [w[4] for w in ws]
            # Need … S# XX Nq somewhere on the line
            set_i = next((i for i, t in enumerate(toks) if set_tier_re.match(t)), None)
            if set_i is None or set_i + 2 >= len(toks):
                continue
            if not tier_re.match(toks[set_i + 1]):
                continue
            if not nq_re.match(toks[set_i + 2]):
                continue
            n_q = int(nq_re.match(toks[set_i + 2]).group(1))

            # Pattern abbr is the token(s) just before S#
            abbr = toks[set_i - 1] if set_i > 0 else 'X'
            set_num = toks[set_i][1]
            tier = toks[set_i + 1]
            y0 = min(w[1] for w in ws)
            y1 = max(w[3] for w in ws)
            x0 = min(w[0] for w in ws)
            y_key = round(y0, 1)
            if y_key in seen_y:
                continue
            seen_y.add(y_key)

            line_h = max(y1 - y0, cb_h)
            cb_y0 = y0 + (line_h - cb_h) / 2
            cb_x1 = x0 - gap * 0.35
            cb_x0 = cb_x1 - cb_h
            if cb_x0 < 8:
                cb_x0 = 10
                cb_x1 = cb_x0 + cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                           fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd = fitz.Widget()
            wd.rect        = cb_rect
            wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            # Shared name with Contents overview checkboxes → ticks sync when saved
            wd.field_name  = f'ln_sec_{abbr}_S{set_num}_{tier}_{n_q}q'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            page.add_widget(wd)
            n_boxes += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_boxes} section checkboxes added on Size Roster pages')


def build_contents_pdf(sections: list, inner_path: Path) -> None:
    total_qs     = sum(len(qs) for _, _, _, _, pgs in sections for _, qs in pgs)
    total_rounds = len(sections)
    n_splits     = sum(len(pgs) for _, _, _, _, pgs in sections)

    doc = SimpleDocTemplate(
        str(inner_path), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.1))
    story.append(Paragraph(
        '<b>ALL SPLITS</b>',
        _inner_ps('cov_h1', 'title', alignment=TA_CENTER,
                  fontSize=S['title'].fontSize * 2, leading=S['title'].leading * 2),
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Complete Study Split Collection',
        _inner_ps('cov_h2', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 5))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f'{total_qs} questions  ·  {n_splits} pattern sections  ·  '
        f'{total_rounds} rounds  ·  3 Sets',
        _inner_ps('cov_stats', 'body', alignment=TA_CENTER),
    ))
    story.append(Paragraph(
        'High (S1→S2→S3, Easy→Med→Hard)  →  Mid  →  Low',
        _inner_ps('cov_order', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        'WalkCC · LeetDoocs · SimplyLeet · LC.ca  ·  Python',
        _inner_ps('cov_sites', 'body_sm', alignment=TA_CENTER),
    ))
    story.append(PageBreak())

    # ── Learner note + size rosters (before Contents) ─────────────────────────
    append_learner_note(story, sections)
    story.append(PageBreak())

    # ── Master Contents ───────────────────────────────────────────────────────
    story.append(Paragraph('<b>Contents</b>',
                           _inner_ps('ov_title', 'title', spaceAfter=3)))
    story.append(hr(GRAY_300, 0.4))
    cur_pri, cur_s = None, None
    for rn, priority, diff, set_num, pat_groups in sections:
        n_qs = sum(len(qs) for _, qs in pat_groups)
        if priority != cur_pri or set_num != cur_s:
            cur_pri, cur_s = priority, set_num
            story.append(Spacer(1, 3))
            grp = Table([[Paragraph(
                f'<font color="white"><b>{priority}  ·  Set {set_num}</b></font>',
                _inner_ps(f'ov_g_{priority}_{set_num}', 'body',
                          alignment=TA_CENTER, textColor=white),
            )]], colWidths=[USE_W])
            grp.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, -1), HexColor(PRIORITY_HEX[priority])),
                ('TOPPADDING',    (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            story.append(grp)

        story.append(Paragraph(
            f'<b>Round {rn}  |  {priority}</b>'
            f'  <font color="{DIFF_COL[diff]}">{diff}</font>  S{set_num}  ({n_qs}q)',
            _inner_ps(f'ov_r{rn}', 'body', spaceBefore=2),
        ))
        for pat_obj, qs in pat_groups:
            pat_hex = pat_obj['hex']
            story.append(Paragraph(
                f'  <font color="{pat_hex}"><b>'
                f'{safe_xml(pat_obj["name"])}</b></font> ({len(qs)})'
                f'  <font color="#6B7280">'
                + '  '.join(f'#{q["id"]}' for q in qs) + '</font>',
                _inner_ps(f'ov_p{rn}_{pat_obj["name"][:6]}', 'body_sm', spaceAfter=1),
            ))

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)


def main():
    if not GRIND_JSON.exists():
        raise SystemExit(f'✗ Not found: {GRIND_JSON}')

    with open(GRIND_JSON) as f:
        questions = json.load(f)
    print(f'Loaded {len(questions)} questions')

    sections = build_sections(questions)
    total_qs = sum(len(qs) for _, _, _, _, pgs in sections for _, qs in pgs)
    n_splits = sum(len(pgs) for _, _, _, _, pgs in sections)
    print(f'{len(sections)} rounds  ·  {n_splits} pattern sections  ·  {total_qs} questions\n')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    SCRATCHPAD = Path(tempfile.gettempdir())
    inner_path   = SCRATCHPAD / '_splits_contents_inner.pdf'
    imposed_tmp  = SCRATCHPAD / '_splits_contents_imposed.pdf'

    try:
        print('Building contents PDF…')
        build_contents_pdf(sections, inner_path)

        if not inner_path.exists() or inner_path.stat().st_size == 0:
            raise RuntimeError(f'Inner PDF missing or empty: {inner_path}')

        print('Imposing 1×1…')
        _impose_1up(inner_path, imposed_tmp)

        print('Analyzing overview links…')
        rounds_struct = [(rn, pri, diff, pgs) for rn, pri, diff, s, pgs in sections]
        _page_types, qid_first_page, toc_link_rects, _toc_section_rects = (
            _analyze_inner_for_links(inner_path, rounds_struct)
        )
        # Only master Contents pages get overview checkboxes — skip learner-note pages.
        overview_pages = {
            pg for pg, rects in toc_link_rects.items()
            if len(rects) >= 20
        }
        if not overview_pages:
            overview_pages = set(toc_link_rects.keys())

        print(f'Adding inline QID links + checkboxes on {len(overview_pages)} overview page(s)…')
        sec_fields = build_qid_to_sec_field(sections)
        _add_overview_qid_links(
            imposed_tmp, overview_pages, qid_first_page,
            {pg: toc_link_rects[pg] for pg in overview_pages},
            sec_field_by_qid=sec_fields,
        )

        print('Adding Size Roster section checkboxes…')
        _add_learner_note_checkboxes(imposed_tmp)

        # Drop any stale name from before the rename.
        old = OUTPUT_DIR / '00 ALL Splits - Contents.pdf'
        if old.exists():
            old.unlink()

        print('Moving to output folder…')
        shutil.move(str(imposed_tmp), str(OUTPUT_FILE))

        kb = os.path.getsize(OUTPUT_FILE) // 1024
        print(f'\n🎉  Done!  {OUTPUT_FILE.name}  ({kb:,} KB)\n→  {OUTPUT_FILE}')

    finally:
        inner_path.unlink(missing_ok=True)
        imposed_tmp.unlink(missing_ok=True)


if __name__ == '__main__':
    main()

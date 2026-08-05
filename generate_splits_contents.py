#!/usr/bin/env python3
"""
generate_splits_contents.py
Standalone script that generates ONLY the cover + learner note + master
contents pages from the ALL Splits PDF — without building all 700+ question pages.

Output: ~/Desktop/pdf study splits/Study Splits/Contents - 00 ALL Packs.pdf
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
    PageCounter, PACK_STUDY_ORDER,
)
from generate_mega_splits import _add_overview_qid_links
from generate_patterns_pdf import QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load
_sys.argv = _orig_argv

SCRIPT_DIR = Path(__file__).parent
GRIND_JSON = SCRIPT_DIR / 'public' / 'grind_questions.json'
OUTPUT_DIR = Path.home() / 'Desktop' / 'pdf study splits' / 'Priority Packs'
OUTPUT_FILE = OUTPUT_DIR / 'Contents - 00 ALL Packs.pdf'

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
                'qs': sorted(qs, key=lambda q: int(q.get('id', 0))),
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


def _lts_within_band_key(it: dict):
    """Within one priority + size band: Easy→Med→Hard, larger n, S1→S3, pattern."""
    return (
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


def _append_priority_bands(story, items: list, priority: str, key_prefix: str,
                           with_checks: bool = True):
    """
    One priority block: size bands Large→Small, sections in LTS study order.
    Matches ALL Splits LtS: High (16+→…→1–4) then Mid then Low.
    """
    pri_items = [it for it in items if it['priority'] == priority]
    if not pri_items:
        return

    pri_hex = PRIORITY_HEX[priority]
    banner = Table([[Paragraph(
        f'<font color="white"><b>{priority}</b></font>',
        _inner_ps(f'{key_prefix}_{priority}_ban', 'body_sm',
                  alignment=TA_CENTER, textColor=white),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(Spacer(1, 3))
    story.append(banner)

    for band in ('long', 'medium', 'short', 'tiny'):
        band_items = [it for it in pri_items if _band_for(it['n']) == band]
        if not band_items:
            continue
        band_items = sorted(band_items, key=_lts_within_band_key)
        hx = BAND_HEX[band]
        story.append(Paragraph(
            f'<font color="{hx}"><b>{_band_label(band)}</b></font>'
            f'  <font color="{GRAY_600}">({len(band_items)} sections)</font>',
            _inner_ps(f'{key_prefix}_{priority}_{band}_h', 'body',
                      spaceBefore=2.5, spaceAfter=1),
        ))
        if with_checks:
            half = USE_W / 2
            for i, it in enumerate(band_items, 1):
                story.append(Paragraph(
                    _split_label(it),
                    _inner_ps(f'{key_prefix}_{priority}_{band}_{i}', 'body_sm',
                              spaceAfter=0.4),
                ))
                q_cells = []
                for q in it.get('qs', []):
                    qid   = q.get('id', 0)
                    title = safe_xml(q.get('title', ''))
                    q_cells.append(Paragraph(
                        f'<font color="{it["hex"]}"><b>#{qid}</b></font>'
                        f'  <font color="#374151">{title}</font>',
                        _inner_ps(f'lr_q_{qid}', 'body_sm',
                                  fontSize=2.2, leading=3.0, spaceAfter=0),
                    ))
                if q_cells:
                    rows = []
                    for j in range(0, len(q_cells), 2):
                        right = q_cells[j+1] if j+1 < len(q_cells) else Paragraph('', _inner_ps(f'lr_e_{i}_{j}', 'body_sm'))
                        rows.append([q_cells[j], right])
                    tbl = Table(rows, colWidths=[half, half])
                    tbl.setStyle(TableStyle([
                        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                        ('TOPPADDING',    (0, 0), (-1, -1), 0),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                        ('RIGHTPADDING',  (0, 0), (-1, -1), 1),
                    ]))
                    story.append(tbl)
                story.append(Spacer(1, 3))
        else:
            row = []
            for i, it in enumerate(band_items, 1):
                d = DIFF_ABBREV.get(it['diff'], it['diff'][:1])
                row.append(
                    f'<font color="{it["hex"]}"><b>{safe_xml(it["abbr"])}</b></font>'
                    f'  S{it["set"]} {it["priority"][0]}{d}  '
                    f'<font color="{GRAY_600}">{it["n"]}q</font>'
                )
                if len(row) == 2 or i == len(band_items):
                    story.append(Paragraph(
                        '   ·   '.join(row),
                        _inner_ps(f'{key_prefix}_{priority}_{band}_{i}', 'body_sm',
                                  spaceAfter=0.5),
                    ))
                    row = []


def append_learner_note(story, sections: list) -> None:
    """Motivation page(s): High→Mid→Low, each Large→Small (matches ALL Splits LtS)."""
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
        f'Clear all Highs large→small, then Mid, then Low. Tick any section below as you clear it '
        f'(saved with the PDF).',
        _inner_ps('ln_intro', 'body_sm', spaceAfter=2, alignment=TA_LEFT),
    ))

    card = Table([[Paragraph(
        '<font color="white"><b>Study order — High → Mid → Low, each Large → Small</b></font>',
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
        'Within High (then Mid, then Low): knock out 16+ and 10–15 while focus is freshest, '
        'then zoom through the under-10s.',
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
        'Tick sections as you finish them. High (16+ → 1–4) · Mid · Low — same as ALL Splits LtS.',
        _inner_ps('ln_desc_sub', 'body_sm', spaceAfter=1),
    ))
    story.append(hr(GRAY_300, 0.4))
    for priority in ('High', 'Mid', 'Low'):
        _append_priority_bands(story, items, priority, 'desc', with_checks=True)


def _add_pack_size_roster_checkboxes(pdf_path: Path) -> None:
    """
    Pack-level checkboxes (lines ending in Nq) and per-question checkboxes
    (lines starting with #NNN) on the Pack Size Order pages.
    """
    import fitz

    nq_re  = re.compile(r'^(\d+)q$')
    qid_re = re.compile(r'^#(\d+)$')

    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    from generate_better_pdf import TOC_CB_PT, TOC_CB_GAP
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    doc = fitz.open(str(pdf_path))
    n_pack_boxes = 0
    n_q_boxes    = 0
    in_roster    = False
    pack_idx     = 0

    for page in doc:
        page_text = page.get_text('text')
        if 'Pack Size Order' in page_text:
            in_roster = True
        if in_roster and 'Note to the Learner' in page_text:
            in_roster = False
        if not in_roster:
            continue

        words = list(page.get_text('words'))
        lines: dict = defaultdict(list)
        for w in words:
            lines[(w[5], w[6])].append(w)

        seen: set = set()
        for (_b, _ln), ws in sorted(lines.items()):
            ws   = sorted(ws, key=lambda w: w[0])
            toks = [w[4] for w in ws]
            if not toks:
                continue

            is_pack = bool(nq_re.match(toks[-1])) and len(toks) >= 2
            qm      = qid_re.match(toks[0])
            if not is_pack and not qm:
                continue

            y0  = min(w[1] for w in ws)
            y1  = max(w[3] for w in ws)
            x0  = min(w[0] for w in ws)
            key = (round(y0, 1), round(x0 / (L_W / 2)))
            if key in seen:
                continue
            seen.add(key)

            line_h = max(y1 - y0, cb_h)
            cb_y0  = y0 + (line_h - cb_h) / 2
            cb_x1  = x0 - gap * 0.35
            cb_x0  = cb_x1 - cb_h
            if cb_x0 < 8:
                cb_x0 = 10
                cb_x1 = cb_x0 + cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                           fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd            = fitz.Widget()
            wd.rect       = cb_rect
            wd.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
            if is_pack:
                pack_idx      += 1
                wd.field_name  = f'psr_pack_{pack_idx}'
                n_pack_boxes  += 1
            else:
                wd.field_name  = f'qtrack_{qm.group(1)}'
                n_q_boxes     += 1
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            page.add_widget(wd)

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_pack_boxes} pack + {n_q_boxes} question checkboxes added')


def _add_study_order_checkboxes(pdf_path: Path) -> None:
    """Add a tickable checkbox left of each numbered pack row on the study order page."""
    import fitz

    num_re = re.compile(r'^(\d{1,2})\.$')

    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    from generate_better_pdf import TOC_CB_PT, TOC_CB_GAP
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    doc = fitz.open(str(pdf_path))
    n_boxes = 0
    in_study_order = False

    for page in doc:
        page_text = page.get_text('text')
        if 'Recommended Study Order' in page_text:
            in_study_order = True
        # Stop once we hit a page that belongs to the next section
        if in_study_order and ('Note to the Learner' in page_text or 'Size Roster' in page_text):
            in_study_order = False
        if not in_study_order:
            continue

        words = list(page.get_text('words'))
        lines: dict = defaultdict(list)
        for w in words:
            lines[(w[5], w[6])].append(w)

        seen_y: set = set()
        for (_b, _ln), ws in lines.items():
            ws = sorted(ws, key=lambda w: w[0])
            toks = [w[4] for w in ws]
            if not toks:
                continue
            m = num_re.match(toks[0])
            if not m:
                continue
            pack_num = int(m.group(1))
            if not (1 <= pack_num <= 21):
                continue

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
            wd.field_name  = f'so_pack_{pack_num}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            page.add_widget(wd)
            n_boxes += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_boxes} study order checkboxes added')


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

        qid_re  = re.compile(r'^#(\d+)$')
        seen: set = set()
        for (_b, _ln), ws in lines.items():
            ws   = sorted(ws, key=lambda w: w[0])
            toks = [w[4] for w in ws]
            if not toks:
                continue

            # Section label row: … S# XX Nq
            set_i = next((i for i, t in enumerate(toks) if set_tier_re.match(t)), None)
            is_section = (
                set_i is not None and set_i + 2 < len(toks)
                and tier_re.match(toks[set_i + 1])
                and nq_re.match(toks[set_i + 2])
            )
            # Question row: first token is #NNN
            qm = qid_re.match(toks[0])

            if not is_section and not qm:
                continue

            y0  = min(w[1] for w in ws)
            y1  = max(w[3] for w in ws)
            x0  = min(w[0] for w in ws)
            # For question rows use (y, x_column) so 2-column rows aren't deduped
            key = (round(y0, 1), round(x0 / (L_W / 2))) if qm else round(y0, 1)
            if key in seen:
                continue
            seen.add(key)

            line_h = max(y1 - y0, cb_h)
            cb_y0  = y0 + (line_h - cb_h) / 2
            cb_x1  = x0 - gap * 0.35
            cb_x0  = cb_x1 - cb_h
            if cb_x0 < 8:
                cb_x0 = 10
                cb_x1 = cb_x0 + cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                           fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd            = fitz.Widget()
            wd.rect       = cb_rect
            wd.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
            if is_section:
                abbr    = toks[set_i - 1] if set_i > 0 else 'X'
                set_num = toks[set_i][1]
                tier    = toks[set_i + 1]
                n_q     = int(nq_re.match(toks[set_i + 2]).group(1))
                wd.field_name = f'ln_sec_{abbr}_S{set_num}_{tier}_{n_q}q'
            else:
                wd.field_name = f'qtrack_{qm.group(1)}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            page.add_widget(wd)
            n_boxes += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_boxes} section + question checkboxes added on Size Roster pages')


def _add_master_contents_checkboxes(pdf_path: Path) -> None:
    """Add per-question checkboxes on the Master Contents pages (qtrack_{qid})."""
    import fitz

    qid_re = re.compile(r'^#(\d+)$')

    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    from generate_better_pdf import TOC_CB_PT, TOC_CB_GAP
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    doc = fitz.open(str(pdf_path))
    n_boxes    = 0
    in_contents = False

    for page in doc:
        page_text = page.get_text('text')
        if 'Round 1 |' in page_text:
            in_contents = True
        if not in_contents:
            continue

        words = list(page.get_text('words'))
        lines: dict = defaultdict(list)
        for w in words:
            lines[(w[5], w[6])].append(w)

        seen: set = set()
        for (_b, _ln), ws in sorted(lines.items()):
            ws   = sorted(ws, key=lambda w: w[0])
            toks = [w[4] for w in ws]
            if not toks:
                continue
            qm = qid_re.match(toks[0])
            if not qm:
                continue

            y0  = min(w[1] for w in ws)
            y1  = max(w[3] for w in ws)
            x0  = min(w[0] for w in ws)
            key = (round(y0, 1), round(x0 / (L_W / 2)))
            if key in seen:
                continue
            seen.add(key)

            line_h = max(y1 - y0, cb_h)
            cb_y0  = y0 + (line_h - cb_h) / 2
            cb_x1  = x0 - gap * 0.35
            cb_x0  = cb_x1 - cb_h
            if cb_x0 < 8:
                cb_x0 = 10
                cb_x1 = cb_x0 + cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                           fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd            = fitz.Widget()
            wd.rect       = cb_rect
            wd.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
            wd.field_name = f'qtrack_{qm.group(1)}'
            wd.field_value = 'Off'
            wd.on_state   = 'Yes'
            page.add_widget(wd)
            n_boxes += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_boxes} question checkboxes added on Master Contents pages')


def build_pack_size_roster(story: list, sections: list) -> None:
    """
    Pack Size Order page: 21 packs sorted largest → smallest within each priority,
    with every question listed underneath its pack (ticked via PDF checkboxes).
    """
    diff_order = {'Easy': 0, 'Medium': 1, 'Hard': 2}
    DIFF_COLOR  = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}

    pack_totals: dict = defaultdict(int)
    pack_qs: dict     = defaultdict(list)  # pat_name → [(diff_ord, qid, diff, q)]

    for _, _pri, diff, set_num, pat_groups in sections:
        for pat_obj, qs in pat_groups:
            n = pat_obj['name']
            pack_totals[n] += len(qs)
            for q in qs:
                pack_qs[n].append((diff_order.get(diff, 1), int(q.get('id', 0)), diff, q))

    for n in pack_qs:
        pack_qs[n].sort()

    story.append(Paragraph(
        '<b>Pack Size Order — Large → Small</b>',
        _inner_ps('psr_title', 'title', spaceAfter=1),
    ))
    story.append(Paragraph(
        'High → Mid → Low, each sorted largest first. '
        'Tick questions as you finish them — stays checked every time you reopen the PDF.',
        _inner_ps('psr_intro', 'body_sm', spaceAfter=2),
    ))
    story.append(hr(GRAY_300, 0.4))

    for priority in ('High', 'Mid', 'Low'):
        pri_packs = [
            (pat_name, pat_hex, pack_totals.get(pat_name, 0))
            for pri, pat_name, pat_hex, _ in PACK_STUDY_ORDER
            if pri == priority
        ]
        pri_packs.sort(key=lambda t: -t[2])
        if not pri_packs:
            continue

        banner = Table([[Paragraph(
            f'<font color="white"><b>{priority}</b></font>',
            _inner_ps(f'psr_ban_{priority}', 'body_sm',
                      alignment=TA_CENTER, textColor=white),
        )]], colWidths=[USE_W])
        banner.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor(PRIORITY_HEX[priority])),
            ('TOPPADDING',    (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(Spacer(1, 3))
        story.append(banner)

        half = USE_W / 2
        for pat_name, pat_hex, total in pri_packs:
            story.append(Spacer(1, 4))
            story.append(Paragraph(
                f'<b><font color="{pat_hex}">{safe_xml(pat_name)}</font></b>'
                f'  <font color="{GRAY_600}">{total}q</font>',
                _inner_ps(f'psr_{priority}_{pat_name[:8]}', 'title', spaceAfter=1),
            ))
            q_cells = []
            for _di, qid, diff, q in pack_qs.get(pat_name, []):
                dc    = DIFF_COLOR.get(diff, GRAY_600)
                title = safe_xml(q.get('title', ''))
                q_cells.append(Paragraph(
                    f'<font color="{pat_hex}"><b>#{qid}</b></font>'
                    f'  <font color="#374151">{title}</font>'
                    f'  <font color="{dc}">·{diff[0]}</font>',
                    _inner_ps(f'psr_q_{qid}', 'body_sm',
                              fontSize=2.2, leading=3.0, spaceAfter=0),
                ))
            if q_cells:
                rows = []
                for i in range(0, len(q_cells), 2):
                    right = q_cells[i + 1] if i + 1 < len(q_cells) else Paragraph('', _inner_ps(f'psr_empty_{i}', 'body_sm'))
                    rows.append([q_cells[i], right])
                tbl = Table(rows, colWidths=[half, half])
                tbl.setStyle(TableStyle([
                    ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING',    (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                    ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING',  (0, 0), (-1, -1), 1),
                ]))
                story.append(tbl)

    story.append(PageBreak())


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

    n_packs = len(PACK_STUDY_ORDER)

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.1))
    story.append(Paragraph(
        '<b>ALL PACKS</b>',
        _inner_ps('cov_h1', 'title', alignment=TA_CENTER,
                  fontSize=S['title'].fontSize * 2, leading=S['title'].leading * 2),
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Priority Pack Tracker',
        _inner_ps('cov_h2', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 5))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f'{total_qs} questions  ·  {n_packs} packs  ·  High → Mid → Low',
        _inner_ps('cov_stats', 'body', alignment=TA_CENTER),
    ))
    story.append(Paragraph(
        'Each pack: Easy → Medium → Hard',
        _inner_ps('cov_order', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        'Tick each question as you solve it — checkboxes sync across the PDF',
        _inner_ps('cov_sites', 'body_sm', alignment=TA_CENTER),
    ))
    story.append(PageBreak())

    # ── Pack size order — largest → smallest within each priority ─────────────
    build_pack_size_roster(story, sections)

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

        print('Adding pack size roster checkboxes…')
        _add_pack_size_roster_checkboxes(imposed_tmp)

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

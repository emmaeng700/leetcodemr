#!/usr/bin/env python3
"""
generate_mega_splits.py
One single PDF containing all 138 study-split sections in study order:
  High (S1→S2→S3, Easy→Med→Hard) → Mid (S1→S2→S3) → Low (S1→S2→S3)

Structure per section (mirrors generate_study_splits.py per-split structure):
  Cover page  → Mega overview  → [per section: mini-TOC → banner → patterns → questions]

"← Contents" links land on the first mini-TOC (Section 1 = High S1 Easy).
Full interactive pipeline: TOC arrows, ← Contents, ← Prev / → Next,
Next Sec → (jumps to the next of the 138 pattern sections).

Output: ~/Desktop/pdf study splits/Study Splits/00 ALL Splits.pdf
"""

import sys as _sys
import os, re, json, tempfile, shutil
from pathlib import Path
from collections import defaultdict

import fitz  # PyMuPDF — used for inline QID links on overview pages

from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

_orig_argv = _sys.argv[:]
_sys.argv = [_sys.argv[0], '--all']
from generate_better_pdf import (
    build_question_block, _impose_1up, _analyze_inner_for_links, _add_links_1x1,
    S, USE_W, USE_H, MP_W, MP_H, MG, hr, _inner_ps, safe_xml,
    PageCounter, RoundPageMark, PatPageMark, PRIORITY_COLORS,
    SITES_CACHE, DOOCS_CACHE, TOC_CB_PT, TOC_CB_GAP, load_my_solutions,
)
from generate_patterns_pdf import QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load
_sys.argv = _orig_argv

SCRIPT_DIR = Path(__file__).parent
GRIND_JSON = SCRIPT_DIR / 'public' / 'grind_questions.json'
OUTPUT_DIR = Path.home() / 'Desktop' / 'pdf study splits' / 'Study Splits'
OUTPUT_FILE = OUTPUT_DIR / '00 ALL Splits.pdf'

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
PRIORITY_HEX = {'High': '#EF4444', 'Mid': '#EAB308', 'Low': '#6366F1'}
DIFF_COL     = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}
DIFF_ABBREV  = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}
GRAY_300     = HexColor('#D1D5DB')


def build_sections(questions: list) -> list:
    """
    Returns [(round_num, priority, diff, set_num, [(pat_obj, qs)]), ...]
    in study order: High(S1→S2→S3, Easy→Med→Hard) → Mid → Low.
    Questions within each group sorted by ID.
    """
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


def build_qid_to_sec_field(sections: list) -> dict:
    """Map each question id → shared ln_sec_* checkbox field name.
    Same formula used by generate_splits_contents.py so ticks sync across PDFs."""
    out = {}
    for _rn, priority, diff, set_num, pat_groups in sections:
        tier = f'{priority[0]}{DIFF_ABBREV.get(diff, diff[:1])}'
        for pat_obj, qs in pat_groups:
            abbr  = PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name'])
            field = f'ln_sec_{abbr}_S{set_num}_{tier}_{len(qs)}q'
            for q in qs:
                out[int(q['id'])] = field
    return out


def _build_mega_inner(
    sections: list, sites_cache: dict, doocs_cache: dict, inner_path: Path,
    my_solutions: dict | None = None,
) -> tuple[dict, dict]:
    """
    Build the mega inner mini-page PDF.
    Structure per section mirrors generate_study_splits.py:
      mini-TOC page  →  section banner page  →  pattern banner + questions
    Returns (round_page_registry, pat_page_registry).
    """
    round_page_registry: dict = {}
    pat_page_registry:   dict = {}

    total_qs     = sum(len(qs) for _, _, _, _, pgs in sections for _, qs in pgs)
    total_rounds = len(sections)

    doc = SimpleDocTemplate(
        str(inner_path), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    DIFF_DC = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}

    # ── Cover ─────────────────────────────────────────────────────────────────
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
        f'{total_qs} questions  ·  {total_rounds} sections  ·  3 Sets  ·  9 Tiers',
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

    # ── Master TOC (needle format so analyzer adds clickable links) ─────────────
    # Each round emits: 'Round N  |  Priority' + per-pattern '{name} ({count})'
    # + question IDs so the page qualifies as a real TOC page (>=5 QIDs + marker).
    story.append(Paragraph('<b>Contents</b>',
                           _inner_ps('ov_title', 'title', spaceAfter=3)))
    story.append(hr(GRAY_300, 0.4))
    cur_pri, cur_s = None, None
    for rn, priority, diff, set_num, pat_groups in sections:
        n_qs = sum(len(qs) for _, qs in pat_groups)
        # Visual group header
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

        # Round needle — 'Round {rn}  |  {priority}' is what _analyze_inner_for_links
        # searches for. Extra text after it is fine (search_for finds substrings).
        story.append(Paragraph(
            f'<b>Round {rn}  |  {priority}</b>'
            f'  <font color="{DIFF_COL[diff]}">{diff}</font>  S{set_num}  ({n_qs}q)',
            _inner_ps(f'ov_r{rn}', 'body', spaceBefore=2),
        ))
        # Pattern needle + inline question IDs (QIDs make the page qualify as TOC)
        for pat_obj, qs in pat_groups:
            pat_hex = pat_obj['hex']
            # Pattern needle: '{name} ({count})' must appear as literal text
            story.append(Paragraph(
                f'  <font color="{pat_hex}"><b>'
                f'{safe_xml(pat_obj["name"])}</b></font> ({len(qs)})'
                f'  <font color="#6B7280">'
                + '  '.join(f'#{q["id"]}' for q in qs) + '</font>',
                _inner_ps(f'ov_p{rn}_{pat_obj["name"][:6]}', 'body_sm', spaceAfter=1),
            ))
    story.append(PageBreak())

    # ── Per-section: round banner → (per-pattern: mini-TOC + banner + questions) ─
    for rn, priority, diff, set_num, pat_groups in sections:
        n_qs    = sum(len(qs) for _, qs in pat_groups)
        pri_hex = PRIORITY_HEX[priority]

        # ── Round overview banner (chapter page) ──────────────────────────────
        story.append(RoundPageMark(rn, round_page_registry))
        # Invisible marker — tells _analyze_inner_for_links to always classify
        # this page as 'chapter' even when prev_was_toc is True.
        story.append(Paragraph('##RNDBNR##',
            _inner_ps(f'rndm{rn}', 'body', fontSize=5, textColor=white,
                      spaceBefore=0, spaceAfter=0)))
        story.append(Spacer(1, USE_H * 0.08))

        round_banner = Table([[Paragraph(
            f'<font color="white"><b>Set {set_num}  ·  {priority}  ·  {diff}</b>'
            f'  <font size="{S["body_sm"].fontSize}">— Round {rn}</font></font>',
            _inner_ps(f'rbn{rn}', 'title', alignment=TA_CENTER, textColor=white),
        )]], colWidths=[USE_W])
        round_banner.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
            ('TOPPADDING',    (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(round_banner)
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f'{n_qs} question{"s" if n_qs != 1 else ""}  ·  '
            f'{len(pat_groups)} pattern{"s" if len(pat_groups) != 1 else ""}',
            _inner_ps(f'rct{rn}', 'body', alignment=TA_CENTER),
        ))
        story.append(Spacer(1, 4))
        story.append(hr(GRAY_300, 0.4))

        for pat_obj, qs in pat_groups:
            q_ids = '  '.join(f'#{q["id"]}' for q in qs)
            story.append(Paragraph(
                f'<b><font color="{pat_obj["hex"]}">'
                f'{safe_xml(pat_obj["name"])}</font></b>  {safe_xml(q_ids)}',
                _inner_ps(f'rspl{rn}_{pat_obj["name"][:6]}', 'body', spaceAfter=2),
            ))
        story.append(PageBreak())

        # ── Per-pattern: mini-TOC → banner → questions ────────────────────────
        for pat_obj, qs in pat_groups:
            pat_hex  = pat_obj['hex']
            pat_name = pat_obj['name']
            pat_abbr = PATTERN_ABBREV.get(pat_name, pat_name)

            # Per-pattern mini-TOC page (one per pattern, not shared across patterns).
            # Needles for _analyze_inner_for_links:
            #   round needle  : 'Round {rn}  |  {priority}'  (two spaces each side of |)
            #   pattern needle: '{pattern_name} ({count})'
            story.append(Paragraph(
                f'<b>Round {rn}  |  {priority}</b>'
                f'  <font color="{DIFF_COL[diff]}">{diff}</font>  ·  S{set_num}',
                _inner_ps(f'toc_rnd{rn}_{pat_name[:6]}', 'title'),
            ))
            story.append(Spacer(1, 2))
            story.append(Paragraph(
                f'<b><font color="{pat_hex}">— {safe_xml(pat_name)} ({len(qs)}) —</font></b>',
                _inner_ps(f'toc_ph{rn}_{pat_name[:6]}', 'body_sm', spaceBefore=3, spaceAfter=1),
            ))
            for q in qs:
                d  = q.get('difficulty', '')
                dc = DIFF_DC.get(d, '#6B7280')
                story.append(Paragraph(
                    f'<b>#{q["id"]} {safe_xml(q["title"])}</b>'
                    f'  <font color="{dc}">[{d[:3].upper()}]</font>',
                    _inner_ps(f'toc_e{rn}_{q["id"]}', 'body', spaceAfter=2),
                ))
            story.append(PageBreak())

            # ── Pattern banner page ───────────────────────────────────────────
            story.append(PatPageMark(rn, pat_name, pat_page_registry))

            pat_banner = Table([[Paragraph(
                f'<font color="white"><b>{safe_xml(pat_name)}</b>'
                f'  <font size="{S["body_sm"].fontSize}">'
                f'— S{set_num} {priority} {DIFF_ABBREV[diff]}  ·  {len(qs)}q</font></font>',
                _inner_ps(f'pbn{rn}_{pat_name[:6]}', 'head2', textColor=white),
            )]], colWidths=[USE_W])
            pat_banner.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pat_hex)),
                ('TOPPADDING',    (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING',   (0, 0), (-1, -1), 6),
            ]))
            story += [pat_banner, Spacer(1, 4)]

            q_ids = '  '.join(f'#{q["id"]}' for q in qs)
            story.append(Paragraph(
                f'<b>{safe_xml(pat_name)}</b>  {safe_xml(q_ids)}',
                _inner_ps(f'pids{rn}_{pat_name[:6]}', 'body'),
            ))
            story.append(PageBreak())

            for i, q in enumerate(qs, 1):
                story += build_question_block(
                    q, sites_cache, doocs_cache,
                    pattern_name=pat_name,
                    pattern_obj=pat_obj,
                    my_solutions=my_solutions,
                )
                if i % 5 == 0:
                    print(f'      {i}/{len(qs)} q  [{pat_abbr} S{set_num} {priority} {DIFF_ABBREV[diff]}]')

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    print(f'  Building inner PDF ({total_qs}q across {total_rounds} sections)…')
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'  Inner PDF done: {counter.n} mini-pages')
    return round_page_registry, pat_page_registry


def _add_qid_links_on_banner_pages(
    pdf_path: Path, skip_pages: set, qid_first_page: dict
):
    """
    Add word-level #N GOTO links on every page NOT already handled by
    _add_overview_qid_links (i.e. pattern banner pages, round chapter pages,
    per-pattern mini-TOC pages).  Skips pages in skip_pages and any QID with
    no known destination.
    """
    qid_re = re.compile(r'^#(\d+)$')
    doc = fitz.open(str(pdf_path))
    n_links = 0
    for pg_idx in range(len(doc)):
        if pg_idx in skip_pages:
            continue
        page = doc[pg_idx]
        for x0, y0, x1, y1, word, *_ in page.get_text('words'):
            m = qid_re.match(word.strip())
            if not m:
                continue
            qid = int(m.group(1))
            dest = qid_first_page.get(qid)
            if dest is None:
                continue
            page.insert_link({
                'kind': fitz.LINK_GOTO,
                'from': fitz.Rect(x0, y0, x1, y1),
                'page': dest,
                'to':   fitz.Point(0, 0),
                'zoom': 0,
            })
            n_links += 1
    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_links} banner/mini-TOC QID links added')


def _add_overview_qid_links(pdf_path: Path, overview_pages: set,
                            qid_first_page: dict, overview_toc_rects: dict,
                            sec_field_by_qid: dict | None = None):
    """
    On each master Contents page:
      • Make every inline #N token a direct clickable link to that question.
      • Draw one checkbox to the left of each pattern line (deduped by y-position).

    If sec_field_by_qid is provided, checkbox field names use those shared section
    names (e.g. ln_sec_A&H_S1_HH_1q) so ticks sync with Size Roster pages.
    """
    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    ox = (cw - src_w * sc) / 2
    oy = (ch - src_h * sc) / 2
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    def tx(r):
        return fitz.Rect(GAP + ox + r.x0 * sc, GAP + oy + r.y0 * sc,
                         GAP + ox + r.x1 * sc, GAP + oy + r.y1 * sc)

    qid_re  = re.compile(r'^#(\d+)$')
    all_ids = set(qid_first_page.keys())

    doc = fitz.open(str(pdf_path))
    n_links = n_boxes = 0

    for pg_idx in overview_pages:
        page = doc[pg_idx]

        # Inline #N direct links
        for x0, y0, x1, y1, word, *_ in page.get_text('words'):
            m = qid_re.match(word.strip())
            if not m:
                continue
            qid = int(m.group(1))
            if qid not in all_ids:
                continue
            dest = qid_first_page.get(qid)
            if dest is None:
                continue
            page.insert_link({
                'kind': fitz.LINK_GOTO,
                'from': fitz.Rect(x0, y0, x1, y1),
                'page': dest,
                'to':   fitz.Point(0, 0),
                'zoom': 0,
            })
            n_links += 1

        # One checkbox per unique pattern line (deduped by y)
        rects = overview_toc_rects.get(pg_idx, {})
        seen_y: set = set()
        for qid, rect_info in rects.items():
            line_dest = tx(rect_info['line'])
            y_key = round(line_dest.y0, 1)
            if y_key in seen_y:
                continue
            seen_y.add(y_key)
            cb_y0 = line_dest.y0 + (line_dest.height - cb_h) / 2
            cb_x1 = line_dest.x0 - gap
            cb_x0 = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                           fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd = fitz.Widget()
            wd.rect        = cb_rect
            wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            if sec_field_by_qid and qid in sec_field_by_qid:
                wd.field_name = sec_field_by_qid[qid]
            else:
                wd.field_name = f'ov_done_{pg_idx}_{qid}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            page.add_widget(wd)
            n_boxes += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_links} inline QID links  |  {n_boxes} overview checkboxes added')


def main():
    if not GRIND_JSON.exists():
        raise SystemExit(f'✗ Not found: {GRIND_JSON}')

    with open(GRIND_JSON) as f:
        questions = json.load(f)
    print(f'Loaded {len(questions)} questions\n')

    sites_cache  = _load(SITES_CACHE) if SITES_CACHE.exists() else {}
    doocs_cache  = _load(DOOCS_CACHE) if DOOCS_CACHE.exists() else {}
    my_solutions = load_my_solutions()
    print(f'Caches: {len(sites_cache)} sites, {len(doocs_cache)} doocs\n')

    sections = build_sections(questions)
    total_qs = sum(len(qs) for _, _, _, _, pgs in sections for _, qs in pgs)
    print(f'{len(sections)} sections  ·  {total_qs} questions\n')
    for rn, pri, diff, s, pgs in sections:
        print(f'  Round {rn:02d}: S{s} {pri} {diff}  '
              f'({sum(len(q) for _, q in pgs)}q  ·  '
              f'{", ".join(PATTERN_ABBREV.get(po["name"], po["name"]) for po, _ in pgs)})')
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}

    # Use local temp paths to avoid iCloud write timeouts; move to Desktop at end.
    SCRATCHPAD = Path(tempfile.gettempdir())
    inner_path  = SCRATCHPAD / '_mega_splits_inner.pdf'
    imposed_tmp = SCRATCHPAD / '_mega_splits_imposed.pdf'

    try:
        round_page_registry, pat_page_registry = _build_mega_inner(
            sections, sites_cache, doocs_cache, inner_path, my_solutions,
        )

        if not inner_path.exists() or inner_path.stat().st_size == 0:
            raise RuntimeError(f'Inner PDF missing or empty after build: {inner_path}')
        print('\n  Imposing 1×1…')
        _impose_1up(inner_path, imposed_tmp)

        print('  Analyzing links…')
        rounds_struct = [(rn, pri, diff, pgs) for rn, pri, diff, s, pgs in sections]
        page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page = \
            _analyze_inner_for_links(inner_path, rounds_struct)

        # Master Contents lists many Rounds per page; each section mini-TOC has one.
        # Do NOT use (banner_page - 1): multi-page mini-TOCs put the first page
        # before that cutoff and wrongly strip its per-question checkboxes.
        overview_pages = {
            pg for pg, secs in toc_section_rects.items()
            if sum(1 for kind, _, _ in secs if kind == 'round') >= 2
        }

        # Keep overview rects to draw checkboxes later; strip from the main
        # pass so _add_links_1x1 doesn't place overlapping ↗ arrows there.
        overview_toc_rects = {pg: v for pg, v in toc_link_rects.items()
                              if pg in overview_pages}
        toc_link_rects_sections = {pg: v for pg, v in toc_link_rects.items()
                                   if pg not in overview_pages}

        print('  Adding interactive features…')
        _add_links_1x1(
            imposed_tmp, page_types, qid_first_page,
            toc_link_rects_sections, toc_section_rects,
            round_page_registry, pat_page_registry,
            qid_difficulty=qid_difficulty,
            qid_to_slug=qid_to_slug,
            ia_first_page=ia_first_page,
        )

        # Add word-level #N links on the master Contents pages so each inline
        # QID token (e.g. #1, #163) is directly clickable → jumps to that question.
        if overview_pages:
            print(f'  Adding inline QID links + checkboxes on {len(overview_pages)} overview page(s)…')
            sec_fields = build_qid_to_sec_field(sections)
            _add_overview_qid_links(
                imposed_tmp, overview_pages, qid_first_page,
                overview_toc_rects, sec_field_by_qid=sec_fields,
            )

        print('  Adding QID links on banner/mini-TOC pages…')
        _add_qid_links_on_banner_pages(imposed_tmp, overview_pages, qid_first_page)

        print(f'  Moving to output folder…')
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.move(str(imposed_tmp), str(OUTPUT_FILE))

        kb = os.path.getsize(OUTPUT_FILE) // 1024
        print(f'\n🎉  Done!  {OUTPUT_FILE.name}  ({kb:,} KB)\n→  {OUTPUT_FILE}')

    finally:
        inner_path.unlink(missing_ok=True)
        imposed_tmp.unlink(missing_ok=True)


if __name__ == '__main__':
    main()

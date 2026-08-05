#!/usr/bin/env python3
"""
generate_mega_packs.py
Generate 21 individual Priority Pack PDFs, one per pattern × priority.
Same interactive features as 00 ALL Splits.pdf:
  ↗ arrows, checkboxes, difficulty dots, Done, ← Contents, Next/Prev,
  solution checkboxes, URI links.

Output: ~/Desktop/pdf study splits/Priority Packs/NN Abbr · Priority · Nq.pdf
"""

import sys as _sys
import os, re, json, tempfile, shutil
from pathlib import Path
from collections import defaultdict

import fitz  # PyMuPDF

from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER

_orig_argv = _sys.argv[:]
_sys.argv = [_sys.argv[0], '--all']
from generate_better_pdf import (
    build_question_block, build_section_complete_page, build_study_order_page,
    PACK_STUDY_ORDER,
    _impose_1up, _analyze_inner_for_links, _add_links_1x1,
    S, USE_W, USE_H, MP_W, MP_H, MG, hr, _inner_ps, safe_xml,
    PageCounter, RoundPageMark, PatPageMark,
    TOC_CB_PT, TOC_CB_GAP,
    SITES_CACHE, DOOCS_CACHE, load_my_solutions,
)

_SO_NAMES = [e[1] for e in PACK_STUDY_ORDER]
_SO_HEX   = [e[2] for e in PACK_STUDY_ORDER]
from generate_patterns_pdf import QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load
_sys.argv = _orig_argv

SCRIPT_DIR = Path(__file__).parent
GRIND_JSON  = SCRIPT_DIR / 'public' / 'grind_questions.json'
OUTPUT_DIR  = Path.home() / 'Desktop' / 'pdf study splits' / 'Priority Packs'

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
DIFF_KEY     = {'Easy': 0, 'Medium': 1, 'Hard': 2}
GRAY_300     = HexColor('#D1D5DB')


def build_sections(questions: list) -> list:
    """Returns [(rn, priority, pat_obj, qs), ...] — 21 sections.
    Order: High → Mid → Low, within each priority sorted largest pack first.
    Questions sorted: difficulty(Easy→Med→Hard) → id."""
    bucket: dict = defaultdict(list)
    for q in questions:
        section = q.get('section') or ''
        pat = q.get('pattern')
        m = re.match(r'^(High|Mid|Low)', section)
        if not m or not pat:
            continue
        bucket[(m.group(1), pat)].append(q)

    sections, rn = [], 0
    for priority in ['High', 'Mid', 'Low']:
        pri_pats = [(pat, bucket[(priority, pat)])
                    for pat in PATTERN_ORDER if bucket.get((priority, pat))]
        pri_pats.sort(key=lambda x: -len(x[1]))  # largest pack first
        for pat, raw_qs in pri_pats:
            qs_sorted = sorted(raw_qs, key=lambda q: (
                DIFF_KEY.get(q.get('difficulty', 'Easy'), 0),
                q.get('id', 0),
            ))
            obj = PAT_OBJ.get(pat, {'name': pat, 'hex': PAT_COLOR.get(pat, '#6366F1')})
            rn += 1
            sections.append((rn, priority, obj, qs_sorted))
    return sections


def _build_pack_inner(rn, priority, pat_obj, qs, sites_cache, doocs_cache, inner_path, my_solutions=None):
    """Build inner mini-page PDF for a single priority pack."""
    round_page_registry: dict = {}
    pat_page_registry:   dict = {}

    n_qs     = len(qs)
    pat_name = pat_obj['name']
    pat_hex  = pat_obj['hex']
    pat_abbr = PATTERN_ABBREV.get(pat_name, pat_name)
    pri_hex  = PRIORITY_HEX[priority]

    diff_counts = {d: sum(1 for q in qs if q.get('difficulty') == d)
                   for d in ['Easy', 'Medium', 'Hard']}
    set_counts  = {s: sum(1 for q in qs if q.get('set', 1) == s)
                   for s in [1, 2, 3]}

    doc = SimpleDocTemplate(
        str(inner_path), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    # ── Cover page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.06))
    cov_banner = Table([[Paragraph(
        f'<font color="white"><b>{safe_xml(pat_name)}</b></font>',
        _inner_ps(f'cov_h1_{rn}', 'title', alignment=TA_CENTER,
                  fontSize=S['title'].fontSize * 1.4,
                  leading=S['title'].leading * 1.4),
    )]], colWidths=[USE_W])
    cov_banner.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(cov_banner)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f'Pack {rn:02d}  ·  {priority} Priority',
        _inner_ps(f'cov_sub_{rn}', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 4))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f'{n_qs} questions',
        _inner_ps(f'cov_n_{rn}', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 3))
    diff_str = '  ·  '.join(
        f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
        for d, c in diff_counts.items() if c
    )
    story.append(Paragraph(diff_str, _inner_ps(f'cov_d_{rn}', 'body', alignment=TA_CENTER)))
    story.append(Paragraph(
        '  ·  '.join(f'S{s}: {c}' for s, c in set_counts.items() if c),
        _inner_ps(f'cov_s_{rn}', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 6))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'WalkCC · LeetDoocs · SimplyLeet · LC.ca  ·  Python',
        _inner_ps(f'cov_sites_{rn}', 'body_sm', alignment=TA_CENTER),
    ))
    story.append(PageBreak())
    story += build_study_order_page(pat_name)

    # ── Mini-TOC page ─────────────────────────────────────────────────────────
    # Needle line that _analyze_inner_for_links looks for: "Round N  |  Priority"
    story.append(Paragraph(
        f'<b>Round {rn}  |  {priority}</b>'
        f'  <font color="{pat_hex}">{safe_xml(pat_name)}</font>',
        _inner_ps(f'toc_rnd{rn}', 'title'),
    ))
    story.append(Spacer(1, 2))

    # Pattern header needle: "PatternName (N)"
    story.append(Paragraph(
        f'<b><font color="{pat_hex}">{safe_xml(pat_name)}</font>'
        f' ({n_qs})</b>',
        _inner_ps(f'toc_ph{rn}', 'head2'),
    ))
    story.append(hr(GRAY_300, 0.4))

    # Stat line
    diff_parts = [f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
                  for d, c in diff_counts.items() if c]
    set_parts  = [f'S{s}: {c}' for s, c in set_counts.items() if c]
    story.append(Paragraph(
        '  ·  '.join(diff_parts) + '     ' + '  ·  '.join(set_parts),
        _inner_ps(f'toc_stat{rn}', 'body_sm', spaceAfter=3),
    ))

    # Question list, grouped by set
    cur_set = None
    for q in qs:
        s = q.get('set', 1)
        if s != cur_set:
            cur_set = s
            story.append(Paragraph(
                f'<b><font color="#6B7280">— Set {s} —</font></b>',
                _inner_ps(f'toc_s{rn}_{s}', 'body_sm', spaceBefore=3, spaceAfter=1),
            ))
        d = q.get('difficulty', '')
        dc = DIFF_COL.get(d, '#6B7280')
        story.append(Paragraph(
            f'<b>#{q["id"]} {safe_xml(q["title"])}</b>'
            f'  <font color="{dc}">[{d[:3].upper()}]</font>',
            _inner_ps(f'toc_e{rn}_{q["id"]}', 'body', spaceAfter=2),
        ))

    story.append(PageBreak())

    # ── Single section banner (Round == Pattern in packs — don't duplicate) ──
    story.append(RoundPageMark(rn, round_page_registry))
    story.append(PatPageMark(rn, pat_name, pat_page_registry))
    story.append(Spacer(1, USE_H * 0.08))

    round_banner = Table([[Paragraph(
        f'<font color="white"><b>{safe_xml(pat_name)}</b>'
        f'  <font size="{S["body_sm"].fontSize}">'
        f'— {priority}  ·  {n_qs}q  ·  Round {rn}</font></font>',
        _inner_ps(f'rbn{rn}', 'title', alignment=TA_CENTER, textColor=white),
    )]], colWidths=[USE_W])
    round_banner.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(round_banner)
    story.append(Spacer(1, 4))

    diff_line = '  ·  '.join(
        f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
        for d, c in diff_counts.items() if c
    )
    story.append(Paragraph(diff_line, _inner_ps(f'rdf{rn}', 'body', alignment=TA_CENTER)))
    story.append(Paragraph(
        '  ·  '.join(f'S{s}: {c}' for s, c in set_counts.items() if c),
        _inner_ps(f'rsc{rn}', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 4))
    story.append(hr(GRAY_300, 0.4))

    # All question IDs as a single flat line
    q_ids = '  '.join(f'#{q["id"]}' for q in qs)
    story.append(Paragraph(
        f'<font color="#6B7280">{safe_xml(q_ids)}</font>',
        _inner_ps(f'rspl_ids{rn}', 'body_sm', spaceAfter=2),
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
            print(f'      {i}/{n_qs} q  [{pat_abbr} {priority}]')
    try:
        _so_i = _SO_NAMES.index(pat_name)
        _nxt_name = _SO_NAMES[_so_i + 1] if _so_i + 1 < len(_SO_NAMES) else None
        _nxt_hex  = _SO_HEX[_so_i + 1]  if _so_i + 1 < len(_SO_HEX)   else None
    except ValueError:
        _nxt_name = _nxt_hex = None
    story += build_section_complete_page(pat_name, n_qs, pat_hex=pat_hex,
                                         next_pat_name=_nxt_name, next_pat_hex=_nxt_hex)

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'  Inner PDF: {counter.n} mini-pages')
    return round_page_registry, pat_page_registry


def _build_all_packs_inner(sections, sites_cache, doocs_cache, inner_path, my_solutions=None):
    """Build combined inner mini-page PDF: cover + master contents + all 21 sections."""
    round_page_registry: dict = {}
    pat_page_registry:   dict = {}

    total_qs    = sum(len(qs) for _, _, _, qs in sections)
    total_packs = len(sections)
    high_qs = sum(len(qs) for _, pri, _, qs in sections if pri == 'High')
    mid_qs  = sum(len(qs) for _, pri, _, qs in sections if pri == 'Mid')
    low_qs  = sum(len(qs) for _, pri, _, qs in sections if pri == 'Low')

    doc = SimpleDocTemplate(
        str(inner_path), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG, topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.08))
    story.append(Paragraph(
        '<b>ALL PACKS</b>',
        _inner_ps('ap_h1', 'title', alignment=TA_CENTER,
                  fontSize=S['title'].fontSize * 2,
                  leading=S['title'].leading * 2),
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Complete Priority Pack Collection',
        _inner_ps('ap_h2', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 5))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f'{total_qs} questions  ·  {total_packs} packs  ·  All Sets  ·  All Difficulties',
        _inner_ps('ap_stats', 'body', alignment=TA_CENTER),
    ))
    story.append(Paragraph(
        f'<font color="{PRIORITY_HEX["High"]}">High: {high_qs}q</font>'
        f'  ·  <font color="{PRIORITY_HEX["Mid"]}">Mid: {mid_qs}q</font>'
        f'  ·  <font color="{PRIORITY_HEX["Low"]}">Low: {low_qs}q</font>',
        _inner_ps('ap_pri', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        'WalkCC · LeetDoocs · SimplyLeet · LC.ca  ·  Python',
        _inner_ps('ap_sites', 'body_sm', alignment=TA_CENTER),
    ))
    story.append(PageBreak())
    story += build_study_order_page()

    # ── Master Contents (overview pages) ───────────────────────────────────────
    # Each pack gets two lines:
    #   "Round N  |  Priority  PatternName  (Nq)"  ← round needle for analysis
    #   "  PatternName (N)  #1 #163 ..."           ← pattern needle + inline QIDs
    story.append(Paragraph(
        '<b>Contents</b>',
        _inner_ps('ap_ov_title', 'title', spaceAfter=3),
    ))
    story.append(hr(GRAY_300, 0.4))

    cur_pri = None
    for rn, priority, pat_obj, qs in sections:
        pat_hex  = pat_obj['hex']
        pat_name = pat_obj['name']

        if priority != cur_pri:
            cur_pri = priority
            story.append(Spacer(1, 3))
            grp = Table([[Paragraph(
                f'<font color="white"><b>{priority} Priority</b></font>',
                _inner_ps(f'ap_g_{priority}', 'body', alignment=TA_CENTER, textColor=white),
            )]], colWidths=[USE_W])
            grp.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, -1), HexColor(PRIORITY_HEX[priority])),
                ('TOPPADDING',    (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            story.append(grp)

        # Round needle line (detected by _analyze_inner_for_links)
        story.append(Paragraph(
            f'<b>Round {rn}  |  {priority}</b>'
            f'  <font color="{pat_hex}">{safe_xml(pat_name)}</font>'
            f'  ({len(qs)}q)',
            _inner_ps(f'ap_rnd{rn}', 'body', spaceBefore=2),
        ))
        # Pattern needle + inline QIDs
        q_ids = '  '.join(f'#{q["id"]}' for q in qs)
        story.append(Paragraph(
            f'  <font color="{pat_hex}"><b>{safe_xml(pat_name)}</b></font>'
            f' ({len(qs)})'
            f'  <font color="#6B7280">{safe_xml(q_ids)}</font>',
            _inner_ps(f'ap_pat{rn}', 'body_sm', spaceAfter=1),
        ))

    story.append(PageBreak())

    # ── Per-section: mini-TOC + banners + questions ────────────────────────────
    for _sec_i, (rn, priority, pat_obj, qs) in enumerate(sections):
        n_qs     = len(qs)
        pat_name = pat_obj['name']
        pat_hex  = pat_obj['hex']
        pat_abbr = PATTERN_ABBREV.get(pat_name, pat_name)
        pri_hex  = PRIORITY_HEX[priority]

        diff_counts = {d: sum(1 for q in qs if q.get('difficulty') == d)
                       for d in ['Easy', 'Medium', 'Hard']}
        set_counts  = {s: sum(1 for q in qs if q.get('set', 1) == s)
                       for s in [1, 2, 3]}

        # Mini-TOC (round needle detected here too)
        story.append(Paragraph(
            f'<b>Round {rn}  |  {priority}</b>'
            f'  <font color="{pat_hex}">{safe_xml(pat_name)}</font>',
            _inner_ps(f'ap_toc_rnd{rn}', 'title'),
        ))
        story.append(Spacer(1, 2))
        story.append(Paragraph(
            f'<b><font color="{pat_hex}">{safe_xml(pat_name)}</font>'
            f' ({n_qs})</b>',
            _inner_ps(f'ap_toc_ph{rn}', 'head2'),
        ))
        story.append(hr(GRAY_300, 0.4))
        diff_parts = [f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
                      for d, c in diff_counts.items() if c]
        set_parts  = [f'S{s}: {c}' for s, c in set_counts.items() if c]
        story.append(Paragraph(
            '  ·  '.join(diff_parts) + '     ' + '  ·  '.join(set_parts),
            _inner_ps(f'ap_toc_stat{rn}', 'body_sm', spaceAfter=3),
        ))
        # Question list, grouped by set
        cur_set = None
        for q in qs:
            s = q.get('set', 1)
            if s != cur_set:
                cur_set = s
                story.append(Paragraph(
                    f'<b><font color="#6B7280">— Set {s} —</font></b>',
                    _inner_ps(f'ap_toc_s{rn}_{s}', 'body_sm', spaceBefore=3, spaceAfter=1),
                ))
            d = q.get('difficulty', '')
            dc = DIFF_COL.get(d, '#6B7280')
            story.append(Paragraph(
                f'<b>#{q["id"]} {safe_xml(q["title"])}</b>'
                f'  <font color="{dc}">[{d[:3].upper()}]</font>',
                _inner_ps(f'ap_toc_e{rn}_{q["id"]}', 'body', spaceAfter=2),
            ))
        story.append(PageBreak())

        # Single section banner (Round == Pattern in packs — don't duplicate)
        story.append(RoundPageMark(rn, round_page_registry))
        story.append(PatPageMark(rn, pat_name, pat_page_registry))
        story.append(Spacer(1, USE_H * 0.08))
        round_banner = Table([[Paragraph(
            f'<font color="white"><b>{safe_xml(pat_name)}</b>'
            f'  <font size="{S["body_sm"].fontSize}">'
            f'— {priority}  ·  {n_qs}q  ·  Round {rn}</font></font>',
            _inner_ps(f'ap_rbn{rn}', 'title', alignment=TA_CENTER, textColor=white),
        )]], colWidths=[USE_W])
        round_banner.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
            ('TOPPADDING',    (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(round_banner)
        story.append(Spacer(1, 4))
        diff_line = '  ·  '.join(
            f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
            for d, c in diff_counts.items() if c
        )
        story.append(Paragraph(diff_line, _inner_ps(f'ap_rdf{rn}', 'body', alignment=TA_CENTER)))
        story.append(Paragraph(
            '  ·  '.join(f'S{s}: {c}' for s, c in set_counts.items() if c),
            _inner_ps(f'ap_rsc{rn}', 'body', alignment=TA_CENTER),
        ))
        story.append(Spacer(1, 4))
        story.append(hr(GRAY_300, 0.4))

        # All question IDs as a single flat line
        q_ids = '  '.join(f'#{q["id"]}' for q in qs)
        story.append(Paragraph(
            f'<font color="#6B7280">{safe_xml(q_ids)}</font>',
            _inner_ps(f'ap_rspl_ids{rn}', 'body_sm', spaceAfter=2),
        ))
        story.append(PageBreak())

        for i, q in enumerate(qs, 1):
            story += build_question_block(
                q, sites_cache, doocs_cache,
                pattern_name=pat_name, pattern_obj=pat_obj, my_solutions=my_solutions,
            )
            if i % 5 == 0:
                print(f'      {i}/{n_qs} q  [{pat_abbr} {priority}]')
        _nxt_s = sections[_sec_i + 1] if _sec_i + 1 < len(sections) else None
        story += build_section_complete_page(
            pat_name, n_qs, pat_hex=pat_hex,
            next_pat_name=_nxt_s[2]['name'] if _nxt_s else None,
            next_pat_hex=_nxt_s[2]['hex']  if _nxt_s else None,
        )

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    print(f'  Building inner PDF ({total_qs}q across {total_packs} packs)…')
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'  Inner PDF done: {counter.n} mini-pages')
    return round_page_registry, pat_page_registry


def _add_overview_qid_links_packs(pdf_path, overview_pages, qid_first_page,
                                  overview_toc_rects, round_page_registry=None):
    """Add inline #N links + one checkbox + one ↗ per Round on master Contents pages."""
    GAP, src_w, src_h, L_W, L_H = 8.0, 204.0, 264.0, 612.0, 792.0
    cw = L_W - 2 * GAP;  ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    ox = (cw - src_w * sc) / 2;  oy = (ch - src_h * sc) / 2
    cb_h = TOC_CB_PT * sc;  gap = TOC_CB_GAP * sc
    round_page_registry = round_page_registry or {}

    qid_re = re.compile(r'^#(\d+)$')
    round_re = re.compile(r'^Round$')
    all_ids = set(qid_first_page.keys())

    def draw_round_arrow(page, line_y0, line_y1, dest_page):
        """One far-right ↗ for the Round header (same geometry as _add_links_1x1)."""
        from generate_better_pdf import TOC_ARROW_PAD, _draw_toc_goto_arrow
        sz = TOC_CB_PT * sc
        pad = TOC_ARROW_PAD * sc
        tap = max(sz * 1.6, 16.0)
        cx = L_W - GAP - tap / 2 - 2
        anchor = fitz.Rect(40, line_y0, cx - pad - sz * 0.55, line_y1)
        arrow_rect = _draw_toc_goto_arrow(page, anchor, sc)
        page.insert_link({
            'kind': fitz.LINK_GOTO, 'from': arrow_rect,
            'page': dest_page, 'to': fitz.Point(0, 0), 'zoom': 0,
        })
        return arrow_rect

    doc = fitz.open(str(pdf_path))
    n_links = n_boxes = n_arrows = 0

    for pg_idx in overview_pages:
        page = doc[pg_idx]
        words = list(page.get_text('words'))

        # Inline #N direct links
        for x0, y0, x1, y1, word, *_ in words:
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
                'kind': fitz.LINK_GOTO, 'from': fitz.Rect(x0, y0, x1, y1),
                'page': dest, 'to': fitz.Point(0, 0), 'zoom': 0,
            })
            n_links += 1

        # One checkbox + one ↗ per Round header only.
        seen_round: set = set()
        for x0, y0, x1, y1, word, block, line, *_rest in words:
            if not round_re.match(word.strip()):
                continue
            rn = None
            for x0b, y0b, x1b, y1b, w2, block2, line2, *_ in words:
                if block2 == block and line2 == line and abs(y0b - y0) < 1.5 and x0b > x0:
                    try:
                        rn = int(w2.strip())
                    except ValueError:
                        rn = None
                    break
            if rn is None or rn in seen_round:
                continue
            same_line = [
                w for x0b, y0b, x1b, y1b, w, b, ln, *_ in words
                if b == block and ln == line
            ]
            if not any(re.fullmatch(r'\(\d+q\)', w.strip()) for w in same_line):
                continue
            seen_round.add(rn)

            cb_y0 = y0 + (y1 - y0 - cb_h) / 2
            cb_x1 = x0 - gap
            cb_x0 = cb_x1 - cb_h
            if cb_x0 >= 0:
                cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
                page.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                               fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
                wd = fitz.Widget()
                wd.rect        = cb_rect
                wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
                wd.field_name  = f'ap_pack_done_{rn}'
                wd.field_value = 'Off'
                wd.on_state    = 'Yes'
                page.add_widget(wd)
                n_boxes += 1

            dest = round_page_registry.get(rn)
            if dest is not None:
                draw_round_arrow(page, y0, y1, dest)
                n_arrows += 1

    doc.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    print(f'    {n_links} inline QID links  |  {n_boxes} checkboxes  |  {n_arrows} round arrows')


def _add_qid_links_on_packs_banners(pdf_path: Path, skip_pages: set, qid_first_page: dict):
    """Add word-level #N GOTO links on every page not in skip_pages.
    Covers the per-pack section banner lines (e.g. 'Arrays & Hashing  #1  #163 …')
    and per-pack mini-TOC rows that are not part of the master Contents overview.
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
    print(f'    {n_links} section-banner QID links added')


def main():
    mega_only = '--mega-only' in _sys.argv

    if not GRIND_JSON.exists():
        raise SystemExit(f'✗ Not found: {GRIND_JSON}')

    with open(GRIND_JSON) as f:
        questions = json.load(f)
    print(f'Loaded {len(questions)} questions\n')

    # Enrich with source/tags from questions_full.json so premium detection works
    _full_path = SCRIPT_DIR / 'public' / 'questions_full.json'
    if _full_path.exists():
        _full_by_id = {q['id']: q for q in json.loads(_full_path.read_text())}
        for q in questions:
            _fq = _full_by_id.get(q['id'], {})
            if 'source' not in q or not q['source']:
                q['source'] = _fq.get('source', [])
            if 'tags' not in q or not q['tags']:
                q['tags'] = _fq.get('tags', [])

    sites_cache  = _load(SITES_CACHE) if SITES_CACHE.exists() else {}
    doocs_cache  = _load(DOOCS_CACHE) if DOOCS_CACHE.exists() else {}
    # Fill in LeetCode HTML for questions not in Doocs (20 questions lack Doocs entries).
    _qdata_path = SCRIPT_DIR / 'public' / 'questions_data_all.json'
    if _qdata_path.exists():
        import json as _json
        for _qid, _qd in _json.loads(_qdata_path.read_text()).items():
            if not doocs_cache.get(_qid, {}).get('desc_html'):
                _html = (_qd.get('description_html') or '').strip()
                if _html:
                    doocs_cache.setdefault(_qid, {})['desc_html'] = _html
    my_solutions = load_my_solutions()
    print(f'Caches: {len(sites_cache)} sites, {len(doocs_cache)} doocs\n')

    sections = build_sections(questions)
    total_qs = sum(len(qs) for _, _, _, qs in sections)
    print(f'{len(sections)} packs  ·  {total_qs} questions\n')
    for rn, pri, pat_obj, qs in sections:
        print(f'  {rn:02d}. {pri} · {pat_obj["name"]}  ({len(qs)}q)')
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}
    SCRATCHPAD     = Path(tempfile.gettempdir())

    if mega_only:
        print('-- mega-only mode: skipping 21 individual pack builds --\n')

    for rn, priority, pat_obj, qs in ([] if mega_only else sections):
        pat_abbr  = PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name'])
        filename  = f'{rn:02d} {pat_abbr} · {priority} · {len(qs)}q.pdf'
        out_file  = OUTPUT_DIR / filename
        inner_tmp = SCRATCHPAD / f'_pack_{rn}_inner.pdf'
        imp_tmp   = SCRATCHPAD / f'_pack_{rn}_imposed.pdf'

        print(f'\n── Pack {rn:02d}/{len(sections)}: {priority} · {pat_obj["name"]}  ({len(qs)}q) ──')

        try:
            round_pg_reg, pat_pg_reg = _build_pack_inner(
                rn, priority, pat_obj, qs,
                sites_cache, doocs_cache, inner_tmp,
                my_solutions=my_solutions,
            )

            print('  Imposing 1×1…')
            _impose_1up(inner_tmp, imp_tmp)

            print('  Analyzing links…')
            rounds_struct = [(rn, priority, 'All', [(pat_obj, qs)])]
            page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page = \
                _analyze_inner_for_links(inner_tmp, rounds_struct)

            print('  Adding interactive features…')
            _add_links_1x1(
                imp_tmp, page_types, qid_first_page,
                toc_link_rects, toc_section_rects,
                round_pg_reg, pat_pg_reg,
                qid_difficulty=qid_difficulty,
                qid_to_slug=qid_to_slug,
                ia_first_page=ia_first_page,
            )
            _add_qid_links_on_packs_banners(imp_tmp, set(), qid_first_page)

            shutil.move(str(imp_tmp), str(out_file))
            kb = os.path.getsize(out_file) // 1024
            print(f'  ✓  {filename}  ({kb:,} KB)')

        except Exception as e:
            print(f'  ✗  ERROR on pack {rn}: {e}')
            raise
        finally:
            inner_tmp.unlink(missing_ok=True)
            imp_tmp.unlink(missing_ok=True)

    # ── 00 ALL Packs.pdf — full 727q mega PDF ────────────────────────────────
    print('\n── Building 00 ALL Packs.pdf (full 727q mega PDF) ──')
    inner_mega  = SCRATCHPAD / '_all_packs_inner.pdf'
    imposed_mega = SCRATCHPAD / '_all_packs_imposed.pdf'
    out_mega    = OUTPUT_DIR / '00 ALL Packs.pdf'
    inner_mega.unlink(missing_ok=True)
    imposed_mega.unlink(missing_ok=True)
    try:
        round_pg_reg_m, pat_pg_reg_m = _build_all_packs_inner(
            sections, sites_cache, doocs_cache, inner_mega,
            my_solutions=my_solutions,
        )
        if not inner_mega.exists() or inner_mega.stat().st_size == 0:
            raise RuntimeError(f'Inner PDF missing or empty after build: {inner_mega}')
        print('\n  Imposing 1×1…')
        _impose_1up(inner_mega, imposed_mega)
        print('  Analyzing links…')
        rounds_struct = [(rn, pri, 'All', [(po, qs)])
                         for rn, pri, po, qs in sections]
        page_types_m, qid_first_page_m, toc_link_rects_m, toc_section_rects_m, ia_first_page_m = \
            _analyze_inner_for_links(inner_mega, rounds_struct)
        # Master Contents lists many Rounds per page; each pack mini-TOC has one.
        # Do NOT use (banner_page - 1): multi-page mini-TOCs put the first page
        # before that cutoff and wrongly strip its per-question checkboxes.
        overview_pages_m = {
            pg for pg, secs in toc_section_rects_m.items()
            if sum(1 for kind, _, _ in secs if kind == 'round') >= 2
        }
        overview_toc_rects_m = {pg: v for pg, v in toc_link_rects_m.items()
                                if pg in overview_pages_m}
        toc_link_secs_m = {pg: v for pg, v in toc_link_rects_m.items()
                           if pg not in overview_pages_m}
        # Strip overview from section arrows too — otherwise each pack gets
        # BOTH a Round ↗ and a Pattern ↗ on the master Contents page.
        toc_section_secs_m = {pg: v for pg, v in toc_section_rects_m.items()
                              if pg not in overview_pages_m}
        print('  Adding interactive features…')
        _add_links_1x1(
            imposed_mega, page_types_m, qid_first_page_m,
            toc_link_secs_m, toc_section_secs_m,
            round_pg_reg_m, pat_pg_reg_m,
            qid_difficulty=qid_difficulty, qid_to_slug=qid_to_slug,
            ia_first_page=ia_first_page_m,
        )
        if overview_pages_m:
            print(f'  Adding inline QID links on {len(overview_pages_m)} overview page(s)…')
            _add_overview_qid_links_packs(
                imposed_mega, overview_pages_m, qid_first_page_m, overview_toc_rects_m,
                round_page_registry=round_pg_reg_m,
            )
        print('  Adding section-banner QID links…')
        _add_qid_links_on_packs_banners(imposed_mega, overview_pages_m, qid_first_page_m)
        shutil.move(str(imposed_mega), str(out_mega))
        kb = os.path.getsize(out_mega) // 1024
        print(f'\n🎉  00 ALL Packs.pdf  ({kb:,} KB)\n→  {out_mega}')
    finally:
        inner_mega.unlink(missing_ok=True)
        imposed_mega.unlink(missing_ok=True)

    print(f'\nAll done!  21 individual PDFs + 00 ALL Packs.pdf → {OUTPUT_DIR}')


if __name__ == '__main__':
    main()

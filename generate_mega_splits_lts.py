#!/usr/bin/env python3
"""
generate_mega_splits_lts.py
One single PDF containing all 138 pattern sections ordered by PRIORITY then
LARGE → SMALL within each priority group:

  HIGH  → 16+q → 10–15q → 5–9q → 1–4q   (all High sections together)
  MID   → 16+q → 10–15q → 5–9q → 1–4q   (all Mid  sections together)
  LOW   → 16+q → 10–15q → 5–9q → 1–4q   (all Low  sections together)

Within each priority+band group: Easy → Med → Hard, larger n first, S1→S2→S3.

Checkbox field names are the same ln_sec_* identifiers used by the Contents
PDF and the standard ALL Splits PDF — ticking any of the three syncs the others.

Output: ~/Desktop/pdf study splits/Study Splits/00 ALL Splits LtS.pdf
"""

import sys as _sys
import os, re, json, tempfile, shutil
from pathlib import Path
from collections import defaultdict

import fitz  # PyMuPDF

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
    build_question_block, build_section_complete_page,
    _impose_1up, _analyze_inner_for_links, _add_links_1x1,
    S, USE_W, USE_H, MP_W, MP_H, MG, hr, _inner_ps, safe_xml,
    PageCounter, RoundPageMark, PatPageMark, PRIORITY_COLORS,
    SITES_CACHE, DOOCS_CACHE, TOC_CB_PT, TOC_CB_GAP, load_my_solutions,
)
from generate_patterns_pdf import QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load
from generate_mega_splits import _add_overview_qid_links, _add_qid_links_on_banner_pages
_sys.argv = _orig_argv

SCRIPT_DIR  = Path(__file__).parent
GRIND_JSON  = SCRIPT_DIR / 'public' / 'grind_questions.json'
OUTPUT_DIR  = Path.home() / 'Desktop' / 'pdf study splits' / 'Study Splits'
OUTPUT_FILE = OUTPUT_DIR / '00 ALL Splits LtS.pdf'

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
PRIORITY_HEX  = {'High': '#EF4444', 'Mid': '#EAB308', 'Low': '#6366F1'}
DIFF_COL      = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}
DIFF_ABBREV   = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}
GRAY_300      = HexColor('#D1D5DB')

PRIORITY_ORDER = {'High': 0, 'Mid': 1, 'Low': 2}
DIFF_ORDER     = {'Easy': 0, 'Medium': 1, 'Hard': 2}

BAND_HEX = {
    'long':   '#DC2626',
    'medium': '#D97706',
    'short':  '#059669',
    'tiny':   '#16A34A',
}
BAND_LABEL = {
    'long':   '16+q  ·  deep work',
    'medium': '10–15q  ·  solid blocks',
    'short':  '5–9q  ·  short sections',
    'tiny':   '1–4q  ·  tiny wins',
}


def _band_for(n: int) -> str:
    if n <= 4:   return 'tiny'
    if n <= 9:   return 'short'
    if n <= 15:  return 'medium'
    return 'long'


def _lts_sort_key(item: dict):
    """Sort: High→Mid→Low priority first, then band (large→small), Easy→Med→Hard, larger n first."""
    band_order = {'long': 0, 'medium': 1, 'short': 2, 'tiny': 3}
    return (
        PRIORITY_ORDER.get(item['priority'], 9),
        band_order[_band_for(item['n'])],
        DIFF_ORDER.get(item['diff'], 9),
        -item['n'],
        item['set'],
        item['pat'],
    )


def build_sections_lts(questions: list) -> list:
    """
    Returns 138 pattern-level sections in Large → Small order.
    Each entry: (sec_num, priority, diff, set_num, pat_obj, qs)
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

    # Flatten to 138 pattern-level items
    raw = []
    for (priority, diff, s, pat), qs in bucket.items():
        obj = PAT_OBJ.get(pat, {'name': pat, 'hex': PAT_COLOR.get(pat, '#6366F1')})
        raw.append({
            'priority': priority, 'diff': diff, 'set': s,
            'pat': pat, 'pat_obj': obj, 'qs': qs, 'n': len(qs),
        })

    raw.sort(key=_lts_sort_key)

    sections = []
    for i, item in enumerate(raw, 1):
        sections.append((
            i,
            item['priority'], item['diff'], item['set'],
            item['pat_obj'], item['qs'],
        ))
    return sections


def build_qid_to_sec_field(sections: list) -> dict:
    """Map each question id → shared ln_sec_* checkbox field name (same as Contents PDF)."""
    out = {}
    for _sn, priority, diff, set_num, pat_obj, qs in sections:
        tier  = f'{priority[0]}{DIFF_ABBREV.get(diff, diff[:1])}'
        abbr  = PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name'])
        field = f'ln_sec_{abbr}_S{set_num}_{tier}_{len(qs)}q'
        for q in qs:
            out[int(q['id'])] = field
    return out


def _build_lts_inner(
    sections: list, sites_cache: dict, doocs_cache: dict, inner_path: Path,
    my_solutions: dict | None = None,
) -> tuple[dict, dict]:
    """
    Build the LtS inner mini-page PDF.
    Structure per section (each section = one pattern split):
      Master TOC  →  [per section: size-band divider? | mini-TOC | banner | questions]
    Returns (round_page_registry, pat_page_registry).
    """
    round_page_registry: dict = {}
    pat_page_registry:   dict = {}

    total_qs  = sum(len(qs) for _, _, _, _, _, qs in sections)
    total_secs = len(sections)

    doc = SimpleDocTemplate(
        str(inner_path), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.1))
    story.append(Paragraph(
        '<b>ALL SPLITS</b>',
        _inner_ps('cov_h1', 'title', alignment=TA_CENTER,
                  fontSize=S['title'].fontSize * 2, leading=S['title'].leading * 2),
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Large → Small  ·  Size Roster Order',
        _inner_ps('cov_h2', 'title', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 5))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f'{total_qs} questions  ·  {total_secs} sections  ·  3 Sets  ·  9 Tiers',
        _inner_ps('cov_stats', 'body', alignment=TA_CENTER),
    ))
    story.append(Paragraph(
        'High (16+q → 10–15q → 5–9q → 1–4q)  ·  Mid  ·  Low',
        _inner_ps('cov_order', 'body', alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        'WalkCC · LeetDoocs · SimplyLeet · LC.ca  ·  Python',
        _inner_ps('cov_sites', 'body_sm', alignment=TA_CENTER),
    ))
    story.append(PageBreak())

    # ── Master TOC (priority-grouped, band sub-headers, colored priority in round lines) ──
    story.append(Paragraph('<b>Contents  —  Priority · Large → Small</b>',
                           _inner_ps('ov_title', 'title', spaceAfter=3)))
    story.append(hr(GRAY_300, 0.4))

    cur_pri      = None
    cur_band_sub = None
    for sn, priority, diff, set_num, pat_obj, qs in sections:
        n_qs     = len(qs)
        band     = _band_for(n_qs)
        pri_hex  = PRIORITY_HEX[priority]

        if priority != cur_pri:
            cur_pri      = priority
            cur_band_sub = None
            story.append(Spacer(1, 4))
            pri_hdr = Table([[Paragraph(
                f'<font color="white"><b>{priority}</b></font>',
                _inner_ps(f'ov_pri_{priority}', 'body', alignment=TA_CENTER, textColor=white),
            )]], colWidths=[USE_W])
            pri_hdr.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
                ('TOPPADDING',    (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            story.append(pri_hdr)

        if band != cur_band_sub:
            cur_band_sub = band
            story.append(Spacer(1, 2))
            story.append(Paragraph(
                f'<font color="{pri_hex}"><b>  {BAND_LABEL[band]}</b></font>',
                _inner_ps(f'ov_band_{priority}_{band}', 'body_sm'),
            ))

        # Single line per section — pattern merged in so only one arrow appears.
        # 'Round {sn}  |  {priority}' is what _analyze_inner_for_links uses to
        # build jump targets; keeping that prefix intact is mandatory.
        pat_hex = pat_obj['hex']
        story.append(Paragraph(
            f'<b>Round {sn}  |  <font color="{pri_hex}">{priority}</font></b>'
            f'  <font color="{DIFF_COL[diff]}">{diff}</font>  S{set_num}  ({n_qs}q)'
            f'  <font color="{pat_hex}"><b>  {safe_xml(pat_obj["name"])}</b></font>'
            f'  <font color="#6B7280">  '
            + '  '.join(f'#{q["id"]}' for q in qs) + '</font>',
            _inner_ps(f'ov_r{sn}', 'body', spaceBefore=2, spaceAfter=1),
        ))

    story.append(PageBreak())

    # ── Per-section: section banner → mini-TOC → pattern banner → questions ──
    for sn, priority, diff, set_num, pat_obj, qs in sections:
        n_qs    = len(qs)
        band    = _band_for(n_qs)
        pri_hex = PRIORITY_HEX[priority]
        pat_hex  = pat_obj['hex']
        pat_name = pat_obj['name']
        pat_abbr = PATTERN_ABBREV.get(pat_name, pat_name)
        tier     = f'{priority[0]}{DIFF_ABBREV[diff]}'

        # ── Section (round) banner — priority color background ────────────────
        # RoundPageMark is placed on the mini-TOC page (below) so that the
        # master-TOC arrow lands on the question list, not the banner.
        story.append(Paragraph('##RNDBNR##',
            _inner_ps(f'rndm{sn}', 'body', fontSize=5, textColor=white,
                      spaceBefore=0, spaceAfter=0)))
        story.append(Spacer(1, USE_H * 0.08))

        # Priority-colored banner: priority is primary label, band is secondary info
        band_badge = Table([[Paragraph(
            f'<font color="white"><b>'
            f'{priority}  ·  {BAND_LABEL[band]}'
            f'  ·  Set {set_num}  ·  {diff}</b>'
            f'  <font size="{S["body_sm"].fontSize}">— Section {sn}</font></font>',
            _inner_ps(f'rbn{sn}', 'title', alignment=TA_CENTER, textColor=white),
        )]], colWidths=[USE_W])
        band_badge.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pri_hex)),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(band_badge)
        story.append(Spacer(1, 3))

        story.append(Paragraph(
            f'<b><font color="{pat_hex}">{safe_xml(pat_name)}</font></b>'
            f'  ·  {n_qs} question{"s" if n_qs != 1 else ""}',
            _inner_ps(f'rct{sn}', 'body', alignment=TA_CENTER),
        ))
        story.append(Spacer(1, 4))
        story.append(hr(GRAY_300, 0.4))

        q_ids = '  '.join(f'#{q["id"]}' for q in qs)
        story.append(Paragraph(
            f'<b><font color="{pat_hex}">{safe_xml(pat_name)}</font></b>  {safe_xml(q_ids)}',
            _inner_ps(f'rspl{sn}_{pat_name[:6]}', 'body', spaceAfter=2),
        ))
        story.append(PageBreak())

        # ── Per-pattern mini-TOC page ─────────────────────────────────────────
        story.append(RoundPageMark(sn, round_page_registry))
        story.append(Paragraph(
            f'<b>Round {sn}  |  <font color="{pri_hex}">{priority}</font></b>'
            f'  <font color="{DIFF_COL[diff]}">{diff}</font>  ·  S{set_num}',
            _inner_ps(f'toc_rnd{sn}_{pat_name[:6]}', 'title'),
        ))
        story.append(Spacer(1, 2))
        story.append(Paragraph(
            f'<b><font color="{pat_hex}">— {safe_xml(pat_name)} ({n_qs}) —</font></b>',
            _inner_ps(f'toc_ph{sn}_{pat_name[:6]}', 'body_sm', spaceBefore=3, spaceAfter=1),
        ))
        for q in qs:
            d  = q.get('difficulty', '')
            dc = DIFF_COL.get(d, '#6B7280')
            story.append(Paragraph(
                f'<b>#{q["id"]} {safe_xml(q["title"])}</b>'
                f'  <font color="{dc}">[{d[:3].upper()}]</font>',
                _inner_ps(f'toc_e{sn}_{q["id"]}', 'body', spaceAfter=2),
            ))
        story.append(PageBreak())

        # ── Pattern banner page ───────────────────────────────────────────────
        story.append(PatPageMark(sn, pat_name, pat_page_registry))

        pat_banner = Table([[Paragraph(
            f'<font color="white"><b>{safe_xml(pat_name)}</b>'
            f'  <font size="{S["body_sm"].fontSize}">'
            f'— S{set_num} {priority} {DIFF_ABBREV[diff]}  ·  {n_qs}q'
            f'  ·  {BAND_LABEL[band]}</font></font>',
            _inner_ps(f'pbn{sn}_{pat_name[:6]}', 'head2', textColor=white),
        )]], colWidths=[USE_W])
        pat_banner.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor(pat_hex)),
            ('TOPPADDING',    (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING',   (0, 0), (-1, -1), 6),
        ]))
        story += [pat_banner, Spacer(1, 4)]

        story.append(Paragraph(
            f'<b>{safe_xml(pat_name)}</b>  {safe_xml(q_ids)}',
            _inner_ps(f'pids{sn}_{pat_name[:6]}', 'body'),
        ))
        story.append(PageBreak())

        # ── Question pages ────────────────────────────────────────────────────
        for i, q in enumerate(qs, 1):
            story += build_question_block(
                q, sites_cache, doocs_cache,
                pattern_name=pat_name,
                pattern_obj=pat_obj,
                my_solutions=my_solutions,
            )
            if i % 5 == 0:
                print(f'      {i}/{n_qs} q  [{pat_abbr} S{set_num} {tier} | sec {sn}]')
        story += build_section_complete_page(pat_name, n_qs, pat_hex=pat_hex)

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    print(f'  Building inner PDF ({total_qs}q across {total_secs} sections)…')
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'  Inner PDF done: {counter.n} mini-pages')
    return round_page_registry, pat_page_registry


def main():
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

    sections  = build_sections_lts(questions)
    total_qs  = sum(len(qs) for _, _, _, _, _, qs in sections)
    print(f'{len(sections)} sections  ·  {total_qs} questions  (Large → Small order)\n')

    # Print section manifest (priority-grouped, band sub-headers)
    cur_pri  = None
    cur_band = None
    for sn, pri, diff, s, pat_obj, qs in sections:
        band = _band_for(len(qs))
        if pri != cur_pri:
            cur_pri  = pri
            cur_band = None
            print(f'  [{pri}]')
        if band != cur_band:
            cur_band = band
            print(f'    {BAND_LABEL[band]}')
        abbr = PATTERN_ABBREV.get(pat_obj['name'], pat_obj['name'])
        print(f'      Sec {sn:03d}: {abbr} S{s} {pri[0]}{DIFF_ABBREV[diff]}  ({len(qs)}q)')
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}

    SCRATCHPAD  = Path(tempfile.gettempdir())
    inner_path  = SCRATCHPAD / '_mega_splits_lts_inner.pdf'
    imposed_tmp = SCRATCHPAD / '_mega_splits_lts_imposed.pdf'

    try:
        round_page_registry, pat_page_registry = _build_lts_inner(
            sections, sites_cache, doocs_cache, inner_path, my_solutions,
        )

        if not inner_path.exists() or inner_path.stat().st_size == 0:
            raise RuntimeError(f'Inner PDF missing or empty: {inner_path}')

        print('\n  Imposing 1×1…')
        _impose_1up(inner_path, imposed_tmp)

        print('  Analyzing links…')
        # rounds_struct mirrors the format _analyze_inner_for_links expects:
        # [(rn, priority, diff, [(pat_obj, qs), ...]), ...]
        rounds_struct = [
            (sn, pri, diff, [(pat_obj, qs)])
            for sn, pri, diff, s, pat_obj, qs in sections
        ]
        page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page = \
            _analyze_inner_for_links(inner_path, rounds_struct)

        # Master Contents pages: those with 2+ round entries listed
        overview_pages = {
            pg for pg, secs in toc_section_rects.items()
            if sum(1 for kind, _, _ in secs if kind == 'round') >= 2
        }

        overview_toc_rects    = {pg: v for pg, v in toc_link_rects.items() if pg in overview_pages}
        toc_link_rects_sections = {pg: v for pg, v in toc_link_rects.items() if pg not in overview_pages}

        print('  Adding interactive features…')
        _add_links_1x1(
            imposed_tmp, page_types, qid_first_page,
            toc_link_rects_sections, toc_section_rects,
            round_page_registry, pat_page_registry,
            qid_difficulty=qid_difficulty,
            qid_to_slug=qid_to_slug,
            ia_first_page=ia_first_page,
        )

        # Overview QID links + checkboxes — use shared ln_sec_* field names
        # so ticks sync with the Contents PDF and the standard ALL Splits PDF.
        if overview_pages:
            print(f'  Adding inline QID links + checkboxes on {len(overview_pages)} overview page(s)…')
            sec_fields = build_qid_to_sec_field(sections)
            _add_overview_qid_links(
                imposed_tmp, overview_pages, qid_first_page,
                overview_toc_rects,
                sec_field_by_qid=sec_fields,
            )

        print('  Adding QID links on banner/mini-TOC pages…')
        _add_qid_links_on_banner_pages(imposed_tmp, overview_pages, qid_first_page)

        print('  Moving to output folder…')
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.move(str(imposed_tmp), str(OUTPUT_FILE))

        kb = os.path.getsize(OUTPUT_FILE) // 1024
        print(f'\n🎉  Done!  {OUTPUT_FILE.name}  ({kb:,} KB)\n→  {OUTPUT_FILE}')

    finally:
        inner_path.unlink(missing_ok=True)
        imposed_tmp.unlink(missing_ok=True)


if __name__ == '__main__':
    main()

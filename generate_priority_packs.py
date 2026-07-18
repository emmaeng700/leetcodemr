#!/usr/bin/env python3
"""
generate_priority_packs.py
Generate 21 "Priority Pack" PDFs — one per (priority × pattern),
combining all sets and all difficulties.

Output: ~/Desktop/pdf study splits/Priority Packs/
Naming: 01 A&H · High · 36q.pdf
Order:  High (patterns in display order) → Mid → Low
Within: S1→S2→S3, Easy→Medium→Hard, then by question ID
"""

import sys as _sys
import os
import re
import json
import argparse
import tempfile
from pathlib import Path
from collections import defaultdict

from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER

# ── Import generate_better_pdf with ALL727 font sizes ────────────────────────
_orig_argv = _sys.argv[:]
_sys.argv = [_sys.argv[0], '--all']
from generate_better_pdf import (
    build_question_block, _impose_1up, _analyze_inner_for_links, _add_links_1x1,
    S, USE_W, USE_H, MP_W, MP_H, MG, hr, _inner_ps, safe_xml,
    PageCounter, RoundPageMark, PatPageMark, PRIORITY_COLORS,
    SITES_CACHE, DOOCS_CACHE,
)
from generate_patterns_pdf import (QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load)
_sys.argv = _orig_argv

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
GRIND_JSON = SCRIPT_DIR / "public" / "grind_questions.json"
OUTPUT_DIR = Path.home() / "Desktop" / "pdf study splits" / "Priority Packs"

# ── Pattern metadata ──────────────────────────────────────────────────────────
PATTERN_ORDER = PATTERN_DISPLAY_ORDER
PAT_COLOR = {p["name"]: p["hex"] for p in QUICK_PATTERNS}
PAT_OBJ   = {p["name"]: p         for p in QUICK_PATTERNS}

PATTERN_ABBREV = {
    'Arrays & Hashing':    'A&H',
    'String':              'Str',
    'Two Pointers':        '2P',
    'Sliding Window':      'SW',
    'Sorting':             'Sort',
    'Binary Search':       'BS',
    'Matrix':              'Mtx',
    'Trees & BST':         'Trees',
    'DFS':                 'DFS',
    'Graphs':              'Gph',
    'BFS':                 'BFS',
    'Linked List':         'LL',
    'Stack':               'Stk',
    'Heap':                'Heap',
    'Trie':                'Trie',
    'Backtracking':        'BT',
    'Greedy':              'Grdy',
    'Dynamic Programming': 'DP',
    'Bit Manipulation':    'BitM',
    'Math':                'Math',
    'JavaScript':          'JS',
}

PRIORITY_HEX = {
    'High': '#EF4444',
    'Mid':  '#EAB308',
    'Low':  '#6366F1',
}

GRAY_300 = HexColor("#D1D5DB")
DIFF_COL  = {"Easy": "#16A34A", "Medium": "#D97706", "Hard": "#DC2626"}
DIFF_KEY  = {"Easy": 0, "Medium": 1, "Hard": 2}


def build_groups(questions: list) -> list:
    """Group by (priority, pattern), all sets + difficulties combined.
    Returns list of (priority, pattern, qs) in High→Mid→Low × display order.
    Questions sorted within: set(1→2→3) → difficulty(Easy→Med→Hard) → ID.
    """
    bucket: dict = defaultdict(list)
    for q in questions:
        section = q.get("section", "") or ""
        pat = q.get("pattern")
        if not pat:
            continue
        m = re.match(r"^(High|Mid|Low)", section)
        if not m:
            continue
        bucket[(m.group(1), pat)].append(q)

    result = []
    for priority in ['High', 'Mid', 'Low']:
        for pat in PATTERN_ORDER:
            qs = bucket.get((priority, pat))
            if qs:
                qs = sorted(qs, key=lambda q: (
                    q.get('set', 1),
                    DIFF_KEY.get(q.get('difficulty', 'Easy'), 0),
                    q.get('id', 0),
                ))
                result.append((priority, pat, qs))
    return result


def _build_pack_inner(
    priority: str, pattern: str, qs: list,
    sites_cache: dict, doocs_cache: dict,
    inner_path: Path,
    number: int, total: int,
    prev_label: str | None, next_label: str | None,
) -> tuple[dict, dict]:
    """Build inner mini-page PDF. Returns (round_page_registry, pat_page_registry)."""

    round_num = 1   # each pack is a standalone PDF
    pri_hex   = PRIORITY_HEX[priority]
    pat_hex   = PAT_COLOR.get(pattern, "#6366F1")
    pat_obj   = PAT_OBJ.get(pattern, {"name": pattern, "hex": pat_hex, "color": HexColor(pat_hex)})
    pat_abbr  = PATTERN_ABBREV.get(pattern, pattern)
    n_qs      = len(qs)

    round_page_registry: dict = {}
    pat_page_registry:   dict = {}

    doc = SimpleDocTemplate(
        str(inner_path),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    counter = PageCounter()
    story   = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.08))
    story.append(Paragraph(
        f'<font color="{pri_hex}"><b>{priority} Priority</b></font>',
        _inner_ps("cov_pri", "title", alignment=TA_CENTER, textColor=HexColor(pri_hex)),
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f'<font color="{pat_hex}"><b>{safe_xml(pattern)}</b></font>',
        _inner_ps("cov_pat", "title", alignment=TA_CENTER,
                  fontSize=S["title"].fontSize * 1.5,
                  leading=S["title"].leading * 1.5,
                  textColor=HexColor(pat_hex)),
    ))
    story.append(Spacer(1, 4))
    story.append(hr(GRAY_300, 0.4))
    story.append(Spacer(1, 3))

    story.append(Paragraph(
        f"All Sets  ·  {n_qs} question{'s' if n_qs != 1 else ''}  ·  {number}/{total}",
        _inner_ps("cov_cnt", "body", alignment=TA_CENTER),
    ))

    diff_counts = {
        "Easy":   sum(1 for q in qs if q.get("difficulty") == "Easy"),
        "Medium": sum(1 for q in qs if q.get("difficulty") == "Medium"),
        "Hard":   sum(1 for q in qs if q.get("difficulty") == "Hard"),
    }
    diff_parts = [
        f'<font color="{DIFF_COL[d]}">{d}: {c}</font>'
        for d, c in diff_counts.items() if c
    ]
    story.append(Paragraph("  ·  ".join(diff_parts),
                            _inner_ps("cov_diff", "body", alignment=TA_CENTER)))

    set_counts = {
        s: sum(1 for q in qs if q.get("set", 1) == s) for s in [1, 2, 3]
    }
    set_parts = [f"S{s}: {c}" for s, c in set_counts.items() if c]
    story.append(Paragraph("  ·  ".join(set_parts),
                            _inner_ps("cov_sets", "body", alignment=TA_CENTER)))

    story.append(Spacer(1, 3))
    story.append(Paragraph(
        "WalkCC · LeetDoocs · SimplyLeet · LC.ca  ·  Python",
        _inner_ps("cov_sites", "body_sm", alignment=TA_CENTER),
    ))

    if prev_label or next_label:
        story.append(Spacer(1, 4))
        nav = []
        if prev_label:
            nav.append(f"◀ {prev_label}")
        if next_label:
            nav.append(f"{next_label} ▶")
        story.append(Paragraph("  |  ".join(nav),
                                _inner_ps("cov_nav", "body_sm", alignment=TA_CENTER)))

    story.append(PageBreak())

    # ── TOC ───────────────────────────────────────────────────────────────────
    # Text must match _analyze_inner_for_links needles exactly.
    story.append(Paragraph(
        f'<b>Round {round_num}  |  {priority}</b>',
        _inner_ps("toc_round", "title"),
    ))
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        f'<b><font color="{pat_hex}">{safe_xml(pattern)}</font> ({n_qs})</b>',
        _inner_ps("toc_hdr", "head2"),
    ))
    story.append(hr(GRAY_300, 0.4))

    cur_set = None
    for q in qs:
        s = q.get('set', 1)
        if s != cur_set:
            cur_set = s
            story.append(Paragraph(
                f'<b><font color="#6B7280">— Set {s} —</font></b>',
                _inner_ps(f"toc_s{s}", "body_sm", spaceBefore=3, spaceAfter=1),
            ))
        d  = q.get("difficulty", "")
        dc = DIFF_COL.get(d, "#6B7280")
        story.append(Paragraph(
            f'<b>#{q["id"]} {safe_xml(q["title"])}</b>  '
            f'<font color="{dc}">[{d[:3].upper()}]</font>',
            _inner_ps("toc_e", "body", spaceAfter=2),
        ))

    story.append(PageBreak())

    # ── Pattern banner ────────────────────────────────────────────────────────
    story.append(RoundPageMark(round_num, round_page_registry))
    story.append(PatPageMark(round_num, pattern, pat_page_registry))

    banner = Table([[Paragraph(
        f'<font color="white"><b>{safe_xml(pattern)}</b>'
        f'  <font size="{S["body_sm"].fontSize}">'
        f'— {priority} · {n_qs} q</font></font>',
        _inner_ps("ban", "head2", textColor=white),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), HexColor(pat_hex)),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    story += [banner, Spacer(1, 4)]

    q_ids = "  ".join(f"#{q['id']}" for q in qs)
    story.append(Paragraph(
        f'<b>{safe_xml(pattern)}</b>  {safe_xml(q_ids)}',
        _inner_ps("ban_ids", "body"),
    ))
    story.append(PageBreak())

    # ── Question blocks ───────────────────────────────────────────────────────
    for i, q in enumerate(qs, 1):
        story += build_question_block(
            q, sites_cache, doocs_cache,
            pattern_name=pattern,
            pattern_obj=pat_obj,
            my_solutions=None,
        )
        if i % 5 == 0:
            print(f"      {i}/{n_qs} questions…")

    def _footer(canvas, doc):
        counter.on_page(canvas, doc)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return round_page_registry, pat_page_registry


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--priority", default=None, help="Filter to one priority: High|Mid|Low")
    ap.add_argument("--pattern",  default=None, help="Filter to one pattern name")
    args = ap.parse_args()

    if not GRIND_JSON.exists():
        raise SystemExit(f"✗ Not found: {GRIND_JSON}")

    with open(GRIND_JSON) as f:
        questions = json.load(f)
    print(f"Loaded {len(questions)} questions\n")

    sites_cache = _load(SITES_CACHE) if SITES_CACHE.exists() else {}
    doocs_cache = _load(DOOCS_CACHE) if DOOCS_CACHE.exists() else {}
    print(f"Caches: {len(sites_cache)} sites, {len(doocs_cache)} doocs\n")

    groups = build_groups(questions)
    print("Groups:")
    for i, (p, pat, qs) in enumerate(groups, 1):
        print(f"  {i:02d}. {p} · {pat}  ({len(qs)}q)")
    print()

    if args.priority:
        groups = [(p, pat, q) for p, pat, q in groups if p.lower() == args.priority.lower()]
        if not groups:
            raise SystemExit(f"✗ Priority not found: {args.priority}")
    if args.pattern:
        groups = [(p, pat, q) for p, pat, q in groups if pat.lower() == args.pattern.lower()]
        if not groups:
            raise SystemExit(f"✗ Pattern not found: {args.pattern}")

    total  = len(groups)
    labels = [
        f"{i+1:02d} {PATTERN_ABBREV.get(pat, pat)} · {p}"
        for i, (p, pat, _) in enumerate(groups)
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}

    print(f"Generating {total} PDFs → {OUTPUT_DIR}\n")

    for i, (priority, pattern, qs) in enumerate(groups):
        pat_abbr  = PATTERN_ABBREV.get(pattern, pattern)
        filename  = f"{i+1:02d} {pat_abbr} · {priority} · {len(qs)}q.pdf"
        out       = OUTPUT_DIR / filename
        prev_lbl  = labels[i - 1] if i > 0 else None
        next_lbl  = labels[i + 1] if i < total - 1 else None
        pat_obj   = PAT_OBJ.get(pattern, {"name": pattern})

        print(f"[{i+1}/{total}] {priority} — {pattern}  ({len(qs)} questions)")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
            inner_path = Path(tf.name)

        try:
            round_page_registry, pat_page_registry = _build_pack_inner(
                priority, pattern, qs,
                sites_cache, doocs_cache,
                inner_path,
                number=i + 1, total=total,
                prev_label=prev_lbl, next_label=next_lbl,
            )

            print("    Imposing 1×1…")
            _impose_1up(inner_path, out)

            print("    Analyzing links…")
            rounds_struct = [(1, priority, 'Easy', [(pat_obj, qs)])]
            page_types, qid_first_page, toc_link_rects, toc_section_rects = \
                _analyze_inner_for_links(inner_path, rounds_struct)

            print("    Adding interactive features…")
            _add_links_1x1(
                out, page_types, qid_first_page,
                toc_link_rects, toc_section_rects,
                round_page_registry, pat_page_registry,
                qid_difficulty=qid_difficulty,
                qid_to_slug=qid_to_slug,
            )

            kb = os.path.getsize(out) // 1024
            print(f"    ✅  {filename}  ({kb:,} KB)")

        finally:
            inner_path.unlink(missing_ok=True)

    print(f"\n🎉  Done! {total} PDFs → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

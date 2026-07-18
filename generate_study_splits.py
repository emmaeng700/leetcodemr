"""
LeetMastery — Study Split PDFs
One PDF per (tier × pattern), identical design and interactive features to
ultimate_1up.pdf.

Pipeline per split:
  1. Build mini-page inner PDF at 204×264 pt (same as generate_better_pdf.py)
  2. Impose 1×1 to letter (each mini-page scales to full 612×792 page)
  3. Analyze inner PDF for TOC / question page geometry
  4. Add all interactive features: TOC arrows, ← Contents, ← Prev / → Next

Usage:
  python3 generate_study_splits.py
  python3 generate_study_splits.py --tier "High Easy"
  python3 generate_study_splits.py --tier "High Easy" --pattern "Arrays & Hashing"
"""

import argparse, json, os, re, tempfile
from pathlib import Path
from collections import defaultdict

# ── Import generate_better_pdf for exact design match ─────────────────────────
# Force --all mode so generate_better_pdf uses ALL727 font sizes (3.2pt body,
# 2.8pt code) — identical to ultimate_1up.pdf.
import sys as _sys
_orig_argv = _sys.argv[:]
_sys.argv  = [_sys.argv[0], '--all']

from generate_better_pdf import (
    build_question_block,
    _impose_1up,
    _analyze_inner_for_links,
    _add_links_1x1,
    S, USE_W, USE_H, MP_W, MP_H, MG,
    cat_bar, hr, _inner_ps, safe_xml,
    PageCounter, SetRound,
    RoundPageMark, PatPageMark,
    PRIORITY_COLORS, SITE_META,
    SITES_CACHE, DOOCS_CACHE,
)
from generate_patterns_pdf import (
    QUICK_PATTERNS, PATTERN_DISPLAY_ORDER, _load,
)

_sys.argv = _orig_argv   # restore after imports

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
GRIND_JSON = SCRIPT_DIR / "public" / "grind_questions.json"
OUTPUT_DIR = Path.home() / "Desktop" / "pdf study splits"

# ── Study order ───────────────────────────────────────────────────────────────
TIER_ORDER = [
    "High Easy", "High Medium", "High Hard",
    "Mid Easy",  "Mid Medium",  "Mid Hard",
    "Low Easy",  "Low Medium",  "Low Hard",
]
TIER_ABBREV = {
    "High Easy": "HE", "High Medium": "HM", "High Hard": "HH",
    "Mid Easy":  "ME", "Mid Medium":  "MM", "Mid Hard":  "MH",
    "Low Easy":  "LE", "Low Medium":  "LM", "Low Hard":  "LH",
}
TIER_PRIORITY = {
    "High Easy": "High", "High Medium": "High", "High Hard": "High",
    "Mid Easy":  "Mid",  "Mid Medium":  "Mid",  "Mid Hard":  "Mid",
    "Low Easy":  "Low",  "Low Medium":  "Low",  "Low Hard":  "Low",
}
TIER_DIFFICULTY = {
    "High Easy": "Easy",   "High Medium": "Medium", "High Hard": "Hard",
    "Mid Easy":  "Easy",   "Mid Medium":  "Medium",  "Mid Hard":  "Hard",
    "Low Easy":  "Easy",   "Low Medium":  "Medium",  "Low Hard":  "Hard",
}
TIER_COLOR = {
    "High Easy":   "#EF4444",
    "High Medium": "#F97316",
    "High Hard":   "#DC2626",
    "Mid Easy":    "#EAB308",
    "Mid Medium":  "#F59E0B",
    "Mid Hard":    "#D97706",
    "Low Easy":    "#6366F1",
    "Low Medium":  "#7C3AED",
    "Low Hard":    "#4338CA",
}
PATTERN_ORDER = PATTERN_DISPLAY_ORDER
PAT_COLOR = {p["name"]: p["hex"] for p in QUICK_PATTERNS}
PAT_OBJ   = {p["name"]: p         for p in QUICK_PATTERNS}

# Short abbreviations — same as app's lcListNaming.ts
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

BLACK    = HexColor("#000000")
GRAY_300 = HexColor("#D1D5DB")
GRAY_500 = HexColor("#6B7280")


def safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


def parse_tier(section: str | None) -> str | None:
    if not section:
        return None
    m = re.match(r"^(High|Mid|Low) (Easy|Medium|Hard)", section)
    return m.group(0) if m else None


def build_groups(questions: list) -> list:
    """Group by priority → set → difficulty → pattern.
    Order: High (S1→S2→S3, Easy→Med→Hard), Mid (S1→S2→S3), Low (S1→S2→S3).
    """
    bucket: dict = defaultdict(list)
    for q in questions:
        tier = parse_tier(q.get("section"))
        pat  = q.get("pattern")
        s    = q.get("set", 1)
        if tier and pat:
            bucket[(tier, pat, s)].append(q)

    result = []
    for priority in ['High', 'Mid', 'Low']:
        for s in [1, 2, 3]:
            for diff in ['Easy', 'Medium', 'Hard']:
                tier = f"{priority} {diff}"
                for pat in PATTERN_ORDER:
                    qs = bucket.get((tier, pat, s))
                    if qs:
                        qs = sorted(qs, key=lambda q: q.get("id", 0))
                        result.append((tier, pat, s, qs))
    return result


# ── Mini-page inner PDF builder for one split ─────────────────────────────────
def _build_split_inner(
    tier: str, pattern: str, set_num: int, qs: list,
    sites_cache: dict, doocs_cache: dict,
    inner_path: Path,
    round_num: int,
    number: int, total: int,
    prev_label: str | None, next_label: str | None,
) -> tuple[dict, dict]:
    """Build inner mini-page PDF. Returns (round_page_registry, pat_page_registry)."""

    abbrev    = TIER_ABBREV.get(tier, tier)
    priority  = TIER_PRIORITY.get(tier, "Low")
    pri_c     = PRIORITY_COLORS[priority]
    tier_hex  = TIER_COLOR.get(tier, "#6366F1")
    pat_hex   = PAT_COLOR.get(pattern, "#6366F1")
    pat_obj   = PAT_OBJ.get(pattern, {"name": pattern, "hex": pat_hex, "color": HexColor(pat_hex)})
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

    # ── Cover mini-page ───────────────────────────────────────────────────────
    story.append(Spacer(1, USE_H * 0.08))

    story.append(Paragraph(
        f'<font color="{tier_hex}"><b>{tier}</b></font>',
        _inner_ps("cov_tier", "title", alignment=TA_CENTER,
                  textColor=HexColor(tier_hex)),
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

    diff_counts = {
        "Easy":   sum(1 for q in qs if q.get("difficulty") == "Easy"),
        "Medium": sum(1 for q in qs if q.get("difficulty") == "Medium"),
        "Hard":   sum(1 for q in qs if q.get("difficulty") == "Hard"),
    }
    dc_col = {"Easy": "#16A34A", "Medium": "#D97706", "Hard": "#DC2626"}
    diff_parts = [
        f'<font color="{dc_col[d]}">{d}: {c}</font>'
        for d, c in diff_counts.items() if c
    ]
    story.append(Paragraph(
        f"Set {set_num}  ·  {n_qs} question{'s' if n_qs != 1 else ''}  ·  {number}/{total}",
        _inner_ps("cov_cnt", "body", alignment=TA_CENTER),
    ))
    story.append(Paragraph(
        "  ·  ".join(diff_parts),
        _inner_ps("cov_diff", "body", alignment=TA_CENTER),
    ))
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
        story.append(Paragraph(
            "  |  ".join(nav),
            _inner_ps("cov_nav", "body_sm", alignment=TA_CENTER),
        ))

    story.append(PageBreak())

    # ── TOC mini-page(s) ──────────────────────────────────────────────────────
    # Format MUST match what _analyze_inner_for_links searches for:
    #   round header: f'Round {round_num}  |  {priority}'
    #   pattern line: f'{pattern} ({n_qs})'
    # Two spaces around the pipe to match the exact needle format.
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

    dc_map = {"Easy": "#16A34A", "Medium": "#D97706", "Hard": "#DC2626"}
    for q in qs:
        d  = q.get("difficulty", "")
        dc = dc_map.get(d, "#6B7280")
        story.append(Paragraph(
            f'<b>#{q["id"]} {safe_xml(q["title"])}</b>  '
            f'<font color="{dc}">[{d[:3].upper()}]</font>',
            _inner_ps("toc_e", "body", spaceAfter=3),
        ))

    story.append(PageBreak())

    # ── Chapter / pattern banner mini-page ───────────────────────────────────
    # RoundPageMark registers the page number for this round in round_page_registry.
    story.append(RoundPageMark(round_num, round_page_registry))
    story.append(PatPageMark(round_num, pattern, pat_page_registry))

    banner = Table([[Paragraph(
        f'<font color="white"><b>{safe_xml(pattern)}</b>'
        f'  <font size="{S["body_sm"].fontSize}">'
        f'— {abbrev} · {n_qs} q</font></font>',
        _inner_ps("ban", "head2", textColor=white),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), HexColor(pat_hex)),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
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


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier",    default=None)
    ap.add_argument("--pattern", default=None)
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

    if args.tier:
        groups = [(t, p, s, q) for t, p, s, q in groups if t.lower() == args.tier.lower()]
        if not groups:
            raise SystemExit(f"✗ Tier not found: {args.tier}")
    if args.pattern:
        groups = [(t, p, s, q) for t, p, s, q in groups if p.lower() == args.pattern.lower()]
        if not groups:
            raise SystemExit(f"✗ Pattern not found: {args.pattern}")

    total  = len(groups)
    # Labels for prev/next cover navigation
    def _label(t, p, s, n):
        return f"S{s} {n:02d} {PATTERN_ABBREV.get(p, p)} · {TIER_ABBREV.get(t, t)}"
    # Count index within each set for the label
    _set_idx: dict = {1: 0, 2: 0, 3: 0}
    _label_idx = []
    for t, p, s, _ in groups:
        _set_idx[s] += 1
        _label_idx.append(_set_idx[s])
    labels = [_label(t, p, s, n) for (t, p, s, _), n in zip(groups, _label_idx)]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Pre-build qid lookups for _add_links_1x1
    qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
    qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}

    print(f"Generating {total} PDFs → {OUTPUT_DIR}\n")

    for i, (tier, pattern, set_num, qs) in enumerate(groups):
        abbrev     = TIER_ABBREV.get(tier, tier)
        priority   = TIER_PRIORITY.get(tier, "Low")
        difficulty = TIER_DIFFICULTY.get(tier, "Easy")
        round_num  = TIER_ORDER.index(tier) + 1
        pat_abbr   = PATTERN_ABBREV.get(pattern, pattern)
        filename   = f"{i+1:03d} S{set_num} {pat_abbr} · {abbrev} · {len(qs)}q.pdf"
        out        = OUTPUT_DIR / filename
        prev_lbl   = labels[i - 1] if i > 0 else None
        next_lbl   = labels[i + 1] if i < total - 1 else None

        pat_obj = PAT_OBJ.get(pattern, {"name": pattern})

        print(f"[{i+1}/{total}] {tier} — {pattern} S{set_num}  ({len(qs)} questions)")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
            inner_path = Path(tf.name)

        try:
            # Step 1: build mini-page inner PDF
            round_page_registry, pat_page_registry = _build_split_inner(
                tier, pattern, set_num, qs,
                sites_cache, doocs_cache,
                inner_path,
                round_num=round_num,
                number=i + 1, total=total,
                prev_label=prev_lbl, next_label=next_lbl,
            )

            # Step 2: impose 1×1 each mini-page → full letter page
            print("    Imposing 1×1…")
            _impose_1up(inner_path, out)

            # Step 3: analyze inner PDF for TOC and question page geometry
            print("    Analyzing links…")
            rounds_struct = [(round_num, priority, difficulty,
                              [(pat_obj, qs)])]
            page_types, qid_first_page, toc_link_rects, toc_section_rects = \
                _analyze_inner_for_links(inner_path, rounds_struct)

            # Step 4: add all interactive features to imposed PDF
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

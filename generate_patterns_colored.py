"""
LeetMastery — Patterns Summary COLORED (1 page)
Ranks all 21 patterns by number of questions, ascending.
Full-color version: rich per-pattern colors, all text bold.

Usage:
  python3 generate_patterns_colored.py
  -> LeetMastery_All_21_Patterns_Colored.pdf

  python3 generate_patterns_colored.py --print
  -> LeetMastery_All_21_Patterns_Print.pdf
"""

import json
import argparse
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
QUESTIONS  = SCRIPT_DIR / "public" / "questions_full.json"
OUTPUT_COLORED = SCRIPT_DIR / "LeetMastery_All_21_Patterns_Colored.pdf"
OUTPUT_PRINT   = SCRIPT_DIR / "LeetMastery_All_21_Patterns_Print.pdf"

# ── Base palette ───────────────────────────────────────────────────────────────
WHITE      = white
DARK       = HexColor("#0F172A")
GRAY_600   = HexColor("#475569")
GRAY_200   = HexColor("#CBD5E1")
GRAY_50    = HexColor("#F8FAFC")
HEADER_BG  = HexColor("#1e1b4b")   # deep indigo banner
HEADER_BG_PRINT = HexColor("#EEF2FF")  # indigo-50 (print-safe)

# ── Pattern colours (rich, saturated — distinct per pattern) ───────────────────
PATTERN_COLORS = {
    "Bit Manipulation":    "#312e81",   # indigo-900
    "Trie":                "#7C3AED",   # violet-600
    "Heap":                "#9333EA",   # purple-600
    "Stack":               "#D97706",   # amber-600
    "Sliding Window":      "#0891B2",   # cyan-600
    "Backtracking":        "#E11D48",   # rose-600
    "Linked List":         "#DB2777",   # pink-600
    "Trees & BST":         "#16A34A",   # green-600
    "DFS":                 "#4F46E5",   # indigo-600
    "BFS":                 "#2563EB",   # blue-600
    "Graphs":              "#DC2626",   # red-600
    "Matrix":              "#059669",   # emerald-600
    "Two Pointers":        "#0D9488",   # teal-600
    "Binary Search":       "#EA580C",   # orange-600
    "Dynamic Programming": "#C026D3",   # fuchsia-600
    "Greedy":              "#15803D",   # green-700 (distinct from Trees)
    "Sorting":             "#65A30D",   # lime-600
    "Math":                "#64748B",   # slate-500
    "String":              "#0284C7",   # sky-600
    "JavaScript":          "#B45309",   # amber-700
    "Arrays & Hashing":    "#4338CA",   # indigo-700
}

QUICK_PATTERNS = [
    {"name": "Bit Manipulation",    "tags": ["Bit Manipulation"]},
    {"name": "Trie",                "tags": ["Trie"]},
    {"name": "Heap",                "tags": ["Heap", "Heap (Priority Queue)"]},
    {"name": "Stack",               "tags": ["Stack", "Monotonic Stack", "Monotonic Queue"]},
    {"name": "Sliding Window",      "tags": ["Sliding Window"]},
    {"name": "Backtracking",        "tags": ["Backtracking"]},
    {"name": "Linked List",         "tags": ["Linked List", "Doubly-Linked List"]},
    {"name": "Trees & BST",         "tags": ["Tree", "Binary Tree", "Binary Search Tree", "BST"]},
    {"name": "DFS",                 "tags": ["DFS", "Depth-First Search"]},
    {"name": "BFS",                 "tags": ["BFS", "Breadth-First Search"]},
    {"name": "Graphs",              "tags": ["Graph", "Union Find", "Topological Sort"]},
    {"name": "Matrix",              "tags": ["Matrix"]},
    {"name": "Two Pointers",        "tags": ["Two Pointers"]},
    {"name": "Binary Search",       "tags": ["Binary Search"]},
    {"name": "Dynamic Programming", "tags": ["Dynamic Programming", "Memoization"]},
    {"name": "Greedy",              "tags": ["Greedy"]},
    {"name": "Sorting",             "tags": ["Sorting", "Divide and Conquer"]},
    {"name": "Math",                "tags": ["Math", "Number Theory", "Simulation"]},
    {"name": "String",              "tags": ["String"]},
    {"name": "JavaScript",          "tags": ["JavaScript", "Concurrency"]},
    {"name": "Arrays & Hashing",    "tags": ["Array", "Hash Table", "Prefix Sum"]},
]


def best_text_color(hex_color: str):
    """White or dark text, whichever has better contrast on hex_color."""
    c = HexColor(hex_color)
    lum = 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue
    return white if lum < 0.55 else DARK


def light_tint(hex_color: str, factor: float = 0.10) -> HexColor:
    """Blend hex_color toward white by (1-factor). factor=1.0 → full colour."""
    c = HexColor(hex_color)
    r = int((c.red   * factor + 1.0 * (1 - factor)) * 255)
    g = int((c.green * factor + 1.0 * (1 - factor)) * 255)
    b = int((c.blue  * factor + 1.0 * (1 - factor)) * 255)
    return HexColor("#{:02X}{:02X}{:02X}".format(r, g, b))


def xml_safe(s: str) -> str:
    """Escape & so ReportLab XML parser doesn't choke (e.g. 'Trees & BST')."""
    return s.replace("&", "&amp;")


def assign_pattern(q_tags):
    tag_set = set(q_tags)
    for pat in QUICK_PATTERNS:
        if tag_set & set(pat["tags"]):
            return pat["name"]
    return "Arrays & Hashing"


def build_summary():
    with open(QUESTIONS) as f:
        questions = json.load(f)

    stats = {p["name"]: {"total": 0, "E": 0, "M": 0, "H": 0}
             for p in QUICK_PATTERNS}

    assigned = set()
    for q in questions:
        pat = assign_pattern(q.get("tags", []))
        if q["id"] in assigned:
            continue
        assigned.add(q["id"])
        stats[pat]["total"] += 1
        d = q.get("difficulty", "")
        if d == "Easy":     stats[pat]["E"] += 1
        elif d == "Medium": stats[pat]["M"] += 1
        elif d == "Hard":   stats[pat]["H"] += 1

    rows = sorted(stats.items(), key=lambda x: x[1]["total"])
    return rows, len(questions)


def make_pdf(output_path: Path, printable: bool = False):
    rows, total_qs = build_summary()

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.45 * inch,
    )
    W = letter[0] - 1.2 * inch   # usable width ≈ 7.3 in

    # ── Column widths ──────────────────────────────────────────────────────────
    RANK_W  = 0.36 * inch
    NAME_W  = 2.25 * inch
    DIFF_W  = 1.22 * inch
    COUNT_W = 0.58 * inch
    BAR_W   = W - RANK_W - NAME_W - DIFF_W - COUNT_W   # ≈ 2.89 in

    # ── Paragraph styles — ALL Helvetica-Bold ──────────────────────────────────
    banner_title = ParagraphStyle(
        "bt", fontSize=18, fontName="Helvetica-Bold",
        textColor=(DARK if printable else white),
        alignment=TA_CENTER, leading=22, spaceAfter=0,
    )
    banner_sub = ParagraphStyle(
        "bs", fontSize=8.5, fontName="Helvetica-Bold",
        textColor=(GRAY_600 if printable else HexColor("#c7d2fe")),
        alignment=TA_CENTER, leading=11, spaceAfter=0,
    )
    name_style = ParagraphStyle(
        "nm", fontSize=10.5, fontName="Helvetica-Bold",
        textColor=DARK, leading=13,
    )
    diff_style = ParagraphStyle(
        "df", fontSize=8, fontName="Helvetica-Bold",
        textColor=GRAY_600, alignment=TA_RIGHT, leading=10,
    )
    count_style = ParagraphStyle(
        "ct", fontSize=12, fontName="Helvetica-Bold",
        textColor=DARK, alignment=TA_RIGHT, leading=15,
    )
    footer_style = ParagraphStyle(
        "ft", fontSize=7.5, fontName="Helvetica-Bold",
        textColor=GRAY_600, alignment=TA_CENTER, leading=10,
    )

    story = []

    # ── Header banner ──────────────────────────────────────────────────────────
    hdr_tbl = Table(
        [
            [Paragraph("LeetMastery &bull; Pattern Cheatsheet", banner_title)],
            [Paragraph(
                f"21 patterns &nbsp;&nbsp;&#183;&nbsp;&nbsp; {total_qs} questions total "
                f"&nbsp;&nbsp;&#183;&nbsp;&nbsp; ranked by question count (ascending)",
                banner_sub,
            )],
        ],
        colWidths=[W],
        rowHeights=[26, 16],
    )
    hdr_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), (HEADER_BG_PRINT if printable else HEADER_BG)),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 6))

    # ── Data rows ──────────────────────────────────────────────────────────────
    max_total = max(v["total"] for _, v in rows)
    full_data  = []
    style_cmds = [
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 3),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 3),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.35, GRAY_200),
    ]

    for i, (name, s) in enumerate(rows):
        total = s["total"]
        e, m, h = s["E"], s["M"], s["H"]
        color_hex  = PATTERN_COLORS.get(name, "#4F46E5")
        pat_color  = HexColor(color_hex)
        rank_fg    = best_text_color(color_hex)
        # Print-safe: keep color but avoid dense fills behind small text.
        if printable:
            row_bg = light_tint(color_hex, 0.04) if i % 2 == 1 else WHITE
        else:
            row_bg = light_tint(color_hex, 0.07) if i % 2 == 1 else WHITE

        # Rank cell — pattern-color background, white/dark text
        rank_p = Paragraph(
            f"<font color='#{'{:02X}{:02X}{:02X}'.format(*[int(rank_fg.red*255), int(rank_fg.green*255), int(rank_fg.blue*255)])}'>"
            f"#{i + 1}</font>",
            ParagraphStyle(
                f"rk{i}", fontSize=9, fontName="Helvetica-Bold",
                textColor=rank_fg, alignment=TA_CENTER, leading=11,
            ),
        )

        # Name cell — colored dot + bold name
        safe = xml_safe(name)
        name_p = Paragraph(
            f"<font color='{color_hex}' size='13'><b>\u25cf</b></font>"
            f"&nbsp;&nbsp;<b>{safe}</b>",
            name_style,
        )

        # Difficulty badges
        diff_p = Paragraph(
            f"<font color='#15803D'><b>E:{e}</b></font>  "
            f"<font color='#B45309'><b>M:{m}</b></font>  "
            f"<font color='#B91C1C'><b>H:{h}</b></font>",
            diff_style,
        )

        # Count — large, pattern-colored
        count_p = Paragraph(
            f"<font color='{color_hex}'><b>{total}</b></font>",
            count_style,
        )

        # Bar — keep color; for print mode, slightly tint to avoid heavy blocks.
        bar_fill_w  = min(BAR_W - 2, max(4.0, (total / max_total) * BAR_W))
        bar_remain_w = BAR_W - bar_fill_w
        bar_fill_color = (light_tint(color_hex, 0.65) if printable else pat_color)
        bar_track_color = (HexColor("#F1F5F9") if printable else HexColor("#EEF2FF"))

        bar_fill = Table([[""]],
            colWidths=[bar_fill_w], rowHeights=[11])
        bar_fill.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), bar_fill_color),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

        bar_container = Table(
            [[bar_fill, ""]],
            colWidths=[bar_fill_w, bar_remain_w],
            rowHeights=[11],
        )
        bar_container.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), bar_track_color),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))

        full_data.append([rank_p, name_p, diff_p, bar_container, count_p])

        # Per-row colors
        rank_bg = (light_tint(color_hex, 0.65) if printable else pat_color)
        style_cmds.append(("BACKGROUND", (0, i), (0, i), rank_bg))
        style_cmds.append(("BACKGROUND", (1, i), (-1, i), row_bg))     # rest: subtle tint or white

    tbl = Table(full_data, colWidths=[RANK_W, NAME_W, DIFF_W, BAR_W, COUNT_W])
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.4, color=GRAY_200, spaceAfter=4))
    story.append(Paragraph(
        "LeetMastery  &#183;  leetcodemr.com  &#183;  "
        "Each question assigned to its primary pattern",
        footer_style,
    ))

    doc.build(story)
    kb = output_path.stat().st_size // 1024
    print(f"  {output_path}  ({kb} KB)")


if __name__ == "__main__":
    if not QUESTIONS.exists():
        raise SystemExit(f"Not found: {QUESTIONS}")
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--print",
        action="store_true",
        help=f"Generate print-safe colored PDF → {OUTPUT_PRINT.name}",
    )
    ap.add_argument(
        "--output",
        default=None,
        help="Override output path",
    )
    args = ap.parse_args()

    out = Path(args.output) if args.output else (OUTPUT_PRINT if args.print else OUTPUT_COLORED)
    make_pdf(out, printable=args.print)

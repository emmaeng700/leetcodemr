"""
Generate LeetMastery_All_21_Patterns_Print.pdf (1 page, COLORED, all-bold).

This script intentionally lives under patterns_pdf/ to match your expected layout.

Output:
  patterns_pdf/LeetMastery_All_21_Patterns_Print.pdf

Usage:
  python3 patterns_pdf/generate_LeetMastery_All_21_Patterns_Print.py
"""

import json
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable


SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
QUESTIONS = PROJECT_DIR / "public" / "questions_full.json"
OUTPUT = SCRIPT_DIR / "LeetMastery_All_21_Patterns_Print.pdf"

WHITE = white
DARK = HexColor("#0B1220")
GRAY_600 = HexColor("#475569")
GRAY_200 = HexColor("#CBD5E1")

# Bright but not neon; chosen to be consistent (avoid “random grey” feeling).
HEADER_BG = HexColor("#1D4ED8")  # blue-700
BAR_TRACK = HexColor("#E2E8F0")  # slate-200 (light, not dim)

PATTERN_COLORS = {
    "Bit Manipulation":    "#4F46E5",
    "Trie":                "#7C3AED",
    "Heap":                "#A855F7",
    "Stack":               "#F59E0B",
    "Sliding Window":      "#06B6D4",
    "Backtracking":        "#F43F5E",
    "Linked List":         "#EC4899",
    "Trees & BST":         "#16A34A",
    "DFS":                 "#6366F1",
    "BFS":                 "#3B82F6",
    "Graphs":              "#EF4444",
    "Matrix":              "#059669",
    "Two Pointers":        "#10B981",
    "Binary Search":       "#F97316",
    "Dynamic Programming": "#D946EF",
    "Greedy":              "#22C55E",
    "Sorting":             "#84CC16",
    "Math":                "#0EA5E9",
    "String":              "#38BDF8",
    "JavaScript":          "#EAB308",
    "Arrays & Hashing":    "#2563EB",
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


def _xml_safe(s: str) -> str:
    return s.replace("&", "&amp;")


def _light_tint(hex_color: str, factor: float = 0.10) -> HexColor:
    """Blend color toward white. Lower factor => lighter tint (safer behind text)."""
    c = HexColor(hex_color)
    r = int((c.red * factor + 1.0 * (1 - factor)) * 255)
    g = int((c.green * factor + 1.0 * (1 - factor)) * 255)
    b = int((c.blue * factor + 1.0 * (1 - factor)) * 255)
    return HexColor(f"#{r:02X}{g:02X}{b:02X}")


def _assign_pattern(q_tags):
    tag_set = set(q_tags or [])
    for pat in QUICK_PATTERNS:
        if tag_set & set(pat["tags"]):
            return pat["name"]
    return "Arrays & Hashing"


def _build_summary():
    questions = json.loads(QUESTIONS.read_text())
    stats = {p["name"]: {"total": 0, "E": 0, "M": 0, "H": 0} for p in QUICK_PATTERNS}
    assigned = set()
    for q in questions:
        if q.get("id") in assigned:
            continue
        assigned.add(q.get("id"))
        pat = _assign_pattern(q.get("tags", []))
        stats[pat]["total"] += 1
        d = q.get("difficulty", "")
        if d == "Easy":
            stats[pat]["E"] += 1
        elif d == "Medium":
            stats[pat]["M"] += 1
        elif d == "Hard":
            stats[pat]["H"] += 1
    rows = sorted(stats.items(), key=lambda x: x[1]["total"])
    return rows, len(questions)


def main():
    if not QUESTIONS.exists():
        raise SystemExit(f"Not found: {QUESTIONS}")
    SCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    rows, total_qs = _build_summary()

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.45 * inch,
    )
    W = letter[0] - 1.2 * inch

    # Column widths
    RANK_W = 0.36 * inch
    NAME_W = 2.35 * inch
    DIFF_W = 1.25 * inch
    COUNT_W = 0.58 * inch
    BAR_W = W - RANK_W - NAME_W - DIFF_W - COUNT_W

    banner_title = ParagraphStyle(
        "bt", fontSize=18, fontName="Helvetica-Bold",
        textColor=WHITE, alignment=TA_CENTER, leading=22,
    )
    banner_sub = ParagraphStyle(
        "bs", fontSize=9, fontName="Helvetica-Bold",
        textColor=HexColor("#DBEAFE"), alignment=TA_CENTER, leading=11,
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

    hdr = Table(
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
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story += [hdr, Spacer(1, 6)]

    max_total = max(v["total"] for _, v in rows)
    data = []
    style_cmds = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.35, GRAY_200),
    ]

    for i, (name, s) in enumerate(rows):
        color_hex = PATTERN_COLORS.get(name, "#2563EB")
        pat_color = HexColor(color_hex)
        row_bg = _light_tint(color_hex, 0.06) if i % 2 == 1 else WHITE

        rank = Paragraph(
            f"<font color='white'><b>#{i+1}</b></font>",
            ParagraphStyle(f"rk{i}", fontSize=9, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=11),
        )
        safe_name = _xml_safe(name)
        name_p = Paragraph(
            f"<font color='{color_hex}' size='13'><b>\u25cf</b></font>&nbsp;&nbsp;<b>{safe_name}</b>",
            name_style,
        )
        diff_p = Paragraph(
            f"<font color='#16A34A'><b>E:{s['E']}</b></font>  "
            f"<font color='#D97706'><b>M:{s['M']}</b></font>  "
            f"<font color='#DC2626'><b>H:{s['H']}</b></font>",
            diff_style,
        )
        count_p = Paragraph(f"<font color='{color_hex}'><b>{s['total']}</b></font>", count_style)

        bar_fill_w = min(BAR_W - 2, max(4.0, (s["total"] / max_total) * BAR_W))
        bar_rem_w = BAR_W - bar_fill_w
        bar_fill = Table([[""]], colWidths=[bar_fill_w], rowHeights=[11])
        bar_fill.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), pat_color),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        bar = Table([[bar_fill, ""]], colWidths=[bar_fill_w, bar_rem_w], rowHeights=[11])
        bar.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BAR_TRACK),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        data.append([rank, name_p, diff_p, bar, count_p])
        style_cmds.append(("BACKGROUND", (0, i), (0, i), pat_color))
        style_cmds.append(("BACKGROUND", (1, i), (-1, i), row_bg))

    tbl = Table(data, colWidths=[RANK_W, NAME_W, DIFF_W, BAR_W, COUNT_W])
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    story += [
        Spacer(1, 8),
        HRFlowable(width="100%", thickness=0.4, color=GRAY_200, spaceAfter=4),
        Paragraph("LeetMastery  &#183;  leetcodemr.com", footer_style),
    ]

    doc.build(story)
    print(f"✅  {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()


"""
LeetMastery — Patterns Summary (1 page)
Ranks all 21 patterns by number of questions, ascending.

Usage:
  python3 generate_patterns_summary.py
  → LeetMastery_Patterns_Summary.pdf
"""

import json
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
QUESTIONS  = SCRIPT_DIR / "public" / "questions_full.json"
OUTPUT     = SCRIPT_DIR / "LeetMastery_Patterns_Summary.pdf"

# ── Colors (match main PDF palette) ────────────────────────────────────────────
INDIGO     = HexColor("#4F46E5")
GRAY_900   = HexColor("#111827")
GRAY_700   = HexColor("#374151")
GRAY_500   = HexColor("#6B7280")
GRAY_200   = HexColor("#E5E7EB")
GRAY_100   = HexColor("#F3F4F6")
WHITE      = white

EASY_BG    = HexColor("#D1FAE5")
EASY_FG    = HexColor("#065F46")
MED_BG     = HexColor("#FEF3C7")
MED_FG     = HexColor("#92400E")
HARD_BG    = HexColor("#FEE2E2")
HARD_FG    = HexColor("#991B1B")

# Pattern colours (same as QUICK_PATTERNS in main script)
PATTERN_COLORS = {
    "Bit Manipulation":    "#0F172A",
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
    "Math":                "#64748B",
    "String":              "#0EA5E9",
    "JavaScript":          "#EAB308",
    "Arrays & Hashing":    "#4F46E5",
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

def tint_hex(hex_color, factor=0.35):
    """Blend a hex colour toward white (factor 1.0 = full colour, 0.0 = white).
    Used so bar charts print clearly on B&W printers without heavy ink use."""
    c = HexColor(hex_color)
    r = int((c.red   * factor + 1.0 * (1 - factor)) * 255)
    g = int((c.green * factor + 1.0 * (1 - factor)) * 255)
    b = int((c.blue  * factor + 1.0 * (1 - factor)) * 255)
    return "#{:02X}{:02X}{:02X}".format(r, g, b)


def assign_pattern(q_tags):
    """Return first matching pattern name for a question's tags."""
    tag_set = set(q_tags)
    for pat in QUICK_PATTERNS:
        if tag_set & set(pat["tags"]):
            return pat["name"]
    return "Arrays & Hashing"

def build_summary():
    with open(QUESTIONS) as f:
        questions = json.load(f)

    # Count per pattern + difficulty breakdown
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
        if d == "Easy":   stats[pat]["E"] += 1
        elif d == "Medium": stats[pat]["M"] += 1
        elif d == "Hard":   stats[pat]["H"] += 1

    # Sort ascending by total
    rows = sorted(stats.items(), key=lambda x: x[1]["total"])
    return rows, len(questions)


def make_pdf():
    rows, total_qs = build_summary()

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.65*inch,
        rightMargin=0.65*inch,
        topMargin=0.55*inch,
        bottomMargin=0.5*inch,
    )

    W = letter[0] - 1.3*inch   # usable width

    # ── Styles ────────────────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "title",
        fontSize=22, fontName="Helvetica-Bold",
        textColor=GRAY_900, alignment=TA_CENTER, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "sub",
        fontSize=10, fontName="Helvetica",
        textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=14,
    )
    rank_style = ParagraphStyle(
        "rank", fontSize=9, fontName="Helvetica-Bold",
        textColor=GRAY_500, alignment=TA_CENTER,
    )
    name_style = ParagraphStyle(
        "name", fontSize=11, fontName="Helvetica-Bold",
        textColor=GRAY_900,
    )
    count_style = ParagraphStyle(
        "count", fontSize=13, fontName="Helvetica-Bold",
        textColor=GRAY_900, alignment=TA_RIGHT,
    )
    diff_style = ParagraphStyle(
        "diff", fontSize=8, fontName="Helvetica",
        textColor=GRAY_500, alignment=TA_RIGHT,
    )
    footer_style = ParagraphStyle(
        "footer", fontSize=8, fontName="Helvetica",
        textColor=GRAY_500, alignment=TA_CENTER,
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("LeetMastery by Pattern", title_style))
    story.append(Paragraph(
        f"21 patterns · {total_qs} questions total  ·  ranked by question count (ascending)",
        subtitle_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=GRAY_200, spaceAfter=10))

    # ── Bar chart scale ───────────────────────────────────────────────────────
    max_total = max(v["total"] for _, v in rows)
    BAR_MAX_W = W * 0.38   # fraction of row width for the bar

    # ── Table rows ────────────────────────────────────────────────────────────
    table_data = []

    for rank, (name, s) in enumerate(rows, 1):
        total = s["total"]
        e, m, h = s["E"], s["M"], s["H"]
        color_hex = PATTERN_COLORS.get(name, "#6366F1")
        pat_color = HexColor(color_hex)

        rank_cell = Paragraph(f"#{rank}", rank_style)

        # Colour dot + name
        name_cell = Paragraph(
            f"<font color='{color_hex}'>●</font>  {name}",
            name_style,
        )

        # Difficulty badges inline
        diff_cell = Paragraph(
            f"<font color='#065F46'>E:{e}</font>  "
            f"<font color='#92400E'>M:{m}</font>  "
            f"<font color='#991B1B'>H:{h}</font>",
            diff_style,
        )

        count_cell = Paragraph(f"<b>{total}</b>", count_style)

        table_data.append([rank_cell, name_cell, diff_cell, count_cell])

    # Column widths: rank | name | diff badges | count
    col_w = [0.38*inch, 2.3*inch, 1.35*inch, 0.6*inch]
    # remaining width goes to a bar column
    bar_col_w = W - sum(col_w)

    # Build bar column separately and insert at position 3
    full_data = []
    for i, (rank, (name, s)) in enumerate(enumerate(rows, 1)):
        total = s["total"]
        color_hex = PATTERN_COLORS.get(name, "#6366F1")
        bar_w = (total / max_total) * bar_col_w
        # Draw a simple filled rectangle as a progress bar via a nested Table
        bar_inner = Table(
            [[""]],
            colWidths=[bar_w],
            rowHeights=[10],
        )
        bar_inner.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), HexColor(tint_hex(color_hex))),
            ("TOPPADDING",    (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ]))
        # Wrap bar in a cell-width container
        bar_container = Table(
            [[bar_inner, ""]],
            colWidths=[bar_w, bar_col_w - bar_w],
            rowHeights=[10],
        )
        bar_container.setStyle(TableStyle([
            ("TOPPADDING",    (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 0),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ]))

        row_cells = list(table_data[i])
        row_cells.insert(3, bar_container)   # insert bar before count
        full_data.append(row_cells)

    final_col_w = col_w[:3] + [bar_col_w, col_w[3]]

    tbl = Table(full_data, colWidths=final_col_w, repeatRows=0)

    row_styles = [
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 4),
        ("RIGHTPADDING",  (0,0), (-1,-1), 4),
        ("LINEBELOW",     (0,0), (-1,-2), 0.4, GRAY_200),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [WHITE, GRAY_100]),
    ]
    tbl.setStyle(TableStyle(row_styles))

    story.append(tbl)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_200, spaceAfter=6))
    story.append(Paragraph(
        "LeetMastery · leetcodemr.com  ·  Each question assigned to its primary pattern",
        footer_style,
    ))

    doc.build(story)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT}  ({kb} KB)")


if __name__ == "__main__":
    if not QUESTIONS.exists():
        raise SystemExit(f"✗ Not found: {QUESTIONS}")
    make_pdf()

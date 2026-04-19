"""
LeetMastery — Study Progress Tracker
Printable checklist of all 331 questions, grouped by pattern,
ordered fewest → most questions (your study priority order).

Usage:
  python3 generate_progress_tracker.py
  → LeetMastery_Progress_Tracker.pdf
"""

import json
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)

SCRIPT_DIR = Path(__file__).parent
QUESTIONS  = SCRIPT_DIR / "public" / "questions_full.json"
OUTPUT     = SCRIPT_DIR / "LeetMastery_Progress_Tracker.pdf"

G900 = HexColor("#111827"); G700 = HexColor("#374151")
G500 = HexColor("#6B7280"); G300 = HexColor("#D1D5DB")
G200 = HexColor("#E5E7EB"); G100 = HexColor("#F3F4F6")
G50  = HexColor("#F9FAFB"); WHITE = white

EASY_BG  = HexColor("#D1FAE5"); EASY_FG  = HexColor("#065F46")
MED_BG   = HexColor("#FEF3C7"); MED_FG   = HexColor("#92400E")
HARD_BG  = HexColor("#FEE2E2"); HARD_FG  = HexColor("#991B1B")

# ── Assignment order: MUST match generate_patterns_pdf.py exactly ─────────────
# Arrays & Hashing is LAST so it acts as a catch-all for generic Array/Hash tags.
# Changing this order causes questions to fall into the wrong pattern bucket.
ASSIGN_PATTERNS = [
    {"name":"Bit Manipulation",    "tags":["Bit Manipulation"],                                "color":"#0F172A"},
    {"name":"Trie",                "tags":["Trie"],                                            "color":"#7C3AED"},
    {"name":"Heap",                "tags":["Heap","Heap (Priority Queue)"],                   "color":"#A855F7"},
    {"name":"Stack",               "tags":["Stack","Monotonic Stack","Monotonic Queue"],      "color":"#F59E0B"},
    {"name":"Sliding Window",      "tags":["Sliding Window"],                                  "color":"#06B6D4"},
    {"name":"Backtracking",        "tags":["Backtracking"],                                    "color":"#F43F5E"},
    {"name":"Linked List",         "tags":["Linked List","Doubly-Linked List"],               "color":"#EC4899"},
    {"name":"Trees & BST",         "tags":["Tree","Binary Tree","Binary Search Tree","BST"],  "color":"#16A34A"},
    {"name":"DFS",                 "tags":["DFS","Depth-First Search"],                       "color":"#6366F1"},
    {"name":"BFS",                 "tags":["BFS","Breadth-First Search"],                     "color":"#3B82F6"},
    {"name":"Graphs",              "tags":["Graph","Union Find","Topological Sort"],          "color":"#EF4444"},
    {"name":"Matrix",              "tags":["Matrix"],                                          "color":"#059669"},
    {"name":"Two Pointers",        "tags":["Two Pointers"],                                    "color":"#10B981"},
    {"name":"Binary Search",       "tags":["Binary Search"],                                   "color":"#F97316"},
    {"name":"Dynamic Programming", "tags":["Dynamic Programming","Memoization"],              "color":"#D946EF"},
    {"name":"Greedy",              "tags":["Greedy"],                                          "color":"#22C55E"},
    {"name":"Sorting",             "tags":["Sorting","Divide and Conquer"],                   "color":"#84CC16"},
    {"name":"Math",                "tags":["Math","Number Theory","Simulation"],               "color":"#64748B"},
    {"name":"String",              "tags":["String"],                                          "color":"#0EA5E9"},
    {"name":"JavaScript",          "tags":["JavaScript","Concurrency"],                        "color":"#EAB308"},
    {"name":"Arrays & Hashing",    "tags":["Array","Hash Table","Prefix Sum"],                 "color":"#4F46E5"},
]

DIFF_ORDER = {"Easy": 0, "Medium": 1, "Hard": 2}

def assign_pattern(q_tags):
    """Assign a question to its primary pattern using the fixed priority order."""
    tag_set = set(q_tags)
    for pat in ASSIGN_PATTERNS:
        if tag_set & set(pat["tags"]):
            return pat["name"]
    return "Arrays & Hashing"

def load_groups():
    with open(QUESTIONS) as f:
        questions = json.load(f)

    pat_meta = {p["name"]: p for p in ASSIGN_PATTERNS}
    groups   = {p["name"]: [] for p in ASSIGN_PATTERNS}
    seen = set()
    for q in questions:
        if q["id"] in seen:
            continue
        seen.add(q["id"])
        pat = assign_pattern(q.get("tags", []))
        groups[pat].append(q)
    for name in groups:
        groups[name].sort(key=lambda q: (DIFF_ORDER.get(q.get("difficulty",""), 1), q["id"]))
    # Sort patterns by ascending question count (fewest → most) for study priority display
    pat_list = sorted(ASSIGN_PATTERNS, key=lambda p: len(groups[p["name"]]))
    return [(p, groups[p["name"]]) for p in pat_list]

def make_pdf():
    groups = load_groups()
    total  = sum(len(qs) for _, qs in groups)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.45*inch, rightMargin=0.45*inch,
        topMargin=0.4*inch,  bottomMargin=0.4*inch,
    )
    PW = letter[0] - 0.9*inch

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    title_s  = S("ti", fontSize=16, fontName="Helvetica-Bold",
                 textColor=G900, alignment=TA_CENTER, spaceAfter=2)
    sub_s    = S("su", fontSize=8,  fontName="Helvetica",
                 textColor=G500, alignment=TA_CENTER, spaceAfter=8)
    foot_s   = S("ft", fontSize=7,  fontName="Helvetica",
                 textColor=G500, alignment=TA_CENTER)
    q_s      = S("qs", fontSize=7,  fontName="Helvetica",
                 textColor=G700, leading=9)
    num_s    = S("ns", fontSize=6.5,fontName="Helvetica",
                 textColor=G500, leading=9, alignment=TA_RIGHT)

    # ── Instruction strip ──────────────────────────────────────────────────────
    key_data = [[
        Paragraph("☐ Understood", S("ki", fontSize=7, fontName="Helvetica", textColor=G700)),
        Paragraph("☐ Brute coded", S("ki", fontSize=7, fontName="Helvetica", textColor=G700)),
        Paragraph("☐ Optimal coded", S("ki", fontSize=7, fontName="Helvetica", textColor=G700)),
        Paragraph("☐ Can explain cold", S("ki", fontSize=7, fontName="Helvetica", textColor=G700)),
        Paragraph(
            '<font color="#065F46"><b>E</b></font>  '
            '<font color="#92400E"><b>M</b></font>  '
            '<font color="#991B1B"><b>H</b></font>  = difficulty',
            S("ki2", fontSize=7, fontName="Helvetica", textColor=G700)
        ),
    ]]
    key_tbl = Table(key_data, colWidths=[PW/5]*5)
    key_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), G100),
        ("BOX",           (0,0),(-1,-1), 0.5, G300),
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))

    story = []
    story.append(Paragraph("LeetMastery — Study Progress Tracker", title_s))
    story.append(Paragraph(
        f"331 questions · 21 patterns · ordered fewest → most questions  "
        f"(finish small patterns first, have more time for large ones)",
        sub_s,
    ))
    story.append(key_tbl)
    story.append(Spacer(1, 10))

    # ── Per-pattern blocks ─────────────────────────────────────────────────────
    COL_W = (PW - 0.1*inch) / 2    # two-column layout for question rows
    GAP   = 0.1*inch

    for pat, qs in groups:
        if not qs:
            continue
        color = HexColor(pat["color"])
        n_e   = sum(1 for q in qs if q.get("difficulty")=="Easy")
        n_m   = sum(1 for q in qs if q.get("difficulty")=="Medium")
        n_h   = sum(1 for q in qs if q.get("difficulty")=="Hard")

        # Banner
        banner_text = (
            f'<font color="white"><b>{pat["name"]}</b></font>  '
            f'<font color="#ffffff99" size="8">  {len(qs)} questions  ·  '
            f'E:{n_e}  M:{n_m}  H:{n_h}</font>'
        )
        banner_p = Paragraph(banner_text,
                             S("bn", fontSize=10, fontName="Helvetica-Bold",
                               textColor=white, leading=13))
        banner = Table([[banner_p]], colWidths=[PW])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), color),
            ("TOPPADDING",    (0,0),(-1,-1), 5),
            ("BOTTOMPADDING", (0,0),(-1,-1), 5),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ]))
        story.append(banner)

        # Questions in 2-column grid
        # Each question row: [checkbox+title | id+diff]
        def q_row(q):
            diff = q.get("difficulty", "")
            if diff == "Easy":
                d_str = f'<font color="#065F46"><b>E</b></font>'
            elif diff == "Medium":
                d_str = f'<font color="#92400E"><b>M</b></font>'
            else:
                d_str = f'<font color="#991B1B"><b>H</b></font>'

            title_cell = Paragraph(
                f'☐  {q["title"]}',
                S(f'qr{q["id"]}', fontSize=7, fontName="Helvetica",
                  textColor=G700, leading=9)
            )
            meta_cell = Paragraph(
                f'#{q["id"]}  {d_str}',
                S(f'qm{q["id"]}', fontSize=6.5, fontName="Helvetica",
                  textColor=G500, leading=9, alignment=TA_RIGHT)
            )
            return [title_cell, meta_cell]

        # Split questions into two columns
        half = (len(qs) + 1) // 2
        left_qs  = qs[:half]
        right_qs = qs[half:]

        # Build left and right cell contents
        def build_col(q_list):
            if not q_list:
                return Spacer(1, 1)
            rows = [q_row(q) for q in q_list]
            col_tbl = Table(rows, colWidths=[COL_W - 0.55*inch, 0.55*inch])
            col_tbl.setStyle(TableStyle([
                ("TOPPADDING",    (0,0),(-1,-1), 2.5),
                ("BOTTOMPADDING", (0,0),(-1,-1), 2.5),
                ("LEFTPADDING",   (0,0),(-1,-1), 6),
                ("RIGHTPADDING",  (0,0),(-1,-1), 4),
                ("LINEBELOW",     (0,0),(-1,-2), 0.25, G200),
                ("ROWBACKGROUNDS",(0,0),(-1,-1), [WHITE, G50]),
                ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ]))
            return col_tbl

        grid_row = [[build_col(left_qs), build_col(right_qs)]]
        grid = Table(grid_row, colWidths=[COL_W, COL_W])
        grid.setStyle(TableStyle([
            ("VALIGN",        (0,0),(-1,-1), "TOP"),
            ("LEFTPADDING",   (0,0),(-1,-1), 0),
            ("RIGHTPADDING",  (0,0),(0,-1),  int(GAP)),
            ("RIGHTPADDING",  (1,0),(1,-1),  0),
            ("TOPPADDING",    (0,0),(-1,-1), 0),
            ("BOTTOMPADDING", (0,0),(-1,-1), 0),
            ("BOX",           (0,0),(-1,-1), 0.4, G200),
        ]))
        story.append(grid)
        story.append(Spacer(1, 8))

    # ── Summary totals footer ──────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=G200, spaceAfter=4))
    story.append(Paragraph(
        f"Total: {total} questions across 21 patterns  ·  LeetMastery · leetcodemr.com",
        foot_s,
    ))

    doc.build(story)
    import os
    kb = os.path.getsize(OUTPUT) // 1024
    print(f"✅  {OUTPUT}  ({kb} KB)")

if __name__ == "__main__":
    if not QUESTIONS.exists():
        raise SystemExit(f"✗ Not found: {QUESTIONS}")
    make_pdf()

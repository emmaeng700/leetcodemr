"""
LeetMastery — Complexity · Interview Framework · Study Progress Tracker
Bold Black Print Edition · 6-up Landscape
=======================================================================
Native 264×306 mini-pages imposed 1:1 — LG-Bold / Menlo-Bold, crisp at any size.

Part 1 — Complexity Reference Card
Part 2 — Interview Talk-Through Framework
Part 3 — Study Progress Tracker (331 + NeetCode 32 "Not in 331")

Usage:
  python3 generate_reference_print6up.py
Output:
  LeetMastery_Reference_Print_6up_Landscape.pdf
"""

import json
from pathlib import Path
from collections import defaultdict

# ─── Fonts ─────────────────────────────────────────────────────────────────────
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
_LG = "/System/Library/Fonts/LucidaGrande.ttc"
_MN = "/System/Library/Fonts/Menlo.ttc"
try:
    pdfmetrics.registerFont(TTFont("LG",        _LG, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("LG-Bold",   _LG, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("Menlo",      _MN, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Menlo-Bold", _MN, subfontIndex=1))
except Exception:
    pass

from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, SimpleDocTemplate, Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import fitz

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
QUESTIONS  = SCRIPT_DIR / "public" / "questions_full.json"
INNER_PDF  = SCRIPT_DIR / "_reference_inner.pdf"
OUTPUT_PDF = SCRIPT_DIR / "LeetMastery_Reference_Print_6up_Landscape.pdf"

# ─── Mini-page dimensions ──────────────────────────────────────────────────────
MP_W  = 792.0 / 3    # 264 pts
MP_H  = 612.0 / 2    # 306 pts
MG    = 8.0
USE_W = MP_W - 2 * MG   # 248 pts
USE_H = MP_H - 2 * MG   # 290 pts

# ─── Colors ────────────────────────────────────────────────────────────────────
BLACK    = HexColor("#000000")
GRAY_700 = HexColor("#374151")
GRAY_500 = HexColor("#6B7280")
GRAY_300 = HexColor("#D1D5DB")
GRAY_200 = HexColor("#E5E7EB")
GRAY_100 = HexColor("#F3F4F6")
GRAY_50  = HexColor("#F9FAFB")

# ─── Styles ────────────────────────────────────────────────────────────────────
def _ps(name, **kw):
    return ParagraphStyle(name, **kw)

S = {
    "title":    _ps("ttl", fontName="LG-Bold",   fontSize=8,   textColor=BLACK,    leading=10, spaceAfter=1),
    "head2":    _ps("h2",  fontName="LG-Bold",   fontSize=6.5, textColor=BLACK,    leading=9,  spaceAfter=1),
    "body":     _ps("bd",  fontName="LG-Bold",   fontSize=6,   textColor=GRAY_700, leading=8,  spaceAfter=1),
    "body_sm":  _ps("bds", fontName="LG-Bold",   fontSize=5.8, textColor=GRAY_700, leading=7.5,spaceAfter=0),
    "code":     _ps("cd",  fontName="Menlo-Bold", fontSize=5.5, textColor=BLACK,    leading=7.5),
    "toc":      _ps("tc",  fontName="LG-Bold",   fontSize=7,   textColor=BLACK,    leading=10),
    "cov_ttl":  _ps("ct",  fontName="LG-Bold",   fontSize=13,  textColor=BLACK,    alignment=TA_CENTER, leading=16),
    "cov_sub":  _ps("cs",  fontName="LG-Bold",   fontSize=7,   textColor=GRAY_700, alignment=TA_CENTER, leading=10),
    "tbl_hdr":  _ps("th",  fontName="LG-Bold",   fontSize=5.5, textColor=BLACK,    alignment=TA_CENTER, leading=7),
    "tbl_key":  _ps("tk",  fontName="LG-Bold",   fontSize=5.5, textColor=BLACK,    leading=7),
    "tbl_val":  _ps("tv",  fontName="LG-Bold",   fontSize=5.2, textColor=GRAY_700, alignment=TA_CENTER, leading=7),
    "tbl_mono": _ps("tm",  fontName="Menlo-Bold", fontSize=5,   textColor=BLACK,    alignment=TA_CENTER, leading=7),
    "check":    _ps("ck",  fontName="LG-Bold",   fontSize=6,   textColor=GRAY_700, leading=8),
    "check_id": _ps("ci",  fontName="LG-Bold",   fontSize=5.5, textColor=GRAY_500, leading=8, alignment=TA_RIGHT),
}

# ─── Helpers ───────────────────────────────────────────────────────────────────
def safe_xml(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def hr(color=GRAY_300, thickness=0.4):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceBefore=2, spaceAfter=2)

def cat_bar(text: str) -> Table:
    t = Table([[Paragraph(f"<b>{safe_xml(text)}</b>",
        _ps("cb", fontName="LG-Bold", fontSize=5.5, textColor=BLACK))
    ]], colWidths=[USE_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0),(-1,-1), 2), ("BOTTOMPADDING",(0,0),(-1,-1), 2),
        ("LEFTPADDING",   (0,0),(-1,-1), 5), ("RIGHTPADDING",  (0,0),(-1,-1), 5),
        ("BOX",           (0,0),(-1,-1), 0.4, GRAY_300),
    ]))
    return t

def section_divider(label: str, sub: str = "") -> list:
    items = [Spacer(1, USE_H * 0.2)]
    banner = Table([[Paragraph(f"<b>{safe_xml(label)}</b>",
        _ps("sd", fontName="LG-Bold", fontSize=11, textColor=BLACK, alignment=TA_CENTER))
    ]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0),(-1,-1), 8), ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("BOX",           (0,0),(-1,-1), 0.6, GRAY_300),
    ]))
    items.append(banner)
    if sub:
        items.append(Spacer(1, 4))
        items.append(Paragraph(safe_xml(sub),
            _ps("sds", fontName="LG-Bold", fontSize=7, textColor=GRAY_500, alignment=TA_CENTER)))
    items.append(PageBreak())
    return items

def data_table(headers, rows, col_widths) -> Table:
    hdr = [Paragraph(h, S["tbl_hdr"]) for h in headers]
    data = [hdr]
    for i, row in enumerate(rows):
        data.append([
            Paragraph(str(c), S["tbl_key"] if j == 0 else S["tbl_mono"])
            for j, c in enumerate(row)
        ])
    tbl = Table(data, colWidths=col_widths)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  GRAY_100),
        ("LINEBELOW",     (0,0),(-1,0),  0.5, GRAY_300),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [white, GRAY_50]),
        ("LINEBELOW",     (0,1),(-1,-2), 0.25, GRAY_200),
        ("TOPPADDING",    (0,0),(-1,-1), 2), ("BOTTOMPADDING",(0,0),(-1,-1), 2),
        ("LEFTPADDING",   (0,0),(-1,-1), 4), ("RIGHTPADDING",  (0,0),(-1,-1), 4),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
        ("BOX",           (0,0),(-1,-1), 0.5, GRAY_300),
    ]))
    return tbl

def gray_box(inner: list) -> Table:
    t = Table([[inner]], colWidths=[USE_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0),(-1,-1), 3), ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",   (0,0),(-1,-1), 6), ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("BOX",           (0,0),(-1,-1), 0.3, GRAY_300),
    ]))
    return t

# ─── Page state (footer) ───────────────────────────────────────────────────────
_PAGE_STATE: dict = {"section": ""}

class SetSection(Flowable):
    def __init__(self, name: str):
        super().__init__(); self.name = name; self.width = 0; self.height = 0
    def draw(self):
        _PAGE_STATE["section"] = self.name
        c = self.canv; c.saveState()
        c.setFont("LG-Bold", 5); c.setFillColor(GRAY_500)
        c.drawString(MG, MG - 3, self.name); c.restoreState()

class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1; canvas.saveState()
        canvas.setFont("LG-Bold", 5); canvas.setFillColor(GRAY_500)
        canvas.drawRightString(MP_W - MG, MG - 3, f"p.{self.n}")
        if _PAGE_STATE["section"]:
            canvas.drawString(MG, MG - 3, _PAGE_STATE["section"])
        canvas.restoreState()


# ══════════════════════════════════════════════════════════════════════════════
# PART 1 — COMPLEXITY REFERENCE CARD
# ══════════════════════════════════════════════════════════════════════════════

def build_complexity(story: list):
    story += section_divider("Complexity Reference", "Data Structures · Sorting · Graphs · Patterns")
    story.append(SetSection("Complexity Reference"))

    # ── 1. Data Structure Operations ──────────────────────────────────────────
    story.append(cat_bar("Data Structure Operations"))
    story.append(Spacer(1, 2))
    ds_w = [72, 30, 30, 32, 32, 52]  # total = 248
    ds_h = ["Structure", "Access", "Search", "Insert", "Delete", "Space"]
    ds_rows = [
        ["Array",              "O(1)",     "O(n)",     "O(n)",      "O(n)",      "O(n)"],
        ["Sorted Array",       "O(1)",     "O(log n)", "O(n)",      "O(n)",      "O(n)"],
        ["Singly Linked List", "O(n)",     "O(n)",     "O(1) head", "O(1) head", "O(n)"],
        ["Doubly Linked List", "O(n)",     "O(n)",     "O(1)",      "O(1)",      "O(n)"],
        ["Stack / Queue",      "O(n)",     "O(n)",     "O(1)",      "O(1)",      "O(n)"],
        ["Hash Map / Set",     "O(1) avg", "O(1) avg", "O(1) avg",  "O(1) avg",  "O(n)"],
        ["Binary Min-Heap",    "O(n)",     "O(n)",     "O(log n)",  "O(log n)",  "O(n)"],
        ["BST (balanced)",     "O(log n)", "O(log n)", "O(log n)",  "O(log n)",  "O(n)"],
        ["BST (worst)",        "O(n)",     "O(n)",     "O(n)",      "O(n)",      "O(n)"],
        ["Trie",               "—",        "O(L)",     "O(L)",      "O(L)",      "O(n·L)"],
        ["Graph adj-list",     "—",        "O(V+E)",   "O(1)",      "O(E)",      "O(V+E)"],
        ["Graph adj-matrix",   "—",        "O(1)",     "O(1)",      "O(1)",      "O(V²)"],
    ]
    story.append(data_table(ds_h, ds_rows, ds_w))
    story.append(Paragraph(
        "L=key length  avg=average (good hash)  V=vertices  E=edges",
        _ps("nt", fontName="LG-Bold", fontSize=5, textColor=GRAY_500, leading=7, spaceAfter=4)))

    # ── 2. Sorting Algorithms ─────────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("Sorting Algorithms"))
    story.append(Spacer(1, 2))
    sort_w = [72, 44, 44, 44, 44]   # total = 248
    sort_h = ["Algorithm", "Best", "Average", "Worst", "Space"]
    sort_rows = [
        ["Bubble Sort",    "O(n)",      "O(n²)",     "O(n²)",     "O(1)"],
        ["Selection Sort", "O(n²)",     "O(n²)",     "O(n²)",     "O(1)"],
        ["Insertion Sort", "O(n)",      "O(n²)",     "O(n²)",     "O(1)"],
        ["Merge Sort",     "O(n log n)","O(n log n)","O(n log n)","O(n)"],
        ["Quick Sort",     "O(n log n)","O(n log n)","O(n²)",     "O(log n)"],
        ["Heap Sort",      "O(n log n)","O(n log n)","O(n log n)","O(1)"],
        ["Counting Sort",  "O(n+k)",    "O(n+k)",    "O(n+k)",    "O(k)"],
        ["Radix Sort",     "O(nk)",     "O(nk)",     "O(nk)",     "O(n+k)"],
        ["Tim Sort",       "O(n)",      "O(n log n)","O(n log n)","O(n)"],
    ]
    story.append(data_table(sort_h, sort_rows, sort_w))
    story.append(Paragraph(
        "k=range of values  Tim Sort used in Python/Java stdlib",
        _ps("nt2", fontName="LG-Bold", fontSize=5, textColor=GRAY_500, leading=7, spaceAfter=4)))

    # ── 3. Graph Algorithms ───────────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("Graph Algorithms"))
    story.append(Spacer(1, 2))
    graph_w = [88, 100, 60]   # total = 248
    graph_h = ["Algorithm", "Time", "Space"]
    graph_rows = [
        ["BFS",              "O(V+E)",       "O(V)"],
        ["DFS",              "O(V+E)",       "O(V)"],
        ["Dijkstra",         "O(E log V)",   "O(V)"],
        ["Bellman-Ford",     "O(V·E)",       "O(V)"],
        ["Floyd-Warshall",   "O(V³)",        "O(V²)"],
        ["Topological Sort", "O(V+E)",       "O(V)"],
        ["Kruskal MST",      "O(E log E)",   "O(V)"],
        ["Prim MST",         "O(E log V)",   "O(V)"],
        ["Union-Find",       "O(alpha(n))≈O(1)","O(n)"],
        ["Kosaraju SCC",     "O(V+E)",       "O(V)"],
    ]
    story.append(data_table(graph_h, graph_rows, graph_w))
    story.append(Paragraph(
        "alpha=inverse Ackermann (practically constant)",
        _ps("nt3", fontName="LG-Bold", fontSize=5, textColor=GRAY_500, leading=7, spaceAfter=4)))

    # ── 4. Search & DP Patterns ───────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("Search & DP Patterns"))
    story.append(Spacer(1, 2))
    other_w = [100, 88, 60]   # total = 248
    other_h = ["Pattern / Algorithm", "Time", "Space"]
    other_rows = [
        ["Linear Search",      "O(n)",          "O(1)"],
        ["Binary Search",      "O(log n)",      "O(1)"],
        ["Two Pointers",       "O(n)",          "O(1)"],
        ["Sliding Window",     "O(n)",          "O(k)"],
        ["Prefix Sum",         "O(n) build",    "O(n)"],
        ["DP 1-D",             "O(n)",          "O(n) -> O(1)"],
        ["DP 2-D",             "O(n·m)",        "O(n·m)"],
        ["Backtracking",       "O(2^n)/O(n!)", "O(n)"],
        ["Memoized Recursion", "= DP time",     "= DP space"],
        ["KMP String Search",  "O(n+m)",        "O(m)"],
    ]
    story.append(data_table(other_h, other_rows, other_w))
    story.append(Paragraph(
        "m=pattern length  k=window size  n×m=grid dimensions",
        _ps("nt4", fontName="LG-Bold", fontSize=5, textColor=GRAY_500, leading=7, spaceAfter=4)))

    # ── 5. n → Expected Complexity ────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("n → Expected Complexity"))
    story.append(Spacer(1, 2))
    nc_w = [55, 193]
    nc_rows = [
        ["n ≤ 10",       "O(n!)  /  O(2^n)   — backtracking / brute force"],
        ["n ≤ 20",       "O(2^n)   — bitmask DP / subsets"],
        ["n ≤ 100",      "O(n^3)   — triple nested loops"],
        ["n ≤ 1 000",    "O(n^2)   — nested loops, DP grid"],
        ["n ≤ 10^5",     "O(n log n)   — sort + scan, heap, binary search"],
        ["n ≤ 10^6",     "O(n)   — single pass, hash map"],
        ["n ≤ 10^9",     "O(log n) or O(1)   — math / binary search"],
    ]
    nc_data = []
    for r in nc_rows:
        nc_data.append([
            Paragraph(f"<b>{r[0]}</b>",
                _ps(f"nc_{r[0][:4]}", fontName="Menlo-Bold", fontSize=5.5,
                    textColor=BLACK, leading=7)),
            Paragraph(r[1],
                _ps(f"nv_{r[0][:4]}", fontName="LG-Bold", fontSize=5.8,
                    textColor=GRAY_700, leading=7)),
        ])
    nc_tbl = Table(nc_data, colWidths=nc_w)
    nc_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [white, GRAY_50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, GRAY_200),
        ("TOPPADDING",     (0,0),(-1,-1), 3), ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",    (0,0),(-1,-1), 5), ("RIGHTPADDING",  (0,0),(-1,-1), 5),
        ("BOX",            (0,0),(-1,-1), 0.5, GRAY_300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, GRAY_300),
        ("VALIGN",         (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(nc_tbl)
    story.append(PageBreak())


# ══════════════════════════════════════════════════════════════════════════════
# PART 2 — INTERVIEW TALK-THROUGH FRAMEWORK
# ══════════════════════════════════════════════════════════════════════════════

STEPS = [
    {
        "step": "Step 1 — UNDERSTAND  (3-5 min)",
        "do": [
            "Restate the problem in your own words out loud",
            "Ask: empty input? negatives? duplicates? overflow?",
            "Confirm what to return (index vs value, count vs list)",
            "Read constraints — they hint at expected complexity",
        ],
        "say": [
            '"Let me make sure I understand correctly..."',
            '"A few quick clarifying questions before I start..."',
            '"n up to 10^5 suggests O(n log n) or better"',
        ],
    },
    {
        "step": "Step 2 — MATCH a pattern  (1-2 min)",
        "do": [
            "Map signals to a pattern (use cheat sheet mentally)",
            "Say the pattern name out loud — shows structured thinking",
            "If unsure between 2 patterns, say both and explain why",
        ],
        "say": [
            '"This looks like sliding window — longest subarray with condition"',
            '"Sorted input + target sum signals two pointers"',
            '"Overlapping subproblems — I will reach for DP"',
        ],
    },
    {
        "step": "Step 3 — BRUTE FORCE  (2-3 min)",
        "do": [
            "Always state brute force — even if you know the optimal",
            "Say its complexity and WHY it is suboptimal",
            "Do NOT code it unless specifically asked",
        ],
        "say": [
            '"Naive approach: nested loops giving O(n²) time, O(1) space"',
            '"I won\'t implement that — let me think of something better"',
            '"The bottleneck: recomputing the same window from scratch"',
        ],
    },
    {
        "step": "Step 4 — OPTIMIZE  (3-5 min)",
        "do": [
            "Explain the key insight that unlocks the better approach",
            "Walk through ONE example by hand before coding",
            "State the new complexity explicitly",
        ],
        "say": [
            '"Trade O(n) space for time — hash map drops it to O(n)"',
            '"Array is sorted — binary search instead of scan: O(log n)"',
            '"Let me trace through this example before I code"',
        ],
    },
    {
        "step": "Step 5 — CODE + TEST  (15-20 min)",
        "do": [
            "Narrate as you code — never go silent",
            "Handle edge cases in code (empty, single, all-same)",
            "Run through the given example, then one edge case",
            "If stuck: say 'let me think' — never silent > 60 s",
        ],
        "say": [
            '"I\'ll use a dummy head to simplify edge cases"',
            '"Let me check the base case first — if input is empty..."',
            '"Running example 1... correct. Edge: empty input returns []"',
        ],
    },
]

def build_interview(story: list):
    story += section_divider("Interview Talk-Through", "5-Step Framework · Scoring · Flags")
    story.append(SetSection("Interview Framework"))

    # ── Steps ─────────────────────────────────────────────────────────────────
    story.append(cat_bar("The 5-Step Framework  (40-45 min total)"))
    story.append(Spacer(1, 2))

    do_st  = _ps("do",  fontName="LG-Bold", fontSize=5.8, textColor=GRAY_700, leading=7.5, leftIndent=6, spaceAfter=0)
    say_st = _ps("say", fontName="LG-Bold", fontSize=5.5, textColor=GRAY_500, leading=7,   leftIndent=6, spaceAfter=0)

    for s in STEPS:
        inner = [
            Paragraph(f"<b>{safe_xml(s['step'])}</b>",
                _ps(f"sh_{s['step'][:4]}", fontName="LG-Bold", fontSize=6.5,
                    textColor=BLACK, leading=9, spaceAfter=2)),
        ]
        for d in s["do"]:
            inner.append(Paragraph(f"• {safe_xml(d)}", do_st))
        inner.append(Spacer(1, 3))
        inner.append(Paragraph("<b>Say:</b>", _ps("sl", fontName="LG-Bold", fontSize=5.5,
                               textColor=GRAY_500, leading=7, spaceAfter=1)))
        for p in s["say"]:
            inner.append(Paragraph(f"  {safe_xml(p)}", say_st))
        story.append(gray_box(inner))
        story.append(Spacer(1, 3))

    # ── What interviewers score ───────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("What Interviewers Score"))
    story.append(Spacer(1, 2))
    scores = [
        ("Communication",   "Narrate your thinking. Never silent > 60 seconds."),
        ("Problem Solving", "Brute → insight → optimal. Show the full journey."),
        ("Code Quality",    "Readable names, no magic numbers, consistent style."),
        ("Testing",         "Check edge cases yourself before the interviewer asks."),
        ("Adaptability",    "Take hints gracefully. Update approach without ego."),
        ("Correctness",     "Working solution first — optimise only if time allows."),
    ]
    sc_w = [68, 180]
    sc_data = [[
        Paragraph(f"<b>{s[0]}</b>", _ps(f"sk_{s[0][:3]}", fontName="LG-Bold", fontSize=5.8,
                                         textColor=BLACK, leading=7)),
        Paragraph(s[1], _ps(f"sv_{s[0][:3]}", fontName="LG-Bold", fontSize=5.8,
                             textColor=GRAY_700, leading=7)),
    ] for s in scores]
    sc_tbl = Table(sc_data, colWidths=sc_w)
    sc_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [white, GRAY_50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, GRAY_200),
        ("TOPPADDING",     (0,0),(-1,-1), 3), ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",    (0,0),(-1,-1), 5), ("RIGHTPADDING",  (0,0),(-1,-1), 5),
        ("BOX",            (0,0),(-1,-1), 0.5, GRAY_300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, GRAY_300),
        ("VALIGN",         (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(sc_tbl)

    # ── Green / Red flags ─────────────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(cat_bar("Green Flags  vs  Red Flags"))
    story.append(Spacer(1, 2))
    green_flags = [
        "Ask 2-3 clarifying questions before coding",
        "Name the pattern out loud before solving",
        "State brute force + complexity before optimising",
        "Walk through an example by hand before coding",
        "Catch your own bugs during the trace",
        "Say 'let me think' — never go silent",
        "Offer to test edge cases proactively",
    ]
    red_flags = [
        "Silent for > 60 seconds without narrating",
        "Jump straight to code without any explanation",
        "Ignore edge cases (empty, null, overflow)",
        "Present optimal with no mention of brute force",
        "Get defensive when interviewer hints at issues",
        "Spend > 5 min on brute force when optimal is clear",
        "Not test the solution before declaring done",
    ]
    gf_w = [USE_W / 2, USE_W / 2]
    gf_data = []
    for g, r in zip(green_flags, red_flags):
        gf_data.append([
            Paragraph(f"[OK] {safe_xml(g)}",
                _ps(f"gf_{g[:5]}", fontName="LG-Bold", fontSize=5.8,
                    textColor=GRAY_700, leading=7.5)),
            Paragraph(f"[X]  {safe_xml(r)}",
                _ps(f"rf_{r[:5]}", fontName="LG-Bold", fontSize=5.8,
                    textColor=GRAY_700, leading=7.5)),
        ])
    gf_tbl = Table(gf_data, colWidths=gf_w)
    gf_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [white, GRAY_50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, GRAY_200),
        ("TOPPADDING",     (0,0),(-1,-1), 3), ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",    (0,0),(-1,-1), 5), ("RIGHTPADDING",  (0,0),(-1,-1), 5),
        ("BOX",            (0,0),(-1,-1), 0.5, GRAY_300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, GRAY_300),
        ("VALIGN",         (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(gf_tbl)
    story.append(Spacer(1, 2))
    story.append(Paragraph("[OK] = green flag — do this    [X] = red flag — avoid this",
        _ps("leg", fontName="LG-Bold", fontSize=5, textColor=GRAY_500,
            alignment=TA_CENTER, leading=7)))
    story.append(PageBreak())


# ══════════════════════════════════════════════════════════════════════════════
# PART 3 — STUDY PROGRESS TRACKER
# ══════════════════════════════════════════════════════════════════════════════

ASSIGN_PATTERNS = [
    {"name":"Bit Manipulation",    "tags":["Bit Manipulation"]},
    {"name":"Trie",                "tags":["Trie"]},
    {"name":"Heap",                "tags":["Heap","Heap (Priority Queue)"]},
    {"name":"Stack",               "tags":["Stack","Monotonic Stack","Monotonic Queue"]},
    {"name":"Sliding Window",      "tags":["Sliding Window"]},
    {"name":"Backtracking",        "tags":["Backtracking"]},
    {"name":"Linked List",         "tags":["Linked List","Doubly-Linked List"]},
    {"name":"Trees & BST",         "tags":["Tree","Binary Tree","Binary Search Tree","BST"]},
    {"name":"DFS",                 "tags":["DFS","Depth-First Search"]},
    {"name":"BFS",                 "tags":["BFS","Breadth-First Search"]},
    {"name":"Graphs",              "tags":["Graph","Union Find","Topological Sort"]},
    {"name":"Matrix",              "tags":["Matrix"]},
    {"name":"Two Pointers",        "tags":["Two Pointers"]},
    {"name":"Binary Search",       "tags":["Binary Search"]},
    {"name":"Dynamic Programming", "tags":["Dynamic Programming","Memoization"]},
    {"name":"Greedy",              "tags":["Greedy"]},
    {"name":"Sorting",             "tags":["Sorting","Divide and Conquer"]},
    {"name":"Math",                "tags":["Math","Number Theory","Simulation"]},
    {"name":"String",              "tags":["String"]},
    {"name":"JavaScript",          "tags":["JavaScript","Concurrency"]},
    {"name":"Arrays & Hashing",    "tags":["Array","Hash Table","Prefix Sum"]},
]
DIFF_ORDER = {"Easy": 0, "Medium": 1, "Hard": 2}

def assign_pattern(tags):
    tag_set = set(tags)
    for pat in ASSIGN_PATTERNS:
        if tag_set & set(pat["tags"]):
            return pat["name"]
    return "Arrays & Hashing"

def load_groups():
    questions = json.loads(QUESTIONS.read_text())
    groups = {p["name"]: [] for p in ASSIGN_PATTERNS}
    seen = set()
    for q in questions:
        if q["id"] in seen: continue
        seen.add(q["id"])
        pat = assign_pattern(q.get("tags", []))
        groups[pat].append(q)
    for name in groups:
        groups[name].sort(key=lambda q: (DIFF_ORDER.get(q.get("difficulty",""), 1), q["id"]))
    pat_list = sorted(ASSIGN_PATTERNS, key=lambda p: len(groups[p["name"]]))
    return [(p, groups[p["name"]]) for p in pat_list]

def q_row_flowable(q: dict) -> list:
    diff = q.get("difficulty", "")
    d_str = {"Easy": "E", "Medium": "M", "Hard": "H"}.get(diff, "?")
    title_cell = Paragraph(
        f"[  ]  {safe_xml(q['title'])}",
        _ps(f"qr{q['id']}", fontName="LG-Bold", fontSize=6, textColor=GRAY_700, leading=8))
    meta_cell  = Paragraph(
        f"#{q['id']}  <b>{d_str}</b>",
        _ps(f"qm{q['id']}", fontName="LG-Bold", fontSize=5.5, textColor=GRAY_500,
            leading=8, alignment=TA_RIGHT))
    return [title_cell, meta_cell]

def build_pattern_block(pat_name: str, qs: list, story: list):
    n_e = sum(1 for q in qs if q.get("difficulty") == "Easy")
    n_m = sum(1 for q in qs if q.get("difficulty") == "Medium")
    n_h = sum(1 for q in qs if q.get("difficulty") == "Hard")

    # Banner
    banner_p = Paragraph(
        f"<b>{safe_xml(pat_name)}</b>   "
        f"<font size='5'>{len(qs)} q  |  E:{n_e}  M:{n_m}  H:{n_h}</font>",
        _ps(f"bn_{pat_name[:6]}", fontName="LG-Bold", fontSize=7, textColor=BLACK, leading=10))
    banner = Table([[banner_p]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0),(-1,-1), 3), ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",   (0,0),(-1,-1), 6), ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("BOX",           (0,0),(-1,-1), 0.5, GRAY_300),
    ]))
    story.append(banner)

    # Single-column 3-cell table: [ ][ ][ ][ ] | title | #id D
    # Boxes never wrap — each row is one question, ReportLab splits across pages naturally.
    BOXES_W = 38   # wide enough for "[&nbsp;][&nbsp;]" with 4pt padding each side
    META_W  = 36
    TITLE_W = USE_W - BOXES_W - META_W   # 174pt — plenty for any title

    def diff_str(q):
        return {"Easy": "E", "Medium": "M", "Hard": "H"}.get(q.get("difficulty",""), "?")

    # &nbsp; inside brackets = no word-break points, so the two boxes never split
    BOXES_TXT = "[&nbsp;][&nbsp;]<br/>[&nbsp;][&nbsp;]"
    boxes_st  = _ps("bxs", fontName="Menlo-Bold", fontSize=5, textColor=GRAY_500, leading=7)

    data = []
    for i, q in enumerate(qs):
        pid = f"{pat_name[:4]}{i}"
        data.append([
            Paragraph(BOXES_TXT, boxes_st),
            Paragraph(safe_xml(q["title"]),
                _ps(f"qt{pid}", fontName="LG-Bold", fontSize=5.8,
                    textColor=GRAY_700, leading=8)),
            Paragraph(f"#{q['id']} <b>{diff_str(q)}</b>",
                _ps(f"qm{pid}", fontName="LG-Bold", fontSize=5.5,
                    textColor=GRAY_500, leading=8, alignment=TA_RIGHT)),
        ])

    flat = Table(data, colWidths=[BOXES_W, TITLE_W, META_W])
    flat.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 2), ("BOTTOMPADDING",(0,0),(-1,-1), 2),
        ("LEFTPADDING",   (0,0),(-1,-1), 4), ("RIGHTPADDING",  (0,0),(-1,-1), 4),
        ("LINEBELOW",     (0,0),(-1,-2), 0.2, GRAY_200),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [white, GRAY_50]),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
        ("BOX",           (0,0),(-1,-1), 0.4, GRAY_200),
    ]))
    story.append(flat)
    story.append(Spacer(1, 5))


def build_progress_tracker(story: list):
    groups = load_groups()
    total  = sum(len(qs) for _, qs in groups)

    # Import NC32
    from generate_neetcode32_pdf import NC32

    story += section_divider(
        "Study Progress Tracker",
        f"331 questions · 21 patterns · fewest→most  +  32 NeetCode extra")
    story.append(SetSection("Progress Tracker"))

    # ── Legend ────────────────────────────────────────────────────────────────
    story.append(cat_bar("How to use  ·  Mark each box as you progress"))
    story.append(Spacer(1, 2))
    legend_inner = [
        Paragraph("<b>[ ][ ]</b>  = 4 boxes per question (2×2), one per stage:",
            _ps("leg0", fontName="Menlo-Bold", fontSize=6, textColor=BLACK, leading=9)),
        Paragraph("<b>[ ][ ]</b>",
            _ps("leg0b", fontName="Menlo-Bold", fontSize=6, textColor=BLACK, leading=9)),
        Spacer(1, 3),
        Paragraph("Box 1 — Understood the problem",        S["body_sm"]),
        Paragraph("Box 2 — Coded brute force",             S["body_sm"]),
        Paragraph("Box 3 — Coded optimal solution",        S["body_sm"]),
        Paragraph("Box 4 — Can explain it cold (no notes)",S["body_sm"]),
        Spacer(1, 3),
        Paragraph("<b>E</b> = Easy   <b>M</b> = Medium   <b>H</b> = Hard", S["body_sm"]),
        Paragraph("Patterns ordered: fewest questions first — finish small patterns first!", S["body_sm"]),
    ]
    story.append(gray_box(legend_inner))
    story.append(Spacer(1, 6))

    # ── 331 questions by pattern ──────────────────────────────────────────────
    for pat, qs in groups:
        if not qs: continue
        build_pattern_block(pat["name"], qs, story)

    # ── NeetCode 32 "Not in 331" section ─────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(SetSection("NeetCode 32 — Not in 331"))
    story.append(cat_bar("NeetCode 32  —  Not in 331  (extra questions)"))
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        "These 32 questions appear in NeetCode 150 but not in the main 331 set.",
        _ps("nc32sub", fontName="LG-Bold", fontSize=5.8, textColor=GRAY_500,
            leading=7.5, spaceAfter=3)))

    # Group NC32 by category
    by_cat: dict = defaultdict(list)
    for q in NC32:
        by_cat[q["category"]].append(q)

    for cat_name, qs in by_cat.items():
        build_pattern_block(f"NC32 — {cat_name}", qs, story)

    # ── Summary ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 4))
    nc32_total = len(NC32)
    story.append(Paragraph(
        f"Total: {total} questions (331 main) + {nc32_total} NeetCode extra = {total + nc32_total} questions",
        _ps("tot", fontName="LG-Bold", fontSize=6, textColor=GRAY_500,
            alignment=TA_CENTER, leading=8)))
    story.append(PageBreak())


# ══════════════════════════════════════════════════════════════════════════════
# INNER PDF + 6-UP IMPOSER
# ══════════════════════════════════════════════════════════════════════════════

def build_inner_pdf():
    counter = PageCounter()
    doc = SimpleDocTemplate(
        str(INNER_PDF), pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph("LeetMastery", _ps("br", fontName="LG-Bold", fontSize=8,
                            textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Interview Reference", S["cov_ttl"]))
    story.append(Paragraph("Print Edition · 6-up Landscape",
        _ps("sub2", fontName="LG-Bold", fontSize=9, textColor=GRAY_700,
            alignment=TA_CENTER, leading=12)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    for line in [
        "Part 1 — Complexity Reference Card",
        "Part 2 — Interview Talk-Through Framework",
        "Part 3 — Study Progress Tracker (331 + NC32)",
    ]:
        story.append(Paragraph(line,
            _ps(f"ci_{line[:4]}", fontName="LG-Bold", fontSize=6,
                textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(PageBreak())

    build_complexity(story)
    build_interview(story)
    build_progress_tracker(story)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f"Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}")
    return counter.n


def impose_6up_landscape():
    src = fitz.open(str(INNER_PDF))
    dst = fitz.open()
    n   = len(src)
    L_W, L_H  = 792.0, 612.0
    CW, RH, GAP = L_W / 3, L_H / 2, 3.0

    for i in range(0, n, 6):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(6, n - i)):
            col, row = j % 3, j // 3
            rect = fitz.Rect(col*CW+GAP, row*RH+GAP, (col+1)*CW-GAP, (row+1)*RH-GAP)
            sheet.show_pdf_page(rect, src, i + j)
        shape = sheet.new_shape()
        for cx in [CW, CW*2]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        shape.draw_line(fitz.Point(0, RH), fitz.Point(L_W, RH))
        shape.finish(color=(0.5,0.5,0.5), width=0.8); shape.commit()
        for j in range(min(6, n - i)):
            col, row = j % 3, j // 3
            s2 = sheet.new_shape()
            s2.draw_rect(fitz.Rect(col*CW+GAP/2, row*RH+GAP/2,
                                   (col+1)*CW-GAP/2, (row+1)*RH-GAP/2))
            s2.finish(color=(0.65,0.65,0.65), width=0.25, fill=None); s2.commit()

    num_sheets = len(dst)
    for pg in range(num_sheets):
        dst[pg].insert_text(fitz.Point(L_W/2-85, L_H-7),
            f"Sheet {pg+1}/{num_sheets}  ·  LeetMastery · Complexity · Interview · Progress",
            fontsize=6, color=(0.5,0.5,0.5))
    dst.save(str(OUTPUT_PDF), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f"6-up: {n} mini-pages → {num_sheets} sheets → {OUTPUT_PDF.name}")


if __name__ == "__main__":
    build_inner_pdf()
    impose_6up_landscape()
    INNER_PDF.unlink(missing_ok=True)
    kb = OUTPUT_PDF.stat().st_size // 1024
    print(f"\nDone → {OUTPUT_PDF}  ({kb:,} KB)")

"""
LeetMastery — Complexity Reference Card (1 page)
Data structure operations + sorting + graph + DP complexities.

Usage:
  python3 generate_complexity_pdf.py
  → LeetMastery_Complexity_Reference.pdf
"""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUTPUT = Path(__file__).parent / "LeetMastery_Complexity_Reference.pdf"

# ── Palette ────────────────────────────────────────────────────────────────────
INDIGO   = HexColor("#4F46E5")
G900     = HexColor("#111827")
G700     = HexColor("#374151")
G500     = HexColor("#6B7280")
G300     = HexColor("#D1D5DB")
G200     = HexColor("#E5E7EB")
G100     = HexColor("#F3F4F6")
G50      = HexColor("#F9FAFB")
WHITE    = white

GREEN    = HexColor("#16A34A")
AMBER    = HexColor("#D97706")
RED      = HexColor("#DC2626")
PURPLE   = HexColor("#7C3AED")
BLUE     = HexColor("#2563EB")
TEAL     = HexColor("#0891B2")

# colour-code complexities
def cx_color(s):
    s = s.strip()
    if s in ("O(1)",): return GREEN
    if s in ("O(log n)", "O(log n) avg"): return TEAL
    if s.startswith("O(n)") or s == "O(k)" or s == "O(L)": return BLUE
    if "n log" in s or "log n" in s: return PURPLE
    if "n²" in s or "n^2" in s or "nm" in s or "n·m" in s: return AMBER
    if "2^n" in s or "n!" in s or "3^" in s: return RED
    return G700

def cx(s):
    col = cx_color(s).hexval() if hasattr(cx_color(s), 'hexval') else "#374151"
    # reportlab HexColor doesn't have hexval — get hex string manually
    c = cx_color(s)
    hex_str = "#{:02X}{:02X}{:02X}".format(
        int(c.red*255), int(c.green*255), int(c.blue*255)
    )
    return f'<font color="{hex_str}"><b>{s}</b></font>'

def make_pdf():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.4*inch, rightMargin=0.4*inch,
        topMargin=0.35*inch, bottomMargin=0.3*inch,
    )
    PW = letter[0] - 0.8*inch

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    title_s = S("ti", fontSize=14, fontName="Helvetica-Bold",
                textColor=G900, alignment=TA_CENTER, spaceAfter=1)
    sub_s   = S("su", fontSize=7.5, fontName="Helvetica",
                textColor=G500, alignment=TA_CENTER, spaceAfter=5)
    sec_s   = S("sec", fontSize=8, fontName="Helvetica-Bold",
                textColor=WHITE, alignment=TA_LEFT)
    hdr_s   = S("hdr", fontSize=7, fontName="Helvetica-Bold",
                textColor=G500, alignment=TA_CENTER)
    cell_s  = S("cel", fontSize=7, fontName="Helvetica",
                textColor=G700, alignment=TA_CENTER)
    ds_s    = S("ds",  fontSize=7, fontName="Helvetica-Bold",
                textColor=G900, alignment=TA_LEFT)
    note_s  = S("nt",  fontSize=6, fontName="Helvetica-Oblique",
                textColor=G500, alignment=TA_LEFT)
    foot_s  = S("ft",  fontSize=6.5, fontName="Helvetica",
                textColor=G500, alignment=TA_CENTER)
    leg_s   = S("lg",  fontSize=6.5, fontName="Helvetica",
                textColor=G700, alignment=TA_LEFT)

    def section_banner(text, color):
        hex_c = "#{:02X}{:02X}{:02X}".format(
            int(color.red*255), int(color.green*255), int(color.blue*255))
        p = Paragraph(
            f'<font color="{hex_c}"><b>{text}</b></font>',
            S("sec_p", fontSize=8, fontName="Helvetica-Bold",
              textColor=color, alignment=TA_LEFT)
        )
        t = Table([[p]], colWidths=[PW])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), G100),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 10),
            ("LINEBEFORE",    (0,0),(0,-1),  4, color),
            ("BOX",           (0,0),(-1,-1), 0.4, G300),
        ]))
        return t

    def make_table(headers, rows, col_widths, row_colors=None):
        hdr_row = [Paragraph(h, hdr_s) for h in headers]
        data = [hdr_row]
        for r in rows:
            data.append([Paragraph(str(c), cell_s) if i > 0
                         else Paragraph(str(c), ds_s)
                         for i, c in enumerate(r)])
        tbl = Table(data, colWidths=col_widths)
        styles = [
            ("BACKGROUND",    (0,0),(-1,0),  G100),
            ("LINEBELOW",     (0,0),(-1,0),  0.5, G300),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [WHITE, G50]),
            ("LINEBELOW",     (0,1),(-1,-2), 0.25, G200),
            ("TOPPADDING",    (0,0),(-1,-1), 3),
            ("BOTTOMPADDING", (0,0),(-1,-1), 3),
            ("LEFTPADDING",   (0,0),(-1,-1), 5),
            ("RIGHTPADDING",  (0,0),(-1,-1), 5),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("BOX",           (0,0),(-1,-1), 0.5, G300),
        ]
        tbl.setStyle(TableStyle(styles))
        return tbl

    story = []

    # ── Title ─────────────────────────────────────────────────────────────────
    story.append(Paragraph("LeetMastery — Complexity Reference Card", title_s))
    story.append(Paragraph(
        "Colour key:  "
        '<font color="#16A34A"><b>O(1)</b></font>  '
        '<font color="#0891B2"><b>O(log n)</b></font>  '
        '<font color="#2563EB"><b>O(n)</b></font>  '
        '<font color="#7C3AED"><b>O(n log n)</b></font>  '
        '<font color="#D97706"><b>O(n²)</b></font>  '
        '<font color="#DC2626"><b>O(2ⁿ) / O(n!)</b></font>',
        sub_s,
    ))
    story.append(HRFlowable(width="100%", thickness=0.8, color=G200, spaceAfter=6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — Data Structures (two-column layout)
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_banner("① Data Structure Operations", INDIGO))
    story.append(Spacer(1, 4))

    H   = ["Structure",       "Access",       "Search",       "Insert",       "Delete",       "Space"]
    DS  = [
        ["Array",             cx("O(1)"),      cx("O(n)"),     cx("O(n)"),     cx("O(n)"),     cx("O(n)")],
        ["Sorted Array",      cx("O(1)"),      cx("O(log n)"), cx("O(n)"),     cx("O(n)"),     cx("O(n)")],
        ["Singly Linked List",cx("O(n)"),      cx("O(n)"),     cx("O(1)") + " head",cx("O(1)") + " head",cx("O(n)")],
        ["Doubly Linked List",cx("O(n)"),      cx("O(n)"),     cx("O(1)"),     cx("O(1)"),     cx("O(n)")],
        ["Stack / Queue",     cx("O(n)"),      cx("O(n)"),     cx("O(1)"),     cx("O(1)"),     cx("O(n)")],
        ["Hash Map / Set",    cx("O(1)") + " avg", cx("O(1)") + " avg", cx("O(1)") + " avg", cx("O(1)") + " avg", cx("O(n)")],
        ["Binary Min-Heap",   cx("O(n)"),      cx("O(n)"),     cx("O(log n)"), cx("O(log n)"), cx("O(n)")],
        ["BST (unbalanced)",  cx("O(n)"),      cx("O(n)"),     cx("O(n)"),     cx("O(n)"),     cx("O(n)")],
        ["BST (balanced)",    cx("O(log n)"),  cx("O(log n)"), cx("O(log n)"), cx("O(log n)"), cx("O(n)")],
        ["Trie",              "—",             cx("O(L)"),     cx("O(L)"),     cx("O(L)"),     cx("O(n·L)")],
        ["Graph (adj list)",  "—",             cx("O(V+E)"),   cx("O(1)"),     cx("O(E)"),     cx("O(V+E)")],
        ["Graph (adj matrix)","—",             cx("O(1)"),     cx("O(1)"),     cx("O(1)"),     cx("O(V²)")],
    ]

    col_w1 = [1.38*inch, 0.88*inch, 0.88*inch, 0.88*inch, 0.88*inch, 0.78*inch]
    ds_table = make_table(H, DS, col_w1)
    story.append(ds_table)
    story.append(Paragraph("L = word/key length  ·  n = number of keys  ·  avg = average case (assumes good hash)", note_s))
    story.append(Spacer(1, 7))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTIONS 2, 3, 4 — side by side in a 3-column layout
    # ══════════════════════════════════════════════════════════════════════════
    GAP = 0.1*inch
    C3  = (PW - 2*GAP) / 3

    # ── Sorting algorithms ────────────────────────────────────────────────────
    sort_banner = section_banner("② Sorting", PURPLE)
    sort_H  = ["Algorithm",     "Best",         "Average",      "Worst",        "Space"]
    sort_rows = [
        ["Bubble Sort",     cx("O(n)"),     cx("O(n²)"),    cx("O(n²)"),    cx("O(1)")],
        ["Selection Sort",  cx("O(n²)"),    cx("O(n²)"),    cx("O(n²)"),    cx("O(1)")],
        ["Insertion Sort",  cx("O(n)"),     cx("O(n²)"),    cx("O(n²)"),    cx("O(1)")],
        ["Merge Sort",      cx("O(n log n)"),cx("O(n log n)"),cx("O(n log n)"),cx("O(n)")],
        ["Quick Sort",      cx("O(n log n)"),cx("O(n log n)"),cx("O(n²)"),  cx("O(log n)")],
        ["Heap Sort",       cx("O(n log n)"),cx("O(n log n)"),cx("O(n log n)"),cx("O(1)")],
        ["Counting Sort",   cx("O(n+k)"),   cx("O(n+k)"),   cx("O(n+k)"),   cx("O(k)")],
        ["Radix Sort",      cx("O(nk)"),    cx("O(nk)"),    cx("O(nk)"),    cx("O(n+k)")],
        ["Tim Sort",        cx("O(n)"),     cx("O(n log n)"),cx("O(n log n)"),cx("O(n)")],
    ]
    sw = [0.95*inch, 0.62*inch, 0.62*inch, 0.62*inch, 0.55*inch]
    sort_tbl = make_table(sort_H, sort_rows, sw)

    # ── Graph algorithms ──────────────────────────────────────────────────────
    graph_banner = section_banner("③ Graph Algorithms", HexColor("#EF4444"))
    graph_H   = ["Algorithm",     "Time",                 "Space"]
    graph_rows= [
        ["BFS",            cx("O(V+E)"),           cx("O(V)")],
        ["DFS",            cx("O(V+E)"),           cx("O(V)")],
        ["Dijkstra",       cx("O(E log V)"),       cx("O(V)")],
        ["Bellman-Ford",   cx("O(V·E)"),           cx("O(V)")],
        ["Floyd-Warshall", cx("O(V³)"),            cx("O(V²)")],
        ["Topological Sort",cx("O(V+E)"),          cx("O(V)")],
        ["Kruskal MST",    cx("O(E log E)"),       cx("O(V)")],
        ["Prim MST",       cx("O(E log V)"),       cx("O(V)")],
        ["Union-Find",     cx("O(α(n))") + " ≈O(1)", cx("O(n)")],
        ["Kosaraju SCC",   cx("O(V+E)"),           cx("O(V)")],
    ]
    gw = [1.05*inch, 1.05*inch, 0.72*inch]
    graph_tbl = make_table(graph_H, graph_rows, gw)

    # ── Search / DP / Other ───────────────────────────────────────────────────
    other_banner = section_banner("④ Search & DP Patterns", HexColor("#0891B2"))
    other_H   = ["Pattern / Algorithm",  "Time",                 "Space"]
    other_rows= [
        ["Linear Search",       cx("O(n)"),             cx("O(1)")],
        ["Binary Search",       cx("O(log n)"),         cx("O(1)")],
        ["Two Pointers",        cx("O(n)"),             cx("O(1)")],
        ["Sliding Window",      cx("O(n)"),             cx("O(k)")],
        ["Prefix Sum",          cx("O(n)") + " build",  cx("O(n)")],
        ["DP 1-D",              cx("O(n)"),             cx("O(n)") + "→O(1)"],
        ["DP 2-D",              cx("O(n·m)"),           cx("O(n·m)")],
        ["Backtracking",        cx("O(2ⁿ)") + "/" + cx("O(n!)"), cx("O(n)")],
        ["Memoized Recursion",  "= DP time",            "= DP space"],
        ["KMP (string search)", cx("O(n+m)"),           cx("O(m)")],
    ]
    ow = [1.1*inch, 0.95*inch, 0.77*inch]
    other_tbl = make_table(other_H, other_rows, ow)

    # Assemble 3-col row
    def col_block(banner, tbl, note=""):
        items = [banner, Spacer(1,3), tbl]
        if note:
            items.append(Paragraph(note, note_s))
        return items

    left_items  = col_block(sort_banner,  sort_tbl,
                             "k = range of values  ·  Tim Sort used in Python/Java stdlib")
    mid_items   = col_block(graph_banner, graph_tbl,
                             "α = inverse Ackermann (practically constant)")
    right_items = col_block(other_banner, other_tbl,
                             "m = pattern length for KMP  ·  k = window size")

    # Pad to same length
    ml = max(len(left_items), len(mid_items), len(right_items))
    for lst in (left_items, mid_items, right_items):
        while len(lst) < ml: lst.append(Spacer(1,1))

    rows_3col = list(zip(left_items, mid_items, right_items))
    grid3 = Table(rows_3col, colWidths=[C3, C3, C3])
    grid3.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(0,-1),  int(GAP)),
        ("RIGHTPADDING",  (1,0),(1,-1),  int(GAP)),
        ("RIGHTPADDING",  (2,0),(2,-1),  0),
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
    ]))
    story.append(grid3)

    # ── Legend ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 5))
    story.append(HRFlowable(width="100%", thickness=0.4, color=G200, spaceAfter=3))

    legend_items = [
        "n = input size",
        "V = vertices  E = edges",
        "L = string/key length",
        "k = window size / range / top-k",
        "h = tree height (O(log n) balanced, O(n) worst)",
        "avg = average case (hash collisions rare)",
    ]
    story.append(Paragraph(
        "  ·  ".join(legend_items),
        S("leg", fontSize=6.2, fontName="Helvetica", textColor=G500, alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 3))
    story.append(Paragraph("LeetMastery · leetcodemr.com", foot_s))

    doc.build(story)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT}  ({kb} KB)")


if __name__ == "__main__":
    make_pdf()

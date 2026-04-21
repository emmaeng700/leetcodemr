"""
LeetMastery — Interview Talk-Through Framework (1 page)
Exact steps, phrases, timing, and scoring criteria for coding interviews.

Usage:
  python3 generate_interview_framework.py
  → LeetMastery_Interview_Framework.pdf
"""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUTPUT = Path(__file__).parent / "LeetMastery_Interview_Framework.pdf"

INDIGO  = HexColor("#4F46E5"); INDIGO_L = HexColor("#EEF2FF")
GREEN   = HexColor("#16A34A"); GREEN_L  = HexColor("#DCFCE7")
RED     = HexColor("#DC2626"); RED_L    = HexColor("#FEE2E2")
AMBER   = HexColor("#D97706"); AMBER_L  = HexColor("#FEF3C7")
TEAL    = HexColor("#0891B2"); TEAL_L   = HexColor("#CFFAFE")
PURPLE  = HexColor("#7C3AED"); PURPLE_L = HexColor("#EDE9FE")
G900    = HexColor("#111827"); G700 = HexColor("#374151")
G500    = HexColor("#6B7280"); G300 = HexColor("#D1D5DB")
G200    = HexColor("#E5E7EB"); G100 = HexColor("#F3F4F6")
G50     = HexColor("#F9FAFB"); WHITE = white

def make_pdf():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.4*inch, rightMargin=0.4*inch,
        topMargin=0.35*inch, bottomMargin=0.3*inch,
    )
    PW = letter[0] - 0.8*inch

    def S(n, **kw): return ParagraphStyle(n, **kw)

    title_s = S("ti", fontSize=14, fontName="Helvetica-Bold",
                textColor=G900, alignment=TA_CENTER, spaceAfter=1)
    sub_s   = S("su", fontSize=7.5, fontName="Helvetica",
                textColor=G500, alignment=TA_CENTER, spaceAfter=6)
    foot_s  = S("ft", fontSize=6.5, fontName="Helvetica",
                textColor=G500, alignment=TA_CENTER)

    def section(title, color, light):
        hex_c = "#{:02X}{:02X}{:02X}".format(
            int(color.red*255), int(color.green*255), int(color.blue*255))
        p = Paragraph(
            f'<font color="{hex_c}"><b>{title}</b></font>',
            S("sh", fontSize=8.5, fontName="Helvetica-Bold",
              textColor=color, leading=11)
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

    def body_cell(items, color_light, col_w=None):
        """items = list of Paragraphs/Spacers. Wrap in a light-bg table."""
        t = Table([[items]], colWidths=[col_w or PW])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), color_light),
            ("TOPPADDING",    (0,0),(-1,-1), 5),
            ("BOTTOMPADDING", (0,0),(-1,-1), 5),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
            ("RIGHTPADDING",  (0,0),(-1,-1), 8),
            ("BOX",           (0,0),(-1,-1), 0.4, G300),
        ]))
        return t

    def bullet(text, color=G700, size=7.2, indent=8, bold_prefix=None):
        if bold_prefix:
            text = f"<b>{bold_prefix}</b> {text}"
        return Paragraph(
            f"• {text}",
            S("bl", fontSize=size, fontName="Helvetica",
              textColor=color, leading=9.5, leftIndent=indent, spaceAfter=0)
        )

    def phrase(text, color=INDIGO):
        hex_c = "#{:02X}{:02X}{:02X}".format(
            int(color.red*255), int(color.green*255), int(color.blue*255))
        return Paragraph(
            f'<font color="{hex_c}"><i>"{text}"</i></font>',
            S("ph", fontSize=7, fontName="Helvetica-Oblique",
              textColor=color, leading=9.5, leftIndent=14, spaceAfter=0)
        )

    def label(text, size=7, bold=True, color=G900):
        fn = "Helvetica-Bold" if bold else "Helvetica"
        return Paragraph(text, S("lb", fontSize=size, fontName=fn,
                                 textColor=color, leading=9.5, spaceAfter=1))

    story = []
    story.append(Paragraph("LeetMastery — Interview Talk-Through Framework", title_s))
    story.append(Paragraph(
        "The exact steps, timing, and phrases for every coding interview  ·  "
        "Knowing the algorithm is only half the job",
        sub_s,
    ))
    story.append(HRFlowable(width="100%", thickness=0.8, color=G200, spaceAfter=6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — The 5-Step Framework (2 cols: steps | timing + phrases)
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section("① The 5-Step Framework  (40–45 min total)", INDIGO, INDIGO_L))
    story.append(Spacer(1, 2))

    GAP = 0.1*inch
    C2  = (PW - GAP) / 2

    STEPS = [
        {
            "step": "1. UNDERSTAND  (3–5 min)",
            "color": TEAL,
            "do": [
                "Restate the problem in your own words out loud",
                "Ask: empty input? negatives? duplicates? integer overflow?",
                "Confirm what to return (index vs value, count vs list)",
                "Read the constraints — they hint at the expected complexity",
            ],
            "say": [
                "Let me make sure I understand correctly…",
                "A few quick clarifying questions before I start…",
                "So n can be up to 10<super>5</super>, which suggests I'll need O(n log n) or better",
            ],
        },
        {
            "step": "2. MATCH a pattern  (1–2 min)",
            "color": PURPLE,
            "do": [
                "Silently map signals → pattern (use the cheat sheet in your head)",
                "Say the pattern name out loud — shows structured thinking",
            ],
            "say": [
                "This looks like a sliding window problem because I need the longest subarray with a condition",
                "The sorted input + target sum signals two pointers to me",
                "I'm seeing overlapping subproblems, so I'll reach for DP",
            ],
        },
        {
            "step": "3. BRUTE FORCE  (2–3 min)",
            "color": AMBER,
            "do": [
                "Always state the brute force — even if you know the optimal",
                "Say its complexity and WHY it's suboptimal",
                "Don't code it unless specifically asked",
            ],
            "say": [
                "The naive approach is nested loops giving O(n²) time and O(1) space",
                "I won't implement that — let me think of something better",
                "The bottleneck is that we're recomputing the same window from scratch each time",
            ],
        },
        {
            "step": "4. OPTIMIZE  (3–5 min)",
            "color": GREEN,
            "do": [
                "Explain the key insight that unlocks the better approach",
                "Walk through ONE example by hand before coding",
                "State the new complexity explicitly",
            ],
            "say": [
                "I can trade O(n) space for time — storing seen values in a hash map drops it to O(n)",
                "Because the array is sorted, I can binary search instead of scanning — O(log n)",
                "Let me trace through this example to make sure the logic is right before I code",
            ],
        },
        {
            "step": "5. CODE + TEST  (15–20 min)",
            "color": RED,
            "do": [
                "Narrate as you code — don't go silent",
                "Handle edge cases in code (empty, single element, all same)",
                "Run through the given example, then one edge case",
                "If stuck: say 'let me think through this part' — never silent > 60s",
            ],
            "say": [
                "I'll use a dummy head to simplify the edge cases here",
                "Let me check the base case first — if the input is empty…",
                "Running through example 1… that gives the right answer. Edge case: empty input returns []",
            ],
        },
    ]

    left_items  = []
    right_items = []

    for i, s in enumerate(STEPS):
        hex_c = "#{:02X}{:02X}{:02X}".format(
            int(s["color"].red*255), int(s["color"].green*255), int(s["color"].blue*255))

        # Left: step header + what to DO
        left_items.append(Paragraph(
            f'<b><font color="{hex_c}">{s["step"]}</font></b>',
            S(f"sh{i}", fontSize=7.5, fontName="Helvetica-Bold",
              textColor=s["color"], leading=10, spaceAfter=1)
        ))
        for d in s["do"]:
            left_items.append(bullet(d, color=G700, size=6.8))
        left_items.append(Spacer(1, 5))

        # Right: what to SAY
        right_items.append(Paragraph(
            f'<b><font color="{hex_c}">Say:</font></b>',
            S(f"rh{i}", fontSize=7, fontName="Helvetica-Bold",
              textColor=s["color"], leading=10, spaceAfter=1)
        ))
        for p in s["say"]:
            right_items.append(phrase(p, color=s["color"]))
        right_items.append(Spacer(1, 5))

    ml = max(len(left_items), len(right_items))
    while len(left_items)  < ml: left_items.append(Spacer(1,1))
    while len(right_items) < ml: right_items.append(Spacer(1,1))

    rows = list(zip(left_items, right_items))
    grid = Table(rows, colWidths=[C2, C2])
    grid.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ("BACKGROUND",    (0,0),(-1,-1), G50),
        ("LEFTPADDING",   (0,0),(-1,-1), 7),
        ("RIGHTPADDING",  (0,0),(0,-1),  int(GAP)),
        ("RIGHTPADDING",  (1,0),(1,-1),  7),
        ("TOPPADDING",    (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 0),
        ("BOX",           (0,0),(-1,-1), 0.4, G300),
        ("LINEAFTER",     (0,0),(0,-1),  0.4, G300),
    ]))
    # Add top/bottom padding via outer wrapper
    wrapper = Table([[grid]], colWidths=[PW])
    wrapper.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(-1,-1), 0),
        ("BACKGROUND",    (0,0),(-1,-1), G50),
        ("BOX",           (0,0),(-1,-1), 0.4, G300),
    ]))
    story.append(wrapper)
    story.append(Spacer(1, 7))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — Complexity  (full width, stacked)
    # ══════════════════════════════════════════════════════════════════════════
    CL = 1.25 * inch          # left label column
    CR = PW - CL              # right description column

    story.append(section("② n → Expected Complexity", TEAL, TEAL_L))
    story.append(Spacer(1, 2))
    cx_rows = [
        ("n ≤ 10",    "O(n!)  ·  O(2<super>n</super>)   —   backtracking / brute force"),
        ("n ≤ 20",    "O(2<super>n</super>)   —   bitmask DP / subsets"),
        ("n ≤ 100",   "O(n<super>3</super>)   —   triple nested loops"),
        ("n ≤ 1 000", "O(n<super>2</super>)   —   nested loops, DP grid"),
        ("n ≤ 10<super>5</super>", "O(n log n)   —   sort + scan, heap, binary search"),
        ("n ≤ 10<super>6</super>", "O(n)   —   single pass, hash map"),
        ("n ≤ 10<super>9</super>", "O(log n) or O(1)   —   math / binary search"),
    ]
    cx_data = [[
        Paragraph(r[0], S("cn", fontSize=7.5, fontName="Helvetica-Bold",
                          textColor=TEAL, leading=10)),
        Paragraph(r[1], S("cv", fontSize=7.5, fontName="Helvetica",
                          textColor=G700, leading=10)),
    ] for r in cx_rows]
    cx_tbl = Table(cx_data, colWidths=[CL, CR])
    cx_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [WHITE, G50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, G200),
        ("TOPPADDING",     (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",  (0,0),(-1,-1), 4),
        ("LEFTPADDING",    (0,0),(-1,-1), 8),
        ("RIGHTPADDING",   (0,0),(-1,-1), 8),
        ("BOX",            (0,0),(-1,-1), 0.4, G300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, G200),
    ]))
    story.append(cx_tbl)
    story.append(Spacer(1, 6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — What Interviewers Score  (full width)
    # ══════════════════════════════════════════════════════════════════════════
    SL = 1.35 * inch          # category name column
    SR = PW - SL

    story.append(section("③ What Interviewers Score", GREEN, GREEN_L))
    story.append(Spacer(1, 2))
    scores = [
        ("Communication",   "Narrate your thinking out loud. Never go silent for more than 60 seconds."),
        ("Problem Solving", "Brute → insight → optimal. Show the full journey, not just the answer."),
        ("Code Quality",    "Readable variable names, no magic numbers, consistent indentation and style."),
        ("Testing",         "Check edge cases yourself before the interviewer has to ask."),
        ("Adaptability",    "Take hints gracefully. Update your approach without ego or defensiveness."),
        ("Correctness",     "Get a working solution first, then optimise only if time allows."),
    ]
    score_data = [[
        Paragraph(f"<b>{s[0]}</b>", S("sk", fontSize=7.5, fontName="Helvetica-Bold",
                                       textColor=GREEN, leading=10)),
        Paragraph(s[1], S("sv", fontSize=7.5, fontName="Helvetica",
                           textColor=G700, leading=10)),
    ] for s in scores]
    score_tbl = Table(score_data, colWidths=[SL, SR])
    score_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [WHITE, G50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, G200),
        ("TOPPADDING",     (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",  (0,0),(-1,-1), 4),
        ("LEFTPADDING",    (0,0),(-1,-1), 8),
        ("RIGHTPADDING",   (0,0),(-1,-1), 8),
        ("BOX",            (0,0),(-1,-1), 0.4, G300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, G200),
    ]))
    story.append(score_tbl)
    story.append(Spacer(1, 6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — Green ✓ vs Red ✗ Flags  (full width, 2 equal cols)
    # ══════════════════════════════════════════════════════════════════════════
    FC = PW / 2               # each flag column

    story.append(section("④ Green ✓ vs Red ✗ Flags", RED, RED_L))
    story.append(Spacer(1, 2))
    green_flags = [
        "Ask 2–3 clarifying questions before coding",
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
        "Ignore edge cases (empty input, null, overflow)",
        "Present optimal solution with no mention of brute force",
        "Get defensive when the interviewer hints at issues",
        "Spend > 5 min on brute force when optimal is clear",
        "Not test the solution before declaring it done",
    ]
    flag_rows = []
    for g, r in zip(green_flags, red_flags):
        flag_rows.append([
            Paragraph(f'<font color="#16A34A"><b>✓</b></font>  {g}',
                      S("gf", fontSize=7.5, fontName="Helvetica", textColor=G700, leading=10)),
            Paragraph(f'<font color="#DC2626"><b>✗</b></font>  {r}',
                      S("rf", fontSize=7.5, fontName="Helvetica", textColor=G700, leading=10)),
        ])
    flag_tbl = Table(flag_rows, colWidths=[FC, FC])
    flag_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [WHITE, G50]),
        ("LINEBELOW",      (0,0),(-1,-2), 0.25, G200),
        ("TOPPADDING",     (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",  (0,0),(-1,-1), 4),
        ("LEFTPADDING",    (0,0),(-1,-1), 8),
        ("RIGHTPADDING",   (0,0),(-1,-1), 8),
        ("BOX",            (0,0),(-1,-1), 0.4, G300),
        ("LINEAFTER",      (0,0),(0,-1),  0.3, G200),
    ]))
    story.append(flag_tbl)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 5))
    story.append(HRFlowable(width="100%", thickness=0.4, color=G200, spaceAfter=3))
    story.append(Paragraph(
        "LeetMastery · leetcodemr.com  ·  "
        "Interviewers hire people they can work with — communicate, not just compute.",
        foot_s,
    ))

    doc.build(story)
    import os
    kb = os.path.getsize(OUTPUT) // 1024
    print(f"✅  {OUTPUT}  ({kb} KB)")

if __name__ == "__main__":
    make_pdf()

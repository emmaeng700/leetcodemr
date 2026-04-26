"""
LeetMastery — Behavioural Questions & Answers PDF
Generates a printable PDF of all 63 behavioural questions with full STAR answers.
"""
import json
from pathlib import Path
from collections import defaultdict

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Fonts ──────────────────────────────────────────────────────────────────────
_LG_TTC = "/System/Library/Fonts/LucidaGrande.ttc"
pdfmetrics.registerFont(TTFont("LG",      _LG_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("LG-Bold", _LG_TTC, subfontIndex=1))

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DATA       = SCRIPT_DIR / "public" / "behavioral_questions.json"
OUTPUT     = SCRIPT_DIR / "LeetMastery_Behavioral_QA.pdf"

MAX_W = 7.0 * inch

# ── Category colours ───────────────────────────────────────────────────────────
CAT_COLORS = {
    "Background":              "#6366F1",
    "Conflict & Communication":"#EF4444",
    "Failure & Growth":        "#F59E0B",
    "Leadership":              "#8B5CF6",
    "Pressure & Resilience":   "#EC4899",
    "Decision Making":         "#0EA5E9",
    "Initiative":              "#10B981",
    "Learning & Adaptability": "#14B8A6",
    "Prioritisation":          "#F97316",
    "Problem Solving":         "#6366F1",
    "Stakeholder Management":  "#84CC16",
    "Collaboration":           "#22C55E",
    "Technical":               "#3B82F6",
    "Motivation":              "#D946EF",
    "Design & Product":        "#06B6D4",
    "Communication":           "#A855F7",
    "Achievement":             "#F59E0B",
    "Judgment":                "#64748B",
    "Feedback":                "#E11D48",
}

STAR_STYLES = [
    {"label": "S — Situation", "bg": "#EFF6FF", "border": "#BFDBFE", "text": "#1E3A5F"},
    {"label": "T — Task",      "bg": "#F5F3FF", "border": "#DDD6FE", "text": "#3B0764"},
    {"label": "A — Action",    "bg": "#FFF7ED", "border": "#FED7AA", "text": "#7C2D12"},
    {"label": "R — Result",    "bg": "#F0FDF4", "border": "#BBF7D0", "text": "#14532D"},
]

STORY_COLORS = ["#4F46E5", "#059669", "#D97706"]


def safe_xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_pdf():
    questions = json.loads(DATA.read_text())
    # Group by category
    by_cat = defaultdict(list)
    for q in questions:
        by_cat[q["category"]].append(q)

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — Behavioural Q&A",
        author="Emmanuel Oppong",
    )

    # ── Styles ─────────────────────────────────────────────────────────────────
    cover_title = ParagraphStyle("ct", fontName="LG-Bold", fontSize=34,
                                 textColor=HexColor("#111827"), alignment=TA_CENTER,
                                 spaceAfter=10)
    cover_sub   = ParagraphStyle("cs", fontName="LG", fontSize=13,
                                 textColor=HexColor("#6B7280"), alignment=TA_CENTER,
                                 spaceAfter=6)
    toc_cat     = ParagraphStyle("tc", fontName="LG-Bold", fontSize=11,
                                 textColor=HexColor("#111827"), spaceBefore=8, spaceAfter=2)
    toc_q       = ParagraphStyle("tq", fontName="LG", fontSize=9,
                                 textColor=HexColor("#6B7280"), leftIndent=14, spaceAfter=1)
    q_num       = ParagraphStyle("qn", fontName="LG-Bold", fontSize=9,
                                 textColor=HexColor("#9CA3AF"), spaceAfter=2)
    q_text      = ParagraphStyle("qt", fontName="LG-Bold", fontSize=13,
                                 textColor=HexColor("#111827"), spaceAfter=8, leading=18)
    story_title = ParagraphStyle("st", fontName="LG-Bold", fontSize=10,
                                 textColor=HexColor("#111827"), spaceAfter=4)
    star_label  = ParagraphStyle("sl", fontName="LG-Bold", fontSize=8.5,
                                 spaceAfter=2)
    star_body   = ParagraphStyle("sb", fontName="LG", fontSize=9,
                                 textColor=HexColor("#1F2937"), leading=14,
                                 spaceAfter=0)

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story += [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("Behavioural Interview Q&amp;A", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{len(questions)} questions  ·  {sum(len(q['stories']) for q in questions)} STAR stories  ·  {len(by_cat)} categories",
                  cover_sub),
        Spacer(1, 0.15*inch),
        Paragraph("Situation · Task · Action · Result", cover_sub),
        PageBreak(),
    ]

    # ── Table of Contents ──────────────────────────────────────────────────────
    story.append(Paragraph("<b>Table of Contents</b>",
                           ParagraphStyle("th", fontName="LG-Bold", fontSize=16,
                                          textColor=HexColor("#4F46E5"), spaceAfter=14)))
    q_global = 0
    for cat, qs in sorted(by_cat.items()):
        col = CAT_COLORS.get(cat, "#6366F1")
        story.append(Paragraph(
            f"<font color='{col}'><b>{safe_xml(cat)}</b></font>  "
            f"<font color='#9CA3AF'>({len(qs)} questions)</font>",
            toc_cat,
        ))
        for q in qs:
            q_global += 1
            story.append(Paragraph(
                f"<font color='#9CA3AF'>Q{q['id']}</font>  {safe_xml(q['question'][:90])}{'…' if len(q['question'])>90 else ''}",
                toc_q,
            ))
    story.append(PageBreak())

    # ── Questions by category ──────────────────────────────────────────────────
    for cat, qs in sorted(by_cat.items()):
        col = CAT_COLORS.get(cat, "#6366F1")

        # Category banner
        banner = Table([[Paragraph(
            f"<font color='white'><b>{safe_xml(cat)}</b>"
            f"  <font size='11'>{len(qs)} question{'s' if len(qs)!=1 else ''}</font></font>",
            ParagraphStyle("cb", fontName="LG-Bold", fontSize=18, textColor=white),
        )]], colWidths=[MAX_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), HexColor(col)),
            ("TOPPADDING",    (0,0),(-1,-1), 12),
            ("BOTTOMPADDING", (0,0),(-1,-1), 12),
            ("LEFTPADDING",   (0,0),(-1,-1), 16),
        ]))
        story += [PageBreak(), banner, Spacer(1, 14)]

        for q in qs:
            # Question header
            story.append(Paragraph(f"Q{q['id']}  ·  {safe_xml(q['category'])}", q_num))
            story.append(Paragraph(safe_xml(q["question"]), q_text))

            for si, s in enumerate(q["stories"]):
                sc = STORY_COLORS[si % len(STORY_COLORS)]

                # Story title pill
                pill = Table([[Paragraph(
                    f"<font color='white'><b>{safe_xml(s['title'])}</b></font>",
                    ParagraphStyle("sp", fontName="LG-Bold", fontSize=9, textColor=white),
                )]], colWidths=[MAX_W])
                pill.setStyle(TableStyle([
                    ("BACKGROUND",    (0,0),(-1,-1), HexColor(sc)),
                    ("TOPPADDING",    (0,0),(-1,-1), 5),
                    ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                    ("LEFTPADDING",   (0,0),(-1,-1), 10),
                    ("ROUNDEDCORNERS", [4]),
                ]))
                story += [pill, Spacer(1, 5)]

                # STAR blocks
                keys = ["situation", "task", "action", "result"]
                for ki, ss in enumerate(STAR_STYLES):
                    text = s.get(keys[ki], "").strip()
                    if not text:
                        continue
                    block = Table([[
                        Paragraph(
                            f"<font color='{ss['text']}'><b>{ss['label']}</b></font>"
                            f"<br/><font color='{ss['text']}'>{safe_xml(text)}</font>",
                            ParagraphStyle("star", fontName="LG", fontSize=9,
                                           leading=14, textColor=HexColor(ss["text"])),
                        )
                    ]], colWidths=[MAX_W])
                    block.setStyle(TableStyle([
                        ("BACKGROUND",    (0,0),(-1,-1), HexColor(ss["bg"])),
                        ("TOPPADDING",    (0,0),(-1,-1), 7),
                        ("BOTTOMPADDING", (0,0),(-1,-1), 7),
                        ("LEFTPADDING",   (0,0),(-1,-1), 10),
                        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
                        ("LINEBELOW",     (0,0),(-1,-1), 0.5, HexColor(ss["border"])),
                    ]))
                    story += [block, Spacer(1, 2)]

                story.append(Spacer(1, 10))

            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=HexColor("#E5E7EB"), spaceAfter=12))

    # ── Footer ─────────────────────────────────────────────────────────────────
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG", 8)
        canvas.setFillColor(HexColor("#9CA3AF"))
        canvas.drawCentredString(
            letter[0] / 2, 0.45*inch,
            f"LeetMastery — Behavioural Q&A  ·  Page {doc.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    size_kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({size_kb:,} KB)")


if __name__ == "__main__":
    build_pdf()

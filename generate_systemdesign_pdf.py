"""
LeetMastery — System Design Q&A PDF
65 cards across 5 categories with full structured answers.
"""
import json, re
from pathlib import Path
from collections import defaultdict

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Fonts ──────────────────────────────────────────────────────────────────────
_LG_TTC = "/System/Library/Fonts/LucidaGrande.ttc"
_MN_TTC = "/System/Library/Fonts/Menlo.ttc"
pdfmetrics.registerFont(TTFont("LG",      _LG_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("LG-Bold", _LG_TTC, subfontIndex=1))
pdfmetrics.registerFont(TTFont("Menlo",   _MN_TTC, subfontIndex=0))

SCRIPT_DIR = Path(__file__).parent
TS_FILE    = SCRIPT_DIR / "src" / "data" / "systemDesignCards.ts"
OUTPUT     = SCRIPT_DIR / "LeetMastery_SystemDesign_QA.pdf"
MAX_W      = 7.0 * inch

CAT_COLORS = {
    "Design Problems":          "#4F46E5",
    "Core Concepts":            "#0EA5E9",
    "Cloud Patterns":           "#8B5CF6",
    "Advanced Data Structures": "#059669",
    "Tradeoffs":                "#F59E0B",
}

# Section emoji → colour mapping for answer blocks
SECTION_COLORS = {
    "🎯": "#EFF6FF",   # CLARIFY  — blue
    "📊": "#F5F3FF",   # DATA     — purple
    "🏗": "#FFF7ED",   # HIGH     — orange
    "⚡": "#FFFBEB",   # KEY      — yellow
    "📈": "#F0FDF4",   # SCALE    — green
    "🔥": "#FFF1F2",   # WOW      — rose
    "💡": "#F0FDF4",   # TIP
    "🔑": "#EFF6FF",
    "📦": "#F5F3FF",
    "🧠": "#FFF7ED",
    "⚠":  "#FFF1F2",
    "✅": "#F0FDF4",
    "🔄": "#EFF6FF",
    "📝": "#F5F3FF",
}
SECTION_TEXT = {
    "🎯": "#1E3A5F", "📊": "#3B0764", "🏗": "#7C2D12",
    "⚡": "#713F12", "📈": "#14532D", "🔥": "#881337",
    "💡": "#14532D", "🔑": "#1E3A5F", "📦": "#3B0764",
    "🧠": "#7C2D12", "⚠":  "#881337", "✅": "#14532D",
    "🔄": "#1E3A5F", "📝": "#3B0764",
}
DEFAULT_BG   = "#F9FAFB"
DEFAULT_TEXT = "#1F2937"


def safe_xml(s: str) -> str:
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
             .replace('"', "&quot;"))


def parse_cards():
    content = TS_FILE.read_text()
    pattern = (r'\{\s*id:\s*"(sd-\d+)",\s*category:\s*"([^"]+)",\s*'
               r'q:\s*"([^"]+)",\s*a:\s*`([\s\S]*?)`\s*,?\s*\}')
    cards = []
    for m in re.finditer(pattern, content):
        cards.append({
            "id": m.group(1), "category": m.group(2),
            "q": m.group(3),  "a": m.group(4).strip(),
        })
    return cards


def split_sections(answer: str):
    """Split answer into labelled sections by emoji headers."""
    lines = answer.split("\n")
    sections = []
    cur_emoji = None
    cur_lines = []
    for line in lines:
        stripped = line.strip()
        # Detect section header: line starting with an emoji followed by uppercase
        found = None
        for emoji in SECTION_COLORS:
            if stripped.startswith(emoji):
                found = emoji
                break
        if found:
            if cur_lines or cur_emoji:
                sections.append((cur_emoji, "\n".join(cur_lines).strip()))
            cur_emoji = found
            cur_lines = [stripped[len(found):].strip()]
        else:
            cur_lines.append(line)
    if cur_lines or cur_emoji:
        sections.append((cur_emoji, "\n".join(cur_lines).strip()))
    return sections


def build_pdf():
    cards = parse_cards()
    by_cat = defaultdict(list)
    for c in cards:
        by_cat[c["category"]].append(c)

    cat_order = ["Design Problems", "Core Concepts", "Cloud Patterns",
                 "Advanced Data Structures", "Tradeoffs"]

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — System Design Q&A",
        author="Emmanuel Oppong",
    )

    cover_title = ParagraphStyle("ct", fontName="LG-Bold", fontSize=34,
                                 textColor=HexColor("#111827"), alignment=TA_CENTER, spaceAfter=10)
    cover_sub   = ParagraphStyle("cs", fontName="LG", fontSize=13,
                                 textColor=HexColor("#6B7280"), alignment=TA_CENTER, spaceAfter=6)
    toc_cat     = ParagraphStyle("tc", fontName="LG-Bold", fontSize=11,
                                 textColor=HexColor("#111827"), spaceBefore=8, spaceAfter=2)
    toc_q       = ParagraphStyle("tq", fontName="LG", fontSize=9,
                                 textColor=HexColor("#6B7280"), leftIndent=14, spaceAfter=1)
    q_num_st    = ParagraphStyle("qn", fontName="LG-Bold", fontSize=9,
                                 textColor=HexColor("#9CA3AF"), spaceAfter=2)
    q_text_st   = ParagraphStyle("qt", fontName="LG-Bold", fontSize=13,
                                 textColor=HexColor("#111827"), spaceAfter=8, leading=18)
    sec_body_st = ParagraphStyle("sb", fontName="LG", fontSize=9,
                                 leading=14, spaceAfter=0)
    sec_hdr_st  = ParagraphStyle("sh", fontName="LG-Bold", fontSize=9,
                                 leading=14, spaceAfter=2)

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story += [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("System Design Q&amp;A", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{len(cards)} cards  ·  {len(by_cat)} categories", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph("Design Problems · Core Concepts · Cloud Patterns · Advanced Data Structures · Tradeoffs",
                  cover_sub),
        PageBreak(),
    ]

    # ── Table of Contents ──────────────────────────────────────────────────────
    story.append(Paragraph("<b>Table of Contents</b>",
                           ParagraphStyle("th", fontName="LG-Bold", fontSize=16,
                                          textColor=HexColor("#4F46E5"), spaceAfter=14)))
    for cat in cat_order:
        qs = by_cat.get(cat, [])
        col = CAT_COLORS.get(cat, "#6366F1")
        story.append(Paragraph(
            f"<font color='{col}'><b>{safe_xml(cat)}</b></font>  "
            f"<font color='#9CA3AF'>({len(qs)} cards)</font>",
            toc_cat,
        ))
        for c in qs:
            story.append(Paragraph(
                f"<font color='#9CA3AF'>{c['id']}</font>  "
                f"{safe_xml(c['q'][:85])}{'…' if len(c['q'])>85 else ''}",
                toc_q,
            ))
    story.append(PageBreak())

    # ── Cards by category ──────────────────────────────────────────────────────
    for cat in cat_order:
        qs = by_cat.get(cat, [])
        if not qs:
            continue
        col = CAT_COLORS.get(cat, "#6366F1")

        # Category banner
        banner = Table([[Paragraph(
            f"<font color='white'><b>{safe_xml(cat)}</b>"
            f"  <font size='11'>{len(qs)} card{'s' if len(qs)!=1 else ''}</font></font>",
            ParagraphStyle("cb", fontName="LG-Bold", fontSize=18, textColor=white),
        )]], colWidths=[MAX_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), HexColor(col)),
            ("TOPPADDING",    (0,0),(-1,-1), 12),
            ("BOTTOMPADDING", (0,0),(-1,-1), 12),
            ("LEFTPADDING",   (0,0),(-1,-1), 16),
        ]))
        story += [PageBreak(), banner, Spacer(1, 14)]

        for c in qs:
            story.append(Paragraph(f"{c['id']}  ·  {safe_xml(c['category'])}", q_num_st))
            story.append(Paragraph(safe_xml(c["q"]), q_text_st))

            sections = split_sections(c["a"])
            for emoji, body in sections:
                bg   = SECTION_COLORS.get(emoji, DEFAULT_BG)
                tc   = SECTION_TEXT.get(emoji, DEFAULT_TEXT)
                lines = body.split("\n")
                # First line is the section title (e.g. "CLARIFY FIRST")
                header = lines[0].strip() if lines else ""
                rest   = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

                inner = []
                if header:
                    em_str = emoji if emoji else ""
                    inner.append(Paragraph(
                        f"<font color='{tc}'><b>{em_str} {safe_xml(header)}</b></font>",
                        ParagraphStyle("h", fontName="LG-Bold", fontSize=9,
                                       textColor=HexColor(tc), spaceAfter=3),
                    ))
                if rest:
                    for line in rest.split("\n"):
                        line = line.strip()
                        if not line:
                            inner.append(Spacer(1, 2))
                            continue
                        # Bullet lines
                        if line.startswith("•") or line.startswith("-"):
                            line = line.lstrip("•- ").strip()
                            inner.append(Paragraph(
                                f"<font color='{tc}'>•  {safe_xml(line)}</font>",
                                ParagraphStyle("bl", fontName="LG", fontSize=9,
                                               leading=13, leftIndent=8,
                                               textColor=HexColor(tc), spaceAfter=1),
                            ))
                        else:
                            inner.append(Paragraph(
                                f"<font color='{tc}'>{safe_xml(line)}</font>",
                                ParagraphStyle("nl", fontName="LG", fontSize=9,
                                               leading=13, textColor=HexColor(tc), spaceAfter=1),
                            ))

                if inner:
                    block = Table([[inner]], colWidths=[MAX_W])
                    block.setStyle(TableStyle([
                        ("BACKGROUND",    (0,0),(-1,-1), HexColor(bg)),
                        ("TOPPADDING",    (0,0),(-1,-1), 7),
                        ("BOTTOMPADDING", (0,0),(-1,-1), 7),
                        ("LEFTPADDING",   (0,0),(-1,-1), 10),
                        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
                        ("LINEBELOW",     (0,0),(-1,-1), 0.5, HexColor("#E5E7EB")),
                    ]))
                    story += [block, Spacer(1, 3)]

            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=HexColor("#E5E7EB"), spaceAfter=14))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG", 8)
        canvas.setFillColor(HexColor("#9CA3AF"))
        canvas.drawCentredString(
            letter[0] / 2, 0.45*inch,
            f"LeetMastery — System Design Q&A  ·  Page {doc.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({kb:,} KB)")


if __name__ == "__main__":
    build_pdf()

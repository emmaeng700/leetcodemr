"""
LeetMastery — DSA · System Design · Behavioral
Bold Black Print Edition · 6-up Landscape
==============================================
Native 264×306 mini-pages imposed 1:1 — no scaling, bold LG-Bold/Menlo-Bold.
Three sections merged into one file:
  Part 1 — DSA Reference      (templates + tutorials)
  Part 2 — System Design Q&A  (structured answers)
  Part 3 — Behavioral Q&A     (STAR stories)

Usage:
  python3 generate_combined_print6up.py
Output:
  LeetMastery_DSA_SystemDesign_Behavioral_Print_6up_Landscape.pdf
"""

import json, re
from pathlib import Path
from collections import defaultdict

# ─── Font registration ─────────────────────────────────────────────────────────
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
from reportlab.lib.enums import TA_CENTER
import fitz  # PyMuPDF

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR      = Path(__file__).parent
BEHAVIORAL_JSON = SCRIPT_DIR / "public" / "behavioral_questions.json"
SYSDESIGN_TS    = SCRIPT_DIR / "src" / "data" / "systemDesignCards.ts"
DSA_DATA_TS     = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "data.ts"
DSA_TUTS_TS     = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "tutorials-data.ts"
INNER_PDF       = SCRIPT_DIR / "_combined_inner.pdf"
OUTPUT_PDF      = SCRIPT_DIR / "LeetMastery_DSA_SystemDesign_Behavioral_Print_6up_Landscape.pdf"

# ─── Mini-page dimensions ──────────────────────────────────────────────────────
MP_W  = 792.0 / 3   # 264 pts
MP_H  = 612.0 / 2   # 306 pts
MG    = 8.0
USE_W = MP_W - 2 * MG   # 248 pts
USE_H = MP_H - 2 * MG   # 290 pts

# ─── Colors ────────────────────────────────────────────────────────────────────
BLACK    = HexColor("#000000")
GRAY_700 = HexColor("#374151")
GRAY_500 = HexColor("#6B7280")
GRAY_300 = HexColor("#D1D5DB")
GRAY_100 = HexColor("#F3F4F6")

# ─── Styles (same sizes as NeetCode 32 mini-page file) ────────────────────────
S = {
    "title":       ParagraphStyle("ttl", fontName="LG-Bold",    fontSize=8,   textColor=BLACK,    leading=10,  spaceAfter=1),
    "body":        ParagraphStyle("bd",  fontName="LG-Bold",    fontSize=6,   textColor=GRAY_700, leading=8,   spaceAfter=1),
    "body_sm":     ParagraphStyle("bds", fontName="LG-Bold",    fontSize=5.8, textColor=GRAY_700, leading=7.5, spaceAfter=1),
    "code":        ParagraphStyle("cd",  fontName="Menlo-Bold",  fontSize=5.5, textColor=BLACK,    leading=7.5),
    "head2":       ParagraphStyle("h2",  fontName="LG-Bold",    fontSize=6.5, textColor=BLACK,    leading=9,   spaceAfter=1),
    "toc":         ParagraphStyle("tc",  fontName="LG-Bold",    fontSize=7,   textColor=BLACK,    leading=10),
    "cover_title": ParagraphStyle("ct",  fontName="LG-Bold",    fontSize=13,  textColor=BLACK,    alignment=TA_CENTER, leading=16),
    "cover_sub":   ParagraphStyle("cs",  fontName="LG-Bold",    fontSize=7,   textColor=GRAY_700, alignment=TA_CENTER, leading=10),
}

# ─── Helpers ───────────────────────────────────────────────────────────────────
def safe_xml(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def indent_xml(line: str) -> str:
    stripped = line.lstrip(" ")
    spaces   = len(line) - len(stripped)
    return "&nbsp;" * spaces + safe_xml(stripped)

def hr(color=GRAY_300, thickness=0.4):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceBefore=2, spaceAfter=2)

def cat_bar(text: str) -> Table:
    tbl = Table([[Paragraph(
        f"<b>{safe_xml(text)}</b>",
        ParagraphStyle("cb", fontName="LG-Bold", fontSize=5.5, textColor=BLACK),
    )]], colWidths=[USE_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("RIGHTPADDING",  (0,0), (-1,-1), 5),
        ("BOX",           (0,0), (-1,-1), 0.4, GRAY_300),
    ]))
    return tbl

def code_panel(code: str) -> list:
    if not code.strip():
        return []
    xml_lines = [indent_xml(ln) for ln in code.split("\n")]
    items = []
    for i in range(0, len(xml_lines), 22):
        cell = Paragraph("<br/>".join(xml_lines[i:i+22]), S["code"])
        tbl  = Table([[cell]], colWidths=[USE_W])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), white),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 5),
            ("RIGHTPADDING",  (0,0), (-1,-1), 5),
            ("BOX",           (0,0), (-1,-1), 0.5, GRAY_300),
        ]))
        items.append(tbl)
    return items

def gray_box(inner_flowables: list) -> Table:
    tbl = Table([[inner_flowables]], colWidths=[USE_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("BOX",           (0,0), (-1,-1), 0.3, GRAY_300),
    ]))
    return tbl

def part_divider(part_num: int, title: str, subtitle: str) -> list:
    """Full mini-page divider between the three parts."""
    items = []
    items.append(Spacer(1, USE_H * 0.18))
    banner = Table([[Paragraph(
        f"<b>Part {part_num}</b>",
        ParagraphStyle("pn", fontName="LG-Bold", fontSize=7,
                       textColor=GRAY_500, alignment=TA_CENTER),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    items.append(banner)
    items.append(Paragraph(
        f"<b>{safe_xml(title)}</b>",
        ParagraphStyle("pt", fontName="LG-Bold", fontSize=14,
                       textColor=BLACK, alignment=TA_CENTER, leading=18, spaceAfter=4),
    ))
    items.append(Paragraph(safe_xml(subtitle),
        ParagraphStyle("ps", fontName="LG-Bold", fontSize=7,
                       textColor=GRAY_500, alignment=TA_CENTER, leading=10)))
    items.append(Spacer(1, 6))
    items.append(hr())
    items.append(PageBreak())
    return items

def section_divider(label: str, count_str: str) -> list:
    """Category/section divider mini-page."""
    items = []
    items.append(Spacer(1, USE_H * 0.2))
    banner = Table([[Paragraph(
        f"<b>{safe_xml(label)}</b>",
        ParagraphStyle("sd", fontName="LG-Bold", fontSize=11,
                       textColor=BLACK, alignment=TA_CENTER),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), GRAY_100),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("BOX",           (0,0), (-1,-1), 0.6, GRAY_300),
    ]))
    items.append(banner)
    items.append(Spacer(1, 5))
    items.append(Paragraph(safe_xml(count_str),
        ParagraphStyle("sds", fontName="LG-Bold", fontSize=7,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    items.append(PageBreak())
    return items

# ─── Page state (footer: section + page number) ───────────────────────────────
_PAGE_STATE: dict = {"section": ""}

class SetSection(Flowable):
    def __init__(self, name: str):
        super().__init__()
        self.name   = name
        self.width  = 0
        self.height = 0

    def draw(self):
        _PAGE_STATE["section"] = self.name
        c = self.canv
        c.saveState()
        c.setFont("LG-Bold", 5)
        c.setFillColor(GRAY_500)
        c.drawString(MG, MG - 3, self.name)
        c.restoreState()

class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1
        canvas.saveState()
        canvas.setFont("LG-Bold", 5)
        canvas.setFillColor(GRAY_500)
        canvas.drawRightString(MP_W - MG, MG - 3, f"p.{self.n}")
        if _PAGE_STATE["section"]:
            canvas.drawString(MG, MG - 3, _PAGE_STATE["section"])
        canvas.restoreState()


# ══════════════════════════════════════════════════════════════════════════════
#  PART 1 — DSA REFERENCE
# ══════════════════════════════════════════════════════════════════════════════

# Re-use parsing helpers from generate_dsa_pdf (avoid code duplication)
from generate_dsa_pdf import (
    parse_dsa_categories,
    parse_tutorial_sections,
)

def build_dsa_card(card: dict, category_name: str, bar_prefix: str) -> list:
    items = []
    items.append(cat_bar(f"{bar_prefix} — {category_name}"))
    items.append(Spacer(1, 2))
    items.append(Paragraph(f"<b>{safe_xml(card['title'])}</b>", S["title"]))
    items.append(hr(GRAY_300, 0.3))

    if card.get("description"):
        items.append(Paragraph(safe_xml(card["description"]), S["body"]))

    if card.get("complexity"):
        items.append(Paragraph(
            f"<b>Complexity: {safe_xml(card['complexity'])}</b>", S["body_sm"]))

    for snip in card.get("snippets", []):
        lang = snip.get("lang", "")
        items.append(Paragraph(
            f"<b>● {safe_xml(lang)}</b>",
            ParagraphStyle(f"lang_{lang}", fontName="LG-Bold", fontSize=5.5,
                           textColor=GRAY_700, leading=7, spaceBefore=3)))
        items += code_panel(snip["code"])

    items.append(PageBreak())
    return items


def build_dsa_section(story: list):
    dsa_cats = parse_dsa_categories(DSA_DATA_TS.read_text())
    tut_secs = parse_tutorial_sections(DSA_TUTS_TS.read_text())

    total = (sum(len(c["cards"]) for c in dsa_cats)
             + sum(len(c["cards"]) for s in tut_secs for c in s["categories"]))

    story += part_divider(1, "DSA Reference",
                          f"{total} cards · Templates · Tutorials · Code Snippets")

    # ── Templates ──────────────────────────────────────────────────────────────
    for cat in dsa_cats:
        story.append(SetSection(f"DSA — {cat['name']}"))
        story += section_divider(cat["name"],
                                 f"DSA Templates · {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}")
        for card in cat["cards"]:
            story += build_dsa_card(card, cat["name"], "DSA")

    # ── Tutorials ─────────────────────────────────────────────────────────────
    for sec in tut_secs:
        for cat in sec["categories"]:
            label = f"{sec['section']} — {cat['name']}"
            story.append(SetSection(f"Tutorial — {cat['name']}"))
            story += section_divider(label,
                                     f"Tutorials · {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}")
            for card in cat["cards"]:
                story += build_dsa_card(card, cat["name"], sec["section"])


# ══════════════════════════════════════════════════════════════════════════════
#  PART 2 — SYSTEM DESIGN Q&A
# ══════════════════════════════════════════════════════════════════════════════

SD_CAT_ORDER = ["Design Problems", "Core Concepts", "Cloud Patterns",
                "Advanced Data Structures", "Tradeoffs"]
SD_EMOJIS = ["🎯","📊","🏗","⚡","📈","🔥","💡","🔑","📦","🧠","⚠","✅","🔄","📝"]

def _sd_parse_cards():
    content = SYSDESIGN_TS.read_text()
    pattern = (r'\{\s*id:\s*"(sd-\d+)",\s*category:\s*"([^"]+)",\s*'
               r'q:\s*"([^"]+)",\s*a:\s*`([\s\S]*?)`\s*,?\s*\}')
    cards = []
    for m in re.finditer(pattern, content):
        cards.append({
            "id": m.group(1), "category": m.group(2),
            "q": m.group(3),  "a": m.group(4).strip(),
        })
    return cards

def _sd_split_sections(answer: str):
    lines = answer.split("\n")
    sections, cur_emoji, cur_lines = [], None, []
    for line in lines:
        stripped = line.strip()
        found = next((e for e in SD_EMOJIS if stripped.startswith(e)), None)
        if found:
            if cur_lines or cur_emoji is not None:
                sections.append((cur_emoji, "\n".join(cur_lines).strip()))
            cur_emoji = found
            cur_lines = [stripped[len(found):].strip()]
        else:
            cur_lines.append(line)
    if cur_lines or cur_emoji is not None:
        sections.append((cur_emoji, "\n".join(cur_lines).strip()))
    return sections

def _sd_strip_emoji(s: str) -> str:
    for e in SD_EMOJIS:
        if s.startswith(e):
            return s[len(e):].strip()
    return s

def build_sd_card(card: dict) -> list:
    items = []
    items.append(cat_bar(f"System Design — {card['category']}"))
    items.append(Spacer(1, 2))
    items.append(Paragraph(f"<b>{safe_xml(card['q'])}</b>", S["title"]))
    items.append(hr(GRAY_300, 0.3))

    for emoji, body in _sd_split_sections(card["a"]):
        lines = body.split("\n")
        header = lines[0].strip() if lines else ""
        rest   = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

        inner = []
        if header:
            inner.append(Paragraph(
                f"<b>{safe_xml(_sd_strip_emoji(header) or header)}</b>",
                ParagraphStyle("sdh", fontName="LG-Bold", fontSize=6,
                               textColor=BLACK, spaceAfter=1)))
        for line in rest.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith(("•", "-")):
                line = line.lstrip("•- ").strip()
                inner.append(Paragraph(
                    f"• {safe_xml(line)}",
                    ParagraphStyle("sdbl", fontName="LG-Bold", fontSize=5.5,
                                   textColor=GRAY_700, leading=7.5,
                                   leftIndent=6, spaceAfter=0)))
            else:
                inner.append(Paragraph(
                    safe_xml(line),
                    ParagraphStyle("sdnl", fontName="LG-Bold", fontSize=5.5,
                                   textColor=GRAY_700, leading=7.5, spaceAfter=0)))
        if inner:
            items.append(gray_box(inner))
            items.append(Spacer(1, 2))

    items.append(PageBreak())
    return items


def build_sysdesign_section(story: list):
    cards = _sd_parse_cards()
    by_cat = defaultdict(list)
    for c in cards:
        by_cat[c["category"]].append(c)

    story += part_divider(2, "System Design Q&A",
                          f"{len(cards)} cards · {len(by_cat)} categories")

    for cat in SD_CAT_ORDER:
        qs = by_cat.get(cat, [])
        if not qs:
            continue
        story.append(SetSection(f"System Design — {cat}"))
        story += section_divider(cat,
                                 f"System Design · {len(qs)} card{'s' if len(qs)!=1 else ''}")
        for c in qs:
            story += build_sd_card(c)


# ══════════════════════════════════════════════════════════════════════════════
#  PART 3 — BEHAVIORAL Q&A
# ══════════════════════════════════════════════════════════════════════════════

STAR_KEYS   = ["situation", "task", "action", "result"]
STAR_LABELS = ["S — Situation", "T — Task", "A — Action", "R — Result"]

def build_behavioral_question(q: dict) -> list:
    items = []
    items.append(cat_bar(f"Behavioral — {q['category']}"))
    items.append(Spacer(1, 2))
    items.append(Paragraph(
        f"<b>Q{q['id']}.  {safe_xml(q['question'])}</b>", S["title"]))
    items.append(hr(GRAY_300, 0.3))

    for si, story_data in enumerate(q.get("stories", []), 1):
        if story_data.get("title"):
            items.append(Paragraph(
                f"<b>Story {si}: {safe_xml(story_data['title'])}</b>",
                ParagraphStyle("stl", fontName="LG-Bold", fontSize=6.5,
                               textColor=BLACK, leading=9, spaceBefore=4, spaceAfter=2)))
        for key, label in zip(STAR_KEYS, STAR_LABELS):
            text = story_data.get(key, "").strip()
            if not text:
                continue
            inner = [
                Paragraph(f"<b>{label}</b>",
                    ParagraphStyle(f"slbl_{key}", fontName="LG-Bold", fontSize=5.5,
                                   textColor=BLACK, spaceAfter=1)),
                Paragraph(safe_xml(text),
                    ParagraphStyle(f"sbdy_{key}", fontName="LG-Bold", fontSize=5.5,
                                   textColor=GRAY_700, leading=7.5, spaceAfter=0)),
            ]
            items.append(gray_box(inner))
            items.append(Spacer(1, 2))

    items.append(PageBreak())
    return items


def build_behavioral_section(story: list):
    questions = json.loads(BEHAVIORAL_JSON.read_text())
    by_cat = defaultdict(list)
    for q in questions:
        by_cat[q["category"]].append(q)

    total_stories = sum(len(q.get("stories", [])) for q in questions)
    story += part_divider(3, "Behavioral Q&A",
                          f"{len(questions)} questions · {total_stories} STAR stories · {len(by_cat)} categories")

    for cat, qs in sorted(by_cat.items()):
        story.append(SetSection(f"Behavioral — {cat}"))
        story += section_divider(cat,
                                 f"Behavioral · {len(qs)} question{'s' if len(qs)!=1 else ''}")
        for q in qs:
            story += build_behavioral_question(q)


# ══════════════════════════════════════════════════════════════════════════════
#  INNER PDF BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def build_inner_pdf():
    counter = PageCounter()
    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph("LeetMastery", ParagraphStyle(
        "brand", fontName="LG-Bold", fontSize=8,
        textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Interview Prep", S["cover_title"]))
    story.append(Paragraph("Print Edition · 6-up Landscape", ParagraphStyle(
        "sub2", fontName="LG-Bold", fontSize=9,
        textColor=GRAY_700, alignment=TA_CENTER, leading=12)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        "Part 1 — DSA Reference",
        ParagraphStyle("ci1", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Paragraph(
        "Part 2 — System Design Q&A",
        ParagraphStyle("ci2", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Paragraph(
        "Part 3 — Behavioral Q&A",
        ParagraphStyle("ci3", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── Three sections ────────────────────────────────────────────────────────
    build_dsa_section(story)
    build_sysdesign_section(story)
    build_behavioral_section(story)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f"Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}")
    return counter.n


# ══════════════════════════════════════════════════════════════════════════════
#  6-UP LANDSCAPE IMPOSER
# ══════════════════════════════════════════════════════════════════════════════

def impose_6up_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0
    COLS, ROWS = 3, 2
    CW = L_W / COLS
    RH = L_H / ROWS
    GAP = 3.0

    for i in range(0, n, 6):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(6, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        shape = sheet.new_shape()
        for cx in [CW, CW * 2]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        shape.draw_line(fitz.Point(0, RH), fitz.Point(L_W, RH))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.8)
        shape.commit()

        for j in range(min(6, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.25, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 90, L_H - 7),
            f"Sheet {pg_idx + 1} / {num_sheets}  ·  LeetMastery · DSA · System Design · Behavioral",
            fontsize=6, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f"6-up landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("Building inner mini-page PDF…")
    n = build_inner_pdf()

    print("Imposing 6-up landscape…")
    impose_6up_landscape(INNER_PDF, OUTPUT_PDF)

    INNER_PDF.unlink(missing_ok=True)
    kb = OUTPUT_PDF.stat().st_size // 1024
    print(f"\nDone → {OUTPUT_PDF}  ({kb:,} KB)")

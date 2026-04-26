"""
LeetMastery — Printable 6-up Landscape versions of:
  · Behavioral Q&A
  · System Design Q&A
  · DSA Reference
Generates print-friendly PDFs (white backgrounds, ink-saving) then imposes 6-up landscape.
"""
import json, re
from pathlib import Path
from collections import defaultdict

from pygments import lex
from pygments.lexers import CppLexer, PythonLexer, JavaLexer, TextLexer
from pygments.token import Token

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_LG_TTC = "/System/Library/Fonts/LucidaGrande.ttc"
_MN_TTC = "/System/Library/Fonts/Menlo.ttc"
pdfmetrics.registerFont(TTFont("LG",        _LG_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("LG-Bold",  _LG_TTC, subfontIndex=1))
pdfmetrics.registerFont(TTFont("Menlo",    _MN_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("Menlo-Bold", _MN_TTC, subfontIndex=1))

SCRIPT_DIR = Path(__file__).parent
MAX_W = 7.0 * inch

# ── Shared print styles ────────────────────────────────────────────────────────
def safe_xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

_LIGHT_BG = HexColor("#F3F4F6")  # very light gray for all section backgrounds

def print_banner(text: str, color: str = "#000000", font_size: int = 16) -> Table:
    p = Paragraph(
        f"<b>{safe_xml(text)}</b>",
        ParagraphStyle("pb", fontName="LG-Bold", fontSize=font_size,
                       textColor=black, leading=font_size + 4),
    )
    t = Table([[p]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), _LIGHT_BG),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 14),
        ("LINEBEFORE",    (0,0),(-1,-1), 5, black),
        ("LINEBELOW",     (0,0),(-1,-1), 1, black),
    ]))
    return t

def print_sub_banner(text: str, color: str = "#000000") -> Table:
    p = Paragraph(
        f"<b>{safe_xml(text)}</b>",
        ParagraphStyle("psb", fontName="LG-Bold", fontSize=11,
                       textColor=black, leading=15),
    )
    t = Table([[p]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), _LIGHT_BG),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 12),
        ("LINEBEFORE",    (0,0),(-1,-1), 3, black),
        ("LINEBELOW",     (0,0),(-1,-1), 0.5, HexColor("#9CA3AF")),
    ]))
    return t

# ── Printable syntax-highlighted code block (light background) ─────────────────
_PRINT_TC = {
    Token.Keyword:                "#CF222E",
    Token.Keyword.Type:           "#CF222E",
    Token.Keyword.Namespace:      "#CF222E",
    Token.Keyword.Reserved:       "#CF222E",
    Token.Keyword.Pseudo:         "#CF222E",
    Token.Keyword.Operator:       "#CF222E",
    Token.Operator.Word:          "#CF222E",
    Token.Name.Function:          "#8250DF",
    Token.Name.Function.Magic:    "#8250DF",
    Token.Name.Class:             "#953800",
    Token.Name.Decorator:         "#8250DF",
    Token.Name.Builtin:           "#0550AE",
    Token.Name.Builtin.Pseudo:    "#0550AE",
    Token.Name.Namespace:         "#953800",
    Token.Name.Exception:         "#CF222E",
    Token.Literal.String:         "#0A3069",
    Token.Literal.String.Doc:     "#6E7781",
    Token.Literal.String.Escape:  "#CF222E",
    Token.Literal.String.Char:    "#0A3069",
    Token.Literal.Number:         "#0550AE",
    Token.Comment:                "#6E7781",
    Token.Comment.Preproc:        "#CF222E",
    Token.Comment.PreprocFile:    "#0A3069",
    Token.Operator:               "#24292F",
    Token.Punctuation:            "#24292F",
    Token.Text:                   "#24292F",
    Token.Name:                   "#24292F",
    Token.Error:                  "#CF222E",
}
_PRINT_DEFAULT = "#24292F"

def _ptok_color(ttype):
    while ttype is not Token:
        if ttype in _PRINT_TC:
            return _PRINT_TC[ttype]
        ttype = ttype.parent
    return _PRINT_DEFAULT

PRINT_LANG_LABEL = {
    "C++": "#CF222E", "Python": "#8250DF", "Java": "#953800", "Reference": "#0A3069",
}

def print_code_block(lang: str, code: str) -> Table:
    label_st = ParagraphStyle("pll", fontName="Menlo-Bold", fontSize=7,
                               leading=10, textColor=black, spaceAfter=3)
    code_st  = ParagraphStyle("pcl", fontName="Menlo-Bold", fontSize=7.5,
                               leading=11, textColor=black, spaceAfter=0)

    inner = [Paragraph(safe_xml(lang), label_st)]
    for line in code.split("\n"):
        txt = safe_xml(line).replace(" ", "&nbsp;") if line.strip() else "&nbsp;"
        inner.append(Paragraph(txt, code_st))

    t = Table([[inner]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), white),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
        ("BOX",           (0,0),(-1,-1), 0.75, black),
        ("LINEBEFORE",    (0,0),(-1,-1), 3, black),
    ]))
    return t


# ── 6-up imposition ────────────────────────────────────────────────────────────
def impose_6up_landscape(src_path: Path, out_path: Path):
    import fitz
    src = fitz.open(str(src_path))
    n = len(src)
    pw, ph = letter[1], letter[0]
    cols, rows = 3, 2
    cell_w = pw / cols
    cell_h = ph / rows

    out = fitz.open()
    for si in range((n + 5) // 6):
        sheet = out.new_page(width=pw, height=ph)
        for pos in range(6):
            pi = si * 6 + pos
            if pi >= n:
                break
            col_i = pos % cols
            row_i = pos // cols
            x0 = col_i * cell_w
            y0 = row_i * cell_h
            src_page = src[pi]
            src_w, src_h = src_page.rect.width, src_page.rect.height
            scale = min(cell_w / src_w, cell_h / src_h)
            scaled_w, scaled_h = src_w * scale, src_h * scale
            ox = x0 + (cell_w - scaled_w) / 2
            oy = y0 + (cell_h - scaled_h) / 2
            dest = fitz.Rect(ox, oy, ox + scaled_w, oy + scaled_h)
            sheet.show_pdf_page(dest, src, pi)
            for link in src_page.get_links():
                fr = link["from"]
                nl = dict(link)
                nl["from"] = fitz.Rect(
                    ox + fr.x0 * scale, oy + fr.y0 * scale,
                    ox + fr.x1 * scale, oy + fr.y1 * scale,
                )
                sheet.insert_link(nl)

    out.save(str(out_path), garbage=4, deflate=True)
    kb = out_path.stat().st_size // 1024
    print(f"✅  {out_path.name}  ({kb:,} KB)")
    src.close(); out.close()


# ══════════════════════════════════════════════════════════════════════════════
# 1. BEHAVIORAL — PRINTABLE
# ══════════════════════════════════════════════════════════════════════════════

def build_behavioral_print():
    DATA   = SCRIPT_DIR / "public" / "behavioral_questions.json"
    OUTPUT = SCRIPT_DIR / "LeetMastery_Behavioral_QA_Print.pdf"

    questions = json.loads(DATA.read_text())
    by_cat = defaultdict(list)
    for q in questions:
        by_cat[q["category"]].append(q)

    CAT_COLORS = {
        "Background":              "#6366F1", "Conflict & Communication": "#EF4444",
        "Failure & Growth":        "#F59E0B", "Leadership":               "#8B5CF6",
        "Pressure & Resilience":   "#EC4899", "Decision Making":          "#0EA5E9",
        "Initiative":              "#10B981", "Learning & Adaptability":  "#14B8A6",
        "Prioritisation":          "#F97316", "Problem Solving":          "#6366F1",
        "Stakeholder Management":  "#84CC16", "Collaboration":            "#22C55E",
        "Technical":               "#3B82F6", "Motivation":               "#D946EF",
        "Design & Product":        "#06B6D4", "Communication":            "#A855F7",
        "Achievement":             "#F59E0B", "Judgment":                 "#64748B",
        "Feedback":                "#E11D48",
    }
    STAR_STYLES = [
        {"label": "S — Situation", "bg": "#EFF6FF", "border": "#BFDBFE", "text": "#1E3A5F"},
        {"label": "T — Task",      "bg": "#F5F3FF", "border": "#DDD6FE", "text": "#3B0764"},
        {"label": "A — Action",    "bg": "#FFF7ED", "border": "#FED7AA", "text": "#7C2D12"},
        {"label": "R — Result",    "bg": "#F0FDF4", "border": "#BBF7D0", "text": "#14532D"},
    ]
    STORY_COLORS = ["#4F46E5", "#059669", "#D97706"]

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — Behavioural Q&A (Print)",
        author="Emmanuel Oppong",
    )

    cover_title = ParagraphStyle("ct", fontName="LG-Bold", fontSize=34,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=10)
    cover_sub   = ParagraphStyle("cs", fontName="LG-Bold", fontSize=13,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=6)
    toc_cat     = ParagraphStyle("tc", fontName="LG-Bold", fontSize=11,
                                 textColor=black, spaceBefore=8, spaceAfter=2)
    toc_q       = ParagraphStyle("tq", fontName="LG-Bold", fontSize=9,
                                 textColor=black, leftIndent=14, spaceAfter=1)
    q_num       = ParagraphStyle("qn", fontName="LG-Bold", fontSize=9,
                                 textColor=black, spaceAfter=2)
    q_text      = ParagraphStyle("qt", fontName="LG-Bold", fontSize=13,
                                 textColor=black, spaceAfter=8, leading=18)

    story = []
    story += [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("Behavioural Interview Q&amp;A  ·  Print Edition", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{len(questions)} questions  ·  {sum(len(q['stories']) for q in questions)} STAR stories  ·  {len(by_cat)} categories",
                  cover_sub),
        PageBreak(),
    ]

    # TOC
    story.append(Paragraph("<b>Table of Contents</b>",
                           ParagraphStyle("th", fontName="LG-Bold", fontSize=16,
                                          textColor=black, spaceAfter=14)))
    for cat, qs in sorted(by_cat.items()):
        story.append(Paragraph(
            f"<b>{safe_xml(cat)}</b>  ({len(qs)} questions)", toc_cat))
        for q in qs:
            story.append(Paragraph(
                f"Q{q['id']}  {safe_xml(q['question'][:90])}{'…' if len(q['question'])>90 else ''}",
                toc_q))
    story.append(PageBreak())

    star_label_st = ParagraphStyle("slb", fontName="LG-Bold", fontSize=9,
                                   textColor=black, leading=13, spaceAfter=2)
    star_body_st  = ParagraphStyle("sbb", fontName="LG-Bold", fontSize=9,
                                   textColor=black, leading=14, spaceAfter=0)

    # Cards
    for cat, qs in sorted(by_cat.items()):
        story += [PageBreak(),
                  print_banner(f"{cat}  ·  {len(qs)} question{'s' if len(qs)!=1 else ''}", font_size=18),
                  Spacer(1, 14)]

        for q in qs:
            story.append(Paragraph(f"Q{q['id']}  ·  {safe_xml(q['category'])}", q_num))
            story.append(Paragraph(safe_xml(q["question"]), q_text))

            for si, s in enumerate(q["stories"]):
                # Story pill — black text on light gray, thick left rule
                pill_p = Paragraph(
                    f"<b>{safe_xml(s['title'])}</b>",
                    ParagraphStyle("pp", fontName="LG-Bold", fontSize=9, textColor=black),
                )
                pill = Table([[pill_p]], colWidths=[MAX_W])
                pill.setStyle(TableStyle([
                    ("BACKGROUND",    (0,0),(-1,-1), _LIGHT_BG),
                    ("TOPPADDING",    (0,0),(-1,-1), 5),
                    ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                    ("LEFTPADDING",   (0,0),(-1,-1), 10),
                    ("LINEBEFORE",    (0,0),(-1,-1), 3, black),
                ]))
                story += [pill, Spacer(1, 4)]

                STAR_LABELS = ["S — Situation", "T — Task", "A — Action", "R — Result"]
                keys = ["situation", "task", "action", "result"]
                for ki, key in enumerate(keys):
                    text = s.get(key, "").strip()
                    if not text:
                        continue
                    block = Table([[
                        Paragraph(f"<b>{STAR_LABELS[ki]}</b>", star_label_st),
                        Paragraph(safe_xml(text), star_body_st),
                    ]], colWidths=[0.9*inch, MAX_W - 0.9*inch])
                    block.setStyle(TableStyle([
                        ("BACKGROUND",    (0,0),(-1,-1), white),
                        ("TOPPADDING",    (0,0),(-1,-1), 5),
                        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                        ("LEFTPADDING",   (0,0),(-1,-1), 8),
                        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
                        ("VALIGN",        (0,0),(-1,-1), "TOP"),
                        ("LINEBELOW",     (0,0),(-1,-1), 0.5, HexColor("#D1D5DB")),
                    ]))
                    story += [block, Spacer(1, 1)]
                story.append(Spacer(1, 8))

            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=HexColor("#E5E7EB"), spaceAfter=12))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold", 8)
        canvas.setFillColor(black)
        canvas.drawCentredString(letter[0]/2, 0.45*inch,
            f"LeetMastery — Behavioural Q&A  ·  Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({kb:,} KB)")
    return OUTPUT


# ══════════════════════════════════════════════════════════════════════════════
# 2. SYSTEM DESIGN — PRINTABLE
# ══════════════════════════════════════════════════════════════════════════════

def build_systemdesign_print():
    TS_FILE = SCRIPT_DIR / "src" / "data" / "systemDesignCards.ts"
    OUTPUT  = SCRIPT_DIR / "LeetMastery_SystemDesign_QA_Print.pdf"

    CAT_COLORS = {
        "Design Problems":          "#4F46E5",
        "Core Concepts":            "#0EA5E9",
        "Cloud Patterns":           "#8B5CF6",
        "Advanced Data Structures": "#059669",
        "Tradeoffs":                "#F59E0B",
    }
    SECTION_COLORS = {
        "🎯": "#EFF6FF", "📊": "#F5F3FF", "🏗": "#FFF7ED", "⚡": "#FFFBEB",
        "📈": "#F0FDF4", "🔥": "#FFF1F2", "💡": "#F0FDF4", "🔑": "#EFF6FF",
        "📦": "#F5F3FF", "🧠": "#FFF7ED", "⚠":  "#FFF1F2", "✅": "#F0FDF4",
        "🔄": "#EFF6FF", "📝": "#F5F3FF",
    }
    SECTION_TEXT = {
        "🎯": "#1E3A5F", "📊": "#3B0764", "🏗": "#7C2D12", "⚡": "#713F12",
        "📈": "#14532D", "🔥": "#881337", "💡": "#14532D", "🔑": "#1E3A5F",
        "📦": "#3B0764", "🧠": "#7C2D12", "⚠": "#881337",  "✅": "#14532D",
        "🔄": "#1E3A5F", "📝": "#3B0764",
    }
    DEFAULT_BG_SD   = "#F9FAFB"
    DEFAULT_TEXT_SD = "#1F2937"

    content = TS_FILE.read_text()
    pattern = (r'\{\s*id:\s*"(sd-\d+)",\s*category:\s*"([^"]+)",\s*'
               r'q:\s*"([^"]+)",\s*a:\s*`([\s\S]*?)`\s*,?\s*\}')
    cards = [{"id": m.group(1), "category": m.group(2),
              "q": m.group(3), "a": m.group(4).strip()}
             for m in re.finditer(pattern, content)]

    by_cat = defaultdict(list)
    for c in cards:
        by_cat[c["category"]].append(c)

    cat_order = ["Design Problems", "Core Concepts", "Cloud Patterns",
                 "Advanced Data Structures", "Tradeoffs"]

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — System Design Q&A (Print)",
        author="Emmanuel Oppong",
    )

    cover_title = ParagraphStyle("ct2", fontName="LG-Bold", fontSize=34,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=10)
    cover_sub   = ParagraphStyle("cs2", fontName="LG-Bold", fontSize=13,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=6)
    toc_cat     = ParagraphStyle("tc2", fontName="LG-Bold", fontSize=11,
                                 textColor=black, spaceBefore=8, spaceAfter=2)
    toc_q       = ParagraphStyle("tq2", fontName="LG-Bold", fontSize=9,
                                 textColor=black, leftIndent=14, spaceAfter=1)
    q_num_st    = ParagraphStyle("qn2", fontName="LG-Bold", fontSize=9,
                                 textColor=black, spaceAfter=2)
    q_text_st   = ParagraphStyle("qt2", fontName="LG-Bold", fontSize=13,
                                 textColor=black, spaceAfter=8, leading=18)

    story = []
    story += [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("System Design Q&amp;A  ·  Print Edition", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{len(cards)} cards  ·  {len(by_cat)} categories", cover_sub),
        PageBreak(),
    ]

    # TOC
    story.append(Paragraph("<b>Table of Contents</b>",
                           ParagraphStyle("th", fontName="LG-Bold", fontSize=16,
                                          textColor=black, spaceAfter=14)))
    for cat in cat_order:
        qs = by_cat.get(cat, [])
        story.append(Paragraph(
            f"<b>{safe_xml(cat)}</b>  ({len(qs)} cards)", toc_cat))
        for c in qs:
            story.append(Paragraph(
                f"{c['id']}  {safe_xml(c['q'][:85])}{'…' if len(c['q'])>85 else ''}",
                toc_q))
    story.append(PageBreak())

    def split_sections(answer):
        lines = answer.split("\n")
        sections, cur_emoji, cur_lines = [], None, []
        for line in lines:
            stripped = line.strip()
            found = next((e for e in SECTION_COLORS if stripped.startswith(e)), None)
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

    sd_sec_hdr = ParagraphStyle("sdh", fontName="LG-Bold", fontSize=9,
                                textColor=black, spaceAfter=3)
    sd_body_st = ParagraphStyle("sdb", fontName="LG-Bold", fontSize=9,
                                leading=13, textColor=black, spaceAfter=1)
    sd_bull_st = ParagraphStyle("sdbl", fontName="LG-Bold", fontSize=9,
                                leading=13, leftIndent=8, textColor=black, spaceAfter=1)

    for cat in cat_order:
        qs = by_cat.get(cat, [])
        if not qs:
            continue
        story += [PageBreak(),
                  print_banner(f"{cat}  ·  {len(qs)} card{'s' if len(qs)!=1 else ''}", font_size=18),
                  Spacer(1, 14)]

        for c in qs:
            story.append(Paragraph(f"{c['id']}  ·  {safe_xml(c['category'])}", q_num_st))
            story.append(Paragraph(safe_xml(c["q"]), q_text_st))

            for emoji, body in split_sections(c["a"]):
                lines = body.split("\n")
                header = lines[0].strip() if lines else ""
                rest   = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

                inner = []
                if header:
                    em_str = emoji if emoji else ""
                    inner.append(Paragraph(
                        f"<b>{em_str} {safe_xml(header)}</b>", sd_sec_hdr))
                if rest:
                    for line in rest.split("\n"):
                        line = line.strip()
                        if not line:
                            inner.append(Spacer(1, 2))
                            continue
                        if line.startswith("•") or line.startswith("-"):
                            line = line.lstrip("•- ").strip()
                            inner.append(Paragraph(f"•  {safe_xml(line)}", sd_bull_st))
                        else:
                            inner.append(Paragraph(safe_xml(line), sd_body_st))
                if inner:
                    block = Table([[inner]], colWidths=[MAX_W])
                    block.setStyle(TableStyle([
                        ("BACKGROUND",    (0,0),(-1,-1), _LIGHT_BG),
                        ("TOPPADDING",    (0,0),(-1,-1), 7),
                        ("BOTTOMPADDING", (0,0),(-1,-1), 7),
                        ("LEFTPADDING",   (0,0),(-1,-1), 10),
                        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
                        ("LINEBELOW",     (0,0),(-1,-1), 0.5, HexColor("#D1D5DB")),
                    ]))
                    story += [block, Spacer(1, 3)]

            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=HexColor("#E5E7EB"), spaceAfter=14))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold", 8)
        canvas.setFillColor(black)
        canvas.drawCentredString(letter[0]/2, 0.45*inch,
            f"LeetMastery — System Design Q&A  ·  Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({kb:,} KB)")
    return OUTPUT


# ══════════════════════════════════════════════════════════════════════════════
# 3. DSA REFERENCE — PRINTABLE
# ══════════════════════════════════════════════════════════════════════════════

# Re-use parser from generate_dsa_pdf.py
def _preprocess_backticks(content):
    codes, result, i = [], [], 0
    n = len(content)
    while i < n:
        if content[i] == "`":
            j = i + 1
            while j < n and content[j] != "`":
                j += 1
            codes.append(content[i+1:j])
            result.append(f"[CODE{len(codes)-1}]")
            i = j + 1
        else:
            result.append(content[i])
            i += 1
    return "".join(result), codes

def _find_close_brace(s, start):
    depth, i, n = 0, start, len(s)
    while i < n:
        c = s[i]
        if c == "{": depth += 1; i += 1
        elif c == "}":
            depth -= 1
            if depth == 0: return i
            i += 1
        elif c == "'":
            i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "'": i += 1; break
                i += 1
        elif c == '"':
            i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == '"': i += 1; break
                i += 1
        else: i += 1
    return -1

def _find_close_bracket(s, start):
    depth, i, n = 0, start, len(s)
    while i < n:
        c = s[i]
        if c == "[": depth += 1; i += 1
        elif c == "]":
            depth -= 1
            if depth == 0: return i
            i += 1
        elif c == "{":
            end = _find_close_brace(s, i)
            i = end + 1 if end != -1 else i + 1
        elif c == "'":
            i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "'": i += 1; break
                i += 1
        elif c == '"':
            i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == '"': i += 1; break
                i += 1
        else: i += 1
    return -1

def _extract_field(text, field):
    pat = rf"{re.escape(field)}:\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
    m = re.search(pat, text)
    if not m: return ""
    v = m.group(1) if m.group(1) is not None else (m.group(2) or "")
    return v.replace("\\'", "'").replace('\\"', '"')

def _extract_snippets(card_flat, codes):
    return [{"lang": m.group(1), "code": codes[int(m.group(2))]}
            for m in re.finditer(r"lang:\s*'([^']+)',\s*code:\s*\[CODE(\d+)\]", card_flat)]

def _split_brace_items(s):
    items, i, n = [], 0, len(s)
    while i < n:
        while i < n and s[i] in " \t\n\r,": i += 1
        if i >= n or s[i] == "]": break
        if s[i] == "{":
            end = _find_close_brace(s, i)
            if end == -1: break
            items.append(s[i:end+1]); i = end + 1
        else: i += 1
    return items

def _parse_cards(cards_body, codes):
    return [{"id": _extract_field(it, "id"), "title": _extract_field(it, "title"),
             "description": _extract_field(it, "description"),
             "complexity": _extract_field(it, "complexity"),
             "snippets": _extract_snippets(it, codes)}
            for it in _split_brace_items(cards_body)]

def _get_array_body(flat, var_name):
    start = flat.find(var_name)
    if start == -1: return ""
    eq = flat.find("= [", start)
    if eq == -1: eq = flat.find("=[", start)
    if eq == -1: return ""
    bpos = flat.find("[", eq)
    if bpos == -1: return ""
    epos = _find_close_bracket(flat, bpos)
    return flat[bpos+1:epos]

def _parse_dsa_categories(content):
    flat, codes = _preprocess_backticks(content)
    categories = []
    for it in _split_brace_items(_get_array_body(flat, "DSA_CATEGORIES")):
        name = _extract_field(it, "name")
        cp = it.find("cards:")
        if cp == -1: continue
        bp = it.find("[", cp)
        if bp == -1: continue
        ep = _find_close_bracket(it, bp)
        categories.append({"name": name, "cards": _parse_cards(it[bp+1:ep], codes)})
    return categories

def _parse_tutorial_sections(content):
    flat, codes = _preprocess_backticks(content)
    sections = []
    for sec_it in _split_brace_items(_get_array_body(flat, "TUTORIAL_SECTIONS")):
        sec_name = _extract_field(sec_it, "section")
        cp = sec_it.find("categories:")
        if cp == -1: continue
        bp = sec_it.find("[", cp)
        if bp == -1: continue
        ep = _find_close_bracket(sec_it, bp)
        cats = []
        for cat_it in _split_brace_items(sec_it[bp+1:ep]):
            cat_name = _extract_field(cat_it, "name")
            cp2 = cat_it.find("cards:")
            if cp2 == -1: continue
            bp2 = cat_it.find("[", cp2)
            if bp2 == -1: continue
            ep2 = _find_close_bracket(cat_it, bp2)
            cats.append({"name": cat_name, "cards": _parse_cards(cat_it[bp2+1:ep2], codes)})
        sections.append({"section": sec_name, "categories": cats})
    return sections


def build_dsa_print():
    DATA_TS   = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "data.ts"
    TUTS_TS   = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "tutorials-data.ts"
    OUTPUT    = SCRIPT_DIR / "LeetMastery_DSA_Reference_Print.pdf"

    TEMPLATE_COLORS = [
        "#4F46E5", "#7C3AED", "#0EA5E9", "#059669", "#D97706",
        "#DC2626", "#DB2777", "#0891B2", "#65A30D", "#EA580C",
        "#7E22CE", "#0D9488", "#B45309",
    ]
    TUTORIAL_SECTION_COLORS = {
        "Basic Topics": "#4F46E5", "Graph Theory": "#059669",
        "Math": "#D97706", "Strings": "#DC2626",
    }
    TUTORIAL_CAT_COLORS = [
        "#6366F1", "#8B5CF6", "#0EA5E9", "#10B981", "#F59E0B",
        "#EF4444", "#EC4899", "#06B6D4", "#84CC16", "#F97316",
        "#3B82F6", "#14B8A6", "#A855F7", "#22C55E", "#64748B",
    ]

    dsa_cats = _parse_dsa_categories(DATA_TS.read_text())
    tut_secs = _parse_tutorial_sections(TUTS_TS.read_text())
    total = (sum(len(c["cards"]) for c in dsa_cats)
             + sum(len(c["cards"]) for s in tut_secs for c in s["categories"]))

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — DSA Reference (Print)",
        author="Emmanuel Oppong",
    )

    cover_title = ParagraphStyle("ct3", fontName="LG-Bold", fontSize=34,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=10)
    cover_sub   = ParagraphStyle("cs3", fontName="LG-Bold", fontSize=13,
                                 textColor=black, alignment=TA_CENTER, spaceAfter=6)
    card_title  = ParagraphStyle("qtl3", fontName="LG-Bold", fontSize=12,
                                 textColor=black, spaceAfter=4, leading=16)
    card_desc   = ParagraphStyle("qd3", fontName="LG-Bold", fontSize=9,
                                 textColor=black, leading=13, spaceAfter=3)
    card_cx     = ParagraphStyle("qcx3", fontName="LG-Bold", fontSize=8.5,
                                 textColor=black, leading=12, spaceAfter=3)
    toc_head    = ParagraphStyle("th3", fontName="LG-Bold", fontSize=16,
                                 textColor=black, spaceAfter=14)
    toc_sec     = ParagraphStyle("ts3", fontName="LG-Bold", fontSize=11,
                                 textColor=black, spaceBefore=8, spaceAfter=2)
    toc_item    = ParagraphStyle("ti3", fontName="LG-Bold", fontSize=9,
                                 textColor=black, leftIndent=14, spaceAfter=1)

    def card_elems(card):
        elems = [Paragraph(safe_xml(card["title"]), card_title)]
        if card.get("description"):
            elems.append(Paragraph(safe_xml(card["description"]), card_desc))
        if card.get("complexity"):
            elems.append(Paragraph(safe_xml(card["complexity"]), card_cx))
        for snip in card.get("snippets", []):
            elems += [Spacer(1, 4), print_code_block(snip["lang"], snip["code"])]
        elems += [Spacer(1, 8),
                  HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB"), spaceAfter=10)]
        return elems

    story = [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("DSA Reference  ·  Print Edition", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{total} cards  ·  {len(dsa_cats)} template categories  ·  {len(tut_secs)} tutorial sections",
                  cover_sub),
        PageBreak(),
    ]

    # TOC
    story.append(Paragraph("<b>Table of Contents</b>", toc_head))
    story.append(Paragraph("<b>Part 1 — DSA Templates</b>",
                           ParagraphStyle("p1", fontName="LG-Bold", fontSize=12,
                                          textColor=black, spaceBefore=6, spaceAfter=4)))
    for i, cat in enumerate(dsa_cats):
        story.append(Paragraph(
            f"<b>{safe_xml(cat['name'])}</b>  ({len(cat['cards'])} cards)", toc_sec))
        for c in cat["cards"]:
            story.append(Paragraph(safe_xml(c["title"]), toc_item))

    story.append(Paragraph("<b>Part 2 — Tutorials</b>",
                           ParagraphStyle("p2", fontName="LG-Bold", fontSize=12,
                                          textColor=black, spaceBefore=10, spaceAfter=4)))
    for sec in tut_secs:
        story.append(Paragraph(f"<b>{safe_xml(sec['section'])}</b>", toc_sec))
        for cat in sec["categories"]:
            story.append(Paragraph(
                f"  {safe_xml(cat['name'])}  ({len(cat['cards'])})", toc_item))
    story.append(PageBreak())

    # Part 1
    story += [print_banner("Part 1 — DSA Templates", font_size=20), Spacer(1, 10)]
    for cat in dsa_cats:
        story += [PageBreak(),
                  print_banner(f"{cat['name']}  ·  {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}"),
                  Spacer(1, 12)]
        for card in cat["cards"]:
            story += card_elems(card)

    # Part 2
    story += [PageBreak(), print_banner("Part 2 — Tutorials", font_size=20), Spacer(1, 10)]
    for sec in tut_secs:
        story += [PageBreak(), print_banner(sec["section"], font_size=18), Spacer(1, 12)]
        for cat in sec["categories"]:
            story += [print_sub_banner(f"{cat['name']}  ·  {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}"),
                      Spacer(1, 8)]
            for card in cat["cards"]:
                story += card_elems(card)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold", 8)
        canvas.setFillColor(black)
        canvas.drawCentredString(letter[0]/2, 0.45*inch,
            f"LeetMastery — DSA Reference  ·  Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({kb:,} KB)")
    return OUTPUT


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Building printable PDFs...")
    b_pdf  = build_behavioral_print()
    sd_pdf = build_systemdesign_print()
    dsa_pdf = build_dsa_print()

    print("\nImposing 6-up landscape...")
    impose_6up_landscape(b_pdf,   SCRIPT_DIR / "LeetMastery_Behavioral_QA_Print_6up_Landscape.pdf")
    impose_6up_landscape(sd_pdf,  SCRIPT_DIR / "LeetMastery_SystemDesign_QA_Print_6up_Landscape.pdf")
    impose_6up_landscape(dsa_pdf, SCRIPT_DIR / "LeetMastery_DSA_Reference_Print_6up_Landscape.pdf")
    print("\nDone.")

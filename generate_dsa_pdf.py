"""
LeetMastery — DSA Reference PDF
Parses data.ts (templates) and tutorials-data.ts (tutorials),
then generates the reference PDF and a 6-up landscape version.
"""
import re
from pathlib import Path

from pygments import lex
from pygments.lexers import CppLexer, PythonLexer, JavaLexer, TextLexer
from pygments.token import Token

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

_LG_TTC = "/System/Library/Fonts/LucidaGrande.ttc"
_MN_TTC = "/System/Library/Fonts/Menlo.ttc"
pdfmetrics.registerFont(TTFont("LG",      _LG_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("LG-Bold", _LG_TTC, subfontIndex=1))
pdfmetrics.registerFont(TTFont("Menlo",   _MN_TTC, subfontIndex=0))

SCRIPT_DIR = Path(__file__).parent
DATA_TS   = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "data.ts"
TUTS_TS   = SCRIPT_DIR / "src" / "app" / "(app)" / "dsa" / "tutorials-data.ts"
OUTPUT    = SCRIPT_DIR / "LeetMastery_DSA_Reference.pdf"
OUTPUT_6UP = SCRIPT_DIR / "LeetMastery_DSA_Reference_6up_Landscape.pdf"
MAX_W = 7.0 * inch

TEMPLATE_COLORS = [
    "#4F46E5", "#7C3AED", "#0EA5E9", "#059669", "#D97706",
    "#DC2626", "#DB2777", "#0891B2", "#65A30D", "#EA580C",
    "#7E22CE", "#0D9488", "#B45309",
]
TUTORIAL_SECTION_COLORS = {
    "Basic Topics":  "#4F46E5",
    "Graph Theory":  "#059669",
    "Math":          "#D97706",
    "Strings":       "#DC2626",
}
TUTORIAL_CAT_COLORS = [
    "#6366F1", "#8B5CF6", "#0EA5E9", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#06B6D4", "#84CC16", "#F97316",
    "#3B82F6", "#14B8A6", "#A855F7", "#22C55E", "#64748B",
]
LANG_BG = {
    "C++":       "#0D1117",
    "Python":    "#0D1117",
    "Java":      "#0D1117",
    "Reference": "#0D1117",
}
LANG_LABEL = {
    "C++":       "#58A6FF",
    "Python":    "#79C0FF",
    "Java":      "#FFA657",
    "Reference": "#7EE787",
}
DEFAULT_BG    = "#0D1117"
DEFAULT_LABEL = "#8B949E"

# Syntax highlight token → color (GitHub Dark theme)
_TC = {
    Token.Keyword:                  "#FF7B72",
    Token.Keyword.Type:             "#FF7B72",
    Token.Keyword.Namespace:        "#FF7B72",
    Token.Keyword.Pseudo:           "#FF7B72",
    Token.Keyword.Reserved:         "#FF7B72",
    Token.Name.Function:            "#D2A8FF",
    Token.Name.Function.Magic:      "#D2A8FF",
    Token.Name.Class:               "#FFA657",
    Token.Name.Decorator:           "#D2A8FF",
    Token.Name.Builtin:             "#79C0FF",
    Token.Name.Builtin.Pseudo:      "#79C0FF",
    Token.Name.Namespace:           "#FFA657",
    Token.Name.Exception:           "#F85149",
    Token.Name.Tag:                 "#7EE787",
    Token.Literal.String:           "#A5D6FF",
    Token.Literal.String.Doc:       "#8B949E",
    Token.Literal.String.Escape:    "#FF7B72",
    Token.Literal.String.Char:      "#A5D6FF",
    Token.Literal.Number:           "#79C0FF",
    Token.Literal.Number.Integer:   "#79C0FF",
    Token.Literal.Number.Float:     "#79C0FF",
    Token.Literal.Number.Hex:       "#79C0FF",
    Token.Literal.Number.Oct:       "#79C0FF",
    Token.Comment:                  "#8B949E",
    Token.Comment.Single:           "#8B949E",
    Token.Comment.Multiline:        "#8B949E",
    Token.Comment.Preproc:          "#FF7B72",
    Token.Comment.PreprocFile:      "#A5D6FF",
    Token.Operator:                 "#F0F6FC",
    Token.Operator.Word:            "#FF7B72",
    Token.Punctuation:              "#F0F6FC",
    Token.Text:                     "#E6EDF3",
    Token.Name:                     "#E6EDF3",
    Token.Error:                    "#F85149",
}
_DEFAULT_TOKEN_COLOR = "#E6EDF3"


def _token_color(ttype):
    while ttype is not Token:
        if ttype in _TC:
            return _TC[ttype]
        ttype = ttype.parent
    return _DEFAULT_TOKEN_COLOR


def safe_xml(s: str) -> str:
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;"))


# ── Parser ─────────────────────────────────────────────────────────────────────

def preprocess_backticks(content: str):
    """Replace backtick template literals with [CODEn] placeholders."""
    codes = []
    result = []
    i = 0
    n = len(content)
    while i < n:
        if content[i] == "`":
            j = i + 1
            while j < n and content[j] != "`":
                j += 1
            codes.append(content[i + 1 : j])
            result.append(f"[CODE{len(codes) - 1}]")
            i = j + 1
        else:
            result.append(content[i])
            i += 1
    return "".join(result), codes


def find_closing_brace(s: str, start: int) -> int:
    """Return index of } matching { at s[start], in preprocessed text."""
    depth = 0
    i = start
    n = len(s)
    while i < n:
        c = s[i]
        if c == "{":
            depth += 1
            i += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
            i += 1
        elif c == "'":
            i += 1
            while i < n:
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == "'":
                    i += 1
                    break
                i += 1
        elif c == '"':
            i += 1
            while i < n:
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == '"':
                    i += 1
                    break
                i += 1
        else:
            i += 1
    return -1


def find_closing_bracket(s: str, start: int) -> int:
    """Return index of ] matching [ at s[start], in preprocessed text."""
    depth = 0
    i = start
    n = len(s)
    while i < n:
        c = s[i]
        if c == "[":
            depth += 1
            i += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return i
            i += 1
        elif c == "{":
            end = find_closing_brace(s, i)
            i = end + 1 if end != -1 else i + 1
        elif c == "'":
            i += 1
            while i < n:
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == "'":
                    i += 1
                    break
                i += 1
        elif c == '"':
            i += 1
            while i < n:
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == '"':
                    i += 1
                    break
                i += 1
        else:
            i += 1
    return -1


def extract_field(text: str, field: str) -> str:
    """Extract string value of a field (single or double quoted)."""
    pat = rf"{re.escape(field)}:\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
    m = re.search(pat, text)
    if not m:
        return ""
    v = m.group(1) if m.group(1) is not None else (m.group(2) or "")
    return v.replace("\\'", "'").replace('\\"', '"')


def extract_snippets(card_flat: str, codes: list) -> list:
    """Extract [{lang, code}] from a preprocessed card string."""
    pat = r"lang:\s*'([^']+)',\s*code:\s*\[CODE(\d+)\]"
    return [
        {"lang": m.group(1), "code": codes[int(m.group(2))]}
        for m in re.finditer(pat, card_flat)
    ]


def split_brace_items(s: str) -> list:
    """Split top-level { ... } items inside s (not including surrounding brackets)."""
    items = []
    i = 0
    n = len(s)
    while i < n:
        while i < n and s[i] in " \t\n\r,":
            i += 1
        if i >= n or s[i] == "]":
            break
        if s[i] == "{":
            end = find_closing_brace(s, i)
            if end == -1:
                break
            items.append(s[i : end + 1])
            i = end + 1
        else:
            i += 1
    return items


def parse_cards(cards_body: str, codes: list) -> list:
    """Parse cards array body (between [ ]) into card dicts."""
    cards = []
    for item in split_brace_items(cards_body):
        cards.append({
            "id":          extract_field(item, "id"),
            "title":       extract_field(item, "title"),
            "description": extract_field(item, "description"),
            "complexity":  extract_field(item, "complexity"),
            "snippets":    extract_snippets(item, codes),
        })
    return cards


def get_array_body(flat: str, var_name: str) -> str:
    """Return the text inside the top-level [ ] of a TS exported array."""
    start = flat.find(var_name)
    if start == -1:
        return ""
    # Look for `= [` to skip past type annotations like `DSACategory[]`
    eq_pos = flat.find("= [", start)
    if eq_pos == -1:
        eq_pos = flat.find("=[", start)
    if eq_pos == -1:
        return ""
    bpos = flat.find("[", eq_pos)
    if bpos == -1:
        return ""
    epos = find_closing_bracket(flat, bpos)
    return flat[bpos + 1 : epos]


def parse_dsa_categories(content: str) -> list:
    flat, codes = preprocess_backticks(content)
    body = get_array_body(flat, "DSA_CATEGORIES")
    categories = []
    for cat_item in split_brace_items(body):
        name = extract_field(cat_item, "name")
        cp = cat_item.find("cards:")
        if cp == -1:
            continue
        bp = cat_item.find("[", cp)
        if bp == -1:
            continue
        ep = find_closing_bracket(cat_item, bp)
        cards_body = cat_item[bp + 1 : ep]
        categories.append({"name": name, "cards": parse_cards(cards_body, codes)})
    return categories


def parse_tutorial_sections(content: str) -> list:
    flat, codes = preprocess_backticks(content)
    body = get_array_body(flat, "TUTORIAL_SECTIONS")
    sections = []
    for sec_item in split_brace_items(body):
        sec_name = extract_field(sec_item, "section")
        cp = sec_item.find("categories:")
        if cp == -1:
            continue
        bp = sec_item.find("[", cp)
        if bp == -1:
            continue
        ep = find_closing_bracket(sec_item, bp)
        cats_body = sec_item[bp + 1 : ep]
        cats = []
        for cat_item in split_brace_items(cats_body):
            cat_name = extract_field(cat_item, "name")
            cp2 = cat_item.find("cards:")
            if cp2 == -1:
                continue
            bp2 = cat_item.find("[", cp2)
            if bp2 == -1:
                continue
            ep2 = find_closing_bracket(cat_item, bp2)
            cat_cards_body = cat_item[bp2 + 1 : ep2]
            cats.append({"name": cat_name, "cards": parse_cards(cat_cards_body, codes)})
        sections.append({"section": sec_name, "categories": cats})
    return sections


# ── PDF Builders ───────────────────────────────────────────────────────────────

def make_banner(text: str, color: str, font_size: int = 18) -> Table:
    p = Paragraph(
        f"<font color='white'><b>{safe_xml(text)}</b></font>",
        ParagraphStyle("bn", fontName="LG-Bold", fontSize=font_size, textColor=white),
    )
    t = Table([[p]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), HexColor(color)),
        ("TOPPADDING",    (0,0),(-1,-1), 12),
        ("BOTTOMPADDING", (0,0),(-1,-1), 12),
        ("LEFTPADDING",   (0,0),(-1,-1), 16),
    ]))
    return t


def make_sub_banner(text: str, color: str) -> Table:
    p = Paragraph(
        f"<font color='white'><b>{safe_xml(text)}</b></font>",
        ParagraphStyle("sb2", fontName="LG-Bold", fontSize=13, textColor=white),
    )
    t = Table([[p]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), HexColor(color)),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 14),
    ]))
    return t


def _highlight_lines(lang: str, code: str) -> list:
    """Return list of Paragraphs, one per line, with pygments syntax highlighting."""
    lexer_map = {"C++": CppLexer, "Python": PythonLexer, "Java": JavaLexer}
    lexer = lexer_map.get(lang, TextLexer)()

    # Tokenize and split into lines of (color, text) pairs
    lines = [[]]
    for ttype, value in lex(code, lexer):
        color = _token_color(ttype)
        parts = value.split("\n")
        for i, part in enumerate(parts):
            if part:
                lines[-1].append((color, part))
            if i < len(parts) - 1:
                lines.append([])

    code_st = ParagraphStyle("cl", fontName="Menlo", fontSize=7.5, leading=11, spaceAfter=0)
    paras = []
    for line_tokens in lines:
        if not line_tokens:
            paras.append(Paragraph("&nbsp;", code_st))
            continue
        xml = "".join(
            f"<font color='{col}'>{safe_xml(txt).replace(' ', '&nbsp;')}</font>"
            for col, txt in line_tokens
        )
        paras.append(Paragraph(xml or "&nbsp;", code_st))
    return paras


def make_code_block(lang: str, code: str) -> Table:
    bg        = LANG_BG.get(lang, DEFAULT_BG)
    label_col = LANG_LABEL.get(lang, DEFAULT_LABEL)
    inner = [
        Paragraph(
            f"<font color='{label_col}'><b>{safe_xml(lang)}</b></font>",
            ParagraphStyle("ll", fontName="Menlo", fontSize=7, leading=10, spaceAfter=4),
        )
    ] + _highlight_lines(lang, code)
    t = Table([[inner]], colWidths=[MAX_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), HexColor(bg)),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
    ]))
    return t


def card_elements(card: dict, title_st, desc_st, cx_st) -> list:
    elems = [Paragraph(safe_xml(card["title"]), title_st)]
    if card.get("description"):
        elems.append(Paragraph(safe_xml(card["description"]), desc_st))
    if card.get("complexity"):
        elems.append(Paragraph(
            f"<font color='#6B7280'><i>{safe_xml(card['complexity'])}</i></font>",
            cx_st,
        ))
    for snip in card.get("snippets", []):
        elems.append(Spacer(1, 4))
        elems.append(make_code_block(snip["lang"], snip["code"]))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=0.5,
                            color=HexColor("#E5E7EB"), spaceAfter=10))
    return elems


def build_pdf():
    dsa_cats = parse_dsa_categories(DATA_TS.read_text())
    tut_secs = parse_tutorial_sections(TUTS_TS.read_text())

    total_cards = (
        sum(len(c["cards"]) for c in dsa_cats)
        + sum(len(c["cards"]) for s in tut_secs for c in s["categories"])
    )

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
        title="LeetMastery — DSA Reference",
        author="Emmanuel Oppong",
    )

    cover_title = ParagraphStyle("ct", fontName="LG-Bold", fontSize=34,
                                 textColor=HexColor("#111827"), alignment=TA_CENTER, spaceAfter=10)
    cover_sub   = ParagraphStyle("cs", fontName="LG", fontSize=13,
                                 textColor=HexColor("#6B7280"), alignment=TA_CENTER, spaceAfter=6)
    card_title  = ParagraphStyle("qtl", fontName="LG-Bold", fontSize=12,
                                 textColor=HexColor("#111827"), spaceAfter=4, leading=16)
    card_desc   = ParagraphStyle("qd", fontName="LG", fontSize=9,
                                 textColor=HexColor("#374151"), leading=13, spaceAfter=3)
    card_cx     = ParagraphStyle("qcx", fontName="LG", fontSize=8.5,
                                 textColor=HexColor("#6B7280"), leading=12, spaceAfter=3)
    toc_head    = ParagraphStyle("th", fontName="LG-Bold", fontSize=16,
                                 textColor=HexColor("#4F46E5"), spaceAfter=14)
    toc_sec     = ParagraphStyle("ts", fontName="LG-Bold", fontSize=11,
                                 textColor=HexColor("#111827"), spaceBefore=8, spaceAfter=2)
    toc_item    = ParagraphStyle("ti", fontName="LG", fontSize=9,
                                 textColor=HexColor("#6B7280"), leftIndent=14, spaceAfter=1)

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story += [
        Spacer(1, 1.8*inch),
        Paragraph("LeetMastery", cover_title),
        Paragraph("DSA Reference", cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph(f"{total_cards} cards  ·  {len(dsa_cats)} template categories  ·  {len(tut_secs)} tutorial sections",
                  cover_sub),
        Spacer(1, 0.1*inch),
        Paragraph("Templates · Tutorials · Code Snippets", cover_sub),
        PageBreak(),
    ]

    # ── Table of Contents ──────────────────────────────────────────────────────
    story.append(Paragraph("<b>Table of Contents</b>", toc_head))

    story.append(Paragraph(
        "<font color='#4F46E5'><b>Part 1 — DSA Templates</b></font>",
        ParagraphStyle("p1", fontName="LG-Bold", fontSize=12,
                       textColor=HexColor("#4F46E5"), spaceBefore=6, spaceAfter=4),
    ))
    for i, cat in enumerate(dsa_cats):
        col = TEMPLATE_COLORS[i % len(TEMPLATE_COLORS)]
        story.append(Paragraph(
            f"<font color='{col}'><b>{safe_xml(cat['name'])}</b></font>  "
            f"<font color='#9CA3AF'>({len(cat['cards'])} cards)</font>",
            toc_sec,
        ))
        for c in cat["cards"]:
            story.append(Paragraph(safe_xml(c["title"]), toc_item))

    story.append(Paragraph(
        "<font color='#059669'><b>Part 2 — Tutorials</b></font>",
        ParagraphStyle("p2", fontName="LG-Bold", fontSize=12,
                       textColor=HexColor("#059669"), spaceBefore=10, spaceAfter=4),
    ))
    for sec in tut_secs:
        col = TUTORIAL_SECTION_COLORS.get(sec["section"], "#6366F1")
        story.append(Paragraph(
            f"<font color='{col}'><b>{safe_xml(sec['section'])}</b></font>",
            toc_sec,
        ))
        for cat in sec["categories"]:
            cnt = len(cat["cards"])
            story.append(Paragraph(
                f"  <font color='#6B7280'>{safe_xml(cat['name'])}</font>  "
                f"<font color='#9CA3AF'>({cnt})</font>",
                toc_item,
            ))
    story.append(PageBreak())

    # ── Part 1: DSA Templates ──────────────────────────────────────────────────
    story += [
        make_banner("Part 1 — DSA Templates", "#111827", font_size=22),
        Spacer(1, 10),
    ]
    for i, cat in enumerate(dsa_cats):
        col = TEMPLATE_COLORS[i % len(TEMPLATE_COLORS)]
        story += [
            PageBreak(),
            make_banner(f"{cat['name']}  ·  {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}", col),
            Spacer(1, 12),
        ]
        for card in cat["cards"]:
            story += card_elements(card, card_title, card_desc, card_cx)

    # ── Part 2: Tutorials ──────────────────────────────────────────────────────
    story += [
        PageBreak(),
        make_banner("Part 2 — Tutorials", "#111827", font_size=22),
        Spacer(1, 10),
    ]
    for sec in tut_secs:
        sec_col = TUTORIAL_SECTION_COLORS.get(sec["section"], "#6366F1")
        story += [
            PageBreak(),
            make_banner(sec["section"], sec_col, font_size=20),
            Spacer(1, 12),
        ]
        for j, cat in enumerate(sec["categories"]):
            cat_col = TUTORIAL_CAT_COLORS[j % len(TUTORIAL_CAT_COLORS)]
            story += [
                make_sub_banner(f"{cat['name']}  ·  {len(cat['cards'])} card{'s' if len(cat['cards'])!=1 else ''}",
                                cat_col),
                Spacer(1, 8),
            ]
            for card in cat["cards"]:
                story += card_elements(card, card_title, card_desc, card_cx)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG", 8)
        canvas.setFillColor(HexColor("#9CA3AF"))
        canvas.drawCentredString(
            letter[0] / 2, 0.45*inch,
            f"LeetMastery — DSA Reference  ·  Page {doc.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    kb = OUTPUT.stat().st_size // 1024
    print(f"✅  {OUTPUT.name}  ({kb:,} KB)")


# ── 6-up Landscape Imposition ──────────────────────────────────────────────────

def impose_6up_landscape():
    import fitz
    src = fitz.open(str(OUTPUT))
    n = len(src)
    sheets = (n + 5) // 6

    # Landscape A4/Letter: 11 x 8.5 inches in points
    pw, ph = letter[1], letter[0]  # landscape
    cols, rows = 3, 2
    cell_w = pw / cols
    cell_h = ph / rows

    out = fitz.open()
    for si in range(sheets):
        sheet = out.new_page(width=pw, height=ph)
        for pos in range(6):
            pi = si * 6 + pos
            if pi >= n:
                break
            col_i = pos % cols
            row_i = pos // cols
            x0 = col_i * cell_w
            y0 = row_i * cell_h
            cell_rect = fitz.Rect(x0, y0, x0 + cell_w, y0 + cell_h)

            src_page = src[pi]
            src_w, src_h = src_page.rect.width, src_page.rect.height
            sx = cell_w / src_w
            sy = cell_h / src_h
            scale = min(sx, sy)
            scaled_w = src_w * scale
            scaled_h = src_h * scale
            ox = x0 + (cell_w - scaled_w) / 2
            oy = y0 + (cell_h - scaled_h) / 2

            dest_rect = fitz.Rect(ox, oy, ox + scaled_w, oy + scaled_h)
            sheet.show_pdf_page(dest_rect, src, pi)

            # Preserve links
            for link in src_page.get_links():
                fr = link["from"]
                new_link = dict(link)
                new_link["from"] = fitz.Rect(
                    ox + fr.x0 * scale,
                    oy + fr.y0 * scale,
                    ox + fr.x1 * scale,
                    oy + fr.y1 * scale,
                )
                sheet.insert_link(new_link)

    out.save(str(OUTPUT_6UP), garbage=4, deflate=True)
    kb = OUTPUT_6UP.stat().st_size // 1024
    print(f"✅  {OUTPUT_6UP.name}  ({kb:,} KB)")
    src.close()
    out.close()


if __name__ == "__main__":
    build_pdf()
    impose_6up_landscape()

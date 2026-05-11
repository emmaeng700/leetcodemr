"""
LeetMastery — NeetCode 32 "Not In 331"
Bold Black Print Edition · 6-up Landscape

Mini-page size: 264×306 pts (exactly 1/6 of a 792×612 landscape sheet).
Six pages imposed 1:1 — no scaling, all glyphs print crisp.

Content per question (may span multiple mini-pages):
  • Colored category bar (mapped canonical pattern name)
  • Title · difficulty pill
  • Time/Space complexity
  • Key insights (from neetcodereview.json)
  • Brute Force Python (handcrafted)
  • Optimal Python (handcrafted)
  • ★ Best Answers from WalkCC · LeetDoocs · SimplyLeet · LeetCode.ca (all Python)
Then at the end:
  • Quick Review section — one card per question (insights + complexity)

Usage:
  python3 generate_neetcode32_print6up.py
Output: LeetMastery_NeetCode32_Print_6up_Landscape.pdf
"""

import json, re
from pathlib import Path
from PIL import ImageEnhance, ImageOps

# ─── Font registration ─────────────────────────────────────────────────────────
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
_LG = "/System/Library/Fonts/LucidaGrande.ttc"
_MN = "/System/Library/Fonts/Menlo.ttc"
try:
    pdfmetrics.registerFont(TTFont("LG",         _LG, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("LG-Bold",    _LG, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("Menlo",       _MN, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Menlo-Bold",  _MN, subfontIndex=1))
except Exception:
    pass

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, SimpleDocTemplate, Image as RLImage,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

import fitz   # PyMuPDF

from pygments import lex
from pygments.lexers import PythonLexer
from pygments.token import Token, Keyword, Name, Comment, String, Number, Operator, Punctuation

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
JSON_PATH    = SCRIPT_DIR / "public" / "neetcodereview.json"
SITES_CACHE  = SCRIPT_DIR / ".nc32_sites_cache.json"
DOOCS_CACHE  = SCRIPT_DIR / ".doocs_cache.json"
INNER_PDF       = SCRIPT_DIR / "_nc32_inner.pdf"
OUTPUT_PDF      = SCRIPT_DIR / "LeetMastery_NeetCode32_Print_6up_Landscape.pdf"
OUTPUT_PDF_LITE = SCRIPT_DIR / "LeetMastery_NeetCode32_Print_6up_Landscape_Light.pdf"

# ─── Mini-page dimensions ──────────────────────────────────────────────────────
MP_W  = 792.0 / 3   # 264 pts
MP_H  = 612.0 / 2   # 306 pts
MG    = 8.0
USE_W = MP_W - 2*MG
USE_H = MP_H - 2*MG

# ─── Colors ────────────────────────────────────────────────────────────────────
BLACK    = HexColor("#000000")
GRAY_900 = HexColor("#111827")
GRAY_700 = HexColor("#374151")
GRAY_500 = HexColor("#6B7280")
GRAY_300 = HexColor("#D1D5DB")
GRAY_100 = HexColor("#F3F4F6")
CODE_BG  = HexColor("#1E1E2E")
CODE_FG  = HexColor("#ABB2BF")

DIFF_COLORS = {
    "easy":   (HexColor("#D1FAE5"), HexColor("#065F46")),
    "medium": (HexColor("#FEF3C7"), HexColor("#92400E")),
    "hard":   (HexColor("#FEE2E2"), HexColor("#991B1B")),
}

# ─── Pattern name map ─────────────────────────────────────────────────────────
PATTERN_MAP = {
    "Sliding Window":          ("Sliding Window",         "#06B6D4"),
    "Stack":                   ("Stack",                  "#F59E0B"),
    "Binary Search":           ("Binary Search",          "#F97316"),
    "Linked List":             ("Linked List",            "#EC4899"),
    "Trees":                   ("Trees & BST",            "#16A34A"),
    "Heap / Priority Queue":   ("Heap",                   "#A855F7"),
    "Backtracking":            ("Backtracking",           "#F43F5E"),
    "Graphs":                  ("Graphs",                 "#EF4444"),
    "Advanced Graphs":         ("Graphs — Advanced",      "#7C3AED"),
    "1-D Dynamic Programming": ("Dynamic Programming 1D", "#D946EF"),
    "2-D Dynamic Programming": ("Dynamic Programming 2D", "#9333EA"),
    "Greedy":                  ("Greedy",                 "#22C55E"),
    "Intervals":               ("Intervals (Greedy)",     "#0EA5E9"),
    "Math & Geometry":         ("Math & Geometry",        "#64748B"),
    "Bit Manipulation":        ("Bit Manipulation",       "#1E3A5F"),
}

# ─── Site metadata ─────────────────────────────────────────────────────────────
SITES = [
    {"key": "walkccc",    "label": "WalkCC",     "color": "#3B82F6"},
    {"key": "doocs",      "label": "LeetDoocs",  "color": "#10B981"},
    {"key": "simplyleet", "label": "SimplyLeet", "color": "#A855F7"},
    {"key": "leetcodeca", "label": "LC.ca",      "color": "#F97316"},
]

# ─── One-Dark token colors ─────────────────────────────────────────────────────
ONE_DARK = {
    Token:"#ABB2BF", Comment:"#5C6370",
    Keyword:"#C678DD", Keyword.Declaration:"#C678DD",
    Keyword.Namespace:"#C678DD", Keyword.Type:"#E5C07B",
    Keyword.Constant:"#D19A66",
    Name.Builtin:"#E5C07B", Name.Builtin.Pseudo:"#E06C75",
    Name.Class:"#E5C07B", Name.Function:"#61AFEF",
    Name.Decorator:"#61AFEF", Name.Exception:"#E06C75",
    String:"#98C379", String.Doc:"#5C6370",
    String.Escape:"#56B6C2", Number:"#D19A66",
    Operator:"#56B6C2", Operator.Word:"#C678DD",
    Punctuation:"#ABB2BF",
}

def tok_color(ttype):
    while ttype is not Token:
        if ttype in ONE_DARK: return ONE_DARK[ttype]
        ttype = ttype.parent
    return ONE_DARK[Token]

def safe_xml(t: str) -> str:
    return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def indent_xml(line: str) -> str:
    """Preserve leading spaces as &nbsp; so ReportLab doesn't collapse them."""
    stripped = line.lstrip(" ")
    spaces   = len(line) - len(stripped)
    return "&nbsp;" * spaces + safe_xml(stripped)

# ─── Syntax highlight Python → ReportLab XML ──────────────────────────────────
def hl_python(code: str, max_lines: int = 80) -> str:
    lines = code.split("\n")[:max_lines]
    tokens = list(lex("\n".join(lines), PythonLexer(stripnl=False)))
    xml_lines, cur = [], []
    for ttype, value in tokens:
        color = tok_color(ttype)
        safe  = value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        parts = safe.split("\n")
        for i, part in enumerate(parts):
            if part:
                cur.append(f'<font color="{color}">{part}</font>')
            if i < len(parts) - 1:
                xml_lines.append("".join(cur)); cur = []
    if cur: xml_lines.append("".join(cur))
    final = []
    for i, xl in enumerate(xml_lines):
        raw = lines[i] if i < len(lines) else ""
        spaces = len(raw) - len(raw.lstrip(" "))
        prefix = "&nbsp;" * spaces
        final.append(prefix + xl)
    return "<br/>".join(final)

# ─── Styles ────────────────────────────────────────────────────────────────────
def make_styles():
    return {
        "title":       ParagraphStyle("ttl",  fontName="LG-Bold",   fontSize=8,   textColor=BLACK,    leading=10,  spaceAfter=1),
        "body":        ParagraphStyle("bd",   fontName="LG-Bold",   fontSize=6.5, textColor=GRAY_700, leading=9,   spaceAfter=1),
        "body_sm":     ParagraphStyle("bds",  fontName="LG-Bold",   fontSize=6,   textColor=GRAY_700, leading=8,   spaceAfter=1),
        "code":        ParagraphStyle("cd",   fontName="Menlo-Bold", fontSize=5.5, textColor=CODE_FG,  leading=7.5),
        "code_print":  ParagraphStyle("cdp",  fontName="Menlo-Bold", fontSize=5.5, textColor=BLACK,    leading=7.5),
        "head2":       ParagraphStyle("h2",   fontName="LG-Bold",   fontSize=7,   textColor=BLACK,    leading=9,   spaceAfter=1),
        "label":       ParagraphStyle("lbl",  fontName="LG-Bold",   fontSize=5.5, textColor=GRAY_500, leading=7),
        "toc":         ParagraphStyle("tc",   fontName="LG-Bold",   fontSize=7,   textColor=BLACK,    leading=10),
        "cover_title": ParagraphStyle("ct",   fontName="LG-Bold",   fontSize=13,  textColor=BLACK,    alignment=TA_CENTER, leading=16),
        "cover_sub":   ParagraphStyle("cs",   fontName="LG-Bold",   fontSize=7,   textColor=GRAY_700, alignment=TA_CENTER, leading=10),
        "site_label":  ParagraphStyle("sl",   fontName="LG-Bold",   fontSize=5.5, textColor=GRAY_500, leading=7,   spaceBefore=3),
    }

S = make_styles()

# ─── Flowable helpers ──────────────────────────────────────────────────────────
def code_panel(code: str, max_lines: int = 80, printable: bool = False) -> list:
    """Code block — dark (default) or light/print mode. Split every 22 lines to avoid mini-page overflow."""
    if not code.strip(): return []
    if printable:
        # Plain black text on light gray background — no syntax highlighting
        raw_lines = code.split("\n")[:max_lines]
        xml_lines = [indent_xml(ln) for ln in raw_lines]
        bg         = GRAY_100
        code_style = S["code_print"]
        border_col = GRAY_300
    else:
        xml_lines  = hl_python(code, max_lines).split("<br/>")
        bg         = CODE_BG
        code_style = S["code"]
        border_col = GRAY_700

    items = []
    for i in range(0, len(xml_lines), 22):
        cell = Paragraph("<br/>".join(xml_lines[i:i+22]), code_style)
        tbl  = Table([[cell]], colWidths=[USE_W])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), bg),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 5),
            ("RIGHTPADDING",  (0,0), (-1,-1), 5),
            ("BOX",           (0,0), (-1,-1), 0.4, border_col),
        ]))
        items.append(tbl)
    return items

def hr(color=GRAY_300, thickness=0.4):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceBefore=2, spaceAfter=2)

def cat_bar(pattern_name: str, hex_color: str, printable: bool = False) -> Table:
    if printable:
        para = Paragraph(
            f'<b>{safe_xml(pattern_name)}</b>',
            ParagraphStyle("cbp", fontName="LG-Bold", fontSize=5.5, textColor=BLACK))
        bg = GRAY_100
        border = [("BOX", (0,0), (-1,-1), 0.5, GRAY_300)]
    else:
        para = Paragraph(
            f'<font color="white"><b>{safe_xml(pattern_name)}</b></font>',
            ParagraphStyle("cb", fontName="LG-Bold", fontSize=5.5, textColor=white))
        bg = HexColor(hex_color)
        border = []
    tbl = Table([[para]], colWidths=[USE_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("RIGHTPADDING",  (0,0), (-1,-1), 5),
    ] + border))
    return tbl

# ─── Data loaders ──────────────────────────────────────────────────────────────
def load_review() -> dict:
    data = json.loads(JSON_PATH.read_text())
    return {e["slug"]: e for e in data}

def load_sites() -> dict:
    if not SITES_CACHE.exists():
        print(f"WARNING: {SITES_CACHE} not found. Run scrape_nc32_sites.py first.")
        return {}
    return json.loads(SITES_CACHE.read_text())

def load_doocs() -> dict:
    if not DOOCS_CACHE.exists():
        print(f"WARNING: {DOOCS_CACHE.name} not found — descriptions will be skipped.")
        return {}
    return json.loads(DOOCS_CACHE.read_text())

def mini_rl_image(url: str):
    """Image scaled to fit mini-page width AND height.
    Converted to grayscale + contrast-boosted for crisp B&W printing."""
    pil = download_image(url)
    if not pil: return None
    w_px, h_px = pil.size
    if w_px == 0 or h_px == 0: return None
    # Convert to grayscale → autocontrast → boost contrast for print
    pil = pil.convert("RGB").convert("L")
    pil = ImageOps.autocontrast(pil, cutoff=2)
    pil = ImageEnhance.Contrast(pil).enhance(2.0)
    pil = ImageEnhance.Sharpness(pil).enhance(1.5)
    max_w = USE_W - 6
    max_h = USE_H * 0.55
    scale = min(max_w / w_px, max_h / h_px, 1.0)
    dw, dh = w_px * scale, h_px * scale
    # Save processed version to a _bw file so original is untouched
    orig = IMG_DIR / _img_filename(url)
    bw_path = orig.with_stem(orig.stem + "_bw")
    try:
        pil.save(str(bw_path))
        return RLImage(str(bw_path), width=dw, height=dh)
    except Exception:
        return None

def desc_to_mini_flowables(desc_html: str) -> list:
    if not desc_html:
        return []
    body_st = ParagraphStyle("dbody", fontName="LG-Bold", fontSize=6,   textColor=GRAY_700, leading=8,   spaceAfter=1)
    li_st   = ParagraphStyle("dli",   fontName="LG-Bold", fontSize=5.8, textColor=GRAY_700, leading=7.5, leftIndent=8, spaceAfter=1)
    hdr_st  = ParagraphStyle("dhdr",  fontName="LG-Bold", fontSize=6.5, textColor=BLACK,    leading=9,   spaceAfter=1, spaceBefore=3)
    pre_st  = ParagraphStyle("dpre",  fontName="Menlo-Bold", fontSize=5, textColor=BLACK,    leading=7)

    flowables = []
    block_re  = re.compile(
        r"(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|"
        r"(<img[^>]*/?>)|"
        r"(<pre[^>]*>)([\s\S]*?)(</pre>)|"
        r"(<ul[^>]*>)([\s\S]*?)(</ul>)|"
        r"(<ol[^>]*>)([\s\S]*?)(</ol>)|"
        r"(<p[^>]*>)([\s\S]*?)(</p>)|"
        r"(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)",
        re.I,
    )
    for m in block_re.finditer(desc_html):
        if m.group(1):
            src = (re.search(r'href=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I) or
                   re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]',  m.group(1), re.I))
            if src:
                url = src.group(1)
                if "shields.io" not in url and "badge" not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(2):
            src = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(2), re.I)
            if src:
                url = src.group(1)
                if "shields.io" not in url and "badge" not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(4) is not None:
            raw = _clean_code(m.group(4) or "").strip()
            if raw:
                safe = raw.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                lines = safe.split("\n")[:25]
                cell = Paragraph("<br/>".join(lines), pre_st)
                tbl  = Table([[cell]], colWidths=[USE_W])
                tbl.setStyle(TableStyle([
                    ("BACKGROUND",    (0,0), (-1,-1), GRAY_100),
                    ("TOPPADDING",    (0,0), (-1,-1), 3),
                    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
                    ("LEFTPADDING",   (0,0), (-1,-1), 5),
                    ("RIGHTPADDING",  (0,0), (-1,-1), 5),
                    ("BOX",           (0,0), (-1,-1), 0.3, GRAY_300),
                ]))
                flowables.append(tbl)
            continue
        if m.group(7) is not None:
            for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(7) or "", re.I):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f"• {text}", li_st))
            continue
        if m.group(10) is not None:
            for i, li in enumerate(re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(10) or "", re.I), 1):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f"{i}. {text}", li_st))
            continue
        if m.group(13) is not None:
            inner = m.group(13) or ""
            img_src = re.search(r'(?:src|href)=["\x27](https://fastly\.jsdelivr[^"\x27>\s]+)["\x27]', inner, re.I)
            if img_src:
                url = img_src.group(1)
                if "shields.io" not in url and "badge" not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
                continue
            text = _inline(inner, printable=True, bold=True).strip()
            if text and text != " ":
                try:
                    flowables.append(Paragraph(text, body_st))
                except Exception:
                    flowables.append(Paragraph(safe_xml(re.sub(r"<[^>]+>", "", text)), body_st))
            continue
        if m.group(16) is not None:
            text = _inline(m.group(16) or "", printable=True, bold=True).strip()
            if text:
                flowables.append(Paragraph(f"<b>{safe_xml(text)}</b>", hdr_st))
            continue
    return flowables

# ─── Import NC32 question list + image helpers ───────────────────────────────
from generate_neetcode32_pdf import NC32
from generate_patterns_pdf import (
    download_image, _img_filename, IMG_DIR, _inline, _clean_code,
)

# ─── Page counter ─────────────────────────────────────────────────────────────
class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1
        canvas.saveState()
        canvas.setFont("LG-Bold", 5)
        canvas.setFillColor(GRAY_500)
        canvas.drawRightString(MP_W - MG, MG - 3, f"p.{self.n}")
        canvas.restoreState()

# ─── Inner PDF builder ────────────────────────────────────────────────────────
def build_inner_pdf(review: dict, sites: dict, doocs: dict, printable: bool = False):
    counter = PageCounter()
    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )

    story = []

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph("LeetMastery", ParagraphStyle(
        "brand", fontName="LG-Bold", fontSize=8, textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("NeetCode 150", S["cover_title"]))
    edition_label = "Not In 331 · Print Edition" if printable else "Not In 331 · 6-up Edition"
    story.append(Paragraph(edition_label, ParagraphStyle(
        "sub2", fontName="LG-Bold", fontSize=9, textColor=GRAY_700, alignment=TA_CENTER, leading=12)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        "32 questions · Python only · Bold black 6-up",
        ParagraphStyle("ci", fontName="LG-Bold", fontSize=6, textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Paragraph(
        "Brute + Optimal · All 4 sites · Key insights · Quick Review",
        ParagraphStyle("ci2", fontName="LG-Bold", fontSize=6, textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph("Contents", ParagraphStyle(
        "toch", fontName="LG-Bold", fontSize=9, textColor=BLACK, spaceAfter=4)))
    story.append(hr())

    cats = {}
    for q in NC32:
        cats.setdefault(q["category"], []).append(q)

    for cat_name, qs in cats.items():
        pattern_name, hex_color = PATTERN_MAP.get(cat_name, (cat_name, "#4F46E5"))
        diff_counts = {}
        for q in qs:
            diff_counts[q["difficulty"]] = diff_counts.get(q["difficulty"], 0) + 1
        diff_str = "  ".join(f'{d[:1]}{n}' for d, n in diff_counts.items())
        toc_color = "#374151" if printable else hex_color
        row = Table([[
            Paragraph(
                f'<font color="{toc_color}"><b>▌</b></font> {safe_xml(pattern_name)}',
                S["toc"]),
            Paragraph(diff_str, ParagraphStyle(
                "dc", fontName="LG-Bold", fontSize=6, textColor=GRAY_500, alignment=TA_LEFT)),
        ]], colWidths=[USE_W*0.72, USE_W*0.28])
        row.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 1),
            ("BOTTOMPADDING", (0,0), (-1,-1), 1),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ]))
        story.append(row)
        for q in qs:
            story.append(Paragraph(
                f'   #{q["id"]} {safe_xml(q["title"])} ({q["difficulty"]})',
                ParagraphStyle("tqe", fontName="LG", fontSize=5.5, textColor=GRAY_700, leading=8)))
    story.append(PageBreak())

    # ── Questions by category ─────────────────────────────────────────────────
    for cat_name, qs in cats.items():
        pattern_name, hex_color = PATTERN_MAP.get(cat_name, (cat_name, "#4F46E5"))

        # Category divider mini-page
        story.append(Spacer(1, USE_H * 0.2))
        if printable:
            banner_para = Paragraph(
                f'<b>{safe_xml(pattern_name)}</b>',
                ParagraphStyle("bnctr_p", fontName="LG-Bold", fontSize=11,
                               textColor=BLACK, alignment=TA_CENTER))
            banner_bg = GRAY_100
            banner_border = [("BOX", (0,0), (-1,-1), 0.6, GRAY_300)]
        else:
            banner_para = Paragraph(
                f'<font color="white"><b>{safe_xml(pattern_name)}</b></font>',
                ParagraphStyle("bnctr", fontName="LG-Bold", fontSize=11,
                               textColor=white, alignment=TA_CENTER))
            banner_bg = HexColor(hex_color)
            banner_border = []

        banner = Table([[banner_para]], colWidths=[USE_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), banner_bg),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ] + banner_border))
        story.append(banner)
        story.append(Spacer(1, 5))
        story.append(Paragraph(
            f'NeetCode 150  ·  Not In 331  ·  {len(qs)} question{"s" if len(qs)!=1 else ""}',
            ParagraphStyle("cbs", fontName="LG-Bold", fontSize=7,
                           textColor=GRAY_500, alignment=TA_CENTER)))
        story.append(PageBreak())

        for q in qs:
            rev         = review.get(q["slug"], {})
            entry       = sites.get(q["slug"], {})
            doocs_entry = doocs.get(str(q["id"]), {})
            story += build_question_block(q, rev, entry, pattern_name, hex_color,
                                          doocs_entry=doocs_entry, printable=printable)

    # ── Quick Review section ──────────────────────────────────────────────────
    story += build_quick_review(review, cats, printable=printable)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f"Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}")


def build_question_block(q: dict, rev: dict, sites_entry: dict,
                          pattern_name: str, hex_color: str,
                          doocs_entry: dict = None,
                          printable: bool = False) -> list:
    items = []
    diff_key = q["difficulty"].lower()
    bg, fg = DIFF_COLORS.get(diff_key, (GRAY_100, BLACK))

    # ── Category bar ──────────────────────────────────────────────────────────
    items.append(cat_bar(pattern_name, hex_color, printable=printable))
    items.append(Spacer(1, 2))

    # ── Title + difficulty pill ───────────────────────────────────────────────
    pill = Table([[Paragraph(
        f'<font color="{fg.hexval()}"><b>{q["difficulty"][:3].upper()}</b></font>',
        ParagraphStyle("p2", fontName="LG-Bold", fontSize=5, textColor=fg)
    )]], colWidths=[0.34*inch])
    pill.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("TOPPADDING",    (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        ("LEFTPADDING",   (0,0), (-1,-1), 2),
        ("RIGHTPADDING",  (0,0), (-1,-1), 2),
    ]))
    title_tbl = Table([[
        Paragraph(f'<b>#{q["id"]} {safe_xml(q["title"])}</b>', S["title"]),
        pill,
    ]], colWidths=[USE_W - 0.38*inch, 0.38*inch])
    title_tbl.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
    ]))
    items.append(title_tbl)
    items.append(Spacer(1, 2))
    items.append(hr(GRAY_300, 0.3))

    # ── Complexity ────────────────────────────────────────────────────────────
    complexity = rev.get("space_and_time_complexity", q.get("complexity", ""))
    if complexity:
        items.append(Paragraph(
            f'<b>⏱ {safe_xml(complexity)}</b>',
            S["body_sm"]))

    # ── Problem description (Doocs HTML with images) ──────────────────────────
    desc_html = (doocs_entry or {}).get("desc_html")
    if desc_html:
        items.append(Spacer(1, 2))
        items.append(Paragraph("<b>Problem</b>", S["head2"]))
        items += desc_to_mini_flowables(desc_html)
        items.append(Spacer(1, 2))

    # ── Key insights ──────────────────────────────────────────────────────────
    insights_raw = rev.get("key_insights", "")
    if not insights_raw:
        insights_raw = "\n".join(f"- {ins}" for ins in q.get("key_insights", []))
    if insights_raw:
        items.append(Paragraph("<b>Key Insights</b>", S["head2"]))
        for line in insights_raw.split("\n"):
            line = line.strip().lstrip("-").strip()
            if line:
                items.append(Paragraph(
                    f"• {safe_xml(line)}",
                    ParagraphStyle("ins", fontName="LG-Bold", fontSize=6,
                                   textColor=GRAY_700, leading=8, leftIndent=5, spaceAfter=0)))

    # ── Brute Force Python ────────────────────────────────────────────────────
    brute_code = q.get("brute", "")
    if brute_code.strip():
        items.append(Spacer(1, 3))
        lbl_color = "#374151" if printable else "#F59E0B"
        items.append(Paragraph(
            f'<font color="{lbl_color}"><b>◼ Brute Force  (Python)</b></font>',
            ParagraphStyle("bl", fontName="LG-Bold", fontSize=6,
                           textColor=HexColor(lbl_color), spaceAfter=1)))
        items += code_panel(brute_code, printable=printable)

    # ── Optimal Python ────────────────────────────────────────────────────────
    optimal_code = q.get("optimal", "")
    if optimal_code.strip():
        items.append(Spacer(1, 3))
        lbl_color = "#374151" if printable else "#61AFEF"
        items.append(Paragraph(
            f'<font color="{lbl_color}"><b>◼ Optimal  (Python)</b></font>',
            ParagraphStyle("ol", fontName="LG-Bold", fontSize=6,
                           textColor=HexColor(lbl_color), spaceAfter=1)))
        items += code_panel(optimal_code, printable=printable)

    # ── Best Answers from all 4 sites ─────────────────────────────────────────
    has_any = any(sites_entry.get(s["key"]) for s in SITES)
    if has_any:
        items.append(Spacer(1, 4))
        items.append(Paragraph(
            '<b>★ Best Answers — All Sites (Python)</b>',
            ParagraphStyle("ba_hdr", fontName="LG-Bold", fontSize=6.5,
                           textColor=GRAY_500, spaceAfter=2)))

        for site_meta in SITES:
            codes = sites_entry.get(site_meta["key"], [])
            if not codes:
                continue
            lbl_color = "#374151" if printable else site_meta["color"]
            items.append(Paragraph(
                f'<font color="{lbl_color}"><b>● {site_meta["label"]}</b></font>',
                ParagraphStyle(
                    f"sl_{site_meta['key']}", fontName="LG-Bold", fontSize=5.5,
                    textColor=HexColor(lbl_color), leading=7, spaceBefore=3)
            ))
            for code_str in codes:
                items += code_panel(code_str, printable=printable)

    items.append(PageBreak())
    return items


def build_quick_review(review: dict, cats: dict, printable: bool = False) -> list:
    """End-of-doc quick-reference section: one mini-page per question."""
    items = [PageBreak()]

    # Section title page
    items.append(Spacer(1, 30))
    items.append(Paragraph("Quick Review", ParagraphStyle(
        "qrt", fontName="LG-Bold", fontSize=14, textColor=BLACK, alignment=TA_CENTER)))
    items.append(Spacer(1, 4))
    items.append(hr())
    items.append(Spacer(1, 5))
    items.append(Paragraph(
        "Key insights + complexity at a glance · all 32 questions",
        ParagraphStyle("qrsub", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    items.append(PageBreak())

    for cat_name, qs in cats.items():
        pattern_name, hex_color = PATTERN_MAP.get(cat_name, (cat_name, "#4F46E5"))
        for q in qs:
            r = review.get(q["slug"], {})
            items += build_qr_card(q, r, pattern_name, hex_color, printable=printable)

    return items


def qr_section_label(text, hex_color, printable: bool = False):
    color = "#374151" if printable else hex_color
    return Paragraph(
        f'<font color="{color}"><b>{text}</b></font>',
        ParagraphStyle(f"qrsl_{text[:4]}", fontName="LG-Bold", fontSize=6.5,
                       textColor=HexColor(color), leading=9, spaceBefore=4, spaceAfter=1))

def build_qr_card(q: dict, r: dict, pattern_name: str, hex_color: str,
                   printable: bool = False) -> list:
    items = []
    diff_key = q["difficulty"].lower()
    bg, fg = DIFF_COLORS.get(diff_key, (GRAY_100, BLACK))

    # ── Header bar ────────────────────────────────────────────────────────────
    items.append(cat_bar(pattern_name, hex_color, printable=printable))
    items.append(Spacer(1, 2))

    pill = Table([[Paragraph(
        f'<font color="{fg.hexval()}"><b>{q["difficulty"][:3].upper()}</b></font>',
        ParagraphStyle("qrp", fontName="LG-Bold", fontSize=5, textColor=fg)
    )]], colWidths=[0.34*inch])
    pill.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("TOPPADDING",    (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        ("LEFTPADDING",   (0,0), (-1,-1), 2),
        ("RIGHTPADDING",  (0,0), (-1,-1), 2),
    ]))
    title_tbl = Table([[
        Paragraph(f'<b>#{q["id"]} {safe_xml(q["title"])}</b>', S["title"]),
        pill,
    ]], colWidths=[USE_W - 0.38*inch, 0.38*inch])
    title_tbl.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
    ]))
    items.append(title_tbl)
    items.append(Spacer(1, 2))
    items.append(hr(GRAY_300, 0.3))

    # ── Key Insights ──────────────────────────────────────────────────────────
    insights_raw = r.get("key_insights", "")
    if not insights_raw:
        insights_raw = "\n".join(f"- {ins}" for ins in q.get("key_insights", []))
    if insights_raw:
        items.append(qr_section_label("Key Insights", hex_color, printable=printable))
        for line in insights_raw.split("\n"):
            line = line.strip().lstrip("-").strip()
            if line:
                items.append(Paragraph(
                    f"• {safe_xml(line)}",
                    ParagraphStyle("qrins", fontName="LG-Bold", fontSize=6,
                                   textColor=GRAY_700, leading=8, leftIndent=4, spaceAfter=0)))

    # ── Space & Time ──────────────────────────────────────────────────────────
    st_text = r.get("space_and_time_complexity", q.get("complexity", ""))
    if st_text:
        items.append(qr_section_label("Space & Time", hex_color, printable=printable))
        for line in st_text.split("\n"):
            line = line.strip()
            if line:
                items.append(Paragraph(
                    safe_xml(line),
                    ParagraphStyle("qrst", fontName="LG-Bold", fontSize=5.8,
                                   textColor=GRAY_700, leading=8, leftIndent=4, spaceAfter=0)))

    # ── Solution prose ────────────────────────────────────────────────────────
    sol_text = r.get("solution", "")
    if sol_text and not sol_text.strip().startswith(("class ", "def ", "#", "import ")):
        items.append(qr_section_label("Solution", hex_color, printable=printable))
        for para in sol_text.split("\n\n"):
            para = para.strip()
            if para:
                items.append(Paragraph(
                    safe_xml(para),
                    ParagraphStyle("qrsol", fontName="LG", fontSize=5.8,
                                   textColor=GRAY_700, leading=8, spaceAfter=2)))

    items.append(PageBreak())
    return items


# ─── 6-up landscape imposer ───────────────────────────────────────────────────
def impose_6up_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H = 792.0, 612.0
    COLS, ROWS = 3, 2
    CW  = L_W / COLS   # 264
    RH  = L_H / ROWS   # 306
    GAP = 3.0

    for i in range(0, n, 6):
        sheet = dst.new_page(width=L_W, height=L_H)

        for j in range(min(6, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * CW + GAP,
                row * RH + GAP,
                (col + 1) * CW - GAP,
                (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid dividers
        shape = sheet.new_shape()
        for cx in [CW, CW*2]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        shape.draw_line(fitz.Point(0, RH), fitz.Point(L_W, RH))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.8)
        shape.commit()

        # Cell borders
        for j in range(min(6, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * CW + GAP/2, row * RH + GAP/2,
                (col+1)*CW - GAP/2, (row+1)*RH - GAP/2,
            )
            s2 = sheet.new_shape()
            s2.draw_rect(rect)
            s2.finish(color=(0.65, 0.65, 0.65), width=0.25, fill=None)
            s2.commit()

    # Sheet-level footer
    for pg_idx in range(len(dst)):
        page = dst[pg_idx]
        page.insert_text(
            fitz.Point(L_W/2 - 55, L_H - 7),
            f"Sheet {pg_idx+1} / {len(dst)}  ·  LeetMastery NeetCode 32 · Not In 331",
            fontsize=6, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    num_sheets = len(dst)
    src.close()
    dst.close()
    print(f"6-up landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}")


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--printable", action="store_true",
                        help="Generate light-background print edition (black text, no syntax colour)")
    parser.add_argument("--both", action="store_true",
                        help="Generate both dark and light editions")
    args = parser.parse_args()

    review = load_review()
    sites  = load_sites()
    doocs  = load_doocs()

    total_scraped = sum(sum(len(v) for v in sites.get(q["slug"], {}).values()) for q in NC32)
    print(f"Loaded {len(review)} quick-review entries  ·  {total_scraped} scraped Python solutions  ·  {len(doocs)} doocs descriptions")

    modes = []
    if args.both:
        modes = [False, True]
    elif args.printable:
        modes = [True]
    else:
        modes = [False]

    for printable in modes:
        out = OUTPUT_PDF_LITE if printable else OUTPUT_PDF
        edition = "light/print" if printable else "dark/colour"
        print(f"\nBuilding inner mini-page PDF ({edition})…")
        build_inner_pdf(review, sites, doocs, printable=printable)

        print(f"Imposing 6-up landscape → {out.name}…")
        impose_6up_landscape(INNER_PDF, out)

        INNER_PDF.unlink(missing_ok=True)
        print(f"Done → {out}")

    print("\nAll done.")

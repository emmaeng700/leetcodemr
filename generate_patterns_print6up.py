"""
LeetMastery — By Pattern · Python Only · Print 6-up Landscape
==============================================================
Native 264×306 mini-pages imposed 1:1 — no scaling, bold LG-Bold/Menlo-Bold
at the same sizes as the NeetCode 32 file.  Prints crisp at 6-up or 2-up.

Content per question (same as the original By-Pattern PDF):
  • Problem description (Doocs HTML, with images)
  • Brute-force Python (hand-crafted where available)
  • ALL Python solutions from all 4 sites (WalkCC, LeetDoocs, SimplyLeet, LC.ca)
Patterns sorted ascending by question count.

Usage:
  python3 generate_patterns_print6up.py
Output:
  LeetMastery_By_Pattern_Python_Only_Print_6up_Landscape.pdf
"""

import json, re
from pathlib import Path

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
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, SimpleDocTemplate, Image as RLImage, Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

import fitz  # PyMuPDF

# ─── Import reusable helpers from main generator ──────────────────────────────
from generate_patterns_pdf import (
    build_groups,
    _inline,
    _clean_code,
    download_image,
    _img_filename,
    IMG_DIR,
    gen_brute_force_python,
    SITES,
    _QR_DATA,
)

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
QUESTIONS   = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE = SCRIPT_DIR / ".full_langs_cache.json"   # same cache as generate_patterns_pdf
DOOCS_CACHE = SCRIPT_DIR / ".doocs_cache.json"
INNER_PDF   = SCRIPT_DIR / "_bp_inner.pdf"
OUTPUT_PDF  = SCRIPT_DIR / "LeetMastery_By_Pattern_Python_Only_Print_6up_Landscape.pdf"

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

DIFF_COLORS = {
    "easy":   (HexColor("#D1FAE5"), HexColor("#065F46")),
    "medium": (HexColor("#FEF3C7"), HexColor("#92400E")),
    "hard":   (HexColor("#FEE2E2"), HexColor("#991B1B")),
}

SITE_META = [
    ("walkccc",    "WalkCC"),
    ("doocs",      "LeetDoocs"),
    ("simplyleet", "SimplyLeet"),
    ("leetcodeca", "LC.ca"),
]

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
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceBefore=2, spaceAfter=2)

def mini_rl_image(url: str):
    """Image scaled to fit mini-page width AND height."""
    pil = download_image(url)
    if not pil: return None
    w_px, h_px = pil.size
    if w_px == 0 or h_px == 0: return None
    max_w = USE_W - 6
    max_h = USE_H * 0.55
    scale = min(max_w / w_px, max_h / h_px, 1.0)
    dw, dh = w_px * scale, h_px * scale
    fpath = IMG_DIR / _img_filename(url)
    try:
        return RLImage(str(fpath), width=dw, height=dh)
    except Exception:
        return None

# ─── Mini-page description renderer ───────────────────────────────────────────
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

# ─── Code panel ───────────────────────────────────────────────────────────────
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

def site_label(label: str) -> Paragraph:
    return Paragraph(
        f"<b>● {label}</b>",
        ParagraphStyle(f"sl_{label}", fontName="LG-Bold", fontSize=5.5,
                       textColor=GRAY_700, leading=7, spaceBefore=3))

# ─── Data loaders ──────────────────────────────────────────────────────────────
def load_questions() -> list:
    return json.loads(QUESTIONS.read_text())

def load_sites() -> dict:
    if not SITES_CACHE.exists():
        print(f"WARNING: {SITES_CACHE.name} not found.")
        return {}
    return json.loads(SITES_CACHE.read_text())

def load_doocs() -> dict:
    if not DOOCS_CACHE.exists():
        print(f"WARNING: {DOOCS_CACHE.name} not found — descriptions will be skipped.")
        return {}
    return json.loads(DOOCS_CACHE.read_text())

# ─── Page state (shared between SetPattern flowable and footer callback) ───────
_PAGE_STATE: dict = {"pattern": ""}

class SetPattern(Flowable):
    """Zero-height marker flowable. Updates the pattern footer for this and
    all subsequent pages within the same pattern."""
    def __init__(self, name: str):
        super().__init__()
        self.name   = name
        self.width  = 0
        self.height = 0

    def draw(self):
        _PAGE_STATE["pattern"] = self.name
        # on_page already ran for this page → stamp the footer now
        c = self.canv
        c.saveState()
        c.setFont("LG-Bold", 5)
        c.setFillColor(GRAY_500)
        c.drawString(MG, MG - 3, self.name)
        c.restoreState()


# ─── Page counter ──────────────────────────────────────────────────────────────
class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1
        canvas.saveState()
        canvas.setFont("LG-Bold", 5)
        canvas.setFillColor(GRAY_500)
        canvas.drawRightString(MP_W - MG, MG - 3, f"p.{self.n}")
        if _PAGE_STATE["pattern"]:
            canvas.drawString(MG, MG - 3, _PAGE_STATE["pattern"])
        canvas.restoreState()

# ─── Question block ────────────────────────────────────────────────────────────
def build_question_block(q: dict, sites_cache: dict, doocs_cache: dict,
                          pattern_name: str, pattern_obj: dict) -> list:
    items = []
    slug     = q.get("slug", "")
    qid      = q["id"]
    diff_key = q.get("difficulty", "easy").lower()
    bg, fg   = DIFF_COLORS.get(diff_key, (GRAY_100, BLACK))

    # ── Category bar ──────────────────────────────────────────────────────────
    items.append(cat_bar(pattern_name))
    items.append(Spacer(1, 2))

    # ── Title + difficulty pill ───────────────────────────────────────────────
    pill = Table([[Paragraph(
        f'<font color="{fg.hexval()}"><b>{q.get("difficulty","?")[:3].upper()}</b></font>',
        ParagraphStyle("pill", fontName="LG-Bold", fontSize=5, textColor=fg),
    )]], colWidths=[0.34 * inch])
    pill.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("TOPPADDING",    (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        ("LEFTPADDING",   (0,0), (-1,-1), 2),
        ("RIGHTPADDING",  (0,0), (-1,-1), 2),
    ]))
    title_tbl = Table([[
        Paragraph(f'<b>#{qid} {safe_xml(q["title"])}</b>', S["title"]),
        pill,
    ]], colWidths=[USE_W - 0.38 * inch, 0.38 * inch])
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

    # ── Links ─────────────────────────────────────────────────────────────────
    links = (
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">LeetDoocs</a>  ·  '
        f'<a href="https://www.simplyleet.com/{slug}" color="#000000">SimplyLeet</a>  ·  '
        f'<a href="https://walkccc.me/LeetCode/problems/{qid}/" color="#000000">WalkCC</a>  ·  '
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>'
    )
    items.append(Paragraph(links, ParagraphStyle(
        "lnk", fontName="LG-Bold", fontSize=5.5, textColor=BLACK, leading=8, spaceAfter=2)))

    # ── Tags ──────────────────────────────────────────────────────────────────
    tags = q.get("tags", [])
    if tags:
        items.append(Paragraph(
            "  ·  ".join(safe_xml(t) for t in tags[:10]),
            ParagraphStyle("tg", fontName="LG-Bold", fontSize=5.5,
                           textColor=GRAY_500, leading=7, spaceAfter=2)))

    # ── Source lists ──────────────────────────────────────────────────────────
    source = q.get("source", [])
    if source:
        items.append(Paragraph(
            f"Lists: {'  |  '.join(safe_xml(s) for s in source)}",
            ParagraphStyle("src", fontName="LG-Bold", fontSize=5.5,
                           textColor=GRAY_500, leading=7, spaceAfter=2)))

    # ── Complexity ────────────────────────────────────────────────────────────
    expl = q.get("explanation", "").strip()
    if expl:
        items.append(Paragraph(f"<b>⏱ {safe_xml(expl[:200])}</b>", S["body_sm"]))

    # ── Problem description (Doocs HTML with images) ──────────────────────────
    desc_html = doocs_cache.get(str(qid), {}).get("desc_html")
    if desc_html:
        items.append(Spacer(1, 2))
        items.append(Paragraph("<b>Problem</b>", S["head2"]))
        items += desc_to_mini_flowables(desc_html)
        items.append(Spacer(1, 2))

    is_js_pattern = (pattern_name == "JavaScript")

    # ── Brute Force Python (skip for JavaScript pattern) ──────────────────────
    if not is_js_pattern:
        bf = gen_brute_force_python(q, pattern_name)
        if bf and bf.strip():
            items.append(Paragraph(
                "<b>◼ Brute Force (Python)</b>",
                ParagraphStyle("bfl", fontName="LG-Bold", fontSize=6,
                               textColor=GRAY_700, spaceAfter=1)))
            items += code_panel(bf)

    # ── Build merged block map ─────────────────────────────────────────────────
    entry = sites_cache.get(slug, {})
    doocs_blocks = doocs_cache.get(str(qid), {}).get("blocks", [])
    merged = dict(entry)
    merged["doocs"] = [{"code": b["code"], "lang": b.get("lang","")} for b in doocs_blocks]

    if is_js_pattern:
        # ── JavaScript pattern: show JS / TypeScript community solutions ───────
        js_langs = ("javascript", "js", "typescript", "ts")
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            js_blocks = [b for b in blocks if b.get("lang","").lower() in js_langs]
            if not js_blocks:
                continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    "<b>★ Community Solutions (JavaScript / TypeScript)</b>",
                    ParagraphStyle("cs_hdr", fontName="LG-Bold", fontSize=6.5,
                                   textColor=GRAY_500, spaceAfter=2)))
                has_any = True
            items.append(site_label(site_label_str))
            seen = set()
            for b in js_blocks:
                key = b["code"][:100]
                if key in seen:
                    continue
                seen.add(key)
                items += code_panel(b["code"])

        if not has_any:
            items.append(Spacer(1, 3))
            items.append(Paragraph(
                "No JavaScript / TypeScript community solution in cache.",
                ParagraphStyle("njs", fontName="LG-Bold", fontSize=6,
                               textColor=GRAY_500, leading=8)))

    else:
        # ── All other patterns: show Python community solutions ────────────────
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            py_blocks = [b for b in blocks if b.get("lang","").lower() in ("python","python3","py")]
            if not py_blocks:
                continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    "<b>★ Community Solutions (Python)</b>",
                    ParagraphStyle("cs_hdr", fontName="LG-Bold", fontSize=6.5,
                                   textColor=GRAY_500, spaceAfter=2)))
                has_any = True
            items.append(site_label(site_label_str))
            seen = set()
            for b in py_blocks:
                key = b["code"][:100]
                if key in seen:
                    continue
                seen.add(key)
                items += code_panel(b["code"])

        # ── Fallback: use python_solution from questions JSON if cache is empty ─
        if not has_any:
            fallback = (q.get("python_solution") or "").strip()
            if fallback:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    "<b>★ Solution (Python)</b>",
                    ParagraphStyle("cs_hdr", fontName="LG-Bold", fontSize=6.5,
                                   textColor=GRAY_500, spaceAfter=2)))
                items += code_panel(fallback)

    items.append(PageBreak())
    return items


# ─── Per-pattern Quick Review (after each pattern's questions) ────────────────
def build_pattern_quick_review(pat: dict, qs: list) -> list:
    """One mini-page per question: Key Insights · Space & Time · Solution."""
    pattern_name = pat["name"]
    items = [PageBreak()]

    # Banner
    items.append(cat_bar(f">> Quick Review — {pattern_name}"))
    items.append(Spacer(1, 2))
    items.append(Paragraph(
        f"<b>{len(qs)} question{'s' if len(qs) != 1 else ''}  ·  insights · complexity · solution</b>",
        ParagraphStyle("qr_sub", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, leading=8, spaceAfter=3)))
    items.append(hr(GRAY_300, 0.3))

    label_st = ParagraphStyle("qrl", fontName="LG-Bold", fontSize=6,
                               textColor=BLACK, leading=8, spaceBefore=4, spaceAfter=1)
    body_st  = ParagraphStyle("qrb", fontName="LG-Bold", fontSize=5.8,
                               textColor=GRAY_700, leading=8, leftIndent=6, spaceAfter=1)
    diff_colors = {"Easy": "#16A34A", "Medium": "#D97706", "Hard": "#DC2626"}

    for q in qs:
        slug = q.get("slug", "")
        diff = q.get("difficulty", "")
        dc   = diff_colors.get(diff, "#6B7280")
        info = _QR_DATA.get(slug, {})

        # Title row
        items.append(Paragraph(
            f'<b>#{q["id"]}  {safe_xml(q["title"])}</b>  '
            f'<font color="{dc}">[{diff}]</font>',
            ParagraphStyle("qrt", fontName="LG-Bold", fontSize=6.5,
                           textColor=BLACK, leading=9, spaceBefore=6, spaceAfter=1)))

        if info:
            ki = info.get("key_insights", "")
            if ki:
                items.append(Paragraph("<b>Key Insights</b>", label_st))
                for line in ki.split("\n"):
                    line = line.strip().lstrip("-• ").strip()
                    if line:
                        items.append(Paragraph(f"• {safe_xml(line)}", body_st))

            cx = info.get("complexity", "")
            if cx:
                items.append(Paragraph("<b>Space &amp; Time</b>", label_st))
                for line in cx.split("\n"):
                    line = line.strip()
                    if line:
                        items.append(Paragraph(safe_xml(line), body_st))

            sol = info.get("solution", "")
            if sol:
                items.append(Paragraph("<b>Solution</b>", label_st))
                for para in sol.split("\n\n"):
                    para = re.sub(r'\s*\n\s*', ' ', para).strip()
                    if para:
                        items.append(Paragraph(safe_xml(para), body_st))
        else:
            items.append(Paragraph(
                "No quick-review data available.",
                ParagraphStyle("nqr", fontName="LG-Bold", fontSize=5.8,
                               textColor=GRAY_500, leading=8)))

        items.append(HRFlowable(width="100%", thickness=0.3,
                                color=GRAY_300, spaceAfter=2))

    items.append(Spacer(1, 6))
    return items



# ─── Inner PDF builder ────────────────────────────────────────────────────────
def build_inner_pdf(groups: list, sites: dict, doocs: dict):
    counter  = PageCounter()
    total_qs = sum(len(qs) for _, qs in groups)
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
        "brand", fontName="LG-Bold", fontSize=8, textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("By Pattern", S["cover_title"]))
    story.append(Paragraph("Python Only · Print Edition", ParagraphStyle(
        "sub2", fontName="LG-Bold", fontSize=9, textColor=GRAY_700,
        alignment=TA_CENTER, leading=12)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        f"{total_qs} questions · {len(groups)} patterns · bold black · 6-up",
        ParagraphStyle("ci", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(Paragraph(
        "Descriptions + images · Brute force · All 4 sites · Sorted fewest→most",
        ParagraphStyle("ci2", fontName="LG-Bold", fontSize=6,
                       textColor=GRAY_500, alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph("Contents", ParagraphStyle(
        "toch", fontName="LG-Bold", fontSize=9, textColor=BLACK, spaceAfter=4)))
    story.append(hr())

    for rank, (pat, qs) in enumerate(groups, 1):
        diff_counts = {}
        for q in qs:
            d = q.get("difficulty", "?")
            diff_counts[d] = diff_counts.get(d, 0) + 1
        diff_str = "  ".join(f'{d[0]}{n}' for d, n in diff_counts.items())
        row = Table([[
            Paragraph(f'<b>#{rank}  {safe_xml(pat["name"])}</b>  ({len(qs)})', S["toc"]),
            Paragraph(diff_str, ParagraphStyle(
                "dc", fontName="LG-Bold", fontSize=6, textColor=GRAY_500, alignment=TA_LEFT)),
        ]], colWidths=[USE_W * 0.72, USE_W * 0.28])
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
                f'   #{q["id"]} {safe_xml(q["title"])} ({q.get("difficulty","?")})',
                ParagraphStyle("tqe", fontName="LG", fontSize=5.5,
                               textColor=GRAY_700, leading=8)))
    story.append(PageBreak())

    # ── Questions by pattern ──────────────────────────────────────────────────
    for rank, (pat, qs) in enumerate(groups, 1):
        pattern_name = pat["name"]

        story.append(SetPattern(pattern_name))
        story.append(Spacer(1, USE_H * 0.2))
        banner = Table([[Paragraph(
            f"<b>#{rank}  {safe_xml(pattern_name)}</b>",
            ParagraphStyle("bnctr", fontName="LG-Bold", fontSize=11,
                           textColor=BLACK, alignment=TA_CENTER),
        )]], colWidths=[USE_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), GRAY_100),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("BOX",           (0,0), (-1,-1), 0.6, GRAY_300),
        ]))
        story.append(banner)
        story.append(Spacer(1, 5))
        story.append(Paragraph(
            f'By Pattern · Python Only · {len(qs)} question{"s" if len(qs) != 1 else ""}',
            ParagraphStyle("cbs", fontName="LG-Bold", fontSize=7,
                           textColor=GRAY_500, alignment=TA_CENTER)))
        story.append(PageBreak())

        for q in qs:
            story += build_question_block(q, sites, doocs, pattern_name, pat)

        # ── Per-pattern Quick Review (Key Insights · Space & Time · Solution) ──
        story += build_pattern_quick_review(pat, qs)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f"Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}")


# ─── 6-up landscape imposer ───────────────────────────────────────────────────
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
            col  = j % COLS
            row  = j // COLS
            s2   = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.25, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 70, L_H - 7),
            f"Sheet {pg_idx + 1} / {num_sheets}  ·  LeetMastery By Pattern · Python Only",
            fontsize=6, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f"6-up landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}")


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Loading data…")
    questions = load_questions()
    sites     = load_sites()
    doocs     = load_doocs()
    print(f"  {len(questions)} questions · sites: {len(sites)} · doocs: {len(doocs)}")

    print("Grouping by pattern (ascending question count)…")
    groups = build_groups(questions)
    groups.sort(key=lambda g: len(g[1]))
    for rank, (pat, qs) in enumerate(groups, 1):
        e = sum(1 for q in qs if q.get("difficulty") == "Easy")
        m = sum(1 for q in qs if q.get("difficulty") == "Medium")
        h = sum(1 for q in qs if q.get("difficulty") == "Hard")
        print(f"  #{rank:2d}  {pat['name']:25s}  {len(qs):3d} q  (E{e} M{m} H{h})")

    print("\nBuilding inner mini-page PDF…")
    build_inner_pdf(groups, sites, doocs)

    print("Imposing 6-up landscape…")
    impose_6up_landscape(INNER_PDF, OUTPUT_PDF)

    INNER_PDF.unlink(missing_ok=True)
    kb = OUTPUT_PDF.stat().st_size // 1024
    print(f"\nDone → {OUTPUT_PDF}  ({kb:,} KB)")

"""
LeetMastery — Study-Order PDF (Priority-Grouped · Difficulty-First)
====================================================================
9 chapters following the exact studyOrder.ts ordering:
  Round 1  High · Easy
  Round 2  High · Medium
  Round 3  High · Hard
  Round 4  Mid  · Easy
  Round 5  Mid  · Medium
  Round 6  Mid  · Hard
  Round 7  Low  · Easy
  Round 8  Low  · Medium
  Round 9  Low  · Hard

Within each round questions are further grouped by pattern
(DISPLAY_PATTERN_ORDER within the tier) then sorted by id.
A Quick-Review summary (key insights · complexity · solution) is
appended at the end of each chapter.

Output:
  LeetMastery_Study_Order_9up_Portrait.pdf   ← print-ready
  _study_order_inner.pdf                      ← deleted after use

Usage:
  python3 generate_study_order_pdf.py
"""

import json, re, sys
from pathlib import Path

LANDSCAPE  = '--landscape' in sys.argv
GRID_4X4   = '--4x4'      in sys.argv
GRID_2X2   = '--2x2'      in sys.argv

# ─── Font registration ────────────────────────────────────────────────────────
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

# ─── Reuse helpers from the main generator ───────────────────────────────────
from generate_patterns_pdf import (
    QUICK_PATTERNS,
    _inline,
    _clean_code,
    download_image,
    _img_filename,
    IMG_DIR,
    gen_brute_force_python,
    SITES,
    _QR_DATA,
)

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
QUESTIONS   = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE = SCRIPT_DIR / ".full_langs_cache.json"
DOOCS_CACHE = SCRIPT_DIR / ".doocs_cache.json"
INNER_PDF   = SCRIPT_DIR / "_study_order_inner.pdf"
OUTPUT_PDF  = SCRIPT_DIR / (
    "LeetMastery_Study_Order_2x2_Landscape.pdf"  if GRID_2X2
    else "LeetMastery_Study_Order_4x4_Landscape.pdf"  if GRID_4X4
    else "LeetMastery_Study_Order_36up_Landscape.pdf" if LANDSCAPE
    else "LeetMastery_Study_Order_36up_Portrait.pdf"
)

# ─── Study-order configuration ───────────────────────────────────────────────
# Mirrors the TypeScript PATTERN_PRIORITY from constants.ts
PATTERN_PRIORITY = {
    'Arrays & Hashing':    'High',
    'String':              'High',
    'Two Pointers':        'High',
    'Sliding Window':      'High',
    'Sorting':             'High',
    'Binary Search':       'High',
    'Matrix':              'High',
    'Trees & BST':         'High',
    'DFS':                 'High',
    'Graphs':              'High',
    'BFS':                 'High',
    'Linked List':         'Mid',
    'Stack':               'Mid',
    'Heap':                'Mid',
    'Trie':                'Mid',
    'Backtracking':        'Mid',
    'Greedy':              'Mid',
    'Dynamic Programming': 'Low',
    'Bit Manipulation':    'Low',
    'Math':                'Low',
    'JavaScript':          'Low',
}

# Display order within each priority tier (mirrors DISPLAY_PATTERN_ORDER)
DISPLAY_PATTERN_ORDER = [
    'Arrays & Hashing', 'String', 'Two Pointers', 'Sliding Window', 'Sorting',
    'Binary Search', 'Matrix', 'Trees & BST', 'DFS', 'Graphs', 'BFS',
    'Linked List', 'Stack', 'Heap', 'Trie', 'Backtracking', 'Greedy',
    'Dynamic Programming', 'Bit Manipulation', 'Math', 'JavaScript',
]

# 9 rounds in study order
ROUNDS = [
    (1, 'High', 'Easy'),
    (2, 'High', 'Medium'),
    (3, 'High', 'Hard'),
    (4, 'Mid',  'Easy'),
    (5, 'Mid',  'Medium'),
    (6, 'Mid',  'Hard'),
    (7, 'Low',  'Easy'),
    (8, 'Low',  'Medium'),
    (9, 'Low',  'Hard'),
]

PRIORITY_COLORS = {
    'High': {'pill_bg': HexColor('#FEE2E2'), 'pill_fg': HexColor('#991B1B'),  'bar': HexColor('#DC2626')},
    'Mid':  {'pill_bg': HexColor('#FEF3C7'), 'pill_fg': HexColor('#92400E'),  'bar': HexColor('#D97706')},
    'Low':  {'pill_bg': HexColor('#F3F4F6'), 'pill_fg': HexColor('#374151'),  'bar': HexColor('#6B7280')},
}
DIFF_COLORS_PILL = {
    'Easy':   (HexColor('#D1FAE5'), HexColor('#065F46')),
    'Medium': (HexColor('#FEF3C7'), HexColor('#92400E')),
    'Hard':   (HexColor('#FEE2E2'), HexColor('#991B1B')),
}
DIFF_DOT = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}

# ─── Mini-page dimensions (3×3 on 612×792 portrait letter) ──────────────────
MP_W  = 612.0 / 3   # 204 pts
MP_H  = 792.0 / 3   # 264 pts
MG    = 8.0
USE_W = MP_W - 2 * MG - 12
USE_H = MP_H - 2 * MG

# ─── Colors ──────────────────────────────────────────────────────────────────
BLACK    = HexColor('#000000')
GRAY_700 = HexColor('#374151')
GRAY_500 = HexColor('#6B7280')
GRAY_300 = HexColor('#D1D5DB')
GRAY_100 = HexColor('#F3F4F6')

SITE_META = [
    ('walkccc',    'WalkCC'),
    ('doocs',      'LeetDoocs'),
    ('simplyleet', 'SimplyLeet'),
    ('leetcodeca', 'LC.ca'),
]

# ─── Styles ──────────────────────────────────────────────────────────────────
# 4×4 mode: inner pages match cell size (no scaling), so use full readable sizes.
# Default: pages scaled down ~58% when imposed, so source sizes are small.
if GRID_4X4:
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=11, textColor=BLACK, leading=14),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=8, textColor=BLACK, alignment=TA_CENTER, leading=10),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=8, textColor=BLACK, alignment=TA_CENTER, leading=10),
    }
else:
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=8,   textColor=BLACK, leading=10,  spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=6,   textColor=BLACK, leading=8,   spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=5.8, textColor=BLACK, leading=7.5, spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=5.5, textColor=BLACK, leading=7.5),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=6.5, textColor=BLACK, leading=9,   spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=7,   textColor=BLACK, leading=10),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=13,  textColor=BLACK, alignment=TA_CENTER, leading=16),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=7,   textColor=BLACK, alignment=TA_CENTER, leading=10),
    }

# ─── Helpers ─────────────────────────────────────────────────────────────────
def safe_xml(t: str) -> str:
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def indent_xml(line: str) -> str:
    stripped = line.lstrip(' ')
    spaces   = len(line) - len(stripped)
    return '&nbsp;' * spaces + safe_xml(stripped)

def hr(color=BLACK, thickness=0.8):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceBefore=2, spaceAfter=2)

def mini_rl_image(url: str):
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

# ─── Exclusive pattern assignment (same logic as buildExclusivePatternMap.ts) ─
def build_exclusive_map(questions: list) -> dict:
    """Returns {question_id: pattern_name} using first-match in QUICK_PATTERNS order."""
    assigned = {}
    for p in QUICK_PATTERNS:
        ptags = set(p['tags'])
        for q in questions:
            if q['id'] not in assigned and set(q.get('tags', [])) & ptags:
                assigned[q['id']] = p['name']
    return assigned

# ─── Build 9 rounds from questions list ──────────────────────────────────────
def build_rounds(questions: list) -> list:
    """
    Returns list of (round_num, priority, difficulty, [(pat_obj, [q, ...])])
    sorted in study order. Within each round questions are grouped by pattern
    (DISPLAY_PATTERN_ORDER within that priority tier), then by question id.
    """
    exclusive = build_exclusive_map(questions)
    pat_by_name = {p['name']: p for p in QUICK_PATTERNS}

    result = []
    for round_num, priority, difficulty in ROUNDS:
        # Get patterns for this priority tier, in DISPLAY order
        tier_patterns = [p for p in DISPLAY_PATTERN_ORDER
                         if PATTERN_PRIORITY.get(p) == priority]
        pattern_groups = []
        for pat_name in tier_patterns:
            pat_obj = pat_by_name.get(pat_name)
            if not pat_obj:
                continue
            qs = [q for q in questions
                  if exclusive.get(q['id']) == pat_name
                  and q.get('difficulty') == difficulty]
            qs.sort(key=lambda q: q['id'])
            if qs:
                pattern_groups.append((pat_obj, qs))
        result.append((round_num, priority, difficulty, pattern_groups))
    return result

# ─── Description renderer ─────────────────────────────────────────────────────
def desc_to_mini_flowables(desc_html: str) -> list:
    if not desc_html:
        return []
    body_st = ParagraphStyle('dbody', fontName='LG-Bold', fontSize=6,   textColor=BLACK, leading=8,   spaceAfter=1)
    li_st   = ParagraphStyle('dli',   fontName='LG-Bold', fontSize=5.8, textColor=BLACK, leading=7.5, leftIndent=8, spaceAfter=1)
    hdr_st  = ParagraphStyle('dhdr',  fontName='LG-Bold', fontSize=6.5, textColor=BLACK, leading=9,   spaceAfter=1, spaceBefore=3)
    pre_st  = ParagraphStyle('dpre',  fontName='Menlo-Bold', fontSize=5, textColor=BLACK, leading=7)

    flowables = []
    block_re  = re.compile(
        r'(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|'
        r'(<img[^>]*/?>)|'
        r'(<pre[^>]*>)([\s\S]*?)(</pre>)|'
        r'(<ul[^>]*>)([\s\S]*?)(</ul>)|'
        r'(<ol[^>]*>)([\s\S]*?)(</ol>)|'
        r'(<p[^>]*>)([\s\S]*?)(</p>)|'
        r'(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)',
        re.I,
    )
    for m in block_re.finditer(desc_html):
        if m.group(1):
            src = (re.search(r'href=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I) or
                   re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]',  m.group(1), re.I))
            if src:
                url = src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(2):
            src = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(2), re.I)
            if src:
                url = src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(4) is not None:
            raw = _clean_code(m.group(4) or '').strip()
            if raw:
                safe = raw.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
                lines = safe.split('\n')[:8]
                cell = Paragraph('<br/>'.join(lines), pre_st)
                tbl  = Table([[cell]], colWidths=[USE_W])
                tbl.setStyle(TableStyle([
                    ('BACKGROUND',    (0,0), (-1,-1), white),
                    ('TOPPADDING',    (0,0), (-1,-1), 3),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                    ('LEFTPADDING',   (0,0), (-1,-1), 5),
                    ('RIGHTPADDING',  (0,0), (-1,-1), 5),
                    ('BOX',           (0,0), (-1,-1), 1.0, BLACK),
                ]))
                flowables.append(tbl)
            continue
        if m.group(7) is not None:
            for li in re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(7) or '', re.I):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f'• {text}', li_st))
            continue
        if m.group(10) is not None:
            for i, li in enumerate(re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(10) or '', re.I), 1):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f'{i}. {text}', li_st))
            continue
        if m.group(13) is not None:
            inner = m.group(13) or ''
            img_src = re.search(r'(?:src|href)=["\x27](https://fastly\.jsdelivr[^"\x27>\s]+)["\x27]', inner, re.I)
            if img_src:
                url = img_src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
                continue
            text = _inline(inner, printable=True, bold=True).strip()
            if text and text != ' ':
                try:
                    flowables.append(Paragraph(text, body_st))
                except Exception:
                    flowables.append(Paragraph(safe_xml(re.sub(r'<[^>]+>', '', text)), body_st))
            continue
        if m.group(16) is not None:
            text = _inline(m.group(16) or '', printable=True, bold=True).strip()
            if text:
                flowables.append(Paragraph(f'<b>{safe_xml(text)}</b>', hdr_st))
            continue
    return flowables

# ─── Code panel ──────────────────────────────────────────────────────────────
# 4×4: 8pt font wraps more characters per line, so fewer lines per chunk
_CODE_CHUNK = 2 if GRID_4X4 else 10

def code_panel(code: str) -> list:
    if not code.strip():
        return []
    items = []
    all_lines = code.split('\n')
    for i in range(0, len(all_lines), _CODE_CHUNK):
        xml_lines = [indent_xml(ln) for ln in all_lines[i:i+_CODE_CHUNK]]
        cell      = Paragraph('<br/>'.join(xml_lines), S['code'])
        tbl   = Table([[cell]], colWidths=[USE_W])
        tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), white),
            ('TOPPADDING',    (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
            ('BOX',           (0,0), (-1,-1), 1.0, BLACK),
        ]))
        items.append(tbl)
    return items

def cat_bar(text: str, bg=None) -> Table:
    bar_bg = bg if bg else white
    tbl = Table([[Paragraph(
        f'<b>{safe_xml(text)}</b>',
        ParagraphStyle('cb', fontName='LG-Bold', fontSize=5.5, textColor=BLACK),
    )]], colWidths=[USE_W])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), bar_bg),
        ('TOPPADDING',    (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
        ('RIGHTPADDING',  (0,0), (-1,-1), 5),
        ('LINEBELOW',     (0,0), (-1,-1), 1.2, BLACK),
    ]))
    return tbl

def site_label_p(label: str) -> Paragraph:
    return Paragraph(
        f'<b>● {label}</b>',
        ParagraphStyle(f'sl_{label}', fontName='LG-Bold', fontSize=5.5,
                       textColor=BLACK, leading=7, spaceBefore=3))

# ─── Page state ───────────────────────────────────────────────────────────────
_PAGE_STATE: dict = {'round': ''}

class SetRound(Flowable):
    def __init__(self, label: str):
        super().__init__()
        self.label  = label
        self.width  = 0
        self.height = 0

    def draw(self):
        _PAGE_STATE['round'] = self.label
        c = self.canv
        c.saveState()
        c.setFont('LG-Bold', 5)
        c.setFillColor(BLACK)
        c.drawString(MG, MG - 3, self.label)
        c.restoreState()

class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1
        canvas.saveState()
        canvas.setFont('LG-Bold', 5)
        canvas.setFillColor(BLACK)
        canvas.drawRightString(MP_W - MG, MG - 3, f'p.{self.n}')
        if _PAGE_STATE['round']:
            canvas.drawString(MG, MG - 3, _PAGE_STATE['round'])
        canvas.restoreState()

# ─── Question block ───────────────────────────────────────────────────────────
def build_question_block(q: dict, sites_cache: dict, doocs_cache: dict,
                          pattern_name: str, pattern_obj: dict) -> list:
    items = []
    slug     = q.get('slug', '')
    qid      = q['id']
    diff_key = q.get('difficulty', 'easy').lower()
    bg, fg   = DIFF_COLORS_PILL.get(q.get('difficulty', 'Easy'), (GRAY_100, BLACK))

    items.append(cat_bar(pattern_name))
    items.append(Spacer(1, 2))

    pill = Table([[Paragraph(
        f'<font color="{fg.hexval()}"><b>{q.get("difficulty","?")[:3].upper()}</b></font>',
        ParagraphStyle('pill', fontName='LG-Bold', fontSize=5, textColor=fg),
    )]], colWidths=[0.34 * inch])
    pill.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), bg),
        ('ALIGN',         (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING',    (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING',   (0,0), (-1,-1), 2),
        ('RIGHTPADDING',  (0,0), (-1,-1), 2),
    ]))
    title_tbl = Table([[
        Paragraph(f'<b>#{qid} {safe_xml(q["title"])}</b>', S['title']),
        pill,
    ]], colWidths=[USE_W - 0.38 * inch, 0.38 * inch])
    title_tbl.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING',   (0,0), (-1,-1), 0),
        ('RIGHTPADDING',  (0,0), (-1,-1), 0),
    ]))
    items.append(title_tbl)
    items.append(Spacer(1, 2))
    items.append(hr(GRAY_300, 0.3))

    links = (
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">LeetDoocs</a>  ·  '
        f'<a href="https://www.simplyleet.com/{slug}" color="#000000">SimplyLeet</a>  ·  '
        f'<a href="https://walkccc.me/LeetCode/problems/{qid}/" color="#000000">WalkCC</a>  ·  '
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>'
    )
    items.append(Paragraph(links, ParagraphStyle(
        'lnk', fontName='LG-Bold', fontSize=5.5, textColor=BLACK, leading=8, spaceAfter=2)))

    tags = q.get('tags', [])
    if tags:
        items.append(Paragraph(
            '  ·  '.join(safe_xml(t) for t in tags[:10]),
            ParagraphStyle('tg', fontName='LG-Bold', fontSize=5.5,
                           textColor=BLACK, leading=7, spaceAfter=2)))

    source = q.get('source', [])
    if source:
        items.append(Paragraph(
            f"Lists: {'  |  '.join(safe_xml(s) for s in source)}",
            ParagraphStyle('src', fontName='LG-Bold', fontSize=5.5,
                           textColor=BLACK, leading=7, spaceAfter=2)))

    expl = q.get('explanation', '').strip()
    if expl:
        items.append(Paragraph(f'<b>⏱ {safe_xml(expl[:200])}</b>', S['body_sm']))

    desc_html = doocs_cache.get(str(qid), {}).get('desc_html')
    if desc_html:
        items.append(Spacer(1, 2))
        items.append(Paragraph('<b>Problem</b>', S['head2']))
        items += desc_to_mini_flowables(desc_html)
        items.append(Spacer(1, 2))

    is_js_pattern = (pattern_name == 'JavaScript')

    if not is_js_pattern:
        bf = gen_brute_force_python(q, pattern_name)
        if bf and bf.strip():
            items.append(Paragraph(
                '<b>◼ Brute Force (Python)</b>',
                ParagraphStyle('bfl', fontName='LG-Bold', fontSize=6,
                               textColor=BLACK, spaceAfter=1)))
            items += code_panel(bf)

    entry = sites_cache.get(slug, {})
    doocs_blocks = doocs_cache.get(str(qid), {}).get('blocks', [])
    merged = dict(entry)
    merged['doocs'] = [{'code': b['code'], 'lang': b.get('lang','')} for b in doocs_blocks]

    if is_js_pattern:
        js_langs = ('javascript', 'js', 'typescript', 'ts')
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            js_blocks = [b for b in blocks if b.get('lang','').lower() in js_langs]
            if not js_blocks:
                continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Community Solutions (JavaScript / TypeScript)</b>',
                    ParagraphStyle('cs_hdr', fontName='LG-Bold', fontSize=6.5,
                                   textColor=BLACK, spaceAfter=2)))
                has_any = True
            items.append(site_label_p(site_label_str))
            seen = set()
            for b in js_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                items += code_panel(b['code'])
        if not has_any:
            items.append(Spacer(1, 3))
            items.append(Paragraph(
                'No JavaScript / TypeScript community solution in cache.',
                ParagraphStyle('njs', fontName='LG-Bold', fontSize=6,
                               textColor=BLACK, leading=8)))
    else:
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            py_blocks = [b for b in blocks if b.get('lang','').lower() in ('python','python3','py')]
            if not py_blocks: continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Community Solutions (Python)</b>',
                    ParagraphStyle('cs_hdr', fontName='LG-Bold', fontSize=6.5,
                                   textColor=BLACK, spaceAfter=2)))
                has_any = True
            items.append(site_label_p(site_label_str))
            seen = set()
            for b in py_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                items += code_panel(b['code'])

        if not has_any:
            fallback = (q.get('python_solution') or '').strip()
            if fallback:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Solution (Python)</b>',
                    ParagraphStyle('cs_hdr', fontName='LG-Bold', fontSize=6.5,
                                   textColor=BLACK, spaceAfter=2)))
                items += code_panel(fallback)

    items.append(PageBreak())
    return items

# ─── Chapter Quick-Review summary ────────────────────────────────────────────
def build_round_summary(round_num: int, priority: str, difficulty: str,
                         pattern_groups: list) -> list:
    """
    Quick-review mini-pages at end of each round chapter.
    Shows key insights · complexity · solution for every question.
    """
    all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
    if not all_qs:
        return []

    pri_c = PRIORITY_COLORS[priority]
    items = [PageBreak()]

    # Chapter summary banner
    diff_dot_ch = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
    banner_text = f'Round {round_num}  ·  {priority} Priority  ·  {diff_dot_ch} {difficulty}  —  Quick Review'
    items.append(cat_bar(f'>> {banner_text}', bg=pri_c['pill_bg']))
    items.append(Spacer(1, 2))
    items.append(Paragraph(
        f'<b>{len(all_qs)} question{"s" if len(all_qs) != 1 else ""}  ·  key insights · complexity · solution</b>',
        ParagraphStyle('qr_sub', fontName='LG-Bold', fontSize=6,
                       textColor=BLACK, leading=8, spaceAfter=3)))
    items.append(hr(GRAY_300, 0.3))

    label_st = ParagraphStyle('qrl', fontName='LG-Bold', fontSize=6,
                               textColor=BLACK, leading=8, spaceBefore=4, spaceAfter=1)
    body_st  = ParagraphStyle('qrb', fontName='LG-Bold', fontSize=5.8,
                               textColor=BLACK, leading=8, leftIndent=6, spaceAfter=1)
    diff_colors = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}

    for pat, q in all_qs:
        slug = q.get('slug', '')
        diff = q.get('difficulty', '')
        dc   = diff_colors.get(diff, '#6B7280')
        info = _QR_DATA.get(slug, {})

        items.append(Paragraph(
            f'<b>#{q["id"]}  {safe_xml(q["title"])}</b>  '
            f'<font color="{dc}">[{diff}]</font>  '
            f'<font color="#6B7280">· {safe_xml(pat["name"])}</font>',
            ParagraphStyle('qrt', fontName='LG-Bold', fontSize=6.5,
                           textColor=BLACK, leading=9, spaceBefore=6, spaceAfter=1)))

        if info:
            ki = info.get('key_insights', '')
            if ki:
                items.append(Paragraph('<b>Key Insights</b>', label_st))
                for line in ki.split('\n'):
                    line = line.strip().lstrip('-• ').strip()
                    if line:
                        items.append(Paragraph(f'• {safe_xml(line)}', body_st))

            cx = info.get('complexity', '')
            if cx:
                items.append(Paragraph('<b>Space &amp; Time</b>', label_st))
                for line in cx.split('\n'):
                    line = line.strip()
                    if line:
                        items.append(Paragraph(safe_xml(line), body_st))

            sol = info.get('solution', '')
            if sol:
                items.append(Paragraph('<b>Solution</b>', label_st))
                for para in sol.split('\n\n'):
                    para = re.sub(r'\s*\n\s*', ' ', para).strip()
                    if para:
                        items.append(Paragraph(safe_xml(para), body_st))
        else:
            items.append(Paragraph(
                'No quick-review data available.',
                ParagraphStyle('nqr', fontName='LG-Bold', fontSize=5.8,
                               textColor=BLACK, leading=8)))

        items.append(HRFlowable(width='100%', thickness=0.3, color=GRAY_300, spaceAfter=2))

    items.append(Spacer(1, 6))
    return items

# ─── Inner PDF builder ────────────────────────────────────────────────────────
def build_inner_pdf(rounds: list, sites: dict, doocs: dict):
    counter = PageCounter()
    total_qs = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)

    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph('LeetMastery', ParagraphStyle(
        'brand', fontName='LG-Bold', fontSize=8, textColor=BLACK, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph('Study-Order Edition', S['cover_title']))
    story.append(Paragraph('Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  36-up Portrait  ·  6×6', ParagraphStyle(
        'sub2', fontName='LG-Bold', fontSize=8, textColor=BLACK, alignment=TA_CENTER, leading=11)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        f'{total_qs} questions  ·  9 rounds  ·  bold black  ·  36-up portrait (6×6)',
        ParagraphStyle('ci', fontName='LG-Bold', fontSize=6, textColor=BLACK, alignment=TA_CENTER)))
    story.append(Paragraph(
        'High Easy → High Med → High Hard → Mid Easy → Mid Med → Mid Hard → Low Easy → Low Med → Low Hard',
        ParagraphStyle('ci2', fontName='LG-Bold', fontSize=5.5, textColor=BLACK, alignment=TA_CENTER, leading=8)))
    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph('Contents', ParagraphStyle(
        'toch', fontName='LG-Bold', fontSize=9, textColor=BLACK, spaceAfter=4)))
    story.append(hr())

    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue
        diff_dot_toc = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}.get(difficulty, '')
        pri_c = PRIORITY_COLORS[priority]
        row = Table([[
            Paragraph(
                f'<b>Round {round_num}  {priority} · {diff_dot_toc} {difficulty}</b>'
                f'  ({len(all_qs_in_round)})',
                ParagraphStyle('toch2', fontName='LG-Bold', fontSize=7,
                               textColor=BLACK, leading=9)),
        ]], colWidths=[USE_W])
        row.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
            ('TOPPADDING',    (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
        ]))
        story.append(row)
        for pat, q in all_qs_in_round:
            story.append(Paragraph(
                f'   #{q["id"]} {safe_xml(q["title"])}',
                ParagraphStyle('tqe', fontName='LG', fontSize=5.5, textColor=BLACK, leading=7.5)))
    story.append(PageBreak())

    # ── Rounds / Chapters ─────────────────────────────────────────────────────
    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue

        pri_c = PRIORITY_COLORS[priority]
        diff_dot = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
        round_label = f'Round {round_num}  ·  {priority} · {difficulty}'

        story.append(SetRound(round_label))

        # Chapter splash page
        story.append(Spacer(1, USE_H * 0.12))
        banner = Table([[Paragraph(
            f'<b>Round {round_num}</b>',
            ParagraphStyle('rnum', fontName='LG-Bold', fontSize=13, textColor=BLACK, alignment=TA_CENTER),
        )]], colWidths=[USE_W])
        banner.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
            ('TOPPADDING',    (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('BOX',           (0,0), (-1,-1), 1.0, pri_c['bar']),
        ]))
        story.append(banner)
        story.append(Spacer(1, 5))

        story.append(Paragraph(
            f'<b>{priority} Priority  ·  {diff_dot} {difficulty}</b>',
            ParagraphStyle('rlab', fontName='LG-Bold', fontSize=10,
                           textColor=BLACK, alignment=TA_CENTER, leading=13)))
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            f'{len(all_qs_in_round)} question{"s" if len(all_qs_in_round) != 1 else ""}  ·  '
            f'{len(pattern_groups)} pattern{"s" if len(pattern_groups) != 1 else ""}',
            ParagraphStyle('rct', fontName='LG-Bold', fontSize=7,
                           textColor=BLACK, alignment=TA_CENTER)))
        story.append(Spacer(1, 4))

        # Mini question list on splash page
        story.append(hr(GRAY_300, 0.4))
        for pat, qs in pattern_groups:
            q_ids = '  '.join(f'#{q["id"]}' for q in qs)
            story.append(Paragraph(
                f'<b>{safe_xml(pat["name"])}</b>  {safe_xml(q_ids)}',
                ParagraphStyle('splash_pat', fontName='LG-Bold', fontSize=5.5,
                               textColor=BLACK, leading=7.5, spaceBefore=2)))
        story.append(PageBreak())

        # Questions: grouped by pattern within the round
        for pat, qs in pattern_groups:
            # Pattern sub-header mini-page
            story.append(Spacer(1, USE_H * 0.15))
            pat_banner = Table([[Paragraph(
                f'<b>{safe_xml(pat["name"])}</b>',
                ParagraphStyle('pbnr', fontName='LG-Bold', fontSize=10,
                               textColor=BLACK, alignment=TA_CENTER),
            )]], colWidths=[USE_W])
            pat_banner.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,-1), GRAY_100),
                ('TOPPADDING',    (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('BOX',           (0,0), (-1,-1), 0.5, GRAY_300),
            ]))
            story.append(pat_banner)
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                f'Round {round_num}  ·  {priority} · {difficulty}  ·  {len(qs)} question{"s" if len(qs) != 1 else ""}',
                ParagraphStyle('psub', fontName='LG-Bold', fontSize=6,
                               textColor=BLACK, alignment=TA_CENTER)))
            story.append(PageBreak())

            for q in qs:
                story += build_question_block(q, sites, doocs, pat['name'], pat)

        # End-of-chapter Quick Review summary
        story += build_round_summary(round_num, priority, difficulty, pattern_groups)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f'Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}')
    return counter.n

# ─── 36-up portrait imposer (6×6 grid, matching the original 92-page format) ──
def impose_36up_portrait(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 612.0, 792.0
    COLS, ROWS = 6, 6          # 36 mini-pages per sheet (matches original layout)
    PER_SHEET  = COLS * ROWS   # 36
    CW = L_W / COLS            # 102 pts
    RH = L_H / ROWS            # 132 pts
    GAP = 1.5                  # tighter gap at this scale

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.4)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.2, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 100, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  36-up Portrait  ·  6×6',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'36-up portrait: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')

# ─── 36-up landscape imposer (6×6 grid on 792×612 landscape letter) ──────────
def impose_36up_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0   # landscape letter (width > height)
    COLS, ROWS = 6, 6
    PER_SHEET  = COLS * ROWS    # 36
    CW = L_W / COLS             # 132 pts
    RH = L_H / ROWS             # 102 pts
    GAP = 1.5

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.4)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.2, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 120, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  36-up Landscape  ·  6×6',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'36-up landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 2×2 landscape imposer (4 per sheet on 792×612) ──────────────────────────
def impose_2x2_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0
    COLS, ROWS = 2, 2
    PER_SHEET  = COLS * ROWS    # 4
    CW = L_W / COLS             # 396 pts
    RH = L_H / ROWS             # 306 pts
    GAP = 3.0

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        shape = sheet.new_shape()
        for cx in [CW]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.6)
        shape.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 100, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  2×2 Landscape',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'2×2 landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 4×4 landscape imposer (16 per sheet on 792×612) ─────────────────────────
def impose_4x4_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0   # landscape letter
    COLS, ROWS = 4, 4
    PER_SHEET  = COLS * ROWS    # 16
    CW = L_W / COLS             # 198 pts
    RH = L_H / ROWS             # 153 pts
    GAP = 2.0

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.5)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.3, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 110, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  4×4 Landscape',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'4×4 landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Loading data…')
    questions = json.loads(QUESTIONS.read_text())
    sites     = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs     = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    print(f'  {len(questions)} questions · sites: {len(sites)} · doocs: {len(doocs)}')

    print('Building study-order rounds…')
    rounds = build_rounds(questions)
    for round_num, priority, difficulty, pattern_groups in rounds:
        total = sum(len(qs) for _, qs in pattern_groups)
        pats  = ', '.join(p['name'] for p, _ in pattern_groups)
        print(f'  Round {round_num}  {priority:4s} {difficulty:7s}  {total:3d} q  [{pats}]')

    print('\nBuilding inner mini-page PDF…')
    n_pages = build_inner_pdf(rounds, sites, doocs)

    if GRID_2X2:
        print('Imposing 2×2 landscape (4-up)…')
        impose_2x2_landscape(INNER_PDF, OUTPUT_PDF)
    elif GRID_4X4:
        print('Imposing 4×4 landscape (16-up)…')
        impose_4x4_landscape(INNER_PDF, OUTPUT_PDF)
    elif LANDSCAPE:
        print('Imposing 36-up landscape (6×6)…')
        impose_36up_landscape(INNER_PDF, OUTPUT_PDF)
    else:
        print('Imposing 36-up portrait (6×6)…')
        impose_36up_portrait(INNER_PDF, OUTPUT_PDF)

    INNER_PDF.unlink(missing_ok=True)
    kb = OUTPUT_PDF.stat().st_size // 1024
    print(f'\nDone → {OUTPUT_PDF}  ({kb:,} KB)')
    print(f'Inner pages: {n_pages}  →  36-up sheets: {(n_pages + 35) // 36}')

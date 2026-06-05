"""
LeetMastery — Print Splits Generator
======================================
Builds 9 print-friendly PDFs (one per priority+difficulty round) and saves
them to ~/Desktop/splits/36up_prints/.

Print style: black text on white background, no dark code panels.
Format: 6×6 landscape (36 mini-pages per sheet) — print edition.

Usage:
  /usr/bin/python3 generate_print_splits.py
"""

import json, re, sys
from pathlib import Path

# No grid flag → default portrait inner pages (204×264) which the 6×4 imposer
# expects. GRID_2X1 / GRID_4X4 etc. must all be False so MP_W=204, MP_H=264.
sys.argv = [sys.argv[0]]

# ── Override dark code style BEFORE importing the main generator ──────────────
# We monkey-patch after import so we can change _BG_CODE and token colours.

import generate_study_order_pdf as G

# Swap code panel to B&W print style
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle

_BW_CODE_STYLE = ParagraphStyle(
    'bw_code',
    # Bold, high-contrast for printing.
    fontName='Menlo-Bold',
    fontSize=7.0,     # updated below after _PRINT_SIZES is applied
    leading=9.0,
    textColor=black,
)

def code_panel_print(code: str, lang: str = 'python'):
    """Plain black-on-white code block — no monokai, safe for printing."""
    if not code.strip():
        return []
    from reportlab.platypus import Table, TableStyle, Paragraph
    all_lines = code.split('\n')
    rows = []
    for i in range(0, len(all_lines), G._CODE_CHUNK):
        xml_lines = [G.indent_xml(ln) for ln in all_lines[i:i + G._CODE_CHUNK]]
        rows.append([Paragraph('<br/>'.join(xml_lines), _BW_CODE_STYLE)])

    # One outer box per solution source so different sites feel separated.
    tbl = Table(rows, colWidths=[G.USE_W])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), white),
        ('TOPPADDING',    (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING',   (0, 0), (-1, -1), 1),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 1),
        ('BOX',           (0, 0), (-1, -1), 0.8, black),
    ]))
    return [tbl]

# Bigger font means more wrapping — reduce chunk size
G._CODE_CHUNK = 2

# Override desc_to_mini_flowables to prevent pre-block overflow in print mode.
# Description text is kept; long code/test-case lines are clipped.
_orig_desc = G.desc_to_mini_flowables
def _desc_print(desc_html: str) -> list:
    import re as _re
    from reportlab.platypus import Table, TableStyle, Paragraph
    # Call original but catch LayoutErrors by pre-processing the html
    # to truncate extremely long pre blocks before passing to the original
    def _clip_pre(m):
        inner = m.group(1)
        lines = inner.split('\n')
        clipped = [l[:70] for l in lines[:5]]   # max 5 lines × 70 chars
        return f'<pre>{"".join(clipped)}</pre>'
    clipped_html = _re.sub(r'<pre[^>]*>([\s\S]*?)</pre>', _clip_pre, desc_html, flags=_re.I)
    return _orig_desc(clipped_html)
G.desc_to_mini_flowables = _desc_print

# Replace the colour code panel with the B&W one
G.code_panel = code_panel_print

# ── Force EVERYTHING to bold for print clarity ────────────────────────────────

# 1. Fix already-created S dict styles (created at module import time)
#    Also bump sizes so printed output is +1pt larger on paper (scale ≈0.57×)
_PRINT_SIZES = {
    # Slightly larger than before for readability in 6×6.
    'title':       (10.5, 13.0),
    'body':        (9.0,  11.0),
    'body_sm':     (8.5,  10.5),
    # Code: bigger + bold for print readability.
    'code':        (7.75,  9.4),
    'head2':       (9.5,  12.0),
    'toc':         (9.5,  12.0),
    'cover_title': (16.0, 19.0),
    'cover_sub':   (9.5,  12.0),
}
for _k, _st in G.S.items():
    if getattr(_st, 'fontName', '') == 'LG':
        _st.fontName = 'LG-Bold'
    if _k in _PRINT_SIZES:
        _st.fontSize, _st.leading = _PRINT_SIZES[_k]

# Make ALL code blocks use the Quick Review font size/leading.
_BW_CODE_STYLE.fontSize = _PRINT_SIZES['code'][0]
_BW_CODE_STYLE.leading  = _PRINT_SIZES['code'][1]

# 2. Patch ParagraphStyle.__init__ so inline styles created inside functions
#    (e.g. TOC entries, desc flowables, site labels) also use LG-Bold
from reportlab.lib.styles import ParagraphStyle as _RL_PS
_orig_ps_init = _RL_PS.__init__
def _bold_ps_init(self, name, parent=None, **kw):
    # Force "super bold" everywhere for print clarity.
    if kw.get('fontName') in ('LG', 'LG-Bold'):
        kw['fontName'] = 'LG-Bold'
    _orig_ps_init(self, name, parent=parent, **kw)
_RL_PS.__init__ = _bold_ps_init

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
QUESTIONS    = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE  = SCRIPT_DIR / ".full_langs_cache.json"
DOOCS_CACHE  = SCRIPT_DIR / ".doocs_cache.json"
# Output directory for the portrait 36-up print splits.
SPLITS_DIR   = Path.home() / "Desktop" / "splits" / "36up_prints_Portraits"
INNER_TMP    = SCRIPT_DIR / "_print_split_inner.pdf"

ROUND_NAMES = {
    (1, 'High', 'Easy'):   '01_High_Easy',
    (2, 'High', 'Medium'): '02_High_Medium',
    (3, 'High', 'Hard'):   '03_High_Hard',
    (4, 'Mid',  'Easy'):   '04_Mid_Easy',
    (5, 'Mid',  'Medium'): '05_Mid_Medium',
    (6, 'Mid',  'Hard'):   '06_Mid_Hard',
    (7, 'Low',  'Easy'):   '07_Low_Easy',
    (8, 'Low',  'Medium'): '08_Low_Medium',
    (9, 'Low',  'Hard'):   '09_Low_Hard',
}

import fitz

def impose_6x6_portrait(src_path: Path, dst_path: Path):
    """6 cols × 6 rows = 36 mini-pages per portrait sheet — print edition."""
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)
    L_W, L_H   = 612.0, 792.0
    COLS, ROWS = 6, 6
    PER        = COLS * ROWS   # 36
    CW = L_W / COLS            # 102 pts
    RH = L_H / ROWS            # 132 pts
    GAP = 1.5
    for i in range(0, n, PER):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(col*CW+GAP, row*RH+GAP, (col+1)*CW-GAP, (row+1)*RH-GAP)
            sheet.show_pdf_page(rect, src, i + j)
        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.75, 0.75, 0.75), width=0.4)
        shape.commit()
    num = len(dst)
    for pg in range(num):
        dst[pg].insert_text(
            fitz.Point(L_W / 2 - 95, L_H - 3),
            f'Sheet {pg+1}/{num}  ·  LeetMastery  ·  Print Edition  ·  6×6 Portrait',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()


def _add_checkboxes_print(output_path: Path, page_types: dict,
                          toc_link_rects: dict, qid_first_page: dict,
                          cols: int, rows: int,
                          src_w: float, src_h: float,
                          L_W: float, L_H: float, GAP: float = 1.5):
    """
    Post-process a print split PDF:
    • Draw a visible □ checkbox to the left of each TOC question entry
    • Add AcroForm widget so the state can be checked/saved in Acrobat
    • Add a clickable link from each TOC entry to the corresponding question sheet
    """
    per_sheet = cols * rows
    CW = L_W / cols
    RH = L_H / rows

    def cell_tx(slot):
        col = slot % cols
        row = slot // cols
        cx0, cy0 = col * CW + GAP, row * RH + GAP
        cw, ch   = CW - 2*GAP, RH - 2*GAP
        sc = min(cw / src_w, ch / src_h)
        ox = (cw - src_w * sc) / 2
        oy = (ch - src_h * sc) / 2
        return cx0, cy0, ox, oy, sc

    def tx(r, cx0, cy0, ox, oy, sc):
        return fitz.Rect(cx0+ox+r.x0*sc, cy0+oy+r.y0*sc,
                         cx0+ox+r.x1*sc, cy0+oy+r.y1*sc)

    doc = fitz.open(str(output_path))
    toc_sheets = {pg // per_sheet for pg, t in page_types.items() if t == 'toc'}
    toc_sheet0 = min(toc_sheets) if toc_sheets else 1
    qid_sheet  = {qid: pg // per_sheet for qid, pg in qid_first_page.items()}

    n_boxes = n_links = 0
    for inner_pg, rects in toc_link_rects.items():
        slot     = inner_pg % per_sheet
        out_sh   = inner_pg // per_sheet
        out_pg   = doc[out_sh]
        transform = cell_tx(slot)

        for qid, rect_info in rects.items():
            line_src = rect_info.get('row') or rect_info.get('line')
            if line_src is None:
                continue

            line_dest = tx(line_src, *transform)

            # TOC → question navigation link
            dest = qid_sheet.get(qid)
            if dest is not None:
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO,
                    'from': line_dest,
                    'page': dest,
                    'to':   fitz.Point(0, 0),
                    'zoom': 0,
                })
                n_links += 1

            # Checkbox — draw visible □ and add AcroForm widget
            cb_h   = min(line_dest.height * 0.85, 9.0)
            cb_y0  = line_dest.y0 + (line_dest.height - cb_h) / 2
            cb_x1  = line_dest.x0 - 2
            cb_x0  = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)

            out_pg.draw_rect(cb_rect, color=(0.15, 0.15, 0.15),
                             fill=(1.0, 1.0, 1.0), width=0.7)
            widget = fitz.Widget()
            widget.rect        = cb_rect
            widget.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            widget.field_name  = f'print_done_{qid}'
            widget.field_value = 'Off'
            widget.on_state    = 'Yes'
            out_pg.add_widget(widget)
            n_boxes += 1

    tmp = output_path.with_suffix('.tmp.pdf')
    doc.save(str(tmp), garbage=4, deflate=True, incremental=False)
    doc.close()
    tmp.replace(output_path)
    print(f'  Checkboxes: {n_boxes}  |  TOC links: {n_links}')


if __name__ == '__main__':
    SPLITS_DIR.mkdir(parents=True, exist_ok=True)

    print('Loading data…')
    questions = json.loads(QUESTIONS.read_text())
    sites     = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs     = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    print(f'  {len(questions)} questions')

    print('Building study-order rounds…')
    rounds = G.build_rounds(questions)

    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs:
            continue

        name = ROUND_NAMES.get((round_num, priority, difficulty),
                               f'{round_num:02d}_{priority}_{difficulty}')
        out_path = SPLITS_DIR / f'{name}.pdf'

        print(f'\n[{name}]  {len(all_qs)} questions…')

        # Build inner PDF for this round only
        G.INNER_PDF = INNER_TMP
        n_pages, _, _ = G.build_inner_pdf(
            [(round_num, priority, difficulty, pattern_groups)],
            sites, doocs
        )
        print(f'  Inner pages: {n_pages}')

        # Analyse TOC entries before deleting inner PDF
        page_types, qid_first_page, toc_link_rects, _ = \
            G._analyze_inner_for_links(INNER_TMP, [(round_num, priority, difficulty, pattern_groups)])

        # Impose as 6×6 portrait (36 per sheet — print edition)
        impose_6x6_portrait(INNER_TMP, out_path)
        INNER_TMP.unlink(missing_ok=True)

        # Add checkboxes + TOC links to the imposed PDF
        _add_checkboxes_print(
            out_path, page_types, toc_link_rects, qid_first_page,
            cols=6, rows=6, src_w=204.0, src_h=264.0,
            L_W=612.0, L_H=792.0, GAP=1.5,
        )
        kb = out_path.stat().st_size // 1024
        sheets = (n_pages + 35) // 36
        print(f'  → {out_path.name}  ({kb:,} KB,  {sheets} sheets)')

    print(f'\nAll splits saved to {SPLITS_DIR}')
    print('\nFiles:')
    for f in sorted(SPLITS_DIR.glob('*.pdf')):
        print(f'  {f.name}  ({f.stat().st_size//1024:,} KB)')

#!/usr/bin/env python3
"""
generate_question_list_pdf.py
Compact question-list PDF — same Priority / Difficulty / Pattern grouping
as the simplified PDF.  Each question has:
  □  interactive checkbox to tick when solved
  →  arrow linking directly to leetcode.com (browser)
  ★  marks Premium questions
Output: Desktop/leet_question_list.pdf
"""

import json, sys, os, re
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
import fitz

SCRIPT_DIR = Path(__file__).parent
DESKTOP    = Path.home() / 'Desktop'
OUT_PDF    = DESKTOP / 'leet_question_list.pdf'

# ── Exact constants from generate_simplified_pdf.py ──────────────────────────
PATTERN_PRIORITY = {
    'Arrays & Hashing':'High','String':'High','Two Pointers':'High',
    'Sliding Window':'High','Sorting':'High','Binary Search':'High',
    'Matrix':'High','Trees & BST':'High','DFS':'High',
    'Graphs':'High','BFS':'High',
    'Linked List':'Mid','Stack':'Mid','Heap':'Mid','Trie':'Mid',
    'Backtracking':'Mid','Greedy':'Mid',
    'Dynamic Programming':'Low','Bit Manipulation':'Low',
    'Math':'Low','JavaScript':'Low',
}
DISPLAY_PATTERN_ORDER = [
    'Arrays & Hashing','String','Two Pointers','Sliding Window','Sorting',
    'Binary Search','Matrix','Trees & BST','DFS','Graphs','BFS',
    'Linked List','Stack','Heap','Trie','Backtracking','Greedy',
    'Dynamic Programming','Bit Manipulation','Math','JavaScript',
]
ROUNDS = [
    (1,'High','Easy'),(2,'High','Medium'),(3,'High','Hard'),
    (4,'Mid','Easy'),(5,'Mid','Medium'),(6,'Mid','Hard'),
    (7,'Low','Easy'),(8,'Low','Medium'),(9,'Low','Hard'),
]
PRIORITY_LABEL = {'High':'High Priority','Mid':'Mid Priority','Low':'Low Priority'}
PRIORITY_BAR   = {'High':'#DC2626','Mid':'#D97706','Low':'#6B7280'}
DIFF_CLR       = {'Easy':'#16a34a','Medium':'#ea580c','Hard':'#dc2626'}
DIFF_SHORT     = {'Easy':'EAS','Medium':'MED','Hard':'HAR'}

sys.path.insert(0, str(SCRIPT_DIR))
from generate_patterns_pdf import QUICK_PATTERNS  # type: ignore

questions = json.loads((SCRIPT_DIR/'public/questions_full.json').read_text())
Q_BY_ID   = {q['id']: q for q in questions}

def is_premium(q):
    src = q.get('source') or []
    return any('Premium' in str(s) or str(s).startswith('★') for s in src)

def build_exclusive_map(qs):
    assigned = {}
    for p in QUICK_PATTERNS:
        ptags = set(p['tags'])
        for q in qs:
            if q['id'] not in assigned and set(q.get('tags',[])) & ptags:
                assigned[q['id']] = p['name']
    return assigned

exclusive = build_exclusive_map(questions)

def build_rounds(qs):
    result = []
    for rn, priority, difficulty in ROUNDS:
        tier = [p for p in DISPLAY_PATTERN_ORDER if PATTERN_PRIORITY.get(p)==priority]
        groups = []
        for pat in tier:
            bucket = sorted(
                [q for q in qs if exclusive.get(q['id'])==pat and q.get('difficulty')==difficulty],
                key=lambda x: x['id'])
            if bucket:
                groups.append((pat, bucket))
        result.append((rn, priority, difficulty, groups))
    return result

rounds = build_rounds(questions)

# ── Styles ────────────────────────────────────────────────────────────────────
SANS = 'Helvetica-Bold'; SANSN = 'Helvetica'

def sty(name, font=SANSN, size=8, color='#111827', lead=11, after=0, before=0, indent=0, bg=None):
    kw = dict(fontName=font, fontSize=size, textColor=HexColor(color),
              leading=lead, spaceAfter=after, spaceBefore=before, leftIndent=indent)
    if bg: kw['backColor'] = HexColor(bg)
    return ParagraphStyle(name, **kw)

S_COVER = sty('cv', SANS, 15, '#1e3a5f', 20, after=3)
S_SUB   = sty('sub', SANSN, 8, '#6b7280', 11, after=5)
S_DIFF  = sty('df', SANS, 9.5, '#374151', 13, after=1, before=3, indent=6)
S_FOOT  = sty('ft', SANSN, 7, '#9ca3af', 9, before=4)
LC      = '#0056b3'

# ── Build PDF story ───────────────────────────────────────────────────────────
total_q = sum(len(g[1]) for _,_,_,gs in rounds for g in gs)
story   = []

story.append(Paragraph('<font face="Helvetica-Bold" size="15">LeetMastery · Question List</font>', S_COVER))
story.append(Paragraph(
    f'<font face="Helvetica" size="8" color="#6b7280">'
    f'{total_q} questions · Priority-grouped · Difficulty-first · LeetCode links</font>', S_SUB))
story.append(HRFlowable(width='100%', thickness=1.2, color=HexColor('#1e3a5f'), spaceAfter=6))

for rn, priority, difficulty, groups in rounds:
    if not groups: continue
    rc = sum(len(g[1]) for g in groups)
    bg = PRIORITY_BAR[priority]
    # Round header bar
    story.append(Paragraph(
        f'<font face="Helvetica-Bold" size="10" color="#ffffff">'
        f'Round {rn}  ·  {PRIORITY_LABEL[priority]}  ·  {difficulty}  ({rc})</font>',
        sty(f'rh{rn}', SANS, 10, '#ffffff', 14, after=1, before=5, indent=4, bg=bg)
    ))

    for pat_name, qs in groups:
        diff_c = DIFF_CLR[difficulty]
        block = [Paragraph(
            f'<font face="Helvetica-Bold" size="8.5" color="{diff_c}">'
            f'{pat_name}  ({len(qs)})</font>',
            sty(f'ph{rn}{pat_name[:6]}', SANS, 8.5, diff_c, 12, after=0, before=1, indent=10)
        )]
        for q in qs:
            slug    = q.get('slug','')
            qid     = q['id']
            title   = q['title']
            prem    = is_premium(q)
            lc_url  = f'https://leetcode.com/problems/{slug}/'
            star    = '<font color="#f59e0b" size="8">&#9733; </font>' if prem else ''
            diff_s  = DIFF_SHORT[difficulty]
            diff_c2 = DIFF_CLR[difficulty]
            # Use → (U+2192) — supported in Helvetica; placeholder __ for checkbox space
            line = (
                f'<font face="Helvetica" size="7" color="#999999">&#9744;  </font>'  # ☐ placeholder
                f'{star}'
                f'<font face="Helvetica" size="7.8" color="#111827">#{qid} {title}</font>'
                f'  <a href="{lc_url}"><font face="Helvetica-Bold" size="9" color="{LC}">'
                f'&#8594;</font></a>'   # → rightwards arrow — in Helvetica
                f'  <font face="Helvetica" size="6.5" color="{diff_c2}">{diff_s}</font>'
            )
            block.append(Paragraph(line, sty(f'qi{qid}', SANSN, 7.8, '#111827', 11,
                                             after=0, before=0, indent=16)))
        story.append(KeepTogether(block))

story.append(Spacer(1, 8))
story.append(HRFlowable(width='100%', thickness=0.5, color=HexColor('#9ca3af')))
story.append(Paragraph(
    '<font face="Helvetica" size="7" color="#9ca3af">'
    'LeetMastery · → opens LeetCode in browser · ★ = Premium</font>', S_FOOT))

tmp_rl = OUT_PDF.with_suffix('.rl.pdf')
doc_rl = SimpleDocTemplate(
    str(tmp_rl), pagesize=letter,
    leftMargin=0.55*inch, rightMargin=0.55*inch,
    topMargin=0.5*inch,   bottomMargin=0.5*inch,
    title='LeetMastery — Question List',
)
doc_rl.build(story)

# ── Post-process with PyMuPDF: replace ☐ placeholder with real checkboxes ────
doc = fitz.open(str(tmp_rl))
CB  = 6.5   # checkbox size pts
n_boxes = 0
all_qids = {str(q['id']) for q in questions}

for pg_idx in range(len(doc)):
    page    = doc[pg_idx]
    pg_xref = page.xref
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            spans = line['spans']
            # Find question ID on this line
            full_text = ''.join(s['text'] for s in spans)
            m = re.search(r'#(\d+)\s', full_text)
            if not m or m.group(1) not in all_qids:
                continue
            qid = m.group(1)
            field_name = f'solved_{qid}'

            # Find the ☐ placeholder glyph span (U+2610) to get its position
            cb_span = None
            for sp in spans:
                if '☐' in sp['text'] or '&#9744;' in sp['text']:
                    cb_span = sp; break

            bbox = line['bbox']
            line_h = bbox[3] - bbox[1]
            cb_h   = min(CB, line_h * 0.88)
            cb_y0  = bbox[1] + (line_h - cb_h) / 2
            cb_y1  = cb_y0 + cb_h

            if cb_span:
                cb_x0 = cb_span['bbox'][0]
                cb_x1 = cb_x0 + cb_h
            else:
                cb_x0 = bbox[0] - cb_h - 2
                cb_x1 = cb_x0 + cb_h

            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y1)

            # Draw crisp white square border
            page.draw_rect(cb_rect, color=(0.15,0.15,0.15), fill=(1,1,1), width=0.75)

            w = fitz.Widget()
            w.rect        = cb_rect
            w.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            w.field_name  = field_name
            w.field_value = 'Off'
            w.on_state    = 'Yes'
            page.add_widget(w)

            fresh = [fw for fw in page.widgets() if fw.field_name == field_name]
            if fresh:
                fw = fresh[-1]
                fw_str = doc.xref_object(fw.xref)
                if '/P ' not in fw_str:
                    doc.update_object(fw.xref,
                        fw_str.replace('/Type /Annot',
                                       f'/Type /Annot\n  /P {pg_xref} 0 R'))
                fw.update()
            n_boxes += 1

# NeedAppearances
cat_xref = doc.pdf_catalog()
cat_str  = doc.xref_object(cat_xref)
if '/AcroForm' in cat_str and '/NeedAppearances' not in cat_str:
    doc.update_object(cat_xref,
        cat_str.replace('/AcroForm <<', '/AcroForm <<\n  /NeedAppearances true'))

tmp2 = str(OUT_PDF) + '.tmp'
doc.save(tmp2, garbage=4, deflate=True)
doc.close()
tmp_rl.unlink(missing_ok=True)
os.replace(tmp2, str(OUT_PDF))

print(f'✓  {OUT_PDF}')
print(f'   {doc_rl.page} pages  |  {n_boxes} checkboxes  |  {os.path.getsize(OUT_PDF)//1024} KB')

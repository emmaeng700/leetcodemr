#!/usr/bin/env python3
import json, sys, os, re
from pathlib import Path

SCRIPT_DIR = Path('/Users/oppongemmanuel/code/leetcodemr')
DESKTOP    = Path.home() / 'Desktop'
OUT_PDF    = DESKTOP / 'leet_am600_question_list.pdf'

sys.path.insert(0, str(SCRIPT_DIR))

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
import fitz

# ── Copy exact constants from generate_simplified_pdf.py ─────────────────────
ROUNDS = [(1,'High','Easy'),(2,'High','Medium'),(3,'High','Hard'),
          (4,'Mid','Easy'),(5,'Mid','Medium'),(6,'Mid','Hard'),
          (7,'Low','Easy'),(8,'Low','Medium'),(9,'Low','Hard')]

_AM600_PRIORITY = {
    'Arrays':'High','Strings':'High','Hash Tables':'High','Two Pointers':'High',
    'Sliding Window - Fixed Size':'High','Sliding Window - Dynamic Size':'High',
    'Binary Search':'High','Stacks':'High',
    'Tree Traversal - Level Order':'High','Tree Traversal - Pre Order':'High',
    'Tree Traversal - In Order':'High','Tree Traversal - Post-Order':'High',
    'Depth First Search (DFS)':'High','Breadth First Search (BFS)':'High','Linked List':'High',
    'Bit Manipulation':'Mid','Prefix Sum':'Mid',"Kadane's Algorithm":'Mid',
    'Matrix (2D Array)':'Mid','LinkedList In-place Reversal':'Mid',
    'Fast and Slow Pointers':'Mid','Monotonic Stack':'Mid','Queues':'Mid',
    'Monotonic Queue':'Mid','Recursion':'Mid','Divide and Conquer':'Mid',
    'Merge Sort':'Mid','QuickSort / QuickSelect':'Mid','Backtracking':'Mid',
    'BST / Ordered Set':'Mid','Tries':'Mid','Heaps':'Mid','Two Heaps':'Mid',
    'Top K Elements':'Mid','Intervals':'Mid','K-Way Merge':'Mid',
    'Data Structure Design':'Mid','Greedy':'Mid','Topological Sort':'Mid',
    'Union Find':'Mid','Minimum Spanning Tree':'Mid','Shortest Path':'Mid',
    'Bucket Sort':'Low','Eulerian Circuit':'Low',
    '1-D DP':'Low','0/1 Knapsack':'Low','Unbounded Knapsack':'Low',
    'Longest Increasing Subsequence (LIS)':'Low','2D Grid DP':'Low',
    'String DP':'Low','Tree / Graph DP':'Low','Bitmask DP':'Low',
    'Digit DP':'Low','Probability DP':'Low','State Machine DP':'Low',
    'Maths / Geometry':'Low','String Matching':'Low',
    'Binary Indexed Tree / Segment Tree':'Low','Line Sweep':'Low',
}
_AM600_ORDER = [
    'Arrays','Strings','Hash Tables','Two Pointers',
    'Sliding Window - Fixed Size','Sliding Window - Dynamic Size',
    'Binary Search','Stacks',
    'Tree Traversal - Level Order','Tree Traversal - Pre Order',
    'Tree Traversal - In Order','Tree Traversal - Post-Order',
    'Depth First Search (DFS)','Breadth First Search (BFS)','Linked List',
    'Bit Manipulation','Prefix Sum',"Kadane's Algorithm",'Matrix (2D Array)',
    'LinkedList In-place Reversal','Monotonic Stack','Queues','Monotonic Queue',
    'Recursion','Divide and Conquer','Merge Sort','QuickSort / QuickSelect',
    'Backtracking','BST / Ordered Set','Tries','Heaps','Two Heaps',
    'Intervals','K-Way Merge','Data Structure Design','Greedy',
    'Topological Sort','Union Find','Minimum Spanning Tree','Shortest Path',
    'Bucket Sort','Eulerian Circuit',
    '1-D DP','0/1 Knapsack','Unbounded Knapsack',
    'Longest Increasing Subsequence (LIS)','2D Grid DP','String DP',
    'Tree / Graph DP','Bitmask DP','Digit DP','Probability DP','State Machine DP',
    'Maths / Geometry','String Matching','Binary Indexed Tree / Segment Tree','Line Sweep',
]
PRIORITY_LABEL = {'High':'High Priority','Mid':'Mid Priority','Low':'Low Priority'}
PRIORITY_BAR   = {'High':'#DC2626','Mid':'#D97706','Low':'#6B7280'}
DIFF_CLR       = {'Easy':'#16a34a','Medium':'#ea580c','Hard':'#dc2626'}
DIFF_SHORT     = {'Easy':'EAS','Medium':'MED','Hard':'HAR'}

# ── Load Set 3 questions (AM600 exclusive) ────────────────────────────────────
s3_raw = json.loads((SCRIPT_DIR/'public/set3_descriptions.json').read_text())
# Build category map from set3 data: each q has 'category' and 'priority' fields
cat_map = {q['id']: q['category'] for q in s3_raw}

def build_rounds(qs, cat_map):
    result = []
    for rn, priority, difficulty in ROUNDS:
        tier = [c for c in _AM600_ORDER if _AM600_PRIORITY.get(c) == priority]
        groups = []
        for cat in tier:
            bucket = sorted(
                [q for q in qs if cat_map.get(q['id']) == cat and q.get('difficulty') == difficulty],
                key=lambda x: x['id'])
            if bucket:
                groups.append((cat, bucket))
        result.append((rn, priority, difficulty, groups))
    return result

rounds = build_rounds(s3_raw, cat_map)
total_q = sum(len(g[1]) for _,_,_,gs in rounds for g in gs)
print(f"AM600 questions: {total_q}")

# ── Styles ────────────────────────────────────────────────────────────────────
SANS = 'Helvetica-Bold'; SANSN = 'Helvetica'
def sty(name,font=SANSN,size=8,color='#111827',lead=11,after=0,before=0,indent=0,bg=None):
    kw=dict(fontName=font,fontSize=size,textColor=HexColor(color),
            leading=lead,spaceAfter=after,spaceBefore=before,leftIndent=indent)
    if bg: kw['backColor']=HexColor(bg)
    return ParagraphStyle(name,**kw)

LC = '#0056b3'
story = []
story.append(Paragraph('<font face="Helvetica-Bold" size="15">LeetMastery · AM600 Question List</font>',
    sty('cv',SANS,15,'#1e3a5f',20,after=3)))
story.append(Paragraph(
    f'<font face="Helvetica" size="8" color="#6b7280">'
    f'{total_q} AM600-exclusive questions · Priority-grouped · LeetCode links</font>',
    sty('sub',SANSN,8,'#6b7280',11,after=5)))
story.append(HRFlowable(width='100%',thickness=1.2,color=HexColor('#1e3a5f'),spaceAfter=6))

for rn, priority, difficulty, groups in rounds:
    if not groups: continue
    rc = sum(len(g[1]) for g in groups)
    bg = PRIORITY_BAR[priority]
    story.append(Paragraph(
        f'<font face="Helvetica-Bold" size="10" color="#ffffff">'
        f'Round {rn}  ·  {PRIORITY_LABEL[priority]}  ·  {difficulty}  ({rc})</font>',
        sty(f'rh{rn}',SANS,10,'#ffffff',14,after=1,before=5,indent=4,bg=bg)))

    for cat_name, qs in groups:
        diff_c = DIFF_CLR[difficulty]
        block = [Paragraph(
            f'<font face="Helvetica-Bold" size="8.5" color="{diff_c}">'
            f'{cat_name}  ({len(qs)})</font>',
            sty(f'ph{rn}{cat_name[:6]}',SANS,8.5,diff_c,12,after=0,before=1,indent=10))]
        for q in qs:
            slug   = q.get('slug','')
            qid    = q['id']
            title  = q['title']
            lc_url = f'https://leetcode.com/problems/{slug}/'
            diff_s = DIFF_SHORT.get(q.get('difficulty','Easy'),'EAS')
            dc2    = DIFF_CLR.get(q.get('difficulty','Easy'),'#16a34a')
            line   = (
                f'<font face="Helvetica" size="7" color="#999999">&#9744;  </font>'
                f'<font face="Helvetica" size="7.8" color="#111827">#{qid} {title}</font>'
                f'  <a href="{lc_url}"><font face="Helvetica-Bold" size="9" color="{LC}">&#8594;</font></a>'
                f'  <font face="Helvetica" size="6.5" color="{dc2}">{diff_s}</font>'
            )
            block.append(Paragraph(line, sty(f'qi{qid}',SANSN,7.8,'#111827',11,
                                             after=0,before=0,indent=16)))
        story.append(KeepTogether(block))

story.append(Spacer(1,8))
story.append(HRFlowable(width='100%',thickness=0.5,color=HexColor('#9ca3af')))
story.append(Paragraph(
    '<font face="Helvetica" size="7" color="#9ca3af">'
    'LeetMastery · AM600 Exclusives · → opens LeetCode in browser</font>',
    sty('ft',SANSN,7,'#9ca3af',9,before=4)))

tmp_rl = OUT_PDF.with_suffix('.rl.pdf')
doc_rl = SimpleDocTemplate(str(tmp_rl), pagesize=letter,
    leftMargin=0.55*inch, rightMargin=0.55*inch,
    topMargin=0.5*inch, bottomMargin=0.5*inch,
    title='LeetMastery — AM600 Question List')
doc_rl.build(story)

# ── Add checkboxes via PyMuPDF ────────────────────────────────────────────────
doc = fitz.open(str(tmp_rl))
all_qids = {str(q['id']) for q in s3_raw}
CB = 6.5; n_boxes = 0

for pg_idx in range(len(doc)):
    page = doc[pg_idx]; pg_xref = page.xref
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            full_text = ''.join(s['text'] for s in line['spans'])
            m = re.search(r'#(\d+)\s', full_text)
            if not m or m.group(1) not in all_qids: continue
            qid = m.group(1); field_name = f'solved_am_{qid}'
            bbox = line['bbox']; line_h = bbox[3]-bbox[1]
            cb_h = min(CB, line_h*0.88)
            cb_y0 = bbox[1]+(line_h-cb_h)/2; cb_y1 = cb_y0+cb_h
            # Find ☐ placeholder span
            cb_span = next((s for s in line['spans'] if '☐' in s['text']), None)
            if cb_span:
                cb_x0 = cb_span['bbox'][0]; cb_x1 = cb_x0+cb_h
            else:
                cb_x0 = max(bbox[0]-cb_h-2, 25); cb_x1 = cb_x0+cb_h
            cb_rect = fitz.Rect(cb_x0,cb_y0,cb_x1,cb_y1)
            page.draw_rect(cb_rect,color=(0.15,0.15,0.15),fill=(1,1,1),width=0.75)
            w = fitz.Widget()
            w.rect=cb_rect; w.field_type=fitz.PDF_WIDGET_TYPE_CHECKBOX
            w.field_name=field_name; w.field_value='Off'; w.on_state='Yes'
            page.add_widget(w)
            fresh = [fw for fw in page.widgets() if fw.field_name==field_name]
            if fresh:
                fw=fresh[-1]; fw_str=doc.xref_object(fw.xref)
                if '/P ' not in fw_str:
                    doc.update_object(fw.xref, fw_str.replace('/Type /Annot',
                        f'/Type /Annot\n  /P {pg_xref} 0 R'))
                fw.update()
            n_boxes+=1

cat_xref=doc.pdf_catalog(); cat_str=doc.xref_object(cat_xref)
if '/AcroForm' in cat_str and '/NeedAppearances' not in cat_str:
    doc.update_object(cat_xref, cat_str.replace('/AcroForm <<','/AcroForm <<\n  /NeedAppearances true'))

tmp2 = str(OUT_PDF)+'.tmp'
doc.save(tmp2, garbage=4, deflate=True)
doc.close(); tmp_rl.unlink(missing_ok=True); os.replace(tmp2, str(OUT_PDF))
print(f'✓  {OUT_PDF}')
print(f'   {doc_rl.page} pages  |  {n_boxes}/{total_q} checkboxes  |  {os.path.getsize(OUT_PDF)//1024} KB')

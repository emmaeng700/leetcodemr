"""
LeetMastery — Main Splits Generator (pattern_run style)
=========================================================
Builds 9 PDFs (one per round) matching the full pattern_run.pdf:
  • 2×1 landscape layout (2 questions per sheet)
  • Syntax-highlighted monokai code
  • Inline Quick Review summaries
  • Checkboxes + ← Contents back-links
  • TOC → question links

Output: ~/Desktop/splits/splitsformain/

Usage:
  /usr/bin/python3 generate_main_splits.py
"""

import json, sys
from pathlib import Path

# Force --2x1 flag so the generator uses landscape inner pages (300×200)
# and all the same settings as pattern_run.pdf
sys.argv = [sys.argv[0], '--2x1']

import generate_study_order_pdf as G
import fitz

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
QUESTIONS   = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE = SCRIPT_DIR / ".full_langs_cache.json"
DOOCS_CACHE = SCRIPT_DIR / ".doocs_cache.json"
INNER_TMP   = SCRIPT_DIR / "_main_split_inner.pdf"
OUT_DIR     = Path.home() / "Desktop" / "splits" / "splitsformain"

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

# ── 2×1 imposer (matches pattern_run.pdf exactly) ────────────────────────────
def impose_2x1(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)
    L_W, L_H = 792.0, 612.0
    COLS = 2
    CW   = L_W / COLS   # 396
    GAP  = 3.0
    for i in range(0, n, COLS):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(COLS, n - i)):
            rect = fitz.Rect(j*CW+GAP, GAP, (j+1)*CW-GAP, L_H-GAP)
            sheet.show_pdf_page(rect, src, i + j)
        shape = sheet.new_shape()
        shape.draw_line(fitz.Point(CW, 0), fitz.Point(CW, L_H))
        shape.finish(color=(0.7, 0.7, 0.7), width=0.5)
        shape.commit()
    num = len(dst)
    for pg in range(num):
        dst[pg].insert_text(
            fitz.Point(L_W/2 - 80, L_H - 3),
            f'Sheet {pg+1}/{num}  ·  LeetMastery  ·  2×1',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )
    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()

# ── Add checkboxes + links (same as pattern_run.pdf) ─────────────────────────
def add_links(output_path: Path, rounds):
    """Analyse inner PDF and add TOC links + ← Contents + checkboxes."""
    page_types, qid_first_page, toc_link_rects, _ = G._analyze_inner_for_links(
        INNER_TMP, rounds
    )
    G._add_links_2x2(
        output_path, page_types, qid_first_page, toc_link_rects,
        per_sheet=2, cols=2,
        src_w=G.MP_W, src_h=G.MP_H,
        L_W=792.0, L_H=612.0, GAP=3.0,
    )


if __name__ == '__main__':
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print('Loading data…')
    questions = json.loads(QUESTIONS.read_text())
    sites     = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs     = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    from generate_patterns_pdf import repair_doocs_cache
    n_repaired = repair_doocs_cache(doocs)
    if n_repaired:
        DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))
        print(f'  Repaired {n_repaired} poisoned Doocs description(s)')
    print(f'  {len(questions)} questions')

    print('Building study-order rounds…')
    all_rounds = G.build_rounds(questions)

    for round_num, priority, difficulty, pattern_groups in all_rounds:
        all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs:
            continue

        name     = ROUND_NAMES.get((round_num, priority, difficulty),
                                   f'{round_num:02d}_{priority}_{difficulty}')
        out_path = OUT_DIR / f'{name}.pdf'
        print(f'\n[{name}]  {len(all_qs)} questions…')

        # Build inner PDF for this round only
        G.INNER_PDF = INNER_TMP
        n_pages, _, _ = G.build_inner_pdf(
            [(round_num, priority, difficulty, pattern_groups)],
            sites, doocs
        )
        print(f'  Inner pages: {n_pages}')

        # Analyse for links before imposing
        print(f'  Analysing for links/checkboxes…')
        this_rounds = [(round_num, priority, difficulty, pattern_groups)]
        page_types, qid_first_page, toc_link_rects, _ = G._analyze_inner_for_links(
            INNER_TMP, this_rounds
        )

        # Impose as 2×1 landscape
        impose_2x1(INNER_TMP, out_path)

        # Add TOC links + checkboxes
        G._add_links_2x2(
            out_path, page_types, qid_first_page, toc_link_rects,
            per_sheet=2, cols=2,
            src_w=G.MP_W, src_h=G.MP_H,
            L_W=792.0, L_H=612.0, GAP=3.0,
        )

        kb     = out_path.stat().st_size // 1024
        sheets = (n_pages + 1) // 2
        print(f'  → {out_path.name}  ({kb:,} KB,  {sheets} sheets)')
        INNER_TMP.unlink(missing_ok=True)

    print(f'\nAll main splits saved to {OUT_DIR}')
    print('\nFiles:')
    for f in sorted(OUT_DIR.glob('*.pdf')):
        print(f'  {f.name}  ({f.stat().st_size//1024:,} KB)')

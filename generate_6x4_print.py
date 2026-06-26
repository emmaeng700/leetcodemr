#!/usr/bin/env python3
"""
generate_6x4_print.py
Produces a black-and-white print version of the 6×4 simplified PDF.
Each source page is rendered at 300 DPI in grayscale (no colour ink),
then imposed 6-across × 4-down on landscape letter (792×612 pt).

Usage:
    python3 generate_6x4_print.py                  # simplified (331 q)
    python3 generate_6x4_print.py --am-extra       # + AM600 extras
Output: Desktop/simplified_6x4_print.pdf
        Desktop/simplified_am600_6x4_print.pdf     (--am-extra)
"""

import sys
import os
import fitz
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DESKTOP    = Path.home() / 'Desktop'

AM_EXTRA = '--am-extra' in sys.argv

if AM_EXTRA:
    SRC_1UP  = SCRIPT_DIR / 'simplified_am600_1up.pdf'
    OUT_PDF  = DESKTOP / 'simplified_am600_6x4_print.pdf'
    LABEL    = 'Simplified AM600 · Print B&W'
else:
    SRC_1UP  = SCRIPT_DIR / 'simplified_1up.pdf'
    OUT_PDF  = DESKTOP / 'simplified_6x4_print.pdf'
    LABEL    = 'Simplified · 331 Questions · Print B&W'

# ── Layout ────────────────────────────────────────────────────────────────────
L_W, L_H   = 792.0, 612.0   # landscape letter
COLS, ROWS  = 6, 4
PER_SHEET   = COLS * ROWS    # 24
CW = L_W / COLS              # 132 pt
RH = L_H / ROWS              # 153 pt
GAP = 1.5                    # pt gap around each cell

# ── Render settings ───────────────────────────────────────────────────────────
RENDER_DPI   = 72            # DPI for rasterising each source page (72 = base resolution, sharp at print scale)
RENDER_SCALE = RENDER_DPI / 72
RENDER_MAT   = fitz.Matrix(RENDER_SCALE, RENDER_SCALE)
COLORSPACE   = fitz.csGRAY   # pure grayscale (B&W)

# ── Source page geometry ──────────────────────────────────────────────────────
SRC_W, SRC_H = 612.0, 792.0
slot_w = CW - 2 * GAP       # 129 pt
slot_h = RH - 2 * GAP       # 150 pt
# keep_proportion: height fills the slot, width is centred
scale  = min(slot_w / SRC_W, slot_h / SRC_H)   # ≈ 0.1894
x_off  = (slot_w - SRC_W * scale) / 2           # ≈ 6.55 pt
y_off  = (slot_h - SRC_H * scale) / 2           # ≈ 0 pt


def slot_img_rect(col: int, row: int) -> fitz.Rect:
    """Actual image rect inside the cell (centred, proportional)."""
    content_w = SRC_W * scale
    content_h = SRC_H * scale
    ox = col * CW + GAP + x_off
    oy = row * RH + GAP + y_off
    return fitz.Rect(ox, oy, ox + content_w, oy + content_h)


def build_print_6x4(src_path: Path, dst_path: Path, label: str) -> None:
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)
    print(f'Source: {src_path.name}  ({n} pages)')

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        count = min(PER_SHEET, n - i)

        for j in range(count):
            col, row = j % COLS, j // COLS
            src_page = src[i + j]

            # Render to B&W pixmap at 300 DPI
            pix = src_page.get_pixmap(
                matrix=RENDER_MAT,
                colorspace=COLORSPACE,
                clip=None,
                alpha=False,
            )

            # Slightly boost contrast for crisper print blacks
            # (multiply grey channel toward pure black where dark)
            img_rect = slot_img_rect(col, row)
            sheet.insert_image(img_rect, pixmap=pix, keep_proportion=True)

        # Cell borders (thin black lines)
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0, 0, 0), width=0.5)
        shape.commit()

    # Footer on every sheet
    num_sheets = len(dst)
    for pg in range(num_sheets):
        dst[pg].insert_text(
            fitz.Point(L_W / 2 - 150, L_H - 3),
            f'Sheet {pg+1}/{num_sheets}  ·  LeetMastery Study-Order  ·  {label}  ·  6×4',
            fontsize=4.5,
            color=(0, 0, 0),
        )

    print(f'Saving {num_sheets} sheets …')
    tmp = str(dst_path) + '.tmp'
    dst.save(tmp, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
    import os; os.replace(tmp, str(dst_path))
    src.close()
    dst.close()
    print(f'✓  {dst_path}')


build_print_6x4(SRC_1UP, OUT_PDF, LABEL)

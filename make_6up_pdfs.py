"""
LeetMastery — 6-up PDF imposer
Arranges 6 original pages in a 2-column × 3-row grid on each sheet.

Output: pattern_pdfs/6up/

Usage:
  python3 make_6up_pdfs.py
"""

from pathlib import Path
import fitz  # PyMuPDF

SRC_DIR = Path(__file__).parent / "pattern_pdfs"
OUT_DIR = SRC_DIR / "6up"

# Letter portrait: 612 × 792 pts
W, H   = 612.0, 792.0
COLS   = 2
ROWS   = 3
MW     = W / COLS   # 306 pts per cell
MH     = H / ROWS   # 264 pts per cell
GAP    = 5.0
DIVIDER_COLOR = (0.3, 0.3, 0.3)
DIVIDER_WIDTH = 1.5


def make_6up(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    for i in range(0, n, 6):
        sheet = dst.new_page(width=W, height=H)

        # Place up to 6 source pages in the 2×3 grid
        for j in range(min(6, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * MW + GAP,
                row * MH + GAP,
                (col + 1) * MW - GAP,
                (row + 1) * MH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Draw dividers
        shape = sheet.new_shape()
        # Vertical divider (1 line at centre)
        shape.draw_line(fitz.Point(MW, 0), fitz.Point(MW, H))
        # Horizontal dividers (2 lines at 1/3 and 2/3)
        shape.draw_line(fitz.Point(0, MH),     fitz.Point(W, MH))
        shape.draw_line(fitz.Point(0, MH * 2), fitz.Point(W, MH * 2))
        shape.finish(color=DIVIDER_COLOR, width=DIVIDER_WIDTH)
        shape.commit()

        # Border around each occupied cell
        for j in range(min(6, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * MW + GAP / 2,
                row * MH + GAP / 2,
                (col + 1) * MW - GAP / 2,
                (row + 1) * MH - GAP / 2,
            )
            s2 = sheet.new_shape()
            s2.draw_rect(rect)
            s2.finish(color=(0.5, 0.5, 0.5), width=0.4, fill=None)
            s2.commit()

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close()
    dst.close()


def main():
    OUT_DIR.mkdir(exist_ok=True)
    pdfs = sorted(SRC_DIR.glob("LeetMastery_*.pdf"))

    if not pdfs:
        raise SystemExit(f"No PDFs found in {SRC_DIR}/")

    print(f"6-up imposing {len(pdfs)} PDFs → {OUT_DIR}/\n")

    for pdf in pdfs:
        out = OUT_DIR / pdf.name
        print(f"  {pdf.name} ...", end=" ", flush=True)
        make_6up(pdf, out)
        orig_kb = pdf.stat().st_size // 1024
        new_kb  = out.stat().st_size  // 1024
        print(f"✅  {new_kb:,} KB  (was {orig_kb:,} KB)")

    print(f"\n🎉  Done! {len(pdfs)} 6-up PDFs written to {OUT_DIR}/")


if __name__ == "__main__":
    main()

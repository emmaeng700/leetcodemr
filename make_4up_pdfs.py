"""
LeetMastery — 4-up PDF imposer
Takes every PDF in pattern_pdfs/ and produces a version with
4 original pages arranged 2×2 on each sheet (like "4 per sheet" in print dialog).

Output: pattern_pdfs/4up/

Usage:
  python3 make_4up_pdfs.py
"""

from pathlib import Path
import fitz  # PyMuPDF

SRC_DIR = Path(__file__).parent / "pattern_pdfs"
OUT_DIR = SRC_DIR / "4up"

# Letter page in points (1 pt = 1/72 inch)
W, H   = 612.0, 792.0   # portrait letter
MW, MH = W / 2, H / 2   # each mini-page cell
GAP    = 6.0             # inset so pages don't bleed to cut line
DIVIDER_COLOR = (0.3, 0.3, 0.3)   # dark grey dividers
DIVIDER_WIDTH = 2.0                # thick visible line


def make_4up(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    for i in range(0, n, 4):
        sheet = dst.new_page(width=W, height=H)

        # Place up to 4 source pages into the 2×2 grid
        for j in range(min(4, n - i)):
            col = j % 2
            row = j // 2
            rect = fitz.Rect(
                col * MW + GAP,
                row * MH + GAP,
                (col + 1) * MW - GAP,
                (row + 1) * MH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Draw bold dividers between cells
        shape = sheet.new_shape()
        shape.draw_line(fitz.Point(MW, 0),  fitz.Point(MW, H))   # vertical
        shape.draw_line(fitz.Point(0, MH),  fitz.Point(W, MH))   # horizontal
        shape.finish(color=DIVIDER_COLOR, width=DIVIDER_WIDTH)
        shape.commit()

        # Draw a thin border around each occupied cell
        for j in range(min(4, n - i)):
            col = j % 2
            row = j // 2
            rect = fitz.Rect(
                col * MW + GAP / 2,
                row * MH + GAP / 2,
                (col + 1) * MW - GAP / 2,
                (row + 1) * MH - GAP / 2,
            )
            shape2 = sheet.new_shape()
            shape2.draw_rect(rect)
            shape2.finish(color=(0.5, 0.5, 0.5), width=0.5, fill=None)
            shape2.commit()

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close()
    dst.close()


def main():
    OUT_DIR.mkdir(exist_ok=True)
    pdfs = sorted(SRC_DIR.glob("LeetMastery_*.pdf"))

    if not pdfs:
        raise SystemExit(f"No PDFs found in {SRC_DIR}/")

    print(f"4-up imposing {len(pdfs)} PDFs → {OUT_DIR}/\n")

    for pdf in pdfs:
        out = OUT_DIR / pdf.name
        print(f"  {pdf.name} ...", end=" ", flush=True)
        make_4up(pdf, out)
        orig_kb = pdf.stat().st_size // 1024
        new_kb  = out.stat().st_size  // 1024
        print(f"✅  {new_kb:,} KB  (was {orig_kb:,} KB)")

    print(f"\n🎉  Done! {len(pdfs)} 4-up PDFs written to {OUT_DIR}/")


if __name__ == "__main__":
    main()

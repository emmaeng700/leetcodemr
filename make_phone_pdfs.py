"""
LeetMastery — Phone-optimised 4-up PDF converter
Places 4 original pages in a 2×2 grid on a phone-sized canvas.
80 original pages → 20 phone screens. Fills screen edge-to-edge.

Output: pattern_pdfs/phone/

Usage:
  python3 make_phone_pdfs.py
"""

from pathlib import Path
import fitz  # PyMuPDF

SRC_DIR = Path(__file__).parent / "pattern_pdfs"
OUT_DIR = SRC_DIR / "phone"

# Phone canvas — iPhone 14 / Android equivalent in PDF points
PHONE_W = 390.0
PHONE_H = 844.0

COLS  = 2
ROWS  = 2
CW    = PHONE_W / COLS   # 195 pts per cell
CH    = PHONE_H / ROWS   # 422 pts per cell
GAP   = 4.0

DIVIDER_COLOR = (0.35, 0.35, 0.35)
DIVIDER_WIDTH = 1.5


def make_phone_4up(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    for i in range(0, n, 4):
        sheet = dst.new_page(width=PHONE_W, height=PHONE_H)

        for j in range(min(4, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * CW + GAP,
                row * CH + GAP,
                (col + 1) * CW - GAP,
                (row + 1) * CH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Bold dividers so the grid is obvious on phone
        shape = sheet.new_shape()
        shape.draw_line(fitz.Point(CW, 0),       fitz.Point(CW, PHONE_H))
        shape.draw_line(fitz.Point(0, CH),        fitz.Point(PHONE_W, CH))
        shape.finish(color=DIVIDER_COLOR, width=DIVIDER_WIDTH)
        shape.commit()

        # Border around each cell
        for j in range(min(4, n - i)):
            col = j % COLS
            row = j // COLS
            rect = fitz.Rect(
                col * CW + GAP / 2,
                row * CH + GAP / 2,
                (col + 1) * CW - GAP / 2,
                (row + 1) * CH - GAP / 2,
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

    print(f"Phone 4-up: {PHONE_W:.0f}×{PHONE_H:.0f} pts, 2×2 grid → {OUT_DIR}/\n")

    for pdf in pdfs:
        out = OUT_DIR / pdf.name
        src_doc = fitz.open(str(pdf))
        orig_pages = len(src_doc)
        src_doc.close()
        print(f"  {pdf.name} ...", end=" ", flush=True)
        make_phone_4up(pdf, out)
        out_doc   = fitz.open(str(out))
        new_pages = len(out_doc)
        out_doc.close()
        new_kb = out.stat().st_size // 1024
        print(f"✅  {orig_pages} pages → {new_pages} screens  ({new_kb:,} KB)")

    print(f"\n🎉  Done! {len(pdfs)} phone PDFs in {OUT_DIR}/")
    print(f"    2×2 grid on {PHONE_W:.0f}×{PHONE_H:.0f} phone canvas — 4× fewer screens to swipe.")


if __name__ == "__main__":
    main()

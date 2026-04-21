"""
LeetMastery — 6-up printable PDF imposer
Takes the *_Print.pdf files from pattern_pdfs/ and arranges 6 pages
in a 2×3 grid on each letter sheet — light backgrounds, ideal for printing.

Output: pattern_pdfs/6up_print/

Usage:
  python3 make_6up_print_pdfs.py
"""

from pathlib import Path
import fitz  # PyMuPDF

import argparse
BASE_DIR = Path(__file__).parent / "pattern_pdfs"

# Letter portrait: 612 × 792 pts
W, H   = 612.0, 792.0
COLS   = 2
ROWS   = 3
MW     = W / COLS   # 306 pts per cell
MH     = H / ROWS   # 264 pts per cell
GAP    = 5.0

DIVIDER_COLOR = (0.4, 0.4, 0.4)
DIVIDER_WIDTH = 1.5


def make_6up(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    for i in range(0, n, 6):
        sheet = dst.new_page(width=W, height=H)

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

        # Dividers
        shape = sheet.new_shape()
        shape.draw_line(fitz.Point(MW, 0),      fitz.Point(MW, H))
        shape.draw_line(fitz.Point(0, MH),      fitz.Point(W, MH))
        shape.draw_line(fitz.Point(0, MH * 2),  fitz.Point(W, MH * 2))
        shape.finish(color=DIVIDER_COLOR, width=DIVIDER_WIDTH)
        shape.commit()

        # Cell borders
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
            s2.finish(color=(0.6, 0.6, 0.6), width=0.4, fill=None)
            s2.commit()

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close()
    dst.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src",  default="print",    help="Source subfolder under pattern_pdfs/")
    ap.add_argument("--out",  default="6up_print", help="Output subfolder under pattern_pdfs/")
    args = ap.parse_args()

    SRC_DIR = BASE_DIR / args.src
    OUT_DIR = BASE_DIR / args.out
    OUT_DIR.mkdir(exist_ok=True)

    # Source: the *_Print.pdf files
    pdfs = sorted(SRC_DIR.glob("LeetMastery_*_Print.pdf"))

    if not pdfs:
        raise SystemExit(
            f"No *_Print.pdf files found in {SRC_DIR}/\n"
            "  Run: python3 generate_individual_pattern_pdfs.py --printable [--code-size N]"
        )

    print(f"6-up printable: 2×3 grid on {W:.0f}×{H:.0f} letter sheet\n"
          f"  src → {SRC_DIR}/\n  out → {OUT_DIR}/\n")

    for pdf in pdfs:
        # Output filename strips _Print and keeps the rest
        out_name = pdf.name.replace("_Print.pdf", "_6up_Print.pdf")
        out = OUT_DIR / out_name
        src_doc = fitz.open(str(pdf))
        orig_pages = len(src_doc)
        src_doc.close()
        print(f"  {pdf.name} ...", end=" ", flush=True)
        make_6up(pdf, out)
        out_doc   = fitz.open(str(out))
        new_pages = len(out_doc)
        out_doc.close()
        new_kb = out.stat().st_size // 1024
        print(f"✅  {orig_pages} pages → {new_pages} sheets  ({new_kb:,} KB)")

    print(f"\n🎉  Done! {len(pdfs)} printable 6-up PDFs in {OUT_DIR}/")
    print("    Light backgrounds · monochrome code · ready for B&W home printer")


if __name__ == "__main__":
    main()

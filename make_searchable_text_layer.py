"""
Make a PDF fully searchable by adding an *invisible* text layer per page.

Why this exists:
Some PDF viewers fail to find visible text when the PDF's internal text runs
are fragmented / missing spaces (e.g. 'GraphsLeetMastery'). We keep the visuals
unchanged and add a normalized invisible text layer, so search always works.

This does NOT rasterize pages and does NOT touch images.

Usage:
  python3 make_searchable_text_layer.py \
    --in  pattern_pdfs/LeetMastery_All_21_Patterns_Print_Colored_DarkCode.pdf \
    --out pattern_pdfs/LeetMastery_All_21_Patterns_Print_Colored_DarkCode_Searchable.pdf
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz  # PyMuPDF


def normalize_text(s: str) -> str:
    # Fix common missing-space cases between word boundaries.
    s = s.replace("\u00a0", " ")
    # Insert space between lowercase->Uppercase transitions (GraphsLeetMastery -> Graphs LeetMastery)
    s = re.sub(r"([a-z])([A-Z])", r"\\1 \\2", s)
    # Insert space between letter->digit and digit->letter boundaries when stuck together.
    s = re.sub(r"([A-Za-z])([0-9])", r"\\1 \\2", s)
    s = re.sub(r"([0-9])([A-Za-z])", r"\\1 \\2", s)
    # Collapse excessive whitespace.
    s = re.sub(r"[ \\t\\f\\v]+", " ", s)
    s = re.sub(r"\\n{3,}", "\\n\\n", s)
    return s.strip()


def add_invisible_text_layer(doc: fitz.Document) -> None:
    for page in doc:
        raw = page.get_text("text") or ""
        norm = normalize_text(raw)
        if not norm:
            continue

        # Put invisible searchable text in a big textbox covering the whole page.
        # render_mode=3 => invisible text (searchable, selectable, but not drawn).
        rect = page.rect
        page.insert_textbox(
            rect,
            norm,
            fontname="helv",
            fontsize=8,
            render_mode=3,
            overlay=True,
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", type=Path, required=True)
    ap.add_argument("--out", dest="out_path", type=Path, required=True)
    args = ap.parse_args()

    in_path = args.in_path
    out_path = args.out_path

    with fitz.open(str(in_path)) as doc:
        add_invisible_text_layer(doc)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        doc.save(str(out_path), garbage=4, deflate=True)

    print(f"✅  wrote {out_path}")


if __name__ == "__main__":
    main()


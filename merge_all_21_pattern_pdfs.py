"""
Merge the 21 per-pattern PDFs into a single "All 21 Patterns" PDF.

Primary use (what you asked for):
  - generate colored, eye-friendly print PDFs per pattern
  - merge them into pattern_pdfs/LeetMastery_All_21_Patterns_Print.pdf

Usage:
  python3 merge_all_21_pattern_pdfs.py --src "pattern_pdfs/print" --glob "*_Print.pdf"
  python3 merge_all_21_pattern_pdfs.py --src "pattern_pdfs/print" --glob "*_Print_Colored_DarkCode.pdf" --out "pattern_pdfs/LeetMastery_All_21_Patterns_Print_Colored_DarkCode.pdf"
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import fitz  # PyMuPDF


def _safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


def _ordered_pdfs_by_question_count(project_dir: Path, src_dir: Path, pattern_glob: str) -> list[Path]:
    """Order PDFs by ascending question-count per pattern (matches your original ordering)."""
    questions_path = project_dir / "public" / "questions_full.json"
    with open(questions_path) as f:
        questions = json.load(f)

    # Import locally to avoid making generate_patterns_pdf a hard dependency in all paths.
    from generate_patterns_pdf import build_groups

    groups = build_groups(questions)
    named = [(p, qs) for p, qs in groups if p["name"] != "Other" and qs]
    sorted_g = sorted(named, key=lambda x: len(x[1]))  # ascending question count

    all_pdfs = list(src_dir.glob(pattern_glob))
    if not all_pdfs:
        return []

    # Try find by contains slug.
    ordered: list[Path] = []
    for pat, _qs in sorted_g:
        slug = _safe_name(pat["name"])
        match = next((fp for fp in all_pdfs if f"_{slug}_" in fp.name or fp.name.endswith(f"_{slug}.pdf") or f"_{slug}.pdf" in fp.name), None)
        if match is None:
            # fallback: any file that includes the slug somewhere
            match = next((fp for fp in all_pdfs if slug in fp.name), None)
        if match is None:
            raise SystemExit(f"Couldn't find PDF for pattern '{pat['name']}' (slug '{slug}') in {src_dir}/")
        ordered.append(match)
    return ordered


def merge_pdfs(src_dir: Path, pattern: str, out_path: Path, order: str = "filename") -> None:
    if order == "asc-count":
        pdfs = _ordered_pdfs_by_question_count(Path(__file__).parent, src_dir, pattern)
    else:
        pdfs = sorted(src_dir.glob(pattern))
    if not pdfs:
        raise SystemExit(f"No PDFs matched in {src_dir}/ with glob '{pattern}'")

    dst = fitz.open()
    for p in pdfs:
        with fitz.open(str(p)) as doc:
            dst.insert_pdf(doc)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    dst.save(str(out_path), garbage=4, deflate=True)
    dst.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path("pattern_pdfs/print"))
    ap.add_argument("--glob", dest="glob_pattern", default="LeetMastery_*_Print.pdf")
    ap.add_argument("--out", type=Path, default=Path("pattern_pdfs/LeetMastery_All_21_Patterns_Print.pdf"))
    ap.add_argument(
        "--order",
        choices=["filename", "asc-count"],
        default="filename",
        help="Ordering for merge: filename sort, or asc-count (fewest questions → most)",
    )
    args = ap.parse_args()

    src_dir = (Path(__file__).parent / args.src).resolve() if not args.src.is_absolute() else args.src
    out_path = (Path(__file__).parent / args.out).resolve() if not args.out.is_absolute() else args.out

    merge_pdfs(src_dir, args.glob_pattern, out_path, order=args.order)
    size_kb = out_path.stat().st_size // 1024
    with fitz.open(str(out_path)) as d:
        pages = d.page_count
    print(f"✅  {out_path}  ({pages} pages, {size_kb:,} KB)")


if __name__ == "__main__":
    main()


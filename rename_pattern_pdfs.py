"""
Renames all pattern PDFs across every subfolder so the number prefix
reflects ascending question count (fewest → most).

Folders updated:
  pattern_pdfs/
  pattern_pdfs/print/
  pattern_pdfs/4up/
  pattern_pdfs/6up/
  pattern_pdfs/6up_print/
  pattern_pdfs/phone/
"""

import json, re
from pathlib import Path
from generate_patterns_pdf import build_groups

SCRIPT_DIR  = Path(__file__).parent
BASE        = SCRIPT_DIR / "pattern_pdfs"
FOLDERS     = [
    BASE,
    BASE / "print",
    BASE / "4up",
    BASE / "6up",
    BASE / "6up_print",
    BASE / "phone",
]

def safe_name(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")

def main():
    with open(SCRIPT_DIR / "public" / "questions_full.json") as f:
        questions = json.load(f)

    groups = build_groups(questions)
    named  = [(p, qs) for p, qs in groups if p["name"] != "Other" and qs]
    # Sort ascending by question count
    sorted_g = sorted(named, key=lambda x: len(x[1]))

    # Build old-number → new-number mapping
    # Old order = QUICK_PATTERNS order (01..21)
    old_order = [p["name"] for p, _ in named]          # original numbering
    new_order = [p["name"] for p, _ in sorted_g]       # new ascending order

    old_num = {name: f"{i+1:02d}" for i, name in enumerate(old_order)}
    new_num = {name: f"{i+1:02d}" for i, name in enumerate(new_order)}

    print("Renumbering plan:")
    for name, (p, qs) in zip(new_order, sorted_g):
        print(f"  {old_num[name]} → {new_num[name]}  {name}  ({len(qs)} qs)")

    print()

    for folder in FOLDERS:
        if not folder.exists():
            continue
        pdfs = sorted(folder.glob("LeetMastery_*.pdf"))
        if not pdfs:
            continue
        print(f"📁  {folder.relative_to(SCRIPT_DIR)}/")

        # Two-pass rename via temp names to avoid collisions
        # Pass 1: rename to temp names
        for pdf in pdfs:
            pdf.rename(pdf.with_name("__tmp__" + pdf.name))

        # Pass 2: rename temp → final
        for pdf in sorted(folder.glob("__tmp__LeetMastery_*.pdf")):
            stem = pdf.name[len("__tmp__"):]   # strip prefix

            # Find which pattern this file belongs to
            matched = None
            for name in old_order:
                slug = safe_name(name)
                old_n = old_num[name]
                # Match the old number + slug at the start
                if stem.startswith(f"LeetMastery_{old_n}_{slug}"):
                    matched = name
                    break

            if matched is None:
                # Couldn't match — just remove temp prefix and leave unchanged
                pdf.rename(pdf.with_name(stem))
                print(f"    ⚠️  unmatched: {stem}")
                continue

            new_n    = new_num[matched]
            new_slug = safe_name(matched)
            # Replace old number+slug with new number+slug
            old_prefix = f"LeetMastery_{old_num[matched]}_{safe_name(matched)}"
            new_prefix = f"LeetMastery_{new_n}_{new_slug}"
            new_name   = stem.replace(old_prefix, new_prefix, 1)
            pdf.rename(pdf.parent / new_name)
            print(f"    {stem}  →  {new_name}")

        print()

    print("✅  All folders renumbered by ascending question count.")

if __name__ == "__main__":
    main()

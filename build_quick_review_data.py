"""
Rebuild quick_review_data.py by merging:
  1. quick_review_info.json      — 331 Set 1 questions  (field: complexity)
  2. neetcodereview.json         — 32 NC150 exclusives   (field: space_and_time_complexity)
  3. am600review.json            — 344 AM600 exclusives  (field: space_and_time_complexity)

All entries are normalised to use the key "complexity" so existing PDF
generators work without any changes.

Usage:
    python3 build_quick_review_data.py
"""

import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PUBLIC     = SCRIPT_DIR / "public"

SOURCES = [
    (PUBLIC / "quick_review_info.json",  "complexity"),
    (PUBLIC / "neetcodereview.json",     "space_and_time_complexity"),
    (PUBLIC / "am600review.json",        "space_and_time_complexity"),
]

OUT = SCRIPT_DIR / "quick_review_data.py"


def _esc(s: str) -> str:
    return (s.replace("\\", "\\\\")
             .replace('"', '\\"')
             .replace("\n", "\\n")
             .replace("\r", ""))


def main():
    merged: dict[str, dict] = {}
    counts = []

    for path, cx_field in SOURCES:
        if not path.exists():
            print(f"  SKIP (not found): {path}")
            continue
        data = json.loads(path.read_text())
        before = len(merged)
        for entry in data:
            slug = entry.get("slug", "")
            if not slug:
                continue
            ki  = entry.get("key_insights", "").strip()
            cx  = entry.get(cx_field, "").strip()
            sol = entry.get("solution", "").strip()
            # Only write if at least one field has content
            if ki or cx or sol:
                merged[slug] = {"key_insights": ki, "complexity": cx, "solution": sol}
        added = len(merged) - before
        counts.append((path.name, added))
        print(f"  {path.name}: {len(data)} entries, {added} added to merged")

    # Write Python module
    lines = [
        "# Auto-generated — do not hand-edit",
        "# Sources: quick_review_info.json + neetcodereview.json + am600review.json",
        "QUICK_REVIEW = {",
    ]
    for slug, info in merged.items():
        ki  = _esc(info["key_insights"])
        cx  = _esc(info["complexity"])
        sol = _esc(info["solution"])
        lines.append(f'    "{slug}": {{')
        lines.append(f'        "key_insights": "{ki}",')
        lines.append(f'        "complexity":   "{cx}",')
        lines.append(f'        "solution":     "{sol}",')
        lines.append(f'    }},')
    lines.append("}")
    lines.append("")
    OUT.write_text("\n".join(lines))

    total = len(merged)
    print(f"\n✅  {OUT.name}: {total} slugs written")
    for name, n in counts:
        print(f"   {name}: {n}")


if __name__ == "__main__":
    main()

"""
apply_brute_batch6.py — Patch Phase 2 in grind_questions.json for the 26
remaining same-algorithm pairs identified in the batch-6 audit.

Replaces the Phase 2 block inside each question's starterPython field.
"""
import json, re, sys
from pathlib import Path
from brute_batch6 import BATCH6_FIX

JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "grind_questions.json"


def extract_phase2(code: str) -> tuple[int, int]:
    """Return (start_idx, end_idx) of the Phase 2 block inside `code`.

    Phase 2 block starts at the first line whose stripped text contains
    'PHASE 2' and ends just before the next 'PHASE 3' line (or end of str).
    """
    lines = code.split("\n")
    start = end = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r"PHASE\s*2", stripped):
            start = i
        elif start is not None and re.search(r"PHASE\s*3", stripped):
            end = i
            break
    if start is None:
        return -1, -1
    if end is None:
        end = len(lines)
    return start, end


def build_phase2_section(qid: int, new_class_code: str) -> str:
    """Wrap the new class code in the standard Phase 2 header comment + class body."""
    body = new_class_code.rstrip("\n")
    return (
        f'# PHASE 2 — BRUTE FORCE\n'
        f'# "Brute force first to anchor the logic. Different algorithm from Phase 4."\n'
        f'{body}\n'
    )


def patch(data: list, qid: int, new_class_code: str) -> bool:
    for q in data:
        if q.get("id") != qid:
            continue
        code: str = q.get("starterPython", "")
        start, end = extract_phase2(code)
        if start == -1:
            print(f"  [WARN] Q{qid}: no Phase 2 block found — skipping")
            return False
        lines = code.split("\n")
        new_section = build_phase2_section(qid, new_class_code)
        new_lines = lines[:start] + new_section.split("\n") + lines[end:]
        q["starterPython"] = "\n".join(new_lines)
        return True
    print(f"  [WARN] Q{qid}: question not found in JSON")
    return False


def main() -> None:
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    patched = 0
    for qid, new_code in BATCH6_FIX.items():
        print(f"  Patching Q{qid}…", end=" ")
        ok = patch(data, qid, new_code)
        if ok:
            patched += 1
            print("✓")
        else:
            print("✗")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nDone — {patched}/{len(BATCH6_FIX)} questions patched.")


if __name__ == "__main__":
    main()

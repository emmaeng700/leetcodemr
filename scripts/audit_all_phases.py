"""
audit_all_phases.py — Hardcore scan of all questions.

Checks for each question:
  A. Phase 2 has a class definition with real code (not just comments)
  B. Phase 4 has a class definition with real code
  C. Similarity ratio between Phase 2 and Phase 4 code < 0.80
  D. Phase 2 is NOT longer/more complex than Phase 4 (line count heuristic)
  E. Phase 2 and Phase 4 are structurally distinct (different algorithm tokens)

Prints a sorted report of all issues.
"""
import json, re
from difflib import SequenceMatcher
from pathlib import Path

JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "grind_questions.json"

# ── helpers ─────────────────────────────────────────────────────────────────

def extract_phase(code: str, phase_num: int) -> str:
    """Return the content of phase `phase_num` (between its header and the next PHASE N header)."""
    lines = code.split("\n")
    start = end = None
    pattern_start = re.compile(rf"PHASE\s*{phase_num}\b")
    pattern_end   = re.compile(rf"PHASE\s*{phase_num + 1}\b")
    for i, line in enumerate(lines):
        if start is None and pattern_start.search(line):
            start = i
        elif start is not None and pattern_end.search(line):
            end = i
            break
    if start is None:
        return ""
    if end is None:
        end = len(lines)
    return "\n".join(lines[start:end])


def code_lines(block: str) -> list[str]:
    """Non-comment, non-blank code lines from a phase block."""
    out = []
    for line in block.split("\n"):
        s = line.strip()
        if s and not s.startswith("#"):
            out.append(s)
    return out


def strip_ids(text: str) -> str:
    """Replace all identifiers/strings/numbers with 'I' for structural comparison."""
    text = re.sub(r'"""[\s\S]*?"""', 'I', text)
    text = re.sub(r"'''[\s\S]*?'''", 'I', text)
    text = re.sub(r'"[^"]*"', 'I', text)
    text = re.sub(r"'[^']*'", 'I', text)
    text = re.sub(r'\b\d+\b', 'I', text)
    text = re.sub(r'\b[A-Za-z_]\w*\b', 'I', text)
    return text


def similarity(a: str, b: str) -> float:
    sa, sb = strip_ids(a), strip_ids(b)
    return SequenceMatcher(None, sa, sb).ratio()


def has_class(block: str) -> bool:
    return bool(re.search(r'^\s*class\s+\w', block, re.MULTILINE))


def has_def(block: str) -> bool:
    return bool(re.search(r'^\s*def\s+\w', block, re.MULTILINE))


def class_name(block: str) -> str:
    m = re.search(r'class\s+(\w+)', block)
    return m.group(1) if m else ""


# ── main ────────────────────────────────────────────────────────────────────

with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

issues: list[dict] = []
stats = {
    "total": 0,
    "no_p2_code": 0,
    "no_p4_code": 0,
    "same_class_name": 0,
    "similar_high": 0,       # ratio >= 0.90
    "similar_medium": 0,     # 0.80 <= ratio < 0.90
    "p2_longer": 0,          # Phase 2 code lines > Phase 4 code lines (red flag)
}

SIM_CRITICAL = 0.90
SIM_WARN     = 0.80

for q in data:
    qid   = q["id"]
    title = q.get("title", "")
    code  = q.get("starterPython", "")
    stats["total"] += 1

    p2_block = extract_phase(code, 2)
    p4_block = extract_phase(code, 4)

    p2_cls  = has_class(p2_block)
    p4_cls  = has_class(p4_block)
    p2_code = code_lines(p2_block)
    p4_code = code_lines(p4_block)

    row_issues = []

    # A. Phase 2 missing code
    if not p2_block:
        row_issues.append("NO_P2_BLOCK")
        stats["no_p2_code"] += 1
    elif not p2_cls and not has_def(p2_block):
        row_issues.append("P2_NO_CODE")
        stats["no_p2_code"] += 1

    # B. Phase 4 missing code
    if not p4_block:
        row_issues.append("NO_P4_BLOCK")
        stats["no_p4_code"] += 1
    elif not p4_cls and not has_def(p4_block):
        row_issues.append("P4_NO_CODE")
        stats["no_p4_code"] += 1

    # Only compare if both have code
    if p2_code and p4_code:
        # C. Similarity
        ratio = similarity("\n".join(p2_code), "\n".join(p4_code))

        if ratio >= SIM_CRITICAL:
            row_issues.append(f"IDENTICAL(ratio={ratio:.2f})")
            stats["similar_high"] += 1
        elif ratio >= SIM_WARN:
            row_issues.append(f"TOO_SIMILAR(ratio={ratio:.2f})")
            stats["similar_medium"] += 1

        # D. Phase 2 longer than Phase 4 (suspicious for a "brute force")
        if len(p2_code) > len(p4_code) + 5:
            row_issues.append(f"P2_LONGER(p2={len(p2_code)} p4={len(p4_code)})")
            stats["p2_longer"] += 1

        # E. Same class name → almost certainly copy-paste
        cn2, cn4 = class_name(p2_block), class_name(p4_block)
        if cn2 and cn4 and cn2 == cn4:
            row_issues.append(f"SAME_CLASS_NAME({cn2})")
            stats["same_class_name"] += 1

        # Store ratio for every question so we can sort
        ratio_val = ratio
    else:
        ratio_val = 0.0

    if row_issues:
        issues.append({
            "id": qid,
            "title": title,
            "issues": row_issues,
            "ratio": ratio_val,
            "p2_lines": len(p2_code),
            "p4_lines": len(p4_code),
        })

# ── report ──────────────────────────────────────────────────────────────────

issues.sort(key=lambda x: -x["ratio"])

print(f"\n{'='*70}")
print(f"AUDIT COMPLETE — {stats['total']} questions scanned")
print(f"{'='*70}")
print(f"  Questions with any issue : {len(issues)}")
print(f"  No Phase 2 code block    : {stats['no_p2_code']}")
print(f"  No Phase 4 code block    : {stats['no_p4_code']}")
print(f"  ratio >= 0.90 (IDENTICAL): {stats['similar_high']}")
print(f"  ratio 0.80-0.89 (SIMILAR): {stats['similar_medium']}")
print(f"  Phase 2 longer than P4+5 : {stats['p2_longer']}")
print(f"  Same class name          : {stats['same_class_name']}")
print(f"{'='*70}\n")

CRITICAL_TAGS = {"NO_P2_BLOCK", "NO_P4_BLOCK", "P2_NO_CODE", "P4_NO_CODE", "SAME_CLASS_NAME"}

critical = [i for i in issues if any(t in " ".join(i["issues"]) for t in
            ["NO_P2", "NO_P4", "P2_NO_CODE", "P4_NO_CODE", "IDENTICAL", "SAME_CLASS"])]
warnings = [i for i in issues if i not in critical]

if critical:
    print("── CRITICAL ISSUES ─────────────────────────────────────────────────")
    for r in critical:
        print(f"  Q{r['id']:>4}  {r['title'][:40]:<40}  {' | '.join(r['issues'])}")

if warnings:
    print("\n── WARNINGS (ratio 0.80–0.89 or P2 too long) ───────────────────────")
    for r in warnings:
        print(f"  Q{r['id']:>4}  {r['title'][:40]:<40}  {' | '.join(r['issues'])}")

if not issues:
    print("  ✓ All questions passed — no issues found!")

print()

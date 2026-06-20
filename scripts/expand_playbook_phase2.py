#!/usr/bin/env python3
"""
Expand thin or missing PHASE 2 - BRUTE FORCE sections in the 331 playbook.

Reads:  ../leetcode/pattern_run_331_playbook.py
Writes: same file (in place) + public/playbook_data.json via generate_playbook_json.py

Run from leetcodemr/:
    python3 scripts/expand_playbook_phase2.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYBOOK = os.path.join(os.path.dirname(BASE), "leetcode", "pattern_run_331_playbook.py")
OUTPUT_JSON = os.path.join(BASE, "public", "playbook_data.json")

HEADER_RE = re.compile(
    r"# \u2500{20,}\n"
    r"# #(\d+)\s+(.+?)\n"
    r"# https?://[^\n]+\n"
    r"# \u2500{20,}"
)

PHASE2_RE = re.compile(
    r"(# PHASE 2[^\n]*\n)(.*?)(?=\n(?:class |# PHASE 3|\Z))",
    re.S,
)

TIME_RE = re.compile(r"O\([^)]+\)", re.I)


def extract_pattern(title: str) -> str:
    m = re.search(r"\(([^)]+)\)", title)
    return m.group(1).strip() if m else ""


def comment_text(line: str) -> str:
    s = line.strip()
    if not s.startswith("#"):
        return ""
    s = s[1:].strip()
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    elif s.startswith('"'):
        s = s[1:]
    return s.strip()


def phase2_comment_lines(block: str) -> list[str]:
    return [l for l in block.split("\n") if l.strip().startswith("#")]


def is_thin_phase2(block: str) -> bool:
    lines = phase2_comment_lines(block)
    if not lines:
        return True
    text = " ".join(comment_text(l) for l in lines)
    if "Let me start with brute force" in text or "Let me start with the brute force" in text:
        substantive = [l for l in lines if len(comment_text(l)) > 20]
        return len(substantive) < 3
    return len(lines) <= 3 or len(text) < 150


def parse_existing_phase2(block: str) -> tuple[str, str, str]:
    """Return (approach_text, time_part, space_part) from existing comments."""
    parts = [comment_text(l) for l in phase2_comment_lines(block) if comment_text(l)]
    full = " ".join(parts)
    times = TIME_RE.findall(full)
    time_part = times[0] if times else ""
    space_part = times[1] if len(times) > 1 else ""
    approach = full
    for t in times:
        approach = approach.replace(t, "")
    for phrase in (
        "Should I go ahead and optimize?",
        "Should I optimize?",
        "Let me start with brute force to lock in the logic.",
        "Let me start with the brute force to lock in the logic.",
        "Time:",
        "Space:",
    ):
        approach = approach.replace(phrase, "")
    approach = re.sub(r"\s+", " ", approach).strip(" .")
    return approach, time_part, space_part


def infer_from_phase3(phase3: str, pattern: str) -> tuple[str, str, str]:
    p3 = phase3.lower()
    if "fenwick" in p3 or "segment tree" in p3 or "binary indexed" in p3:
        return (
            "Store the array directly. update() sets one index in O(1). "
            "Each range query scans left..right linearly in O(n).",
            "update O(1), query O(n)",
            "O(n)",
        )
    if "prefix sum" in p3 and "hash" in p3:
        return (
            "Try every downward path starting at every node; sum values along each path "
            "and count how many equal the target.",
            "O(n^2) worst case on skewed trees",
            "O(h) recursion stack",
        )
    if "post-order" in p3 or "postorder" in p3:
        return (
            "Recompute the answer from scratch at every node - recurse on each subtree "
            "without reusing partial results from children.",
            "O(n^2) or worse when work repeats at each node",
            "O(h) stack",
        )
    if "bfs" in p3 or "level-order" in p3:
        return (
            "Use DFS from the root and explore every path explicitly instead of "
            "processing level by level with a queue.",
            "O(n) to O(n^2) depending on revisits",
            "O(h) stack",
        )
    if "hash map" in p3 or "hashmap" in p3 or "dictionary" in p3:
        return (
            "Use nested loops or sort-and-scan to find pairs/complements instead of "
            "O(1) lookups - correct but quadratic or n log n.",
            "O(n^2) or O(n log n)",
            "O(1) to O(n)",
        )
    if "two pointer" in p3 or "two-pointer" in p3:
        return (
            "Check all pairs with nested loops instead of moving two pointers inward.",
            "O(n^2)",
            "O(1)",
        )
    if "binary search" in p3:
        return (
            "Linear scan the search space one step at a time until the answer condition holds.",
            "O(n)",
            "O(1)",
        )
    if "dp" in p3 or "dynamic programming" in p3 or "memo" in p3:
        return (
            "Pure recursion trying every choice branch without memoization - "
            "recomputes identical subproblems many times.",
            "exponential without memo",
            "O(n) stack",
        )
    if "heap" in p3 or "priority queue" in p3:
        return (
            "Sort or scan the whole collection on every step instead of maintaining a heap.",
            "O(n log n) per operation",
            "O(n)",
        )
    if "Binary Search" in pattern:
        return (
            "Linear scan through the sorted array or search space until the condition is met.",
            "O(n)",
            "O(1)",
        )
    if "Trees" in pattern or "BST" in pattern:
        return (
            "Traverse the whole tree (or every path) naively and check the condition "
            "without sharing work between subtrees.",
            "O(n^2) or worse on deep paths",
            "O(h) recursion stack",
        )
    if "Graph" in pattern or "BFS" in pattern or "DFS" in pattern:
        return (
            "Explore all paths or all nodes with a straightforward traversal, "
            "possibly revisiting nodes without a visited set.",
            "O(V + E) to exponential depending on paths",
            "O(V)",
        )
    if "DP" in pattern or "Dynamic" in pattern:
        return (
            "Recursive brute force over all choices without caching sub-results.",
            "exponential",
            "O(n) stack",
        )
    return (
        "Implement the most literal reading of the problem - correct but without "
        "the optimized data structure or single-pass insight.",
        "typically O(n^2) or O(n log n)",
        "O(n) or O(1)",
    )


def build_phase2_body(
    approach: str,
    time_part: str,
    space_part: str,
    *,
    also_optimal: bool = False,
    extra_why: str = "",
) -> str:
    lines = [
        '# "Let me start with brute force to lock in the logic.',
    ]
    words = approach.split()
    chunk: list[str] = []
    for w in words:
        chunk.append(w)
        if len(" ".join(chunk)) >= 85:
            lines.append(f'#  {" ".join(chunk)}')
            chunk = []
    if chunk:
        lines.append(f'#  {" ".join(chunk)}')

    why = extra_why or (
        "That establishes correctness before we reach for a faster structure."
        if not also_optimal
        else "For this input size the brute approach is already optimal - I'll still state complexity clearly."
    )
    lines.append(f"#  {why}")

    time_str = time_part or "see analysis above"
    space_str = space_part or "O(1)"
    if also_optimal:
        lines.append(f"#  Time: {time_str}. Space: {space_str}.")
    else:
        lines.append(f"#  Time: {time_str}. Space: {space_str}.")
        lines.append('#  Should I go ahead and optimize?"')
    return "\n".join(lines) + "\n"


def expand_phase2_block(
    header: str,
    body: str,
    title: str,
    phase3: str,
) -> str | None:
    """Return new phase-2 block (header + body) or None if no change needed."""
    also_optimal = "also optimal" in header.lower()
    m = PHASE2_RE.search(body)
    pattern = extract_pattern(title)

    if m:
        if not is_thin_phase2(m.group(2)):
            return None
        approach, time_part, space_part = parse_existing_phase2(m.group(2))
        if not approach:
            approach, time_part, space_part = infer_from_phase3(phase3, pattern)
        new_body = build_phase2_body(
            approach, time_part, space_part, also_optimal=also_optimal
        )
        return header + new_body

    approach, time_part, space_part = infer_from_phase3(phase3, pattern)
    new_header = "# PHASE 2 - BRUTE FORCE"
    if also_optimal:
        new_header += " (also optimal)"
    new_header += "\n"
    new_body = build_phase2_body(
        approach, time_part, space_part, also_optimal=also_optimal
    )
    insert = new_header + new_body + "\n"
    idx = body.find("# PHASE 3")
    if idx == -1:
        idx = re.search(r"\nclass ", body)
        idx = idx.start() if idx else len(body)
    new_script = body[:idx] + insert + body[idx:]
    return new_script


def process_playbook(content: str) -> tuple[str, int]:
    matches = list(HEADER_RE.finditer(content))
    changed = 0
    out_parts: list[str] = []
    last = 0

    for i, m in enumerate(matches):
        out_parts.append(content[last : m.start()])
        qid = m.group(1)
        title = m.group(2).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        block_header = content[m.start() : m.end()]
        body = content[body_start:body_end]

        phase3_m = re.search(r"# PHASE 3[^\n]*\n(.*)", body, re.S)
        phase3 = phase3_m.group(1)[:800] if phase3_m else ""

        pm = PHASE2_RE.search(body)
        if pm and is_thin_phase2(pm.group(2)):
            new_block = expand_phase2_block(pm.group(1), body, title, phase3)
            if new_block and not new_block.startswith("# PHASE 1"):
                body = body[: pm.start()] + new_block + body[pm.end() :]
                changed += 1
                print(f"  expanded #{qid} {title[:40]}")
        elif not pm:
            new_body = expand_phase2_block("", body, title, phase3)
            if new_body and new_body != body:
                body = new_body
                changed += 1
                print(f"  inserted #{qid} {title[:40]}")

        out_parts.append(block_header)
        out_parts.append(body)
        last = body_end

    out_parts.append(content[last:])
    return "".join(out_parts), changed


def main() -> None:
    if not os.path.isfile(PLAYBOOK):
        print(f"Playbook not found: {PLAYBOOK}", file=sys.stderr)
        sys.exit(1)

    with open(PLAYBOOK, "r", encoding="utf-8") as f:
        content = f.read()

    new_content, n = process_playbook(content)
    if n == 0:
        print("No Phase 2 sections needed expansion.")
    else:
        with open(PLAYBOOK, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"\nUpdated {n} questions in {PLAYBOOK}")

    gen = os.path.join(BASE, "scripts", "generate_playbook_json.py")
    subprocess.run([sys.executable, gen], check=True)

    with open(OUTPUT_JSON, encoding="utf-8") as f:
        data = json.load(f)
    thin = 0
    for item in data.values():
        m = PHASE2_RE.search(item.get("script", ""))
        if not m or is_thin_phase2(m.group(2)):
            thin += 1
    print(f"  Remaining thin/missing Phase 2: {thin}/{len(data)}")


if __name__ == "__main__":
    main()

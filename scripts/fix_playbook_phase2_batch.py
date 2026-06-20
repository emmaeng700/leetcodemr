#!/usr/bin/env python3
"""Apply problem-specific Phase 2 overrides and fix corrupted insertions."""

from __future__ import annotations

import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYBOOK = os.path.join(os.path.dirname(BASE), "leetcode", "pattern_run_331_playbook.py")
sys.path.insert(0, os.path.join(BASE, "scripts"))
from phase2_overrides import PHASE2_OVERRIDES  # noqa: E402
from phase2_overrides_batch2 import register_batch2  # noqa: E402

register_batch2()

HEADER_RE = re.compile(
    r"# \u2500{20,}\n"
    r"# #(\d+)\s+(.+?)\n"
    r"# https?://[^\n]+\n"
    r"# \u2500{20,}"
)

CORRUPT_RE = re.compile(
    r"# PHASE 4 \u2014 CLEAN CODE# PHASE 2[^\n]*\n.*?"
    r"(?=\n(?:# PHASE 4|\nclass ))",
    re.S,
)

PHASE2_BLOCK_RE = re.compile(
    r"# PHASE 2[^\n]*\n.*?"
    r"(?=\n(?:# PHASE 3|# PHASE 4|\nclass |\Z))",
    re.S,
)


def phase2_header(also_optimal: bool = False) -> str:
    h = "# PHASE 2 \u2014 BRUTE FORCE"
    if also_optimal:
        h += " (also optimal)"
    return h + "\n"


def apply_override(body: str, qid: str, override: str) -> str:
    also_opt = "already optimal" in override.lower() or "already the optimal" in override.lower()
    new_block = phase2_header(also_opt) + override.rstrip() + "\n\n"

    corrupt = CORRUPT_RE.search(body)
    if corrupt:
        body = body[: corrupt.start()] + body[corrupt.end() :]

    m = PHASE2_BLOCK_RE.search(body)
    if m:
        return body[: m.start()] + new_block + body[m.end() :]

    # Insert after PHASE 1 block (before PHASE 3/4/class)
    for marker in ("# PHASE 3", "# PHASE 4", "\nclass "):
        idx = body.find(marker)
        if idx != -1:
            return body[:idx] + new_block + body[idx:]
    return new_block + body


def main() -> None:
    with open(PLAYBOOK, encoding="utf-8") as f:
        content = f.read()

    matches = list(HEADER_RE.finditer(content))
    out: list[str] = []
    last = 0
    changed = 0

    for i, m in enumerate(matches):
        out.append(content[last : m.start()])
        qid = m.group(1)
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        header = content[m.start() : m.end()]
        body = content[body_start:body_end]

        if qid in PHASE2_OVERRIDES:
            new_body = apply_override(body, qid, PHASE2_OVERRIDES[qid])
            if new_body != body:
                body = new_body
                changed += 1
                print(f"  fixed #{qid}")

        out.append(header)
        out.append(body)
        last = body_end

    out.append(content[last:])
    new_content = "".join(out)

    if changed:
        with open(PLAYBOOK, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"\nUpdated {changed} questions")
    else:
        print("No changes needed")

    gen = os.path.join(BASE, "scripts", "generate_playbook_json.py")
    subprocess.run([sys.executable, gen], check=True)


if __name__ == "__main__":
    main()

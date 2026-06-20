"""
Parses ../leetcode/pattern_run_331_playbook.py and writes
public/playbook_data.json  — a dict keyed by question ID (string).

Run from the leetcodemr/ directory:
    python scripts/generate_playbook_json.py

Commit the resulting public/playbook_data.json so Vercel serves it as a
static asset.  Re-run whenever you add new questions to the playbook.
"""

import re
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYBOOK = os.path.join(os.path.dirname(BASE), "leetcode", "pattern_run_331_playbook.py")
OUTPUT   = os.path.join(BASE, "public", "playbook_data.json")

with open(PLAYBOOK, "r") as f:
    content = f.read()

# Each question starts with this header block:
#   # ───────...
#   # #<ID>  <TITLE>  (<pattern>)
#   # https://...
#   # ───────...
HEADER_RE = re.compile(
    r"# ─{20,}\n"           # top divider
    r"# #(\d+)\s+(.+?)\n"   # captures: id, title+pattern
    r"# https?://[^\n]+\n"  # url line
    r"# ─{20,}"             # bottom divider
)

matches = list(HEADER_RE.finditer(content))
data = {}

for i, m in enumerate(matches):
    qid   = m.group(1)
    title = m.group(2).strip()
    body_start = m.end()
    body_end   = matches[i + 1].start() if i + 1 < len(matches) else len(content)
    body = content[body_start:body_end].strip()
    data[qid] = {"title": title, "script": body}

with open(OUTPUT, "w") as f:
    json.dump(data, f, indent=2)

print(f"✓  Wrote {len(data)} questions → {OUTPUT}")
for qid, v in data.items():
    print(f"   #{qid}  {v['title']}")

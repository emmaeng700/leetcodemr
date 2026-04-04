"""
Merges questions.json + solutions.json into one unified questions_full.json
that the FastAPI backend will serve.
"""

import json
import os
import sys

QUESTIONS_FILE = "../data/questions.json"
SOLUTIONS_FILE = "../data/solutions.json"
OUTPUT_FILE = "../data/questions_full.json"

# Pull source + difficulty from the canonical questions list
sys.path.insert(0, os.path.dirname(__file__))
from questions_list import QUESTIONS as MASTER_LIST

MASTER = {q["id"]: q for q in MASTER_LIST}


def merge():
    if not os.path.exists(QUESTIONS_FILE):
        print(f"✗ {QUESTIONS_FILE} not found — run scrape_doocs.py first")
        return

    if not os.path.exists(SOLUTIONS_FILE):
        print(f"✗ {SOLUTIONS_FILE} not found — run scrape_solutions.py first")
        return

    with open(QUESTIONS_FILE) as f:
        questions = {q["id"]: q for q in json.load(f)}

    with open(SOLUTIONS_FILE) as f:
        solutions = {s["id"]: s for s in json.load(f) if s}

    merged = []
    for qid, q in questions.items():
        sol = solutions.get(qid, {})
        master = MASTER.get(qid, {})
        merged.append({
            **q,
            # Override with canonical difficulty + tags + source from questions_list
            "difficulty": master.get("difficulty", q.get("difficulty", "")),
            "tags": master.get("tags", q.get("tags", [])),
            "source": master.get("source", []),
            "python_solution": sol.get("python", ""),
            "cpp_solution": sol.get("cpp", ""),
            "explanation": sol.get("explanation", ""),
            "solution_url": sol.get("url", ""),
        })

    # Sort by LeetCode ID
    merged.sort(key=lambda x: x["id"])

    with open(OUTPUT_FILE, "w") as f:
        json.dump(merged, f, indent=2)

    print(f"✅ Merged {len(merged)} questions → {OUTPUT_FILE}")
    missing_py = sum(1 for q in merged if not q["python_solution"])
    missing_cpp = sum(1 for q in merged if not q["cpp_solution"])
    print(f"   Missing Python solutions: {missing_py}")
    print(f"   Missing C++ solutions:    {missing_cpp}")


if __name__ == "__main__":
    merge()

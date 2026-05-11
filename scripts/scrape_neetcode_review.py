#!/usr/bin/env python3
import json
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.append(str(SCRIPT_DIR))

from scrape_simplyleet_sections import scrape_one


PROJECT_ROOT = Path(__file__).resolve().parents[1]
NEETCODE_FILE = PROJECT_ROOT / "src" / "lib" / "neetcode150.ts"
OUTPUT_FILE = PROJECT_ROOT / "public" / "neetcodereview.json"


def load_neetcode_categories() -> list[dict]:
    script = f"""
const fs = require('fs');
const vm = require('vm');
let src = fs.readFileSync({json.dumps(str(NEETCODE_FILE))}, 'utf8');
src = src.replace(/export type[\\s\\S]*?}}\\n\\n/g, '');
src = src.replace(/export const ALL_NC150_IDS[\\s\\S]*/g, '');
src = src.replace(/export const NEETCODE_150:\\s*NC150Category\\[\\]\\s*=\\s*/, 'const NEETCODE_150 = ');
const sandbox = {{}};
vm.createContext(sandbox);
vm.runInContext(src + '\\nthis.out = NEETCODE_150;', sandbox);
process.stdout.write(JSON.stringify(sandbox.out));
"""
    output = subprocess.check_output(["node", "-e", script], text=True)
    return json.loads(output)


def load_existing() -> dict[int, dict]:
    if not OUTPUT_FILE.exists():
        return {}
    payload = json.loads(OUTPUT_FILE.read_text())
    found: dict[int, dict] = {}
    for category in payload:
        for question in category.get("questions", []):
            found[question["id"]] = question
    return found


def save_categories(categories: list[dict]) -> None:
    OUTPUT_FILE.write_text(json.dumps(categories, indent=2, ensure_ascii=False) + "\n")


def run() -> None:
    import requests

    categories = load_neetcode_categories()
    existing = load_existing()
    total = sum(len(category["questions"]) for category in categories)
    done = 0

    with requests.Session() as session:
        for category in categories:
            enriched_questions = []
            for question in category["questions"]:
                done += 1
                if question["id"] in existing:
                    print(f"[{done}/{total}] Skipping {question['title']} (cached)")
                    enriched_questions.append(existing[question["id"]])
                    continue

                print(f"[{done}/{total}] Scraping {question['title']}...")
                scraped = scrape_one(session, question)
                merged = {
                    "id": question["id"],
                    "title": question["title"],
                    "slug": question["slug"],
                    "difficulty": question["difficulty"],
                    "acceptance": question["acceptance"],
                    **scraped,
                }
                enriched_questions.append(merged)
                existing[question["id"]] = merged

                partial = []
                for cat in categories:
                    qs = []
                    for q in cat["questions"]:
                        cached = next((item for item in enriched_questions if item["id"] == q["id"]), None)
                        if cached:
                            qs.append(cached)
                        elif q["id"] in existing:
                            qs.append(existing[q["id"]])
                    partial.append({
                        "name": cat["name"],
                        "emoji": cat["emoji"],
                        "color": cat["color"],
                        "questions": qs,
                    })
                save_categories(partial)
                print("  saved")
                time.sleep(0.75)

            category["questions"] = enriched_questions

    save_categories(categories)
    print(f"\nDone. Saved {total} questions to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()

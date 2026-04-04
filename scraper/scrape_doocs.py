"""
Scraper: leetcode.doocs.org — fetches question content (description, examples, constraints)
"""

import requests
import time
import json
import re
import os
from bs4 import BeautifulSoup
from questions_list import QUESTIONS

BASE_URL = "https://leetcode.doocs.org"
OUTPUT_FILE = "../data/questions.json"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def build_doocs_url(q: dict) -> str:
    """Build doocs URL for a question.
    Format: https://leetcode.doocs.org/en/lc/1/
    """
    return f"{BASE_URL}/en/lc/{q['id']}/"


def scrape_question(q: dict) -> dict | None:
    url = build_doocs_url(q)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"  ✗ {q['title']} → HTTP {resp.status_code} | {url}")
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract difficulty from question data (already in questions_list.py)
        difficulty = q.get("difficulty", "")

        # Extract description — main article content, stop before Solutions section
        article = soup.find("article") or soup.find("main") or soup.find("div", class_=re.compile(r"content|description", re.I))
        description = ""
        if article:
            full_text = article.get_text(separator="\n", strip=True)
            lines = full_text.split("\n")
            desc_lines = []
            for line in lines:
                if re.match(r"^solutions?\s*$", line, re.I):
                    break
                desc_lines.append(line)
            description = "\n".join(l for l in desc_lines if l).strip()

        # Extract topic tags from .md-tag elements
        tags = [t.get_text(strip=True) for t in soup.find_all(class_="md-tag") if t.get_text(strip=True)]
        # Fall back to tags from questions_list if page has none
        if not tags:
            tags = q.get("tags", [])

        print(f"  ✓ {q['title']} ({len(description)} chars)")
        return {
            "id": q["id"],
            "title": q["title"],
            "slug": q["slug"],
            "difficulty": difficulty,
            "description": description,
            "tags": list(set(tags)),
            "url": url,
            "doocs_url": url,
        }

    except Exception as e:
        print(f"  ✗ {q['title']} → Error: {e}")
        return None


def run():
    results = []
    # Load existing data to resume interrupted runs
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            results = json.load(f)
        existing_ids = {r["id"] for r in results}
        print(f"Resuming — {len(existing_ids)} already scraped")
    else:
        existing_ids = set()

    total = len(QUESTIONS)
    for i, q in enumerate(QUESTIONS, 1):
        if q["id"] in existing_ids:
            print(f"[{i}/{total}] Skipping {q['title']} (cached)")
            continue

        print(f"[{i}/{total}] Scraping {q['title']}...")
        result = scrape_question(q)
        if result:
            results.append(result)

        # Save progress after each question
        with open(OUTPUT_FILE, "w") as f:
            json.dump(results, f, indent=2)

        # Be polite — 1.5s delay between requests
        time.sleep(1.5)

    print(f"\n✅ Done! {len(results)}/{total} questions saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()

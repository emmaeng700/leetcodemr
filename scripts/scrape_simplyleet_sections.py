#!/usr/bin/env python3
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


PROJECT_ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = PROJECT_ROOT / "public" / "questions_full.json"
OUTPUT_FILE = PROJECT_ROOT / "public" / "simplyleet_sections.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

SECTION_NAMES = {
    "key insights": "key_insights",
    "space and time complexity": "space_and_time_complexity",
    "solution": "solution",
}


def load_questions() -> list[dict]:
    return json.loads(QUESTIONS_FILE.read_text())


def load_existing() -> list[dict]:
    if not OUTPUT_FILE.exists():
        return []
    return json.loads(OUTPUT_FILE.read_text())


def title_slug(title: str) -> str:
    slug = title.lower()
    slug = slug.replace("&", " and ")
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-")


def normalize_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\r", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text_from_tag(tag: Tag) -> str:
    if tag.name in {"ul", "ol"}:
        items = []
        for li in tag.find_all("li", recursive=False):
            text = normalize_text(li.get_text("\n", strip=True))
            if text:
                items.append(f"- {text}")
        return "\n".join(items)
    return normalize_text(tag.get_text("\n", strip=True))


def collect_section_text(heading: Tag) -> str:
    chunks: list[str] = []
    for sibling in heading.next_siblings:
        if isinstance(sibling, NavigableString):
            text = normalize_text(str(sibling))
            if text and text != "* * *":
                chunks.append(text)
            continue
        if not isinstance(sibling, Tag):
            continue
        if sibling.name in {"h1", "h2", "h3", "h4"}:
            break
        if sibling.name == "hr":
            continue
        text = extract_text_from_tag(sibling)
        if text and text != "* * *":
            chunks.append(text)
    return normalize_text("\n\n".join(chunks))


def extract_sections(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    found = {value: "" for value in SECTION_NAMES.values()}

    for heading in soup.find_all(["h2", "h3"]):
        key = normalize_text(heading.get_text(" ", strip=True)).lower()
        if key in SECTION_NAMES and not found[SECTION_NAMES[key]]:
            found[SECTION_NAMES[key]] = collect_section_text(heading)

    return found


def candidate_urls(question: dict) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    for value in (
        question.get("solution_url"),
        f"https://www.simplyleet.com/{question['slug']}",
        f"https://www.simplyleet.com/{title_slug(question['title'])}",
    ):
        if value and value not in seen:
            candidates.append(value)
            seen.add(value)

    return candidates


def scrape_one(session: requests.Session, question: dict) -> dict:
    last_error: Exception | None = None
    best_url = candidate_urls(question)[0]
    sections = {value: "" for value in SECTION_NAMES.values()}

    for url in candidate_urls(question):
        best_url = url
        try:
            response = session.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
            sections = extract_sections(response.text)
            if any(sections.values()):
                break
        except Exception as exc:
            last_error = exc
            continue

    if not any(sections.values()) and last_error is not None:
        raise last_error

    return {
        "id": question["id"],
        "title": question["title"],
        "slug": question["slug"],
        "solution_url": best_url,
        **sections,
    }


def save_results(results: list[dict]) -> None:
    OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")


def run() -> None:
    questions = load_questions()
    results = load_existing()
    existing_by_id = {entry["id"]: entry for entry in results}

    with requests.Session() as session:
        total = len(questions)
        for index, question in enumerate(questions, start=1):
            if question["id"] in existing_by_id:
                print(f"[{index}/{total}] Skipping {question['title']} (cached)")
                continue

            print(f"[{index}/{total}] Scraping {question['title']}...")
            try:
                entry = scrape_one(session, question)
                results.append(entry)
                existing_by_id[entry["id"]] = entry
                save_results(results)
                missing = [
                    field
                    for field in ("key_insights", "space_and_time_complexity", "solution")
                    if not entry.get(field)
                ]
                if missing:
                    print(f"  saved with missing fields: {', '.join(missing)}")
                else:
                    print("  saved")
            except Exception as exc:
                error_entry = {
                    "id": question["id"],
                    "title": question["title"],
                    "slug": question["slug"],
                    "solution_url": candidate_urls(question)[0],
                    "key_insights": "",
                    "space_and_time_complexity": "",
                    "solution": "",
                    "error": str(exc),
                }
                results.append(error_entry)
                existing_by_id[question["id"]] = error_entry
                save_results(results)
                print(f"  failed: {exc}")

            time.sleep(0.75)

    results.sort(key=lambda item: item["id"])
    save_results(results)
    print(f"\nDone. Saved {len(results)} entries to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()

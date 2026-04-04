"""
Scraper: simplyleet.com — fetches Python + C++ solutions.

Uses the Next.js RSC stream (RSC: 1 header) which returns the full page
data as a streaming protocol. This includes all tab content (Python, C++, etc.)
even though the browser renders them client-side via tabs.
"""

import requests
import time
import json
import re
import os
from bs4 import BeautifulSoup
from questions_list import QUESTIONS

BASE_URL = "https://www.simplyleet.com"
OUTPUT_FILE = "../data/solutions.json"

HEADERS_HTML = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

HEADERS_RSC = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "RSC": "1",          # tell Next.js to return the raw RSC stream
    "Accept": "text/html,application/xhtml+xml",
}


# ── RSC stream parser ──────────────────────────────────────────────────────────

def _parse_rsc(data: bytes) -> dict:
    """
    Parse a Next.js RSC binary stream into a {hex_ref_id: content} map.
    T-type entries (T{hex_len},{raw_bytes}) are read using their byte length,
    so multi-line code blocks are captured correctly.
    """
    ref_map: dict[str, str] = {}
    pos = 0
    length = len(data)

    while pos < length:
        # Skip blank lines
        if data[pos:pos + 1] == b"\n":
            pos += 1
            continue

        # Find colon that separates ref_id from value
        colon = data.find(b":", pos)
        if colon == -1 or colon > pos + 20:    # ref IDs are short hex strings
            pos += 1
            continue

        ref_id = data[pos:colon].decode("ascii", errors="ignore").strip()
        val_pos = colon + 1

        if val_pos < length and data[val_pos:val_pos + 1] == b"T":
            # T-type: T{hex_length},{content}
            comma = data.find(b",", val_pos)
            if comma == -1:
                pos = val_pos + 1
                continue
            try:
                byte_len = int(data[val_pos + 1:comma].decode("ascii"), 16)
            except ValueError:
                pos = val_pos + 1
                continue
            content = data[comma + 1: comma + 1 + byte_len].decode("utf-8", errors="replace")
            ref_map[ref_id] = content
            pos = comma + 1 + byte_len
        else:
            # Regular single-line value
            nl = data.find(b"\n", val_pos)
            if nl == -1:
                ref_map[ref_id] = data[val_pos:].decode("utf-8", errors="ignore")
                break
            ref_map[ref_id] = data[val_pos:nl].decode("utf-8", errors="ignore")
            pos = nl + 1

    return ref_map


def _extract_codes_from_rsc(data: bytes) -> dict:
    """
    Given a raw RSC stream, extract Python + C++ solutions.
    Uses regex on each "language":"x","code":"..." pair so that
    brackets/braces inside code strings don't break the parser.
    Resolves $hex RSC references via ref_map.
    """
    result = {"python": "", "cpp": ""}
    ref_map = _parse_rsc(data)
    text = data.decode("utf-8", errors="replace")

    # Match each {"language":"x","code":"..."} pair
    # The code value is either an inline JSON string or a "$hex" RSC ref
    pattern = re.compile(
        r'"language"\s*:\s*"(\w+)"\s*,\s*"code"\s*:\s*"((?:[^"\\]|\\.)*)"'
    )
    ref_pattern = re.compile(r"^\$([0-9a-f]+)$")

    for m in pattern.finditer(text):
        lang = m.group(1).lower()
        raw_code = m.group(2)

        # Resolve RSC reference ($15 → ref_map["15"])
        ref_m = ref_pattern.match(raw_code)
        if ref_m:
            code = ref_map.get(ref_m.group(1), "")
        else:
            # Unescape JSON string escapes in inline code
            code = (raw_code
                    .replace("\\n", "\n")
                    .replace("\\t", "\t")
                    .replace('\\"', '"')
                    .replace("\\\\", "\\"))

        code = code.strip()

        if lang == "python" and not result["python"]:
            result["python"] = code
        elif lang == "cpp" and not result["cpp"]:
            result["cpp"] = code

    return result


# ── Explanation extractor ──────────────────────────────────────────────────────

def _extract_explanation(soup: BeautifulSoup) -> str:
    for selector in ["explanation", "solution-explanation", "approach"]:
        el = soup.find(class_=re.compile(selector, re.I))
        if el:
            return el.get_text(separator="\n", strip=True)[:800]
    for h in soup.find_all(["h2", "h3"]):
        text = h.get_text(strip=True).lower()
        if any(k in text for k in ["approach", "insight", "intuition", "solution"]):
            sib = h.find_next_sibling(["p", "div"])
            if sib:
                return sib.get_text(separator="\n", strip=True)[:800]
    return ""


# ── Main scrape function ───────────────────────────────────────────────────────

def scrape_solution(q: dict) -> dict | None:
    slug = q["slug"]
    url = f"{BASE_URL}/{slug}"

    try:
        # First check that the page exists (plain HTML request)
        resp_html = requests.get(url, headers=HEADERS_HTML, timeout=15)

        if resp_html.status_code == 404:
            # Try a title-derived slug
            alt_slug = (
                q["title"].lower()
                .replace(" ", "-")
                .replace("'", "")
                .replace("(", "")
                .replace(")", "")
            )
            url = f"{BASE_URL}/{alt_slug}"
            resp_html = requests.get(url, headers=HEADERS_HTML, timeout=15)

        if resp_html.status_code != 200:
            print(f"  ✗ {q['title']} → HTTP {resp_html.status_code}")
            return {
                "id": q["id"], "title": q["title"], "slug": slug,
                "python": "", "cpp": "", "explanation": "", "url": url,
            }

        # Explanation from visible HTML
        soup = BeautifulSoup(resp_html.text, "html.parser")
        explanation = _extract_explanation(soup)

        # Fetch RSC stream for full code data (includes C++ which is tab-lazy)
        resp_rsc = requests.get(url, headers=HEADERS_RSC, timeout=15)
        codes = _extract_codes_from_rsc(resp_rsc.content)

        has_py = bool(codes["python"])
        has_cpp = bool(codes["cpp"])
        print(f"  ✓ {q['title']} | Python: {'✓' if has_py else '✗'} | C++: {'✓' if has_cpp else '✗'}")

        return {
            "id": q["id"],
            "title": q["title"],
            "slug": slug,
            "python": codes["python"],
            "cpp": codes["cpp"],
            "explanation": explanation,
            "url": url,
        }

    except Exception as e:
        print(f"  ✗ {q['title']} → Error: {e}")
        return None


# ── Runner ─────────────────────────────────────────────────────────────────────

def run():
    results = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            results = json.load(f)
        existing_ids = {r["id"] for r in results if r}
        print(f"Resuming — {len(existing_ids)} already scraped")
    else:
        existing_ids = set()

    total = len(QUESTIONS)
    for i, q in enumerate(QUESTIONS, 1):
        if q["id"] in existing_ids:
            print(f"[{i}/{total}] Skipping {q['title']} (cached)")
            continue

        print(f"[{i}/{total}] Scraping solutions: {q['title']}...")
        result = scrape_solution(q)
        if result:
            results.append(result)

        with open(OUTPUT_FILE, "w") as f:
            json.dump(results, f, indent=2)

        time.sleep(2)   # polite delay (2 requests per question)

    print(f"\n✅ Done! Solutions saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()

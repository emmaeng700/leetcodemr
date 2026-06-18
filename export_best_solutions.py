"""
Export best solutions for all solved questions:
  - Pinned solutions come from the `best_solutions` Supabase table
  - For solved questions without a pin, the latest accepted LC submission is fetched live
  - Output: one .py file on the Desktop with every solution

Run:  python3 export_best_solutions.py
"""

import json, os, sys, time, requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://azrokoorufejfoeddzrw.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cm9rb29ydWZlamZvZWRkenJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjcyMjIsImV4cCI6MjA4OTkwMzIyMn0."
    "AlmIGVNfPs7Cl482eLpl_hkkhFmMKPj63QNVXbvEDvw"
)
USER_ID    = "emmanuel"
QUESTIONS_JSON = os.path.join(os.path.dirname(__file__), "public", "questions_full.json")
DESKTOP    = os.path.expanduser("~/Desktop")
LC_GRAPHQL = "https://leetcode.com/graphql"

SB_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}


# ── Supabase helpers ──────────────────────────────────────────────────────────
def sb_get(table, params=""):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?user_id=eq.{USER_ID}{params}",
                     headers=SB_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_lc_session():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/user_settings?user_id=eq.{USER_ID}&select=lc_session,lc_csrf",
        headers=SB_HEADERS, timeout=10)
    r.raise_for_status()
    rows = r.json()
    if not rows:
        return "", ""
    row = rows[0]
    return row.get("lc_session", ""), row.get("lc_csrf", "")


def fetch_solved_question_ids():
    rows = sb_get("progress", "&solved=eq.true&select=question_id")
    return {int(r["question_id"]) for r in rows}


def fetch_pinned_solutions():
    rows = sb_get("best_solutions", "&order=question_id.asc&select=question_id,language,code,updated_at")
    return {int(r["question_id"]): r for r in rows}


# ── LeetCode API ──────────────────────────────────────────────────────────────
def lc_headers(session, csrf):
    cookie = f"LEETCODE_SESSION={session}; csrftoken={csrf}"
    return {
        "Content-Type":  "application/json",
        "Cookie":        cookie,
        "Referer":       "https://leetcode.com/",
        "x-csrftoken":   csrf,
    }


def fetch_latest_ac_submission(slug, session, csrf, lang="python3"):
    """Return (lang, code) of the most recent accepted submission, or (None, None)."""
    headers = lc_headers(session, csrf)

    # Step 1: list recent AC submissions
    q1 = """
    query($slug:String!,$offset:Int!,$limit:Int!){
      questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){
        submissions{ id lang timestamp }
      }
    }"""
    try:
        r1 = requests.post(LC_GRAPHQL, json={"query": q1,
                           "variables": {"slug": slug, "offset": 0, "limit": 20}},
                           headers=headers, timeout=15)
        subs = r1.json().get("data", {}).get("questionSubmissionList", {}).get("submissions", [])
    except Exception as e:
        print(f"    ✗ {slug}: submission list error — {e}")
        return None, None

    if not subs:
        return None, None

    # Prefer python3, then python, then first available
    chosen = next((s for s in subs if s["lang"] == "python3"), None)
    if not chosen:
        chosen = next((s for s in subs if s["lang"] == "python"), None)
    if not chosen:
        chosen = subs[0]

    # Step 2: fetch the code
    q2 = "query($id:Int!){submissionDetails(submissionId:$id){code}}"
    try:
        r2 = requests.post(LC_GRAPHQL, json={"query": q2,
                           "variables": {"id": int(chosen["id"])}},
                           headers=headers, timeout=15)
        code = r2.json().get("data", {}).get("submissionDetails", {}).get("code", "")
    except Exception as e:
        print(f"    ✗ {slug}: code fetch error — {e}")
        return None, None

    return chosen["lang"], code


# ── Formatting ────────────────────────────────────────────────────────────────
LANG_COMMENT = {
    "python3": "#", "python": "#",
    "cpp": "//", "java": "//", "javascript": "//", "typescript": "//",
    "go": "//", "rust": "//", "swift": "//", "kotlin": "//",
    "c": "//", "csharp": "//",
}

def format_block(qid, title, diff, lang, code, source, updated=""):
    c  = LANG_COMMENT.get(lang, "#")
    ts = f"   Saved: {updated[:10]}" if updated else ""
    return (
        f"\n{c} {'─'*70}\n"
        f"{c} #{qid}  {title}\n"
        f"{c} Difficulty: {diff}   Language: {lang}   Source: {source}{ts}\n"
        f"{c} {'─'*70}\n"
        f"{code.strip()}\n"
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading questions metadata…")
    with open(QUESTIONS_JSON, encoding="utf-8") as f:
        q_map = {q["id"]: q for q in json.load(f)}

    print("Fetching solved question IDs from Supabase…")
    solved_ids = fetch_solved_question_ids()
    print(f"  {len(solved_ids)} questions marked solved in app")

    print("Fetching pinned (saved) solutions…")
    pinned = fetch_pinned_solutions()
    print(f"  {len(pinned)} pinned solutions")

    print("Fetching LeetCode session…")
    lc_session, lc_csrf = fetch_lc_session()
    if not lc_session:
        print("  ⚠  No LeetCode session found — only pinned solutions will be exported.")
        print("     Go to Settings → paste your LC session to enable live fetch.")

    # IDs to live-fetch = solved but not pinned
    to_fetch = sorted(solved_ids - set(pinned.keys()))
    print(f"  {len(to_fetch)} questions need live LC fetch")

    blocks = []

    # 1. Pinned solutions (guaranteed)
    for qid, sol in sorted(pinned.items()):
        q    = q_map.get(qid, {})
        code = sol.get("code", "").strip()
        if not code:
            continue
        blocks.append(format_block(
            qid, q.get("title", f"Q{qid}"), q.get("difficulty", ""),
            sol.get("language", "python3"), code,
            "pinned", sol.get("updated_at", "")))

    # 2. Live LC submissions for the rest
    if lc_session and to_fetch:
        print(f"\nFetching live submissions for {len(to_fetch)} questions…")
        for i, qid in enumerate(to_fetch, 1):
            q    = q_map.get(qid, {})
            slug = q.get("slug", "")
            if not slug:
                print(f"  [{i}/{len(to_fetch)}] #{qid} — no slug, skipping")
                continue
            print(f"  [{i}/{len(to_fetch)}] #{qid} {q.get('title', '')}…", end=" ", flush=True)
            lang, code = fetch_latest_ac_submission(slug, lc_session, lc_csrf)
            if code:
                blocks.append(format_block(
                    qid, q.get("title", f"Q{qid}"), q.get("difficulty", ""),
                    lang, code, "leetcode-live"))
                print("✓")
            else:
                print("no AC submission found")
            time.sleep(0.3)  # polite rate-limit

    if not blocks:
        print("\nNo solutions to export.")
        sys.exit(0)

    # Write output
    date  = datetime.now().strftime("%Y-%m-%d")
    fpath = os.path.join(DESKTOP, f"leetmastery_solutions_{date}.py")
    header = (
        f"# LeetMastery — Best Solutions Export\n"
        f"# Date: {date}   Total: {len(blocks)} solution(s)\n"
        f"# {'═'*68}\n"
    )
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(header)
        for b in blocks:
            f.write(b + "\n")

    print(f"\n✓ {len(blocks)} solutions saved to ~/Desktop/leetmastery_solutions_{date}.py")


if __name__ == "__main__":
    main()

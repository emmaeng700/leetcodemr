"""
LeetMastery — Better PDF (2×1 landscape with smart ← Contents + solution checkboxes)
======================================================================================
Same study-order content as generate_study_order_pdf.py, with two additions:
  1. ← Contents on each question sheet returns to that question's exact TOC position.
     Two buttons per sheet (one per cell/slot) each targeting its question's entry.
  2. Each solution label (● WalkCC, ● LeetDoocs, ● SimplyLeet, ● LC.ca) on question
     pages gets an AcroForm checkbox so you can mark which solutions you've studied.

Output: better.pdf  (always 2×1 landscape)

Usage:
  python3 generate_better_pdf.py
"""

import json, re, sys, time, requests
from pathlib import Path

LANDSCAPE    = False
GRID_4X4     = False
GRID_2X2     = False
GRID_2X1     = True   # always 2×1
GRID_6X4     = False
CHAPTER2_PDF   = '--chapter2'   in sys.argv
MODE_NC150     = '--neetcode'   in sys.argv
MODE_AM600     = '--am600'      in sys.argv
MODE_NC_EXTRA  = '--nc-extra'   in sys.argv   # 32 NC150 questions not in Set 1
MODE_AM_EXTRA  = '--am-extra'   in sys.argv   # 344 AM600 questions not in Set 1 or NC150
MODE_ALL727    = '--all'        in sys.argv   # All 727 questions (Set 1 + 2 + 3)
FORCE_REFRESH_SOLS = '--refresh-solutions' in sys.argv  # Clear cache, re-fetch all

# ─── Font registration ────────────────────────────────────────────────────────
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
_LG = "/System/Library/Fonts/LucidaGrande.ttc"
_MN = "/System/Library/Fonts/Menlo.ttc"
try:
    pdfmetrics.registerFont(TTFont("LG",        _LG, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("LG-Bold",   _LG, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("Menlo",      _MN, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Menlo-Bold", _MN, subfontIndex=1))
except Exception:
    pass

from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, SimpleDocTemplate, Image as RLImage, Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

import fitz  # PyMuPDF

# ─── Reuse helpers from the main generator ───────────────────────────────────
from generate_patterns_pdf import (
    QUICK_PATTERNS,
    _inline,
    _clean_code,
    download_image,
    _img_filename,
    IMG_DIR,
    gen_brute_force_python,
    get_question_desc_html,
    is_html_description,
    is_premium_question,
    plain_desc_to_paragraphs,
    premium_question_prefix,
    premium_question_suffix,
    premium_star_markup,
    repair_doocs_cache,
    SITES,
    _QR_DATA,
)

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR        = Path(__file__).parent
QUESTIONS         = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE       = SCRIPT_DIR / ".full_langs_cache.json"
DOOCS_CACHE       = SCRIPT_DIR / ".doocs_cache.json"
PLAYBOOK_PATH     = SCRIPT_DIR / "public" / "playbook_data.json"
_SOLUTIONS_CACHE  = SCRIPT_DIR / ".my_solutions_cache.json"
EDITORIAL_CACHE   = SCRIPT_DIR / ".editorial_cache.json"
EDITORIAL_MANUAL  = SCRIPT_DIR / ".editorial_manual.json"

_EDITORIAL: dict = (
    json.loads(EDITORIAL_CACHE.read_text()) if EDITORIAL_CACHE.exists() else {}
)
def _load_editorial_manual(path) -> dict:
    """Load .editorial_manual.json robustly — bad JSON or bad code never crashes the build."""
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding='utf-8')
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    out = {}
    for qid, entry in data.items():
        if not isinstance(entry, dict):
            continue
        code = entry.get('editorial_code', '')
        if not isinstance(code, str):
            code = ''
        code = code.replace('\r\n', '\n').replace('\r', '\n').strip().rstrip('"\'').strip()
        out[qid] = {**entry, 'editorial_code': code}
    return out

_EDITORIAL_MANUAL: dict = _load_editorial_manual(EDITORIAL_MANUAL)


# Load interview approach scripts keyed by question ID (string)
_PLAYBOOK: dict = (
    json.loads(PLAYBOOK_PATH.read_text()) if PLAYBOOK_PATH.exists() else {}
)
if MODE_ALL727:
    _ALL_PB = SCRIPT_DIR / 'public' / 'playbook_data_all.json'
    if _ALL_PB.exists():
        _PLAYBOOK.update(json.loads(_ALL_PB.read_text()))

# ─── My LeetCode Solution loader ─────────────────────────────────────────────
_SB_URL  = "https://azrokoorufejfoeddzrw.supabase.co"
_SB_KEY  = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cm9rb29ydWZlamZvZWRkenJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjcyMjIsImV4cCI6MjA4OTkwMzIyMn0."
    "AlmIGVNfPs7Cl482eLpl_hkkhFmMKPj63QNVXbvEDvw"
)
_SB_HDRS = {"apikey": _SB_KEY, "Authorization": f"Bearer {_SB_KEY}"}
_LC_GQL  = "https://leetcode.com/graphql"
_USER_ID = "emmanuel"


def _sb_get(table, params=""):
    r = requests.get(f"{_SB_URL}/rest/v1/{table}?user_id=eq.{_USER_ID}{params}",
                     headers=_SB_HDRS, timeout=15)
    r.raise_for_status()
    return r.json()


def _lc_headers(session, csrf):
    return {
        "Content-Type": "application/json",
        "Cookie":       f"LEETCODE_SESSION={session}; csrftoken={csrf}",
        "Referer":      "https://leetcode.com/",
        "x-csrftoken":  csrf,
    }


def _fetch_latest_ac(slug, session, csrf):
    """Return (submission_id, lang) of the most recent accepted submission, or (None, None).
    One GraphQL call — does NOT fetch code."""
    q = """query($slug:String!,$offset:Int!,$limit:Int!){
      questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){
        submissions{ id lang }
      }
    }"""
    try:
        r = requests.post(_LC_GQL,
                          json={"query": q, "variables": {"slug": slug, "offset": 0, "limit": 20}},
                          headers=_lc_headers(session, csrf), timeout=15)
        subs = r.json().get("data", {}).get("questionSubmissionList", {}).get("submissions", [])
    except Exception:
        return None, None
    if not subs:
        return None, None
    chosen = (next((s for s in subs if s["lang"] == "python3"), None)
              or next((s for s in subs if s["lang"] == "python"), None)
              or subs[0])
    return str(chosen["id"]), chosen["lang"]


def _fetch_submission_code(sub_id, session, csrf):
    """Fetch code for a known submission ID. One GraphQL call."""
    q = "query($id:Int!){submissionDetails(submissionId:$id){code}}"
    try:
        r = requests.post(_LC_GQL,
                          json={"query": q, "variables": {"id": int(sub_id)}},
                          headers=_lc_headers(session, csrf), timeout=15)
        return r.json().get("data", {}).get("submissionDetails", {}).get("code", "")
    except Exception:
        return None


def _fetch_ac_submission(slug, session, csrf):
    """Return (lang, code) of the most recent accepted LC submission, or (None, None)."""
    sub_id, lang = _fetch_latest_ac(slug, session, csrf)
    if sub_id is None:
        return None, None
    code = _fetch_submission_code(sub_id, session, csrf)
    return lang, code


_SOLUTIONS_JSON = SCRIPT_DIR / "my_solutions.json"   # full scraped solutions with metadata


def _lc_ac_questions(session: str, csrf: str) -> list:
    """Return list of {qid, slug, title} for every AC'd question, slugs from LC directly."""
    r = requests.get(
        "https://leetcode.com/api/problems/all/",
        headers={
            "Cookie": f"LEETCODE_SESSION={session}; csrftoken={csrf}",
            "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0.0.0 Safari/537.36"),
            "Referer": "https://leetcode.com/",
            "x-csrftoken": csrf,
        },
        timeout=30,
    )
    r.raise_for_status()
    out = []
    for p in r.json().get("stat_status_pairs", []):
        if p.get("status") == "ac":
            out.append({
                "qid":   int(p["stat"]["frontend_question_id"]),
                "slug":  p["stat"]["question__title_slug"],
                "title": p["stat"]["question__title"],
            })
    return sorted(out, key=lambda x: x["qid"])


def scrape_solutions_to_json(session: str, csrf: str, force: bool = False) -> dict:
    """Scrape ALL accepted LC submissions → my_solutions.json.
    Returns {str(qid): {qid, slug, title, lang, code, submission_id}}.
    For cached questions, checks whether a newer submission exists before skipping."""
    print("Scraping all LeetCode accepted solutions…")

    existing: dict = {}
    if not force and _SOLUTIONS_JSON.exists():
        try:
            existing = json.loads(_SOLUTIONS_JSON.read_text())
            print(f"  {len(existing)} already in my_solutions.json")
        except Exception:
            existing = {}
    elif force:
        print("  force=True — re-fetching everything from scratch")

    ac_qs = _lc_ac_questions(session, csrf)
    print(f"  {len(ac_qs)} questions AC'd on LeetCode")

    result = dict(existing)
    newly_fetched, updated, failed = 0, 0, []

    for i, q in enumerate(ac_qs, 1):
        key = str(q["qid"])

        if key in result and not force:
            # Check whether a newer submission has been made since we cached this entry.
            cached_sub_id = result[key].get("submission_id")
            latest_sub_id, latest_lang = _fetch_latest_ac(q["slug"], session, csrf)
            time.sleep(0.35)
            if latest_sub_id is None:
                # Can't reach LC for this question — keep the cached version.
                continue
            if cached_sub_id and str(latest_sub_id) == str(cached_sub_id):
                continue  # Same submission as before — nothing to do.
            # A newer (or previously untracked) submission exists — fetch its code.
            code = _fetch_submission_code(latest_sub_id, session, csrf)
            if code:
                result[key] = {"qid": q["qid"], "slug": q["slug"],
                               "title": q["title"], "lang": latest_lang,
                               "code": code, "submission_id": str(latest_sub_id)}
                updated += 1
            time.sleep(0.35)
        else:
            # New question not yet in cache — fetch submission ID + code together.
            sub_id, lang = _fetch_latest_ac(q["slug"], session, csrf)
            time.sleep(0.35)
            if sub_id:
                code = _fetch_submission_code(sub_id, session, csrf)
                if code:
                    result[key] = {"qid": q["qid"], "slug": q["slug"],
                                   "title": q["title"], "lang": lang,
                                   "code": code, "submission_id": str(sub_id)}
                    newly_fetched += 1
                else:
                    failed.append(q)
            else:
                failed.append(q)
            time.sleep(0.35)

        if i % 10 == 0:
            print(f"    {i}/{len(ac_qs)} processed… ({newly_fetched} new, {updated} updated)")
            _SOLUTIONS_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2))

    _SOLUTIONS_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"  {newly_fetched} newly fetched · {updated} updated · {len(result)} total → my_solutions.json")
    if failed:
        print(f"  ⚠ {len(failed)} questions returned no code from LC:")
        for f in failed:
            print(f"    #{f['qid']:4d}  {f['title']}  ({f['slug']})")
    return result


def load_my_solutions() -> dict:
    """Return {qid: (lang, code)}.
    Scrapes all accepted submissions to my_solutions.json first, then loads from it."""
    print("Loading my LeetCode solutions…")

    # Pinned / curated solutions from Supabase best_solutions
    try:
        pinned_rows = _sb_get("best_solutions",
                              "&order=question_id.asc&select=question_id,language,code")
        pinned = {int(r["question_id"]): (r.get("language", "python3"), r.get("code", ""))
                  for r in pinned_rows if r.get("code", "").strip()}
        print(f"  {len(pinned)} pinned solutions from Supabase")
    except Exception as e:
        print(f"  ⚠ Could not fetch pinned solutions: {e}")
        pinned = {}

    # LeetCode session from Supabase user_settings
    try:
        rows = requests.get(
            f"{_SB_URL}/rest/v1/user_settings?user_id=eq.{_USER_ID}&select=lc_session,lc_csrf",
            headers=_SB_HDRS, timeout=10).json()
        lc_session = rows[0].get("lc_session", "") if rows else ""
        lc_csrf    = rows[0].get("lc_csrf", "")    if rows else ""
    except Exception:
        lc_session, lc_csrf = "", ""

    scraped: dict = {}
    if lc_session:
        # Always scrape into JSON first — uses LC slugs directly, never misses a question
        scraped_raw = scrape_solutions_to_json(lc_session, lc_csrf,
                                               force=FORCE_REFRESH_SOLS)
        scraped = {int(k): (v["lang"], v["code"]) for k, v in scraped_raw.items()}
    else:
        # No live session — fall back to existing JSON if present
        if _SOLUTIONS_JSON.exists():
            try:
                raw = json.loads(_SOLUTIONS_JSON.read_text())
                scraped = {int(k): (v["lang"], v["code"]) for k, v in raw.items()}
                print(f"  ⚠ No LC session — loaded {len(scraped)} from my_solutions.json")
            except Exception:
                pass
        else:
            print("  ⚠ No LeetCode session and no my_solutions.json — solutions will be empty")

    # Merge: scraped < pinned (pinned = user's curated best choice, always wins)
    result = {**scraped, **pinned}
    print(f"  {len(result)} total solutions available")
    return result


if MODE_NC_EXTRA:
    INNER_PDF       = SCRIPT_DIR / '_nc_extra_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / 'neetcode_extra.pdf'
    OUTPUT_1UP      = SCRIPT_DIR / 'neetcode_extra_1up.pdf'
    _COVER_TITLE    = 'NeetCode Exclusives'
    _COVER_SUBTITLE = '32 questions not in Set 1 · Priority-Grouped · 2×1 Landscape'
elif MODE_AM_EXTRA:
    INNER_PDF       = SCRIPT_DIR / '_am_extra_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / 'am600_extra.pdf'
    OUTPUT_1UP      = SCRIPT_DIR / 'am600_extra_1up.pdf'
    _COVER_TITLE    = 'AlgoMaster Exclusives'
    _COVER_SUBTITLE = '344 questions not in Set 1 or NeetCode · Priority-Grouped · 2×1 Landscape'
elif MODE_NC150:
    INNER_PDF       = SCRIPT_DIR / '_neetcode_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / 'neetcode.pdf'
    OUTPUT_1UP      = SCRIPT_DIR / 'neetcode_1up.pdf'
    _COVER_TITLE    = 'NeetCode 150'
    _COVER_SUBTITLE = 'Priority-Grouped · Category-Ordered · 2×1 Landscape'
elif MODE_AM600:
    INNER_PDF       = SCRIPT_DIR / '_am600_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / 'am600.pdf'
    OUTPUT_1UP      = SCRIPT_DIR / 'am600_1up.pdf'
    _COVER_TITLE    = 'AlgoMaster 600'
    _COVER_SUBTITLE = 'Priority-Grouped · Category-Ordered · 2×1 Landscape'
elif MODE_ALL727:
    INNER_PDF       = SCRIPT_DIR / '_all727_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / 'ultimate_study.pdf'
    OUTPUT_1UP      = SCRIPT_DIR / 'ultimate_1up.pdf'
    _COVER_TITLE    = 'LeetMastery Ultimate'
    _COVER_SUBTITLE = 'All 727 Questions  ·  Set 1 + Set 2 + Set 3'
else:
    INNER_PDF       = SCRIPT_DIR / '_better_inner.pdf'
    OUTPUT_PDF      = SCRIPT_DIR / ('the_digest.pdf' if CHAPTER2_PDF else 'better.pdf')
    OUTPUT_1UP      = SCRIPT_DIR / 'better_1up.pdf'
    _COVER_TITLE    = 'LeetMastery'
    _COVER_SUBTITLE = 'Study-Order Edition'

# ─── Study-order configuration ───────────────────────────────────────────────
# Mirrors the TypeScript PATTERN_PRIORITY from constants.ts
PATTERN_PRIORITY = {
    'Arrays & Hashing':    'High',
    'String':              'High',
    'Two Pointers':        'High',
    'Sliding Window':      'High',
    'Sorting':             'High',
    'Binary Search':       'High',
    'Matrix':              'High',
    'Trees & BST':         'High',
    'DFS':                 'High',
    'Graphs':              'High',
    'BFS':                 'High',
    'Linked List':         'Mid',
    'Stack':               'Mid',
    'Heap':                'Mid',
    'Trie':                'Mid',
    'Backtracking':        'Mid',
    'Greedy':              'Mid',
    'Dynamic Programming': 'Low',
    'Bit Manipulation':    'Low',
    'Math':                'Low',
    'JavaScript':          'Low',
}

# Display order within each priority tier (mirrors DISPLAY_PATTERN_ORDER)
DISPLAY_PATTERN_ORDER = [
    'Arrays & Hashing', 'String', 'Two Pointers', 'Sliding Window', 'Sorting',
    'Binary Search', 'Matrix', 'Trees & BST', 'DFS', 'Graphs', 'BFS',
    'Linked List', 'Stack', 'Heap', 'Trie', 'Backtracking', 'Greedy',
    'Dynamic Programming', 'Bit Manipulation', 'Math', 'JavaScript',
]

# 9 rounds in study order
ROUNDS = [
    (1, 'High', 'Easy'),
    (2, 'High', 'Medium'),
    (3, 'High', 'Hard'),
    (4, 'Mid',  'Easy'),
    (5, 'Mid',  'Medium'),
    (6, 'Mid',  'Hard'),
    (7, 'Low',  'Easy'),
    (8, 'Low',  'Medium'),
    (9, 'Low',  'Hard'),
]

PRIORITY_COLORS = {
    'High': {'pill_bg': HexColor('#FEE2E2'), 'pill_fg': HexColor('#991B1B'),  'bar': HexColor('#DC2626')},
    'Mid':  {'pill_bg': HexColor('#FEF3C7'), 'pill_fg': HexColor('#92400E'),  'bar': HexColor('#D97706')},
    'Low':  {'pill_bg': HexColor('#F3F4F6'), 'pill_fg': HexColor('#374151'),  'bar': HexColor('#6B7280')},
}
DIFF_COLORS_PILL = {
    'Easy':   (HexColor('#D1FAE5'), HexColor('#065F46')),
    'Medium': (HexColor('#FEF3C7'), HexColor('#92400E')),
    'Hard':   (HexColor('#FEE2E2'), HexColor('#991B1B')),
}
DIFF_DOT = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}

# ─── Mini-page dimensions (3×3 on 612×792 portrait letter) ──────────────────
MP_W  = 612.0 / 3   # 204 pts
MP_H  = 792.0 / 3   # 264 pts
MG    = 8.0
USE_W = MP_W - 2 * MG - 12
USE_H = MP_H - 2 * MG

# ─── Colors ──────────────────────────────────────────────────────────────────
BLACK    = HexColor('#000000')
GRAY_700 = HexColor('#374151')
GRAY_500 = HexColor('#6B7280')
GRAY_300 = HexColor('#D1D5DB')
GRAY_100 = HexColor('#F3F4F6')

SITE_META = [
    ('walkccc',    'WalkCC'),
    ('doocs',      'LeetDoocs'),
    ('simplyleet', 'SimplyLeet'),
    ('leetcodeca', 'LC.ca'),
]

TOC_CB_PT     = 7.0   # default; overridden for GRID_2X1 below
TOC_CB_GAP    = 8.0
TOC_ARROW_PAD = 4.0

# ─── Styles ──────────────────────────────────────────────────────────────────
# 4×4 mode: inner pages match cell size (no scaling), so use full readable sizes.
# Default: pages scaled down ~58% when imposed, so source sizes are small.
if MODE_ALL727:
    # Match example-box text size throughout: 3.2pt mini-page → ~9pt after 2.9× scale-up.
    _RUN_PT, _RUN_LD = 3.2, 4.2
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=3.5, textColor=BLACK, leading=4.6,  spaceAfter=0),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=0),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=3.0, textColor=BLACK, leading=4.0,  spaceAfter=0),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=2.8, textColor=BLACK, leading=3.7),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=0),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=8,   textColor=BLACK, alignment=TA_CENTER, leading=10),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=4,   textColor=BLACK, alignment=TA_CENTER, leading=5.5),
    }
    TOC_CB_PT     = float(_RUN_PT)
    TOC_CB_GAP    = _RUN_PT + 1
    TOC_ARROW_PAD = max(4.0, round(_RUN_PT * 0.57, 1))
elif GRID_4X4:
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=11, textColor=BLACK, leading=14),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14,  spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=11, textColor=BLACK, leading=14),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=8, textColor=BLACK, alignment=TA_CENTER, leading=10),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=8, textColor=BLACK, alignment=TA_CENTER, leading=10),
    }
elif GRID_2X1:
    # pattern_run: one text size everywhere (Round header size), code unchanged.
    _RUN_PT, _RUN_LD = 7, 9
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=3.5, textColor=BLACK, leading=4.6),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD, spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, leading=_RUN_LD),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, alignment=TA_CENTER, leading=_RUN_LD),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=_RUN_PT, textColor=BLACK, alignment=TA_CENTER, leading=_RUN_LD),
    }
    TOC_CB_PT = float(_RUN_PT)
    TOC_CB_GAP = _RUN_PT + 1
    TOC_ARROW_PAD = max(4.0, round(_RUN_PT * 0.57, 1))
elif CHAPTER2_PDF:
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=7, textColor=BLACK, leading=9,   spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=5.0, textColor=BLACK, leading=6.5, spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=5.0, textColor=BLACK, leading=6.5, spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=3.5, textColor=BLACK, leading=4.6),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=5.0, textColor=BLACK, leading=6.5, spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=7, textColor=BLACK, leading=9),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=13,  textColor=BLACK, alignment=TA_CENTER, leading=16),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=7,   textColor=BLACK, alignment=TA_CENTER, leading=10),
    }
else:
    S = {
        'title':       ParagraphStyle('ttl', fontName='LG-Bold',    fontSize=8,   textColor=BLACK, leading=10,  spaceAfter=1),
        'body':        ParagraphStyle('bd',  fontName='LG-Bold',    fontSize=6,   textColor=BLACK, leading=8,   spaceAfter=1),
        'body_sm':     ParagraphStyle('bds', fontName='LG-Bold',    fontSize=5.8, textColor=BLACK, leading=7.5, spaceAfter=1),
        'code':        ParagraphStyle('cd',  fontName='Menlo-Bold', fontSize=5.5, textColor=BLACK, leading=7.5),
        'head2':       ParagraphStyle('h2',  fontName='LG-Bold',    fontSize=6.5, textColor=BLACK, leading=9,   spaceAfter=1),
        'toc':         ParagraphStyle('tc',  fontName='LG-Bold',    fontSize=7,   textColor=BLACK, leading=10),
        'cover_title': ParagraphStyle('ct',  fontName='LG-Bold',    fontSize=13,  textColor=BLACK, alignment=TA_CENTER, leading=16),
        'cover_sub':   ParagraphStyle('cs',  fontName='LG-Bold',    fontSize=7,   textColor=BLACK, alignment=TA_CENTER, leading=10),
    }

# ─── Helpers ─────────────────────────────────────────────────────────────────
def safe_xml(t: str) -> str:
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def _inner_ps(name: str, font_key: str = 'body', *, fontName: str = 'LG-Bold', **kwargs) -> ParagraphStyle:
    """ParagraphStyle using S[font_key] sizes — keeps pattern_run text uniform."""
    ref = S[font_key]
    opts = dict(
        fontName=fontName,
        fontSize=ref.fontSize,
        leading=ref.leading,
        textColor=BLACK,
    )
    opts.update(kwargs)
    return ParagraphStyle(name, **opts)


LINK_COLOR_PRINT = '#0000EE'


def _slugify(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_').lower()


def anchor_round(round_num: int) -> str:
    return f'round_{round_num}'


def anchor_pat(pat_name: str) -> str:
    return f'pat_{_slugify(pat_name)}'


def round_toc_label(round_num: int, priority: str, difficulty: str, n_q: int) -> str:
    dot = {'Easy': 'E', 'Medium': 'M', 'Hard': 'H'}.get(difficulty, '')
    return f'Round {round_num}  |  {priority}  |  {dot} {difficulty}  ({n_q})'


def _toc_link_markup(href: str, label: str, *, bold: bool = True) -> str:
    inner = f'<b>{label}</b>' if bold else label
    return f'<link href="#{href}" color="{LINK_COLOR_PRINT}">{inner}</link>'


def _toc_link_visual(label: str, *, bold: bool = True) -> str:
    """Blue TOC line — actual link added in 2×1 post-process."""
    inner = f'<b>{label}</b>' if bold else label
    return f'<font color="{LINK_COLOR_PRINT}">{inner}</font>'


class NamedDest(Flowable):
    def __init__(self, name: str):
        super().__init__()
        self.name = name

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        canv = self.canv
        x, y = canv.absolutePosition(0, 0)
        canv.bookmarkHorizontal(self.name, x, y)


class RoundPageMark(Flowable):
    def __init__(self, round_num: int, registry: dict):
        super().__init__()
        self.round_num = round_num
        self.registry = registry

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        if self.round_num not in self.registry:
            self.registry[self.round_num] = self.canv.getPageNumber() - 1


class PatPageMark(Flowable):
    def __init__(self, round_num: int, pat_name: str, registry: dict):
        super().__init__()
        self.round_num = round_num
        self.pat_name = pat_name
        self.registry = registry

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        key = (self.round_num, self.pat_name)
        if key not in self.registry:
            self.registry[key] = self.canv.getPageNumber() - 1


def _anchor_para(name: str) -> list:
    return [
        NamedDest(name),
        Paragraph(
            f'<a name="{name}"/>',
            ParagraphStyle('anch', fontSize=1, leading=1, spaceBefore=0, spaceAfter=0),
        ),
    ]

def indent_xml(line: str) -> str:
    stripped = line.lstrip(' ')
    spaces   = len(line) - len(stripped)
    return '&nbsp;' * spaces + safe_xml(stripped)

def hr(color=BLACK, thickness=0.8):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceBefore=2, spaceAfter=2)

def mini_rl_image(url: str):
    pil = download_image(url)
    if not pil: return None
    w_px, h_px = pil.size
    if w_px == 0 or h_px == 0: return None
    max_w = USE_W - 6
    max_h = USE_H * 0.55
    scale = min(max_w / w_px, max_h / h_px, 1.0)
    dw, dh = w_px * scale, h_px * scale
    fpath = IMG_DIR / _img_filename(url)
    try:
        return RLImage(str(fpath), width=dw, height=dh)
    except Exception:
        return None

# ─── Exclusive pattern assignment (same logic as buildExclusivePatternMap.ts) ─
def build_exclusive_map(questions: list) -> dict:
    """Returns {question_id: pattern_name} using first-match in QUICK_PATTERNS order."""
    assigned = {}
    for p in QUICK_PATTERNS:
        ptags = set(p['tags'])
        for q in questions:
            if q['id'] not in assigned and set(q.get('tags', [])) & ptags:
                assigned[q['id']] = p['name']
    return assigned

# ─── Build 9 rounds from questions list ──────────────────────────────────────
def build_rounds(questions: list) -> list:
    """
    Returns list of (round_num, priority, difficulty, [(pat_obj, [q, ...])])
    sorted in study order. Within each round questions are grouped by pattern
    (DISPLAY_PATTERN_ORDER within that priority tier), then by question id.
    """
    exclusive = build_exclusive_map(questions)
    pat_by_name = {p['name']: p for p in QUICK_PATTERNS}

    result = []
    for round_num, priority, difficulty in ROUNDS:
        tier_patterns = [p for p in DISPLAY_PATTERN_ORDER
                         if PATTERN_PRIORITY.get(p) == priority]
        pattern_groups = []
        for pat_name in tier_patterns:
            pat_obj = pat_by_name.get(pat_name)
            if not pat_obj:
                continue
            qs = [q for q in questions
                  if exclusive.get(q['id']) == pat_name
                  and q.get('difficulty') == difficulty]
            qs.sort(key=lambda q: q['id'])
            if qs:
                pattern_groups.append((pat_obj, qs))
        result.append((round_num, priority, difficulty, pattern_groups))
    return result

# ─── Description renderer ─────────────────────────────────────────────────────
def desc_to_mini_flowables(desc_html: str) -> list:
    if not desc_html:
        return []
    body_st = ParagraphStyle('dbody', fontName='LG-Bold', fontSize=S['body'].fontSize,
                             textColor=BLACK, leading=S['body'].leading, spaceAfter=1)
    li_st   = ParagraphStyle('dli',   fontName='LG-Bold', fontSize=S['body'].fontSize,
                             textColor=BLACK, leading=S['body'].leading, leftIndent=8, spaceAfter=1)
    hdr_st  = ParagraphStyle('dhdr',  fontName='LG-Bold', fontSize=S['head2'].fontSize,
                             textColor=BLACK, leading=S['head2'].leading, spaceAfter=1, spaceBefore=3)
    pre_st  = ParagraphStyle('dpre',  fontName='Menlo-Bold', fontSize=S['code'].fontSize,
                             textColor=BLACK, leading=S['code'].leading)

    flowables = []
    block_re  = re.compile(
        r'(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|'
        r'(<img[^>]*/?>)|'
        r'(<pre[^>]*>)([\s\S]*?)(</pre>)|'
        r'(<ul[^>]*>)([\s\S]*?)(</ul>)|'
        r'(<ol[^>]*>)([\s\S]*?)(</ol>)|'
        r'(<p[^>]*>)([\s\S]*?)(</p>)|'
        r'(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)',
        re.I,
    )
    for m in block_re.finditer(desc_html):
        if m.group(1):
            src = (re.search(r'href=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I) or
                   re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]',  m.group(1), re.I))
            if src:
                url = src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(2):
            src = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(2), re.I)
            if src:
                url = src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
            continue
        if m.group(4) is not None:
            raw = _clean_code(m.group(4) or '').strip()
            if raw:
                safe = raw.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
                lines = safe.split('\n')[:8]
                cell = Paragraph('<br/>'.join(lines), pre_st)
                tbl  = Table([[cell]], colWidths=[USE_W])
                tbl.setStyle(TableStyle([
                    ('BACKGROUND',    (0,0), (-1,-1), white),
                    ('TOPPADDING',    (0,0), (-1,-1), 3),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                    ('LEFTPADDING',   (0,0), (-1,-1), 5),
                    ('RIGHTPADDING',  (0,0), (-1,-1), 5),
                    ('BOX',           (0,0), (-1,-1), 1.0, BLACK),
                ]))
                flowables.append(tbl)
            continue
        if m.group(7) is not None:
            for li in re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(7) or '', re.I):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f'• {text}', li_st))
            continue
        if m.group(10) is not None:
            for i, li in enumerate(re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(10) or '', re.I), 1):
                text = _inline(li, printable=True, bold=True).strip()
                if text:
                    flowables.append(Paragraph(f'{i}. {text}', li_st))
            continue
        if m.group(13) is not None:
            inner = m.group(13) or ''
            # Paragraph can wrap inline <img> or Doocs lightbox <a href="...png">.
            img_src = re.search(r'(?:src|href)=["\x27](https?://[^"\x27>\s]+)["\x27]', inner, re.I)
            if img_src:
                url = img_src.group(1)
                if 'shields.io' not in url and 'badge' not in url.lower():
                    img = mini_rl_image(url)
                    if img:
                        flowables += [Spacer(1, 3), img, Spacer(1, 3)]
                        continue
            text = _inline(inner, printable=True, bold=True).strip()
            if text and text != ' ':
                try:
                    flowables.append(Paragraph(text, body_st))
                except Exception:
                    flowables.append(Paragraph(safe_xml(re.sub(r'<[^>]+>', '', text)), body_st))
            continue
        if m.group(16) is not None:
            text = _inline(m.group(16) or '', printable=True, bold=True).strip()
            if text:
                flowables.append(Paragraph(f'<b>{safe_xml(text)}</b>', hdr_st))
            continue
    return flowables

# ─── Code panel ──────────────────────────────────────────────────────────────
# 4×4: 8pt font wraps more characters per line, so fewer lines per chunk
_CODE_CHUNK = 2 if GRID_4X4 else 10

# ── Pygments monokai palette for PDF ─────────────────────────────────────────
from pygments import lex as _pgx_lex
from pygments.token import Token as _T
from pygments.lexers import PythonLexer as _PyLex, JavascriptLexer as _JsLex, TypeScriptLexer as _TsLex

_BG_CODE   = HexColor('#272822')   # monokai dark background
_DIM_BORDER = HexColor('#3d3d3d')
_CODE_CLR_DEFAULT = '#F8F8F2'      # off-white default text

_MONOKAI: dict = {
    _T.Keyword:                    '#F92672',
    _T.Keyword.Declaration:        '#F92672',
    _T.Keyword.Namespace:          '#F92672',
    _T.Keyword.Pseudo:             '#66D9EF',
    _T.Name.Function:              '#A6E22E',
    _T.Name.Function.Magic:        '#A6E22E',
    _T.Name.Class:                 '#A6E22E',
    _T.Name.Decorator:             '#A6E22E',
    _T.Name.Builtin:               '#66D9EF',
    _T.Name.Builtin.Pseudo:        '#AE81FF',
    _T.Name.Exception:             '#A6E22E',
    _T.Literal.String:             '#E6DB74',
    _T.Literal.String.Doc:         '#75715E',
    _T.Literal.String.Interpol:    '#E6DB74',
    _T.Literal.String.Escape:      '#AE81FF',
    _T.Comment:                    '#75715E',
    _T.Literal.Number:             '#AE81FF',
    _T.Operator:                   '#F92672',
    _T.Operator.Word:              '#F92672',
    _T.Punctuation:                '#F8F8F2',
}

def _tok_color(ttype) -> str:
    while ttype:
        if ttype in _MONOKAI:
            return _MONOKAI[ttype]
        ttype = ttype.parent
    return _CODE_CLR_DEFAULT

def _tok_to_lines(code: str, lang: str = 'python'):
    """Tokenize code → list of lines, each line = list of (text, color) pairs."""
    try:
        lg = lang.lower()
        if lg in ('javascript', 'js'):   lexer = _JsLex(stripnl=False)
        elif lg in ('typescript', 'ts'): lexer = _TsLex(stripnl=False)
        else:                            lexer = _PyLex(stripnl=False)
        raw_tokens = list(_pgx_lex(code, lexer))
    except Exception:
        # Fallback: single colour
        return [[(ln, _CODE_CLR_DEFAULT)] for ln in code.split('\n')]

    lines, cur = [], []
    for ttype, value in raw_tokens:
        for i, part in enumerate(value.split('\n')):
            if i:
                lines.append(cur)
                cur = []
            if part:
                cur.append((part, _tok_color(ttype)))
    if cur:
        lines.append(cur)
    return lines

def _line_to_xml(tokens: list) -> str:
    """Convert (text, color) token list → ReportLab Paragraph XML for one line."""
    if not tokens:
        return '&nbsp;'
    out = ''
    for text, color in tokens:
        # Preserve leading spaces as &nbsp; so Paragraph doesn't collapse them
        n = len(text) - len(text.lstrip(' '))
        body = '&nbsp;' * n + safe_xml(text[n:])
        if body:
            out += f'<font color="{color}">{body}</font>'
    return out or '&nbsp;'

_CODE_ST_DARK = ParagraphStyle(
    'ccd', fontName='Menlo', fontSize=S['code'].fontSize,
    leading=S['code'].leading + 0.5,
    textColor=HexColor(_CODE_CLR_DEFAULT),
)

def code_panel(code: str, lang: str = 'python') -> list:
    """Code block — monokai dark for screen PDFs, plain B&W for print (--6x4)."""
    if not code.strip():
        return []

    # ── Print mode: plain black-on-white, bold, no colours ───────────────────
    if GRID_6X4:
        all_lines = code.split('\n')
        items = []
        for i in range(0, len(all_lines), _CODE_CHUNK):
            xml_lines = [indent_xml(ln) for ln in all_lines[i:i+_CODE_CHUNK]]
            cell = Paragraph('<br/>'.join(xml_lines), S['code'])
            tbl  = Table([[cell]], colWidths=[USE_W])
            tbl.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,-1), white),
                ('TOPPADDING',    (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING',   (0,0), (-1,-1), 4),
                ('RIGHTPADDING',  (0,0), (-1,-1), 4),
                ('BOX',           (0,0), (-1,-1), 0.8, BLACK),
            ]))
            items.append(tbl)
        return items

    # ── Screen mode: monokai dark ─────────────────────────────────────────────
    lines = _tok_to_lines(code, lang)
    items = []
    for i in range(0, len(lines), _CODE_CHUNK):
        chunk = lines[i:i + _CODE_CHUNK]
        xml   = '<br/>'.join(_line_to_xml(ln) for ln in chunk)
        try:
            cell = Paragraph(xml, _CODE_ST_DARK)
        except Exception:
            # Fallback to plain text chunk if markup is broken
            plain = '<br/>'.join(indent_xml(ln) for ln in
                                 code.split('\n')[i:i+_CODE_CHUNK])
            cell = Paragraph(plain, S['code'])
        tbl = Table([[cell]], colWidths=[USE_W])
        tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), _BG_CODE),
            ('TOPPADDING',    (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING',   (0,0), (-1,-1), 5),
            ('RIGHTPADDING',  (0,0), (-1,-1), 5),
            ('BOX',           (0,0), (-1,-1), 0.5, _DIM_BORDER),
        ]))
        items.append(tbl)
    return items

def cat_bar(text: str, bg=None) -> Table:
    bar_bg = bg if bg else white
    tbl = Table([[Paragraph(
        f'<b>{safe_xml(text)}</b>',
        ParagraphStyle('cb', fontName='LG-Bold', fontSize=S['body_sm'].fontSize, textColor=BLACK),
    )]], colWidths=[USE_W])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), bar_bg),
        ('TOPPADDING',    (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
        ('RIGHTPADDING',  (0,0), (-1,-1), 5),
        ('LINEBELOW',     (0,0), (-1,-1), 1.2, BLACK),
    ]))
    return tbl

def site_label_p(label: str) -> Paragraph:
    return Paragraph(
        f'<b>● {label}</b>',
        ParagraphStyle(f'sl_{label}', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                       textColor=BLACK, leading=S['body_sm'].leading, spaceBefore=3))

# ─── Page state ───────────────────────────────────────────────────────────────
_PAGE_STATE: dict = {'round': ''}

class SetRound(Flowable):
    def __init__(self, label: str):
        super().__init__()
        self.label  = label
        self.width  = 0
        self.height = 0

    def draw(self):
        _PAGE_STATE['round'] = self.label
        c = self.canv
        c.saveState()
        c.setFont('LG-Bold', S['body'].fontSize)
        c.setFillColor(BLACK)
        c.drawString(MG, MG - 3, self.label)
        c.restoreState()

class PageCounter:
    def __init__(self): self.n = 0
    def on_page(self, canvas, doc):
        self.n += 1
        canvas.saveState()
        canvas.setFont('LG-Bold', S['body'].fontSize)
        canvas.setFillColor(BLACK)
        canvas.drawRightString(MP_W - MG, MG - 3, f'p.{self.n}')
        if _PAGE_STATE['round']:
            canvas.drawString(MG, MG - 3, _PAGE_STATE['round'])
        canvas.restoreState()

# ─── All-727: round builder for a single set ──────────────────────────────────
def build_rounds_for_set(questions_in_set: list, base_round: int = 1) -> list:
    """Build 9 rounds from one set using the section field from grind_questions.json."""
    from collections import defaultdict
    PRIO_ORDER = ['High', 'Mid', 'Low']
    DIFF_ORDER = ['Easy', 'Medium', 'Hard']

    def _parse_section(q):
        section = (q.get('section') or '').strip()
        if section and ' - ' in section:
            pd, pat = section.split(' - ', 1)
            parts = pd.split()
            pri = parts[0] if parts else 'Low'
            dif = parts[1] if len(parts) > 1 else q.get('difficulty', 'Easy')
            return pri, dif, pat.strip()
        pat = (q.get('pattern') or 'Unknown').strip()
        dif = q.get('difficulty', 'Easy')
        pri = PATTERN_PRIORITY.get(pat, 'Low')
        return pri, dif, pat

    buckets: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for q in questions_in_set:
        pri, dif, pat = _parse_section(q)
        buckets[pri][dif][pat].append(q)

    result = []
    rn = base_round
    for pri in PRIO_ORDER:
        for dif in DIFF_ORDER:
            pgs = []
            seen: set = set()
            for pat_name in DISPLAY_PATTERN_ORDER:
                qs = sorted(buckets[pri][dif].get(pat_name, []), key=lambda q: q['id'])
                if qs:
                    pgs.append(({'name': pat_name, 'tags': [], 'color': '#6B7280', 'hex': '#6B7280'}, qs))
                seen.add(pat_name)
            for pat_name in sorted(buckets[pri][dif]):
                if pat_name not in seen:
                    qs = sorted(buckets[pri][dif][pat_name], key=lambda q: q['id'])
                    if qs:
                        pgs.append(({'name': pat_name, 'tags': [], 'color': '#6B7280', 'hex': '#6B7280'}, qs))
            result.append((rn, pri, dif, pgs))
            rn += 1
    return result


# ─── Question block ───────────────────────────────────────────────────────────
def build_interview_approach(qid: int) -> list:
    """
    Renders the STAR-LC interview approach section for a question.
    Returns an empty list if no entry exists — caller adds a 'not generated' note.
    """
    entry = _PLAYBOOK.get(str(qid))
    items = [
        Spacer(1, 4),
        hr(GRAY_300, 0.5),
        Paragraph('<b>◆ Interview Approach · STAR-LC</b>', S['head2']),
    ]
    if not entry:
        items.append(Paragraph(
            'No interview approach generated yet.',
            ParagraphStyle('ia_none', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                           textColor=HexColor('#6B7280'), leading=S['body_sm'].leading,
                           leftIndent=4, spaceAfter=2),
        ))
        return items

    script = entry.get('script', '').strip()
    if not script:
        items.append(Paragraph(
            'No interview approach generated yet.',
            ParagraphStyle('ia_none2', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                           textColor=HexColor('#6B7280'), leading=S['body_sm'].leading,
                           leftIndent=4, spaceAfter=2),
        ))
        return items

    # Render each line with colour-coding matching the app UI
    phase_st = ParagraphStyle('ia_phase', fontName='LG-Bold',
                               fontSize=S['code'].fontSize, textColor=HexColor('#7C3AED'),
                               leading=S['code'].leading, spaceBefore=3)
    quote_st = ParagraphStyle('ia_quote', fontName='Menlo-Bold',
                               fontSize=S['code'].fontSize, textColor=HexColor('#92400E'),
                               leading=S['code'].leading)
    code_st  = ParagraphStyle('ia_code',  fontName='Menlo-Bold',
                               fontSize=S['code'].fontSize, textColor=HexColor('#0369A1'),
                               leading=S['code'].leading)
    comment_st = ParagraphStyle('ia_cmt', fontName='Menlo-Bold',
                                 fontSize=S['code'].fontSize, textColor=HexColor('#374151'),
                                 leading=S['code'].leading)

    def _indent_xml(raw: str) -> str:
        """Preserve leading spaces by converting them to non-breaking spaces."""
        n = len(raw) - len(raw.lstrip(' '))
        return '&#160;' * n + safe_xml(raw.lstrip(' '))

    for raw_line in script.split('\n'):
        line = raw_line.rstrip()
        if not line:
            items.append(Spacer(1, 1))
            continue
        stripped = line.lstrip()
        txt = _indent_xml(line)
        if stripped.startswith('# PHASE ') and ' — ' in stripped:
            items.append(Paragraph(txt, phase_st))
        elif stripped.startswith('# "') or stripped.startswith('#  "') or \
             (stripped.startswith('#') and '"' in stripped[:15]):
            items.append(Paragraph(txt, quote_st))
        elif stripped.startswith('#'):
            items.append(Paragraph(txt, comment_st))
        else:
            # Code line — use blue style, indentation preserved via &#160;
            items.append(Paragraph(txt, code_st))
    return items


def build_question_block(q: dict, sites_cache: dict, doocs_cache: dict,
                          pattern_name: str, pattern_obj: dict,
                          my_solutions: dict | None = None) -> list:
    items = []
    slug     = q.get('slug', '')
    qid      = q['id']
    diff_key = q.get('difficulty', 'easy').lower()
    bg, fg   = DIFF_COLORS_PILL.get(q.get('difficulty', 'Easy'), (GRAY_100, BLACK))

    # Each question must start on its own minipage so Next/Prev navigation
    # always lands at the question title, never mid-page on previous content.
    items.append(PageBreak())

    # Invisible question-start marker — used by _analyze_inner_for_links to
    # reliably identify which question owns each page, even when the interview
    # approach or description cross-references other question IDs.
    items.append(Paragraph(
        f'##QID={qid}##',
        ParagraphStyle(f'qstart_{qid}', fontName='LG-Bold', fontSize=0.5,
                       textColor=HexColor('#FFFFFF'), leading=0.5, spaceAfter=0),
    ))

    items.append(cat_bar(pattern_name))
    items.append(Spacer(1, 2))

    pill = Table([[Paragraph(
        f'<font color="{fg.hexval()}"><b>{q.get("difficulty","?")[:3].upper()}</b></font>',
        ParagraphStyle('pill', fontName='LG-Bold', fontSize=S['body'].fontSize, textColor=fg),
    )]], colWidths=[0.34 * inch])
    pill.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), bg),
        ('ALIGN',         (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING',    (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING',   (0,0), (-1,-1), 2),
        ('RIGHTPADDING',  (0,0), (-1,-1), 2),
    ]))
    title_tbl = Table([[
        Paragraph(
            f'<b>{premium_question_prefix(q)}#{qid} {safe_xml(q["title"])}{premium_question_suffix(q)}</b>',
            S['title'],
        ),
        pill,
    ]], colWidths=[USE_W - 0.38 * inch, 0.38 * inch])
    title_tbl.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING',   (0,0), (-1,-1), 0),
        ('RIGHTPADDING',  (0,0), (-1,-1), 0),
    ]))
    items.append(title_tbl)
    items.append(Spacer(1, 1))
    # Small orange pill badge — mirrors LeetCode's "Premium" tag next to the title
    if is_premium_question(q):
        prem_tbl = Table([[Paragraph(
            f'<b>{premium_star_markup()} Premium</b>',
            ParagraphStyle(f'prem_lbl_{qid}', fontName='LG-Bold',
                           fontSize=S['body_sm'].fontSize,
                           textColor=white, leading=S['body_sm'].leading),
        )]])
        prem_tbl.hAlign = 'LEFT'
        prem_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), HexColor('#FFA116')),
            ('TOPPADDING',    (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING',   (0, 0), (-1, -1), 4),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
        ]))
        items.append(prem_tbl)
        items.append(Spacer(1, 1))
    # Prominent "Open on LeetCode" link right below the title
    # (URI re-injected after imposition in _add_links_1x1 via "Open on LeetCode" search)
    items.append(Paragraph(
        f'<a href="https://leetcode.com/problems/{slug}/" color="#0000EE">'
        f'<b>Open on LeetCode ↗</b></a>',
        ParagraphStyle(
            f'lc_open_{qid}', fontName='LG-Bold',
            fontSize=S['title'].fontSize,
            textColor=HexColor('#0000EE'),
            leading=S['title'].leading,
            leftIndent=2, spaceAfter=1,
        ),
    ))
    items.append(hr(GRAY_300, 0.3))

    links = (
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">LeetDoocs</a>  ·  '
        f'<a href="https://www.simplyleet.com/{slug}" color="#000000">SimplyLeet</a>  ·  '
        f'<a href="https://walkccc.me/LeetCode/problems/{qid}/" color="#000000">WalkCC</a>  ·  '
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>'
    )
    items.append(Paragraph(links, ParagraphStyle(
        'lnk', fontName='LG-Bold', fontSize=S['body_sm'].fontSize, textColor=BLACK,
        leading=S['body_sm'].leading, spaceAfter=2)))

    tags = q.get('tags', [])
    if tags:
        items.append(Paragraph(
            '  ·  '.join(safe_xml(t) for t in tags[:10]),
            ParagraphStyle('tg', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                           textColor=BLACK, leading=S['body_sm'].leading, spaceAfter=2)))

    source = q.get('source', [])
    if source:
        lists = '  |  '.join(safe_xml(s) for s in source)
        if is_premium_question(q):
            lists = f'{premium_star_markup()} Premium  |  {lists}'
        items.append(Paragraph(
            f"Lists: {lists}",
            ParagraphStyle('src', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                           textColor=BLACK, leading=S['body_sm'].leading, spaceAfter=2)))

    # Complexity / explanation removed from header — it now lives in the
    # inline Quick Review summary that follows every question's solutions.

    desc_html = get_question_desc_html(q, doocs_cache)
    if desc_html:
        items.append(Spacer(1, 2))
        items.append(Paragraph('<b>Problem</b>', S['head2']))
        if is_html_description(desc_html):
            items += desc_to_mini_flowables(desc_html)
        else:
            items += plain_desc_to_paragraphs(desc_html, S['body'])
        items.append(Spacer(1, 2))
    # Nav link from description page → first answers page (IA); PDF link injected
    # in _add_links_1x1 using the ##IA=N## marker collected by _analyze_inner_for_links.
    items.append(Paragraph(
        '→ Interview Approach',
        ParagraphStyle(f'to_ia_{qid}', fontName='LG-Bold', fontSize=S['title'].fontSize,
                       textColor=HexColor('#0369A1'), leading=S['title'].leading, spaceAfter=1,
                       alignment=2),
    ))

    # ── Code Skeleton — own page; attempt before scrolling to solutions ─────────
    raw_starter = (q.get('starterPython') or '').strip()
    for _marker in ('# -- Interview Approach - STAR-LC --', '# PHASE 1', '# -- Problem Description --'):
        _cut = raw_starter.find(_marker)
        if _cut > 0:
            raw_starter = raw_starter[:_cut].rstrip()
    if raw_starter:
        items.append(PageBreak())
        items.append(Paragraph('<b>★ Code Skeleton (Python)</b>', S['head2']))
        items.append(site_label_p('Attempt the problem before looking at solutions'))
        items += code_panel(raw_starter, lang='python')

    # ── Solutions divider — own page between skeleton and answers ─────────────
    items.append(PageBreak())
    items.append(Spacer(1, USE_H * 0.35))
    items.append(Paragraph(
        '<b>Solutions</b>',
        ParagraphStyle('sol_div_h', fontName='LG-Bold', fontSize=26,
                       textColor=HexColor('#6B7280'), alignment=1, leading=32),
    ))
    items.append(Spacer(1, 8))
    items.append(Paragraph(
        'Interview Approach  ·  My Solution  ·  Community',
        ParagraphStyle('sol_div_s', fontName='LG-Bold', fontSize=9,
                       textColor=HexColor('#9CA3AF'), alignment=1, leading=13),
    ))
    items.append(PageBreak())

    is_js_pattern = (pattern_name == 'JavaScript')

    entry = sites_cache.get(slug, {})
    doocs_blocks = doocs_cache.get(str(qid), {}).get('blocks', [])
    merged = dict(entry)
    merged['doocs'] = [{'code': b['code'], 'lang': b.get('lang','')} for b in doocs_blocks]

    # ── 1. Interview Approach · STAR-LC ──────────────────────────────────────────
    # Invisible IA-start marker — _analyze_inner_for_links uses this to record
    # which page the interview approach begins on for → Interview Approach links.
    items.append(Paragraph(
        f'##IA={qid}##',
        ParagraphStyle(f'ia_mark_{qid}', fontName='LG-Bold', fontSize=0.5,
                       textColor=HexColor('#FFFFFF'), leading=0.5, spaceAfter=0),
    ))
    # Visible ← Description nav link; PDF link injected in _add_links_1x1
    items.append(Paragraph(
        '← Description',
        ParagraphStyle(f'back_desc_{qid}', fontName='LG-Bold', fontSize=S['title'].fontSize,
                       textColor=HexColor('#0369A1'), leading=S['title'].leading, spaceAfter=2),
    ))
    items += build_interview_approach(qid)

    # ── 2. My LeetCode Solution ───────────────────────────────────────────────
    if my_solutions:
        my_sol = my_solutions.get(qid)
        if my_sol:
            my_lang, my_code = my_sol
            my_code = my_code.strip()
            if my_code:
                items.append(Spacer(1, 3))
                items.append(Paragraph('<b>★ My LeetCode Solution</b>', S['head2']))
                items.append(site_label_p('My LeetCode Solution'))
                items += code_panel(my_code, lang=my_lang)
        else:
            items.append(Spacer(1, 3))
            items.append(Paragraph(
                'No accepted LeetCode solution yet.',
                ParagraphStyle('no_sol', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                               textColor=HexColor('#6B7280'), leading=S['body_sm'].leading,
                               spaceAfter=2)))

    # ── 3. Community Solutions ────────────────────────────────────────────────
    if is_js_pattern:
        js_langs = ('javascript', 'js', 'typescript', 'ts')
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            js_blocks = [b for b in blocks if b.get('lang','').lower() in js_langs]
            if not js_blocks:
                continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Community Solutions (JavaScript / TypeScript)</b>', S['head2']))
                has_any = True
            items.append(site_label_p(site_label_str))
            seen = set()
            for b in js_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                items += code_panel(b['code'], lang=b.get('lang','javascript'))
        if not has_any:
            items.append(Spacer(1, 3))
            items.append(Paragraph(
                'No JavaScript / TypeScript community solution in cache.', S['body']))
    else:
        has_any = False
        for site_key, site_label_str in SITE_META:
            blocks = merged.get(site_key, [])
            py_blocks = [b for b in blocks if b.get('lang','').lower() in ('python','python3','py')]
            if not py_blocks: continue
            if not has_any:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Community Solutions (Python)</b>', S['head2']))
                has_any = True
            items.append(site_label_p(site_label_str))
            seen = set()
            for b in py_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                items += code_panel(b['code'], lang='python')

        if not has_any:
            fallback = (q.get('python_solution') or '').strip()
            if fallback:
                items.append(Spacer(1, 3))
                items.append(Paragraph(
                    '<b>★ Solution (Python)</b>', S['head2']))
                items += code_panel(fallback, lang='python')

    # Inline Quick Review summary — follows immediately after solutions
    items += build_question_inline_summary(q)

    items.append(PageBreak())
    return items


# ─── Per-question inline Quick Review summary ─────────────────────────────────
def build_question_inline_summary(q: dict) -> list:
    """
    Key insights · Space & Time · Solution explanation — appended inline after
    each question's code solutions so the reader doesn't need to flip elsewhere.
    """
    slug = q.get('slug', '')
    info = _QR_DATA.get(slug, {})
    if not info:
        return []
    ki  = info.get('key_insights', '').strip()
    cx  = info.get('complexity', '').strip()
    sol = info.get('solution', '').strip()
    if not any([ki, cx, sol]):
        return []

    label_st = ParagraphStyle('iqrl', fontName='LG-Bold', fontSize=S['body'].fontSize,
                               textColor=BLACK, leading=S['body'].leading,
                               spaceBefore=4, spaceAfter=1)
    body_st  = ParagraphStyle('iqrb', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                               textColor=BLACK, leading=S['body_sm'].leading,
                               leftIndent=6, spaceAfter=1)

    items = [
        Spacer(1, 4),
        hr(GRAY_300, 0.5),
        Paragraph('<b>◆ Quick Review</b>', S['head2']),
    ]
    if ki:
        items.append(Paragraph('<b>Key Insights</b>', label_st))
        for line in ki.split('\n'):
            line = line.strip().lstrip('-• ').strip()
            if line:
                items.append(Paragraph(f'• {safe_xml(line)}', body_st))
    if cx:
        items.append(Paragraph('<b>Space &amp; Time</b>', label_st))
        for line in cx.split('\n'):
            line = line.strip()
            if line:
                items.append(Paragraph(safe_xml(line), body_st))
    if sol:
        items.append(Paragraph('<b>Solution</b>', label_st))
        for para in sol.split('\n\n'):
            para = re.sub(r'\s*\n\s*', ' ', para).strip()
            if para:
                items.append(Paragraph(safe_xml(para), body_st))
    return items


# ─── Chapter Quick-Review summary ────────────────────────────────────────────
def build_round_summary(round_num: int, priority: str, difficulty: str,
                         pattern_groups: list, chapter2: bool = False) -> list:
    """
    Quick-review mini-pages.
    chapter2=True: used inside Chapter 2 master summary (adds round sub-header).
    """
    all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
    if not all_qs:
        return []

    pri_c = PRIORITY_COLORS[priority]
    items = [PageBreak()]

    # Chapter 2: add a priority/difficulty sub-header before each round block
    if chapter2:
        diff_dot = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
        sub_banner = Table([[Paragraph(
            f'<b>R{round_num}  ·  {priority} · {diff_dot} {difficulty}  '
            f'({len(all_qs)} q)</b>',
            ParagraphStyle('ch2rb', fontName='LG-Bold', fontSize=S['body'].fontSize,
                           textColor=BLACK, alignment=TA_CENTER),
        )]], colWidths=[USE_W])
        sub_banner.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
            ('TOPPADDING',    (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('BOX',           (0,0), (-1,-1), 0.8, pri_c['bar']),
        ]))
        items.append(sub_banner)
        items.append(Spacer(1, 3))

    # Chapter summary banner
    diff_dot_ch = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
    banner_text = f'Round {round_num}  ·  {priority} Priority  ·  {diff_dot_ch} {difficulty}  —  Quick Review'
    items.append(cat_bar(f'>> {banner_text}', bg=pri_c['pill_bg']))
    items.append(Spacer(1, 2))
    items.append(Paragraph(
        f'<b>{len(all_qs)} question{"s" if len(all_qs) != 1 else ""}  ·  key insights · complexity · solution</b>',
        S['body']))
    items.append(hr(GRAY_300, 0.3))

    label_st = ParagraphStyle('qrl', fontName='LG-Bold', fontSize=S['body'].fontSize,
                               textColor=BLACK, leading=S['body'].leading,
                               spaceBefore=4, spaceAfter=1)
    body_st  = ParagraphStyle('qrb', fontName='LG-Bold', fontSize=S['body_sm'].fontSize,
                               textColor=BLACK, leading=S['body_sm'].leading,
                               leftIndent=6, spaceAfter=1)
    diff_colors = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}

    for pat, q in all_qs:
        slug = q.get('slug', '')
        diff = q.get('difficulty', '')
        dc   = diff_colors.get(diff, '#6B7280')
        info = _QR_DATA.get(slug, {})

        items.append(Paragraph(
            f'<b>#{q["id"]}  {safe_xml(q["title"])}</b>  '
            f'<font color="{dc}">[{diff}]</font>  '
            f'<font color="#6B7280">· {safe_xml(pat["name"])}</font>',
            ParagraphStyle('qrt', fontName='LG-Bold', fontSize=S['title'].fontSize,
                           textColor=BLACK, leading=S['title'].leading,
                           spaceBefore=6, spaceAfter=1)))

        if info:
            ki = info.get('key_insights', '')
            if ki:
                items.append(Paragraph('<b>Key Insights</b>', label_st))
                for line in ki.split('\n'):
                    line = line.strip().lstrip('-• ').strip()
                    if line:
                        items.append(Paragraph(f'• {safe_xml(line)}', body_st))

            cx = info.get('complexity', '')
            if cx:
                items.append(Paragraph('<b>Space &amp; Time</b>', label_st))
                for line in cx.split('\n'):
                    line = line.strip()
                    if line:
                        items.append(Paragraph(safe_xml(line), body_st))

            sol = info.get('solution', '')
            if sol:
                items.append(Paragraph('<b>Solution</b>', label_st))
                for para in sol.split('\n\n'):
                    para = re.sub(r'\s*\n\s*', ' ', para).strip()
                    if para:
                        items.append(Paragraph(safe_xml(para), body_st))
        else:
            items.append(Paragraph(
                'No quick-review data available.', S['body_sm']))

        items.append(HRFlowable(width='100%', thickness=0.3, color=GRAY_300, spaceAfter=2))

    items.append(Spacer(1, 6))
    return items

# ─── Inner PDF builder ────────────────────────────────────────────────────────
def build_inner_pdf(rounds: list, sites: dict, doocs: dict, my_solutions: dict | None = None):
    counter = PageCounter()
    round_page_registry: dict[int, int] = {}
    pat_page_registry: dict[tuple[int, str], int] = {}
    total_qs = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)

    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph(_COVER_TITLE, _inner_ps('brand', 'cover_title', alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_COVER_SUBTITLE, S['cover_title']))

    # Subtitle line changes per format
    if GRID_2X1:
        subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  2×1 Landscape'
        detail   = f'{total_qs} questions  ·  9 rounds  ·  Inline Quick Review  ·  Chapter 2 Summary'
    elif GRID_2X2:
        subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  2×2 Landscape'
        detail   = f'{total_qs} questions  ·  9 rounds  ·  Inline Quick Review  ·  Chapter 2 Summary'
    elif GRID_4X4:
        subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  4×4 Landscape'
        detail   = f'{total_qs} questions  ·  9 rounds  ·  4×4 Landscape'
    elif LANDSCAPE:
        subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  36-up Landscape  ·  6×6'
        detail   = f'{total_qs} questions  ·  9 rounds  ·  36-up landscape (6×6)'
    else:
        subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  36-up Portrait  ·  6×6'
        detail   = f'{total_qs} questions  ·  9 rounds  ·  36-up portrait (6×6)'

    story.append(Paragraph(subtitle, _inner_ps('sub2', 'cover_sub', alignment=TA_CENTER)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(detail, _inner_ps('ci', 'body', alignment=TA_CENTER)))
    story.append(Paragraph(
        'High Easy → High Med → High Hard → Mid Easy → Mid Med → Mid Hard → Low Easy → Low Med → Low Hard',
        _inner_ps('ci2', 'body', alignment=TA_CENTER)))
    story.append(PageBreak())
    if GRID_2X1:
        story.append(Spacer(1, 0.1))
        story.append(PageBreak())  # one blank mini-page between cover and Contents

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph('<b>Contents</b>', _inner_ps('toch', 'title', spaceAfter=4)))
    story.append(Paragraph(
        f'<b>{premium_star_markup()} = LeetCode Premium (Premium 98 list)</b>',
        _inner_ps('tochint', 'body', spaceAfter=3)))
    story.append(hr())

    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue
        n_q = len(all_qs_in_round)
        pri_c = PRIORITY_COLORS[priority]
        ra = anchor_round(round_num)
        rnd_label = round_toc_label(round_num, priority, difficulty, n_q)
        if GRID_2X1:
            rnd_xml = _toc_link_visual(rnd_label)
        else:
            rnd_xml = _toc_link_markup(ra, rnd_label)
        row = Table([[
            Paragraph(rnd_xml, _inner_ps('toch2', 'title')),
        ]], colWidths=[USE_W])
        row.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
            ('TOPPADDING',    (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
        ]))
        story.append(row)
        pat_st = ParagraphStyle(
            'tocpat', fontName='LG-Bold', fontSize=S['toc'].fontSize,
            textColor=BLACK, leading=S['toc'].leading, spaceAfter=2,
            leftIndent=12 if GRID_2X1 else 14,
        )
        q_left = TOC_CB_PT + TOC_CB_GAP + 4 if GRID_2X1 else 28
        for pat, qs in pattern_groups:
            pa = anchor_pat(pat['name'])
            pat_label = f'{pat["name"]} ({len(qs)})'
            if GRID_2X1:
                pat_xml = _toc_link_visual(safe_xml(pat_label))
            else:
                pat_xml = _toc_link_markup(pa, safe_xml(pat_label))
            story.append(Paragraph(pat_xml, pat_st))
            for q in qs:
                label = f'{premium_question_prefix(q)}#{q["id"]} {safe_xml(q["title"])}'
                tqe_st = ParagraphStyle(
                    'tqe', fontName='LG-Bold', fontSize=S['toc'].fontSize,
                    textColor=BLACK, leading=S['toc'].leading,
                    spaceAfter=4 if GRID_2X1 else 3,
                    alignment=TA_LEFT,
                    leftIndent=q_left,
                )
                story.append(Paragraph(f'<b>{label}</b>', tqe_st))
    story.append(PageBreak())

    # ── Rounds / Chapters ─────────────────────────────────────────────────────
    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue

        pri_c = PRIORITY_COLORS[priority]
        diff_dot = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
        round_label = f'Round {round_num}  ·  {priority} · {difficulty}'

        story.append(SetRound(round_label))

        # Chapter splash page
        ra = anchor_round(round_num)
        story.append(RoundPageMark(round_num, round_page_registry))
        story += _anchor_para(ra)
        story.append(Spacer(1, USE_H * 0.12))
        banner = Table([[Paragraph(
            f'<b>Round {round_num}</b>',
            _inner_ps(
                'rnum', 'title', alignment=TA_CENTER,
                fontSize=S['title'].fontSize if GRID_2X1 else 13,
                leading=S['title'].leading if GRID_2X1 else 16,
            ),
        )]], colWidths=[USE_W])
        banner.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
            ('TOPPADDING',    (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('BOX',           (0,0), (-1,-1), 1.0, pri_c['bar']),
        ]))
        story.append(banner)
        story.append(Spacer(1, 5))

        story.append(Paragraph(
            f'<b>{priority} Priority  ·  {diff_dot} {difficulty}</b>',
            _inner_ps(
                'rlab', 'title', alignment=TA_CENTER,
                fontSize=S['title'].fontSize if GRID_2X1 else 10,
                leading=S['title'].leading if GRID_2X1 else 13,
            )))
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            f'{len(all_qs_in_round)} question{"s" if len(all_qs_in_round) != 1 else ""}  ·  '
            f'{len(pattern_groups)} pattern{"s" if len(pattern_groups) != 1 else ""}',
            _inner_ps('rct', 'body', alignment=TA_CENTER)))
        story.append(Spacer(1, 4))

        # Mini question list on splash page
        story.append(hr(GRAY_300, 0.4))
        for pat, qs in pattern_groups:
            q_ids = '  '.join(f'#{q["id"]}' for q in qs)
            story.append(Paragraph(
                f'<b>{safe_xml(pat["name"])}</b>  {safe_xml(q_ids)}',
                ParagraphStyle(
                    'splash_pat',
                    fontName='LG-Bold',
                    fontSize=S['body'].fontSize,
                    textColor=BLACK,
                    leading=S['body'].leading,
                    spaceBefore=2,
                )))
        story.append(PageBreak())

        # Questions: grouped by pattern within the round
        for pat, qs in pattern_groups:
            # Pattern sub-header mini-page
            pa = anchor_pat(pat['name'])
            story.append(PatPageMark(round_num, pat['name'], pat_page_registry))
            story += _anchor_para(pa)
            story.append(Spacer(1, USE_H * 0.15))
            pat_banner = Table([[Paragraph(
                f'<b>{safe_xml(pat["name"])}</b>',
                _inner_ps(
                    'pbnr', 'title', alignment=TA_CENTER,
                    fontSize=S['title'].fontSize if GRID_2X1 else 10,
                    leading=S['title'].leading if GRID_2X1 else 13,
                ),
            )]], colWidths=[USE_W])
            pat_banner.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,-1), GRAY_100),
                ('TOPPADDING',    (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('BOX',           (0,0), (-1,-1), 0.5, GRAY_300),
            ]))
            story.append(pat_banner)
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                f'Round {round_num}  ·  {priority} · {difficulty}  ·  {len(qs)} question{"s" if len(qs) != 1 else ""}',
                _inner_ps('psub', 'body', alignment=TA_CENTER)))
            story.append(PageBreak())

            for q in qs:
                story += build_question_block(q, sites, doocs, pat['name'], pat, my_solutions)

        # Per-round summary removed — each question now carries its own
        # inline Quick Review summary. Chapter 2 still collects all summaries.

    # Chapter 2 is now a separate PDF (--chapter2 flag). Not included here.

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f'Inner PDF: {counter.n} mini-pages → {INNER_PDF.name}')
    return counter.n, round_page_registry, pat_page_registry


# ─── All-727 inner PDF builder ────────────────────────────────────────────────
def build_all727_inner_pdf(sets_and_rounds: list, sites: dict, doocs: dict,
                            my_solutions: dict | None = None):
    """
    Builds the inner mini-page PDF for all 727 questions across 3 sets.
    sets_and_rounds: [(set_num, set_name, rounds_9), ...]
    Each rounds_9 is a 9-entry list from build_rounds_for_set().
    Output is the same visual style as build_inner_pdf() (1×1 portrait).
    """
    counter = PageCounter()
    round_page_registry: dict[int, int] = {}
    pat_page_registry: dict[tuple[int, str], int] = {}

    total_qs = sum(
        len(qs)
        for _, _, rounds in sets_and_rounds
        for _, _, _, pgs in rounds
        for _, qs in pgs
    )

    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(Paragraph(_COVER_TITLE, _inner_ps('brand', 'cover_title', alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_COVER_SUBTITLE, S['cover_title']))
    subtitle = 'Python Only  ·  Priority-Grouped  ·  Difficulty-First  ·  1×1 Portrait'
    detail   = f'{total_qs} questions  ·  3 Sets  ·  27 Rounds  ·  Inline Quick Review'
    story.append(Paragraph(subtitle, _inner_ps('sub2', 'cover_sub', alignment=TA_CENTER)))
    story.append(Spacer(1, 8))
    story.append(hr())
    story.append(Spacer(1, 5))
    story.append(Paragraph(detail, _inner_ps('ci', 'body', alignment=TA_CENTER)))
    story.append(Paragraph(
        'High Easy → High Med → High Hard → Mid Easy → Mid Med → Mid Hard → Low Easy → Low Med → Low Hard',
        _inner_ps('ci2', 'body', alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph('<b>Contents</b>', _inner_ps('toch', 'title', spaceAfter=4)))
    story.append(Paragraph(
        f'<b>{premium_star_markup()} = LeetCode Premium</b>',
        _inner_ps('tochint', 'body', spaceAfter=3)))
    story.append(hr())

    _SET_COLORS = {1: HexColor('#1E3A5F'), 2: HexColor('#1A5C36'), 3: HexColor('#5C1A1A')}

    for set_num, set_name, rounds in sets_and_rounds:
        set_qs_total = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)
        if not set_qs_total:
            continue
        set_col = _SET_COLORS.get(set_num, HexColor('#1E3A5F'))
        set_hdr = Table([[Paragraph(
            f'<font color="#FFFFFF"><b>── {safe_xml(set_name)}  ({set_qs_total} questions) ──</b></font>',
            _inner_ps(f'toc_set{set_num}', 'title', alignment=TA_CENTER),
        )]], colWidths=[USE_W])
        set_hdr.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), set_col),
            ('TOPPADDING',    (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
        ]))
        story.append(Spacer(1, 4))
        story.append(set_hdr)

        pat_st = ParagraphStyle(
            f'tocpat_{set_num}', fontName='LG-Bold', fontSize=S['toc'].fontSize,
            textColor=BLACK, leading=S['toc'].leading, spaceAfter=2, leftIndent=12,
        )
        q_left = TOC_CB_PT + TOC_CB_GAP + 4

        for round_num, priority, difficulty, pattern_groups in rounds:
            all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
            if not all_qs_in_round:
                continue
            n_q = len(all_qs_in_round)
            pri_c = PRIORITY_COLORS.get(priority, PRIORITY_COLORS['Low'])
            rnd_label = round_toc_label(round_num, priority, difficulty, n_q)
            rnd_xml   = _toc_link_visual(rnd_label)
            row = Table([[Paragraph(rnd_xml, _inner_ps(f'toch2r{round_num}', 'title'))]], colWidths=[USE_W])
            row.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
                ('TOPPADDING',    (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('LEFTPADDING',   (0,0), (-1,-1), 4),
                ('RIGHTPADDING',  (0,0), (-1,-1), 4),
            ]))
            story.append(row)
            for pat, qs in pattern_groups:
                pat_xml = _toc_link_visual(safe_xml(f'{pat["name"]} ({len(qs)})'))
                story.append(Paragraph(pat_xml, pat_st))
                for q in qs:
                    label = f'{premium_question_prefix(q)}#{q["id"]} {safe_xml(q["title"])}'
                    tqe_st = ParagraphStyle(
                        f'tqe{q["id"]}', fontName='LG-Bold', fontSize=S['toc'].fontSize,
                        textColor=BLACK, leading=S['toc'].leading,
                        spaceAfter=4, alignment=TA_LEFT, leftIndent=q_left,
                    )
                    story.append(Paragraph(f'<b>{label}</b>', tqe_st))
    story.append(PageBreak())

    # ── Content: Set → Rounds → Patterns → Questions ──────────────────────────
    for set_num, set_name, rounds in sets_and_rounds:
        set_qs_total = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)
        if not set_qs_total:
            continue
        set_col = _SET_COLORS.get(set_num, HexColor('#1E3A5F'))

        # Set splash page
        story.append(SetRound(f'{set_name}  ·  {set_qs_total} questions'))
        story.append(Spacer(1, USE_H * 0.12))
        set_banner = Table([[Paragraph(
            f'<font color="#FFFFFF"><b>{safe_xml(set_name)}</b></font>',
            _inner_ps(f'snum{set_num}', 'title', alignment=TA_CENTER,
                      fontSize=S['title'].fontSize + 2, leading=S['title'].leading + 2),
        )]], colWidths=[USE_W])
        set_banner.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), set_col),
            ('TOPPADDING',    (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('BOX',           (0,0), (-1,-1), 1.5, set_col),
        ]))
        story.append(set_banner)
        story.append(Spacer(1, 5))
        story.append(Paragraph(
            f'<b>{set_qs_total} questions  ·  9 Rounds  ·  Priority → Difficulty → Pattern</b>',
            _inner_ps(f'sct{set_num}', 'body', alignment=TA_CENTER)))
        story.append(PageBreak())

        for round_num, priority, difficulty, pattern_groups in rounds:
            all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
            if not all_qs_in_round:
                continue

            pri_c      = PRIORITY_COLORS.get(priority, PRIORITY_COLORS['Low'])
            diff_dot   = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}.get(difficulty, '')
            round_label = f'Round {round_num}  ·  {priority} · {difficulty}'
            story.append(SetRound(round_label))

            ra = anchor_round(round_num)
            story.append(RoundPageMark(round_num, round_page_registry))
            story += _anchor_para(ra)
            story.append(Spacer(1, USE_H * 0.12))
            banner = Table([[Paragraph(
                f'<b>{safe_xml(set_name)}  ·  Round {round_num}</b>',
                _inner_ps(f'rnum{round_num}', 'title', alignment=TA_CENTER,
                          fontSize=S['title'].fontSize, leading=S['title'].leading),
            )]], colWidths=[USE_W])
            banner.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,-1), pri_c['pill_bg']),
                ('TOPPADDING',    (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('BOX',           (0,0), (-1,-1), 1.0, pri_c['bar']),
            ]))
            story.append(banner)
            story.append(Spacer(1, 5))
            story.append(Paragraph(
                f'<b>{priority} Priority  ·  {diff_dot} {difficulty}</b>',
                _inner_ps(f'rlab{round_num}', 'title', alignment=TA_CENTER,
                          fontSize=S['title'].fontSize, leading=S['title'].leading)))
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                f'{len(all_qs_in_round)} question{"s" if len(all_qs_in_round) != 1 else ""}  ·  '
                f'{len(pattern_groups)} pattern{"s" if len(pattern_groups) != 1 else ""}',
                _inner_ps(f'rct{round_num}', 'body', alignment=TA_CENTER)))
            story.append(Spacer(1, 4))
            story.append(hr(GRAY_300, 0.4))
            for pat, qs in pattern_groups:
                q_ids = '  '.join(f'#{q["id"]}' for q in qs)
                story.append(Paragraph(
                    f'<b>{safe_xml(pat["name"])}</b>  {safe_xml(q_ids)}',
                    ParagraphStyle(
                        f'splash_pat{round_num}_{pat["name"][:8]}',
                        fontName='LG-Bold', fontSize=S['body'].fontSize,
                        textColor=BLACK, leading=S['body'].leading, spaceBefore=2,
                    )))
            story.append(PageBreak())

            for pat, qs in pattern_groups:
                pa = anchor_pat(pat['name'])
                story.append(PatPageMark(round_num, pat['name'], pat_page_registry))
                story += _anchor_para(pa)
                story.append(Spacer(1, USE_H * 0.15))
                pat_banner = Table([[Paragraph(
                    f'<b>{safe_xml(pat["name"])}</b>',
                    _inner_ps(f'pbnr{round_num}_{pat["name"][:8]}', 'title', alignment=TA_CENTER,
                              fontSize=S['title'].fontSize, leading=S['title'].leading),
                )]], colWidths=[USE_W])
                pat_banner.setStyle(TableStyle([
                    ('BACKGROUND',    (0,0), (-1,-1), GRAY_100),
                    ('TOPPADDING',    (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                    ('BOX',           (0,0), (-1,-1), 0.5, GRAY_300),
                ]))
                story.append(pat_banner)
                story.append(Spacer(1, 3))
                story.append(Paragraph(
                    f'{safe_xml(set_name)}  ·  Round {round_num}  ·  {priority} · {difficulty}  ·  '
                    f'{len(qs)} question{"s" if len(qs) != 1 else ""}',
                    _inner_ps(f'psub{round_num}_{pat["name"][:8]}', 'body', alignment=TA_CENTER)))
                story.append(PageBreak())

                for q in qs:
                    story += build_question_block(q, sites, doocs, pat['name'], pat, my_solutions)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f'All-727 inner PDF: {counter.n} mini-pages → {INNER_PDF.name}')
    return counter.n, round_page_registry, pat_page_registry


# ─── 36-up portrait imposer (6×6 grid, matching the original 92-page format) ──
def impose_36up_portrait(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 612.0, 792.0
    COLS, ROWS = 6, 6          # 36 mini-pages per sheet (matches original layout)
    PER_SHEET  = COLS * ROWS   # 36
    CW = L_W / COLS            # 102 pts
    RH = L_H / ROWS            # 132 pts
    GAP = 1.5                  # tighter gap at this scale

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.4)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.2, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 100, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  36-up Portrait  ·  6×6',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'36-up portrait: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')

# ─── 36-up landscape imposer (6×6 grid on 792×612 landscape letter) ──────────
def impose_36up_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0   # landscape letter (width > height)
    COLS, ROWS = 6, 6
    PER_SHEET  = COLS * ROWS    # 36
    CW = L_W / COLS             # 132 pts
    RH = L_H / ROWS             # 102 pts
    GAP = 1.5

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.4)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.2, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 120, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  36-up Landscape  ·  6×6',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'36-up landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 2×2 landscape imposer (4 per sheet on 792×612) ──────────────────────────
def impose_2x2_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0
    COLS, ROWS = 2, 2
    PER_SHEET  = COLS * ROWS    # 4
    CW = L_W / COLS             # 396 pts
    RH = L_H / ROWS             # 306 pts
    GAP = 3.0

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        shape = sheet.new_shape()
        for cx in [CW]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.6)
        shape.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 100, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  2×2 Landscape',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'2×2 landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 4×4 landscape imposer (16 per sheet on 792×612) ─────────────────────────
def impose_4x4_landscape(src_path: Path, dst_path: Path):
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0   # landscape letter
    COLS, ROWS = 4, 4
    PER_SHEET  = COLS * ROWS    # 16
    CW = L_W / COLS             # 198 pts
    RH = L_H / ROWS             # 153 pts
    GAP = 2.0

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Grid lines
        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.5)
        shape.commit()

        # Cell borders
        for j in range(min(PER_SHEET, n - i)):
            col = j % COLS
            row = j // COLS
            s2  = sheet.new_shape()
            s2.draw_rect(fitz.Rect(
                col * CW + GAP / 2, row * RH + GAP / 2,
                (col + 1) * CW - GAP / 2, (row + 1) * RH - GAP / 2,
            ))
            s2.finish(color=(0.65, 0.65, 0.65), width=0.3, fill=None)
            s2.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 110, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  4×4 Landscape',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'4×4 landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 2×1 landscape imposer (2 per sheet on 792×612) ─────────────────────────
def impose_2x1_landscape(src_path: Path, dst_path: Path):
    """2 columns × 1 row — each mini-page scales up ~1.9x for maximum readability."""
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0
    COLS, ROWS = 2, 1
    PER_SHEET  = COLS * ROWS    # 2
    CW = L_W / COLS             # 396 pts
    RH = L_H / ROWS             # 612 pts
    GAP = 3.0

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        # Centre divider line only
        shape = sheet.new_shape()
        shape.draw_line(fitz.Point(CW, 0), fitz.Point(CW, L_H))
        shape.finish(color=(0.6, 0.6, 0.6), width=0.6)
        shape.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 90, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery Study-Order  ·  2×1 Landscape',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'2×1 landscape: {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 2×1 precise link enrichment ─────────────────────────────────────────────
def _draw_toc_goto_arrow(page, line_dest: fitz.Rect, sc: float) -> fitz.Rect:
    """Draw a small ↗ after the title; return a mobile-friendly link rect."""
    sz   = TOC_CB_PT * sc
    pad  = TOC_ARROW_PAD * sc
    cx   = line_dest.x1 + pad + sz * 0.55
    cy   = (line_dest.y0 + line_dest.y1) * 0.5
    half = sz * 0.42
    p0   = fitz.Point(cx - half, cy + half)
    p1   = fitz.Point(cx + half, cy - half)
    shape = page.new_shape()
    shape.draw_line(p0, p1)
    ah = half * 0.55
    shape.draw_line(p1, fitz.Point(p1.x - ah, p1.y))
    shape.draw_line(p1, fitz.Point(p1.x, p1.y + ah))
    shape.finish(color=(0.2, 0.2, 0.2), width=max(0.7, 0.6 * sc))
    shape.commit()
    tap = max(sz * 1.6, 16.0)
    return fitz.Rect(cx - tap * 0.5, cy - tap * 0.5, cx + tap * 0.5, cy + tap * 0.5)


def _add_links_2x1(output_path: Path, page_types: dict,
                   qid_first_page: dict, toc_link_rects: dict,
                   toc_section_rects: dict,
                   round_page_registry: dict,
                   pat_page_registry: dict,
                   qid_difficulty: dict = None,
                   per_sheet: int = 2, cols: int = 2,
                   src_w: float = 204.0, src_h: float = 264.0,
                   L_W: float = 792.0, L_H: float = 612.0, GAP: float = 3.0):
    """
    Post-process 2×1 PDF:
      • Round / pattern TOC lines → jump to chapter or pattern page
      • ↗ arrow after each TOC question → jumps to that question (title text not linked)
      • Draw visible checkbox squares + difficulty dot on TOC entries
      • Per-slot '← Contents' button on every non-TOC sheet (smart TOC y-scroll)
      • Master Done checkbox + → Next button at top of each question cell
      • Checkboxes beside each solution label (● WalkCC etc.) on question pages
    """
    _SOL_LABELS   = ['● My LeetCode Solution'] + [f'● {site_label}' for _, site_label in SITE_META]
    _qid_diff     = qid_difficulty or {}
    _DIFF_COLOR   = {
        'Easy':   (0.13, 0.77, 0.37),   # green
        'Medium': (0.98, 0.45, 0.09),   # orange
        'Hard':   (0.93, 0.27, 0.27),   # red
    }
    CW = L_W / cols   # 396
    RH = L_H          # 612 (single row)

    def cell_transform(slot):
        col = slot % cols
        cx0, cy0 = col * CW + GAP, GAP
        cw,  ch  = CW - 2 * GAP, RH - 2 * GAP
        sc = min(cw / src_w, ch / src_h)
        ox = (cw - src_w * sc) / 2
        oy = (ch - src_h * sc) / 2
        return cx0, cy0, ox, oy, sc

    def tx_rect(r, cx0, cy0, ox, oy, sc):
        return fitz.Rect(cx0 + ox + r.x0 * sc, cy0 + oy + r.y0 * sc,
                         cx0 + ox + r.x1 * sc, cy0 + oy + r.y1 * sc)

    # Build inner_page_current_qid early so pre-scan can use it for title searches.
    _first_page_to_qid_pre = {pg: qid for qid, pg in qid_first_page.items()}
    _max_ip = max(page_types.keys(), default=0)
    inner_page_current_qid_pre: dict = {}
    _cur = None
    for _ip in range(_max_ip + 1):
        if _ip in _first_page_to_qid_pre:
            _cur = _first_page_to_qid_pre[_ip]
        inner_page_current_qid_pre[_ip] = _cur

    # sorted study order for → Next / ← Prev links
    _sorted_qids = sorted(qid_first_page.keys(), key=lambda q: qid_first_page[q])
    _qid_next    = {_sorted_qids[i]: _sorted_qids[i + 1]
                    for i in range(len(_sorted_qids) - 1)}
    _qid_prev    = {_sorted_qids[i + 1]: _sorted_qids[i]
                    for i in range(len(_sorted_qids) - 1)}

    # Pre-scan: collect sol label rects from the clean output PDF before any modifications.
    # Page modifications (draw_rect / insert_text) corrupt the in-memory search index, so
    # we read in a separate pass and close before opening for writing.
    toc_inner  = [pg for pg, t in page_types.items() if t == 'toc']
    toc_sheets_pre = set(pg // per_sheet for pg in toc_inner)
    sol_output_rects: dict = {}
    title_output_rects: dict = {}   # inner_pg → fitz.Rect of "#qid" text in output PDF
    _scan_doc = fitz.open(str(output_path))
    for _sh in range(len(_scan_doc)):
        if _sh in toc_sheets_pre:
            continue
        for _slot in range(per_sheet):
            _inner_pg = _sh * per_sheet + _slot
            _slot_x0 = _slot * CW
            _clip = fitz.Rect(_slot_x0, 0, _slot_x0 + CW, L_H)
            _hits = []
            for _lbl in _SOL_LABELS:
                for _r in _scan_doc[_sh].search_for(_lbl, clip=_clip):
                    _hits.append((_lbl, _r))
            if _hits:
                sol_output_rects[(_sh, _slot)] = _hits
            # Title scan: only for first page of each question.
            # Search "★ #qid" first — if the title has a premium-star prefix, include
            # it in the anchor rect so the checkbox lands LEFT of the star, not on it.
            _qid = inner_page_current_qid_pre.get(_inner_pg)
            if _qid and qid_first_page.get(_qid) == _inner_pg:
                _t = (
                    _scan_doc[_sh].search_for(f'★ #{_qid} ', clip=_clip)
                    or _scan_doc[_sh].search_for(f'★ #{_qid}', clip=_clip)
                    or _scan_doc[_sh].search_for(f'#{_qid} ', clip=_clip)
                    or _scan_doc[_sh].search_for(f'#{_qid}', clip=_clip)
                )
                if _t:
                    title_output_rects[_inner_pg] = _t[0]
    _scan_doc.close()

    doc = fitz.open(str(output_path))

    toc_inner  = [pg for pg, t in page_types.items() if t == 'toc']
    toc_sheets = set(pg // per_sheet for pg in toc_inner)
    toc_sheet0 = min(toc_sheets) if toc_sheets else 1
    qid_sheet  = {qid: pg // per_sheet for qid, pg in qid_first_page.items()}
    # Which slot (column) does each question's inner page land in?
    qid_slot   = {qid: pg % per_sheet for qid, pg in qid_first_page.items()}

    def _dest_slot(inner_pg: int) -> tuple[int, float]:
        sheet = inner_pg // per_sheet
        slot = inner_pg % per_sheet
        return sheet, slot * CW

    n_links = n_boxes = n_sec = 0

    for inner_pg, sections in toc_section_rects.items():
        slot   = inner_pg % per_sheet
        out_sh = inner_pg // per_sheet
        txfm   = cell_transform(slot)
        sc_sec = txfm[4]
        out_pg = doc[out_sh]
        for kind, key, line_src in sections:
            if kind == 'round':
                inner_dest = round_page_registry.get(key)
            else:
                inner_dest = pat_page_registry.get(key)
            if inner_dest is None:
                continue
            dest_sheet, dest_x = _dest_slot(inner_dest)
            line_dest = tx_rect(line_src, *txfm)
            if kind == 'round':
                # Round needle only captures "Round N | Priority", missing "| Diff (N)".
                # Back-calculate anchor.x1 so the arrow centre lands near the cell's
                # right edge but stays fully inside it.
                _sz  = TOC_CB_PT * sc_sec
                _pad = TOC_ARROW_PAD * sc_sec
                _tap = max(_sz * 1.6, 16.0)
                _cx  = slot * CW + CW - GAP - _tap / 2 - 2
                anchor = fitz.Rect(line_dest.x0, line_dest.y0,
                                   _cx - _pad - _sz * 0.55, line_dest.y1)
            else:
                anchor = line_dest
            arrow_rect = _draw_toc_goto_arrow(out_pg, anchor, sc_sec)
            out_pg.insert_link({
                'kind': fitz.LINK_GOTO,
                'from': arrow_rect,
                'page': dest_sheet,
                'to':   fitz.Point(dest_x, 0),
                'zoom': 0,
            })
            n_sec += 1

    for inner_pg, rects in toc_link_rects.items():
        slot   = inner_pg % per_sheet
        out_sh = inner_pg // per_sheet
        txfm   = cell_transform(slot)
        out_pg = doc[out_sh]

        for qid, rect_info in rects.items():
            dest       = qid_sheet.get(qid)
            dest_slot  = qid_slot.get(qid, 0)

            cx0, cy0, ox, oy, sc = txfm
            line_dest = tx_rect(rect_info['line'], cx0, cy0, ox, oy, sc)

            # ↗ arrow link — only tap target to open the question
            if dest is not None:
                dest_x = dest_slot * CW
                arrow_rect = _draw_toc_goto_arrow(out_pg, line_dest, sc)
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO,
                    'from': arrow_rect,
                    'page': dest,
                    'to':   fitz.Point(dest_x, 0),
                    'zoom': 0,
                })
                n_links += 1

            # Checkbox to the left of the entry line (scale with imposed cell)
            cb_h   = TOC_CB_PT * sc
            gap    = TOC_CB_GAP * sc
            cb_y0  = line_dest.y0 + (line_dest.height - cb_h) / 2
            cb_x1  = line_dest.x0 - gap
            cb_x0  = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            out_pg.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                             fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            widget = fitz.Widget()
            widget.rect        = cb_rect
            widget.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            widget.field_name  = f'done_{qid}'
            widget.field_value = 'Off'
            widget.on_state    = 'Yes'
            out_pg.add_widget(widget)
            n_boxes += 1

            # Difficulty dot: colored circle in the gap between checkbox and line text
            diff_str   = _qid_diff.get(qid, 'Easy')
            dot_color  = _DIFF_COLOR.get(diff_str, _DIFF_COLOR['Easy'])
            dot_r      = cb_h * 0.38
            dot_cx     = (cb_x1 + line_dest.x0) / 2
            dot_cy     = line_dest.y0 + line_dest.height / 2
            shape = out_pg.new_shape()
            shape.draw_circle(fitz.Point(dot_cx, dot_cy), dot_r)
            shape.finish(color=dot_color, fill=dot_color, width=0.3)
            shape.commit()

    # Build qid → (toc_output_sheet, fitz.Point) for smart ← Contents
    qid_toc_dest: dict = {}
    for inner_pg, rects in toc_link_rects.items():
        slot   = inner_pg % per_sheet
        out_sh = inner_pg // per_sheet
        cx0, cy0, ox, oy, sc = cell_transform(slot)
        for qid, rect_info in rects.items():
            if qid in qid_toc_dest:
                continue  # keep first occurrence (the TOC page)
            line_dest = tx_rect(rect_info['line'], cx0, cy0, ox, oy, sc)
            qid_toc_dest[qid] = (out_sh, fitz.Point(slot * CW, line_dest.y0))

    # Alias (already built before pre-scan; used throughout the modification pass)
    inner_page_current_qid = inner_page_current_qid_pre

    # Per-slot ← Contents buttons: each cell gets its own button pointing to that
    # question's exact y-position in the TOC (not the top of the TOC page).
    BW, BH = 110, 18
    n_sheets = len(doc)
    n_contents_btns = 0
    for sh in range(n_sheets):
        if sh in toc_sheets:
            continue
        out_pg = doc[sh]
        for slot in range(per_sheet):
            inner_pg = sh * per_sheet + slot
            qid = inner_page_current_qid.get(inner_pg)
            if qid and qid in qid_toc_dest:
                dest_sh, dest_pt = qid_toc_dest[qid]
            else:
                dest_sh, dest_pt = toc_sheet0, fitz.Point(slot * CW, 0)
            slot_x0 = slot * CW
            btn = fitz.Rect(slot_x0 + CW - BW - 6, 5, slot_x0 + CW - 6, 5 + BH)
            out_pg.draw_rect(btn, color=(0.22, 0.28, 0.90), fill=(0.08, 0.08, 0.45), width=1.0)
            out_pg.insert_text(fitz.Point(btn.x0 + 7, btn.y0 + 12),
                               '← Contents', fontsize=max(7, TOC_CB_PT + 1),
                               color=(1.0, 1.0, 1.0), fontname='helv')
            out_pg.insert_link({'kind': fitz.LINK_GOTO, 'from': btn,
                                'page': dest_sh, 'to': dest_pt, 'zoom': 0})
            n_contents_btns += 1

    # Checkboxes beside each solution label using pre-scanned rects (scan was done
    # before any page modifications so the search index was still clean).
    n_sol_boxes = 0
    for (sh, slot), hits in sol_output_rects.items():
        out_pg   = doc[sh]
        inner_pg = sh * per_sheet + slot
        slot_x0  = slot * CW
        qid      = inner_page_current_qid.get(inner_pg, 0)
        _, _, _, _, sc = cell_transform(slot)
        cb_h = TOC_CB_PT * sc
        gap  = TOC_CB_GAP * sc
        for label, label_r in hits:
            cb_y0 = label_r.y0 + (label_r.height - cb_h) / 2
            cb_x1 = label_r.x0 - gap
            cb_x0 = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            out_pg.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                             fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            label_slug = label.replace('● ', '').lower().replace('.', '').replace(' ', '_')
            widget = fitz.Widget()
            widget.rect        = cb_rect
            widget.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            widget.field_name  = f'sol_{qid}_{label_slug}_{sh}_{slot}'
            widget.field_value = 'Off'
            widget.on_state    = 'Yes'
            out_pg.add_widget(widget)
            n_sol_boxes += 1

    # ── Master Done checkbox (next to title) + → Next button (top band) ──────────
    # Done: only on the first page of each question, anchored to the #qid title line.
    # → Next: top-band navigation on every question page.
    CB_SZ   = max(11.0, TOC_CB_PT - 1)
    BW_N, BH_N = 75, 18
    n_done = n_next = 0
    qid_sheet_map = {qid: pg // per_sheet for qid, pg in qid_first_page.items()}
    qid_slot_map  = {qid: pg % per_sheet  for qid, pg in qid_first_page.items()}

    for sh in range(n_sheets):
        if sh in toc_sheets:
            continue
        out_pg = doc[sh]
        for slot in range(per_sheet):
            inner_pg = sh * per_sheet + slot
            qid = inner_page_current_qid.get(inner_pg)
            if not qid:
                continue
            slot_x0 = slot * CW
            is_first = (qid_first_page.get(qid) == inner_pg)

            # ☐ Done — only on first page, left of the #qid title heading
            if is_first:
                title_r = title_output_rects.get(inner_pg)
                if title_r is not None:
                    cb_y0d = title_r.y0 + (title_r.height - CB_SZ) / 2
                    cb_x0d = max(slot_x0 + 2, title_r.x0 - CB_SZ - 4)
                else:
                    cb_y0d = 5 + (BH_N - CB_SZ) / 2
                    cb_x0d = slot_x0 + 6
                done_cb = fitz.Rect(cb_x0d, cb_y0d, cb_x0d + CB_SZ, cb_y0d + CB_SZ)
                out_pg.draw_rect(done_cb, color=(0.13, 0.77, 0.37), fill=(1.0, 1.0, 1.0),
                                 width=1.2, overlay=True)
                wd = fitz.Widget()
                wd.rect        = done_cb
                wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
                wd.field_name  = f'master_{qid}_{sh}_{slot}'
                wd.field_value = 'Off'
                wd.on_state    = 'Yes'
                out_pg.add_widget(wd)
                n_done += 1

            # ← Prev / → Next — top-band buttons on every question page
            prev_qid = _qid_prev.get(qid)
            next_qid = _qid_next.get(qid)
            btn_x0   = slot_x0 + 6
            if prev_qid is not None:
                prev_sh   = qid_sheet_map.get(prev_qid)
                prev_slot = qid_slot_map.get(prev_qid, 0)
                if prev_sh is not None:
                    btn_prev = fitz.Rect(btn_x0, 5, btn_x0 + BW_N, 5 + BH_N)
                    out_pg.draw_rect(btn_prev, color=(0.22, 0.28, 0.90),
                                     fill=(0.08, 0.08, 0.45), width=1.0)
                    out_pg.insert_text(fitz.Point(btn_prev.x0 + 6, btn_prev.y0 + 12),
                                       f'← #{prev_qid}', fontsize=max(7, TOC_CB_PT + 1),
                                       color=(1.0, 1.0, 1.0), fontname='helv')
                    out_pg.insert_link({
                        'kind': fitz.LINK_GOTO, 'from': btn_prev,
                        'page': prev_sh, 'to': fitz.Point(prev_slot * CW, 0), 'zoom': 0,
                    })
                    btn_x0 += BW_N + 4
            if next_qid is not None:
                next_sh   = qid_sheet_map.get(next_qid)
                next_slot = qid_slot_map.get(next_qid, 0)
                if next_sh is not None:
                    btn_nav = fitz.Rect(btn_x0, 5, btn_x0 + BW_N, 5 + BH_N)
                    out_pg.draw_rect(btn_nav, color=(0.22, 0.28, 0.90),
                                     fill=(0.08, 0.08, 0.45), width=1.0)
                    out_pg.insert_text(fitz.Point(btn_nav.x0 + 6, btn_nav.y0 + 12),
                                       f'#{next_qid} →', fontsize=max(7, TOC_CB_PT + 1),
                                       color=(1.0, 1.0, 1.0), fontname='helv')
                    out_pg.insert_link({
                        'kind': fitz.LINK_GOTO, 'from': btn_nav,
                        'page': next_sh, 'to': fitz.Point(next_slot * CW, 0), 'zoom': 0,
                    })
                    n_next += 1

    tmp = output_path.with_suffix('.tmp.pdf')
    doc.save(str(tmp), garbage=4, deflate=True, incremental=False)
    doc.close()
    import shutil as _shutil
    _shutil.move(str(tmp), str(output_path))
    print(f'  Links: {n_links} question (↗)  |  {n_sec} round/pattern  |  '
          f'TOC checkboxes: {n_boxes}  |  Diff dots: {n_boxes}  |  '
          f'Sol checkboxes: {n_sol_boxes}  |  Done checkboxes: {n_done}  |  '
          f'Next buttons: {n_next}  |  ← Contents: {n_contents_btns} slot buttons')


# ─── Chapter-2-only inner PDF builder ────────────────────────────────────────
def build_chapter2_inner(rounds: list):
    """Builds an inner PDF containing ONLY the master quick-review summaries."""
    counter = PageCounter()
    doc = SimpleDocTemplate(
        str(INNER_PDF),
        pagesize=(MP_W, MP_H),
        rightMargin=MG, leftMargin=MG,
        topMargin=MG, bottomMargin=MG + 5,
    )
    story = []

    # Cover splash
    story.append(Spacer(1, USE_H * 0.12))
    banner = Table([[Paragraph(
        '<b>Chapter 2</b>',
        ParagraphStyle('ch2cn', fontName='LG-Bold', fontSize=14,
                       textColor=BLACK, alignment=TA_CENTER),
    )]], colWidths=[USE_W])
    banner.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), HexColor('#EFF6FF')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('BOX',           (0,0), (-1,-1), 1.0, HexColor('#3B82F6')),
    ]))
    story.append(banner)
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        '<b>Master Quick-Review Summary</b>',
        ParagraphStyle('ch2ct', fontName='LG-Bold', fontSize=10,
                       textColor=BLACK, alignment=TA_CENTER, leading=13)))
    story.append(Spacer(1, 3))
    total = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)
    story.append(Paragraph(
        f'{total} questions  ·  9 rounds  ·  key insights · complexity · solution',
        ParagraphStyle('ch2cs', fontName='LG-Bold', fontSize=6,
                       textColor=BLACK, alignment=TA_CENTER)))
    story.append(Paragraph(
        'High Easy → High Med → High Hard → Mid Easy → Mid Med → Mid Hard → Low Easy → Low Med → Low Hard',
        ParagraphStyle('ch2cs2', fontName='LG-Bold', fontSize=5.5,
                       textColor=BLACK, alignment=TA_CENTER, leading=8)))
    story.append(PageBreak())

    for round_num, priority, difficulty, pattern_groups in rounds:
        story += build_round_summary(round_num, priority, difficulty,
                                     pattern_groups, chapter2=True)

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f'Chapter 2 inner: {counter.n} mini-pages → {INNER_PDF.name}')
    return counter.n


# ─── 1×1 landscape imposer (one mini-page per full landscape sheet) ──────────
def impose_1x1_portrait(src_path: Path, dst_path: Path):
    """
    Each inner mini-page (204×264) fills one landscape letter sheet (792×612).
    Scales up ~3× on the long axis — large, readable quick-review pages.
    """
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H = 792.0, 612.0   # landscape letter
    GAP = 8.0

    for i in range(n):
        sheet = dst.new_page(width=L_W, height=L_H)
        rect  = fitz.Rect(GAP, GAP, L_W - GAP, L_H - GAP)
        sheet.show_pdf_page(rect, src, i)

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 110, L_H - 4),
            f'Page {pg_idx + 1}/{num_sheets}  ·  LeetMastery Chapter 2 · Quick-Review Summary',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'1×1 portrait: {n} pages → {dst_path.name}')


# ─── 2×2 link enrichment ─────────────────────────────────────────────────────

def _find_toc_entry_rects(page, qid: int):
    """Return {line, title} inner-page rects for a TOC entry."""
    prefix = f'#{qid} '
    pat_q  = re.compile(rf'#{qid}\b')
    for block in page.get_text('dict').get('blocks', []):
        if block.get('type') != 0:
            continue
        for line in block.get('lines', []):
            spans = line['spans']
            text  = ''.join(s['text'] for s in spans)
            if not pat_q.search(text):
                continue
            x0, y0, x1, y1 = line['bbox']
            line_rect = fitz.Rect(x0, y0, x1, y1)

            title_x0 = x1
            if prefix in text:
                need, consumed = len(prefix), 0
                for s in spans:
                    st = s['text']
                    sx0, _, sx1, _ = s['bbox']
                    if consumed + len(st) <= need:
                        consumed += len(st)
                        continue
                    if consumed >= need:
                        title_x0 = sx0
                    else:
                        off = need - consumed
                        title_x0 = sx0 + (off / len(st)) * (sx1 - sx0)
                    break

            title_rect = fitz.Rect(title_x0, y0 - 2, x1, y1 + 2)
            return {'line': line_rect, 'title': title_rect}

    hits = page.search_for(f'#{qid} ')
    if not hits:
        hits = page.search_for(f'#{qid}')
    if hits:
        r = hits[0]
        return {
            'line':  fitz.Rect(r.x0, r.y0, r.x1, r.y1),
            'title': fitz.Rect(r.x1, r.y0, r.x1 + 1, r.y1),
        }
    return None


def _find_toc_line_rect(page, qid: int):
    """Full-line bbox for a TOC entry."""
    entry = _find_toc_entry_rects(page, qid)
    return entry['line'] if entry else None


def _find_text_line_rect(page, needle: str):
    """BBox of the first text line containing needle (case-insensitive)."""
    nlow = needle.lower()
    for block in page.get_text('dict').get('blocks', []):
        if block.get('type') != 0:
            continue
        for line in block.get('lines', []):
            text = ''.join(s['text'] for s in line['spans'])
            if nlow in text.lower():
                x0, y0, x1, y1 = line['bbox']
                return fitz.Rect(x0, y0, x1, y1)
    hits = page.search_for(needle)
    return hits[0] if hits else None


def _analyze_inner_for_links(inner_pdf_path: Path, rounds: list):
    """
    Scan the inner PDF and return:
      page_types         {inner_pg → 'toc'|'question'|'chapter'|'other'}
      qid_first_page     {qid → inner_pg of first occurrence}
      toc_link_rects     {inner_pg → {qid → {line, title}}}
      toc_section_rects  {inner_pg → [(kind, key, fitz.Rect)]}  kind: 'round'|'pat'
      ia_first_page      {qid → inner_pg where interview approach begins}
    """
    doc        = fitz.open(str(inner_pdf_path))
    all_ids    = {q['id'] for _, _, _, pgs in rounds for _, qs in pgs for q in qs}
    qid_re     = re.compile(r'#(\d+)')
    marker_re  = re.compile(r'##QID=(\d+)##')
    ia_re      = re.compile(r'##IA=(\d+)##')

    page_types         = {}
    qid_first_page     = {}
    toc_link_rects     = {}
    toc_section_rects  = {}
    ia_first_page      = {}
    prev_was_toc       = False

    for pg in range(len(doc)):
        page   = doc[pg]
        text   = page.get_text()
        found  = [int(m.group(1)) for m in qid_re.finditer(text) if int(m.group(1)) in all_ids]
        unique = list(dict.fromkeys(found))   # dedupe, preserve order

        # Collect interview-approach start pages from ##IA=N## markers.
        for _m in ia_re.finditer(text):
            _ia_qid = int(_m.group(1))
            if _ia_qid not in ia_first_page:
                ia_first_page[_ia_qid] = pg

        # Round overview banner pages carry an invisible ##RNDBNR## marker so they
        # are always classified as 'chapter' regardless of prev_was_toc state.
        if '##RNDBNR##' in text:
            page_types[pg] = 'chapter'
            prev_was_toc = False
            continue

        # Check for round/pattern markers on any non-question page with QIDs.
        # Per-pattern section mini-TOC pages may carry fewer than 5 QIDs when
        # a pattern has only 1–4 problems, so this check must precede the ≥5 gate.
        if unique and not marker_re.search(text):
            # Pass 1: find which round headers are present on this page.
            sections = []
            rounds_on_page: set = set()
            for round_num, priority, difficulty, pattern_groups in rounds:
                n_q = sum(len(qs) for _, qs in pattern_groups)
                if n_q == 0:
                    continue
                rnd_needle = f'Round {round_num}  |  {priority}'
                rrect = _find_text_line_rect(page, rnd_needle)
                if rrect is not None:
                    sections.append(('round', round_num, rrect))
                    rounds_on_page.add(round_num)
            # Pass 2: only add pattern entries for rounds whose header is on this page.
            # Prevents false matches when two rounds share the same pattern name+count
            # (e.g. both have "Two Pointers (5)"), which would let a later round's link
            # overwrite the correct link already drawn for an earlier round.
            for round_num, priority, difficulty, pattern_groups in rounds:
                if round_num not in rounds_on_page:
                    continue
                for pat_obj, qs in pattern_groups:
                    prect = _find_text_line_rect(page, f'{pat_obj["name"]} ({len(qs)})')
                    if prect is not None:
                        sections.append(('pat', (round_num, pat_obj['name']), prect))

            if sections:
                # Confirmed real TOC page
                page_types[pg] = 'toc'
                rects = {}
                for qid in unique:
                    entry = _find_toc_entry_rects(page, qid)
                    if entry is None:
                        continue
                    rects[qid] = entry
                toc_link_rects[pg] = rects
                toc_section_rects[pg] = sections
                prev_was_toc = True
                continue

        if len(unique) >= 5:
            # No round/pattern markers found. Use y-spread to distinguish chapter
            # splash from question pages with many cross-references on one line.
            sample_ys = []
            for qid in unique[:6]:
                h = page.search_for(f'#{qid} ') or page.search_for(f'#{qid}')
                if h:
                    sample_ys.append(h[0].y0)
            y_spread = (max(sample_ys) - min(sample_ys)) if len(sample_ys) >= 2 else 0

            # ##QID=N## means this is definitely a question start, not a banner.
            if y_spread < 12 and not marker_re.search(text):
                # Distinguish: pattern banner (follows its own per-pattern mini-TOC)
                # vs round/group banner (follows master Contents or question pages).
                page_types[pg] = 'pat_banner' if prev_was_toc else 'chapter'
                prev_was_toc = False
                continue

            # Mini-TOC continuation: Round header only on the first page; later
            # pages keep the vertical #qid Title list without a Round marker.
            # Guard: if the page carries a ##QID=N## question-start marker it is
            # a question page, not a TOC tail — even when prev_was_toc is True.
            if prev_was_toc and not marker_re.search(text):
                page_types[pg] = 'toc'
                rects = {}
                for qid in unique:
                    entry = _find_toc_entry_rects(page, qid)
                    if entry is None:
                        continue
                    rects[qid] = entry
                toc_link_rects[pg] = rects
                continue

            # No round markers found — it's a question page with many cross-references.
            # Fall through to the question-page handler below.

        # Short mini-TOC tail (<5 QIDs left) — still a TOC page, not a question.
        if prev_was_toc and unique and not marker_re.search(text):
            sample_ys = []
            for qid in unique[:6]:
                h = page.search_for(f'#{qid} ') or page.search_for(f'#{qid}')
                if h:
                    sample_ys.append(h[0].y0)
            y_spread = (max(sample_ys) - min(sample_ys)) if len(sample_ys) >= 2 else 99
            if len(unique) == 1 or y_spread >= 12:
                page_types[pg] = 'toc'
                rects = {}
                for qid in unique:
                    entry = _find_toc_entry_rects(page, qid)
                    if entry is None:
                        continue
                    rects[qid] = entry
                toc_link_rects[pg] = rects
                continue
            # QIDs on one horizontal line after a toc page → pattern banner
            # (small pattern with < 5 questions whose banner follows its mini-TOC).
            page_types[pg] = 'pat_banner'
            prev_was_toc = False
            continue

        if unique:
            page_types[pg] = 'question'
            prev_was_toc = False
            # ONLY the ##QID=N## marker can register qid_first_page.
            # Continuation pages cross-reference other question IDs (e.g. Q54's
            # Phase 6 says "(#59)", Q112's says "(#113)"). Without this guard,
            # those cross-references corrupt qid_first_page for questions that
            # appear later in the PDF, making Next/Prev land on wrong pages.
            m = marker_re.search(text)
            if m:
                primary = int(m.group(1))
                if primary in all_ids and primary not in qid_first_page:
                    qid_first_page[primary] = pg
        else:
            page_types[pg] = 'other'
            prev_was_toc = False

    doc.close()
    return page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page


def _add_links_2x2(output_path: Path, page_types: dict,
                   qid_first_page: dict, toc_link_rects: dict,
                   per_sheet: int = 4, cols: int = 2,
                   src_w: float = 204.0, src_h: float = 264.0,
                   L_W: float = 792.0, L_H: float = 612.0, GAP: float = 3.0):
    """
    Post-process the imposed 2×2 PDF:
      • Add clickable link on every TOC question entry → jumps to that question's sheet
      • Add '← Contents' button in top-right corner of every non-TOC sheet
    """
    CW   = L_W / cols
    RH   = L_H / (per_sheet // cols)

    def cell_transform(slot):
        col = slot % cols
        row = slot // cols
        cx0, cy0 = col * CW + GAP, row * RH + GAP
        cw,  ch  = CW - 2 * GAP, RH - 2 * GAP
        sc = min(cw / src_w, ch / src_h)
        ox = (cw - src_w * sc) / 2
        oy = (ch - src_h * sc) / 2
        return cx0, cy0, ox, oy, sc

    def tx_rect(r, cx0, cy0, ox, oy, sc):
        return fitz.Rect(cx0 + ox + r.x0 * sc, cy0 + oy + r.y0 * sc,
                         cx0 + ox + r.x1 * sc, cy0 + oy + r.y1 * sc)

    doc = fitz.open(str(output_path))

    toc_inner  = [pg for pg, t in page_types.items() if t == 'toc']
    toc_sheets = set(pg // per_sheet for pg in toc_inner)
    toc_sheet0 = min(toc_sheets) if toc_sheets else 1
    qid_sheet  = {qid: pg // per_sheet for qid, pg in qid_first_page.items()}

    # ── TOC → question links + checkboxes ────────────────────────────────────
    n_links = 0
    n_boxes = 0
    for inner_pg, rects in toc_link_rects.items():
        slot   = inner_pg % per_sheet
        out_sh = inner_pg // per_sheet
        txfm   = cell_transform(slot)
        out_pg = doc[out_sh]
        for qid, rect_info in rects.items():
            dest = qid_sheet.get(qid)

            # Support both key formats: old ('row'/'txt') and new ('line'/'title')
            # 'line' = full text line bbox (starts at '#'), 'title' = after #id prefix
            line_src = rect_info.get('row') or rect_info.get('line')
            if line_src is None:
                continue

            if dest is not None:
                row_dest = tx_rect(line_src, *txfm)
                cx0, cy0, ox, oy, sc = txfm
                arr_font = max(4, row_dest.height * 0.75)
                # Place '>' at the cell's right edge — never overlaps title text
                cell_right = cx0 + (L_W / cols) - GAP
                arr_x = cell_right - arr_font * 1.4
                arr_y = row_dest.y1 - row_dest.height * 0.1
                out_pg.insert_text(fitz.Point(arr_x, arr_y), '>',
                                   fontsize=arr_font, color=(0.4, 0.4, 0.4),
                                   fontname='helv')
                # Link covers ONLY the '>' glyph area — not the number/title
                arr_rect = fitz.Rect(arr_x - 1, row_dest.y0,
                                     arr_x + arr_font + 1, row_dest.y1)
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO,
                    'from': arr_rect,
                    'page': dest,
                    'to':   fitz.Point(0, 0),
                    'zoom': 0,
                })
                n_links += 1

            # Checkbox — anchored to the LEFT of the '#' character (line_src.x0)
            # Using line_src ensures the box sits before '#id', not between id and title
            txt_dest = tx_rect(line_src, *txfm)
            cb_h   = 7.0                               # 7pt fits inside 8.5pt line spacing
            cb_y0  = txt_dest.y0 + (txt_dest.height - cb_h) / 2
            cb_x1  = txt_dest.x0 - 3                  # just left of the '#'
            cb_x0  = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)

            # Draw a visible empty square so it shows regardless of viewer mode
            out_pg.draw_rect(cb_rect,
                             color=(0.2, 0.2, 0.2),   # dark border
                             fill=(1.0, 1.0, 1.0),    # white fill
                             width=0.8, overlay=True)

            # AcroForm widget on top — provides interactive check state
            widget = fitz.Widget()
            widget.rect        = cb_rect
            widget.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            widget.field_name  = f'done_{qid}'
            widget.field_value = 'Off'
            widget.on_state    = 'Yes'
            out_pg.add_widget(widget)
            n_boxes += 1

    # ── "← Contents" button on every non-TOC sheet ───────────────────────────
    BW, BH = 90, 14
    btn = fitz.Rect(L_W - BW - 6, 4, L_W - 6, 4 + BH)
    n_sheets = len(doc)
    for sh in range(n_sheets):
        if sh in toc_sheets:
            continue
        pg = doc[sh]
        pg.draw_rect(btn, color=(0.31, 0.38, 0.94), fill=(0.12, 0.11, 0.29), width=0.5)
        pg.insert_text(fitz.Point(btn.x0 + 6, btn.y0 + 9),
                       '← Contents', fontsize=7,
                       color=(0.82, 0.82, 1.0), fontname='helv')
        pg.insert_link({
            'kind': fitz.LINK_GOTO,
            'from': btn,
            'page': toc_sheet0,
            'to':   fitz.Point(0, 0),
            'zoom': 0,
        })

    # Save to temp then replace (avoids in-place write conflicts)
    tmp = output_path.with_suffix('.tmp.pdf')
    doc.save(str(tmp), garbage=4, deflate=True, incremental=False)
    doc.close()
    import shutil as _shutil
    _shutil.move(str(tmp), str(output_path))
    print(f'  Links: {n_links} TOC→question  |  Checkboxes: {n_boxes}  |  ← Contents: {n_sheets - len(toc_sheets)} sheets')


# ─── 6×4 landscape imposer — print edition (24 per sheet, landscape 792×612) ──
def impose_6x4_landscape(src_path: Path, dst_path: Path):
    """
    6 columns × 4 rows = 24 mini-pages per sheet on landscape letter.
    Cells are 132×153 pts — wider than 6×6 so portrait inner pages fill
    the height better, making text more readable when printed.
    No interactive features (checkboxes/links) — optimised for paper.
    """
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)

    L_W, L_H  = 792.0, 612.0   # landscape letter
    COLS, ROWS = 6, 4
    PER_SHEET  = COLS * ROWS    # 24
    CW = L_W / COLS             # 132 pts
    RH = L_H / ROWS             # 153 pts
    GAP = 1.5

    for i in range(0, n, PER_SHEET):
        sheet = dst.new_page(width=L_W, height=L_H)
        for j in range(min(PER_SHEET, n - i)):
            col  = j % COLS
            row  = j // COLS
            rect = fitz.Rect(
                col * CW + GAP, row * RH + GAP,
                (col + 1) * CW - GAP, (row + 1) * RH - GAP,
            )
            sheet.show_pdf_page(rect, src, i + j)

        shape = sheet.new_shape()
        for cx in [CW * c for c in range(1, COLS)]:
            shape.draw_line(fitz.Point(cx, 0), fitz.Point(cx, L_H))
        for ry in [RH * r for r in range(1, ROWS)]:
            shape.draw_line(fitz.Point(0, ry), fitz.Point(L_W, ry))
        shape.finish(color=(0.5, 0.5, 0.5), width=0.4)
        shape.commit()

    num_sheets = len(dst)
    for pg_idx in range(num_sheets):
        dst[pg_idx].insert_text(
            fitz.Point(L_W / 2 - 120, L_H - 3),
            f'Sheet {pg_idx + 1}/{num_sheets}  ·  LeetMastery  ·  6×4 Print Edition',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )

    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'6×4 landscape (print): {n} mini-pages → {num_sheets} sheets → {dst_path.name}')


# ─── 1×1 imposer (study-order edition, correct footer) ───────────────────────
def _impose_1up(src_path: Path, dst_path: Path,
                L_W: float = 612.0, L_H: float = 792.0, GAP: float = 8.0):
    """Each inner mini-page fills one portrait letter sheet. Study-order footer."""
    src = fitz.open(str(src_path))
    dst = fitz.open()
    n   = len(src)
    for i in range(n):
        sheet = dst.new_page(width=L_W, height=L_H)
        sheet.show_pdf_page(fitz.Rect(GAP, GAP, L_W - GAP, L_H - GAP), src, i)
    for idx in range(len(dst)):
        dst[idx].insert_text(
            fitz.Point(L_W / 2 - 130, L_H - 4),
            f'Page {idx + 1}/{len(dst)}  ·  LeetMastery Study-Order  ·  1×1 Portrait',
            fontsize=5, color=(0.5, 0.5, 0.5),
        )
    dst.save(str(dst_path), garbage=4, deflate=True)
    src.close(); dst.close()
    print(f'1×1 portrait (study-order): {n} pages → {dst_path.name}')


# ─── 1×1 precise link enrichment ─────────────────────────────────────────────
def _add_links_1x1(output_path: Path, page_types: dict,
                   qid_first_page: dict, toc_link_rects: dict,
                   toc_section_rects: dict,
                   round_page_registry: dict,
                   pat_page_registry: dict,
                   qid_difficulty: dict = None,
                   qid_to_slug: dict = None,
                   ia_first_page: dict = None,
                   GAP: float = 8.0,
                   src_w: float = 204.0, src_h: float = 264.0,
                   L_W: float = 612.0, L_H: float = 792.0):
    """
    Post-process 1×1 single-page PDF (each inner page = one landscape sheet).
    All link destinations are recalculated for inner_pg == output_sheet.
    Features: TOC arrows, checkboxes, difficulty dots, smart ← Contents,
              solution checkboxes, master Done checkbox, → Next button.
    When qid_to_slug is provided, also re-adds clickable URI links for the
    LeetDoocs / SimplyLeet / WalkCC / LeetCode links line on each question page.
    """
    _SOL_LABELS = (
        [f'● {site_label}' for _, site_label in SITE_META]
        + ['● My LeetCode Solution']
        + ['● Editorial Note']
        + [f'● Editorial · {ap["title"]}'
           for entry in _EDITORIAL.values()
           for ap in entry.get('approaches', [])]
    )
    _SOL_LABELS = list(dict.fromkeys(_SOL_LABELS))  # dedupe, preserve order
    _qid_diff   = qid_difficulty or {}
    _DIFF_COLOR = {
        'Easy':   (0.13, 0.77, 0.37),
        'Medium': (0.98, 0.45, 0.09),
        'Hard':   (0.93, 0.27, 0.27),
    }

    # Coordinate transform: inner mini-page → full landscape sheet
    cw = L_W - 2 * GAP
    ch = L_H - 2 * GAP
    sc = min(cw / src_w, ch / src_h)
    ox = (cw - src_w * sc) / 2
    oy = (ch - src_h * sc) / 2

    def tx_rect(r):
        return fitz.Rect(GAP + ox + r.x0 * sc, GAP + oy + r.y0 * sc,
                         GAP + ox + r.x1 * sc, GAP + oy + r.y1 * sc)

    # Fix cover subtitle: the inner PDF says "2×1 Landscape" — patch it on page 0
    _cov = fitz.open(str(output_path))
    _hits = _cov[0].search_for('2×1 Landscape')
    if _hits:
        _r = _hits[0]
        _r2 = fitz.Rect(_r.x0 - 1, _r.y0 - 1, _r.x1 + 1, _r.y1 + 1)
        _cov[0].draw_rect(_r2, color=(1,1,1), fill=(1,1,1), width=0)
        _cov[0].insert_text(fitz.Point(_r.x0, _r.y1 - 0.5),
                            '1×1 Portrait', fontsize=_r.height * 0.85,
                            color=(0,0,0), fontname='helv')
    _tmp_c = output_path.with_suffix('.cov.pdf')
    _cov.save(str(_tmp_c), garbage=4, deflate=True, incremental=False)
    _cov.close()
    _tmp_c.replace(output_path)

    # In 1×1: inner page index == output sheet index
    toc_inner   = [pg for pg, t in page_types.items() if t == 'toc']
    toc_sheets  = set(toc_inner)   # inner_pg == sheet for 1×1
    toc_sheet0  = min(toc_sheets) if toc_sheets else 0

    # inner_page_current_qid: track which question is "active" on each inner page
    first_page_to_qid = {pg: qid for qid, pg in qid_first_page.items()}
    max_ip = max(page_types.keys(), default=0)
    inner_page_current_qid: dict = {}
    _cur = None
    for _ip in range(max_ip + 1):
        if _ip in first_page_to_qid:
            _cur = first_page_to_qid[_ip]
        inner_page_current_qid[_ip] = _cur

    # Build qid → (toc_output_sheet, fitz.Point) for ← Contents.
    # Scroll to the QID's exact y-position so the pattern header ("— Stack (4) —")
    # is visible just above it, placing the user in the right pattern section.
    qid_toc_dest: dict = {}
    for inner_pg, rects in toc_link_rects.items():
        for qid, rect_info in rects.items():
            if qid in qid_toc_dest:
                continue
            line_dest = tx_rect(rect_info['line'])
            qid_toc_dest[qid] = (inner_pg, fitz.Point(0, line_dest.y0))

    # For each 'pat_banner' page, find the nearest preceding section mini-TOC page
    # so ← Contents can jump there instead of to master Contents.
    _toc_sorted = sorted(toc_link_rects.keys())
    _pat_banner_toc: dict = {}
    for _pg, _t in sorted(page_types.items()):
        if _t == 'pat_banner':
            for _tpg in reversed(_toc_sorted):
                if _tpg < _pg:
                    _pat_banner_toc[_pg] = _tpg
                    break

    # Study order for → Next / ← Prev links (inner_pg == output sheet in 1×1)
    _sorted_qids = sorted(qid_first_page.keys(), key=lambda q: qid_first_page[q])
    _qid_next    = {_sorted_qids[i]: _sorted_qids[i + 1]
                    for i in range(len(_sorted_qids) - 1)}
    _qid_prev    = {_sorted_qids[i + 1]: _sorted_qids[i]
                    for i in range(len(_sorted_qids) - 1)}

    # Pre-scan: collect sol label rects and title rects before any page modifications
    sol_rects: dict = {}    # {sh: [(label, fitz.Rect)]}
    title_rects: dict = {}  # {sh: fitz.Rect of "#qid" text}  — first pages only
    _first_pg_to_qid = {pg: qid for qid, pg in qid_first_page.items()}
    _scan = fitz.open(str(output_path))
    for _sh in range(len(_scan)):
        if _sh in toc_sheets:
            continue
        _hits = []
        for _lbl in _SOL_LABELS:
            for _r in _scan[_sh].search_for(_lbl):
                _hits.append((_lbl, _r))
        if _hits:
            sol_rects[_sh] = _hits
        # Title scan: only for first pages of each question (inner_pg == sh in 1×1).
        # Search "★ #qid" first so premium-star prefixes are included in the anchor.
        _qid = _first_pg_to_qid.get(_sh)
        if _qid:
            _t = (
                _scan[_sh].search_for(f'★ #{_qid} ')
                or _scan[_sh].search_for(f'★ #{_qid}')
                or _scan[_sh].search_for(f'#{_qid} ')
                or _scan[_sh].search_for(f'#{_qid}')
            )
            if _t:
                title_rects[_sh] = _t[0]
    _scan.close()

    doc = fitz.open(str(output_path))
    n_sheets = len(doc)
    n_links = n_boxes = n_sec = n_sol = n_done = n_next = n_cont = 0
    cb_h = TOC_CB_PT * sc
    gap  = TOC_CB_GAP * sc

    # ── Round / pattern TOC section links ─────────────────────────────────────
    for inner_pg, sections in toc_section_rects.items():
        out_pg = doc[inner_pg]
        for kind, key, line_src in sections:
            inner_dest = (round_page_registry.get(key) if kind == 'round'
                          else pat_page_registry.get(key))
            if inner_dest is None:
                continue
            line_dest = tx_rect(line_src)
            if kind == 'round':
                _sz  = TOC_CB_PT * sc
                _pad = TOC_ARROW_PAD * sc
                _tap = max(_sz * 1.6, 16.0)
                _cx  = L_W - GAP - _tap / 2 - 2
                anchor = fitz.Rect(line_dest.x0, line_dest.y0,
                                   _cx - _pad - _sz * 0.55, line_dest.y1)
            else:
                anchor = line_dest
            arrow_rect = _draw_toc_goto_arrow(out_pg, anchor, sc)
            out_pg.insert_link({
                'kind': fitz.LINK_GOTO, 'from': arrow_rect,
                'page': inner_dest, 'to': fitz.Point(0, 0), 'zoom': 0,
            })
            n_sec += 1

    # ── TOC entry: ↗ arrow + checkbox + difficulty dot ────────────────────────
    for inner_pg, rects in toc_link_rects.items():
        out_pg = doc[inner_pg]
        for qid, rect_info in rects.items():
            dest = qid_first_page.get(qid)
            line_dest = tx_rect(rect_info['line'])

            if dest is not None:
                arrow_rect = _draw_toc_goto_arrow(out_pg, line_dest, sc)
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO, 'from': arrow_rect,
                    'page': dest, 'to': fitz.Point(0, 0), 'zoom': 0,
                })
                n_links += 1

            cb_y0  = line_dest.y0 + (line_dest.height - cb_h) / 2
            cb_x1  = line_dest.x0 - gap
            cb_x0  = cb_x1 - cb_h
            cb_rect = fitz.Rect(cb_x0, cb_y0, cb_x1, cb_y0 + cb_h)
            out_pg.draw_rect(cb_rect, color=(0.2, 0.2, 0.2),
                             fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            wd = fitz.Widget()
            wd.rect        = cb_rect
            wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            wd.field_name  = f'done_{qid}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            out_pg.add_widget(wd)
            n_boxes += 1

            # Difficulty dot between checkbox and line text
            diff_str  = _qid_diff.get(qid, 'Easy')
            dot_color = _DIFF_COLOR.get(diff_str, _DIFF_COLOR['Easy'])
            dot_r  = cb_h * 0.38
            dot_cx = (cb_x1 + line_dest.x0) / 2
            dot_cy = line_dest.y0 + line_dest.height / 2
            shape  = out_pg.new_shape()
            shape.draw_circle(fitz.Point(dot_cx, dot_cy), dot_r)
            shape.finish(color=dot_color, fill=dot_color, width=0.3)
            shape.commit()

    # ── ← Contents + → Next / Next Sec (top band) + Done checkbox ─────────────
    BW, BH   = 110, 18
    CB_SZ    = max(11.0, TOC_CB_PT - 1)
    BW_N, BH_N = 75, 18
    BW_S, BH_S = 90, 18
    BW_SJ    = 30  # small "→ §" section-jump button
    n_sec_btn = 0

    # Ordered section landings for "← Prev Sec" / "Next Sec →".
    # Prefer pattern grain when it is finer than rounds (Study Splits mega = 138
    # pattern banners). Priority Packs have 1 pattern per round, so either works.
    _section_starts: list = []  # [(key, dest_page), ...] sorted by page
    if len(pat_page_registry) > len(round_page_registry):
        _section_starts = sorted(
            pat_page_registry.items(), key=lambda kv: kv[1],
        )
    else:
        # Round grain (Priority Packs) — land on the section banner/header,
        # matching Splits pattern-banner behavior (skip mini-TOC question list).
        for _rn in sorted(round_page_registry.keys(),
                          key=lambda r: round_page_registry[r]):
            _section_starts.append((_rn, round_page_registry[_rn]))

    def _section_index(sh: int):
        """Index into _section_starts for sheet sh, or None if before first."""
        if not _section_starts:
            return None
        if sh < _section_starts[0][1]:
            return None
        for _i, (_key, _start) in enumerate(_section_starts):
            _end = (_section_starts[_i + 1][1]
                    if _i + 1 < len(_section_starts) else n_sheets)
            if _start <= sh < _end:
                return _i
        return len(_section_starts) - 1

    def _next_section_dest(sh: int):
        """Page index of the next main section after sheet sh, or None."""
        if len(_section_starts) < 2:
            return None
        _idx = _section_index(sh)
        if _idx is None:
            return _section_starts[0][1]
        if _idx + 1 < len(_section_starts):
            return _section_starts[_idx + 1][1]
        return None

    def _prev_section_dest(sh: int):
        """Page index of the previous main section before sheet sh, or None."""
        if len(_section_starts) < 2:
            return None
        _idx = _section_index(sh)
        if _idx is None or _idx <= 0:
            return None
        return _section_starts[_idx - 1][1]

    for sh in range(n_sheets):
        if sh in toc_sheets:
            continue
        out_pg = doc[sh]
        qid = inner_page_current_qid.get(sh)

        # ← Contents destination:
        #   'chapter'    → master Contents (round/group banner, stale QID)
        #   'pat_banner' → per-pattern mini-TOC immediately before this banner
        #   question     → per-pattern mini-TOC via qid_toc_dest
        #   anything else→ master Contents
        _pg_type = page_types.get(sh)
        if _pg_type == 'chapter':
            dest_sh, dest_pt = toc_sheet0, fitz.Point(0, 0)
        elif _pg_type == 'pat_banner':
            _prec = _pat_banner_toc.get(sh)
            dest_sh, dest_pt = (_prec, fitz.Point(0, 0)) if _prec is not None \
                               else (toc_sheet0, fitz.Point(0, 0))
        elif qid and qid in qid_toc_dest:
            dest_sh, dest_pt = qid_toc_dest[qid]
        else:
            dest_sh, dest_pt = toc_sheet0, fitz.Point(0, 0)
        btn_c = fitz.Rect(L_W - BW - 6, 5, L_W - 6, 5 + BH)
        out_pg.draw_rect(btn_c, color=(0.22, 0.28, 0.90), fill=(0.08, 0.08, 0.45), width=1.0)
        out_pg.insert_text(fitz.Point(btn_c.x0 + 7, btn_c.y0 + 12),
                           '← Contents', fontsize=max(7, TOC_CB_PT + 1),
                           color=(1.0, 1.0, 1.0), fontname='helv')
        out_pg.insert_link({'kind': fitz.LINK_GOTO, 'from': btn_c,
                            'page': dest_sh, 'to': dest_pt, 'zoom': 0})
        n_cont += 1

        # « small button left of ← Contents — jumps to master Contents page
        # 14px gap prevents accidental taps bleeding into ← Contents
        btn_top = fitz.Rect(btn_c.x0 - 14 - BW_SJ, 5, btn_c.x0 - 14, 5 + BH)
        out_pg.draw_rect(btn_top, color=(0.22, 0.28, 0.90), fill=(0.08, 0.08, 0.45), width=1.0)
        out_pg.insert_text(fitz.Point(btn_top.x0 + 5, btn_top.y0 + 12),
                           '\xab', fontsize=max(9, TOC_CB_PT + 3),
                           color=(1.0, 1.0, 1.0), fontname='helv')
        out_pg.insert_link({'kind': fitz.LINK_GOTO, 'from': btn_top,
                            'page': toc_sheet0, 'to': fitz.Point(0, 0), 'zoom': 0})

        # ← Prev Sec / Next Sec → (left of « button)
        # zoom must be non-zero: zoom=0 keeps the phone's scroll offset, so Next Sec
        # often lands mid-page with the banner hidden above the fold.
        # Slightly negative y pads above the page so the banner clears mobile chrome.
        _SEC_TO = fitz.Point(0, -72)
        _SEC_ZOOM = 1.0
        next_sec_pg = _next_section_dest(sh)
        prev_sec_pg = _prev_section_dest(sh)
        sec_right = btn_top.x0 - 4
        if next_sec_pg is not None:
            btn_s = fitz.Rect(sec_right - BW_S, 5, sec_right, 5 + BH_S)
            out_pg.draw_rect(btn_s, color=(0.22, 0.28, 0.90),
                             fill=(0.08, 0.08, 0.45), width=1.0)
            out_pg.insert_text(fitz.Point(btn_s.x0 + 6, btn_s.y0 + 12),
                               'Next Sec →', fontsize=max(7, TOC_CB_PT + 1),
                               color=(1.0, 1.0, 1.0), fontname='helv')
            out_pg.insert_link({
                'kind': fitz.LINK_GOTO, 'from': btn_s,
                'page': next_sec_pg, 'to': _SEC_TO, 'zoom': _SEC_ZOOM,
            })
            sec_right = btn_s.x0 - 4
            n_sec_btn += 1
        if prev_sec_pg is not None:
            btn_ps = fitz.Rect(sec_right - BW_S, 5, sec_right, 5 + BH_S)
            out_pg.draw_rect(btn_ps, color=(0.22, 0.28, 0.90),
                             fill=(0.08, 0.08, 0.45), width=1.0)
            out_pg.insert_text(fitz.Point(btn_ps.x0 + 6, btn_ps.y0 + 12),
                               '← Prev Sec', fontsize=max(7, TOC_CB_PT + 1),
                               color=(1.0, 1.0, 1.0), fontname='helv')
            out_pg.insert_link({
                'kind': fitz.LINK_GOTO, 'from': btn_ps,
                'page': prev_sec_pg, 'to': _SEC_TO, 'zoom': _SEC_ZOOM,
            })
            n_sec_btn += 1

        if not qid:
            continue

        # ← Prev / → Next buttons (top band, every question page)
        prev_qid = _qid_prev.get(qid)
        next_qid = _qid_next.get(qid)
        btn_left = 6
        if prev_qid is not None:
            prev_sh = qid_first_page.get(prev_qid)
            if prev_sh is not None:
                btn_prev = fitz.Rect(btn_left, 5, btn_left + BW_N, 5 + BH_N)
                out_pg.draw_rect(btn_prev, color=(0.22, 0.28, 0.90),
                                 fill=(0.08, 0.08, 0.45), width=1.0)
                out_pg.insert_text(fitz.Point(btn_prev.x0 + 6, btn_prev.y0 + 12),
                                   f'← #{prev_qid}', fontsize=max(7, TOC_CB_PT + 1),
                                   color=(1.0, 1.0, 1.0), fontname='helv')
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO, 'from': btn_prev,
                    'page': prev_sh, 'to': fitz.Point(0, 0), 'zoom': 0,
                })
                btn_left += BW_N + 4
        if next_qid is not None:
            next_sh = qid_first_page.get(next_qid)
            if next_sh is not None:
                btn_nav = fitz.Rect(btn_left, 5, btn_left + BW_N, 5 + BH_N)
                out_pg.draw_rect(btn_nav, color=(0.22, 0.28, 0.90),
                                 fill=(0.08, 0.08, 0.45), width=1.0)
                out_pg.insert_text(fitz.Point(btn_nav.x0 + 6, btn_nav.y0 + 12),
                                   f'#{next_qid} →', fontsize=max(7, TOC_CB_PT + 1),
                                   color=(1.0, 1.0, 1.0), fontname='helv')
                out_pg.insert_link({
                    'kind': fitz.LINK_GOTO, 'from': btn_nav,
                    'page': next_sh, 'to': fitz.Point(0, 0), 'zoom': 0,
                })
                n_next += 1

        # ☐ Done checkbox — only on first page of each question, next to #qid title
        if qid_first_page.get(qid) == sh:
            title_r = title_rects.get(sh)
            if title_r is not None:
                cb_y0d = title_r.y0 + (title_r.height - CB_SZ) / 2
                cb_x0d = max(2, title_r.x0 - CB_SZ - 4)
            else:
                cb_y0d = 5 + (BH - CB_SZ) / 2
                cb_x0d = 6
            done_cb = fitz.Rect(cb_x0d, cb_y0d, cb_x0d + CB_SZ, cb_y0d + CB_SZ)
            out_pg.draw_rect(done_cb, color=(0.13, 0.77, 0.37), fill=(1.0, 1.0, 1.0),
                             width=1.2, overlay=True)
            wd = fitz.Widget()
            wd.rect        = done_cb
            wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            wd.field_name  = f'master_{qid}_{sh}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            out_pg.add_widget(wd)
            n_done += 1

        # ── Nav links: ← Description (on IA pages) / → Interview Approach (on desc page) ──
        if ia_first_page:
            # ← Description — search on every question page; links back to desc page.
            for _r in out_pg.search_for('← Description'):
                _dest = qid_first_page.get(qid)
                if _dest is not None:
                    out_pg.insert_link({'kind': fitz.LINK_GOTO, 'from': _r,
                                        'page': _dest, 'to': fitz.Point(0, 0), 'zoom': 0})

            # → Interview Approach — only on the first page of each question.
            if qid_first_page.get(qid) == sh:
                for _r in out_pg.search_for('→ Interview Approach'):
                    _ia_dest = ia_first_page.get(qid)
                    if _ia_dest is not None:
                        out_pg.insert_link({'kind': fitz.LINK_GOTO, 'from': _r,
                                            'page': _ia_dest, 'to': fitz.Point(0, 0), 'zoom': 0})

    # ── Solution checkboxes (pre-scanned before modifications) ────────────────
    for sh, hits in sol_rects.items():
        out_pg = doc[sh]
        qid = inner_page_current_qid.get(sh, 0)
        for label, label_r in hits:
            s_cb_h = TOC_CB_PT * sc
            s_gap  = TOC_CB_GAP * sc
            s_y0   = label_r.y0 + (label_r.height - s_cb_h) / 2
            s_x1   = label_r.x0 - s_gap
            s_x0   = s_x1 - s_cb_h
            s_rect = fitz.Rect(s_x0, s_y0, s_x1, s_y0 + s_cb_h)
            out_pg.draw_rect(s_rect, color=(0.2, 0.2, 0.2),
                             fill=(1.0, 1.0, 1.0), width=0.8, overlay=True)
            label_slug = label.replace('● ', '').lower().replace('.', '').replace(' ', '_')
            wd = fitz.Widget()
            wd.rect        = s_rect
            wd.field_type  = fitz.PDF_WIDGET_TYPE_CHECKBOX
            wd.field_name  = f'sol_{qid}_{label_slug}_{sh}'
            wd.field_value = 'Off'
            wd.on_state    = 'Yes'
            out_pg.add_widget(wd)
            n_sol += 1

    # ── External URI links for the site links line ────────────────────────────
    # Re-add "LeetDoocs · SimplyLeet · WalkCC · LeetCode" as clickable URI links.
    # These are lost during show_pdf_page imposition so we re-inject them here.
    n_uri = 0
    if qid_to_slug:
        _SITE_SEARCHES = [
            ('Open on LeetCode', lambda qid, slug: f'https://leetcode.com/problems/{slug}/'),
            ('LeetDoocs',        lambda qid, slug: f'https://leetcode.doocs.org/en/lc/{qid}/'),
            ('SimplyLeet',       lambda qid, slug: f'https://www.simplyleet.com/{slug}'),
            ('WalkCC',           lambda qid, slug: f'https://walkccc.me/LeetCode/problems/{qid}/'),
            ('LeetCode',         lambda qid, slug: f'https://leetcode.com/problems/{slug}/'),
        ]
        for sh in range(n_sheets):
            if sh in toc_sheets:
                continue
            qid = inner_page_current_qid.get(sh)
            if not qid:
                continue
            slug = qid_to_slug.get(qid, '')
            out_pg = doc[sh]
            for label, url_fn in _SITE_SEARCHES:
                hits = out_pg.search_for(label)
                if not hits:
                    continue
                url = url_fn(qid, slug)
                r = hits[0]
                out_pg.insert_link({'kind': fitz.LINK_URI, 'from': r, 'uri': url})
                n_uri += 1

    tmp = output_path.with_suffix('.tmp.pdf')
    doc.save(str(tmp), garbage=4, deflate=True, incremental=False)
    doc.close()
    import shutil as _shutil
    _shutil.move(str(tmp), str(output_path))
    uri_info = f'  |  URI links: {n_uri}' if n_uri else ''
    print(f'  Links: {n_links} (↗)  |  {n_sec} round/pat  |  TOC cb: {n_boxes}  |  '
          f'Sol cb: {n_sol}  |  Done: {n_done}  |  Next: {n_next}  |  '
          f'Sec nav: {n_sec_btn}  |  ← Cont: {n_cont}{uri_info}')


# ─── NeetCode-150 / AlgoMaster-600 category mode support ─────────────────────
_NC150_PRIORITY = {
    'Arrays & Hashing': 'High', 'Two Pointers': 'High', 'Sliding Window': 'High',
    'Binary Search': 'High', 'Intervals': 'High', 'Trees': 'High',
    'Graphs': 'High', 'Advanced Graphs': 'High',
    'Linked List': 'Mid', 'Stack': 'Mid', 'Heap / Priority Queue': 'Mid',
    'Tries': 'Mid', 'Backtracking': 'Mid', 'Greedy': 'Mid',
    '1-D Dynamic Programming': 'Low', '2-D Dynamic Programming': 'Low',
    'Bit Manipulation': 'Low', 'Math & Geometry': 'Low',
}
_NC150_ORDER = [
    'Arrays & Hashing', 'Two Pointers', 'Sliding Window', 'Binary Search',
    'Intervals', 'Trees', 'Graphs', 'Advanced Graphs',
    'Linked List', 'Stack', 'Heap / Priority Queue', 'Tries', 'Backtracking', 'Greedy',
    '1-D Dynamic Programming', '2-D Dynamic Programming', 'Bit Manipulation', 'Math & Geometry',
]
_AM600_PRIORITY = {
    'Arrays': 'High', 'Strings': 'High', 'Hash Tables': 'High', 'Two Pointers': 'High',
    'Sliding Window - Fixed Size': 'High', 'Sliding Window - Dynamic Size': 'High',
    'Binary Search': 'High', 'Stacks': 'High',
    'Tree Traversal - Level Order': 'High', 'Tree Traversal - Pre Order': 'High',
    'Tree Traversal - In Order': 'High', 'Tree Traversal - Post-Order': 'High',
    'Depth First Search (DFS)': 'High', 'Breadth First Search (BFS)': 'High',
    'Linked List': 'High',
    'Bit Manipulation': 'Mid', 'Prefix Sum': 'Mid', "Kadane's Algorithm": 'Mid',
    'Matrix (2D Array)': 'Mid', 'LinkedList In-place Reversal': 'Mid',
    'Fast and Slow Pointers': 'Mid', 'Monotonic Stack': 'Mid', 'Queues': 'Mid',
    'Monotonic Queue': 'Mid', 'Recursion': 'Mid', 'Divide and Conquer': 'Mid',
    'Merge Sort': 'Mid', 'QuickSort / QuickSelect': 'Mid', 'Backtracking': 'Mid',
    'BST / Ordered Set': 'Mid', 'Tries': 'Mid', 'Heaps': 'Mid', 'Two Heaps': 'Mid',
    'Top K Elements': 'Mid', 'Intervals': 'Mid', 'K-Way Merge': 'Mid',
    'Data Structure Design': 'Mid', 'Greedy': 'Mid', 'Topological Sort': 'Mid',
    'Union Find': 'Mid', 'Minimum Spanning Tree': 'Mid', 'Shortest Path': 'Mid',
    'Bucket Sort': 'Low', 'Eulerian Circuit': 'Low',
    '1-D DP': 'Low', '0/1 Knapsack': 'Low', 'Unbounded Knapsack': 'Low',
    'Longest Increasing Subsequence (LIS)': 'Low', '2D Grid DP': 'Low',
    'String DP': 'Low', 'Tree / Graph DP': 'Low', 'Bitmask DP': 'Low',
    'Digit DP': 'Low', 'Probability DP': 'Low', 'State Machine DP': 'Low',
    'Maths / Geometry': 'Low', 'String Matching': 'Low',
    'Binary Indexed Tree / Segment Tree': 'Low', 'Line Sweep': 'Low',
}
_AM600_ORDER = [
    'Arrays', 'Strings', 'Hash Tables', 'Two Pointers',
    'Sliding Window - Fixed Size', 'Sliding Window - Dynamic Size',
    'Binary Search', 'Stacks',
    'Tree Traversal - Level Order', 'Tree Traversal - Pre Order',
    'Tree Traversal - In Order', 'Tree Traversal - Post-Order',
    'Depth First Search (DFS)', 'Breadth First Search (BFS)', 'Linked List',
    'Bit Manipulation', 'Prefix Sum', "Kadane's Algorithm", 'Matrix (2D Array)',
    'LinkedList In-place Reversal', 'Fast and Slow Pointers',
    'Monotonic Stack', 'Queues', 'Monotonic Queue',
    'Recursion', 'Divide and Conquer', 'Merge Sort', 'QuickSort / QuickSelect',
    'Backtracking', 'BST / Ordered Set', 'Tries', 'Heaps', 'Two Heaps', 'Top K Elements',
    'Intervals', 'K-Way Merge', 'Data Structure Design', 'Greedy',
    'Topological Sort', 'Union Find', 'Minimum Spanning Tree', 'Shortest Path',
    'Bucket Sort', 'Eulerian Circuit',
    '1-D DP', '0/1 Knapsack', 'Unbounded Knapsack',
    'Longest Increasing Subsequence (LIS)', '2D Grid DP', 'String DP',
    'Tree / Graph DP', 'Bitmask DP', 'Digit DP', 'Probability DP', 'State Machine DP',
    'Maths / Geometry', 'String Matching', 'Binary Indexed Tree / Segment Tree', 'Line Sweep',
]


def _parse_ts_category_map(ts_path: Path) -> dict[int, str]:
    """Parse a TypeScript category list into {qid: category_name}."""
    text = ts_path.read_text()
    cat_map: dict[int, str] = {}
    current = ''
    for line in text.splitlines():
        m = re.search(r"name: '((?:[^'\\]|\\.)+)'", line)
        if m and 'emoji' in line:
            current = m.group(1).replace("\\'", "'")
        m2 = re.search(r'\{ id: (\d+),', line)
        if m2 and current:
            cat_map[int(m2.group(1))] = current
    return cat_map


def build_rounds_from_categories(questions: list, cat_map: dict,
                                  cat_priority: dict, cat_order: list) -> list:
    """Build the standard 9-round structure using category names as patterns."""
    result = []
    for round_num, priority, difficulty in ROUNDS:
        tier = [c for c in cat_order if cat_priority.get(c) == priority]
        pgs = []
        for cat in tier:
            qs = [q for q in questions
                  if cat_map.get(q['id']) == cat and q.get('difficulty') == difficulty]
            qs.sort(key=lambda q: q['id'])
            if qs:
                pgs.append(({'name': cat, 'tags': [], 'color': '#6B7280', 'hex': '#6B7280'}, qs))
        result.append((round_num, priority, difficulty, pgs))
    return result


def _load_mode_data() -> tuple[list, dict, dict, list]:
    """
    Load questions, sites, doocs for the current mode (NC150 / AM600 / main).
    Returns (questions, sites, doocs, rounds).
    """
    sites = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    n_rep = repair_doocs_cache(doocs)
    if n_rep:
        DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))
        print(f'  Repaired {n_rep} doocs description(s)')

    if MODE_NC_EXTRA:
        # Only the 32 NC150 questions that are NOT in Set 1
        cat_map   = _parse_ts_category_map(SCRIPT_DIR / 'src' / 'lib' / 'neetcode150.ts')
        nc150_ids = set(cat_map.keys())
        extra = json.loads((SCRIPT_DIR / 'neetcode_extra_questions.json').read_text()) \
                if (SCRIPT_DIR / 'neetcode_extra_questions.json').exists() else []
        questions = [q for q in extra if q['id'] in nc150_ids]
        rounds = build_rounds_from_categories(questions, cat_map, _NC150_PRIORITY, _NC150_ORDER)
    elif MODE_AM_EXTRA:
        # Only the 344 AM600 questions that are NOT in Set 1 and NOT in NC150
        cat_map   = _parse_ts_category_map(SCRIPT_DIR / 'src' / 'lib' / 'algomaster600.ts')
        am600_ids = set(cat_map.keys())
        nc_ids    = set(_parse_ts_category_map(SCRIPT_DIR / 'src' / 'lib' / 'neetcode150.ts').keys())
        am_extra  = json.loads((SCRIPT_DIR / 'am600_extra_questions.json').read_text()) \
                    if (SCRIPT_DIR / 'am600_extra_questions.json').exists() else []
        questions = [q for q in am_extra if q['id'] in am600_ids and q['id'] not in nc_ids]
        rounds = build_rounds_from_categories(questions, cat_map, _AM600_PRIORITY, _AM600_ORDER)
    elif MODE_NC150:
        cat_map   = _parse_ts_category_map(SCRIPT_DIR / 'src' / 'lib' / 'neetcode150.ts')
        nc150_ids = set(cat_map.keys())
        base  = json.loads(QUESTIONS.read_text())
        extra = json.loads((SCRIPT_DIR / 'neetcode_extra_questions.json').read_text()) \
                if (SCRIPT_DIR / 'neetcode_extra_questions.json').exists() else []
        by_id = {q['id']: q for q in base if q['id'] in nc150_ids}
        for q in extra:
            if q['id'] in nc150_ids and q['id'] not in by_id:
                by_id[q['id']] = q
        questions = list(by_id.values())
        rounds = build_rounds_from_categories(questions, cat_map, _NC150_PRIORITY, _NC150_ORDER)
    elif MODE_AM600:
        cat_map   = _parse_ts_category_map(SCRIPT_DIR / 'src' / 'lib' / 'algomaster600.ts')
        am600_ids = set(cat_map.keys())
        base     = json.loads(QUESTIONS.read_text())
        am_extra = json.loads((SCRIPT_DIR / 'am600_extra_questions.json').read_text()) \
                   if (SCRIPT_DIR / 'am600_extra_questions.json').exists() else []
        nc_extra = json.loads((SCRIPT_DIR / 'neetcode_extra_questions.json').read_text()) \
                   if (SCRIPT_DIR / 'neetcode_extra_questions.json').exists() else []
        by_id = {q['id']: q for q in base if q['id'] in am600_ids}
        for q in am_extra + nc_extra:
            if q['id'] in am600_ids and q['id'] not in by_id:
                by_id[q['id']] = q
        questions = list(by_id.values())
        rounds = build_rounds_from_categories(questions, cat_map, _AM600_PRIORITY, _AM600_ORDER)
    else:
        questions = json.loads(QUESTIONS.read_text())
        rounds = build_rounds(questions)

    return questions, sites, doocs, rounds


def _load_all727_data():
    """
    Load all 727 questions from grind_questions.json for --all mode.
    Pre-populates doocs_cache with descriptionHtml for all questions.
    Returns (questions, sites, doocs, all_rounds, sets_and_rounds).
    """
    grind_path = SCRIPT_DIR / 'public' / 'grind_questions.json'
    grind_qs   = json.loads(grind_path.read_text()) if grind_path.exists() else []

    sites = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    n_rep = repair_doocs_cache(doocs)
    if n_rep:
        print(f'  Repaired {n_rep} doocs description(s)')

    # Inject descriptions from grind_questions.json into doocs cache
    injected = 0
    for gq in grind_qs:
        qid_str = str(gq['id'])
        html = gq.get('descriptionHtml') or ''
        if html and qid_str not in doocs:
            doocs[qid_str] = {'desc_html': html, 'blocks': []}
            injected += 1
        elif html and not doocs[qid_str].get('desc_html'):
            doocs[qid_str]['desc_html'] = html
            injected += 1
    if injected:
        print(f'  Injected {injected} descriptions from grind_questions.json into doocs cache')

    # Build source lookup from questions_full.json so premium tags are preserved
    _full_path = SCRIPT_DIR / 'public' / 'questions_full.json'
    _full_by_id = {}
    if _full_path.exists():
        for _fq in json.loads(_full_path.read_text()):
            _full_by_id[_fq['id']] = _fq

    # Normalise question objects
    questions = []
    for gq in grind_qs:
        _fq = _full_by_id.get(gq['id'], {})
        questions.append({
            'id':         gq['id'],
            'title':      gq['title'],
            'slug':       gq['slug'],
            'difficulty': gq.get('difficulty', 'Easy'),
            'pattern':    gq.get('pattern'),
            'section':    gq.get('section'),
            'set':        gq.get('set', 1),
            'tags':       _fq.get('tags', []),
            'source':     _fq.get('source', []),
        })

    # Partition by set and build 9 rounds per set (27 total)
    sets_data: dict[int, list] = {}
    for q in questions:
        s = q.get('set', 1)
        sets_data.setdefault(s, []).append(q)

    all_rounds  = []
    sets_and_rounds = []
    base = 1
    for set_num in sorted(sets_data.keys()):
        rounds_9 = build_rounds_for_set(sets_data[set_num], base)
        all_rounds.extend(rounds_9)
        sets_and_rounds.append((set_num, f'Set {set_num}', rounds_9))
        base += 9

    return questions, sites, doocs, all_rounds, sets_and_rounds


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if MODE_ALL727:
        print('Loading all-727 data (Set 1 + Set 2 + Set 3)…')
        questions, sites, doocs, rounds, sets_and_rounds = _load_all727_data()
        print(f'  {len(questions)} questions · sites: {len(sites)} · doocs: {len(doocs)}')

        my_solutions = load_my_solutions()

        print('\nBuilding all-727 inner mini-page PDF…')
        n_pages, round_page_registry, pat_page_registry = build_all727_inner_pdf(
            sets_and_rounds, sites, doocs, my_solutions)

        print('Analyzing inner PDF for link structure…')
        page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page = (
            _analyze_inner_for_links(INNER_PDF, rounds)
        )

        print('Imposing 1×1 portrait (one page per sheet)…')
        _impose_1up(INNER_PDF, OUTPUT_1UP)

        print('Adding precise hyperlinks to 1×1 version…')
        qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
        qid_to_slug    = {q['id']: q.get('slug', '')            for q in questions}
        _add_links_1x1(
            OUTPUT_1UP, page_types, qid_first_page, toc_link_rects, toc_section_rects,
            round_page_registry, pat_page_registry,
            qid_difficulty=qid_difficulty,
            qid_to_slug=qid_to_slug,
            ia_first_page=ia_first_page,
        )

        INNER_PDF.unlink(missing_ok=True)
        kb1u = OUTPUT_1UP.stat().st_size // 1024
        print(f'\nDone → {OUTPUT_1UP}  ({kb1u:,} KB)  [1×1 single-page]')
        print(f'Inner pages: {n_pages}')
        sys.exit(0)

    mode_label = ('NeetCode Exclusives' if MODE_NC_EXTRA else
                  'AlgoMaster Exclusives' if MODE_AM_EXTRA else
                  'NeetCode 150' if MODE_NC150 else
                  'AlgoMaster 600' if MODE_AM600 else
                  'LeetMastery 331')
    print(f'Loading data…  [{mode_label}]')
    questions, sites, doocs, rounds = _load_mode_data()
    print(f'  {len(questions)} questions · sites: {len(sites)} · doocs: {len(doocs)}')

    print('Building rounds…')
    for round_num, priority, difficulty, pattern_groups in rounds:
        total = sum(len(qs) for _, qs in pattern_groups)
        pats  = ', '.join(p['name'] for p, _ in pattern_groups)
        print(f'  Round {round_num}  {priority:4s} {difficulty:7s}  {total:3d} q  [{pats}]')

    if CHAPTER2_PDF:
        print('\nBuilding Chapter 2 (Quick-Review summary only)…')
        n_pages = build_chapter2_inner(rounds)
        print('Imposing 1×1 portrait (one page per sheet)…')
        impose_1x1_portrait(INNER_PDF, OUTPUT_PDF)
        INNER_PDF.unlink(missing_ok=True)
        kb = OUTPUT_PDF.stat().st_size // 1024
        print(f'\nDone → {OUTPUT_PDF}  ({kb:,} KB)  ·  {n_pages} pages')
        sys.exit(0)

    my_solutions = load_my_solutions()

    print('\nBuilding inner mini-page PDF…')
    n_pages, round_page_registry, pat_page_registry = build_inner_pdf(rounds, sites, doocs, my_solutions)

    if GRID_2X1:
        print('Analyzing inner PDF for link structure…')
        page_types, qid_first_page, toc_link_rects, toc_section_rects, ia_first_page = (
            _analyze_inner_for_links(INNER_PDF, rounds)
        )
        print('Imposing 2×1 landscape (2-up)…')
        impose_2x1_landscape(INNER_PDF, OUTPUT_PDF)
        print('Adding precise hyperlinks…')
        qid_difficulty = {q['id']: q.get('difficulty', 'Easy') for q in questions}
        _add_links_2x1(
            OUTPUT_PDF, page_types, qid_first_page, toc_link_rects, toc_section_rects,
            round_page_registry, pat_page_registry,
            qid_difficulty=qid_difficulty,
        )
    elif GRID_2X2:
        print('Analyzing inner PDF for link structure…')
        page_types, qid_first_page, toc_link_rects, _toc_sec, ia_first_page = (
            _analyze_inner_for_links(INNER_PDF, rounds)
        )
        print('Imposing 2×2 landscape (4-up)…')
        impose_2x2_landscape(INNER_PDF, OUTPUT_PDF)
        print('Adding hyperlinks…')
        _add_links_2x2(OUTPUT_PDF, page_types, qid_first_page, toc_link_rects)
    elif GRID_6X4:
        print('Imposing 6×4 landscape print edition (24-up)…')
        impose_6x4_landscape(INNER_PDF, OUTPUT_PDF)
    elif GRID_4X4:
        print('Imposing 4×4 landscape (16-up)…')
        impose_4x4_landscape(INNER_PDF, OUTPUT_PDF)
    elif LANDSCAPE:
        print('Imposing 36-up landscape (6×6)…')
        impose_36up_landscape(INNER_PDF, OUTPUT_PDF)
    else:
        print('Imposing 36-up portrait (6×6)…')
        impose_36up_portrait(INNER_PDF, OUTPUT_PDF)

    # ── 1×1 single-page version ──────────────────────────────────────────────
    print('\nImposing 1×1 landscape (single-page, full-size)…')
    _impose_1up(INNER_PDF, OUTPUT_1UP)
    print('Adding precise hyperlinks to 1×1 version…')
    _add_links_1x1(
        OUTPUT_1UP, page_types, qid_first_page, toc_link_rects, toc_section_rects,
        round_page_registry, pat_page_registry,
        qid_difficulty=qid_difficulty,
        ia_first_page=ia_first_page,
    )

    INNER_PDF.unlink(missing_ok=True)
    kb   = OUTPUT_PDF.stat().st_size  // 1024
    kb1u = OUTPUT_1UP.stat().st_size  // 1024
    print(f'\nDone → {OUTPUT_PDF}  ({kb:,} KB)  [2×1 landscape]')
    print(f'Done → {OUTPUT_1UP}  ({kb1u:,} KB)  [1×1 single-page]')
    print(f'Inner pages: {n_pages}')

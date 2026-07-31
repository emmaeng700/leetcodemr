"""
generate_ultimate_pdf.py
─────────────────────────────────────────────────────────────────────────────
All 727 LeetMastery questions — Set 1 → Set 2 → Set 3.

Each question page:
  • Problem description
  • Community solution links (WalkCC · LeetDoocs · SimplyLeet · LC.ca)
  • Full STAR-LC interview approach (6 phases, colour-coded)
  • Quick review — key insights + complexity
  • ← CONTENTS | ← PREV | NEXT → navigation on every page
  • ☐ All Good checkbox  +  ☐ per-site solution checkboxes

TOC: Set → Priority → Difficulty → Pattern (with counts + page numbers, all clickable)
PDF outline (sidebar bookmarks) mirrors the same hierarchy.

Output: ultimate_study.pdf
"""

import json, re, textwrap, sys
from pathlib import Path

import fitz  # PyMuPDF ≥ 1.23

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
GRIND_JSON  = SCRIPT_DIR / "public" / "grind_questions.json"
QR_JSON     = SCRIPT_DIR / "public" / "quick_review_info.json"
OUTPUT_PATH = SCRIPT_DIR / "ultimate_study.pdf"

# ── Load data ──────────────────────────────────────────────────────────────────
print("Loading data…")
QUESTIONS = json.loads(GRIND_JSON.read_text())
QR_BY_ID  = {q["id"]: q for q in json.loads(QR_JSON.read_text())}
Q_BY_ID   = {q["id"]: q for q in QUESTIONS}
print(f"  {len(QUESTIONS)} questions  |  {len(QR_BY_ID)} quick-review entries")

# ── Page geometry ──────────────────────────────────────────────────────────────
PW, PH = 612.0, 792.0          # US Letter
ML, MR = 30.0, 30.0
MT, MB = 22.0, 20.0            # top/bottom content margin (below nav bar)
CW     = PW - ML - MR          # 552 pt content width
NAV_H  = 20.0                  # nav-bar height at top of every page

# ── Colour palette (Catppuccin Mocha) ─────────────────────────────────────────
def _h(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i:i+2], 16) / 255 for i in (0, 2, 4))

BG    = _h("1e1e2e"); SURF = _h("181825"); OVR  = _h("313244")
TEXT  = _h("cdd6f4"); SUB  = _h("6c7086"); OVER2= _h("45475a")
HIGH  = _h("a6e3a1"); MID  = _h("fab387"); LOW  = _h("89b4fa")
EASY  = _h("a6e3a1"); MED  = _h("f9e2af"); HARD = _h("f38ba8")
S1C   = _h("89b4fa"); S2C  = _h("cba6f7"); S3C  = _h("94e2d5")
LINK  = _h("89dceb"); ACC  = _h("cba6f7")
WHITE = (1.0, 1.0, 1.0);  BLACK = (0.0, 0.0, 0.0)

PHASE_COL = {
    "PHASE 1": _h("cba6f7"),  # mauve  – Clarify
    "PHASE 2": _h("f38ba8"),  # red    – Brute Force
    "PHASE 3": _h("fab387"),  # peach  – Optimize
    "PHASE 4": _h("a6e3a1"),  # green  – Clean Code
    "PHASE 5": _h("f9e2af"),  # yellow – Test & Debug
    "PHASE 6": _h("89b4fa"),  # blue   – Complexity
}

def prio_col(p): return {"High": HIGH, "Mid": MID, "Low": LOW}.get(p, TEXT)
def diff_col(d): return {"Easy": EASY, "Medium": MED, "Hard": HARD}.get(d, TEXT)
def set_col(s):  return {1: S1C, 2: S2C, 3: S3C}.get(s, TEXT)

# ── Fonts ──────────────────────────────────────────────────────────────────────
FR = "helv"; FB = "hebo"; FM = "cour"

# ── Sizes ──────────────────────────────────────────────────────────────────────
SB = 9.5;   LB = SB * 1.35     # body
SC = 8.0;   LC = SC * 1.25     # code
SS = 8.0;   LS = SS * 1.3      # small
SN = 6.5                        # nav
SP = 10.0                       # phase header
SH = 8.5                        # section header

# Char wrap widths (conservative)
WB = int(CW / (SB * 0.54))     # ~107
WC = int(CW / (SC * 0.62))     # ~90 (mono wider)
WS = int(CW / (SS * 0.54))     # ~127

PRIO_ORDER = ["High", "Mid", "Low"]
DIFF_ORDER = ["Easy", "Medium", "Hard"]
SET_NAMES  = {1: "Main 300", 2: "NeetCode 250 Extra", 3: "AlgoMaster Extra"}
SET_COUNTS = {1: 331, 2: 104, 3: 292}

# ── Helpers ────────────────────────────────────────────────────────────────────
def wrap(text: str, width: int) -> list:
    result = []
    for raw in text.split("\n"):
        if len(raw) <= width:
            result.append(raw)
        else:
            chunks = textwrap.wrap(raw, width=width, break_long_words=True,
                                   break_on_hyphens=False)
            result.extend(chunks if chunks else [""])
    return result

def community_urls(qid, slug):
    return [
        ("WalkCC",     f"https://walkccc.me/LeetCode/problems/{slug}/"),
        ("LeetDoocs",  f"https://doocs.github.io/leetcode/en/lc/{qid}/"),
        ("SimplyLeet", f"https://simplyleet.com/{slug}"),
        ("LC.ca",      f"https://leetcode.ca/all/{qid}.html"),
    ]

def parse_approach(approach: str):
    """Return list of (type, text): 'phase_hdr' | 'comment' | 'code' | 'blank'."""
    out = []
    for line in approach.split("\n"):
        m = re.match(r"^# (PHASE \d+.*)", line)
        if m:
            out.append(("phase_hdr", m.group(1).strip()))
        elif line.startswith("# "):
            out.append(("comment", line[2:]))
        elif line.strip() in ("", "#"):
            out.append(("blank", ""))
        else:
            out.append(("code", line))
    return out

# ── Build hierarchy ────────────────────────────────────────────────────────────
def build_hierarchy():
    h = {}
    for q in QUESTIONS:
        s = q["set"]
        sec = q.get("section") or ""
        pts = sec.split(" - ", 1)
        if len(pts) == 2:
            pd = pts[0].split()
            pri  = pd[0] if pd else "Unknown"
            diff = pd[1] if len(pd) > 1 else "Unknown"
            pat  = pts[1]
        else:
            pri, diff, pat = "Unknown", "Unknown", "Unknown"
        h.setdefault(s, {}).setdefault(pri, {}).setdefault(diff, {}) \
         .setdefault(pat, []).append(q["id"])
    return h

HIER = build_hierarchy()

# ── Ordered question list (Set→Prio→Diff→Pattern) ─────────────────────────────
def build_ordered():
    out = []
    for s in [1, 2, 3]:
        all_prios = PRIO_ORDER + [p for p in HIER.get(s,{}) if p not in PRIO_ORDER]
        for pri in all_prios:
            if pri not in HIER.get(s, {}): continue
            all_diffs = DIFF_ORDER + [d for d in HIER[s][pri] if d not in DIFF_ORDER]
            for diff in all_diffs:
                if diff not in HIER[s][pri]: continue
                for pat in sorted(HIER[s][pri][diff]):
                    for qid in HIER[s][pri][diff][pat]:
                        if qid in Q_BY_ID:
                            out.append(Q_BY_ID[qid])
    return out

ORDERED = build_ordered()

# ── Global link queue (resolved after all pages rendered) ──────────────────────
_LINKS = []   # (page_0idx, rect, kind, target)
# kind = "goto" (target=page_0idx)  |  "uri" (target=url str)
# kind = "prev_q" | "next_q"  (target=qid, resolved later)

def _add(pn, rect, kind, target):
    _LINKS.append((pn, rect, kind, target))

# ══════════════════════════════════════════════════════════════════════════════
# Cover page
# ══════════════════════════════════════════════════════════════════════════════
def render_cover(doc):
    pg = doc.new_page(width=PW, height=PH)
    pg.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)

    # Rainbow band top
    for i,(c,w) in enumerate([(S1C,6),(S2C,5),(S3C,4)]):
        y0 = sum(w2 for _,w2 in [(S1C,6),(S2C,5),(S3C,4)][:i])
        pg.draw_rect(fitz.Rect(0,y0,PW,y0+w), color=None, fill=c)

    # Big title
    pg.insert_text(fitz.Point(ML, 155), "LeetMastery",
                   fontsize=38, color=TEXT, fontname=FB)
    pg.insert_text(fitz.Point(ML, 183), "The Ultimate Study Guide",
                   fontsize=18, color=S1C, fontname=FB)
    pg.insert_text(fitz.Point(ML, 201),
                   "727 Questions · 3 Sets · Full Interview Approach",
                   fontsize=10, color=SUB, fontname=FR)

    # Divider
    pg.draw_line(fitz.Point(ML,213), fitz.Point(PW-MR,213), color=OVR, width=1)

    # Set cards
    def card(y, sn, sc, nm, cnt, desc):
        r = fitz.Rect(ML, y, PW-MR, y+52)
        pg.draw_rect(r, color=None, fill=SURF)
        pg.draw_rect(fitz.Rect(ML, y, ML+4, y+52), color=None, fill=sc)
        pg.insert_text(fitz.Point(ML+11, y+16), f"Set {sn}  —  {nm}",
                       fontsize=11, color=sc, fontname=FB)
        pg.insert_text(fitz.Point(ML+11, y+29), f"{cnt} questions",
                       fontsize=9, color=TEXT, fontname=FB)
        pg.insert_text(fitz.Point(ML+11, y+41), desc,
                       fontsize=8, color=SUB, fontname=FR)

    card(222, 1, S1C, "Main 300",            331,
         "Core LC questions · priority-ordered for interviews")
    card(280, 2, S2C, "NeetCode 250 Extra",  104,
         "Top NeetCode picks not in Set 1 · extends coverage")
    card(338, 3, S3C, "AlgoMaster Extra",    292,
         "AlgoMaster 600 exclusives · comprehensive pattern coverage")

    # Feature list
    pg.draw_line(fitz.Point(ML,401), fitz.Point(PW-MR,401), color=OVR, width=0.6)
    y = 420.0
    feats = [
        "Problem description — all 727 questions",
        "Community solutions: WalkCC · LeetDoocs · SimplyLeet · LC.ca",
        "Full STAR-LC interview approach · 6 phases per question",
        "Quick review: key insights + time/space complexity",
        "Clickable navigation: TOC · Prev · Next · Back to section",
        "Checkboxes: track solved status + solutions studied",
    ]
    for f in feats:
        pg.insert_text(fitz.Point(ML+2,  y), "▸", fontsize=9.5, color=LINK, fontname=FB)
        pg.insert_text(fitz.Point(ML+13, y), f,   fontsize=9.5, color=TEXT, fontname=FR)
        y += 15

    pg.draw_line(fitz.Point(ML, y+4), fitz.Point(PW-MR, y+4), color=OVR, width=0.5)
    pg.insert_text(fitz.Point(ML, y+18), "July 2026  ·  leetcodemr.vercel.app",
                   fontsize=8, color=SUB, fontname=FR)

    # Bottom band
    pg.draw_rect(fitz.Rect(0, PH-7, PW, PH), color=None, fill=OVR)

# ══════════════════════════════════════════════════════════════════════════════
# TOC — rendered on placeholder pages after content is known
# ══════════════════════════════════════════════════════════════════════════════
TOC_N = 4   # pages reserved for TOC

def add_toc_placeholders(doc):
    pages = []
    for _ in range(TOC_N):
        pg = doc.new_page(width=PW, height=PH)
        pg.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)
        pages.append(len(doc)-1)
    return pages


def render_toc(doc, toc_pns, anchor_pages):
    """Fill TOC pages. Returns list of (pn, rect, kind, target) for link injection."""
    links = []
    pi = 0   # index into toc_pns
    pg = doc[toc_pns[pi]]

    def fresh_page():
        nonlocal pi, pg, y
        # footer on current page
        doc[toc_pns[pi]].insert_text(
            fitz.Point(PW/2-8, PH-10), str(toc_pns[pi]+1),
            fontsize=7, color=SUB, fontname=FR)
        pi += 1
        if pi < len(toc_pns):
            p = doc[toc_pns[pi]]
            p.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)
            pg = p
        y = MT + NAV_H + 6

    def need(h):
        nonlocal y
        if y + h > PH - MB - 16:
            fresh_page()

    y = MT + NAV_H + 4

    # ── TOC title ──
    pg.insert_text(fitz.Point(ML, y+20), "CONTENTS",
                   fontsize=22, color=TEXT, fontname=FB)
    y += 28
    pg.draw_line(fitz.Point(ML,y), fitz.Point(PW-MR,y), color=OVR, width=0.8)
    y += 12

    for sn in [1,2,3]:
        need(28)
        sc = set_col(sn); cnt = SET_COUNTS[sn]; nm = SET_NAMES[sn]
        sa = f"set:{sn}"; st = anchor_pages.get(sa)

        # Set row
        r = fitz.Rect(ML, y, PW-MR, y+22)
        pg.draw_rect(r, color=None, fill=SURF)
        pg.draw_rect(fitz.Rect(ML, y, ML+4, y+22), color=None, fill=sc)
        pg.insert_text(fitz.Point(ML+10, y+15),
                       f"SET {sn}  —  {nm}",
                       fontsize=12, color=sc, fontname=FB)
        if st is not None:
            pg.insert_text(fitz.Point(PW-MR-28, y+15), f"p.{st+1}",
                           fontsize=8, color=SUB, fontname=FR)
            links.append((toc_pns[pi], r, "goto", st))
        pg.insert_text(fitz.Point(PW-MR-80, y+15), f"{cnt} questions",
                       fontsize=8, color=SUB, fontname=FR)
        y += 24

        for pri in PRIO_ORDER:
            if pri not in HIER.get(sn, {}): continue
            need(14)
            pc = prio_col(pri)
            pq = sum(sum(len(v) for v in HIER[sn][pri][d].values())
                     for d in HIER[sn][pri])
            pa = f"set:{sn}:prio:{pri}"; pt = anchor_pages.get(pa)
            px = ML+14
            lbl = f"▶  {pri} Priority  ({pq})"
            pg.insert_text(fitz.Point(px, y+10), lbl, fontsize=10, color=pc, fontname=FB)
            if pt is not None:
                pg.insert_text(fitz.Point(PW-MR-28, y+10), f"p.{pt+1}",
                               fontsize=8, color=SUB, fontname=FR)
                links.append((toc_pns[pi], fitz.Rect(px, y, PW-MR, y+12), "goto", pt))
            y += 13

            for diff in DIFF_ORDER:
                if diff not in HIER[sn][pri]: continue
                need(12)
                dc = diff_col(diff)
                dq = sum(len(v) for v in HIER[sn][pri][diff].values())
                da = f"set:{sn}:prio:{pri}:diff:{diff}"; dt = anchor_pages.get(da)
                dx = ML+26
                lbl = f"◦  {diff}  ({dq})"
                pg.insert_text(fitz.Point(dx, y+9), lbl, fontsize=9, color=dc, fontname=FB)
                if dt is not None:
                    pg.insert_text(fitz.Point(PW-MR-28, y+9), f"p.{dt+1}",
                                   fontsize=8, color=SUB, fontname=FR)
                    links.append((toc_pns[pi], fitz.Rect(dx, y, PW-MR, y+11), "goto", dt))
                y += 12

                for pat in sorted(HIER[sn][pri][diff]):
                    need(11)
                    qids = HIER[sn][pri][diff][pat]
                    ea = f"set:{sn}:prio:{pri}:diff:{diff}:pat:{pat}"
                    et = anchor_pages.get(ea)
                    ex = ML+40
                    lbl = f"·  {pat}  ({len(qids)})"
                    lbl_w = len(lbl) * 8 * 0.54
                    # Dot leaders
                    if PW-MR-38 - (ex+lbl_w) > 10:
                        dot_x = ex + lbl_w + 4
                        ndots = int((PW-MR-38 - dot_x) / 3.5)
                        dots = "·" * max(0, ndots)
                        pg.insert_text(fitz.Point(dot_x, y+8.5), dots,
                                       fontsize=7, color=OVER2, fontname=FR)
                    pg.insert_text(fitz.Point(ex, y+8.5), lbl, fontsize=8, color=TEXT, fontname=FR)
                    if et is not None:
                        pg.insert_text(fitz.Point(PW-MR-28, y+8.5), f"p.{et+1}",
                                       fontsize=8, color=SUB, fontname=FR)
                        links.append((toc_pns[pi], fitz.Rect(ex, y, PW-MR, y+10), "goto", et))
                    y += 11

            y += 6  # gap after priority

        y += 8  # gap after set

    # Footer on last used TOC page
    doc[toc_pns[pi]].insert_text(
        fitz.Point(PW/2-8, PH-10), str(toc_pns[pi]+1),
        fontsize=7, color=SUB, fontname=FR)

    return links


# ══════════════════════════════════════════════════════════════════════════════
# Section divider pages
# ══════════════════════════════════════════════════════════════════════════════
def render_set_div(doc, sn):
    sc = set_col(sn)
    pg = doc.new_page(width=PW, height=PH)
    pg.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)
    pg.draw_rect(fitz.Rect(0,0,6,PH), color=None, fill=sc)

    pg.insert_text(fitz.Point(50, 180), str(sn),
                   fontsize=110, color=SURF, fontname=FB)
    pg.insert_text(fitz.Point(50, 232),
                   f"Set {sn}  —  {SET_NAMES[sn]}",
                   fontsize=20, color=sc, fontname=FB)
    pg.insert_text(fitz.Point(52, 252), f"{SET_COUNTS[sn]} questions",
                   fontsize=11, color=SUB, fontname=FR)
    pg.draw_line(fitz.Point(50,264), fitz.Point(PW-MR,264), color=OVR, width=0.8)

    y = 280.0
    h = HIER.get(sn, {})
    for pri in PRIO_ORDER:
        if pri not in h: continue
        pc = prio_col(pri)
        pq = sum(sum(len(v) for v in h[pri][d].values()) for d in h[pri])
        pg.insert_text(fitz.Point(52, y), f"▶ {pri} Priority  ·  {pq} questions",
                       fontsize=10, color=pc, fontname=FB)
        y += 14
        for diff in DIFF_ORDER:
            if diff not in h[pri]: continue
            dq = sum(len(v) for v in h[pri][diff].values())
            pg.insert_text(fitz.Point(66, y), f"◦ {diff}  ({dq})",
                           fontsize=9, color=diff_col(diff), fontname=FR)
            y += 12
            for pat, ids in sorted(h[pri][diff].items()):
                pg.insert_text(fitz.Point(80, y), f"· {pat}  ({len(ids)})",
                               fontsize=8, color=TEXT, fontname=FR)
                y += 10
        y += 6

    pg.draw_rect(fitz.Rect(0,PH-7,PW,PH), color=None, fill=OVR)
    return len(doc)-1


def render_prio_div(doc, sn, pri):
    sc = set_col(sn); pc = prio_col(pri) if pri in ("High","Mid","Low") else SUB
    h = HIER[sn][pri]
    total = sum(sum(len(v) for v in h[d].values()) for d in h)

    pg = doc.new_page(width=PW, height=PH)
    pg.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)
    pg.draw_rect(fitz.Rect(0,0,4,PH), color=None, fill=sc)
    pg.draw_rect(fitz.Rect(4,0,8,PH), color=None, fill=pc)

    pg.insert_text(fitz.Point(ML, 118), f"SET {sn}", fontsize=10, color=sc, fontname=FB)
    pg.insert_text(fitz.Point(ML, 148), f"{pri} Priority",
                   fontsize=26, color=pc, fontname=FB)
    pg.insert_text(fitz.Point(ML, 166), f"{total} questions",
                   fontsize=11, color=SUB, fontname=FR)
    pg.draw_line(fitz.Point(ML,177), fitz.Point(PW-MR,177), color=OVR, width=0.7)

    y = 192.0
    for diff in DIFF_ORDER:
        if diff not in h: continue
        dq = sum(len(v) for v in h[diff].values())
        pg.insert_text(fitz.Point(ML, y), f"{diff}  ({dq})",
                       fontsize=11, color=diff_col(diff), fontname=FB)
        y += 14
        for pat, ids in sorted(h[diff].items()):
            pg.insert_text(fitz.Point(ML+14, y), f"· {pat}  ({len(ids)})",
                           fontsize=9, color=TEXT, fontname=FR)
            y += 11
        y += 5

    pg.draw_rect(fitz.Rect(0,PH-7,PW,PH), color=None, fill=OVR)
    return len(doc)-1


# ══════════════════════════════════════════════════════════════════════════════
# Question renderer
# ══════════════════════════════════════════════════════════════════════════════
CB_SZ = 10.0   # checkbox size

def _nav_bar(pg, pn, q, prev_qid, next_qid, toc_tgt):
    r_bar = fitz.Rect(0, 0, PW, NAV_H)
    pg.draw_rect(r_bar, color=None, fill=SURF)

    # ← CONTENTS
    c_r = fitz.Rect(3, 2, 66, NAV_H-2)
    pg.draw_rect(c_r, color=None, fill=OVR)
    pg.insert_text(fitz.Point(6, NAV_H-5), "← CONTENTS",
                   fontsize=SN, color=LINK, fontname=FB)
    if toc_tgt is not None:
        _add(pn, c_r, "goto", toc_tgt)

    # Centre label
    short = f"#{q['id']} · {q['title'][:32]}"
    pg.insert_text(fitz.Point(PW/2-60, NAV_H-5), short,
                   fontsize=SN, color=SUB, fontname=FR)

    # PREV
    if prev_qid is not None:
        pr = fitz.Rect(PW-126, 2, PW-68, NAV_H-2)
        pg.draw_rect(pr, color=None, fill=OVR)
        pg.insert_text(fitz.Point(PW-124, NAV_H-5), f"← #{prev_qid}",
                       fontsize=SN, color=TEXT, fontname=FB)
        _add(pn, pr, "prev_q", prev_qid)

    # NEXT
    if next_qid is not None:
        nr = fitz.Rect(PW-64, 2, PW-4, NAV_H-2)
        pg.draw_rect(nr, color=None, fill=OVR)
        pg.insert_text(fitz.Point(PW-62, NAV_H-5), f"#{next_qid} →",
                       fontsize=SN, color=TEXT, fontname=FB)
        _add(pn, nr, "next_q", next_qid)


def _q_header(pg, pn, q, is_first):
    """Draw question title block. Returns y after header."""
    sc = set_col(q["set"])
    diff = q.get("difficulty","")
    sec = q.get("section") or ""
    pts = sec.split(" - ", 1)
    pd0 = pts[0].split() if pts else []
    pri = pd0[0] if pd0 else ""
    pat = pts[1] if len(pts)>1 else q.get("pattern") or ""

    if not is_first:
        y = NAV_H + 4
        pg.insert_text(fitz.Point(ML, y+8),
                       f"#{q['id']} · {q['title']} (continued)",
                       fontsize=8, color=SUB, fontname=FR)
        return y + 14

    y = NAV_H + 2
    hh = 24.0
    pg.draw_rect(fitz.Rect(0, y, PW, y+hh), color=None, fill=SURF)
    pg.insert_text(fitz.Point(ML, y+16),
                   f"#{q['id']} · {q['title']}",
                   fontsize=13, color=TEXT, fontname=FB)
    y += hh + 4

    # Badges
    bx = ML
    def badge(txt, bg, fg=BG):
        nonlocal bx
        w = max(20.0, len(txt)*5.5+8); h = 13.0
        pg.draw_rect(fitz.Rect(bx,y,bx+w,y+h), color=None, fill=bg)
        pg.insert_text(fitz.Point(bx+3, y+9.5), txt,
                       fontsize=7.5, color=fg, fontname=FB)
        bx += w+4
        return w

    badge(f"S{q['set']}", sc)
    badge(diff, diff_col(diff))
    if pri in ("High","Mid","Low"): badge(pri, prio_col(pri))
    if pat:
        pg.draw_rect(fitz.Rect(bx,y,bx+max(40.0,len(pat)*5.2+8),y+13),
                     color=None, fill=OVR)
        pg.insert_text(fitz.Point(bx+3, y+9.5), pat,
                       fontsize=7.5, color=TEXT, fontname=FR)

    # ☐ All Good
    cx = PW-MR-CB_SZ-30
    cb_r = fitz.Rect(cx, y+1.5, cx+CB_SZ, y+1.5+CB_SZ)
    pg.draw_rect(cb_r, color=_h("a6e3a1"), fill=WHITE, width=1.2)
    pg.insert_text(fitz.Point(cx+CB_SZ+3, y+10.5), "All Good",
                   fontsize=7, color=HIGH, fontname=FB)
    wd = fitz.Widget()
    wd.rect = cb_r; wd.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
    wd.field_name = f"solved_{q['id']}"; wd.field_value = "Off"; wd.on_state = "Yes"
    pg.add_widget(wd)

    return y + 13 + 5


class QRenderer:
    def __init__(self, doc, q, prev_qid, next_qid, toc_tgt):
        self.doc = doc; self.q = q
        self.prev_qid = prev_qid; self.next_qid = next_qid
        self.toc_tgt = toc_tgt
        self.first_pn = -1
        self.all_pns = []
        self._start_page(first=True)

    def _start_page(self, first=False):
        pg = self.doc.new_page(width=PW, height=PH)
        pg.draw_rect(fitz.Rect(0,0,PW,PH), color=None, fill=BG)
        pn = len(self.doc)-1
        self.all_pns.append(pn)
        if first: self.first_pn = pn
        self.pg = pg; self.pn = pn
        _nav_bar(pg, pn, self.q, self.prev_qid, self.next_qid, self.toc_tgt)
        self.y = _q_header(pg, pn, self.q, is_first=first)

    def _chk(self, need):
        if self.y + need > PH - MB - 14:
            self._start_page(first=False)

    def _txt(self, txt, x=None, sz=SB, col=None, bold=False, mono=False):
        if x is None: x = ML+2
        if col is None: col = TEXT
        fn = FM if mono else (FB if bold else FR)
        self._chk(sz*1.4)
        self.pg.insert_text(fitz.Point(x, self.y+sz), txt,
                            fontsize=sz, color=col, fontname=fn)
        self.y += sz*1.35

    def _gap(self, h=5.0): self.y += h

    def _hl(self, col=None, g=3):
        if col is None: col = OVR
        self._chk(2); self._gap(g)
        self.pg.draw_line(fitz.Point(ML,self.y), fitz.Point(PW-MR,self.y),
                          color=col, width=0.4)
        self._gap(g)

    def _sec(self, title, col=None):
        if col is None: col = OVR
        h = SH+7
        self._chk(h+4)
        r = fitz.Rect(ML, self.y, PW-MR, self.y+h)
        self.pg.draw_rect(r, color=None, fill=col)
        self.pg.insert_text(fitz.Point(ML+6, self.y+h-3), title,
                            fontsize=SH, color=WHITE, fontname=FB)
        self.y += h+4

    # ── Description ──────────────────────────────────────────────────────────
    def do_desc(self):
        desc = self.q.get("description") or ""
        if not desc: return
        self._sec("PROBLEM DESCRIPTION")
        for raw in desc.split("\n"):
            raw = raw.strip()
            if not raw:
                self._gap(2.5); continue
            for line in wrap(raw, WB):
                self._txt(line, sz=SB)
        self._gap(4)

    # ── Community links ───────────────────────────────────────────────────────
    def do_links(self):
        q = self.q
        self._sec("COMMUNITY SOLUTIONS")
        urls = community_urls(q["id"], q["slug"])
        BW, BH, GAP = 128.0, 17.0, 8.0
        self._chk(BH*2+GAP+4)

        for row_urls in [urls[:2], urls[2:]]:
            bx = ML+2
            for label, url in row_urls:
                # ☐ checkbox
                cb_r = fitz.Rect(bx, self.y+(BH-CB_SZ)/2,
                                 bx+CB_SZ, self.y+(BH+CB_SZ)/2)
                self.pg.draw_rect(cb_r, color=OVR, fill=WHITE, width=0.7)
                wd = fitz.Widget()
                wd.rect = cb_r; wd.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
                wd.field_name = f"sol_{q['id']}_{label.lower().replace('.','_')}"
                wd.field_value = "Off"; wd.on_state = "Yes"
                self.pg.add_widget(wd)
                bx += CB_SZ+4

                # link button
                btn = fitz.Rect(bx, self.y, bx+BW, self.y+BH)
                self.pg.draw_rect(btn, color=LINK, fill=SURF, width=0.6)
                self.pg.insert_text(fitz.Point(bx+6, self.y+BH-4),
                                    f"▸ {label}", fontsize=8.5, color=LINK, fontname=FB)
                _add(self.pn, btn, "uri", url)
                bx += BW+GAP+(CB_SZ+4)+4
            self.y += BH+5

        self._gap(4)

    # ── Interview approach ────────────────────────────────────────────────────
    def do_approach(self):
        approach = self.q.get("interviewApproach") or ""
        if not approach: return
        self._sec("INTERVIEW APPROACH  —  STAR-LC")
        segs = parse_approach(approach)

        for stype, stext in segs:
            if stype == "blank":
                self._gap(2)

            elif stype == "phase_hdr":
                pk = stext[:7]   # "PHASE N"
                pc = PHASE_COL.get(pk, OVR)
                h = SP+7
                self._chk(h+3)
                ph_r = fitz.Rect(ML, self.y, PW-MR, self.y+h)
                self.pg.draw_rect(ph_r, color=None, fill=pc)
                self.pg.insert_text(fitz.Point(ML+6, self.y+h-3),
                                    stext, fontsize=SP, color=BG, fontname=FB)
                self.y += h+3

            elif stype == "code":
                for line in wrap(stext, WC):
                    indent_px = (len(line)-len(line.lstrip())) * SC * 0.55
                    self._txt(line, x=ML+4+indent_px, sz=SC, mono=True)

            elif stype == "comment":
                for line in wrap(stext, WB):
                    if not line.strip():
                        self._gap(1.5); continue
                    is_dial = line.strip().startswith('"')
                    c = _h("cba6f7") if is_dial else TEXT
                    ix = 10.0 if is_dial else 2.0
                    self._txt(line, x=ML+ix, sz=SB, col=c)

        self._gap(4)

    # ── Quick review ──────────────────────────────────────────────────────────
    def do_qr(self):
        q = self.q
        qr = QR_BY_ID.get(q["id"])
        insights = complexity = ""

        if qr:
            insights   = qr.get("key_insights","")
            complexity = qr.get("complexity","")
        else:
            # Extract Phase 6 lines as fallback
            approach = q.get("interviewApproach") or ""
            in6 = False; lines6 = []
            for line in approach.split("\n"):
                if "PHASE 6" in line: in6 = True; continue
                if in6:
                    if re.match(r"^# PHASE \d+", line): break
                    if line.startswith("# "): lines6.append(line[2:])
            insights = "\n".join(lines6[:6]).strip()

        if not insights and not complexity: return

        self._sec("QUICK REVIEW")
        if insights:
            for raw in insights.split("\n")[:6]:
                raw = raw.strip()
                if not raw: continue
                for line in wrap(raw, WB):
                    self._txt(f"• {line}", sz=SB)
        if complexity:
            self._gap(3)
            for raw in complexity.split("\n")[:2]:
                raw = raw.strip()
                if raw: self._txt(raw, sz=SS, col=SUB)
        self._gap(5)

    # ── Footer on all pages ───────────────────────────────────────────────────
    def do_footer(self):
        lc_url = f"https://leetcode.com/problems/{self.q['slug']}/"
        for i, pn in enumerate(self.all_pns):
            p = self.doc[pn]
            p.draw_rect(fitz.Rect(0,PH-13,PW,PH), color=None, fill=SURF)
            p.insert_text(fitz.Point(ML, PH-3),
                          f"#{self.q['id']} · {self.q['title']}",
                          fontsize=6.5, color=SUB, fontname=FR)
            p.insert_text(fitz.Point(PW-62, PH-3), "► LeetCode",
                          fontsize=6.5, color=LINK, fontname=FB)
            lc_r = fitz.Rect(PW-62, PH-13, PW-MR, PH)
            _add(pn, lc_r, "uri", lc_url)
            pg_num_r = fitz.Rect(PW/2-12, PH-13, PW/2+12, PH)
            p.insert_text(fitz.Point(PW/2-8, PH-3), str(pn+1),
                          fontsize=6.5, color=SUB, fontname=FR)

    def render(self):
        self.do_desc()
        self.do_links()
        self.do_approach()
        self.do_qr()
        self.do_footer()


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════
def main():
    doc = fitz.open()

    print("Rendering cover…")
    render_cover(doc)                        # page 0

    print("Reserving TOC pages…")
    toc_pns = add_toc_placeholders(doc)     # pages 1-4

    anchor_pages = {}   # anchor_key -> 0-indexed page number
    qid_first_page = {} # qid -> 0-indexed page number

    cur_set = cur_pri = cur_diff = cur_pat = None

    print(f"Rendering {len(ORDERED)} questions across all sets…")
    for idx, q in enumerate(ORDERED):
        sn   = q["set"]
        sec  = q.get("section") or ""
        pts  = sec.split(" - ", 1)
        if len(pts) == 2:
            pd   = pts[0].split()
            pri  = pd[0] if pd else "Unknown"
            diff = pd[1] if len(pd)>1 else "Unknown"
            pat  = pts[1]
        else:
            pri = diff = pat = "Unknown"

        # Set divider
        if sn != cur_set:
            pn = render_set_div(doc, sn)
            anchor_pages[f"set:{sn}"] = pn
            cur_set = sn; cur_pri = cur_diff = cur_pat = None

        # Priority divider
        if pri != cur_pri:
            pn = render_prio_div(doc, sn, pri)
            anchor_pages[f"set:{sn}:prio:{pri}"] = pn
            cur_pri = pri; cur_diff = cur_pat = None

        # Diff anchor (no new page — just record next question's page)
        if diff != cur_diff:
            anchor_pages[f"set:{sn}:prio:{pri}:diff:{diff}"] = len(doc)
            cur_diff = diff; cur_pat = None

        # Pattern anchor
        if pat != cur_pat:
            anchor_pages[f"set:{sn}:prio:{pri}:diff:{diff}:pat:{pat}"] = len(doc)
            cur_pat = pat

        prev_qid = ORDERED[idx-1]["id"] if idx > 0 else None
        next_qid = ORDERED[idx+1]["id"] if idx < len(ORDERED)-1 else None
        toc_tgt  = anchor_pages.get(f"set:{sn}")  # back to set divider

        renderer = QRenderer(doc, q, prev_qid, next_qid, toc_tgt)
        renderer.render()
        qid_first_page[q["id"]] = renderer.first_pn

        if (idx+1) % 100 == 0 or (idx+1) == len(ORDERED):
            print(f"  {idx+1}/{len(ORDERED)}  ({len(doc)} pages so far)")

    # ── Render TOC ─────────────────────────────────────────────────────────────
    print("Rendering table of contents…")
    toc_links = render_toc(doc, toc_pns, anchor_pages)

    # ── Inject links ───────────────────────────────────────────────────────────
    print("Injecting hyperlinks…")
    n = {"goto":0,"uri":0,"prev":0,"next":0,"toc":0}

    # Question-page links
    for pn, rect, kind, target in _LINKS:
        pg = doc[pn]
        if kind == "goto":
            pg.insert_link({"kind":fitz.LINK_GOTO,"from":rect,
                            "page":target,"to":fitz.Point(0,0),"zoom":0})
            n["goto"] += 1
        elif kind == "uri":
            pg.insert_link({"kind":fitz.LINK_URI,"from":rect,"uri":target})
            n["uri"] += 1
        elif kind == "prev_q":
            tgt = qid_first_page.get(target)
            if tgt is not None:
                pg.insert_link({"kind":fitz.LINK_GOTO,"from":rect,
                                "page":tgt,"to":fitz.Point(0,0),"zoom":0})
                n["prev"] += 1
        elif kind == "next_q":
            tgt = qid_first_page.get(target)
            if tgt is not None:
                pg.insert_link({"kind":fitz.LINK_GOTO,"from":rect,
                                "page":tgt,"to":fitz.Point(0,0),"zoom":0})
                n["next"] += 1

    # TOC links
    for tp, rect, kind, target in toc_links:
        pg = doc[tp]
        if kind == "goto":
            pg.insert_link({"kind":fitz.LINK_GOTO,"from":rect,
                            "page":target,"to":fitz.Point(0,0),"zoom":0})
            n["toc"] += 1

    total_links = sum(n.values())
    print(f"  Links: {total_links} "
          f"(goto={n['goto']} uri={n['uri']} prev={n['prev']} "
          f"next={n['next']} toc={n['toc']})")

    # ── PDF outline (sidebar bookmarks) ────────────────────────────────────────
    print("Building PDF outline…")
    outline = [[1, "Contents", toc_pns[0]+1]]
    for sn in [1,2,3]:
        sp = anchor_pages.get(f"set:{sn}")
        if sp is None: continue
        outline.append([1, f"Set {sn} — {SET_NAMES[sn]}", sp+1])
        for pri in PRIO_ORDER:
            pp = anchor_pages.get(f"set:{sn}:prio:{pri}")
            if pp is None: continue
            outline.append([2, f"{pri} Priority", pp+1])
            for diff in DIFF_ORDER:
                dp = anchor_pages.get(f"set:{sn}:prio:{pri}:diff:{diff}")
                if dp is None: continue
                outline.append([3, diff, dp+1])
                for pat in sorted(HIER.get(sn,{}).get(pri,{}).get(diff,{})):
                    ep = anchor_pages.get(f"set:{sn}:prio:{pri}:diff:{diff}:pat:{pat}")
                    if ep is None: continue
                    cnt = len(HIER[sn][pri][diff][pat])
                    outline.append([4, f"{pat} ({cnt})", ep+1])
    doc.set_toc(outline)

    # ── Save ───────────────────────────────────────────────────────────────────
    total_pages = len(doc)
    print(f"Saving {total_pages}-page PDF…")
    tmp = OUTPUT_PATH.with_suffix(".tmp.pdf")
    doc.save(str(tmp), garbage=4, deflate=True, incremental=False)
    doc.close()
    tmp.replace(OUTPUT_PATH)
    kb = OUTPUT_PATH.stat().st_size // 1024
    print(f"\n✓  Done → {OUTPUT_PATH}")
    print(f"   {total_pages} pages  ·  {kb:,} KB  ·  {total_links:,} hyperlinks")


if __name__ == "__main__":
    main()

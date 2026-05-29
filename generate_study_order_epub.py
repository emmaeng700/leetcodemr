"""
LeetMastery — Study-Order EPUB
================================
One HTML page per question, organised into 9 round chapters:
  Round 1  High · Easy  …  Round 9  Low · Hard

Each chapter ends with a Quick-Review summary page.
Images are embedded as separate EPUB items (correct EPUB spec).
Code is syntax-highlighted via Pygments (friendly light theme).

Output:
  LeetMastery_Study_Order.epub

Usage:
  python3 generate_study_order_epub.py
"""

import json, re, html as _html_mod, mimetypes, sys
from pathlib import Path

# Pass --light to generate a light-mode EPUB (white bg, dark text) suitable for PDF conversion.
# Default (no flag) = dark-mode EPUB optimised for Calibre.
LIGHT_MODE = '--light' in sys.argv

from ebooklib import epub
import ebooklib.utils as _ebu

# ── Patch: handle pages with empty body gracefully ────────────────────────────
_orig_get_pages = _ebu.get_pages
def _safe_get_pages(item):
    try:
        body = item.get_body_content()
        if not body or body.strip() in (b'', b' '):
            return []
        return _orig_get_pages(item)
    except Exception:
        return []
_ebu.get_pages = _safe_get_pages

# ── Core helpers from the PDF generator ──────────────────────────────────────
from generate_patterns_pdf import (
    QUICK_PATTERNS,
    _inline,
    _clean_code,
    download_image,
    _img_filename,
    IMG_DIR,
    gen_brute_force_python,
    _QR_DATA,
)

# ── Pygments syntax highlighting ──────────────────────────────────────────────
from pygments import highlight
from pygments.lexers import PythonLexer, JavascriptLexer, TypeScriptLexer
from pygments.formatters import HtmlFormatter

_PY_LEXER = PythonLexer(stripnl=False)
_JS_LEXER = JavascriptLexer(stripnl=False)
_TS_LEXER = TypeScriptLexer(stripnl=False)

# noclasses=True embeds colors as inline style="" attributes.
# EPUB readers (Apple Books, Kindle) often ignore external CSS classes but
# always honour inline styles, so this is the only reliable way to get colour.
# monokai = dark bg, bright vibrant colours — readable in dark + light mode.
_FORMATTER = HtmlFormatter(style='monokai', noclasses=True, nowrap=False)

# Minimal wrapper CSS (layout only — colours come from inline styles)
PYGMENTS_CSS = """
.hl { border-radius: 6px; margin: 4px 0 12px 0; font-size: 0.82em; }
.hl pre {
  margin: 0; padding: 12px 14px;
  overflow-x: auto; white-space: pre-wrap; word-break: break-all;
  font-family: "SF Mono", "Menlo", "Monaco", "Consolas", monospace;
  font-size: 0.92em; line-height: 1.5;
}
"""

def highlight_python(code: str) -> str:
    try:
        return highlight(code, _PY_LEXER, _FORMATTER)
    except Exception:
        return f'<div class="hl"><pre>{esc(code)}</pre></div>'

def highlight_js(code: str, lang: str = 'js') -> str:
    try:
        lexer = _TS_LEXER if lang.lower() in ('typescript', 'ts') else _JS_LEXER
        return highlight(code, lexer, _FORMATTER)
    except Exception:
        return f'<div class="hl"><pre>{esc(code)}</pre></div>'

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
QUESTIONS   = SCRIPT_DIR / "public" / "questions_full.json"
SITES_CACHE = SCRIPT_DIR / ".full_langs_cache.json"
DOOCS_CACHE = SCRIPT_DIR / ".doocs_cache.json"
OUTPUT_EPUB = SCRIPT_DIR / ("LeetMastery_Study_Order_Light.epub" if LIGHT_MODE else "LeetMastery_Study_Order.epub")

# ── Study-order config ────────────────────────────────────────────────────────
PATTERN_PRIORITY = {
    'Arrays & Hashing': 'High', 'String': 'High', 'Two Pointers': 'High',
    'Sliding Window': 'High', 'Sorting': 'High', 'Binary Search': 'High',
    'Matrix': 'High', 'Trees & BST': 'High', 'DFS': 'High',
    'Graphs': 'High', 'BFS': 'High',
    'Linked List': 'Mid', 'Stack': 'Mid', 'Heap': 'Mid',
    'Trie': 'Mid', 'Backtracking': 'Mid', 'Greedy': 'Mid',
    'Dynamic Programming': 'Low', 'Bit Manipulation': 'Low',
    'Math': 'Low', 'JavaScript': 'Low',
}
DISPLAY_PATTERN_ORDER = [
    'Arrays & Hashing', 'String', 'Two Pointers', 'Sliding Window', 'Sorting',
    'Binary Search', 'Matrix', 'Trees & BST', 'DFS', 'Graphs', 'BFS',
    'Linked List', 'Stack', 'Heap', 'Trie', 'Backtracking', 'Greedy',
    'Dynamic Programming', 'Bit Manipulation', 'Math', 'JavaScript',
]
ROUNDS = [
    (1, 'High', 'Easy'),   (2, 'High', 'Medium'), (3, 'High', 'Hard'),
    (4, 'Mid',  'Easy'),   (5, 'Mid',  'Medium'),  (6, 'Mid',  'Hard'),
    (7, 'Low',  'Easy'),   (8, 'Low',  'Medium'),  (9, 'Low',  'Hard'),
]
PRIORITY_COLOR = {
    'High': {'bg': '#FEE2E2', 'fg': '#991B1B', 'bar': '#DC2626', 'dot': '🔴'},
    'Mid':  {'bg': '#FEF3C7', 'fg': '#92400E', 'bar': '#D97706', 'dot': '🟡'},
    'Low':  {'bg': '#F3F4F6', 'fg': '#374151', 'bar': '#6B7280', 'dot': '⚪'},
}
DIFF_COLOR = {
    'Easy':   {'bg': '#D1FAE5', 'fg': '#065F46', 'dot': '🟢'},
    'Medium': {'bg': '#FEF3C7', 'fg': '#92400E', 'dot': '🟡'},
    'Hard':   {'bg': '#FEE2E2', 'fg': '#991B1B', 'dot': '🔴'},
}

# ── CSS ───────────────────────────────────────────────────────────────────────
EPUB_CSS = """
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #111;
  margin: 0;
  padding: 16px;
  max-width: 720px;
}
h1 { font-size: 1.4em; margin: 0 0 4px 0; }
h2 { font-size: 1.1em; margin: 14px 0 4px 0; color: #222; }
h3 { font-size: 1em; margin: 10px 0 3px 0; color: #555; }

.round-header {
  border-radius: 10px; padding: 24px 20px;
  margin-bottom: 20px; text-align: center;
}
.round-number { font-size: 2.2em; font-weight: 900; margin: 0; }
.round-label  { font-size: 1.1em; font-weight: 700; margin: 4px 0 0 0; }
.round-count  { font-size: 0.85em; color: #555; margin-top: 8px; }

.pill {
  display: inline-block; border-radius: 999px;
  padding: 2px 10px; font-size: 0.75em;
  font-weight: 700; margin-right: 6px;
}

.q-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 12px; }
.q-title  { font-size: 1.25em; font-weight: 800; margin: 0 0 6px 0; }
.q-meta   { font-size: 0.8em; color: #6b7280; margin: 3px 0; }
.q-links  { font-size: 0.8em; margin: 6px 0; }
.q-links a { color: #2563eb; text-decoration: none; margin-right: 10px; }

.pattern-bar {
  background: #f3f4f6; border-left: 4px solid #9ca3af;
  padding: 5px 12px; font-size: 0.82em; font-weight: 700;
  color: #374151; margin-bottom: 12px; border-radius: 0 4px 4px 0;
}

/* Code blocks */
.code-label {
  font-size: 0.72em; font-weight: 700; color: #6b7280;
  margin: 14px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;
}
.hl { border-radius: 6px; font-size: 0.82em; margin: 4px 0 12px 0; }
.hl pre {
  margin: 0; padding: 12px 14px; overflow-x: auto;
  white-space: pre-wrap; word-break: break-all;
  font-family: "SF Mono", "Menlo", "Monaco", "Consolas", monospace;
  font-size: 0.92em; line-height: 1.5;
}

img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 8px 0; }
hr  { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }

/* qr colours set dynamically per mode — see _QR_ITEM_CSS below */
.qr-title { font-weight: 700; font-size: 0.95em; margin: 0 0 4px 0; }
.qr-section-label {
  font-size: 0.72em; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em; margin: 8px 0 2px 0;
}
.qr-body { font-size: 0.84em; margin: 0; padding-left: 14px; }

.toc-round { font-weight: 700; margin: 10px 0 2px 0; font-size: 0.9em; }
.toc-q     { font-size: 0.8em; color: #374151; margin: 1px 0 1px 14px; }

.summary-banner {
  border-radius: 8px; padding: 14px 18px; margin-bottom: 18px;
}
.summary-title { font-size: 1.1em; font-weight: 800; margin: 0; }
.summary-sub   { font-size: 0.84em; margin: 4px 0 0 0; color: #555; }
""" + "\n/* Pygments */\n" + PYGMENTS_CSS + ("""
/* Light-mode quick-review overrides */
.qr-item { border-bottom: 1px solid #e5e7eb; padding: 12px 0; }
""" if LIGHT_MODE else """
/* Dark-mode quick-review overrides */
.qr-item { border-bottom: 1px solid #3f4451; padding: 12px 0; }
""")

# ── Helpers ───────────────────────────────────────────────────────────────────
def esc(t: str) -> str:
    return _html_mod.escape(str(t))

def inline_text(raw_html: str) -> str:
    """
    Process inline HTML from a description fragment → safe plain text for EPUB.
    _inline() may return un-decoded HTML entities (e.g. &lt; inside <code> tags).
    html.unescape() normalises them to real characters before esc() re-encodes
    once for HTML output, ensuring &lt; never becomes &amp;lt;.
    """
    processed = _inline(raw_html, printable=True, bold=False).strip()
    decoded   = _html_mod.unescape(processed)   # &lt; → <
    return esc(decoded)                          # <  → &lt; (single-encoded)

# ── Image management: add to EPUB as items, reference by path ─────────────────
def register_image(book: epub.EpubBook, url: str, img_cache: dict):
    """
    Add image to the EPUB zip as EPUB/Images/<hash>.<ext> (once per URL).
    Uses a URL-hash prefix to guarantee unique filenames even when different
    questions share a generic name like ex1.jpg.
    Returns 'Images/<file>' or None if the image can't be loaded.
    """
    if url in img_cache:
        return img_cache[url]

    pil = download_image(url)
    if not pil:
        img_cache[url] = None
        return None

    fpath = IMG_DIR / _img_filename(url)
    if not fpath.exists():
        img_cache[url] = None
        return None

    ext  = fpath.suffix.lower().lstrip('.')
    mime = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png',  'gif': 'image/gif',
        'svg': 'image/svg+xml', 'webp': 'image/webp',
    }.get(ext, 'image/png')

    import hashlib
    url_hash  = hashlib.md5(url.encode()).hexdigest()[:8]
    safe_stem = re.sub(r'[^a-zA-Z0-9_.-]', '_', fpath.stem)[:30]
    unique_fn = f'{safe_stem}_{url_hash}.{ext}'
    epub_name = f'Images/{unique_fn}'
    uid       = f'img_{url_hash}'

    img_item = epub.EpubItem(
        uid=uid, file_name=epub_name,
        media_type=mime, content=fpath.read_bytes(),
    )
    book.add_item(img_item)

    img_cache[url] = epub_name   # relative from EPUB/ → 'Images/...'
    return epub_name

# ── Description HTML → EPUB HTML ─────────────────────────────────────────────
def desc_html_to_epub(desc_html: str, book: epub.EpubBook, img_cache: dict) -> str:
    """Convert Doocs HTML description to EPUB-safe HTML with real image paths."""
    if not desc_html:
        return ''
    out = []
    block_re = re.compile(
        r'(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|'
        r'(<img[^>]*/?>)|'
        r'(<pre[^>]*>)([\s\S]*?)(</pre>)|'
        r'(<ul[^>]*>)([\s\S]*?)(</ul>)|'
        r'(<ol[^>]*>)([\s\S]*?)(</ol>)|'
        r'(<p[^>]*>)([\s\S]*?)(</p>)|'
        r'(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)',
        re.I,
    )
    def _embed_img(url: str):
        if 'shields.io' in url or 'badge' in url.lower():
            return
        rel = register_image(book, url, img_cache)
        if rel:
            out.append(f'<p><img src="{rel}" alt=""/></p>')

    for m in block_re.finditer(desc_html):
        if m.group(1):   # glightbox
            src_m = (re.search(r'href=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(1), re.I) or
                     re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]',  m.group(1), re.I))
            if src_m: _embed_img(src_m.group(1))
            continue
        if m.group(2):   # img
            src_m = re.search(r'src=["\x27](https?://[^"\x27>\s]+)["\x27]', m.group(2), re.I)
            if src_m: _embed_img(src_m.group(1))
            continue
        if m.group(4) is not None:   # pre
            raw = _clean_code(m.group(4) or '').strip()
            if raw:
                out.append(f'<div class="hl"><pre>{esc(raw)}</pre></div>')
            continue
        if m.group(7) is not None:   # ul
            items_h = ''
            for li in re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(7) or '', re.I):
                text = inline_text(li)
                if text: items_h += f'<li>{text}</li>'
            if items_h: out.append(f'<ul>{items_h}</ul>')
            continue
        if m.group(10) is not None:  # ol
            items_h = ''
            for li in re.findall(r'<li[^>]*>([\s\S]*?)</li>', m.group(10) or '', re.I):
                text = inline_text(li)
                if text: items_h += f'<li>{text}</li>'
            if items_h: out.append(f'<ol>{items_h}</ol>')
            continue
        if m.group(13) is not None:  # p
            inner = m.group(13) or ''
            img_src = re.search(
                r'(?:src|href)=["\x27](https://fastly\.jsdelivr[^"\x27>\s]+)["\x27]',
                inner, re.I)
            if img_src:
                _embed_img(img_src.group(1))
                continue
            text = inline_text(inner)
            if text and text.strip() not in ('', '&#160;', '&nbsp;', ' '):
                out.append(f'<p>{text}</p>')
            continue
        if m.group(16) is not None:  # heading
            text = inline_text(m.group(16) or '')
            if text: out.append(f'<h3>{text}</h3>')
            continue
    return '\n'.join(out)

# ── Code block with syntax highlighting ──────────────────────────────────────
def code_block(code: str, label: str = '', lang: str = 'python') -> str:
    if not code.strip():
        return ''
    parts = []
    if label:
        parts.append(f'<p class="code-label">{esc(label)}</p>')
    if lang.lower() in ('javascript', 'js'):
        parts.append(highlight_js(code, 'js'))
    elif lang.lower() in ('typescript', 'ts'):
        parts.append(highlight_js(code, 'ts'))
    else:
        parts.append(highlight_python(code))
    return '\n'.join(parts)

# ── EPUB page wrapper ─────────────────────────────────────────────────────────
def epub_page(title: str, body_html: str) -> str:
    # No <?xml?> declaration — lxml rejects unicode strings with encoding declarations.
    safe_body = body_html if body_html.strip() else '<p> </p>'
    return (
        '<html xmlns="http://www.w3.org/1999/xhtml" lang="en">\n'
        '<head>\n'
        '  <meta charset="utf-8"/>\n'
        f'  <title>{esc(title)}</title>\n'
        '  <link rel="stylesheet" type="text/css" href="Styles/style.css"/>\n'
        '</head>\n'
        '<body>\n'
        f'{safe_body}\n'
        '</body>\n'
        '</html>'
    )

# ── Pattern/round data ────────────────────────────────────────────────────────
def build_exclusive_map(questions: list) -> dict:
    assigned = {}
    for p in QUICK_PATTERNS:
        ptags = set(p['tags'])
        for q in questions:
            if q['id'] not in assigned and set(q.get('tags', [])) & ptags:
                assigned[q['id']] = p['name']
    return assigned

def build_rounds(questions: list) -> list:
    exclusive   = build_exclusive_map(questions)
    pat_by_name = {p['name']: p for p in QUICK_PATTERNS}
    result = []
    for round_num, priority, difficulty in ROUNDS:
        tier_pats = [p for p in DISPLAY_PATTERN_ORDER if PATTERN_PRIORITY.get(p) == priority]
        groups = []
        for pat_name in tier_pats:
            pat_obj = pat_by_name.get(pat_name)
            if not pat_obj: continue
            qs = [q for q in questions
                  if exclusive.get(q['id']) == pat_name and q.get('difficulty') == difficulty]
            qs.sort(key=lambda q: q['id'])
            if qs:
                groups.append((pat_obj, qs))
        result.append((round_num, priority, difficulty, groups))
    return result

# ── Page builders ─────────────────────────────────────────────────────────────
def build_question_page(q: dict, pat_name: str, sites: dict, doocs: dict,
                        book: epub.EpubBook, img_cache: dict,
                        q_num: int = 0, q_total: int = 0) -> str:
    slug = q.get('slug', '')
    qid  = q['id']
    diff = q.get('difficulty', 'Easy')
    dc   = DIFF_COLOR.get(diff, DIFF_COLOR['Easy'])

    body = []
    body.append(
        '<p style="margin:0 0 8px 0;font-size:0.78em">'
        '<a href="toc.xhtml" style="color:#6366f1;text-decoration:none;'
        'font-weight:700;padding:3px 10px;border-radius:999px;'
        'border:1px solid #4f46e5;background:#1e1b4b">← Contents</a>'
        '</p>'
    )
    body.append(f'<div class="pattern-bar">{esc(pat_name)}</div>')

    diff_pill = (f'<span class="pill" style="background:{dc["bg"]};color:{dc["fg"]}">'
                 f'{dc["dot"]} {esc(diff)}</span>')
    counter_badge = (
        f' <span style="font-size:0.72em;font-weight:700;'
        f'background:#1e293b;color:#94a3b8;'
        f'border-radius:999px;padding:2px 8px;vertical-align:middle;'
        f'white-space:nowrap">{q_num}/{q_total}</span>'
        if q_num and q_total else ''
    )
    body.append('<div class="q-header">')
    body.append(f'<p class="q-title">#{qid} {esc(q["title"])}{counter_badge}</p>')
    body.append(f'<p class="q-meta">{diff_pill}</p>')
    body.append(
        f'<p class="q-links">'
        f'<a href="https://leetcode.com/problems/{slug}/">LeetCode</a>'
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/">LeetDoocs</a>'
        f'<a href="https://walkccc.me/LeetCode/problems/{qid}/">WalkCC</a>'
        f'<a href="https://www.simplyleet.com/{slug}">SimplyLeet</a>'
        f'</p>'
    )
    tags = q.get('tags', [])
    if tags:
        body.append(f'<p class="q-meta">Tags: {esc("  ·  ".join(tags[:8]))}</p>')
    src_lists = q.get('source', [])
    if src_lists:
        body.append(f'<p class="q-meta">Lists: {esc("  |  ".join(src_lists))}</p>')
    expl = q.get('explanation', '').strip()
    if expl:
        body.append(f'<p class="q-meta">⏱ {esc(expl[:300])}</p>')
    body.append('</div>')

    # Problem description (with real images)
    desc_html = doocs.get(str(qid), {}).get('desc_html', '')
    if desc_html:
        body.append('<h2>Problem</h2>')
        body.append(desc_html_to_epub(desc_html, book, img_cache))
        body.append('<hr/>')

    is_js = (pat_name == 'JavaScript')

    # Community solutions
    entry = sites.get(slug, {})
    doocs_blocks = doocs.get(str(qid), {}).get('blocks', [])
    merged = dict(entry)
    merged['doocs'] = [{'code': b['code'], 'lang': b.get('lang', '')} for b in doocs_blocks]

    SITE_META = [
        ('walkccc', 'WalkCC'), ('doocs', 'LeetDoocs'),
        ('simplyleet', 'SimplyLeet'), ('leetcodeca', 'LC.ca'),
    ]

    if is_js:
        js_langs = ('javascript', 'js', 'typescript', 'ts')
        has_any = False
        for site_key, site_label in SITE_META:
            blocks = merged.get(site_key, [])
            js_blocks = [b for b in blocks if b.get('lang','').lower() in js_langs]
            seen = set()
            for b in js_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                if not has_any:
                    body.append('<h2>★ Community Solutions (JavaScript / TypeScript)</h2>')
                    has_any = True
                lang = b.get('lang','js').lower()
                body.append(code_block(b['code'], site_label, lang))
        if not has_any:
            body.append('<p class="q-meta">No JavaScript / TypeScript solution in cache.</p>')
    else:
        has_any = False
        for site_key, site_label in SITE_META:
            blocks = merged.get(site_key, [])
            py_blocks = [b for b in blocks if b.get('lang','').lower() in ('python','python3','py')]
            seen = set()
            for b in py_blocks:
                key = b['code'][:100]
                if key in seen: continue
                seen.add(key)
                if not has_any:
                    body.append('<h2>★ Community Solutions (Python)</h2>')
                    has_any = True
                body.append(code_block(b['code'], site_label, 'python'))
        if not has_any:
            fallback = (q.get('python_solution') or '').strip()
            if fallback:
                body.append(code_block(fallback, '★ Solution (Python)', 'python'))

    return epub_page(f'#{qid} {q["title"]}', '\n'.join(body))


def build_round_chapter_page(round_num: int, priority: str, difficulty: str,
                              pattern_groups: list) -> str:
    pc    = PRIORITY_COLOR[priority]
    dc    = DIFF_COLOR[difficulty]
    total = sum(len(qs) for _, qs in pattern_groups)
    body  = [
        f'<div class="round-header" style="background:{pc["bg"]};border:2px solid {pc["bar"]}">',
        f'  <p class="round-number" style="color:{pc["fg"]}">Round {round_num}</p>',
        f'  <p class="round-label" style="color:{pc["fg"]}">'
        f'{pc["dot"]} {priority} Priority &nbsp;·&nbsp; {dc["dot"]} {difficulty}</p>',
        f'  <p class="round-count">{total} questions · {len(pattern_groups)} patterns</p>',
        '</div>',
        '<h2>Questions in this round</h2>',
    ]
    for pat, qs in pattern_groups:
        body.append(f'<p><strong>{esc(pat["name"])}</strong></p><ul>')
        for q in qs:
            diff_c = DIFF_COLOR.get(q.get('difficulty','Easy'), DIFF_COLOR['Easy'])
            body.append(
                f'<li>#{q["id"]} {esc(q["title"])} '
                f'<span class="pill" style="background:{diff_c["bg"]};color:{diff_c["fg"]}">'
                f'{diff_c["dot"]} {esc(q.get("difficulty",""))}</span></li>'
            )
        body.append('</ul>')
    return epub_page(f'Round {round_num} — {priority} · {difficulty}', '\n'.join(body))


def build_quick_review_page(round_num: int, priority: str, difficulty: str,
                             pattern_groups: list) -> str:
    if LIGHT_MODE:
        # Light mode: original colours — dark text on white/light backgrounds (good for PDF)
        _qr_pc = PRIORITY_COLOR   # {bg: light, fg: dark}
        diff_c = {'Easy': '#16A34A', 'Medium': '#D97706', 'Hard': '#DC2626'}
        _body_txt  = '#374151'
        _label_txt = '#6b7280'
        _sub_txt   = '#555'
        _pat_txt   = '#6b7280'
    else:
        # Dark mode: muted backgrounds + pastel text — no eye strain in Calibre dark mode
        _qr_pc = {
            'High': {'bg': '#2d1515', 'fg': '#fca5a5', 'bar': '#b91c1c', 'dot': '🔴'},
            'Mid':  {'bg': '#2a1f0a', 'fg': '#fcd34d', 'bar': '#b45309', 'dot': '🟡'},
            'Low':  {'bg': '#1a1f2e', 'fg': '#94a3b8', 'bar': '#475569', 'dot': '⚪'},
        }
        diff_c     = {'Easy': '#86efac', 'Medium': '#fde68a', 'Hard': '#fca5a5'}
        _body_txt  = '#d1d5db'
        _label_txt = '#9ca3af'
        _sub_txt   = '#94a3b8'
        _pat_txt   = '#9ca3af'

    pc      = _qr_pc[priority]
    dc      = DIFF_COLOR[difficulty]   # only used for the emoji dot
    all_qs  = [(pat, q) for pat, qs in pattern_groups for q in qs]

    body = [
        f'<div class="summary-banner" style="background:{pc["bg"]};border-left:4px solid {pc["bar"]}">',
        f'  <p class="summary-title" style="color:{pc["fg"]}">',
        f'    Round {round_num} · {pc["dot"]} {priority} · {dc["dot"]} {difficulty} — Quick Review',
        f'  </p>',
        f'  <p class="summary-sub" style="color:{_sub_txt}">{len(all_qs)} questions · key insights · complexity · solution</p>',
        '</div>',
    ]
    for pat, q in all_qs:
        slug  = q.get('slug', '')
        d     = q.get('difficulty', '')
        color = diff_c.get(d, _body_txt)
        info  = _QR_DATA.get(slug, {})

        body.append('<div class="qr-item">')
        body.append(
            f'<p class="qr-title">#{q["id"]} {esc(q["title"])}'
            f' <span style="color:{color}">[{esc(d)}]</span>'
            f' <span style="color:{_pat_txt}">· {esc(pat["name"])}</span></p>'
        )
        _body_style  = f'style="color:{_body_txt};font-size:0.86em;line-height:1.6"'
        _label_style = f'style="color:{_label_txt};font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 2px 0"'
        if info:
            ki = info.get('key_insights', '')
            if ki:
                body.append(f'<p class="qr-section-label" {_label_style}>Key Insights</p>')
                body.append(f'<ul class="qr-body" {_body_style}>')
                for line in ki.split('\n'):
                    line = line.strip().lstrip('-• ').strip()
                    if line: body.append(f'<li style="color:{_body_txt}">{esc(line)}</li>')
                body.append('</ul>')
            cx = info.get('complexity', '')
            if cx:
                body.append(f'<p class="qr-section-label" {_label_style}>Space &amp; Time</p>')
                body.append(f'<ul class="qr-body" {_body_style}>')
                for line in cx.split('\n'):
                    line = line.strip()
                    if line: body.append(f'<li style="color:{_body_txt}">{esc(line)}</li>')
                body.append('</ul>')
            sol = info.get('solution', '')
            if sol:
                body.append(f'<p class="qr-section-label" {_label_style}>Solution</p>')
                body.append(f'<div class="qr-body" {_body_style}>')
                for para in sol.split('\n\n'):
                    para = re.sub(r'\s*\n\s*', ' ', para).strip()
                    if para: body.append(f'<p style="color:{_body_txt};margin:4px 0">{esc(para)}</p>')
                body.append('</div>')
        else:
            body.append(f'<p class="qr-body" {_body_style}>No quick-review data available.</p>')
        body.append('</div>')

    return epub_page(
        f'Round {round_num} Quick Review — {priority} · {difficulty}',
        '\n'.join(body)
    )


def build_cover_page(total_qs: int) -> str:
    body = [
        '<div style="text-align:center;padding:40px 20px;">',
        '  <p style="font-size:0.9em;color:#6b7280;margin:0">LeetMastery</p>',
        '  <h1 style="font-size:2em;margin:8px 0">Study-Order Edition</h1>',
        '  <p style="color:#374151;font-size:0.95em">',
        '    Python Only &nbsp;·&nbsp; Priority-Grouped &nbsp;·&nbsp; Difficulty-First',
        '  </p>',
        '  <hr style="margin:24px auto;max-width:200px"/>',
        f'  <p style="font-size:0.85em;color:#6b7280">{total_qs} questions &nbsp;·&nbsp; 9 rounds</p>',
        '  <p style="font-size:0.82em;color:#9ca3af">',
        '    High Easy → High Med → High Hard<br/>',
        '    Mid Easy → Mid Med → Mid Hard<br/>',
        '    Low Easy → Low Med → Low Hard',
        '  </p>',
        '</div>',
        '<div style="padding:0 20px">',
    ]
    for round_num, priority, difficulty in ROUNDS:
        pc = PRIORITY_COLOR[priority]
        dc = DIFF_COLOR[difficulty]
        body.append(
            f'<p style="margin:4px 0">'
            f'<span class="pill" style="background:{pc["bg"]};color:{pc["fg"]}">'
            f'{pc["dot"]} Round {round_num} &nbsp; {priority} · {difficulty}</span></p>'
        )
    body.append('</div>')
    return epub_page('LeetMastery Study-Order', '\n'.join(body))


def build_toc_page(rounds: list) -> str:
    # Dark-mode palette for TOC (same as quick review banners)
    _toc_pc = {
        'High': {'bg': '#2d1515', 'fg': '#fca5a5', 'bar': '#b91c1c', 'dot': '🔴'},
        'Mid':  {'bg': '#2a1f0a', 'fg': '#fcd34d', 'bar': '#b45309', 'dot': '🟡'},
        'Low':  {'bg': '#1a1f2e', 'fg': '#94a3b8', 'bar': '#475569', 'dot': '⚪'},
    }
    diff_dot = {'Easy': '🟢', 'Medium': '🟡', 'Hard': '🔴'}

    body = [
        '<h1 style="font-size:1.3em;margin:0 0 4px 0">Contents</h1>',
        '<p style="font-size:0.8em;color:#9ca3af;margin:0 0 20px 0">'
        'Tap a round or question to jump straight there.</p>',
    ]

    q_counter = 0  # global counter across all rounds for display
    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs:
            continue

        pc       = _toc_pc[priority]
        ch_href  = f'round_{round_num:02d}_chapter.xhtml'
        dd       = diff_dot.get(difficulty, '')
        round_start = q_counter + 1

        # ── Round header — clickable link to chapter page ──────────────────────
        body.append(
            f'<div style="margin:18px 0 6px 0;border-radius:10px;'
            f'background:{pc["bg"]};border-left:4px solid {pc["bar"]};'
            f'padding:10px 14px">'
            f'<a href="{ch_href}" style="text-decoration:none">'
            f'<p style="margin:0;font-size:1em;font-weight:800;color:{pc["fg"]}">'
            f'{pc["dot"]} Round {round_num} &nbsp;·&nbsp; {priority} Priority &nbsp;·&nbsp; {dd} {difficulty}'
            f'</p>'
            f'<p style="margin:4px 0 0 0;font-size:0.78em;color:#9ca3af">'
            f'{len(all_qs)} questions &nbsp;·&nbsp; {len(pattern_groups)} patterns</p>'
            f'</a>'
            f'</div>'
        )

        # ── Questions grouped by pattern ───────────────────────────────────────
        for pat, qs in pattern_groups:
            # Pattern label (not a link, just a separator)
            body.append(
                f'<p style="margin:10px 0 4px 8px;font-size:0.72em;font-weight:700;'
                f'color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">'
                f'{esc(pat["name"])} ({len(qs)})</p>'
            )
            body.append('<ul style="margin:0 0 4px 0;padding-left:8px;list-style:none">')
            for q in qs:
                q_counter += 1
                q_href = f'round_{round_num:02d}_q{q["id"]:04d}.xhtml'
                diff   = q.get('difficulty', '')
                diff_c = {'Easy': '#86efac', 'Medium': '#fde68a', 'Hard': '#fca5a5'}.get(diff, '#9ca3af')
                cb_id  = f'cb_{q["id"]}'
                body.append(
                    f'<li style="margin:3px 0;font-size:0.84em;line-height:1.6;'
                    f'display:flex;align-items:center;gap:7px">'
                    f'<input type="checkbox" id="{cb_id}"'
                    f' style="width:14px;height:14px;flex-shrink:0;'
                    f'accent-color:#6366f1;cursor:pointer;'
                    f'border:1.5px solid #4b5563;border-radius:3px"/>'
                    f'<a href="{q_href}" style="color:#d1d5db;text-decoration:none;flex:1">'
                    f'<span style="color:#6b7280;font-size:0.85em;margin-right:4px">#{q["id"]}</span>'
                    f'{esc(q["title"])}'
                    f' <span style="color:{diff_c};font-size:0.8em">[{diff[:3]}]</span>'
                    f'</a>'
                    f'</li>'
                )
            body.append('</ul>')

    return epub_page('Contents', '\n'.join(body))

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Loading data…')
    questions = json.loads(QUESTIONS.read_text())
    sites     = json.loads(SITES_CACHE.read_text()) if SITES_CACHE.exists() else {}
    doocs     = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    print(f'  {len(questions)} questions · sites: {len(sites)} · doocs: {len(doocs)}')

    print('Building study-order rounds…')
    rounds   = build_rounds(questions)
    total_qs = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)
    for rn, pri, diff, pgs in rounds:
        total = sum(len(qs) for _, qs in pgs)
        print(f'  Round {rn}  {pri:4s} {diff:7s}  {total:3d} q')

    print('\nBuilding EPUB…')
    book      = epub.EpubBook()
    img_cache = {}   # url → 'Images/filename.ext'  (avoids duplicates)

    book.set_identifier('leetmastery-study-order-2026')
    book.set_title('LeetMastery Study-Order Edition')
    book.set_language('en')
    book.add_author('LeetMastery')

    # CSS
    style_item = epub.EpubItem(
        uid='style', file_name='Styles/style.css',
        media_type='text/css', content=EPUB_CSS,
    )
    book.add_item(style_item)

    all_items   = []
    toc_entries = []

    # Cover
    cover = epub.EpubHtml(title='Cover', file_name='cover.xhtml', lang='en')
    cover.content = build_cover_page(total_qs)
    cover.add_item(style_item)
    book.add_item(cover)
    all_items.append(cover)

    # TOC page
    toc_pg = epub.EpubHtml(title='Table of Contents', file_name='toc.xhtml', lang='en')
    toc_pg.content = build_toc_page(rounds)
    toc_pg.add_item(style_item)
    book.add_item(toc_pg)
    all_items.append(toc_pg)

    # Rounds
    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue

        round_items = []

        # Chapter header
        ch_fn    = f'round_{round_num:02d}_chapter.xhtml'
        ch_title = f'Round {round_num} — {priority} · {difficulty}'
        ch = epub.EpubHtml(title=ch_title, file_name=ch_fn, lang='en')
        ch.content = build_round_chapter_page(round_num, priority, difficulty, pattern_groups)
        ch.add_item(style_item)
        book.add_item(ch)
        all_items.append(ch)
        round_items.append(ch)

        # Questions
        total_in_round = len(all_qs_in_round)
        q_idx = 0
        for pat, qs in pattern_groups:
            for q in qs:
                q_idx += 1
                fn    = f'round_{round_num:02d}_q{q["id"]:04d}.xhtml'
                title = f'#{q["id"]} {q["title"]}'
                qi    = epub.EpubHtml(title=title, file_name=fn, lang='en')
                qi.content = build_question_page(q, pat['name'], sites, doocs, book, img_cache,
                                                 q_num=q_idx, q_total=total_in_round)
                qi.add_item(style_item)
                book.add_item(qi)
                all_items.append(qi)
                round_items.append(qi)
                if q_idx % 25 == 0:
                    print(f'  Round {round_num}: {q_idx}/{len(all_qs_in_round)} q  '
                          f'({len(img_cache)} images cached)')

        # Quick Review
        qr_fn    = f'round_{round_num:02d}_quickreview.xhtml'
        qr_title = f'Round {round_num} Quick Review — {priority} · {difficulty}'
        qr = epub.EpubHtml(title=qr_title, file_name=qr_fn, lang='en')
        qr.content = build_quick_review_page(round_num, priority, difficulty, pattern_groups)
        qr.add_item(style_item)
        book.add_item(qr)
        all_items.append(qr)
        round_items.append(qr)

        toc_entries.append(epub.Section(ch_title, round_items))
        imgs_in_round = sum(1 for v in img_cache.values() if v)
        print(f'  Round {round_num} done — {len(all_qs_in_round)} q  ({imgs_in_round} images total)')

    # Spine, NCX, Nav
    book.toc = tuple(toc_entries)
    ncx = epub.EpubNcx()
    nav = epub.EpubNav()
    book.add_item(ncx)
    book.add_item(nav)
    book.spine = [nav] + all_items

    print(f'\nWriting EPUB ({len(all_items)} pages, {sum(1 for v in img_cache.values() if v)} images)…')
    epub.write_epub(str(OUTPUT_EPUB), book)
    kb = OUTPUT_EPUB.stat().st_size // 1024
    print(f'Done → {OUTPUT_EPUB}  ({kb:,} KB)')

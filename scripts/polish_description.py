"""Normalize problem descriptions into readable plain text for Grind comment blocks."""

from __future__ import annotations

import re
import textwrap

ZW_CHARS = re.compile('[\u200b\u200c\u200d\ufeff]')
SECTION_RE = re.compile(
    r'^(Example \d+|Constraints|Follow-up|Input|Output|Explanation)\b',
    re.I,
)
JUNK_LINE_RE = re.compile(
    r'^(Description|Input|Output|Explanation|Constraints|Follow-up)$',
    re.I,
)
TITLE_JUNK_RE = re.compile(r'^\d+\.\s+.+\s*\U0001f512\s*$')
LOCK_CHAR = '\U0001f512'
TAG_KEYWORDS = (
    'array', 'hash table', 'design', 'data stream', 'binary search',
    'dynamic programming', 'tree', 'graph', 'math', 'greedy', 'backtracking',
    'stack', 'queue', 'heap', 'trie', 'union find', 'bit manipulation',
    'sliding window', 'two pointers',
)


def _is_tag_line(s: str) -> bool:
    parts = [p.strip().lower() for p in re.split(r'\s{2,}|\s+', s) if p.strip()]
    if len(parts) < 2 or len(parts) > 8:
        return False
    return all(any(kw in part for kw in TAG_KEYWORDS) for part in parts)


def normalize_broken_plain(text: str) -> str:
    """Rejoin word-per-line plain text from early scrapes."""
    if not text or re.search(r'<[a-zA-Z]', text):
        return text
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return ''
    out: list[str] = []
    buf: list[str] = []
    for s in lines:
        if SECTION_RE.match(s):
            if buf:
                out.append(' '.join(buf))
                buf = []
            out.append(s)
            continue
        if re.match(r'^[\u2022\-]\s', s):
            if buf:
                out.append(' '.join(buf))
                buf = []
            out.append(s)
            continue
        buf.append(s)
    if buf:
        out.append(' '.join(buf))
    return '\n\n'.join(out).strip()


def _strip_junk_lines(text: str) -> str:
    kept: list[str] = []
    for line in text.split('\n'):
        s = line.strip()
        if not s:
            kept.append('')
            continue
        if 'md-tag' in s or 'md-content' in s or s.startswith('<article'):
            continue
        if JUNK_LINE_RE.match(s) or TITLE_JUNK_RE.match(s) or _is_tag_line(s):
            continue
        if s == '\xa0' or s == LOCK_CHAR:
            continue
        kept.append(s)
    return '\n'.join(kept)


def _tidy_spacing(text: str) -> str:
    text = ZW_CHARS.sub('', text)
    text = text.replace('\xa0', ' ')
    text = re.sub(r' +([,.;:!?\)])', r'\1', text)
    text = re.sub(r'\(\s+', '(', text)
    text = re.sub(r'\s+\)', ')', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _merge_section_blocks(lines: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            if out and out[-1] != '':
                out.append('')
            i += 1
            continue
        if SECTION_RE.match(s):
            out.append(s.rstrip(':'))
            i += 1
            body: list[str] = []
            while i < len(lines):
                nxt = lines[i].strip()
                if not nxt:
                    i += 1
                    break
                if SECTION_RE.match(nxt):
                    break
                body.append(nxt)
                i += 1
            if body:
                out.append(' '.join(body))
            continue
        if re.match(r'^[\u2022\-]\s', s):
            out.append(s)
            i += 1
            continue
        para = [s]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or SECTION_RE.match(nxt) or re.match(r'^[\u2022\-]\s', nxt):
                break
            para.append(nxt)
            i += 1
        out.append(' '.join(para))
    return out


def _wrap_paragraph(para: str, width: int = 88) -> list[str]:
    para = ' '.join(para.split())
    if not para:
        return []
    if para.startswith('[') or para.startswith('{') or len(para) <= width:
        return [para]
    return textwrap.wrap(para, width=width, break_long_words=False, break_on_hyphens=False)


def polish_description(text: str, width: int = 88) -> str:
    if not text:
        return ''
    text = _tidy_spacing(_strip_junk_lines(text))
    if re.search(r'<[a-zA-Z]', text):
        return text
    text = normalize_broken_plain(text)
    lines = _merge_section_blocks(text.split('\n'))
    wrapped: list[str] = []
    for line in lines:
        if not line:
            if wrapped and wrapped[-1] != '':
                wrapped.append('')
            continue
        if SECTION_RE.match(line) or re.match(r'^[\u2022\-]\s', line):
            wrapped.append(line)
            continue
        wrapped.extend(_wrap_paragraph(line, width))
    return _tidy_spacing('\n'.join(wrapped))

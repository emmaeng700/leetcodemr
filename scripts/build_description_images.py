#!/usr/bin/env python3
"""Localize description inline images for offline Grind (same cache as PDF builds)."""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from generate_patterns_pdf import (  # noqa: E402
    DOOCS_CACHE,
    IMG_DIR,
    LC_CACHE,
    _img_filename,
    download_image,
    get_question_desc_html,
    is_html_description,
)
from generate_questions_desc_pdf import extract_image_urls, trim_desc_html  # noqa: E402

PUBLIC_IMG_DIR = ROOT / 'public' / 'description-images'
QUESTIONS_DATA = ROOT / 'public' / 'questions_data_all.json'


def load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding='utf-8'))


def build_question_row(qid: int, meta: dict) -> dict:
    return {
        'id': qid,
        'title': meta.get('title', f'Question {qid}'),
        'slug': meta.get('slug', ''),
        'difficulty': meta.get('difficulty', ''),
        'source': meta.get('source', []),
        'description': meta.get('description', ''),
    }


def meta_for(qid: int, sources: tuple[dict, ...], current: dict) -> dict:
    for src in sources:
        if qid in src:
            return src[qid]
    return current.get(str(qid), {})


def rewrite_html_urls(html: str, url_map: dict[str, str]) -> str:
    if not html or not url_map:
        return html

    def sub_url(match: re.Match[str]) -> str:
        attr = match.group(1)
        url = match.group(2)
        local = url_map.get(url)
        if local:
            return f'{attr}="{local}"'
        return match.group(0)

    return re.sub(r'(src|href)=["\'](https?://[^"\']+)["\']', sub_url, html, flags=re.I)


def ensure_public_image(url: str) -> str | None:
    fname = _img_filename(url)
    public_path = PUBLIC_IMG_DIR / fname
    cache_path = IMG_DIR / fname
    rel = f'/description-images/{fname}'

    if public_path.exists():
        return rel

    if cache_path.exists():
        public_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cache_path, public_path)
        return rel

    if download_image(url) and cache_path.exists():
        public_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cache_path, public_path)
        return rel

    return None


def localize_description_html(html: str) -> tuple[str, int]:
    trimmed = trim_desc_html(html) if '<' in html else html
    urls = extract_image_urls(trimmed)
    url_map: dict[str, str] = {}
    copied = 0
    for url in urls:
        local = ensure_public_image(url)
        if local:
            url_map[url] = local
            copied += 1
    return rewrite_html_urls(trimmed, url_map), copied


def best_raw_html(q: dict, doocs_cache: dict, lc_cache: dict, sources: tuple[dict, ...]) -> str:
    html = get_question_desc_html(q, doocs_cache, lc_cache)
    if html and is_html_description(html):
        return html

    qid = q['id']
    for src in sources:
        if qid not in src:
            continue
        raw = src[qid].get('description', '')
        if raw and is_html_description(raw):
            return raw
    return ''


def main() -> int:
    PUBLIC_IMG_DIR.mkdir(parents=True, exist_ok=True)

    set1 = {q['id']: q for q in load_json(ROOT / 'public' / 'questions_full.json')}
    am600 = {q['id']: q for q in load_json(ROOT / 'am600_extra_questions.json')}
    nc_extra = {q['id']: q for q in load_json(ROOT / 'neetcode_extra_questions.json')}
    set3 = {q['id']: q for q in load_json(ROOT / 'public' / 'set3_descriptions.json')}
    set2_missing = {q['id']: q for q in load_json(ROOT / 'set2_missing_extra.json')}
    current = load_json(QUESTIONS_DATA)
    sources = (set2_missing, set3, nc_extra, set1, am600)

    doocs_cache = load_json(DOOCS_CACHE) if DOOCS_CACHE.exists() else {}
    lc_cache = load_json(LC_CACHE) if LC_CACHE.exists() else {}

    qids = sorted(int(k) for k in current.keys())
    total_imgs = 0
    with_html = 0
    with_local_imgs = 0

    for qid in qids:
        meta = meta_for(qid, sources, current)
        entry = dict(current.get(str(qid), {}))
        q = build_question_row(qid, {**meta, **entry})

        raw_html = best_raw_html(q, doocs_cache, lc_cache, sources)
        if not raw_html:
            entry.pop('description_html', None)
            current[str(qid)] = entry
            continue

        localized, n = localize_description_html(raw_html)
        if localized.strip():
            entry['description_html'] = localized
            with_html += 1
            if n:
                with_local_imgs += 1
                total_imgs += n
        else:
            entry.pop('description_html', None)
        current[str(qid)] = entry

    QUESTIONS_DATA.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding='utf-8')
    public_count = len(list(PUBLIC_IMG_DIR.glob('*')))
    print(
        f'Wrote {QUESTIONS_DATA.name}: {with_html} with description_html, '
        f'{with_local_imgs} with localized images ({total_imgs} img refs), '
        f'{public_count} files in {PUBLIC_IMG_DIR.relative_to(ROOT)}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

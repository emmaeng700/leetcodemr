#!/usr/bin/env python3
"""Rebuild questions_data_all.json descriptions from HTML sources (BeautifulSoup)."""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from polish_description import polish_description  # noqa: E402


def load_scrape_helpers():
    path = ROOT / 'scripts' / 'scrape_grind_missing_starters.py'
    spec = importlib.util.spec_from_file_location('scrape_helpers', path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def app_universe_ids() -> set[int]:
    set1 = json.loads((ROOT / 'public/questions_full.json').read_text(encoding='utf-8'))
    set1_ids = {q['id'] for q in set1}
    nc250_text = (ROOT / 'src/lib/neetcode250.ts').read_text(encoding='utf-8')
    nc250_ids = {int(x) for x in re.findall(r'id: (\d+)', nc250_text)}
    set3_raw = json.loads((ROOT / 'public/set3_descriptions.json').read_text(encoding='utf-8'))
    set3_ids = {q['id'] for q in set3_raw}
    set2_ids = nc250_ids - set1_ids
    set3_app = set3_ids - nc250_ids - set1_ids
    return set1_ids | set2_ids | set3_app


def finalize_description(raw: str, html_to_description) -> str:
    if not raw or not raw.strip():
        return ''
    if re.search(r'<[a-zA-Z]', raw):
        return polish_description(html_to_description(raw))
    return polish_description(raw.strip())


def main() -> int:
    scrape = load_scrape_helpers()
    html_to_description = scrape.html_to_description

    set1 = {q['id']: q for q in json.loads((ROOT / 'public/questions_full.json').read_text(encoding='utf-8'))}
    am600 = {q['id']: q for q in json.loads((ROOT / 'am600_extra_questions.json').read_text(encoding='utf-8'))}
    nc_extra = {q['id']: q for q in json.loads((ROOT / 'neetcode_extra_questions.json').read_text(encoding='utf-8'))}
    set3 = {q['id']: q for q in json.loads((ROOT / 'public/set3_descriptions.json').read_text(encoding='utf-8'))}
    set2_missing = {q['id']: q for q in json.loads((ROOT / 'set2_missing_extra.json').read_text(encoding='utf-8'))}
    current = json.loads((ROOT / 'public/questions_data_all.json').read_text(encoding='utf-8'))

    def meta_for(qid: int) -> dict:
        for src in (set1, am600, nc_extra, set3, set2_missing):
            if qid in src:
                return src[qid]
        return current.get(str(qid), {})

    def best_description(qid: int) -> str:
        # Prefer cleaner sources before doocs HTML dumps.
        candidates: list[str] = []
        if qid in set2_missing and set2_missing[qid].get('description'):
            candidates.append(set2_missing[qid]['description'])
        if qid in set3 and set3[qid].get('description_text'):
            candidates.append(set3[qid]['description_text'])
        if qid in nc_extra and nc_extra[qid].get('description'):
            candidates.append(nc_extra[qid]['description'])
        if qid in set1 and set1[qid].get('description'):
            candidates.append(set1[qid]['description'])
        if qid in am600 and am600[qid].get('description'):
            candidates.append(am600[qid]['description'])
        cur = current.get(str(qid), {}).get('description', '')
        if cur:
            candidates.append(cur)

        for raw in candidates:
            text = finalize_description(raw, html_to_description)
            if text:
                return text
        return ''

    out: dict[str, dict] = {}
    for qid in sorted(app_universe_ids()):
        meta = meta_for(qid)
        entry = dict(current.get(str(qid), {}))
        entry.update({
            'id': qid,
            'title': meta.get('title', entry.get('title', f'Question {qid}')),
            'slug': meta.get('slug', entry.get('slug', '')),
            'difficulty': meta.get('difficulty', entry.get('difficulty', '')),
            'description': best_description(qid),
            'tags': entry.get('tags', meta.get('tags', [])),
        })
        out[str(qid)] = entry

    path = ROOT / 'public/questions_data_all.json'
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    with_desc = sum(1 for e in out.values() if e.get('description'))
    print(f'Wrote {path} ({len(out)} questions, {with_desc} with descriptions)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

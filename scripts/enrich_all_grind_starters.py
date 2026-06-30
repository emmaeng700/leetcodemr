#!/usr/bin/env python3
"""Ensure every Grind question has a template + Examples/Test section before baking."""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / 'grind_starters_enriched.json'

DESC_MARKER = '# -- Problem Description --'
IA_MARKER = '# -- Interview Approach - STAR-LC --'
EXAMPLE_MARKERS = ('# \u2500\u2500 Examples \u2500\u2500', '# \u2500\u2500 Test \u2500\u2500')


def load_fix_starters():
    path = ROOT / 'scripts' / 'fix_starters.py'
    spec = importlib.util.spec_from_file_location('fix_starters', path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def strip_learning_sections(code: str) -> str:
    markers = [DESC_MARKER, IA_MARKER, '# PHASE 1', '// PHASE 1', '// -- Problem Description --']
    cut = len(code)
    for marker in markers:
        idx = code.find(marker)
        if idx >= 0:
            cut = min(cut, idx)
    if cut < len(code):
        return code[:cut].rstrip()
    return code


def has_examples_section(code: str) -> bool:
    return any(marker in code for marker in EXAMPLE_MARKERS)


def resolve_base_starter(qid: int, set1: dict, am600: dict, nc_extra: dict, missing: dict) -> str:
    for src in (missing, set1, am600, nc_extra):
        row = src.get(qid)
        if row and row.get('starter_python'):
            return strip_learning_sections(row['starter_python'])
    return ''


def main() -> int:
    fix_mod = load_fix_starters()
    descriptions = json.loads((ROOT / 'public/questions_data_all.json').read_text(encoding='utf-8'))

    grind = json.loads((ROOT / 'public/grind_questions.json').read_text(encoding='utf-8'))
    set1 = {q['id']: q for q in json.loads((ROOT / 'public/questions_full.json').read_text(encoding='utf-8'))}
    am600 = {q['id']: q for q in json.loads((ROOT / 'am600_extra_questions.json').read_text(encoding='utf-8'))}
    nc_extra = {q['id']: q for q in json.loads((ROOT / 'neetcode_extra_questions.json').read_text(encoding='utf-8'))}
    missing = {q['id']: q for q in json.loads((ROOT / 'grind_missing_starters.json').read_text(encoding='utf-8'))}

    enriched: list[dict] = []
    added_examples = 0
    already_had = 0
    still_missing = 0

    for q in grind:
        qid = q['id']
        title = q['title']
        desc = (descriptions.get(str(qid)) or {}).get('description', '')

        starter = resolve_base_starter(qid, set1, am600, nc_extra, missing)
        if not starter:
            starter = strip_learning_sections(q.get('starterPython') or '')

        if not starter.strip():
            still_missing += 1
            enriched.append({'id': qid, 'starter_python': ''})
            continue

        if has_examples_section(starter) and '_check(' in starter:
            already_had += 1
            final = starter
        else:
            record = {
                'id': qid,
                'title': title,
                'description': desc,
                'starter_python': starter,
            }
            fixed, _changes = fix_mod.fix_question(record)
            final = fixed.get('starter_python') or starter
            added_examples += 1

        enriched.append({'id': qid, 'starter_python': final})

    OUT_PATH.write_text(json.dumps(enriched, ensure_ascii=False, indent=2), encoding='utf-8')
    with_ex = sum(1 for r in enriched if has_examples_section(r.get('starter_python', '')))
    print(
        f'Wrote {OUT_PATH} ({len(enriched)} rows, {with_ex} with Examples/Test, '
        f'{added_examples} enriched, {already_had} already had section, {still_missing} empty)'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

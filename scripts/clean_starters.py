"""
Cleans starterPython templates in grind_starters_enriched.json:
  - Removes top-level _* helper functions (_make_tree, _tree_vals, _make_list, _check …)
  - Removes the # ── Examples ── / # ── Test ── section and everything below it
  - Removes single-underscore methods from design classes (e.g. _remove, _add, _update_tree)
    but keeps dunder methods like __init__
  - Removes nested def statements inside Solution method bodies
  - Collapses excessive blank lines (max 1 consecutive blank line inside class bodies)
"""

import json
import ast
import re
import sys

SRC  = 'grind_starters_enriched.json'
DEST = 'grind_starters_enriched.json'   # overwrite in-place

# Markers that signal the start of test/interview content to strip
STRIP_MARKERS = [
    '# ── Examples ──',
    '# ── Test ──',
    '# -- Interview Approach',
    '# -- Problem Description --',
    '# PHASE 1',
]


def strip_tail(src: str) -> str:
    """Remove everything from the first test/interview marker onward."""
    cut = len(src)
    for m in STRIP_MARKERS:
        idx = src.find(m)
        if idx != -1:
            cut = min(cut, idx)
    return src[:cut].rstrip()


def lines_to_remove_from_ast(src: str) -> set[int]:
    """Return 1-indexed line numbers that should be deleted."""
    to_remove: set[int] = set()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return to_remove

    # ── Top-level nodes ──────────────────────────────────────────────────────
    for node in tree.body:
        # Remove top-level functions that start with _  (_make_tree, _check …)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith('_'):
                for ln in range(node.lineno, node.end_lineno + 1):
                    to_remove.add(ln)

        # Classes
        elif isinstance(node, ast.ClassDef):
            if node.name == 'Solution':
                # Remove nested defs inside Solution's method bodies
                for method in node.body:
                    if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        for stmt in method.body:
                            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)):
                                for ln in range(stmt.lineno, stmt.end_lineno + 1):
                                    to_remove.add(ln)
            else:
                # Design class: remove single-underscore methods (not dunder)
                for method in node.body:
                    if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if method.name.startswith('_') and not method.name.startswith('__'):
                            for ln in range(method.lineno, method.end_lineno + 1):
                                to_remove.add(ln)

    return to_remove


def clean_starter(src: str) -> str:
    if not src or not src.strip():
        return src

    # 1. Strip test/interview tail
    src = strip_tail(src)
    if not src.strip():
        return ''

    # 2. Remove flagged lines via AST
    to_remove = lines_to_remove_from_ast(src)
    if to_remove:
        kept = [
            line for i, line in enumerate(src.split('\n'), 1)
            if i not in to_remove
        ]
        src = '\n'.join(kept)

    # 3. Collapse 3+ consecutive blank lines → 1 blank line
    src = re.sub(r'\n{3,}', '\n\n', src)

    return src.rstrip()


def main():
    with open(SRC, encoding='utf-8') as f:
        data = json.load(f)

    changed = 0
    for entry in data:
        orig = entry.get('starter_python') or ''
        cleaned = clean_starter(orig)
        if cleaned != orig:
            entry['starter_python'] = cleaned
            changed += 1

    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

    print(f'Done. {changed}/{len(data)} starters updated → {DEST}')


if __name__ == '__main__':
    # Quick preview mode: python3 clean_starters.py preview <id1> <id2> ...
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        with open(SRC, encoding='utf-8') as f:
            data = json.load(f)
        ids = {int(x) for x in sys.argv[2:]}
        by_id = {e['id']: e for e in data}
        for qid in sorted(ids):
            entry = by_id.get(qid)
            if not entry:
                print(f'Q{qid}: NOT FOUND')
                continue
            orig = entry.get('starter_python') or ''
            cleaned = clean_starter(orig)
            print(f'{"="*60}')
            print(f'Q{qid} BEFORE:')
            print(orig)
            print(f'\nQ{qid} AFTER:')
            print(cleaned)
            print()
    else:
        main()

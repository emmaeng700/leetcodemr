#!/usr/bin/env python3
"""
add_editorial.py <question_id>

Copy the editorial code to your clipboard first (Cmd+C), then run:
    python3 add_editorial.py 723

To clear an editorial:
    python3 add_editorial.py 723 --clear

To preview what is currently saved:
    python3 add_editorial.py 723 --show
"""
import json, subprocess, sys
from pathlib import Path

MANUAL = Path(__file__).parent / '.editorial_manual.json'


def load():
    return json.loads(MANUAL.read_text())


def save(data):
    MANUAL.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def clipboard() -> str:
    result = subprocess.run(['pbpaste'], capture_output=True, text=True)
    return result.stdout


def sanitize(code: str) -> str:
    """Make code safe for JSON storage regardless of how it was copied or formatted."""
    code = code.replace('\r\n', '\n').replace('\r', '\n')
    code = code.strip().rstrip('"\'').strip()
    return code


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    qid = sys.argv[1].lstrip('#')
    flag = sys.argv[2] if len(sys.argv) > 2 else ''

    data = load()

    if qid not in data:
        print(f'✗ QID {qid} not found in .editorial_manual.json')
        sys.exit(1)

    entry = data[qid]
    title = entry['title']

    if flag == '--show':
        code = entry.get('editorial_code', '').strip()
        if code:
            print(f'#{qid} {title}\n{"─"*50}\n{code}')
        else:
            print(f'#{qid} {title} — no editorial saved')
        return

    if flag == '--clear':
        data[qid]['editorial_code'] = ''
        save(data)
        print(f'✓ Cleared editorial for #{qid} {title}')
        return

    code = sanitize(clipboard())
    if not code:
        print('✗ Clipboard is empty — copy the code first (Cmd+C), then run this again')
        sys.exit(1)

    data[qid]['editorial_code'] = code
    save(data)
    print(f'✓ Saved {len(code)} chars for #{qid} {title}')
    print(f'  First line: {code.splitlines()[0]}')


if __name__ == '__main__':
    main()

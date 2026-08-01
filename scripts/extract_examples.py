#!/usr/bin/env python3
"""
Port of parseExamples() from grind-offline.html.
Extracts Input/Output example pairs from each question's description
and writes them back as an `examples` field in grind_questions.json.
"""

import json
import re
import sys

# ── helpers ──────────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    s = str(s or '')
    s = re.sub(r'[−–—]', '-', s)
    s = s.replace(' ', ' ')
    # order matters: longer tokens first
    s = re.sub(r'\bnull\b', 'None', s)
    s = re.sub(r'\btrue\b', 'True', s)
    s = re.sub(r'\bfalse\b', 'False', s)
    # bare # inside list context → "# "  (for next-pointer trees #116/#117)
    s = re.sub(r'([\[,])\s*#(?=\s*[,\]])', r'\1"#"', s)
    return s


def match_bracket_group(s: str, from_: int):
    """Find the first [...] group starting at or after `from_`.
    Returns (text, end_index) or None."""
    i = from_
    while i < len(s) and s[i] in ' \t\n\r':
        i += 1
    if i >= len(s) or s[i] != '[':
        return None
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '[':
            depth += 1
        elif s[j] == ']':
            depth -= 1
            if depth == 0:
                return s[i:j + 1], j + 1
    return None


def clean_output(output: str) -> str:
    o = normalize(str(output or '')).strip()
    if not o:
        return o
    # Strip backtick code fences and everything after
    o = re.sub(r'\s*```.*', '', o, flags=re.DOTALL).strip()
    # Strip " Explanation:..." suffix (inline explanation on same line)
    o = re.split(r'\s+Explanation\s*:', o)[0].strip()
    if not o:
        return o
    if o[0] == '[':
        g = match_bracket_group(o, 0)
        if g:
            return g[0]
    if o[0] == '{':
        depth = 0
        for j, ch in enumerate(o):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return o[:j + 1]
    # Quoted string literal — extract just the quoted part
    if o and o[0] in ('"', "'"):
        qch = o[0]
        end = o.find(qch, 1)
        if end > 0:
            return o[:end + 1]
    m = re.match(r'^(True|False|None|-?\d+(?:\.\d+)?(?:e-?\d+)?)', o)
    if m:
        return m.group(1)
    cut = re.split(r'\.\s+', o)[0].strip()
    return cut or o.split('\n')[0].strip()


def extract_output_block(block: str):
    om = re.search(r'Output\s*:?\s*\n?([\s\S]*)', block, re.IGNORECASE)
    if not om:
        return None
    raw = om.group(1)
    raw = re.split(r'\n\s*(?:Explanation|Constraints|Example\s+\d+|Note\b)', raw, flags=re.IGNORECASE)[0]
    return raw.strip()


def parse_design_examples(desc: str):
    examples = []
    ops_re = re.compile(r'\[\s*"[A-Za-z_]\w*"(?:\s*,\s*"[A-Za-z_]\w*")+\s*\]')
    for m in ops_re.finditer(desc):
        ops_lit = m.group(0)
        rest = desc[m.end():]
        args_g = match_bracket_group(rest, 0)
        if not args_g:
            continue
        # Try output immediately after args, then after an "Output" label
        exp_g = match_bracket_group(rest, args_g[1])
        if not exp_g:
            out_m = re.search(r'\bOutput\s*\n', rest[args_g[1]:], re.IGNORECASE)
            if out_m:
                exp_g = match_bracket_group(rest[args_g[1]:], out_m.end())
                if exp_g:
                    # re-anchor positions to original `rest` string aren't needed —
                    # text is what matters
                    pass
        if not exp_g:
            continue
        examples.append({
            'kind': 'design',
            'ops': normalize(ops_lit),
            'args': normalize(args_g[0]),
            'output': normalize(exp_g[0]),
        })
        if len(examples) >= 3:
            break
    return examples


def parse_examples(desc: str):
    examples = []

    def clean_input(s: str) -> str:
        """Strip trailing 'Output:...' and 'Explanation:...' from input field."""
        s = normalize(s).strip()
        # Strip inline Output: suffix (when Output is on the same line as the value)
        s = re.sub(r'\s+Output\s*:.*$', '', s, flags=re.DOTALL)
        # Strip inline Explanation: suffix
        s = re.sub(r'\s+Explanation\s*:.*$', '', s, flags=re.DOTALL)
        # Strip backtick code fences
        s = re.sub(r'\s*```.*', '', s, flags=re.DOTALL)
        return s.strip()

    def push_ex(inp, out):
        inp_clean = clean_input(inp)
        out_clean = clean_output(out)
        # Skip truncated examples (input ends with '=' or is just a variable name)
        if not inp_clean or out_clean is None or out_clean == '':
            return
        if re.match(r'^[A-Za-z_]\w*\s*=$', inp_clean):  # truncated: 's ='
            return
        examples.append({
            'input': inp_clean,
            'output': out_clean,
            'kind': 'normal',
        })

    # Standard blocks: "Example N" / "Example N:"
    parts = re.split(r'Example\s+\d+\s*:?', desc, flags=re.IGNORECASE)
    for i in range(1, len(parts)):
        block = parts[i]
        input_m = re.search(r'Input\s*:?\s*\n([\s\S]*?)(?=\n\s*Output\s*:?)', block, re.IGNORECASE)
        if not input_m:
            input_m = re.search(r'Input\s*:\s*([^\n]+)', block, re.IGNORECASE)
        if not input_m:
            input_m = re.search(r'Input\s*\n([\s\S]*?)\n\s*\n\s*Output', block, re.IGNORECASE)
        out_raw = extract_output_block(block)
        if input_m and out_raw:
            push_ex(input_m.group(1), out_raw)

    # Inline: "Example 1: Input: ... → Output: ..."
    if not examples:
        inline_re = re.compile(
            r'Example\s+\d+\s*:?\s*Input\s*:\s*([\s\S]*?)\s*(?:→|->|Output\s*:)\s*([\s\S]*?)(?=\.\s+[A-Z]|Example\s+\d+|$)',
            re.IGNORECASE,
        )
        for m in inline_re.finditer(desc):
            push_ex(m.group(1), m.group(2))

    # No-number inline: "Example: {input} → Output: {output}" (#3160 style)
    if not examples:
        no_num_re = re.compile(
            r'Example\s*:\s*([^\n]+?)\s*→\s*(?:Output\s*:)?\s*([\s\S]*?)(?=\.\s+[A-Z]|Constraints|$)',
            re.IGNORECASE,
        )
        for m in no_num_re.finditer(desc):
            push_ex(m.group(1), m.group(2))

    # Design / class API: ["Ctor","op",...] [[args],...] [outs]
    if not examples:
        design = parse_design_examples(desc)
        if design:
            return design

    return examples


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    path = '/Users/oppongemmanuel/code/leetcodemr/public/grind_questions.json'
    with open(path) as f:
        questions = json.load(f)

    BATCH = 60
    total = len(questions)
    with_examples = 0
    no_examples = []

    for batch_start in range(0, total, BATCH):
        batch_end = min(batch_start + BATCH, total)
        for q in questions[batch_start:batch_end]:
            desc = q.get('description', '') or ''
            exs = parse_examples(desc)
            if exs:
                q['examples'] = exs
                with_examples += 1
            else:
                no_examples.append((q.get('id'), q.get('title', '')))
        print(f"  processed {batch_end}/{total}", flush=True)

    print(f"\nDone — {with_examples}/{total} questions have examples")
    if no_examples:
        print(f"No examples found for {len(no_examples)} questions:")
        for qid, title in no_examples[:40]:
            print(f"  #{qid} {title}")
        if len(no_examples) > 40:
            print(f"  ... and {len(no_examples) - 40} more")

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, separators=(',', ':'))
    print(f"\nWrote updated grind_questions.json")


if __name__ == '__main__':
    main()

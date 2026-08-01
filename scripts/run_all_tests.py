#!/usr/bin/env python3
"""
Mirrors the JS harness (buildTestHarness / buildDesignHarness / buildCodecHarness)
and runs every pre-computed example against every starterPython solution.
Reports all failures so we can fix the bad starters or bad examples.
"""

import json, re, sys, traceback
from pathlib import Path

# ── PYTHON PREAMBLE (copied exactly from grind-offline.html PYTHON_PREAMBLE) ─

PYTHON_PREAMBLE = r'''
class TreeNode:
    def __init__(self, val=0, left=None, right=None, parent=None):
        self.val = val; self.left = left; self.right = right; self.parent = parent
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val; self.next = next
class Node:
    def __init__(self, val=0, left=None, right=None, next=None, children=None, neighbors=None, random=None, parent=None):
        self.val=val; self.left=left; self.right=right; self.parent=parent
        self.next=next; self.children=children if children is not None else []
        self.neighbors=neighbors if neighbors is not None else []; self.random=random
class Interval:
    def __init__(self, start=0, end=0):
        self.start=start; self.end=end
from collections import deque, defaultdict, Counter, OrderedDict
from typing import List, Optional, Tuple, Dict, Set, Any
import json as _json_mod, math, heapq, bisect, itertools, functools, copy, re as _re_mod, string
json = _json_mod
re = _re_mod
class _HTree:
    def __init__(self, val=0, left=None, right=None, parent=None):
        self.val=val; self.left=left; self.right=right; self.parent=parent
class _HNary:
    def __init__(self, val=0, children=None):
        self.val=val; self.children=children if children is not None else []
class _HGraph:
    def __init__(self, val=0, neighbors=None):
        self.val=val; self.neighbors=neighbors if neighbors is not None else []
def _make_tree(a):
    if a is None: return None
    if isinstance(a, list) and len(a)==0: return None
    if not isinstance(a, list): return a
    if a[0] is None: return None
    root=_HTree(a[0]); q=deque([root]); i=1
    while q and i<len(a):
        n=q.popleft()
        if i<len(a) and a[i] is not None:
            n.left=_HTree(a[i], parent=n); q.append(n.left)
        i+=1
        if i<len(a) and a[i] is not None:
            n.right=_HTree(a[i], parent=n); q.append(n.right)
        i+=1
    return root
def _make_nary(a):
    if not a or a[0] is None: return None
    root=_HNary(a[0]); q=deque([root]); i=2
    while q and i<len(a):
        parent=q.popleft()
        while i<len(a) and a[i] is not None:
            child=_HNary(a[i]); parent.children.append(child); q.append(child); i+=1
        i+=1
    return root
def _make_graph(adj):
    if not adj: return None
    nodes=[_HGraph(i+1) for i in range(len(adj))]
    for i, neigh in enumerate(adj):
        nodes[i].neighbors=[nodes[j-1] for j in (neigh or [])]
    return nodes[0]
def _graph_to_adj(node):
    if not node: return []
    seen={}; order=[]
    q=deque([node])
    while q:
        n=q.popleft()
        if n.val in seen: continue
        seen[n.val]=n; order.append(n)
        for nb in (n.neighbors or []):
            if nb.val not in seen: q.append(nb)
    order.sort(key=lambda x: x.val)
    return [[nb.val for nb in (n.neighbors or [])] for n in order]
def _make_list(a):
    if not a: return None
    if not isinstance(a, list): return a
    h=ListNode(a[0]); c=h
    for v in a[1:]: c.next=ListNode(v); c=c.next
    return h
def _make_lists(a):
    if not a: return []
    return [_make_list(x) for x in a]
def _make_intervals(a):
    if not a: return []
    out=[]
    for x in a:
        if isinstance(x, Interval): out.append(x)
        elif isinstance(x, (list, tuple)) and len(x)>=2: out.append(Interval(x[0], x[1]))
        else: out.append(x)
    return out
def _tree_to_arr(r):
    if not r: return []
    res=[]; q=deque([r])
    while q:
        n=q.popleft()
        if n is None: res.append(None)
        else: res.append(n.val); q.append(getattr(n,"left",None)); q.append(getattr(n,"right",None))
    while res and res[-1] is None: res.pop()
    return res
def _nary_to_arr(r):
    if not r: return []
    res=[r.val, None]; q=deque([r])
    while q:
        n=q.popleft()
        for c in (getattr(n,"children",None) or []):
            res.append(c.val); q.append(c)
        res.append(None)
    while res and res[-1] is None: res.pop()
    return res
def _list_to_arr(h):
    r=[]; s=set(); c=h
    while c and id(c) not in s: s.add(id(c)); r.append(c.val); c=c.next
    return r
def _make_random_list(a):
    if not a: return None
    nodes=[Node(v[0] if isinstance(v,(list,tuple)) else v) for v in a]
    for i in range(len(nodes)-1): nodes[i].next=nodes[i+1]
    for i,v in enumerate(a):
        if isinstance(v,(list,tuple)) and len(v)>1 and v[1] is not None:
            idx=v[1]
            if isinstance(idx,int) and 0<=idx<len(nodes): nodes[i].random=nodes[idx]
    return nodes[0]
def _random_list_to_arr(head):
    if not head: return []
    nodes=[]; node=head
    while node: nodes.append(node); node=node.next
    idx={id(n):i for i,n in enumerate(nodes)}
    return [[n.val, idx[id(n.random)] if n.random is not None else None] for n in nodes]
def _next_ptr_to_arr(root):
    if not root: return []
    res=[]; q=[root]
    while q:
        nq=[]
        for n in q:
            res.append(n.val)
            if getattr(n,"left",None): nq.append(n.left)
            if getattr(n,"right",None): nq.append(n.right)
        res.append("#"); q=nq
    while res and res[-1]=="#": res.pop()
    return res
def _intervals_to_arr(a):
    if not a: return []
    out=[]
    for x in a:
        if hasattr(x,"start") and hasattr(x,"end"): out.append([x.start, x.end])
        else: out.append(x)
    return out
def _ser(v):
    if isinstance(v, ListNode): return _list_to_arr(v)
    if isinstance(v, list) and v and isinstance(v[0], ListNode): return [_list_to_arr(x) for x in v]
    if isinstance(v, list) and v and isinstance(v[0], Interval): return _intervals_to_arr(v)
    if isinstance(v, Interval): return [v.start, v.end]
    if isinstance(v, _HGraph) or (hasattr(v,"neighbors") and isinstance(getattr(v,"neighbors",None), list) and not hasattr(v,"left") and not hasattr(v,"children")):
        return _graph_to_adj(v)
    if isinstance(v, _HNary) or (hasattr(v,"children") and isinstance(getattr(v,"children",None), list) and not hasattr(v,"left")):
        return _nary_to_arr(v)
    if isinstance(v, (_HTree, TreeNode)) or ((hasattr(v,"left") or hasattr(v,"right")) and hasattr(v,"val")):
        return _tree_to_arr(v)
    if isinstance(v, Node) and hasattr(v,"children"): return _nary_to_arr(v)
    return v
def _norm_num(x):
    if isinstance(x, float):
        if abs(x - round(x)) < 1e-9: return int(round(x))
        return round(x, 5)
    return x
def _canon(v):
    v=_ser(v)
    if isinstance(v, list): return [_canon(x) for x in v]
    if isinstance(v, dict): return {str(k): _canon(v[k]) for k in sorted(v, key=lambda z: str(z))}
    return _norm_num(v)
def _ser_cmp(got, exp, any_order=False):
    if got is None and (exp is None or exp == []): return True
    if hasattr(got, "val") and isinstance(exp, int) and not isinstance(got, (list, tuple, dict)):
        return got.val == exp
    if isinstance(exp, list) and "#" in exp and hasattr(got, "val") and (hasattr(got, "left") or hasattr(got, "right")):
        try: return _next_ptr_to_arr(got) == exp
        except: pass
    if (isinstance(exp, list) and exp and isinstance(exp[0], (list,tuple)) and len(exp[0])==2
            and (exp[0][1] is None or isinstance(exp[0][1],int))
            and hasattr(got, "val") and hasattr(got, "next") and not isinstance(got, (list,dict,ListNode))):
        try: return _random_list_to_arr(got) == [[v[0], v[1]] for v in exp]
        except: pass
    gs = _canon(got); es = _canon(exp)
    if gs is None and es == []: return True
    try:
        if gs == es: return True
        if any_order and isinstance(gs, list) and isinstance(es, list) and len(gs)==len(es):
            if gs and isinstance(gs[0], list):
                def _gk(x):
                    try: return json.dumps(sorted(x), sort_keys=True, default=str)
                    except Exception: return json.dumps(x, sort_keys=True, default=str)
                return sorted(map(_gk, gs)) == sorted(map(_gk, es))
            try:
                return sorted(gs) == sorted(es)
            except TypeError:
                return sorted(map(lambda x: json.dumps(x, sort_keys=True, default=str), gs)) == sorted(map(lambda x: json.dumps(x, sort_keys=True, default=str), es))
        if isinstance(gs, list) and isinstance(es, int) and gs and gs[0] == es: return True
        return json.dumps(gs, sort_keys=True, default=str) == json.dumps(es, sort_keys=True, default=str)
    except Exception:
        return str(gs) == str(es)
def _course_order_ok(order, n, prereqs):
    if order is None: return False
    if order == []: return True
    if not isinstance(order, list) or len(order) != n or len(set(order)) != n: return False
    if any((not isinstance(c, int)) or c < 0 or c >= n for c in order): return False
    pos = {c: i for i, c in enumerate(order)}
    for a, b in (prereqs or []):
        if pos[b] > pos[a]: return False
    return True
def _find_node(r, v):
    if not r: return None
    if isinstance(r, list): return None
    if r.val == v: return r
    if hasattr(r, "children") and r.children:
        for c in r.children:
            found=_find_node(c, v)
            if found: return found
        return None
    return _find_node(getattr(r, "left", None), v) or _find_node(getattr(r, "right", None), v)
'''

# ── JS helper ports ───────────────────────────────────────────────────────────

TREE_ROOT_PARAMS = ['root', 'node', 'left', 'right']
TREE_NODE_PARAMS = ['p', 'q', 'target']
TREE_PARAMS = TREE_ROOT_PARAMS + TREE_NODE_PARAMS
LIST_PARAMS = ['head', 'list1', 'list2', 'l1', 'l2', 'lists', 'lista', 'listb', 'next_']
INPUT_ALIASES = {
    'adjlist': 'node', 'items': 'nums', 'numbers': 'nums', 'value': 'val',
    'list1': 'l1', 'list2': 'l2', 'l1': 'list1', 'l2': 'list2',
    'ops': 'operations', 'operations': 'ops',
}


def normalize_text(s: str) -> str:
    s = str(s or '')
    s = re.sub(r'[−–—]', '-', s)
    s = s.replace('\u00a0', ' ')
    s = re.sub(r'\bnull\b', 'None', s)
    s = re.sub(r'\btrue\b', 'True', s)
    s = re.sub(r'\bfalse\b', 'False', s)
    s = re.sub(r'([\[,])\s*#(?=\s*[,\]])', r'\1"#"', s)
    return s


def split_input_assignments(line: str):
    stmts = []
    cur = ''
    depth = 0

    def push_stmt(s):
        s = s.strip()
        d = 0
        for ch in s:
            if ch in '[({': d += 1
            elif ch in '])}': d -= 1
        if d == 0 and re.match(r'^[A-Za-z_]\w*\s*=(?!=)', s):
            s = re.sub(r',+\s*$', '', s)
        if s:
            stmts.append(s)

    for i, c in enumerate(line):
        if c in '[({': depth += 1
        elif c in '])}': depth -= 1
        if depth == 0 and c == ',':
            rest = line[i + 1:].lstrip()
            if re.match(r'^\w+\s*=', rest):
                push_stmt(cur)
                cur = ''
                continue
        cur += c
    push_stmt(cur)
    return stmts


def input_to_python(input_str: str) -> str:
    s = normalize_text(input_str)
    s = re.sub(r'=\s*\n\s*', '= ', s)
    # Join "varname\n= value" continuations (var on one line, = on next)
    s = re.sub(r'([A-Za-z_]\w*)\s*\n\s*=\s*', r'\1 = ', s)
    # Bracket-aware line joining: join lines where brackets are unbalanced
    raw_lines = s.split('\n')
    joined_lines = []
    depth = 0
    buf = ''
    for raw_line in raw_lines:
        stripped = raw_line.strip()
        if not stripped:
            if depth == 0 and buf:
                joined_lines.append(buf)
                buf = ''
            continue
        for ch in stripped:
            if ch in '[({': depth += 1
            elif ch in '])}': depth -= 1
        if depth > 0:
            buf += (' ' if buf else '') + stripped
        else:
            joined_lines.append(buf + (' ' if buf else '') + stripped)
            buf = ''
            depth = 0
    if buf:
        joined_lines.append(buf)
    lines = [l.strip() for l in joined_lines if l.strip()]
    result = []
    for line in lines:
        line = re.sub(r'\s*→.*$', '', line)
        line = re.sub(r'\s*->.*$', '', line)
        # Strip inline "Output:" suffix that leaks in when Input/Output are on same line
        line = re.sub(r'\s+Output\s*:.*$', '', line, flags=re.DOTALL)
        # Strip trailing backtick code-block markers
        line = re.sub(r'```.*$', '', line)
        # Strip inline Explanation suffix
        line = re.sub(r'\s+Explanation\s*:.*$', '', line, flags=re.DOTALL)
        line = line.strip()
        if line:
            result.extend(split_input_assignments(line))
    return '\n'.join(result)


def apply_input_aliases(input_py: str, params) -> str:
    param_set = set()
    for p in params:
        param_set.add(p)
        param_set.add(p.lower())
    lines = input_py.split('\n')
    out = []
    for line in lines:
        m = re.match(r'^([A-Za-z_]\w*)\s*=', line)
        if not m:
            out.append(line)
            continue
        name = m.group(1)
        if name in param_set or name.lower() in param_set:
            out.append(line)
            continue
        alias = INPUT_ALIASES.get(name.lower())
        if alias and (alias in param_set or alias.lower() in param_set):
            out.append(alias + line[len(name):])
            continue
        out.append(line)
    joined = '\n'.join(out)
    if 'node' in param_set and 'node' not in re.findall(r'\bnode\s*=', joined) and 'adjList' in joined:
        joined += '\nnode = adjList'
    return joined


def extract_method_params(solution_code: str, input_vars: set = None):
    sol_idx = solution_code.find('class Solution')
    search_in = solution_code[sol_idx:] if sol_idx >= 0 else solution_code
    methods = list(re.finditer(r'def\s+(\w+)\s*\(self(?:,\s*([^)]+))?\)', search_in))
    non_init = [m for m in methods if m.group(1) != '__init__']
    if not non_init:
        if methods:
            method_name = methods[0].group(1)
        else:
            method_name = 'solve'
        pm = re.search(r'def\s+' + re.escape(method_name) + r'\s*\(self(?:,\s*([^)]+))?\)', search_in)
        params = []
        if pm and pm.group(1):
            for p in pm.group(1).split(','):
                raw = p.strip()
                pn = re.split(r'[=:\s]', raw)[0].strip()
                if pn and not re.match(r'^Optional|List|Dict|Tuple|Set', pn):
                    params.append(pn)
        return {'methodName': method_name, 'params': params}

    # Score each method by how many of its params appear in the example input vars
    def parse_params(m):
        ps_str = m.group(2) or ''
        ps = []
        for p in ps_str.split(','):
            raw = p.strip()
            pn = re.split(r'[=:\s]', raw)[0].strip()
            if pn and not re.match(r'^Optional|List|Dict|Tuple|Set', pn):
                ps.append(pn)
        return ps

    iv_lower = {v.lower() for v in (input_vars or [])}
    best_m = non_init[-1]  # default: last def
    best_score = -1
    for m in non_init:
        ps = parse_params(m)
        score = sum(1 for p in ps if p.lower() in iv_lower) if iv_lower else 0
        if score >= best_score:  # >= so last def wins on ties
            best_score = score
            best_m = m

    method_name = best_m.group(1)
    params = parse_params(best_m)
    return {'methodName': method_name, 'params': params}


def find_design_class_name(solution_code: str, ops_field: str = ''):
    names = []
    for m in re.finditer(r'class\s+([A-Za-z_]\w*)\s*(?:[:(\n])', solution_code):
        n = m.group(1)
        if n not in ('Solution', 'TreeNode', 'ListNode', 'Node', 'Interval'):
            names.append(n)
    if not names:
        return None
    # Use the first op (constructor call) to identify the correct class
    if ops_field:
        try:
            ops_list = eval(ops_field.replace('\n', ' '))
            if ops_list and isinstance(ops_list, list):
                constructor = ops_list[0]
                if constructor in names:
                    return constructor
        except Exception:
            pass
    return names[0]


def is_codec_question(solution_code: str) -> bool:
    return bool(re.search(r'def\s+serialize\s*\(', solution_code) and
                re.search(r'def\s+deserialize\s*\(', solution_code))


def is_nary_question(q, solution_code: str) -> bool:
    blob = ((q.get('title') or '') + ' ' + (q.get('slug') or '') + ' ' + (solution_code or '')).lower()
    if re.search(r'\bn-?ary\b', blob): return True
    if re.search(r'\.children\b', solution_code or '') and not re.search(r'\.neighbors\b', solution_code or ''):
        return True
    return False


def is_graph_question(q, solution_code: str) -> bool:
    blob = ((q.get('title') or '') + ' ' + (q.get('slug') or '')).lower()
    if re.search(r'clone-graph|clone graph', blob): return True
    if re.search(r'\.neighbors\b', solution_code or '') and not re.search(r'\.children\b', solution_code or ''):
        return True
    return False


def is_parent_pointer_question(q, solution_code: str) -> bool:
    blob = ((q.get('title') or '') + ' ' + (q.get('slug') or '')).lower()
    if re.search(r'binary-tree-iii|binary tree iii|inorder-successor-in-bst-ii', blob): return True
    return bool(re.search(r'\.parent\b', solution_code or ''))


def description_allows_any_order(q) -> bool:
    d = (
        (q.get('description') or '') + '\n' +
        (q.get('starterPython') or '') + '\n' +
        (q.get('title') or '')
    ).lower()
    if re.search(r'any order\s*\?\s*no\b', d) and not re.search(r'any order\s*\?\s*yes\b', d):
        return False
    return bool(re.search(r'any order|in any order|return the answer in any order|unordered|return any|any of them|many valid answers|one possible|any valid', d))


def is_course_order_question(q, method_name: str) -> bool:
    blob = ((q.get('title') or '') + ' ' + (q.get('slug') or '') + ' ' + (method_name or '')).lower()
    return method_name == 'findOrder' or bool(re.search(r'course-schedule-ii|course schedule ii', blob))


# ── Harness builders ──────────────────────────────────────────────────────────

def build_test_harness(solution_code, examples, nary, parent_ptr, graph, any_order, course_order):
    # Gather input variable names from examples to pick the best method
    input_var_set = set()
    for ex in examples:
        if ex.get('kind') != 'design':
            for line in input_to_python(ex.get('input', '')).split('\n'):
                m = re.match(r'^([A-Za-z_]\w*)\s*=', line)
                if m:
                    input_var_set.add(m.group(1).lower())
    meta = extract_method_params(solution_code, input_var_set)
    method_name = meta['methodName']
    params = meta['params']
    has_root_param = any(p.lower() == 'root' for p in params)

    case_parts = []
    for ex in examples:
        if ex.get('kind') == 'design':
            continue
        input_py = apply_input_aliases(input_to_python(ex.get('input', '')), params)

        # If a method param is not defined in the input, try to remap a spare input variable
        defined_vars = {m.group(1) for m in re.finditer(r'^([A-Za-z_]\w*)\s*=', input_py, re.MULTILINE)}
        param_lower = {p.lower() for p in params}
        undefined_params = [p for p in params if p not in defined_vars and p.lower() not in {v.lower() for v in defined_vars}]
        extra_vars = [v for v in defined_vars if v.lower() not in param_lower and v not in params]
        if len(undefined_params) == 1 and len(extra_vars) == 1:
            input_py = re.sub(r'\b' + re.escape(extra_vars[0]) + r'\b', undefined_params[0], input_py)

        conv_lines = []
        has_ambient_root = bool(re.search(r'\broot\s*=', input_py)) or has_root_param

        if re.search(r'\broot\s*=', input_py) and not has_root_param:
            if nary:
                conv_lines.append('    root = _make_nary(root) if isinstance(root, list) else root')
            else:
                conv_lines.append('    root = _make_tree(root) if isinstance(root, list) else root')

        for p in params:
            pn = p.lower()
            if graph and pn in ('node', 'graph'):
                conv_lines.append(f'    {p} = _make_graph({p}) if isinstance({p}, list) else {p}')
                continue
            if pn == 'lists':
                conv_lines.append(f'    {p} = _make_lists({p}) if isinstance({p}, list) else {p}')
                continue
            if pn in ('intervals', 'firstlist', 'secondlist'):
                if 'Interval' in solution_code:
                    conv_lines.append(f'    {p} = _make_intervals({p}) if isinstance({p}, list) else {p}')
                continue
            if pn in TREE_ROOT_PARAMS:
                if nary:
                    conv_lines.append(f'    {p} = _make_nary({p}) if isinstance({p}, list) else (_HNary({p}) if isinstance({p}, int) else {p})')
                else:
                    conv_lines.append(f'    {p} = _make_tree({p}) if isinstance({p}, list) else (_HTree({p}) if isinstance({p}, int) else {p})')
                continue
            if pn in TREE_NODE_PARAMS:
                if has_ambient_root:
                    if nary:
                        conv_lines.append(f'    {p} = _make_nary({p}) if isinstance({p}, list) else ((_find_node(root, {p}) or _HNary({p})) if isinstance({p}, int) else {p})')
                    else:
                        conv_lines.append(f'    {p} = ((_find_node(root, {p}) or _HTree({p})) if isinstance({p}, int) else (_make_tree({p}) if isinstance({p}, list) else {p}))')
                else:
                    conv_lines.append(f'    {p} = _make_tree({p}) if isinstance({p}, list) else {p}')
                continue
            if pn in LIST_PARAMS:
                conv_lines.append(
                    f'    {p} = (_make_random_list({p}) if {p} and isinstance({p}[0],(list,tuple)) and len({p}[0])==2 and ({p}[0][1] is None or isinstance({p}[0][1],int)) else _make_list({p})) if isinstance({p}, list) else {p}'
                )

        expected_py = normalize_text(ex.get('output', ''))
        expected_esc = expected_py.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')
        input_lines = '\n'.join('    ' + l for l in input_py.split('\n'))
        conv_block = '\n'.join(conv_lines) + '\n' if conv_lines else ''
        primary = params[0] if params else None

        if course_order:
            ok_line = (
                '    if _exp == []:\n'
                '        _ok = (_got == [] or _got is None)\n'
                '    else:\n'
                '        _ok = _course_order_ok(_got, numCourses, prerequisites)\n'
            )
        else:
            ok_line = f'    _ok = _ser_cmp(_got, _exp, {any_order})\n'

        in_mut_check = ''
        if primary:
            in_mut_check = (
                f'    if _got is None and isinstance(_exp, list) and isinstance({primary}, list):\n'
                f'        _got = {primary}\n'
            )

        case_parts.append(
            'try:\n' +
            input_lines + '\n' +
            conv_block +
            f'    _ret = sol.{method_name}(' + ', '.join(params) + ')\n' +
            f'    _exp = {expected_py}\n' +
            '    _got = _ret\n' +
            in_mut_check +
            ok_line +
            '    _got_s = ([] if _got is None and _exp == [] else (_got.val if hasattr(_got, "val") and isinstance(_exp, int) and not isinstance(_got, (list, tuple, dict)) else _ser(_got)))\n' +
            '    _results.append({"pass": _ok, "got": str(_got_s), "exp": str(_exp)})\n' +
            'except Exception as _e:\n' +
            f"    _results.append({{\"pass\": False, \"error\": str(_e), \"got\": \"error\", \"exp\": '{expected_esc}'}})"
        )

    nary_override = (
        'class Node:\n'
        '    def __init__(self, val=None, children=None):\n'
        '        self.val = val\n'
        '        self.children = children if children is not None else []\n'
        'Node = _HNary\n\n'
    ) if nary else ''
    graph_override = (
        'class Node:\n'
        '    def __init__(self, val=0, neighbors=None):\n'
        '        self.val = val\n'
        '        self.neighbors = neighbors if neighbors is not None else []\n'
        'Node = _HGraph\n\n'
    ) if graph else ''
    parent_override = (
        'class TreeNode:\n'
        '    def __init__(self, val=0, left=None, right=None, parent=None):\n'
        '        self.val = val; self.left = left; self.right = right; self.parent = parent\n'
        'TreeNode = _HTree\n'
        'Node = _HTree\n\n'
    ) if parent_ptr else ''

    return (
        PYTHON_PREAMBLE + '\n' +
        solution_code + '\n\n' +
        nary_override + graph_override + parent_override +
        'sol = Solution()\n'
        '_results = []\n\n' +
        '\n\n'.join(case_parts) + '\n\n'
        '_json_mod.dumps(_results)'
    )


def build_design_harness(solution_code, examples):
    first_ops = examples[0].get('ops', '') if examples else ''
    class_name = find_design_class_name(solution_code, first_ops)
    if not class_name:
        return None
    case_parts = []
    for ex in examples:
        exp = normalize_text(ex.get('output', ''))
        exp_esc = exp.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')
        case_parts.append(
            'try:\n'
            f'    _ops = {ex["ops"]}\n'
            f'    _args = {ex["args"]}\n'
            f'    _exp = {exp}\n'
            '    _got = []\n'
            '    _obj = None\n'
            '    for _i, _op in enumerate(_ops):\n'
            '        if _i == 0:\n'
            f'            _obj = {class_name}(*(_args[_i] if _i < len(_args) else []))\n'
            '            _got.append(None)\n'
            '        else:\n'
            '            _fn = getattr(_obj, _op)\n'
            '            _a = _args[_i] if _i < len(_args) else []\n'
            '            _got.append(_fn(*_a))\n'
            '    _ok = _ser_cmp(_got, _exp, True)\n'
            '    if (not _ok) and any(x in _ops for x in ("getRandom","pickIndex","randPoint")):\n'
            '        _ok = True\n'
            '        for _i,_op in enumerate(_ops):\n'
            '            if _op in ("getRandom","pickIndex","randPoint"): continue\n'
            '            if _canon(_got[_i]) != _canon(_exp[_i]):\n'
            '                _ok = False; break\n'
            '    _results.append({"pass": _ok, "got": str(_canon(_got)), "exp": str(_canon(_exp))})\n'
            'except Exception as _e:\n'
            f"    _results.append({{\"pass\": False, \"error\": str(_e), \"got\": \"error\", \"exp\": '{exp_esc}'}})"
        )
    return (
        PYTHON_PREAMBLE + '\n' +
        solution_code + '\n\n'
        '_results = []\n\n' +
        '\n\n'.join(case_parts) + '\n\n'
        '_json_mod.dumps(_results)'
    )


def build_codec_harness(solution_code, examples, nary):
    class_name = find_design_class_name(solution_code) or 'Codec'
    case_parts = []
    for ex in [e for e in examples if e.get('kind') != 'design']:
        input_py = apply_input_aliases(input_to_python(ex.get('input', '')), ['root'])
        expected_py = normalize_text(ex.get('output', ''))
        exp_esc = expected_py.replace('\\', '\\\\').replace("'", "\\'")
        input_lines = '\n'.join('    ' + l for l in input_py.split('\n'))
        case_parts.append(
            'try:\n' +
            input_lines + '\n'
            '    root = _make_tree(root) if isinstance(root, list) else root\n'
            f'    _c = {class_name}()\n'
            '    _got = _tree_to_arr(_c.deserialize(_c.serialize(root)))\n'
            f'    _exp = {expected_py}\n'
            '    _ok = _ser_cmp(_got, _exp)\n'
            '    _results.append({"pass": _ok, "got": str(_got), "exp": str(_exp)})\n'
            'except Exception as _e:\n'
            f"    _results.append({{\"pass\": False, \"error\": str(_e), \"got\": \"error\", \"exp\": '{exp_esc}'}})"
        )
    if not case_parts:
        return None
    return (
        PYTHON_PREAMBLE + '\n' +
        solution_code + '\n\n'
        '_results = []\n\n' +
        '\n\n'.join(case_parts) + '\n\n'
        '_json_mod.dumps(_results)'
    )


# ── Main runner ───────────────────────────────────────────────────────────────

SECTION_MARKERS = [
    '# -- Question Description --',
    '# -- Interview Approach - STAR-LC --',
    '# -- Accepted Solution --',
]


def extract_solution_code(full_code: str) -> str:
    """Mirror of JS extractSolutionCode: take everything before the first section marker."""
    cut = -1
    for marker in SECTION_MARKERS:
        idx = full_code.find(marker)
        if idx != -1 and (cut == -1 or idx < cut):
            cut = idx
    code = full_code[:cut].rstrip() if cut != -1 else full_code
    # Strip commented helper class stubs
    code = re.sub(r'(?:^|\n)# Definition for[^\n]*\n(?:#[^\n]*\n)*', '\n', code)
    return code.strip()


def add_pass_to_empty_bodies(code: str) -> str:
    """Insert `pass` into any def/class body that is blank (only whitespace lines)."""
    lines = code.split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        stripped = line.rstrip()
        if stripped.endswith(':') and re.match(r'\s*(def |class )', stripped):
            indent = len(stripped) - len(stripped.lstrip())
            body_indent = indent + 4
            # Look ahead: is the next non-empty line at same or lower indent?
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j >= len(lines) or (lines[j].strip() and len(lines[j]) - len(lines[j].lstrip()) <= indent):
                out.append(' ' * body_indent + 'pass')
        i += 1
    return '\n'.join(out)


def run_question(q):
    examples = q.get('examples', [])
    if not examples:
        return None  # no examples to test

    full_code = q.get('starterPython', '') or ''
    solution_code = extract_solution_code(full_code)
    if not solution_code.strip():
        return None
    solution_code = add_pass_to_empty_bodies(solution_code)

    # Skip JavaScript-only questions (no Python defs or classes at all)
    if not re.search(r'def\s+\w+\s*\(', solution_code) and not re.search(r'class\s+\w+', solution_code):
        return None
    has_solution_class = 'class Solution' in solution_code
    design_ex = [e for e in examples if e.get('kind') == 'design']
    normal_ex = [e for e in examples if e.get('kind') != 'design']
    first_ops = design_ex[0].get('ops', '') if design_ex else ''
    design_class_name = find_design_class_name(solution_code, first_ops)

    # Skip Solution class with no methods (empty starters like Q#1229, Q#1168)
    if has_solution_class and not design_class_name:
        if not re.search(r'def\s+\w+\s*\(self', solution_code):
            return None

    # Design class with normal examples but no design examples — skip
    if not has_solution_class and design_class_name and not design_ex:
        return None

    harness = None
    if design_ex:
        harness = build_design_harness(solution_code, design_ex)
    elif is_codec_question(solution_code):
        harness = build_codec_harness(solution_code, examples, is_nary_question(q, solution_code))

    if not harness and normal_ex:
        parent_ptr = is_parent_pointer_question(q, solution_code)
        graph = (not parent_ptr) and is_graph_question(q, solution_code)
        nary = (not parent_ptr and not graph) and is_nary_question(q, solution_code)
        any_order = description_allows_any_order(q)
        meta = extract_method_params(solution_code)
        course_order = is_course_order_question(q, meta['methodName'])
        harness = build_test_harness(solution_code, normal_ex, nary, parent_ptr, graph, any_order, course_order)

    if not harness:
        return None

    # Strip the trailing json.dumps(...) return expression — we read _results directly
    harness_body = re.sub(r'\n_json_mod\.dumps\(_results\)\s*$', '', harness)
    g = {}
    try:
        exec(compile(harness_body, '<harness>', 'exec'), g)
        results = g.get('_results', [])
    except Exception as e:
        return [{'pass': False, 'error': f'HARNESS BUILD/EXEC: {e}', 'got': 'error', 'exp': '?'}]

    return results


def main():
    path = Path('/Users/oppongemmanuel/code/leetcodemr/public/grind_questions.json')
    with open(path) as f:
        questions = json.load(f)

    failures = []
    skipped = 0
    passed_all = 0

    for q in questions:
        results = run_question(q)
        if results is None:
            skipped += 1
            continue
        bad = [r for r in results if not r.get('pass')]
        if bad:
            failures.append({
                'id': q['id'],
                'title': q['title'],
                'failures': bad,
            })
        else:
            passed_all += 1

    print(f"\n{'='*60}")
    print(f"Results: {passed_all} passed, {len(failures)} with failures, {skipped} skipped")
    print(f"{'='*60}\n")

    for f_item in failures:
        print(f"  #{f_item['id']} {f_item['title']}")
        for r in f_item['failures'][:2]:
            if 'error' in r:
                print(f"    ERROR: {r['error'][:100]}")
            else:
                print(f"    WRONG: got={r.get('got','')[:60]}  exp={r.get('exp','')[:60]}")

    # Save failures for further inspection
    out_path = Path('/Users/oppongemmanuel/code/leetcodemr/scripts/test_failures.json')
    with open(out_path, 'w') as f:
        json.dump(failures, f, indent=2)
    print(f"\nDetailed failures written to scripts/test_failures.json")


if __name__ == '__main__':
    main()

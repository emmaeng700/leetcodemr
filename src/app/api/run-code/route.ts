import { NextRequest, NextResponse } from 'next/server'

const JUDGE0 = 'https://ce.judge0.com'

function b64encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}
function b64decode(str: string | null | undefined): string {
  if (!str) return ''
  return Buffer.from(str, 'base64').toString('utf-8')
}

const LISTNODE_DEF = `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def _make_list(vals):
    dummy = ListNode(0); cur = dummy
    for v in vals: cur.next = ListNode(v); cur = cur.next
    return dummy.next

def _list_vals(node):
    res = []
    while node: res.append(node.val); node = node.next
    return res
`

const TREENODE_DEF = `
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

def _make_tree(vals):
    if not vals: return None
    root = TreeNode(vals[0]); q = [root]; i = 1
    while q and i < len(vals):
        node = q.pop(0)
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i]); q.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i]); q.append(node.right)
        i += 1
    return root

def _tree_vals(root):
    if not root: return []
    res = []; q = [root]
    while q:
        node = q.pop(0)
        if node: res.append(node.val); q.append(node.left); q.append(node.right)
        else: res.append(None)
    while res and res[-1] is None: res.pop()
    return res
`

const NODE_DEF = `
class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
`

const INTERVAL_DEF = `
class Interval:
    def __init__(self, start=0, end=0):
        self.start = start
        self.end = end
`

/** Prepend any missing helper class definitions so user code always runs */
function injectHelpers(code: string): string {
  const needs = (cls: string) => code.includes(cls) && !code.includes(`class ${cls}`)
  let prefix = ''
  if (needs('ListNode'))  prefix += LISTNODE_DEF
  if (needs('TreeNode'))  prefix += TREENODE_DEF
  if (needs('Node') && !code.includes('class Node') &&
      !code.includes('TreeNode') && !code.includes('ListNode')) {
    prefix += NODE_DEF
  }
  if (needs('Interval'))  prefix += INTERVAL_DEF
  return prefix ? prefix + '\n' + code : code
}

export async function POST(req: NextRequest) {
  try {
    const { source_code, language_id } = await req.json()

    // Auto-inject missing helper class definitions for Python
    const finalCode = language_id === 71 ? injectHelpers(source_code) : source_code

    const submitRes = await fetch(`${JUDGE0}/submissions?base64_encoded=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: b64encode(finalCode), language_id }),
    })
    const { token } = await submitRes.json()
    if (!token) {
      return NextResponse.json({ error: 'No token from Judge0' }, { status: 500 })
    }

    let result: any = null
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 700))
      const r = await fetch(`${JUDGE0}/submissions/${token}?base64_encoded=true`)
      result = await r.json()
      if (result?.status?.id > 2) break
    }

    if (!result) {
      return NextResponse.json({ error: 'Timed out' }, { status: 500 })
    }

    return NextResponse.json({
      ...result,
      stdout: b64decode(result.stdout),
      stderr: b64decode(result.stderr),
      compile_output: b64decode(result.compile_output),
      message: b64decode(result.message),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

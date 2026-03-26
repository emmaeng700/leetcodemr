'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { RotateCcw, Code2, Play, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { getPracticeSession, savePracticeSession } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

// Code execution — proxied server-side through Next.js API
const RUN_CODE_API = '/api/run-code'
const JUDGE0_LANG: Record<string, number> = {
  python: 71,  // Python 3.8.1
  cpp:    54,  // C++ (GCC 9.2.0)
}

// Dynamic import to avoid SSR issues with CodeMirror
const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

const NAV_ROW = [
  { k: '⏎', action: 'newline' },
  { k: '⇤', action: 'dedent' },
  { k: '⇥', action: 'indent' },
  { k: '←', action: 'arrow-left' },
  { k: '→', action: 'arrow-right' },
  { k: '↑', action: 'arrow-up' },
  { k: '↓', action: 'arrow-down' },
]

const TOOLBAR: Record<string, { row1: { k: string; v: string; c: number }[]; row2: { k: string; v: string; c: number }[] }> = {
  python: {
    row1: [
      { k: '()', v: '()', c: 1 }, { k: '[]', v: '[]', c: 1 }, { k: '{}', v: '{}', c: 1 },
      { k: '""', v: '""', c: 1 }, { k: "''", v: "''", c: 1 }, { k: ':', v: ':', c: 1 },
      { k: ',', v: ', ', c: 2 }, { k: '.', v: '.', c: 1 }, { k: '_', v: '_', c: 1 }, { k: '#', v: '# ', c: 2 },
    ],
    row2: [
      { k: '=', v: ' = ', c: 3 }, { k: '==', v: ' == ', c: 4 }, { k: '!=', v: ' != ', c: 4 },
      { k: '+=', v: ' += ', c: 4 }, { k: '->', v: ' -> ', c: 4 }, { k: '**', v: '**', c: 2 },
      { k: '//', v: '//', c: 2 }, { k: 'self.', v: 'self.', c: 5 }, { k: 'None', v: 'None', c: 4 },
      { k: 'True', v: 'True', c: 4 }, { k: 'False', v: 'False', c: 5 }, { k: 'and', v: ' and ', c: 5 },
      { k: 'or', v: ' or ', c: 4 }, { k: 'not', v: 'not ', c: 4 }, { k: 'in', v: ' in ', c: 4 },
    ],
  },
  cpp: {
    row1: [
      { k: '()', v: '()', c: 1 }, { k: '[]', v: '[]', c: 1 }, { k: '{}', v: '{}', c: 1 },
      { k: '<>', v: '<>', c: 1 }, { k: '""', v: '""', c: 1 }, { k: ';', v: ';', c: 1 },
      { k: ',', v: ', ', c: 2 }, { k: '.', v: '.', c: 1 }, { k: '_', v: '_', c: 1 }, { k: '//', v: '// ', c: 3 },
    ],
    row2: [
      { k: '=', v: ' = ', c: 3 }, { k: '==', v: ' == ', c: 4 }, { k: '!=', v: ' != ', c: 4 },
      { k: '->', v: '->', c: 2 }, { k: '::', v: '::', c: 2 }, { k: '<<', v: ' << ', c: 4 },
      { k: '>>', v: ' >> ', c: 4 }, { k: '++', v: '++', c: 2 }, { k: '--', v: '--', c: 2 },
      { k: 'nullptr', v: 'nullptr', c: 7 }, { k: 'true', v: 'true', c: 4 }, { k: 'false', v: 'false', c: 5 },
      { k: 'auto', v: 'auto ', c: 5 }, { k: 'int', v: 'int ', c: 4 },
    ],
  },
}

interface PracticeEditorProps {
  questionId: number
  slug?: string
  starterPython?: string
  starterCpp?: string
  hideRunCode?: boolean
}

export default function PracticeEditor({ questionId, slug, starterPython, starterCpp, hideRunCode = false }: PracticeEditorProps) {
  const [lang, setLang] = useState<'python' | 'cpp'>('python')
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  const [extensions, setExtensions] = useState<any[]>([])
  const [theme, setTheme] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const editorViewRef = useRef<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      userIdRef.current = uid
    })
  }, [])

  const storageKey = `practice_v7_${questionId}_${lang}`
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const DEFAULT_PYTHON = `from typing import List, Optional

class Solution:
    def solve(self):
        # Write your solution here
        pass

# ── Test your solution ──────────────────────
sol = Solution()
# print(sol.solve())  # add your test inputs here
`

  const DEFAULT_CPP = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    void solve() {
        // Write your solution here
    }
};

int main() {
    Solution sol;
    // sol.solve();  // add your test inputs here
    return 0;
}
`

  function pyDefaultVal(type: string): string {
    const t = type.trim()
    if (t.includes('List[List[int]]')) return '[[1,2],[3,4]]'
    if (t.includes('List[List[str]]')) return '[["a","b"],["c","d"]]'
    if (t.includes('List[List')) return '[[1,2],[3,4]]'
    if (t.includes('List[int]')) return '[2,7,11,15]'
    if (t.includes('List[str]')) return '["eat","tea","tan"]'
    if (t.includes('List[float]')) return '[1.0,2.0]'
    if (t.includes('List[')) return '[1,2,3]'
    if (t === 'int') return '0'
    if (t === 'str') return '"hello"'
    if (t === 'float') return '0.0'
    if (t === 'bool') return 'True'
    if (t.startsWith('Optional[TreeNode')) return 'None'
    if (t.startsWith('Optional[ListNode')) return 'None'
    if (t.startsWith('Optional')) return 'None'
    if (t.includes('TreeNode')) return 'None'
    if (t.includes('ListNode')) return 'None'
    return 'None'
  }

  function cppDefaultVal(type: string): string {
    const t = type.trim()
    if (t.includes('vector<vector<int>>')) return '{{1,2},{3,4}}'
    if (t.includes('vector<vector<string>>')) return '{{"eat","tea"},{"tan"}}'
    if (t.includes('vector<vector')) return '{{1,2},{3,4}}'
    if (t.includes('vector<int>')) return '{2,7,11,15}'
    if (t.includes('vector<string>')) return '{"hello","world"}'
    if (t.includes('vector<')) return '{}'
    if (t === 'int' || t === 'long' || t === 'long long') return '0'
    if (t === 'string') return '"hello"'
    if (t === 'bool') return 'true'
    if (t === 'double' || t === 'float') return '0.0'
    if (t.includes('TreeNode') || t.includes('ListNode')) return 'nullptr'
    return '0'
  }

  function splitCppParams(s: string): string[] {
    const parts: string[] = []
    let depth = 0, cur = ''
    for (const ch of s) {
      if (ch === '<') depth++
      else if (ch === '>') depth--
      else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    if (cur.trim()) parts.push(cur.trim())
    return parts
  }

  function withTestHarness(base: string, language: 'python' | 'cpp'): string {
    if (language === 'python') {
      const lines = base.split('\n')
      // Already has runnable test code
      const hasTest = lines.some(l => {
        const t = l.trim()
        return t.startsWith('print(') || t.startsWith('sol.') || t.startsWith('_check(') ||
          (t !== '' && !t.startsWith('#') && !t.startsWith('class ') && !t.startsWith('def ') &&
           !t.startsWith('from ') && !t.startsWith('import ') && !l.startsWith(' '))
      })
      if (hasTest) return base

      // Detect design pattern: top-level class that is NOT Solution (or is Solution with __init__)
      // i.e. the class has __init__ — it's meant to be instantiated directly
      const topClass = lines.find(l => /^class \w+/.test(l))
      const topClassName = topClass?.match(/^class (\w+)/)?.[1]
      const isDesign = topClassName && (
        topClassName !== 'Solution' ||
        lines.some(l => /^\s{4}def __init__\(self/.test(l))
      ) && lines.some(l => /^\s+def __init__\(self/.test(l))

      if (isDesign) {
        // Find first non-init method for example comment
        const firstMethod = lines.find(l => {
          const m = l.match(/^\s+def (\w+)\(self/)
          return m && m[1] !== '__init__'
        })
        const methodName = firstMethod?.match(/def (\w+)/)?.[1] || 'method'
        return base.trimEnd() + `\n\n# ── Test ──\nobj = ${topClassName}()\n# obj.${methodName}(...)\n`
      }

      // Normal Solution class — find the main method
      let methodName = 'solve'
      let callArgs = ''
      // Prefer the method with the highest score (last defined, not __init__)
      const candidates: { name: string; args: string; score: number; idx: number }[] = []
      lines.forEach((line, idx) => {
        const m = line.match(/^\s{4}def (\w+)\(self(?:,\s*(.*?))?\)\s*(?:->.*?)?:\s*$/)
        if (m && m[1] !== '__init__') {
          const rawParams = m[2] || ''
          const args = rawParams.trim()
            ? rawParams.split(',').map(p => {
                const t = p.trim()
                const colonIdx = t.indexOf(':')
                return colonIdx >= 0 ? pyDefaultVal(t.slice(colonIdx + 1)) : '0'
              }).join(', ')
            : ''
          const score = (rawParams.match(/,/g) || []).length
          candidates.push({ name: m[1], args, score, idx })
        }
      })
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score || b.idx - a.idx)
        methodName = candidates[0].name
        callArgs = candidates[0].args
      }

      return base.trimEnd() + `\n\n# ── Test ──\nsol = Solution()\nprint(sol.${methodName}(${callArgs}))\n`
    } else {
      if (base.includes('int main')) return base

      let methodName = 'solve'
      let callArgs = ''
      let returnType = 'void'
      const lines = base.split('\n')
      for (const line of lines) {
        const m = line.match(/^\s{4}(\w[\w<>:,\s*&]*?)\s+(\w+)\s*\((.*?)\)\s*\{/)
        if (m && m[2] !== 'Solution') {
          returnType = m[1].trim()
          methodName = m[2]
          const parts = splitCppParams(m[3] || '')
          callArgs = parts.map(p => {
            p = p.trim()
            const words = p.split(/\s+/)
            const type = words.slice(0, -1).join(' ')
            return cppDefaultVal(type)
          }).join(', ')
          break
        }
      }

      const callLine = returnType === 'void'
        ? `    sol.${methodName}(${callArgs});`
        : `    cout << sol.${methodName}(${callArgs}) << endl;`

      return base.trimEnd() + `\n\nint main() {\n    Solution sol;\n${callLine}\n    return 0;\n}\n`
    }
  }

  const starter = lang === 'python'
    ? (starterPython ? withTestHarness(starterPython, 'python') : DEFAULT_PYTHON)
    : (starterCpp ? withTestHarness(starterCpp, 'cpp') : DEFAULT_CPP)

  // Load language extensions lazily
  useEffect(() => {
    async function loadExtensions() {
      const [{ python }, { cpp }, { oneDark }, viewMod, stateMod, cmdMod] = await Promise.all([
        import('@codemirror/lang-python'),
        import('@codemirror/lang-cpp'),
        import('@codemirror/theme-one-dark'),
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/commands'),
      ])
      setTheme(oneDark)
      const { keymap } = viewMod
      const { Prec } = stateMod
      const { indentWithTab } = cmdMod
      const { indentationMarkers } = await import('@replit/codemirror-indentation-markers')
      const smartEnter = (view: any) => {
        const { from } = view.state.selection.main
        const line = view.state.doc.lineAt(from)
        const indentMatch = line.text.match(/^(\s*)/)
        const baseIndent = indentMatch ? indentMatch[1] : ''
        // Add extra indent if line ends with : (Python) or { (C++)
        const trimmed = line.text.trimEnd()
        const extraIndent = (trimmed.endsWith(':') || trimmed.endsWith('{')) ? '    ' : ''
        const insert = '\n' + baseIndent + extraIndent
        view.dispatch({
          changes: { from, to: from, insert },
          selection: { anchor: from + insert.length },
        })
        return true
      }
      const smartKeys = Prec.highest(keymap.of([
        { key: 'Enter', run: smartEnter },
        indentWithTab,
      ]))
      setExtensions([lang === 'python' ? python() : cpp(), smartKeys, indentationMarkers()])
    }
    loadExtensions()
  }, [lang])

  // Load: localStorage first (instant), then Supabase (authoritative)
  useEffect(() => {
    const local = localStorage.getItem(storageKey)
    setCode(local !== null ? local : starter)

    // Async: load from Supabase and prefer it if it has saved code
    if (userIdRef.current) {
      getPracticeSession(userIdRef.current, questionId, lang).then(session => {
        if (session?.code) {
          setCode(session.code)
          localStorage.setItem(storageKey, session.code)
        }
      })
    }
  }, [questionId, lang])

  const handleChange = (val: string) => {
    setCode(val)
    localStorage.setItem(storageKey, val)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
    // Debounce Supabase save — write 2s after last keystroke
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (userIdRef.current) savePracticeSession(userIdRef.current, questionId, lang, val)
    }, 2000)
  }

  const reset = () => {
    setCode(starter)
    localStorage.setItem(storageKey, starter)
    if (userId) savePracticeSession(userId, questionId, lang, starter)
  }

  const runCode = async () => {
    setRunning(true)
    setOutput('Running…')
    setShowOutput(true)
    try {
      const res = await fetch(RUN_CODE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language_id: JUDGE0_LANG[lang] }),
      })
      const result = await res.json()

      if (result?.error) {
        setOutput(`Error: ${result.error}`)
        setRunning(false)
        return
      }

      const statusId = result?.status?.id ?? 0
      const statusDesc = result?.status?.description || 'Unknown'
      const stdout = result?.stdout || ''
      const stderr = result?.stderr || ''
      const compileErr = result?.compile_output || ''
      const time = result?.time ? ` · ${result.time}s` : ''

      if (statusId === 6 || compileErr) {
        setOutput(`🔴 Compile Error:\n${compileErr || stderr}`)
      } else if (statusId >= 7 && statusId <= 12) {
        setOutput(`🔴 ${statusDesc}${time}${stderr ? '\n\n' + stderr : ''}`)
      } else if (!stdout && !stderr) {
        setOutput(`⚠️ No output — make sure to print your result.\n[${statusDesc}${time}]`)
      } else {
        setOutput(stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') + `\n[${statusDesc}${time}]`)
      }
    } catch (err) {
      setOutput(`Network error: ${err}`)
    }
    setRunning(false)
  }

  const getLineIndent = useCallback((view: any) => {
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const match = line.text.match(/^(\s*)/)
    return match ? match[1] : ''
  }, [])

  const insert = useCallback((key: { k: string; v?: string; c?: number; action?: string }) => {
    const view = editorViewRef.current
    if (!view) return

    if (key.action === 'newline') {
      const { from } = view.state.selection.main
      const indent = getLineIndent(view)
      const insertText = '\n' + indent
      view.dispatch({ changes: { from, to: from, insert: insertText }, selection: { anchor: from + insertText.length } })
    } else if (key.action === 'indent') {
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: '    ' }, selection: { anchor: from + 4 } })
    } else if (key.action === 'dedent') {
      const { from } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      let spaces = 0
      for (let i = 0; i < Math.min(4, line.text.length); i++) {
        if (line.text[i] === ' ') spaces++
        else break
      }
      if (spaces > 0) view.dispatch({ changes: { from: line.from, to: line.from + spaces, insert: '' }, selection: { anchor: Math.max(line.from, from - spaces) } })
    } else if (key.action === 'arrow-left') {
      import('@codemirror/commands').then(({ cursorCharLeft }) => cursorCharLeft(view))
    } else if (key.action === 'arrow-right') {
      import('@codemirror/commands').then(({ cursorCharRight }) => cursorCharRight(view))
    } else if (key.action === 'arrow-up') {
      import('@codemirror/commands').then(({ cursorLineUp }) => cursorLineUp(view))
    } else if (key.action === 'arrow-down') {
      import('@codemirror/commands').then(({ cursorLineDown }) => cursorLineDown(view))
    } else if (key.v !== undefined && key.c !== undefined) {
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: key.v }, selection: { anchor: from + key.c } })
    }
    view.focus()
  }, [getLineIndent])

  const toolbar = TOOLBAR[lang]

  return (
    <div className="bg-[#1e1e2e] rounded-xl border border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#181825] border-b border-gray-700 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 size={14} className="text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-gray-200 truncate">Practice — write it from memory</span>
          {slug && (
            <a
              href={`https://leetcode.com/problems/${slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors shrink-0 ml-1"
              title="Open on LeetCode"
            >
              <ExternalLink size={11} />
              <span className="hidden sm:inline">LeetCode</span>
            </a>
          )}
          {saved && <span className="text-xs text-green-400 ml-1 shrink-0">saved ✓</span>}
        </div>
        <div className="flex items-center gap-1 bg-[#313244] rounded-lg p-0.5">
          {(['python', 'cpp'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                lang === l
                  ? l === 'python' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}>
              {l === 'python' ? 'Python' : 'C++'}
            </button>
          ))}
        </div>
      </div>

      <div className="practice-cm-wrap">
        {typeof window !== 'undefined' && CodeMirror && theme && (
          <CodeMirror
            value={code}
            height="320px"
            theme={theme}
            extensions={extensions}
            onChange={handleChange}
            onCreateEditor={(view: any) => { editorViewRef.current = view }}
            basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, autocompletion: true, indentOnInput: true }}
          />
        )}
        {(!theme) && (
          <textarea
            value={code}
            onChange={e => handleChange(e.target.value)}
            className="w-full h-[320px] p-4 font-mono bg-gray-900 text-gray-100 resize-none focus:outline-none"
            style={{ fontSize: '16px' }}
          />
        )}
      </div>

      <div className="px-2 pt-1.5 pb-1.5 bg-[#1e1e2e] border-t border-[#313244] space-y-1.5">
        <div className="grid grid-cols-7 gap-1">
          {NAV_ROW.map(key => (
            <button key={key.k} onMouseDown={e => e.preventDefault()} onClick={() => insert(key)}
              className="py-2 rounded-md text-sm font-mono font-bold bg-[#45475a] text-gray-100 hover:bg-indigo-600 active:bg-indigo-700 transition-colors border border-[#585b70] select-none text-center">
              {key.k}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {toolbar.row1.map(key => (
            <button key={key.k} onMouseDown={e => e.preventDefault()} onClick={() => insert(key)}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold bg-[#313244] text-gray-200 hover:bg-[#45475a] active:bg-indigo-600 transition-colors border border-[#45475a] hover:border-indigo-500 select-none">
              {key.k}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {toolbar.row2.map(key => (
            <button key={key.k} onMouseDown={e => e.preventDefault()} onClick={() => insert(key)}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold bg-[#313244] text-gray-200 hover:bg-[#45475a] active:bg-indigo-600 transition-colors border border-[#45475a] hover:border-indigo-500 select-none">
              {key.k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-t border-gray-700 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Auto-saved · {lang === 'python' ? 'Python' : 'C++'}</span>
          {saved && <span className="text-xs text-green-400">saved ✓</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-300 bg-[#313244] hover:bg-[#45475a] transition-colors">
            <RotateCcw size={11} /> Reset
          </button>
          {!hideRunCode && (
            <button
              onClick={runCode}
              disabled={running}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play size={11} /> {running ? 'Running…' : 'Run Code'}
            </button>
          )}
        </div>
      </div>

      {/* Output panel — only when run code is enabled */}
      {!hideRunCode && output !== null && (
        <div className="border-t border-[#313244]">
          <button
            onClick={() => setShowOutput(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 bg-[#181825] text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>Output</span>
            {showOutput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showOutput && (
            <pre className="px-4 py-3 text-xs font-mono text-gray-200 bg-[#11111b] whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

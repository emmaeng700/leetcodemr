'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { RotateCcw, Code2 } from 'lucide-react'

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
  starterPython?: string
  starterCpp?: string
}

export default function PracticeEditor({ questionId, starterPython, starterCpp }: PracticeEditorProps) {
  const [lang, setLang] = useState<'python' | 'cpp'>('python')
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  const [extensions, setExtensions] = useState<any[]>([])
  const [theme, setTheme] = useState<any>(null)
  const editorViewRef = useRef<any>(null)

  const storageKey = `practice_${questionId}_${lang}`
  const starter = lang === 'python'
    ? (starterPython || 'from typing import List, Optional\n\nclass Solution:\n    def solve(self):\n        # Write your solution here\n        pass\n')
    : (starterCpp || 'class Solution {\npublic:\n    void solve() {\n        // Write your solution here\n    }\n};\n')

  // Load language extensions lazily
  useEffect(() => {
    async function loadExtensions() {
      const [{ python }, { cpp }, { oneDark }, { keymap, Prec }] = await Promise.all([
        import('@codemirror/lang-python'),
        import('@codemirror/lang-cpp'),
        import('@codemirror/theme-one-dark'),
        import('@codemirror/view').then(async m => ({ ...m, Prec: (await import('@codemirror/state')).Prec })),
      ])
      setTheme(oneDark)
      const enterKeymap = Prec.highest(keymap.of([{
        key: 'Enter',
        run: (view: any) => {
          const { from } = view.state.selection.main
          const line = view.state.doc.lineAt(from)
          const indent = (line.text.match(/^(\s*)/) || ['', ''])[1]
          view.dispatch({
            changes: { from, to: from, insert: '\n' + indent },
            selection: { anchor: from + 1 + indent.length },
          })
          return true
        },
      }]))
      setExtensions([lang === 'python' ? python() : cpp(), enterKeymap])
    }
    loadExtensions()
  }, [lang])

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    setCode(stored !== null ? stored : starter)
  }, [questionId, lang])

  const handleChange = (val: string) => {
    setCode(val)
    localStorage.setItem(storageKey, val)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const reset = () => {
    setCode(starter)
    localStorage.setItem(storageKey, starter)
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

      <div>
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
            className="w-full h-[320px] p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
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

      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-t border-gray-700">
        <span className="text-xs text-gray-500">Auto-saved · {lang === 'python' ? 'Python' : 'C++'}</span>
        <button onClick={reset} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-300 bg-[#313244] hover:bg-[#45475a] transition-colors">
          <RotateCcw size={11} /> Reset starter
        </button>
      </div>
    </div>
  )
}

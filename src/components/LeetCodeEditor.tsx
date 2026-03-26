'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Play, Send, Loader2, CheckCircle, XCircle, Clock, Cpu,
  AlertCircle, Key, ChevronDown, ChevronUp, Star,
} from 'lucide-react'
import { getProgress, updateProgress } from '@/lib/db'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

/* ─── Types ──────────────────────────────────────────────── */
interface LCQuestion {
  questionId: string
  questionFrontendId: string
  titleSlug: string
  codeSnippets: { lang: string; langSlug: string; code: string }[]
  exampleTestcases: string
  sampleTestCase: string
  metaData: string
}
interface LCResult {
  state: string; status_code?: number; status_msg?: string
  total_correct?: number; total_testcases?: number
  runtime_percentile?: number; memory_percentile?: number
  status_runtime?: string; status_memory?: string
  code_answer?: string[]; code_output?: string[]; expected_code_answer?: string[]
  compare_result?: string; last_testcase?: string
  full_compile_error?: string; full_runtime_error?: string
}
interface TestCase { params: { name: string; value: string }[]; raw: string }

/* ─── Helpers ────────────────────────────────────────────── */
function parseCases(exampleTestcases: string, metaData: string): TestCase[] {
  try {
    const meta = JSON.parse(metaData)
    const params: { name: string }[] = meta.params ?? []
    const numParams = params.length
    if (numParams === 0) return [{ params: [], raw: exampleTestcases }]
    const lines = exampleTestcases.split('\n')
    const cases: TestCase[] = []
    for (let i = 0; i + numParams <= lines.length; i += numParams) {
      const slice = lines.slice(i, i + numParams)
      if (slice.every(l => l.trim() === '')) continue
      cases.push({ params: params.map((p, j) => ({ name: p.name, value: slice[j] ?? '' })), raw: slice.join('\n') })
    }
    return cases.length ? cases : [{ params: [], raw: exampleTestcases }]
  } catch { return [{ params: [], raw: exampleTestcases }] }
}

const STATUS_CLS: Record<number, string> = {
  10: 'text-green-500', 11: 'text-red-500', 12: 'text-red-500',
  13: 'text-red-500', 14: 'text-orange-500', 15: 'text-red-500', 20: 'text-red-500',
}
const LANG_LC: Record<string, string> = { python3: 'python3', cpp: 'cpp' }
const LANG_LABEL: Record<string, string> = { python3: 'Python 3', cpp: 'C++' }

/* ─── Props ──────────────────────────────────────────────── */
interface Props {
  appQuestionId: number
  slug: string
}

/* ══════════════════════════════════════════════════════════ */
export default function LeetCodeEditor({ appQuestionId, slug }: Props) {
  /* Session */
  const [session,   setSession]   = useState('')
  const [csrf,      setCsrf]      = useState('')
  const sessionOK = !!(session && csrf)

  /* LeetCode question data */
  const [lcQ,     setLcQ]     = useState<LCQuestion | null>(null)
  const [lcLoad,  setLcLoad]  = useState(false)
  const [lcErr,   setLcErr]   = useState('')

  /* Editor */
  const [lang,        setLang]       = useState<'python3' | 'cpp'>('python3')
  const [code,        setCode]       = useState('')
  const [extensions,  setExtensions] = useState<any[]>([])
  const [editorTheme, setTheme]      = useState<any>(null)

  /* Bottom panel */
  const [bottomTab,  setBottomTab]  = useState<'testcase' | 'result'>('testcase')
  const [cases,      setCases]      = useState<TestCase[]>([])
  const [activeCase, setActiveCase] = useState(0)
  const [testInput,  setTestInput]  = useState('')
  const [running,    setRunning]    = useState(false)
  const [runMode,    setRunMode]    = useState<'test' | 'submit' | null>(null)
  const [pollMsg,    setPollMsg]    = useState('')
  const [result,     setResult]     = useState<LCResult | null>(null)
  const [resultErr,  setResultErr]  = useState('')
  const [solvedStatus, setSolvedStatus] = useState<'marked' | 'already' | 'not-in-library' | null>(null)
  const [showSessionHint, setShowSessionHint] = useState(false)

  /* ── Load session ── */
  useEffect(() => {
    setSession(localStorage.getItem('lc_session') ?? '')
    setCsrf(localStorage.getItem('lc_csrf') ?? '')
  }, [])

  /* ── Load CodeMirror extensions ── */
  useEffect(() => {
    async function loadExts() {
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
        const base = line.text.match(/^(\s*)/)?.[1] ?? ''
        const extra = (line.text.trimEnd().endsWith(':') || line.text.trimEnd().endsWith('{')) ? '    ' : ''
        const ins = '\n' + base + extra
        view.dispatch({ changes: { from, to: from, insert: ins }, selection: { anchor: from + ins.length } })
        return true
      }
      const keys = Prec.highest(keymap.of([{ key: 'Enter', run: smartEnter }, indentWithTab]))
      setExtensions([lang === 'python3' ? python() : cpp(), keys, indentationMarkers()])
    }
    loadExts()
  }, [lang])

  /* ── Fetch LeetCode question data ── */
  useEffect(() => {
    if (!slug) return
    setLcLoad(true); setLcErr('')

    // Read session from localStorage at fetch time (may have loaded after mount)
    const lc_session  = localStorage.getItem('lc_session')  ?? ''
    const lc_csrf     = localStorage.getItem('lc_csrf')     ?? ''

    fetch('/api/leetcode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: lc_session, csrfToken: lc_csrf,
        query: `query($s:String!){question(titleSlug:$s){questionId questionFrontendId titleSlug isPaidOnly codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`,
        variables: { s: slug },
      }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.errors) throw new Error(json.errors[0]?.message)
        const q: LCQuestion & { isPaidOnly?: boolean } = json.data?.question
        if (!q) {
          setLcErr('Could not load question data from LeetCode.')
          return
        }
        // Premium question with no session / session expired
        if (q.isPaidOnly && !q.codeSnippets?.length) {
          setLcErr('premium')
          return
        }
        setLcQ(q)
        const parsed = parseCases(q.exampleTestcases ?? '', q.metaData ?? '{}')
        setCases(parsed); setActiveCase(0); setTestInput(parsed[0]?.raw ?? '')
        // Load saved code or fall back to LeetCode starter
        const saved = localStorage.getItem(`lc_code_${slug}_${lang}`)
        setCode(saved ?? q.codeSnippets?.find(s => s.langSlug === lang)?.code ?? '')
      })
      .catch(e => setLcErr(String(e)))
      .finally(() => setLcLoad(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  /* Save code to localStorage on every change */
  const handleCodeChange = (val: string) => {
    setCode(val)
    localStorage.setItem(`lc_code_${slug}_${lang}`, val)
  }

  const switchLang = (l: 'python3' | 'cpp') => {
    setLang(l)
    if (lcQ) {
      const saved = localStorage.getItem(`lc_code_${slug}_${l}`)
      setCode(saved ?? lcQ.codeSnippets?.find(s => s.langSlug === l)?.code ?? '')
    }
    setResult(null)
  }

  /* ── Poll for result ── */
  const poll = useCallback(async (checkId: string, mode: 'test' | 'submit') => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      setPollMsg(`Judging… ${i + 1}s`)
      const res = await fetch('/api/leetcode/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId, titleSlug: slug, session, csrfToken: csrf }),
      })
      const data: LCResult = await res.json()
      if (data.state !== 'PENDING' && data.state !== 'STARTED') {
        setResult(data); setRunning(false); setPollMsg(''); setBottomTab('result')

        /* Sync to app on Accepted Submit */
        if (mode === 'submit' && data.status_code === 10) {
          const prog = await getProgress()
          const alreadySolved = Array.isArray(prog)
            ? prog.some((p: any) => p.question_id === appQuestionId && p.solved)
            : (prog as any)?.[String(appQuestionId)]?.solved
          if (alreadySolved) {
            setSolvedStatus('already')
          } else {
            await updateProgress(appQuestionId, { solved: true })
            setSolvedStatus('marked')
          }
        }
        return
      }
    }
    setResultErr('Timed out.'); setRunning(false); setPollMsg('')
  }, [session, csrf, slug, appQuestionId])

  /* ── Run test ── */
  const runTest = async () => {
    if (!lcQ || !sessionOK) return
    setRunning(true); setRunMode('test'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Sending…'); setBottomTab('result')
    try {
      const res = await fetch('/api/leetcode/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: slug, questionId: lcQ.questionId, lang: LANG_LC[lang], code, testInput: cases[activeCase]?.raw || testInput, session, csrfToken: csrf }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await poll(data.interpret_id, 'test')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  /* ── Submit ── */
  const runSubmit = async () => {
    if (!lcQ || !sessionOK) return
    setRunning(true); setRunMode('submit'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Submitting…'); setBottomTab('result')
    try {
      const res = await fetch('/api/leetcode/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: slug, questionId: lcQ.questionId, lang: LANG_LC[lang], code, session, csrfToken: csrf }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await poll(data.submission_id, 'submit')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  const isAC = result?.status_code === 10

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    <div className="flex flex-col overflow-hidden rounded-none sm:rounded-xl border-0 sm:border border-gray-700/50 bg-[#1a1a2e] flex-1 min-h-[420px]">
      <style>{`
        .cm-editor { font-size: 11px; }
        @media (min-width: 640px)  { .cm-editor { font-size: 12px; } }
        @media (min-width: 1024px) { .cm-editor { font-size: 13px; } }
        .cm-scroller { overflow-x: auto !important; }
        .cm-content, .cm-line { word-break: normal; white-space: pre; }
        .cm-editor { touch-action: pan-y; }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 bg-[#16213e] border-b border-gray-700/50 shrink-0">
        {/* Language */}
        <div className="flex gap-1">
          {(['python3', 'cpp'] as const).map(l => (
            <button key={l} onClick={() => switchLang(l)}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition ${lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="flex-1" />

        {/* Session warning */}
        {!sessionOK && (
          <button onClick={() => setShowSessionHint(h => !h)}
            className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition">
            <Key size={11} />
            <span className="hidden sm:inline">Setup LeetCode session</span>
            <span className="sm:hidden">Session</span>
            {showSessionHint ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}

        {/* Run + Submit */}
        <button onClick={runTest} disabled={running || !sessionOK || !lcQ}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-600 active:bg-gray-500 disabled:opacity-40 transition">
          {running && runMode === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Run
        </button>
        <button onClick={runSubmit} disabled={running || !sessionOK || !lcQ}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-500 active:bg-green-400 disabled:opacity-40 transition">
          {running && runMode === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Submit
        </button>
      </div>

      {/* Session hint */}
      {showSessionHint && (
        <div className="bg-[#16213e] border-b border-gray-700/50 px-4 py-3 text-xs text-gray-400 space-y-1 shrink-0">
          <p>Go to <strong className="text-gray-200">leetcode.com</strong> → DevTools → Application → Cookies</p>
          <p>Copy <code className="bg-gray-800 px-1 rounded text-orange-300">LEETCODE_SESSION</code> and <code className="bg-gray-800 px-1 rounded text-orange-300">csrftoken</code> → paste them in the <strong className="text-gray-200">LeetCode</strong> page, then come back.</p>
        </div>
      )}

      {/* ── Editor loading state ── */}
      {lcLoad && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        </div>
      )}
      {lcErr && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          {lcErr === 'premium' ? (
            <div className="space-y-2">
              <div className="text-2xl">🔒</div>
              <p className="text-xs text-gray-300 font-semibold">LeetCode Premium required</p>
              <p className="text-xs text-gray-500 max-w-xs">
                The editor needs your LeetCode session to load this question.
                {!sessionOK && ' Add your session token using the "Setup LeetCode session" button above.'}
              </p>
              <a
                href={`https://leetcode.com/problems/${slug}/`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
              >
                Open on LeetCode ↗
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <XCircle size={14} className="shrink-0" /> Could not load question: {lcErr}
            </div>
          )}
        </div>
      )}

      {/* ── CodeMirror ── */}
      {!lcLoad && !lcErr && (
        <div className="flex-1 overflow-hidden min-h-0">
          <CodeMirror
            value={code}
            onChange={handleCodeChange}
            height="100%"
            theme={editorTheme ?? 'dark'}
            extensions={extensions}
            basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, autocompletion: true, indentOnInput: true }}
            style={{ height: '100%' }}
          />
        </div>
      )}

      {/* ── Bottom panel ── */}
      <div className="h-36 sm:h-44 border-t border-gray-700/50 flex flex-col bg-[#16213e] shrink-0">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-700/50 shrink-0">
          {(['testcase', 'result'] as const).map(tab => (
            <button key={tab} onClick={() => setBottomTab(tab)}
              className={`px-4 py-2 text-xs font-semibold capitalize transition ${bottomTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab === 'testcase' ? 'Testcase' : 'Test Result'}
            </button>
          ))}
          {pollMsg && (
            <span className="ml-3 flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 size={11} className="animate-spin text-indigo-400" /> {pollMsg}
            </span>
          )}
          {result && !pollMsg && (
            <span className={`ml-3 text-xs font-bold ${STATUS_CLS[result.status_code ?? 0] ?? 'text-gray-400'}`}>
              {result.status_msg}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* Testcase tab */}
          {bottomTab === 'testcase' && (
            <div className="space-y-2">
              {cases.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {cases.map((_, i) => (
                    <button key={i}
                      onClick={() => { setActiveCase(i); setTestInput(cases[i].raw) }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition ${activeCase === i ? 'bg-gray-600 text-white' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60'}`}>
                      Case {i + 1}
                    </button>
                  ))}
                </div>
              )}
              {cases[activeCase]?.params.length > 0 ? (
                <div className="space-y-2">
                  {cases[activeCase].params.map(p => (
                    <div key={p.name}>
                      <p className="text-xs text-gray-500 mb-1">{p.name} =</p>
                      <div className="bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200">{p.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={3}
                  className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none resize-none" />
              )}
            </div>
          )}

          {/* Result tab */}
          {bottomTab === 'result' && (
            <div className="space-y-2 text-xs">
              {resultErr && <p className="text-red-400 flex items-center gap-1"><XCircle size={12} /> {resultErr}</p>}
              {!result && !resultErr && !pollMsg && <p className="text-gray-600">Run your code first.</p>}
              {result && (
                <div className="space-y-2">
                  {/* Status */}
                  <div className={`flex items-center gap-2 font-bold text-sm ${STATUS_CLS[result.status_code ?? 0] ?? 'text-gray-400'}`}>
                    {isAC ? <CheckCircle size={15} /> : <XCircle size={15} />}
                    {result.status_msg}
                    {result.total_testcases && (
                      <span className="text-gray-500 font-normal text-xs">{result.total_correct}/{result.total_testcases} passed</span>
                    )}
                  </div>

                  {/* App sync badge */}
                  {solvedStatus === 'marked' && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                      <Star size={11} className="fill-green-400" /> Marked as solved — spaced repetition started
                    </div>
                  )}
                  {solvedStatus === 'already' && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700/30 border border-gray-600/20 rounded-lg px-3 py-1.5">
                      <CheckCircle size={11} /> Already solved in your app
                    </div>
                  )}

                  {/* Perf (submit) */}
                  {isAC && runMode === 'submit' && result.status_runtime && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                        <p className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-0.5"><Clock size={10} /> Runtime</p>
                        <p className="font-bold text-gray-100">{result.status_runtime}</p>
                        {result.runtime_percentile && <p className="text-green-400 text-xs">Beats {result.runtime_percentile.toFixed(1)}%</p>}
                      </div>
                      {result.status_memory && (
                        <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                          <p className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-0.5"><Cpu size={10} /> Memory</p>
                          <p className="font-bold text-gray-100">{result.status_memory}</p>
                          {result.memory_percentile && <p className="text-green-400 text-xs">Beats {result.memory_percentile.toFixed(1)}%</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Wrong answer */}
                  {result.status_code === 11 && result.last_testcase && (
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Input: </span><code className="text-gray-300">{result.last_testcase}</code></div>
                      {result.code_answer?.[0] !== undefined && <div><span className="text-gray-500">Output: </span><code className="text-red-400">{result.code_answer[0]}</code></div>}
                      {result.expected_code_answer?.[0] !== undefined && <div><span className="text-gray-500">Expected: </span><code className="text-green-400">{result.expected_code_answer[0]}</code></div>}
                    </div>
                  )}

                  {/* Compile/runtime error */}
                  {(result.full_compile_error || result.full_runtime_error) && (
                    <pre className="bg-gray-800/60 rounded-lg p-2 text-red-400 overflow-x-auto whitespace-pre-wrap text-xs">
                      {result.full_compile_error || result.full_runtime_error}
                    </pre>
                  )}

                  {/* Test run per-case */}
                  {runMode === 'test' && result.code_output?.map((out, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={result.compare_result?.[i] === '1' ? 'text-green-400' : 'text-red-400'}>
                        {result.compare_result?.[i] === '1' ? '✓' : '✗'}
                      </span>
                      <code className="text-gray-300">{out}</code>
                      {result.expected_code_answer?.[i] && result.compare_result?.[i] !== '1' && (
                        <span className="text-gray-500">→ <code className="text-green-400">{result.expected_code_answer[i]}</code></span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

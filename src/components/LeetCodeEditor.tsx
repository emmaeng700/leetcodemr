'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Play, Send, Loader2, CheckCircle, XCircle, Clock, Cpu,
  AlertCircle, Key, ChevronDown, ChevronUp, Star, Trophy,
  Eye, EyeOff, RotateCcw,
} from 'lucide-react'
import { getProgress, updateProgress, incrementAcSubmitCount } from '@/lib/db'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { normalizeLcCookieValue, getCookieFromHeader } from '@/lib/leetcodeHttp'
import { lcFetch, getLocalConnectorStatus } from '@/lib/leetcodeLocalConnector'
import { extBridgeHealthy, hasLeetMasteryBridge } from '@/lib/leetcodeExtensionBridge'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import toast from 'react-hot-toast'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })
type SupportedLang = 'python3' | 'cpp' | 'javascript'

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
const SEARCH_BY_ID_Q = `query($q:String!){problemsetQuestionListV2(categorySlug:"",limit:1,skip:0,searchKeyword:$q,filters:{filterCombineType:ALL}){questions{titleSlug}}}`

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
const LANG_LC: Record<SupportedLang, string> = { python3: 'python3', cpp: 'cpp', javascript: 'javascript' }
const LANG_LABEL: Record<SupportedLang, string> = { python3: 'Python 3', cpp: 'C++', javascript: 'JavaScript' }
const SUPPORTED_LANGS: SupportedLang[] = ['python3', 'cpp', 'javascript']

/* ─── Pre-submit syntax checker ─────────────────────────── */
/**
 * Catch the most common Python mistakes before the code even leaves the
 * browser, so you get an instant readable error instead of a cryptic
 * LeetCode judge response.
 */
function checkPythonSyntax(code: string, lang: string): string | null {
  if (lang !== 'python3') return null

  // ── Double/repeated keywords ─────────────────────────────
  const doubleKw: [RegExp, string][] = [
    [/\band\s+and\b/,    'double `and` keyword on the same line'],
    [/\bor\s+or\b/,      'double `or` keyword on the same line'],
    [/\bnot\s+not\b/,    'double `not` — did you mean `!=`?'],
    [/\bif\s+if\b/,      'double `if` keyword'],
    [/\breturn\s+return\b/, 'double `return`'],
    [/\bin\s+in\b/,      'double `in` keyword'],
    [/\bis\s+is\b/,      'double `is` keyword — did you mean `==`?'],
  ]
  for (const [re, msg] of doubleKw) {
    if (re.test(code)) return `Syntax error: ${msg}`
  }

  // ── Unbalanced brackets / parentheses ────────────────────
  const open = new Map([[')', '('], [']', '['], ['}', '{']])
  const stack: string[] = []
  let inStr = false, strChar = ''
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (!inStr && (ch === '"' || ch === "'")) {
      inStr = true; strChar = ch; continue
    }
    if (inStr && ch === strChar && code[i - 1] !== '\\') {
      inStr = false; continue
    }
    if (inStr) continue
    if ('([{'.includes(ch)) { stack.push(ch); continue }
    if (')]}'.includes(ch)) {
      if (!stack.length || stack[stack.length - 1] !== open.get(ch))
        return `Syntax error: unexpected '${ch}' — mismatched bracket`
      stack.pop()
    }
  }
  if (stack.length)
    return `Syntax error: unclosed '${stack[stack.length - 1]}' — add the closing bracket`

  return null
}

/* ─── Props ──────────────────────────────────────────────── */
interface Props {
  appQuestionId: number
  slug: string
  onAccepted?: () => void
  /** If false, runs/submits to LeetCode but won't sync progress or AC counts to the app DB. */
  syncToApp?: boolean
  preferredLangs?: SupportedLang[]
}

/* ── Mobile keyboard toolbar ───────────────────────────── */
function MobileKeybar({
  editorViewRef,
  cursorPosRef,
  onResetCode,
}: {
  editorViewRef: React.RefObject<any>
  cursorPosRef:  React.RefObject<{ from: number; to: number }>
  onResetCode: () => void
}) {
  const press = (action: string | (() => void)) => {
    const view = editorViewRef.current
    if (!view) return
    if (typeof action === 'function') { action(); return }

    // Use the ref-tracked position — more reliable on iOS than reading
    // view.state.selection.main at pointer-down time (iOS can shift it).
    const { from, to } = cursorPosRef.current ?? view.state.selection.main

    // Arrow movement — update cursorPosRef manually since these are selection-only
    // dispatches (no docChanged), so the updateListener won't track them.
    if (action === 'ArrowLeft') {
      const pos = Math.max(0, from - 1)
      view.dispatch({ selection: { anchor: pos } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
    }
    if (action === 'ArrowRight') {
      const pos = Math.min(view.state.doc.length, from + 1)
      view.dispatch({ selection: { anchor: pos } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
    }
    if (action === 'ArrowUp') {
      const line = view.state.doc.lineAt(from)
      if (line.number === 1) { view.dispatch({ selection: { anchor: 0 } }); cursorPosRef.current = { from: 0, to: 0 }; view.focus(); return }
      const prevLine = view.state.doc.line(line.number - 1)
      const col = from - line.from
      const pos = prevLine.from + Math.min(col, prevLine.length)
      view.dispatch({ selection: { anchor: pos } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
    }
    if (action === 'ArrowDown') {
      const line = view.state.doc.lineAt(from)
      if (line.number === view.state.doc.lines) { const pos = view.state.doc.length; view.dispatch({ selection: { anchor: pos } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return }
      const nextLine = view.state.doc.line(line.number + 1)
      const col = from - line.from
      const pos = nextLine.from + Math.min(col, nextLine.length)
      view.dispatch({ selection: { anchor: pos } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
    }

    // Backspace
    if (action === '⌫') {
      if (from !== to) {
        const pos = from
        view.dispatch({ changes: { from, to, insert: '' } }); cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
      }
      if (from === 0) return
      const pos = from - 1
      view.dispatch({ changes: { from: pos, to: from, insert: '' }, selection: { anchor: pos } })
      cursorPosRef.current = { from: pos, to: pos }; view.focus(); return
    }

    // Plain insert — cursor goes right after the inserted text
    const pos = from + action.length
    view.dispatch({ changes: { from, to, insert: action }, selection: { anchor: pos } })
    cursorPosRef.current = { from: pos, to: pos }; view.focus()
  }

  const btnCls = 'flex items-center justify-center rounded-md bg-[#2c313a] active:bg-[#3e4451] text-gray-200 font-mono font-semibold select-none'

  // Row 1: symbols  |  Row 2: arrows + backspace + actions
  const row1 = ['(', ')', '[', ']', '{', '}', '=', '+', '-', '*', '<', '>', '#', '%', '^', '~']
  const undoAction = () => {
    const view = editorViewRef.current
    if (!view) return
    import('@codemirror/commands').then(({ undo }) => { undo(view); view.focus() })
  }
  const redoAction = () => {
    const view = editorViewRef.current
    if (!view) return
    import('@codemirror/commands').then(({ redo }) => { redo(view); view.focus() })
  }

  const row2 = [
    { label: '←', action: 'ArrowLeft' },
    { label: '→', action: 'ArrowRight' },
    { label: '↑', action: 'ArrowUp' },
    { label: '↓', action: 'ArrowDown' },
    { label: '↩', action: undoAction },
    { label: '↪', action: redoAction },
    { label: 'RST', action: () => onResetCode() },
  ]

  return (
    <div className="sm:hidden shrink-0 bg-[#21252b] border-t border-gray-700/50 px-1 py-1 space-y-1">
      {/* Symbol row — horizontal scroll */}
      <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ touchAction: 'pan-x' }}>
        {row1.map(k => (
          <button key={k} onPointerDown={e => { e.preventDefault(); press(k) }}
            style={{ touchAction: 'manipulation', minWidth: 32 }}
            className={`${btnCls} h-8 px-2 text-xs shrink-0`}>
            {k}
          </button>
        ))}
      </div>
      {/* Nav row */}
      <div className="flex gap-1">
        {row2.map(({ label, action }) => (
          <button key={label} onPointerDown={e => { e.preventDefault(); press(action) }}
            style={{ touchAction: 'manipulation' }}
            className={`${btnCls} flex-1 h-9 text-sm ${label === '⌫' ? 'bg-[#3a2a2a] active:bg-[#5a3a3a] text-red-300' : ''}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Inline session form ─────────────────────────────────── */
function SessionPanel({ onSave, onClose }: { onSave: (s: string, c: string) => void; onClose: () => void }) {
  const [s, setS] = useState('')
  const [showS, setShowS] = useState(false)

  const isCookieJar = /LEETCODE_SESSION\s*=/.test(s) && s.includes(';')
  const canSave = s.trim().length > 10

  const handleSave = () => {
    if (!canSave) return
    const raw = s.trim()
    if (/LEETCODE_SESSION\s*=/.test(raw) && raw.includes(';')) {
      // Full cookie jar — pass as-is; extract csrftoken from it
      const csrf = getCookieFromHeader(raw, 'csrftoken')
      onSave(raw, csrf)
    } else {
      // Plain session value — normalize
      onSave(normalizeLcCookieValue(raw), '')
    }
  }

  return (
    <div className="bg-[#16213e] border-b border-gray-700/50 px-4 py-3 shrink-0 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5"><Key size={11} className="text-orange-400" /> Connect LeetCode Session</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        <strong className="text-orange-300">Best:</strong> leetcode.com → F12 → Network tab → click any request → Request Headers → copy the full <code className="bg-gray-800 px-1 rounded text-orange-300">Cookie</code> header value → paste below.
        <br />
        <span className="text-gray-500">(Includes cf_clearance needed for Run/Submit. Or paste just your LEETCODE_SESSION value.)</span>
      </p>
      {isCookieJar && (
        <p className="text-[10px] text-green-400 font-semibold">✓ Full cookie header detected — cf_clearance included</p>
      )}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            type={showS ? 'text' : 'password'}
            value={s}
            onChange={e => setS(e.target.value)}
            placeholder="Paste full Cookie header or LEETCODE_SESSION value"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-500 pr-7"
          />
          <button onClick={() => setShowS(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500">
            {showS ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{ touchAction: 'manipulation' }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition shrink-0"
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════ */
export default function LeetCodeEditor({ appQuestionId, slug, onAccepted, syncToApp = true, preferredLangs }: Props) {
  const lcSlug = resolveLeetCodeSlug(appQuestionId, slug)
  const onAcceptedRef = useRef(onAccepted)
  useEffect(() => { onAcceptedRef.current = onAccepted }, [onAccepted])

  /* Session */
  const [session,      setSession]      = useState('')
  const [csrf,         setCsrf]         = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const effectiveCsrf = csrf || getCookieFromHeader(session, 'csrftoken')
  const sessionOK = !!(session && effectiveCsrf)

  /* LeetCode question data */
  const [lcQ,     setLcQ]     = useState<LCQuestion | null>(null)
  const [lcLoad,  setLcLoad]  = useState(false)
  const [lcErr,   setLcErr]   = useState('')

  /* Editor */
  const [lang,        setLang]       = useState<SupportedLang>('python3')
  const [code,        setCode]       = useState('')
  const [retryKey,    setRetryKey]   = useState(0)
  const [extensions,  setExtensions] = useState<any[]>([])
  const [editorTheme, setTheme]      = useState<any>(null)
  const editorViewRef  = useRef<any>(null)
  const cursorPosRef   = useRef<{ from: number; to: number }>({ from: 0, to: 0 })

  /* Bottom panel */
  const [bottomTab,        setBottomTab]        = useState<'testcase' | 'result'>('testcase')
  const [showSolutionsModal, setShowSolutionsModal] = useState(false)
  const acSols = useAcceptedSolutions(lcSlug, showSolutionsModal)
  const [cases,      setCases]      = useState<TestCase[]>([])
  const [activeCase, setActiveCase] = useState(0)
  const [testInput,  setTestInput]  = useState('')
  const [running,    setRunning]    = useState(false)
  const [runMode,    setRunMode]    = useState<'test' | 'submit' | null>(null)
  const [runCooldownUntil, setRunCooldownUntil] = useState(0)
  const [pollMsg,    setPollMsg]    = useState('')
  const [result,     setResult]     = useState<LCResult | null>(null)
  const [resultErr,  setResultErr]  = useState('')
  const [solvedStatus, setSolvedStatus] = useState<'marked' | 'already' | 'not-in-library' | null>(null)
  const [showSessionHint, setShowSessionHint] = useState(false)
  const [localConnector, setLocalConnector] = useState<{ ok: boolean; authed: boolean } | null>(null)
  const [extBridgeOn, setExtBridgeOn] = useState(false)
  const availableLangs = useMemo<SupportedLang[]>(() => {
    const hinted = new Set((preferredLangs ?? []).filter((slug): slug is SupportedLang => SUPPORTED_LANGS.includes(slug)))
    const langs = (lcQ?.codeSnippets ?? [])
      .map(s => s.langSlug)
      .filter((slug): slug is SupportedLang => SUPPORTED_LANGS.includes(slug as SupportedLang))
    const found = new Set(langs)
    const unique = SUPPORTED_LANGS.filter(slug => hinted.has(slug) || found.has(slug))
    return unique.length ? unique : ['python3', 'cpp']
  }, [lcQ, preferredLangs])

  const fetchQuestionPayload = useCallback(async (body: object) => {
    const viaLcFetch = await lcFetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => null)

    const questionViaLcFetch = viaLcFetch?.data?.question
    if (!viaLcFetch?.errors && questionViaLcFetch) return viaLcFetch

    return fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json())
  }, [])

  /* ── My Solutions modal UX: ESC close + lock background scroll ── */
  useEffect(() => {
    if (!showSolutionsModal) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSolutionsModal(false)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [showSolutionsModal])

  /* ── Load session — localStorage first, Supabase fallback ── */
  useEffect(() => {
    // Detect local connector availability (best-effort).
    getLocalConnectorStatus().then(setLocalConnector).catch(() => setLocalConnector({ ok: false, authed: false }))
    // Detect extension bridge availability (best-effort).
    // MV3 service worker may be asleep; ping can take a moment to wake it.
    let cancelled = false
    ;(async () => {
      if (!hasLeetMasteryBridge()) { setExtBridgeOn(false); return }
      for (let i = 0; i < 3; i++) {
        try {
          const ok = await extBridgeHealthy()
          if (cancelled) return
          if (ok) { setExtBridgeOn(true); return }
        } catch {
          /* ignore */
        }
        await new Promise(r => setTimeout(r, 500 * (i + 1)))
      }
      if (!cancelled) setExtBridgeOn(false)
    })()

    const ls = normalizeLcCookieValue(localStorage.getItem('lc_session') ?? '')
    const lc = normalizeLcCookieValue(localStorage.getItem('lc_csrf') ?? '')
    const localDerivedCsrf = lc || getCookieFromHeader(ls, 'csrftoken')
    if (ls && localDerivedCsrf) {
      setSession(ls); setCsrf(localDerivedCsrf); setSessionReady(true)
      localStorage.setItem('lc_csrf', localDerivedCsrf)
    } else {
      // localStorage empty — fetch from Supabase and sync back
      fetch('/api/lc-session')
        .then(r => r.json())
        .then(d => {
          const s = normalizeLcCookieValue(d.lc_session)
          const t = normalizeLcCookieValue(d.lc_csrf) || getCookieFromHeader(s, 'csrftoken')
          if (s && t) {
            setSession(s); setCsrf(t)
            localStorage.setItem('lc_session', s)
            localStorage.setItem('lc_csrf', t)
          }
        })
        .catch(() => {})
        .finally(() => setSessionReady(true))
    }

    // Re-read localStorage whenever the user focuses this tab/window.
    // Covers the case where they saved their session on another page
    // (e.g. /leetcode-api) and navigated back via soft navigation —
    // the component stays mounted but needs the fresh session to retry.
    const onFocus = () => {
      const s = normalizeLcCookieValue(localStorage.getItem('lc_session') ?? '')
      const c = normalizeLcCookieValue(localStorage.getItem('lc_csrf') ?? '') || getCookieFromHeader(s, 'csrftoken')
      if (s && c) { setSession(s); setCsrf(c) }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    return () => { cancelled = true }
  }, [])

  /* ── Load CodeMirror extensions ── */
  useEffect(() => {
    async function loadExts() {
      const [{ python }, { cpp }, { javascript }, { oneDark }, viewMod, stateMod, cmdMod] = await Promise.all([
        import('@codemirror/lang-python'),
        import('@codemirror/lang-cpp'),
        import('@codemirror/lang-javascript'),
        import('@codemirror/theme-one-dark'),
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/commands'),
      ])
      setTheme(oneDark)
      const { keymap, EditorView } = viewMod
      const { Prec } = stateMod
      const { indentWithTab } = cmdMod
      const { indentationMarkers } = await import('@replit/codemirror-indentation-markers')
      // smartEnter preserves current line indentation and adds 4 spaces after : or {
      // Handles selections correctly (replaces from→to) so design questions
      // with multi-method starter code don't corrupt indentation on Enter.
      const smartEnter = (view: any) => {
        const { from, to } = view.state.selection.main
        const line = view.state.doc.lineAt(from)
        const base = line.text.match(/^(\s*)/)?.[1] ?? ''
        const extra = (line.text.trimEnd().endsWith(':') || line.text.trimEnd().endsWith('{')) ? '    ' : ''
        const ins = '\n' + base + extra
        // No scrollIntoView — prevents horizontal scroll jump on mobile
        view.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } })
        return true
      }
      const keys = Prec.highest(keymap.of([{ key: 'Enter', run: smartEnter }, indentWithTab]))
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
      // Track cursor on doc changes AND on user-repositioning (native tap/drag).
      // We suppress selection-only updates that arrive within 80ms of a docChanged
      // to avoid iOS silently repositioning the cursor after a paired-bracket insert
      // (which would corrupt the ref before the toolbar can read it).
      let lastDocChangeAt = 0
      const cursorTracker = EditorView.updateListener.of((update: any) => {
        if (update.docChanged) {
          lastDocChangeAt = Date.now()
          const sel = update.state.selection.main
          cursorPosRef.current = { from: sel.from, to: sel.to }
        } else if (update.selectionSet && Date.now() - lastDocChangeAt > 80) {
          // Native tap/drag moved the cursor without changing the document —
          // sync the ref so toolbar arrows and ⌫ operate from the right spot.
          const sel = update.state.selection.main
          cursorPosRef.current = { from: sel.from, to: sel.to }
        }
      })
      const languageExtension = lang === 'python3' ? python() : lang === 'cpp' ? cpp() : javascript()
      setExtensions([
        languageExtension,
        keys,
        indentationMarkers(),
        cursorTracker,
        ...(isMobile ? [EditorView.lineWrapping] : []),
      ])
    }
    loadExts()
  }, [lang])

  /* ── Fetch LeetCode question data ── */
  useEffect(() => {
    if (!lcSlug || !sessionReady) return
    setLcLoad(true); setLcErr('')

    const requestBody = {
      session, csrfToken: effectiveCsrf,
      query: `query($s:String!){question(titleSlug:$s){questionId questionFrontendId titleSlug isPaidOnly codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`,
      variables: { s: lcSlug },
    }

    fetchQuestionPayload(requestBody)
      .then(async json => {
        if (json.errors) throw new Error(json.errors[0]?.message)
        let q: (LCQuestion & { isPaidOnly?: boolean }) | null = json.data?.question ?? null

        // ── If session-based fetch returned null, retry without session ──────
        // This handles free questions where the stored session is corrupt/expired.
        // If the retry also returns null, the question genuinely requires auth (premium).
        if (!q && sessionOK) {
          try {
            const fallbackQuery = `query($s:String!){question(titleSlug:$s){questionId questionFrontendId titleSlug isPaidOnly codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`
            const fb = await fetchQuestionPayload({ query: fallbackQuery, variables: { s: lcSlug } })
            q = fb.data?.question ?? null
          } catch { /* ignore — show error below */ }
        }

        // ── If slug is stale in our app data, search by frontend id and retry ──
        if (!q && appQuestionId > 0) {
          try {
            const search = await fetchQuestionPayload({
              session,
              csrfToken: effectiveCsrf,
              query: SEARCH_BY_ID_Q,
              variables: { q: String(appQuestionId) },
            })
            const resolvedSlug = search?.data?.problemsetQuestionListV2?.questions?.[0]?.titleSlug
            if (resolvedSlug) {
              const retry = await fetchQuestionPayload({
                session,
                csrfToken: effectiveCsrf,
                query: `query($s:String!){question(titleSlug:$s){questionId questionFrontendId titleSlug isPaidOnly codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`,
                variables: { s: resolvedSlug },
              })
              q = retry?.data?.question ?? null
            }
          } catch { /* ignore — show error below */ }
        }

        if (!q) {
          // Both with-session and without-session returned null.
          // For free questions this usually means LeetCode's API is temporarily
          // blocking the proxy, not necessarily that the session is wrong.
          // Only blame the session if the user has NO session set at all.
          setLcErr(sessionOK ? 'load-failed' : 'no-session-general')
          return
        }
        // Premium question — differentiate between "no session" and "session expired"
        if (q.isPaidOnly && !q.codeSnippets?.length) {
          setLcErr(sessionOK ? 'premium-expired' : 'premium-no-session')
          return
        }
        setLcQ(q)
        const parsed = parseCases(q.exampleTestcases ?? '', q.metaData ?? '{}')
        setCases(parsed); setActiveCase(0); setTestInput(parsed[0]?.raw ?? '')
        // Always start fresh with LeetCode's starter code (normalised)
        const supportedSnippets = q.codeSnippets?.filter(s => SUPPORTED_LANGS.includes(s.langSlug as SupportedLang)) ?? []
        const nextLang: SupportedLang =
          supportedSnippets.find(s => s.langSlug === lang)?.langSlug as SupportedLang
          || (supportedSnippets[0]?.langSlug as SupportedLang | undefined)
          || 'python3'
        if (nextLang !== lang) setLang(nextLang)
        const raw = q.codeSnippets?.find(s => s.langSlug === nextLang)?.code ?? ''
        setCode(raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    '))
      })
      .catch(e => setLcErr(String(e)))
      .finally(() => setLcLoad(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lcSlug, retryKey, sessionReady, session, effectiveCsrf, fetchQuestionPayload])

  const handleCodeChange = (val: string) => setCode(val)

  // Normalize code from LeetCode: \r\n → \n, tabs → 4 spaces.
  // Design questions often have mixed line endings / tab indentation
  // which causes visual indentation mismatches in CodeMirror.
  const normalizeCode = (raw: string) =>
    raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ')

  const resetToStarter = useCallback(() => {
    if (!lcQ) return
    const raw = lcQ.codeSnippets?.find(s => s.langSlug === lang)?.code ?? ''
    const starter = normalizeCode(raw)
    setCode(starter)
    const view = editorViewRef.current
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: starter },
        selection: { anchor: 0 },
      })
      cursorPosRef.current = { from: 0, to: 0 }
      view.focus()
    }
    setResult(null)
    setResultErr('')
  }, [lcQ, lang])

  const switchLang = (l: SupportedLang) => {
    setLang(l)
    if (lcQ) setCode(normalizeCode(lcQ.codeSnippets?.find(s => s.langSlug === l)?.code ?? ''))
    setResult(null)
  }

  /* ── Poll for result ── */
  const poll = useCallback(async (checkId: string, mode: 'test' | 'submit') => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      setPollMsg(`Judging… ${i + 1}s`)
      let res!: Response
      let data: (LCResult & { error?: string }) | undefined
      for (let att = 0; att < 3; att++) {
        res = await lcFetch('/api/leetcode/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkId, titleSlug: lcSlug, session, csrfToken: csrf }),
        })
        const raw = await res.text()
        try {
          data = JSON.parse(raw) as LCResult & { error?: string }
          break
        } catch {
          if (att < 2) await new Promise(r => setTimeout(r, 400 * (att + 1)))
        }
      }
      if (data === undefined) {
        setResultErr('Run failed.')
        setRunning(false); setPollMsg(''); return
      }
      if (!res.ok && data.error) {
        setResultErr(String(data.status_msg || data.error))
        setRunning(false); setPollMsg(''); return
      }
      if (data.state !== 'PENDING' && data.state !== 'STARTED') {
        setResult(data); setRunning(false); setPollMsg(''); setBottomTab('result')

        /* Sync to app on Accepted Submit */
        if (mode === 'submit' && data.status_code === 10) {
          resetToStarter()
          if (!syncToApp) {
            setSolvedStatus('not-in-library')
            onAcceptedRef.current?.()
            return
          }
          void incrementAcSubmitCount(appQuestionId)
          const prog = await getProgress()
          const alreadySolved = Array.isArray(prog)
            ? prog.some((p: any) => p.question_id === appQuestionId && p.solved)
            : (prog as any)?.[String(appQuestionId)]?.solved
          if (alreadySolved) {
            setSolvedStatus('already')
          } else {
            try {
              const err = await updateProgress(appQuestionId, { solved: true })
              if (err) {
                toast.error(`Couldn’t mark as solved: ${err}`)
              } else {
                setSolvedStatus('marked')
              }
            } catch (e) {
              console.error('[LeetCodeEditor] updateProgress:', e)
              toast.error(`Couldn’t mark as solved: ${e instanceof Error ? e.message : String(e)}`)
            }
          }
          onAcceptedRef.current?.()
        }
        return
      }
    }
    setResultErr('Timed out.'); setRunning(false); setPollMsg('')
  }, [session, csrf, lcSlug, appQuestionId])

  /* ── Run test ── */
  const runTest = async () => {
    if (!lcQ || !sessionOK) return
    const now = Date.now()
    if (runCooldownUntil > now) return
    const syntaxErr = checkPythonSyntax(code, lang)
    if (syntaxErr) { setResultErr(syntaxErr); setBottomTab('result'); return }
    setRunning(true); setRunMode('test'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Sending…'); setBottomTab('result')
    try {
      const res = await lcFetch('/api/leetcode/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: lcSlug, questionId: lcQ.questionId, lang: LANG_LC[lang], code, testInput: cases[activeCase]?.raw || testInput, session, csrfToken: csrf }),
      })
      const retryAfterHeader = res.headers.get('Retry-After')
      const raw = await res.text()
      let data: { error?: string; interpret_id?: string }
      try {
        data = JSON.parse(raw) as { error?: string; interpret_id?: string }
      } catch {
        setResultErr('Run failed.')
        setRunning(false); setPollMsg(''); return
      }
      if (!res.ok && res.status === 429) {
        const retryAfterSec =
          (data as any)?.retryAfterSec
            ? Number((data as any).retryAfterSec)
            : retryAfterHeader
              ? Number(retryAfterHeader)
              : 30
        const until = Date.now() + Math.max(5, Number.isFinite(retryAfterSec) ? retryAfterSec : 30) * 1000
        setRunCooldownUntil(until)
      } else {
        // Always add a tiny debounce so accidental double-clicks don’t hammer LeetCode.
        setRunCooldownUntil(Date.now() + 1500)
      }
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      if (data.interpret_id == null) {
        setResultErr('LeetCode did not return a run id.')
        setRunning(false); setPollMsg(''); return
      }
      await poll(String(data.interpret_id), 'test')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  /* ── Submit ── */
  const runSubmit = async () => {
    if (!lcQ || !sessionOK) return
    const syntaxErr = checkPythonSyntax(code, lang)
    if (syntaxErr) { setResultErr(syntaxErr); setBottomTab('result'); return }
    setRunning(true); setRunMode('submit'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Submitting…'); setBottomTab('result')
    try {
      const res = await lcFetch('/api/leetcode/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: lcSlug, questionId: lcQ.questionId, lang: LANG_LC[lang], code, session, csrfToken: csrf }),
      })
      const raw = await res.text()
      let data: { error?: string; submission_id?: string }
      try {
        data = JSON.parse(raw) as { error?: string; submission_id?: string }
      } catch {
        setResultErr('Submit failed.')
        setRunning(false); setPollMsg(''); return
      }
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      if (data.submission_id == null) {
        setResultErr('LeetCode did not return a submission id.')
        setRunning(false); setPollMsg(''); return
      }
      await poll(String(data.submission_id), 'submit')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  const isAC = result?.status_code === 10

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    <div className="relative flex flex-col overflow-x-hidden rounded-none sm:rounded-xl border-0 sm:border border-gray-700/50 bg-[#1a1a2e] flex-1 min-h-0 w-full">
      <style>{`
        /* Responsive CodeMirror font sizing (phone → desktop) */
        .cm-editor { font-size: clamp(8.5px, 2.2vw, 12px); line-height: 1.45; }
        /* Indentation markers: slightly higher contrast on dark theme */
        .cm-editor {
          --indent-marker-bg-color: rgba(120, 140, 190, 0.35);
          --indent-marker-active-bg-color: rgba(150, 175, 255, 0.55);
        }
        .cm-scroller { overflow-x: auto !important; overflow-y: auto !important; overscroll-behavior: contain; touch-action: pan-x pan-y; }
        .cm-content, .cm-line { word-break: normal; white-space: pre; }
        .cm-editor { touch-action: none; }
        .cm-editor, .cm-content { max-width: 100%; }
        @media (max-width: 639px) {
          .cm-editor { font-size: 8.5px; }
          .cm-scroller { overflow-x: hidden !important; }
          .cm-content, .cm-line { white-space: pre-wrap; word-break: break-all; }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="relative z-10 bg-[#16213e] border-b border-gray-700/50 shrink-0">
        {/* Row 1: language picker + session warning */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Language picker */}
          <div className="flex gap-1 shrink-0">
            {availableLangs.map(l => (
              <button key={l} onClick={() => switchLang(l)}
                style={{ touchAction: 'manipulation' }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>

          <div className="flex-1" />


          {/* Session button — always visible so session can be updated any time */}
          <button onClick={() => setShowSessionHint(h => !h)}
            style={{ touchAction: 'manipulation' }}
            className={`flex items-center gap-1 text-xs transition shrink-0 ${sessionOK ? 'text-gray-500 hover:text-gray-300' : 'text-orange-400 hover:text-orange-300'}`}>
            <Key size={11} />
            <span className="hidden sm:inline">{sessionOK ? 'Session' : 'Setup session'}</span>
            <span className="sm:hidden text-[10px]">Session</span>
            {showSessionHint ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {/* Run + Submit + Reset — desktop only (inline in toolbar) */}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={resetToStarter}
              disabled={running}
              title="Reset to starter code"
              style={{ touchAction: 'manipulation' }}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 active:bg-gray-700 disabled:opacity-40">
              <RotateCcw size={12} />
              Reset
            </button>
            <button onClick={!sessionOK ? () => setShowSessionHint(true) : runTest}
              disabled={running || (!sessionOK && false) || (sessionOK && !lcQ)}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-4 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 ${!sessionOK ? 'bg-orange-600/80 text-white hover:bg-orange-500' : 'bg-gray-700 text-gray-200 hover:bg-gray-600 active:bg-gray-500'} disabled:opacity-40`}>
              {running && runMode === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </button>
            <button onClick={!sessionOK ? () => setShowSessionHint(true) : runSubmit}
              disabled={running || (sessionOK && !lcQ)}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-4 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 ${!sessionOK ? 'bg-orange-600/80 text-white hover:bg-orange-500' : 'bg-green-600 text-white hover:bg-green-500 active:bg-green-400'} disabled:opacity-40`}>
              {running && runMode === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit
            </button>
          </div>
        </div>

        {/* Row 2: Run + Submit — mobile only, full-width row */}
        <div className="flex sm:hidden gap-2 px-3 pb-2">
          <button onClick={!sessionOK ? () => setShowSessionHint(true) : runTest}
            disabled={running || (sessionOK && !lcQ)}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-40 ${!sessionOK ? 'bg-orange-600/80 text-white active:bg-orange-500' : 'bg-gray-700 text-gray-200 active:bg-gray-500'}`}>
            {running && runMode === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>
          <button onClick={!sessionOK ? () => setShowSessionHint(true) : runSubmit}
            disabled={running || (sessionOK && !lcQ)}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-40 ${!sessionOK ? 'bg-orange-600/80 text-white active:bg-orange-500' : 'bg-green-600 text-white active:bg-green-400'}`}>
            {running && runMode === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Submit
          </button>
        </div>
      </div>

      {/* Session panel — inline form so users can enter session without leaving the page */}
      {showSessionHint && (
        <SessionPanel
          onSave={(s, c) => {
            setSession(s); setCsrf(c)
            localStorage.setItem('lc_session', s)
            localStorage.setItem('lc_csrf', c)
            fetch('/api/lc-session', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lc_session: s, lc_csrf: c }),
            }).catch(() => {})
            setShowSessionHint(false)
            setLcErr('')
            setRetryKey(k => k + 1)
          }}
          onClose={() => setShowSessionHint(false)}
        />
      )}

      {/* ── Editor loading state ── */}
      {lcLoad && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        </div>
      )}
      {lcErr && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          {lcErr === 'premium-expired' ? (
            <div className="space-y-3">
              <div className="text-2xl">⚠️</div>
              <p className="text-sm text-gray-200 font-semibold">Session token may have expired</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Your LeetCode session is saved but this premium question couldn't load.
                Your token may have expired — go to LeetCode, copy a fresh
                <code className="mx-1 px-1 py-0.5 bg-gray-800 rounded text-orange-300">LEETCODE_SESSION</code>
                and update it on the LeetCode page.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => { setLcErr(''); setRetryKey(k => k + 1) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition"
                >
                  Retry
                </button>
                <a
                  href={leetCodeUrl(lcSlug)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                >
                  Open on LeetCode ↗
                </a>
              </div>
            </div>
          ) : lcErr === 'premium-no-session' ? (
            <div className="space-y-3">
              <div className="text-2xl">🔒</div>
              <p className="text-sm text-gray-200 font-semibold">LeetCode Premium question</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Add your LeetCode session token using the
                <span className="text-orange-300 font-semibold mx-1">Setup session</span>
                button above, then retry.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => { setLcErr(''); setRetryKey(k => k + 1) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition"
                >
                  Retry
                </button>
                <a
                  href={leetCodeUrl(lcSlug)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                >
                  Open on LeetCode ↗
                </a>
              </div>
            </div>
          ) : lcErr === 'load-failed' ? (
            <div className="space-y-3">
              <div className="text-2xl">⚡</div>
              <p className="text-sm text-gray-200 font-semibold">Couldn&apos;t reach LeetCode</p>
              <p className="text-xs text-gray-400 max-w-xs">
                LeetCode&apos;s API didn&apos;t return data. This can happen when the session
                is expired or their servers are being slow. Use the{' '}
                <button onClick={() => setShowSessionHint(h => !h)} className="text-orange-300 underline">Session</button>
                {' '}button above to refresh your credentials, then retry.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => { setLcErr(''); setRetryKey(k => k + 1) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition"
                >
                  Retry
                </button>
                <a
                  href={leetCodeUrl(lcSlug)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                >
                  Open on LeetCode ↗
                </a>
              </div>
            </div>
          ) : lcErr === 'no-session-general' ? (
            <div className="space-y-3">
              <div className="text-2xl">🔗</div>
              <p className="text-sm text-gray-200 font-semibold">Could not load question</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Connect your LeetCode account using the
                <span className="text-orange-300 font-semibold mx-1">Setup session</span>
                button above, then retry.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => { setLcErr(''); setRetryKey(k => k + 1) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition"
                >
                  Retry
                </button>
                <a
                  href={leetCodeUrl(lcSlug)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                >
                  Open on LeetCode ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-xs text-red-400">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="shrink-0" /> Could not load question: {lcErr}
              </div>
              <button
                onClick={() => { setLcErr(''); setRetryKey(k => k + 1) }}
                className="mt-1 px-3 py-1.5 bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-600 transition"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CodeMirror ── */}
      {!lcLoad && !lcErr && (
        <div className="flex-1 overflow-hidden min-h-0 w-full">
          <CodeMirror
            value={code}
            onChange={handleCodeChange}
            onCreateEditor={(view) => { editorViewRef.current = view }}
            height="100%"
            theme={editorTheme ?? 'dark'}
            extensions={extensions}
            basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, autocompletion: true, indentOnInput: true }}
            style={{ height: '100%', maxWidth: '100%', overflowX: 'hidden' }}
          />
        </div>
      )}

      {/* ── Mobile keyboard toolbar — sm:hidden ── */}
      {!lcLoad && !lcErr && (
        <MobileKeybar
          editorViewRef={editorViewRef}
          cursorPosRef={cursorPosRef}
          onResetCode={resetToStarter}
        />
      )}

      {/* ── Bottom panel ── */}
      <div className="h-44 sm:h-52 border-t border-gray-700/50 flex flex-col bg-[#16213e] shrink-0">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-700/50 shrink-0 overflow-x-auto scrollbar-none">
          {(['testcase', 'result', 'solutions'] as const).map(tab => {
            const isActive =
              (tab === 'solutions' && showSolutionsModal) ||
              (tab !== 'solutions' && bottomTab === tab)
            const baseCls = isActive
              ? (tab === 'solutions'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-indigo-400 border-b-2 border-indigo-400')
              : 'text-gray-500 hover:text-gray-300'
            return (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'solutions') {
                    setShowSolutionsModal(true)
                  } else {
                    setBottomTab(tab)
                  }
                }}
                className={`px-3 sm:px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition ${baseCls}`}
              >
                {tab === 'testcase' ? 'Testcase' : tab === 'result' ? 'Test Result' : '🏆 My Solutions'}
              </button>
            )
          })}
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
              {resultErr && (
                <div className="space-y-2">
                  <p className="text-red-400 flex items-start gap-1.5">
                    <XCircle size={12} className="shrink-0 mt-0.5" />
                    <span className="min-w-0 break-words">{resultErr}</span>
                  </p>
                  {/* Session-expired shortcut — one tap to open the fix panel */}
                  {(resultErr.includes('403') || resultErr.toLowerCase().includes('session') || resultErr.toLowerCase().includes('not authenticated')) && (
                    <button
                      onClick={() => { setShowSessionHint(true) }}
                      style={{ touchAction: 'manipulation' }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-500 active:bg-orange-700 transition"
                    >
                      <Key size={11} /> Fix Session →
                    </button>
                  )}
                </div>
              )}
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

      {/* ── My Solutions modal ── */}
      {showSolutionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close My Solutions"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSolutionsModal(false)}
          />
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-3xl max-h-[80vh] rounded-2xl border border-emerald-500/40 bg-[#0b1020] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80 shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                <Trophy size={14} className="text-emerald-400" />
                Last 3 Accepted — My Solutions
              </div>
              <button
                type="button"
                onClick={() => setShowSolutionsModal(false)}
                className="text-xs text-gray-400 hover:text-gray-100"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              <AcceptedSolutions
                surface="dark"
                submissions={acSols.submissions}
                loading={acSols.subsLoading}
                selectedSub={acSols.selectedSub}
                subCodeLoading={acSols.subCodeLoading}
                copied={acSols.copiedSub}
                onSelect={acSols.loadSubCode}
                onCopy={acSols.copyCode}
                onBack={acSols.clearSub}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

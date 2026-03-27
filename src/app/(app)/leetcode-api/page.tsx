'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Search, Trophy, CheckCircle, XCircle, Loader2, User,
  Play, Send, Key, Eye, EyeOff, ChevronDown, ChevronUp,
  AlertCircle, Clock, Cpu, Info, Calendar, ExternalLink,
  Tag, ChevronRight, Star,
} from 'lucide-react'
import { getProgress, updateProgress } from '@/lib/db'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })


/* ─── Types ─────────────────────────────────────────────── */
interface DailyChallenge {
  date: string; link: string
  question: { questionId: string; title: string; titleSlug: string; difficulty: string; topicTags: { name: string }[] }
}
interface AcStat { difficulty: string; count: number }
interface UserProfile {
  username: string
  profile: { realName: string; ranking: number; userAvatar: string }
  submitStatsGlobal: { acSubmissionNum: AcStat[] }
}
interface QuestionDetail {
  questionId: string; questionFrontendId: string; title: string; titleSlug: string
  difficulty: string; content: string; topicTags: { name: string }[]
  codeSnippets: { lang: string; langSlug: string; code: string }[]
  exampleTestcases: string; sampleTestCase: string; metaData: string
}
interface LCResult {
  state: string
  status_code?: number
  status_msg?: string
  run_success?: boolean
  correct_answer?: boolean
  total_correct?: number
  total_testcases?: number
  runtime_percentile?: number
  memory_percentile?: number
  status_runtime?: string
  status_memory?: string
  code_answer?: string[]
  code_output?: string[]
  expected_code_answer?: string[]
  std_output_list?: string[]
  last_testcase?: string
  compare_result?: string
  full_compile_error?: string
  full_runtime_error?: string
}

/* ─── GraphQL ────────────────────────────────────────────── */
const DAILY_Q = `query { activeDailyCodingChallengeQuestion { date link question { questionId title titleSlug difficulty topicTags { name } } } }`
const USER_Q  = `query($u:String!){matchedUser(username:$u){username profile{realName ranking userAvatar}submitStatsGlobal{acSubmissionNum{difficulty count}}}}`
const QUEST_Q = `query($s:String!){question(titleSlug:$s){questionId questionFrontendId title titleSlug difficulty content topicTags{name} codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`
const SEARCH_Q = `query($q:String!){problemsetQuestionListV2(categorySlug:"",limit:1,skip:0,searchKeyword:$q,filters:{filterCombineType:ALL}){questions{titleSlug title}}}`

async function gql(query: string, variables?: Record<string, unknown>, creds?: { session: string; csrfToken: string }) {
  const res = await fetch('/api/leetcode', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables, ...(creds ?? {}) }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

function parseSlug(input: string) {
  const m = input.match(/problems\/([^/?#]+)/)
  return m ? m[1] : input.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Split exampleTestcases into individual cases using metaData param count */
interface TestCase { params: { name: string; value: string }[]; raw: string }

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
      // Skip if all lines are empty (trailing newline)
      if (slice.every(l => l.trim() === '')) continue
      cases.push({
        params: params.map((p, j) => ({ name: p.name, value: slice[j] ?? '' })),
        raw: slice.join('\n'),
      })
    }
    return cases.length ? cases : [{ params: [], raw: exampleTestcases }]
  } catch {
    return [{ params: [], raw: exampleTestcases }]
  }
}

/* ─── Constants ──────────────────────────────────────────── */
const LANG_LABEL: Record<string, string> = { python3: 'Python 3', cpp: 'C++' }
const LC_LANG:    Record<string, string> = { python3: 'python3',  cpp: 'cpp'  }
const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-500',
  Medium: 'text-yellow-500',
  Hard:   'text-red-500',
}
const STATUS_CLS: Record<number, string> = {
  10: 'text-green-500', 11: 'text-red-500', 12: 'text-red-500',
  13: 'text-red-500',   14: 'text-orange-500', 15: 'text-red-500', 20: 'text-red-500',
}

/* ══════════════════════════════════════════════════════════ */
export default function LeetCodePage() {
  /* Session */
  const [session,    setSession]    = useState('')
  const [csrfToken,  setCsrfToken]  = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [sessionPanelOpen, setSPO]  = useState(false)
  const sessionOK = !!(session && csrfToken)

  /* Question state */
  const [slugInput, setSlugInput]   = useState('')
  const [question,  setQuestion]    = useState<QuestionDetail | null>(null)
  const [qLoad,     setQL]          = useState(false)
  const [qErr,      setQE]          = useState('')

  /* Editor */
  const [lang, setLang]             = useState<'python3' | 'cpp'>('python3')
  const [code, setCode]             = useState('')
  const [extensions, setExtensions] = useState<any[]>([])
  const [editorTheme, setEditorTheme] = useState<any>(null)

  /* Bottom panel */
  const [bottomTab,  setBottomTab]  = useState<'testcase' | 'result'>('testcase')
  const [testInput,  setTestInput]  = useState('')
  const [cases,      setCases]      = useState<TestCase[]>([])
  const [activeCase, setActiveCase] = useState(0)
  const [running,    setRunning]    = useState(false)
  const [runMode,    setRunMode]    = useState<'test' | 'submit' | null>(null)
  const [pollMsg,    setPollMsg]    = useState('')
  const [result,     setResult]     = useState<LCResult | null>(null)
  const [solvedStatus, setSolvedStatus] = useState<'marked' | 'already' | 'not-in-library' | null>(null)

  /* App question list — loaded once to match solved-sync */
  const [appQuestions, setAppQuestions] = useState<{ id: number; slug: string }[]>([])
  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((qs: { id: number; slug: string }[]) => setAppQuestions(qs))
      .catch(() => {})
  }, [])
  const [resultErr,  setResultErr]  = useState('')

  /* Left panel tab */
  const [leftTab, setLeftTab]       = useState<'description' | 'profile'>('description')

  /* Mobile panel toggle */
  const [mobilePanel, setMobilePanel] = useState<'desc' | 'code'>('desc')

  /* Daily */
  const [daily,     setDaily]       = useState<DailyChallenge | null>(null)
  const [dailyLoad, setDL]          = useState(false)

  /* Profile */
  const [username,  setUsername]    = useState('')
  const [profile,   setProfile]     = useState<UserProfile | null>(null)
  const [profileLoad, setPL]        = useState(false)
  const [profileErr, setPE]         = useState('')

  /* Load session — Supabase first, localStorage as fallback */
  useEffect(() => {
    async function loadCreds() {
      // Try Supabase first
      try {
        const res = await fetch('/api/lc-session')
        if (res.ok) {
          const data = await res.json()
          if (data.lc_session && data.lc_csrf) {
            setSession(data.lc_session)
            setCsrfToken(data.lc_csrf)
            // Also keep localStorage in sync
            localStorage.setItem('lc_session', data.lc_session)
            localStorage.setItem('lc_csrf', data.lc_csrf)
            setSPO(false)
            fetchDailyInternal({ session: data.lc_session, csrfToken: data.lc_csrf })
            return
          }
        }
      } catch { /* fall through to localStorage */ }

      // Fallback: localStorage
      const s = localStorage.getItem('lc_session') ?? ''
      const c = localStorage.getItem('lc_csrf')   ?? ''
      setSession(s); setCsrfToken(c)
      if (!s || !c) setSPO(true)
      fetchDailyInternal(s && c ? { session: s, csrfToken: c } : undefined)
    }
    loadCreds()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Load CodeMirror extensions (lang-aware) ── */
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
      setEditorTheme(oneDark)
      const { keymap } = viewMod
      const { Prec } = stateMod
      const { indentWithTab } = cmdMod
      const { indentationMarkers } = await import('@replit/codemirror-indentation-markers')
      const smartEnter = (view: any) => {
        const { from } = view.state.selection.main
        const line = view.state.doc.lineAt(from)
        const baseIndent = line.text.match(/^(\s*)/)?.[1] ?? ''
        const extra = (line.text.trimEnd().endsWith(':') || line.text.trimEnd().endsWith('{')) ? '    ' : ''
        const ins = '\n' + baseIndent + extra
        view.dispatch({ changes: { from, to: from, insert: ins }, selection: { anchor: from + ins.length } })
        return true
      }
      const smartKeys = Prec.highest(keymap.of([{ key: 'Enter', run: smartEnter }, indentWithTab]))
      setExtensions([lang === 'python3' ? python() : cpp(), smartKeys, indentationMarkers()])
    }
    loadExts()
  }, [lang])

  const saveSession = async () => {
    const s = session.trim()
    const c = csrfToken.trim()
    // Save to localStorage immediately
    localStorage.setItem('lc_session', s)
    localStorage.setItem('lc_csrf',    c)
    setSPO(false)
    // Also persist to Supabase so it survives browser clears + works on any device
    try {
      await fetch('/api/lc-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lc_session: s, lc_csrf: c }),
      })
    } catch { /* silent — localStorage still has it */ }
  }
  const clearSession = async () => {
    localStorage.removeItem('lc_session'); localStorage.removeItem('lc_csrf')
    setSession(''); setCsrfToken(''); setSPO(true)
    try {
      await fetch('/api/lc-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lc_session: '', lc_csrf: '' }),
      })
    } catch { /* silent */ }
  }

  /* ── Fetch daily ── */
  const fetchDailyInternal = async (creds?: { session: string; csrfToken: string }) => {
    setDL(true)
    try {
      const d = await gql(DAILY_Q, undefined, creds)
      setDaily(d.activeDailyCodingChallengeQuestion)
    } catch { /* silent */ }
    finally { setDL(false) }
  }

  /* ── Load question ── */
  const loadQuestion = useCallback(async (overrideSlug?: string) => {
    const slug = overrideSlug ?? parseSlug(slugInput)
    if (!slug) return
    setQL(true); setQE(''); setQuestion(null); setResult(null); setResultErr(''); setLeftTab('description')
    try {
      const creds = session && csrfToken ? { session, csrfToken } : undefined
      let resolvedSlug = slug
      let data = await gql(QUEST_Q, { s: resolvedSlug }, creds)
      // If not found by slug, try keyword search (requires session)
      if (!data.question && creds) {
        const keyword = slugInput.trim()
        const searchData = await gql(SEARCH_Q, { q: keyword }, creds)
        const first = searchData?.problemsetQuestionListV2?.questions?.[0]
        if (first?.titleSlug) {
          resolvedSlug = first.titleSlug
          data = await gql(QUEST_Q, { s: resolvedSlug }, creds)
        }
      }
      if (!data.question) throw new Error('Question not found — try pasting the full LeetCode URL')
      const q: QuestionDetail = data.question
      setQuestion(q)
      const parsed = parseCases(q.exampleTestcases, q.metaData)
      setCases(parsed)
      setActiveCase(0)
      setTestInput(parsed[0]?.raw ?? q.sampleTestCase ?? '')
      setCode(q.codeSnippets.find(s => s.langSlug === lang)?.code ?? '')
    } catch (e) { setQE(String(e)) }
    finally { setQL(false) }
  }, [slugInput, lang, session, csrfToken])

  const switchLang = (l: 'python3' | 'cpp') => {
    setLang(l)
    if (question) setCode(question.codeSnippets.find(s => s.langSlug === l)?.code ?? '')
    setResult(null)
  }

  /* ── Poll ── */
  const poll = useCallback(async (checkId: string, slug: string, mode: 'test' | 'submit') => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      setPollMsg(`Judging… ${i + 1}s`)
      const res = await fetch('/api/leetcode/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId, titleSlug: slug, session, csrfToken }),
      })
      const data: LCResult = await res.json()
      if (data.state !== 'PENDING' && data.state !== 'STARTED') {
        setResult(data); setRunning(false); setPollMsg(''); setBottomTab('result')

        /* ── Sync to app if Accepted on a Submit ── */
        if (mode === 'submit' && data.status_code === 10 && question) {
          const qFrontendId = parseInt(question.questionFrontendId)
          const match = appQuestions.find(q => q.id === qFrontendId || q.slug === question.titleSlug)
          if (!match) {
            setSolvedStatus('not-in-library')
          } else {
            const prog = await getProgress()
            const alreadySolved = Array.isArray(prog)
              ? prog.some((p: any) => p.question_id === match.id && p.solved)
              : (prog as any)?.[String(match.id)]?.solved
            if (alreadySolved) {
              setSolvedStatus('already')
            } else {
              await updateProgress(match.id, { solved: true })
              setSolvedStatus('marked')
            }
          }
        }
        return
      }
    }
    setResultErr('Timed out.'); setRunning(false); setPollMsg('')
  }, [session, csrfToken, question, appQuestions])

  /* ── Run test ── */
  const runTest = async () => {
    if (!question || !sessionOK) return
    setRunning(true); setRunMode('test'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Sending…'); setBottomTab('result')
    try {
      const res = await fetch('/api/leetcode/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: question.titleSlug, questionId: question.questionId, lang: LC_LANG[lang], code, testInput: cases[activeCase]?.raw || testInput || question.sampleTestCase, session, csrfToken }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await poll(data.interpret_id, question.titleSlug, 'test')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  /* ── Submit ── */
  const runSubmit = async () => {
    if (!question || !sessionOK) return
    setRunning(true); setRunMode('submit'); setResult(null); setResultErr(''); setSolvedStatus(null); setPollMsg('Submitting…'); setBottomTab('result')
    try {
      const res = await fetch('/api/leetcode/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSlug: question.titleSlug, questionId: question.questionId, lang: LC_LANG[lang], code, session, csrfToken }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await poll(data.submission_id, question.titleSlug, 'submit')
    } catch (e) { setResultErr(String(e)); setRunning(false); setPollMsg('') }
  }

  /* ── Profile ── */
  const fetchProfile = async () => {
    if (!username.trim()) return
    setPL(true); setPE(''); setProfile(null)
    try {
      const data = await gql(USER_Q, { u: username.trim() })
      if (!data.matchedUser) throw new Error('Not found')
      setProfile(data.matchedUser)
    } catch (e) { setPE(String(e)) }
    finally { setPL(false) }
  }

  const acStats = profile?.submitStatsGlobal.acSubmissionNum ?? []
  const isAC = result?.status_code === 10

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#1a1a2e] text-gray-100 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#16213e] border-b border-gray-700/50 shrink-0">
        {/* Daily pill */}
        {daily && !qLoad && (
          <button onClick={() => { setSlugInput(daily.question.titleSlug); loadQuestion(daily.question.titleSlug) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/30 transition shrink-0 border border-orange-500/30">
            <Calendar size={11} /> Daily
          </button>
        )}

        {/* Search */}
        <div className="flex flex-1 gap-1.5 items-center bg-gray-800/60 rounded-lg px-3 py-1.5 border border-gray-700/50">
          <Search size={12} className="text-gray-500 shrink-0" />
          <input
            type="text" value={slugInput} onChange={e => setSlugInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadQuestion()}
            placeholder="Paste LeetCode URL or slug — e.g.  two-sum"
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none min-w-0"
          />
          <button onClick={() => loadQuestion()} disabled={qLoad || !slugInput.trim()}
            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-500 disabled:opacity-40 transition shrink-0">
            {qLoad ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />}
            Load
          </button>
        </div>

        {/* Session badge */}
        <button onClick={() => setSPO(o => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shrink-0 ${sessionOK ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}>
          <Key size={11} />
          {sessionOK ? 'Connected' : 'Setup'}
        </button>
      </div>

      {/* ── Session panel overlay ─────────────────────────── */}
      {sessionPanelOpen && (
        <div className="absolute top-[96px] right-0 sm:right-3 z-50 w-full sm:w-80 bg-[#16213e] border border-gray-700 sm:rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-200">LeetCode Session</p>
            <button onClick={() => setSPO(false)} className="text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
          </div>
          <div className="flex gap-1.5 bg-blue-500/10 rounded-xl p-3 text-xs text-blue-300 border border-blue-500/20">
            <Info size={12} className="shrink-0 mt-0.5 text-blue-400" />
            <div className="space-y-1">
              <p>Go to <strong>leetcode.com</strong> → DevTools → Application → Cookies</p>
              <p>Copy <code className="bg-blue-900/50 px-1 rounded">LEETCODE_SESSION</code> and <code className="bg-blue-900/50 px-1 rounded">csrftoken</code></p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-gray-400 font-medium">LEETCODE_SESSION</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={session} onChange={e => setSession(e.target.value)}
                placeholder="Paste cookie value…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500 pr-8" />
              <button onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
                {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <label className="block text-xs text-gray-400 font-medium">csrftoken</label>
            <input type="password" value={csrfToken} onChange={e => setCsrfToken(e.target.value)}
              placeholder="Paste cookie value…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveSession} disabled={!session.trim() || !csrfToken.trim()}
              className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition">
              Save Session
            </button>
            {sessionOK && (
              <button onClick={clearSession} className="px-3 py-2 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────── */}
      {qErr && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border-b border-red-700/30 text-red-400 text-xs shrink-0">
          <XCircle size={12} /> {qErr}
        </div>
      )}

      {/* ── Main area ────────────────────────────────────── */}
      {!question && !qLoad ? (
        /* Welcome state */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          {daily && (
            <div className="w-full max-w-sm bg-[#16213e] rounded-2xl border border-gray-700/50 p-4">
              <p className="text-xs text-orange-400 font-semibold mb-2 flex items-center gap-1.5">
                <Calendar size={11} /> Today&apos;s Daily Challenge — {daily.date}
              </p>
              <p className="font-bold text-gray-100 text-sm mb-2">{daily.question.questionId}. {daily.question.title}</p>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs font-semibold ${DIFF_CLS[daily.question.difficulty]}`}>{daily.question.difficulty}</span>
                {daily.question.topicTags.slice(0, 3).map(t => (
                  <span key={t.name} className="text-xs text-gray-500 flex items-center gap-0.5"><Tag size={9} /> {t.name}</span>
                ))}
              </div>
              <button onClick={() => loadQuestion(daily.question.titleSlug)}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 transition flex items-center justify-center gap-1.5">
                <Play size={12} /> Solve Daily Challenge
              </button>
            </div>
          )}
          <p className="text-gray-600 text-sm">or paste any LeetCode URL in the search bar above</p>
        </div>
      ) : qLoad ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
      ) : question && (
        /* ── Split layout ── */
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">

          {/* Mobile tab switcher */}
          <div className="sm:hidden flex border-b border-gray-700/50 bg-[#16213e] shrink-0">
            {(['desc', 'code'] as const).map(p => (
              <button key={p} onClick={() => setMobilePanel(p)}
                className={`flex-1 py-2 text-xs font-semibold transition ${mobilePanel === p ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'}`}>
                {p === 'desc' ? 'Description' : 'Code'}
              </button>
            ))}
          </div>

          {/* LEFT PANEL — Description */}
          <div className={`${mobilePanel === 'desc' ? 'flex' : 'hidden'} sm:flex w-full sm:w-[42%] flex-col border-r border-gray-700/50 overflow-hidden`}>
            {/* Left tabs */}
            <div className="flex border-b border-gray-700/50 shrink-0 bg-[#16213e]">
              {(['description', 'profile'] as const).map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  className={`px-4 py-2.5 text-xs font-semibold capitalize transition ${leftTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {tab === 'profile' ? 'Profile' : 'Description'}
                </button>
              ))}
            </div>

            {leftTab === 'description' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Title */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h1 className="text-base font-bold text-gray-100">
                      {question.questionFrontendId}. {question.title}
                    </h1>
                    <a href={`https://leetcode.com/problems/${question.titleSlug}/`}
                      target="_blank" rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition mt-0.5">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <span className={`text-xs font-bold ${DIFF_CLS[question.difficulty]}`}>{question.difficulty}</span>
                  {question.topicTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {question.topicTags.map(t => (
                        <span key={t.name} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description HTML */}
                <div
                  className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none
                    prose-pre:bg-gray-800 prose-pre:text-green-300 prose-code:bg-gray-800 prose-code:text-orange-300
                    prose-code:px-1 prose-code:rounded prose-strong:text-gray-100"
                  dangerouslySetInnerHTML={{ __html: question.content }}
                />
              </div>
            )}

            {leftTab === 'profile' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchProfile()}
                    placeholder="LeetCode username…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
                  <button onClick={fetchProfile} disabled={profileLoad || !username.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition">
                    {profileLoad ? <Loader2 size={13} className="animate-spin" /> : <User size={13} />}
                  </button>
                </div>
                {profileErr && <p className="text-xs text-red-400">{profileErr}</p>}
                {profile && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                      {profile.profile.userAvatar && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.profile.userAvatar} alt="" className="w-10 h-10 rounded-full" />
                      )}
                      <div>
                        <p className="font-bold text-gray-100 text-sm">{profile.profile.realName || profile.username}</p>
                        <p className="text-xs text-gray-500">@{profile.username}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1 text-xs text-yellow-400 font-bold">
                        <Trophy size={12} /> #{profile.profile.ranking.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: 'Total AC', v: acStats.find(s => s.difficulty === 'All')?.count  ?? 0, c: 'text-gray-100' },
                        { l: 'Easy',     v: acStats.find(s => s.difficulty === 'Easy')?.count  ?? 0, c: 'text-green-400' },
                        { l: 'Medium',   v: acStats.find(s => s.difficulty === 'Medium')?.count ?? 0, c: 'text-yellow-400' },
                        { l: 'Hard',     v: acStats.find(s => s.difficulty === 'Hard')?.count  ?? 0, c: 'text-red-400' },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="bg-gray-800/50 rounded-xl p-3 text-center">
                          <p className={`text-xl font-black ${c}`}>{v}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Editor + Bottom */}
          <div className={`${mobilePanel === 'code' ? 'flex' : 'hidden'} sm:flex flex-1 flex-col overflow-hidden`}>

            {/* Editor toolbar */}
            <div className="flex flex-col bg-[#16213e] border-b border-gray-700/50 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Language selector */}
                <div className="flex gap-1">
                  {(['python3', 'cpp'] as const).map(l => (
                    <button key={l} onClick={() => switchLang(l)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition ${lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
                      {LANG_LABEL[l]}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                {/* Action buttons — inline on desktop */}
                <div className="hidden sm:flex items-center gap-2">
                  {!sessionOK && (
                    <span className="flex items-center gap-1 text-xs text-orange-400">
                      <AlertCircle size={11} /> Setup session to run
                    </span>
                  )}
                  <button onClick={runTest} disabled={running || !sessionOK}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-600 disabled:opacity-40 transition">
                    {running && runMode === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Run
                  </button>
                  <button onClick={runSubmit} disabled={running || !sessionOK}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-500 disabled:opacity-40 transition">
                    {running && runMode === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Submit
                  </button>
                </div>
              </div>
              {/* Mobile Run/Submit row */}
              <div className="sm:hidden flex gap-2 px-3 pb-2">
                {!sessionOK && (
                  <span className="flex items-center gap-1 text-xs text-orange-400 mr-auto">
                    <AlertCircle size={11} /> Setup session
                  </span>
                )}
                <button onClick={runTest} disabled={running || !sessionOK}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg disabled:opacity-40 transition"
                  style={{ touchAction: 'manipulation' }}>
                  {running && runMode === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run
                </button>
                <button onClick={runSubmit} disabled={running || !sessionOK}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition"
                  style={{ touchAction: 'manipulation' }}>
                  {running && runMode === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Submit
                </button>
              </div>
            </div>

            {/* CodeMirror editor */}
            <div className="h-48 sm:flex-1 sm:min-h-0 overflow-hidden">
              <CodeMirror
                value={code}
                onChange={setCode}
                height="100%"
                theme={editorTheme ?? 'dark'}
                extensions={extensions}
                basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, autocompletion: true, indentOnInput: true }}
                style={{ height: '100%', fontSize: '13px' }}
              />
            </div>

            {/* Bottom panel — Testcase / Result */}
            <div className="h-44 sm:h-52 border-t border-gray-700/50 flex flex-col bg-[#16213e] shrink-0">
              {/* Bottom tabs */}
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
                {result && (
                  <span className={`ml-3 text-xs font-bold ${STATUS_CLS[result.status_code ?? 0] ?? 'text-gray-400'}`}>
                    {result.status_msg}
                  </span>
                )}
              </div>

              {/* Bottom content */}
              <div className="flex-1 overflow-y-auto p-3">
                {bottomTab === 'testcase' && (
                  <div className="space-y-2">
                    {/* Case tabs */}
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
                    {/* Labeled params for active case */}
                    {cases[activeCase]?.params.length > 0 ? (
                      <div className="space-y-2">
                        {cases[activeCase].params.map(p => (
                          <div key={p.name}>
                            <p className="text-xs text-gray-500 mb-1">{p.name} =</p>
                            <div className="bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-2 text-xs font-mono text-gray-200">
                              {p.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={4}
                        className="w-full bg-gray-800/70 border border-gray-700/50 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500 resize-none" />
                    )}
                  </div>
                )}

                {bottomTab === 'result' && (
                  <div className="space-y-2 text-xs">
                    {resultErr && (
                      <p className="text-red-400 flex items-center gap-1"><XCircle size={12} /> {resultErr}</p>
                    )}
                    {!result && !resultErr && !pollMsg && (
                      <p className="text-gray-600">Run your code first.</p>
                    )}
                    {result && (
                      <div className="space-y-2">
                        {/* Status */}
                        <div className={`flex items-center gap-2 font-bold text-sm ${STATUS_CLS[result.status_code ?? 0] ?? 'text-gray-400'}`}>
                          {isAC ? <CheckCircle size={15} /> : <XCircle size={15} />}
                          {result.status_msg}
                          {result.total_testcases && (
                            <span className="text-gray-500 font-normal text-xs ml-1">
                              {result.total_correct}/{result.total_testcases} testcases passed
                            </span>
                          )}
                        </div>

                        {/* App sync badge — only on Submit + Accepted */}
                        {solvedStatus === 'marked' && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                            <Star size={11} className="fill-green-400" />
                            Marked as solved in your app — spaced repetition started
                          </div>
                        )}
                        {solvedStatus === 'already' && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700/30 border border-gray-600/20 rounded-lg px-3 py-1.5">
                            <CheckCircle size={11} />
                            Already solved in your app
                          </div>
                        )}
                        {solvedStatus === 'not-in-library' && (
                          <div className="flex items-center gap-1.5 text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5">
                            <AlertCircle size={11} />
                            Not in your app&apos;s 331 question library — solved on LeetCode only
                          </div>
                        )}

                        {/* Perf (submit only) */}
                        {isAC && runMode === 'submit' && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {result.status_runtime && (
                              <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                                <p className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-0.5"><Clock size={10} /> Runtime</p>
                                <p className="font-bold text-gray-100">{result.status_runtime}</p>
                                {result.runtime_percentile && <p className="text-green-400 text-xs">Beats {result.runtime_percentile.toFixed(1)}%</p>}
                              </div>
                            )}
                            {result.status_memory && (
                              <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                                <p className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-0.5"><Cpu size={10} /> Memory</p>
                                <p className="font-bold text-gray-100">{result.status_memory}</p>
                                {result.memory_percentile && <p className="text-green-400 text-xs">Beats {result.memory_percentile.toFixed(1)}%</p>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Wrong answer diff */}
                        {result.status_code === 11 && result.last_testcase && (
                          <div className="space-y-1.5">
                            <div><span className="text-gray-500">Input: </span><code className="text-gray-300">{result.last_testcase}</code></div>
                            {result.code_answer?.[0] !== undefined && (
                              <div><span className="text-gray-500">Output: </span><code className="text-red-400">{result.code_answer[0]}</code></div>
                            )}
                            {result.expected_code_answer?.[0] !== undefined && (
                              <div><span className="text-gray-500">Expected: </span><code className="text-green-400">{result.expected_code_answer[0]}</code></div>
                            )}
                          </div>
                        )}

                        {/* Compile / Runtime error */}
                        {(result.full_compile_error || result.full_runtime_error) && (
                          <pre className="bg-gray-800/60 rounded-lg p-2 text-red-400 overflow-x-auto whitespace-pre-wrap text-xs">
                            {result.full_compile_error || result.full_runtime_error}
                          </pre>
                        )}

                        {/* Test run output per case */}
                        {runMode === 'test' && result.code_output && result.code_output.length > 0 && (
                          <div className="space-y-1">
                            {result.code_output.map((out, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className={result.compare_result?.[i] === '1' ? 'text-green-400' : 'text-red-400'}>
                                  {result.compare_result?.[i] === '1' ? '✓' : '✗'}
                                </span>
                                <code className="text-gray-300">{out}</code>
                                {result.expected_code_answer?.[i] !== undefined && result.compare_result?.[i] !== '1' && (
                                  <span className="text-gray-500">→ expected <code className="text-green-400">{result.expected_code_answer[i]}</code></span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


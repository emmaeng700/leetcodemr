'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Search, Trophy, Target, Calendar, ExternalLink, CheckCircle,
  XCircle, Loader2, User, Tag, BarChart2, BookOpen, Link2,
  Play, Send, Key, Eye, EyeOff, ChevronDown, ChevronUp,
  AlertCircle, Clock, Cpu, Info,
} from 'lucide-react'

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
  state: string         // 'SUCCESS' | 'PENDING' | 'STARTED'
  status_code?: number  // 10=Accepted, 11=WA, 14=TLE, 20=CE, etc.
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
  compile_error?: string
  full_compile_error?: string
  full_runtime_error?: string
  error_code?: number
}

/* ─── GraphQL queries ────────────────────────────────────── */
const DAILY_QUERY = `query getDailyChallenge {
  activeDailyCodingChallengeQuestion {
    date link
    question { questionId title titleSlug difficulty topicTags { name } }
  }
}`
const USER_QUERY = `query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName ranking userAvatar }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
}`
const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId questionFrontendId title titleSlug difficulty
    content topicTags { name }
    codeSnippets { lang langSlug code }
    exampleTestcases sampleTestCase metaData
  }
}`

/* ─── Helpers ────────────────────────────────────────────── */
async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch('/api/leetcode', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

function parseSlug(input: string): string {
  const m = input.match(/problems\/([^/?#]+)/)
  return m ? m[1] : input.trim().toLowerCase().replace(/\s+/g, '-')
}

const LC_LANG: Record<string, string> = { python3: 'python3', cpp: 'cpp' }
const LANG_LABEL: Record<string, string> = { python3: 'Python 3', cpp: 'C++' }

const diffColor: Record<string, string> = {
  Easy: 'text-green-600 bg-green-50 border-green-200',
  Medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Hard: 'text-red-600 bg-red-50 border-red-200',
}

const STATUS_COLOR: Record<number, string> = {
  10: 'text-green-700 bg-green-50 border-green-200',   // Accepted
  11: 'text-red-700 bg-red-50 border-red-200',          // Wrong Answer
  12: 'text-red-700 bg-red-50 border-red-200',          // Memory Limit
  13: 'text-red-700 bg-red-50 border-red-200',          // Output Limit
  14: 'text-orange-700 bg-orange-50 border-orange-200', // Time Limit
  15: 'text-red-700 bg-red-50 border-red-200',          // Runtime Error
  20: 'text-red-700 bg-red-50 border-red-200',          // Compile Error
}

/* ─── Page ───────────────────────────────────────────────── */
export default function LeetCodeApiPage() {
  /* Session */
  const [session, setSession]       = useState('')
  const [csrfToken, setCsrfToken]   = useState('')
  const [showSession, setShowSession] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const sessionSaved = !!(session && csrfToken)

  /* Daily */
  const [daily, setDaily]     = useState<DailyChallenge | null>(null)
  const [dailyLoad, setDL]    = useState(false)
  const [dailyErr, setDE]     = useState('')

  /* Profile */
  const [username, setUsername] = useState('')
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [profileLoad, setPL]    = useState(false)
  const [profileErr, setPE]     = useState('')

  /* Question solver */
  const [slugInput, setSlugInput]   = useState('')
  const [question, setQuestion]     = useState<QuestionDetail | null>(null)
  const [qLoad, setQL]              = useState(false)
  const [qErr, setQE]               = useState('')
  const [lang, setLang]             = useState<'python3' | 'cpp'>('python3')
  const [code, setCode]             = useState('')
  const [descOpen, setDescOpen]     = useState(true)
  const [testInput, setTestInput]   = useState('')

  /* Results */
  const [running, setRunning]       = useState(false)
  const [runMode, setRunMode]       = useState<'test' | 'submit' | null>(null)
  const [result, setResult]         = useState<LCResult | null>(null)
  const [resultErr, setResultErr]   = useState('')
  const [pollMsg, setPollMsg]       = useState('')

  /* Load saved session from localStorage */
  useEffect(() => {
    const s = localStorage.getItem('lc_session') ?? ''
    const c = localStorage.getItem('lc_csrf') ?? ''
    setSession(s); setCsrfToken(c)
    if (!s || !c) setSessionOpen(true) // auto-open if not set
  }, [])

  const saveSession = () => {
    localStorage.setItem('lc_session', session.trim())
    localStorage.setItem('lc_csrf', csrfToken.trim())
    setSessionOpen(false)
  }
  const clearSession = () => {
    localStorage.removeItem('lc_session'); localStorage.removeItem('lc_csrf')
    setSession(''); setCsrfToken(''); setSessionOpen(true)
  }

  /* Poll LeetCode for result */
  const pollResult = useCallback(async (checkId: string, slug: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      setPollMsg(`Checking result… (${i + 1}s)`)
      const res = await fetch('/api/leetcode/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId, titleSlug: slug, session, csrfToken }),
      })
      const data: LCResult = await res.json()
      if (data.state !== 'PENDING' && data.state !== 'STARTED') {
        setResult(data); setRunning(false); setPollMsg(''); return
      }
    }
    setResultErr('Timed out waiting for LeetCode result.')
    setRunning(false); setPollMsg('')
  }, [session, csrfToken])

  /* Test run */
  const runTest = async () => {
    if (!question || !sessionSaved) return
    setRunning(true); setRunMode('test'); setResult(null); setResultErr('')
    setPollMsg('Sending to LeetCode…')
    try {
      const res = await fetch('/api/leetcode/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleSlug: question.titleSlug, questionId: question.questionId,
          lang: LC_LANG[lang], code, testInput: testInput || question.sampleTestCase,
          session, csrfToken,
        }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await pollResult(data.interpret_id, question.titleSlug)
    } catch (e) {
      setResultErr(String(e)); setRunning(false); setPollMsg('')
    }
  }

  /* Submit */
  const runSubmit = async () => {
    if (!question || !sessionSaved) return
    setRunning(true); setRunMode('submit'); setResult(null); setResultErr('')
    setPollMsg('Submitting to LeetCode…')
    try {
      const res = await fetch('/api/leetcode/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleSlug: question.titleSlug, questionId: question.questionId,
          lang: LC_LANG[lang], code, session, csrfToken,
        }),
      })
      const data = await res.json()
      if (data.error) { setResultErr(data.error); setRunning(false); setPollMsg(''); return }
      await pollResult(data.submission_id, question.titleSlug)
    } catch (e) {
      setResultErr(String(e)); setRunning(false); setPollMsg('')
    }
  }

  /* Fetch daily */
  const fetchDaily = async () => {
    setDL(true); setDE('')
    try {
      const data = await gql(DAILY_QUERY)
      setDaily(data.activeDailyCodingChallengeQuestion)
    } catch (e) { setDE(String(e)) }
    finally { setDL(false) }
  }

  /* Fetch profile */
  const fetchProfile = async () => {
    if (!username.trim()) return
    setPL(true); setPE(''); setProfile(null)
    try {
      const data = await gql(USER_QUERY, { username: username.trim() })
      if (!data.matchedUser) throw new Error('User not found')
      setProfile(data.matchedUser)
    } catch (e) { setPE(String(e)) }
    finally { setPL(false) }
  }

  /* Fetch question */
  const fetchQuestion = async (overrideSlug?: string) => {
    const slug = overrideSlug ?? parseSlug(slugInput)
    if (!slug) return
    setQL(true); setQE(''); setQuestion(null); setResult(null); setResultErr('')
    try {
      const data = await gql(QUESTION_QUERY, { titleSlug: slug })
      if (!data.question) throw new Error('Question not found')
      const q: QuestionDetail = data.question
      setQuestion(q)
      setTestInput(q.sampleTestCase ?? '')
      const snippet = q.codeSnippets.find(s => s.langSlug === lang)
      setCode(snippet?.code ?? '')
    } catch (e) { setQE(String(e)) }
    finally { setQL(false) }
  }

  const switchLang = (l: 'python3' | 'cpp') => {
    setLang(l)
    if (question) {
      const snippet = question.codeSnippets.find(s => s.langSlug === l)
      setCode(snippet?.code ?? '')
    }
    setResult(null)
  }

  /* Derived */
  const acStats  = profile?.submitStatsGlobal.acSubmissionNum ?? []
  const totalAC  = acStats.find(s => s.difficulty === 'All')
  const easyAC   = acStats.find(s => s.difficulty === 'Easy')
  const medAC    = acStats.find(s => s.difficulty === 'Medium')
  const hardAC   = acStats.find(s => s.difficulty === 'Hard')
  const isAccepted = result?.status_code === 10

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <BarChart2 className="text-indigo-500" size={24} /> LeetCode
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Fetch questions, write code, run tests and submit — all using your LeetCode account.
        </p>
      </div>

      {/* ══ Session Setup ══════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => setSessionOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
          <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <Key size={15} className={sessionSaved ? 'text-green-500' : 'text-orange-400'} />
            LeetCode Session
            {sessionSaved
              ? <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Connected</span>
              : <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Required</span>}
          </span>
          {sessionOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {sessionOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 space-y-4">
            {/* Instructions */}
            <div className="flex gap-2 bg-blue-50 rounded-xl p-3 mt-4">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 space-y-1">
                <p className="font-semibold">How to get your cookies:</p>
                <ol className="list-decimal ml-3 space-y-0.5">
                  <li>Open <strong>leetcode.com</strong> and log in</li>
                  <li>Open DevTools → <strong>Application → Cookies → leetcode.com</strong></li>
                  <li>Copy the value of <code className="bg-blue-100 px-1 rounded">LEETCODE_SESSION</code></li>
                  <li>Copy the value of <code className="bg-blue-100 px-1 rounded">csrftoken</code></li>
                </ol>
                <p className="text-blue-600 mt-1">Stored in your browser only — never sent anywhere except back to LeetCode.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">LEETCODE_SESSION</label>
                <div className="relative">
                  <input
                    type={showSession ? 'text' : 'password'}
                    value={session}
                    onChange={e => setSession(e.target.value)}
                    placeholder="Paste LEETCODE_SESSION cookie value…"
                    className="w-full pr-10 pl-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                  />
                  <button onClick={() => setShowSession(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSession ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">csrftoken</label>
                <input
                  type="password"
                  value={csrfToken}
                  onChange={e => setCsrfToken(e.target.value)}
                  placeholder="Paste csrftoken cookie value…"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={saveSession} disabled={!session.trim() || !csrfToken.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                Save Session
              </button>
              {sessionSaved && (
                <button onClick={clearSession}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ══ Daily Challenge ═══════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
            <Calendar size={15} className="text-orange-500" /> Today&apos;s Daily Challenge
          </h2>
          <button onClick={fetchDaily} disabled={dailyLoad}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
            {dailyLoad ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
            {dailyLoad ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {dailyErr && <Err msg={dailyErr} />}
        {daily ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">{daily.date}</p>
                <p className="font-semibold text-gray-900 mt-0.5">{daily.question.questionId}. {daily.question.title}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <a href={`https://leetcode.com${daily.link}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                  Open <ExternalLink size={10} />
                </a>
                <button onClick={() => { setSlugInput(daily.question.titleSlug); fetchQuestion(daily.question.titleSlug) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition">
                  Solve <Play size={10} />
                </button>
              </div>
            </div>
            <Diff d={daily.question.difficulty} />
            {daily.question.topicTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {daily.question.topicTags.map(t => (
                  <span key={t.name} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    <Tag size={9} /> {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : !dailyErr && !dailyLoad ? (
          <p className="text-sm text-gray-400">Press Fetch to load today&apos;s challenge.</p>
        ) : null}
      </section>

      {/* ══ Question Solver ═══════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4 text-sm">
          <BookOpen size={15} className="text-emerald-500" /> Question Solver
        </h2>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={slugInput}
              onChange={e => setSlugInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchQuestion()}
              placeholder="Paste LeetCode URL or slug — e.g. two-sum"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={() => fetchQuestion()} disabled={qLoad || !slugInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
            {qLoad ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {qLoad ? 'Loading…' : 'Load'}
          </button>
        </div>

        {qErr && <Err msg={qErr} />}

        {question && (
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900">{question.questionFrontendId}. {question.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Diff d={question.difficulty} />
                  {question.topicTags.map(t => (
                    <span key={t.name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.name}</span>
                  ))}
                </div>
              </div>
              <a href={`https://leetcode.com/problems/${question.titleSlug}/`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition shrink-0">
                LC <ExternalLink size={10} />
              </a>
            </div>

            {/* Description toggle */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setDescOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
                Problem Description
                {descOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {descOpen && (
                <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: question.content }} />
              )}
            </div>

            {/* Language */}
            <div className="flex gap-2">
              {(['python3', 'cpp'] as const).map(l => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${lang === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>

            {/* Code editor */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <CodeMirror value={code} onChange={setCode} height="320px" theme="dark"
                basicSetup={{ lineNumbers: true, foldGutter: false }} />
            </div>

            {/* Custom test input */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Test Input <span className="font-normal text-gray-400">(pre-filled with example cases — edit to test custom inputs)</span>
              </label>
              <textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y bg-gray-50" />
            </div>

            {/* Action buttons */}
            {!sessionSaved && (
              <div className="flex items-center gap-2 text-orange-600 text-xs bg-orange-50 rounded-xl p-3">
                <AlertCircle size={13} />
                Save your LeetCode session above to enable Test &amp; Submit.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={runTest} disabled={running || !sessionSaved}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition text-sm">
                {running && runMode === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {running && runMode === 'test' ? 'Testing…' : 'Run Tests'}
              </button>
              <button onClick={runSubmit} disabled={running || !sessionSaved}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition text-sm">
                {running && runMode === 'submit' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {running && runMode === 'submit' ? 'Submitting…' : 'Submit'}
              </button>
            </div>

            {/* Poll status */}
            {pollMsg && (
              <div className="flex items-center gap-2 text-gray-500 text-xs bg-gray-50 rounded-xl p-3">
                <Loader2 size={13} className="animate-spin text-indigo-400" /> {pollMsg}
              </div>
            )}

            {/* Result error */}
            {resultErr && <Err msg={resultErr} />}

            {/* Result panel */}
            {result && (
              <div className={`rounded-2xl border overflow-hidden`}>
                {/* Status bar */}
                <div className={`px-4 py-3 border-b flex items-center gap-3 ${STATUS_COLOR[result.status_code ?? 0] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  {isAccepted
                    ? <CheckCircle size={18} className="text-green-600" />
                    : <XCircle size={18} className="text-red-500" />}
                  <div>
                    <p className="font-bold text-base">{result.status_msg ?? result.state}</p>
                    {runMode === 'submit' && result.total_testcases && (
                      <p className="text-xs mt-0.5 opacity-80">
                        {result.total_correct} / {result.total_testcases} test cases passed
                      </p>
                    )}
                    {runMode === 'test' && result.compare_result && (
                      <p className="text-xs mt-0.5 opacity-80">
                        {[...result.compare_result].filter(c => c === '1').length} / {result.compare_result.length} example cases passed
                      </p>
                    )}
                  </div>
                </div>

                {/* Perf stats (submit only) */}
                {isAccepted && runMode === 'submit' && (
                  <div className="grid grid-cols-2 divide-x divide-gray-100 bg-white">
                    {result.status_runtime && (
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
                          <Clock size={11} /> Runtime
                        </div>
                        <p className="font-bold text-gray-900">{result.status_runtime}</p>
                        {result.runtime_percentile && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Beats {result.runtime_percentile.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    )}
                    {result.status_memory && (
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
                          <Cpu size={11} /> Memory
                        </div>
                        <p className="font-bold text-gray-900">{result.status_memory}</p>
                        {result.memory_percentile && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Beats {result.memory_percentile.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Wrong answer details */}
                {!isAccepted && result.status_code === 11 && (
                  <div className="bg-white px-4 py-3 space-y-2 text-xs">
                    {result.last_testcase && (
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">Input</p>
                        <pre className="bg-gray-900 text-gray-200 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">{result.last_testcase}</pre>
                      </div>
                    )}
                    {result.code_answer?.[0] !== undefined && (
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">Your Output</p>
                        <pre className="bg-gray-900 text-red-400 rounded-lg p-2.5 overflow-x-auto">{result.code_answer[0]}</pre>
                      </div>
                    )}
                    {result.expected_code_answer?.[0] !== undefined && (
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">Expected</p>
                        <pre className="bg-gray-900 text-green-400 rounded-lg p-2.5 overflow-x-auto">{result.expected_code_answer[0]}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Compile / Runtime error */}
                {(result.full_compile_error || result.full_runtime_error) && (
                  <div className="bg-gray-900 px-4 py-3">
                    <pre className="text-red-400 text-xs overflow-x-auto whitespace-pre-wrap">
                      {result.full_compile_error || result.full_runtime_error}
                    </pre>
                  </div>
                )}

                {/* Test run output */}
                {runMode === 'test' && result.code_output && result.code_output.length > 0 && (
                  <div className="bg-white px-4 py-3 space-y-2 text-xs">
                    <p className="font-semibold text-gray-600">Output</p>
                    {result.code_output.map((out, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className={`shrink-0 font-bold mt-0.5 ${result.compare_result?.[i] === '1' ? 'text-green-500' : 'text-red-500'}`}>
                          {result.compare_result?.[i] === '1' ? '✓' : '✗'}
                        </span>
                        <pre className="bg-gray-900 text-gray-200 rounded-lg p-2 overflow-x-auto flex-1">{out}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!question && !qErr && !qLoad && (
          <p className="text-sm text-gray-400">
            Paste any LeetCode URL or slug (e.g. <code className="bg-gray-100 px-1 rounded">two-sum</code>) and press Load.
          </p>
        )}
      </section>

      {/* ══ User Profile ═════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4 text-sm">
          <User size={15} className="text-indigo-500" /> User Profile Lookup
        </h2>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchProfile()}
              placeholder="LeetCode username…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={fetchProfile} disabled={profileLoad || !username.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
            {profileLoad ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {profileLoad ? 'Loading…' : 'Look up'}
          </button>
        </div>
        {profileErr && <Err msg={profileErr} />}
        {profile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {profile.profile.userAvatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profile.userAvatar} alt={profile.username} className="w-12 h-12 rounded-full border border-gray-200" />
              )}
              <div>
                <p className="font-bold text-gray-900">{profile.profile.realName || profile.username}</p>
                <p className="text-xs text-gray-500">@{profile.username}</p>
              </div>
              <div className="ml-auto flex items-center gap-1 text-sm font-semibold text-yellow-600">
                <Trophy size={14} /> #{profile.profile.ranking.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Total AC', value: totalAC?.count ?? 0, color: 'text-gray-900' },
                { label: 'Easy',     value: easyAC?.count  ?? 0, color: 'text-green-600' },
                { label: 'Medium',   value: medAC?.count   ?? 0, color: 'text-yellow-600' },
                { label: 'Hard',     value: hardAC?.count  ?? 0, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {!profile && !profileErr && !profileLoad && (
          <p className="text-sm text-gray-400">Enter a LeetCode username and press Look up.</p>
        )}
      </section>

      <p className="text-xs text-gray-400 text-center pb-4">
        LeetCode&apos;s internal GraphQL + submission API (unofficial). Session stored in your browser only.
      </p>
    </div>
  )
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3 mb-3">
      <XCircle size={14} className="shrink-0" /> {msg}
    </div>
  )
}
function Diff({ d }: { d: string }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${diffColor[d] ?? ''}`}>{d}</span>
  )
}

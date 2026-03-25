'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Search, Trophy, Target, Calendar, ExternalLink,
  CheckCircle, XCircle, Loader2, User, Tag, BarChart2,
  Code2, Play, ChevronDown, ChevronUp, BookOpen, Link2,
} from 'lucide-react'

/* ─── CodeMirror (no SSR) ────────────────────────────────── */
const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

/* ─── Types ─────────────────────────────────────────────── */
interface DailyChallenge {
  date: string
  link: string
  question: { questionId: string; title: string; titleSlug: string; difficulty: string; topicTags: { name: string }[] }
}
interface AcStat { difficulty: string; count: number }
interface UserProfile {
  username: string
  profile: { realName: string; ranking: number; userAvatar: string }
  submitStatsGlobal: { acSubmissionNum: AcStat[] }
}
interface CodeSnippet { lang: string; langSlug: string; code: string }
interface QuestionDetail {
  questionId: string
  questionFrontendId: string
  title: string
  titleSlug: string
  difficulty: string
  content: string          // HTML
  topicTags: { name: string }[]
  codeSnippets: CodeSnippet[]
  exampleTestcases: string
  sampleTestCase: string
  metaData: string         // JSON string
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
    content
    topicTags { name }
    codeSnippets { lang langSlug code }
    exampleTestcases sampleTestCase metaData
  }
}`

/* ─── Helpers ────────────────────────────────────────────── */
async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch('/api/leetcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

/** Extract slug from a LeetCode URL or return as-is */
function parseSlug(input: string): string {
  const m = input.match(/problems\/([^/]+)/)
  return m ? m[1] : input.trim().toLowerCase().replace(/\s+/g, '-')
}

const JUDGE0_LANG: Record<string, number> = { python3: 71, cpp: 54 }
const LANG_LABEL: Record<string, string> = { python3: 'Python 3', cpp: 'C++' }

const diffColor: Record<string, string> = {
  Easy:   'text-green-600 bg-green-50 border-green-200',
  Medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Hard:   'text-red-600 bg-red-50 border-red-200',
}

/* ─── Page ───────────────────────────────────────────────── */
export default function LeetCodeApiPage() {
  /* Daily */
  const [daily, setDaily]       = useState<DailyChallenge | null>(null)
  const [dailyLoad, setDL]      = useState(false)
  const [dailyErr, setDE]       = useState('')

  /* Profile */
  const [username, setUsername] = useState('')
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [profileLoad, setPL]    = useState(false)
  const [profileErr, setPE]     = useState('')

  /* Question solver */
  const [slugInput, setSlugInput]         = useState('')
  const [question, setQuestion]           = useState<QuestionDetail | null>(null)
  const [qLoad, setQL]                    = useState(false)
  const [qErr, setQE]                     = useState('')
  const [lang, setLang]                   = useState<'python3' | 'cpp'>('python3')
  const [code, setCode]                   = useState('')
  const [descOpen, setDescOpen]           = useState(true)
  const [running, setRunning]             = useState(false)
  const [runOutput, setRunOutput]         = useState<{ stdout: string; stderr: string; status: string; time?: string } | null>(null)

  /* ── Fetch daily ── */
  const fetchDaily = async () => {
    setDL(true); setDE('')
    try {
      const data = await gql(DAILY_QUERY)
      setDaily(data.activeDailyCodingChallengeQuestion)
    } catch (e) { setDE(String(e)) }
    finally { setDL(false) }
  }

  /* ── Fetch profile ── */
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

  /* ── Fetch question ── */
  const fetchQuestion = async () => {
    const slug = parseSlug(slugInput)
    if (!slug) return
    setQL(true); setQE(''); setQuestion(null); setRunOutput(null)
    try {
      const data = await gql(QUESTION_QUERY, { titleSlug: slug })
      if (!data.question) throw new Error('Question not found')
      const q: QuestionDetail = data.question
      setQuestion(q)
      // Pre-fill starter code for chosen language
      const snippet = q.codeSnippets.find(s => s.langSlug === lang)
      setCode(snippet?.code ?? '')
    } catch (e) { setQE(String(e)) }
    finally { setQL(false) }
  }

  /* Switch language → update starter code */
  const switchLang = (l: 'python3' | 'cpp') => {
    setLang(l)
    if (question) {
      const snippet = question.codeSnippets.find(s => s.langSlug === l)
      setCode(snippet?.code ?? '')
    }
    setRunOutput(null)
  }

  /* ── Run code ── */
  const runCode = async () => {
    if (!code.trim()) return
    setRunning(true); setRunOutput(null)
    try {
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language_id: JUDGE0_LANG[lang] }),
      })
      const result = await res.json()
      setRunOutput({
        stdout: result.stdout ?? '',
        stderr: result.stderr || result.compile_output || result.message || '',
        status: result.status?.description ?? 'Unknown',
        time: result.time,
      })
    } catch (e) {
      setRunOutput({ stdout: '', stderr: String(e), status: 'Error' })
    }
    finally { setRunning(false) }
  }

  /* ── Derived ── */
  const acStats   = profile?.submitStatsGlobal.acSubmissionNum ?? []
  const totalAC   = acStats.find(s => s.difficulty === 'All')
  const easyAC    = acStats.find(s => s.difficulty === 'Easy')
  const medAC     = acStats.find(s => s.difficulty === 'Medium')
  const hardAC    = acStats.find(s => s.difficulty === 'Hard')
  const runOK     = runOutput?.status === 'Accepted' || runOutput?.status === 'Running' || runOutput?.stdout

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <BarChart2 className="text-indigo-500" size={24} /> LeetCode API Explorer
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Server-side proxy to LeetCode&apos;s GraphQL API — fetch questions, view descriptions, write and run code.
        </p>
      </div>

      {/* ══ 1. Daily Challenge ══════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Calendar size={16} className="text-orange-500" /> Today&apos;s Daily Challenge
          </h2>
          <button onClick={fetchDaily} disabled={dailyLoad}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
            {dailyLoad ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
            {dailyLoad ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {dailyErr && <Err msg={dailyErr} />}
        {daily ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{daily.date}</p>
                <p className="font-semibold text-gray-900">{daily.question.questionId}. {daily.question.title}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <a href={`https://leetcode.com${daily.link}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                  Open <ExternalLink size={11} />
                </a>
                <button
                  onClick={() => { setSlugInput(daily.question.titleSlug); setTimeout(fetchQuestion, 0) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition">
                  Solve here <Code2 size={11} />
                </button>
              </div>
            </div>
            <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${diffColor[daily.question.difficulty] ?? ''}`}>
              {daily.question.difficulty}
            </span>
            {daily.question.topicTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {daily.question.topicTags.map(t => (
                  <span key={t.name} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    <Tag size={10} /> {t.name}
                  </span>
                ))}
              </div>
            )}
            <OK />
          </div>
        ) : !dailyErr && !dailyLoad ? (
          <p className="text-sm text-gray-400">Press Fetch to load today&apos;s challenge.</p>
        ) : null}
      </section>

      {/* ══ 2. Question Solver ══════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-emerald-500" /> Question Solver
        </h2>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={slugInput} onChange={e => setSlugInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchQuestion()}
              placeholder="Paste LeetCode URL or slug — e.g. two-sum"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={fetchQuestion} disabled={qLoad || !slugInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
            {qLoad ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {qLoad ? 'Loading…' : 'Load'}
          </button>
        </div>

        {qErr && <Err msg={qErr} />}

        {question && (
          <div className="space-y-4">
            {/* Title row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-gray-900 text-base">
                  {question.questionFrontendId}. {question.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${diffColor[question.difficulty] ?? ''}`}>
                    {question.difficulty}
                  </span>
                  {question.topicTags.map(t => (
                    <span key={t.name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.name}</span>
                  ))}
                </div>
              </div>
              <a href={`https://leetcode.com/problems/${question.titleSlug}/`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition shrink-0">
                LeetCode <ExternalLink size={11} />
              </a>
            </div>

            {/* Description toggle */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setDescOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
                Problem Description
                {descOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {descOpen && (
                <div
                  className="px-4 py-3 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: question.content }}
                />
              )}
            </div>

            {/* Example test cases */}
            {question.exampleTestcases && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Example Test Cases</p>
                <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                  {question.exampleTestcases}
                </pre>
                <p className="text-xs text-gray-400 mt-1">
                  Add <code className="bg-gray-100 px-1 rounded">print(Solution().yourMethod(...))</code> at the bottom of your code to test with these inputs.
                </p>
              </div>
            )}

            {/* Language selector */}
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
              <CodeMirror
                value={code}
                onChange={setCode}
                height="320px"
                theme="dark"
                basicSetup={{ lineNumbers: true, foldGutter: false }}
              />
            </div>

            {/* Run button */}
            <button onClick={runCode} disabled={running || !code.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Running…' : 'Run Code'}
            </button>

            {/* Output */}
            {runOutput && (
              <div className="rounded-xl border overflow-hidden">
                <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 ${runOK ? 'bg-green-50 text-green-700 border-b border-green-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
                  {runOK ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {runOutput.status}
                  {runOutput.time && <span className="ml-auto text-gray-400">{runOutput.time}s</span>}
                </div>
                {runOutput.stdout && (
                  <pre className="bg-gray-900 text-green-400 text-xs p-3 overflow-x-auto whitespace-pre-wrap">{runOutput.stdout}</pre>
                )}
                {runOutput.stderr && (
                  <pre className="bg-gray-900 text-red-400 text-xs p-3 overflow-x-auto whitespace-pre-wrap">{runOutput.stderr}</pre>
                )}
                {!runOutput.stdout && !runOutput.stderr && (
                  <pre className="bg-gray-900 text-gray-400 text-xs p-3">(no output)</pre>
                )}
              </div>
            )}
          </div>
        )}

        {!question && !qErr && !qLoad && (
          <p className="text-sm text-gray-400">
            Paste any LeetCode URL or slug above (e.g. <code className="bg-gray-100 px-1 rounded">two-sum</code>) and press Load to fetch the question.
          </p>
        )}
      </section>

      {/* ══ 3. User Profile ══════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <User size={16} className="text-indigo-500" /> User Profile Lookup
        </h2>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchProfile()}
              placeholder="LeetCode username…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={fetchProfile} disabled={profileLoad || !username.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
            {profileLoad ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
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
                <Trophy size={14} /> Rank #{profile.profile.ranking.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total AC', value: totalAC?.count ?? 0, color: 'text-gray-800' },
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
            <OK />
          </div>
        )}
        {!profile && !profileErr && !profileLoad && (
          <p className="text-sm text-gray-400">Enter a LeetCode username and press Look up.</p>
        )}
      </section>

      <p className="text-xs text-gray-400 text-center">
        Uses LeetCode&apos;s internal GraphQL API (unofficial). Public data only — no login required.
        Code runs via Judge0 (proxied server-side).
      </p>
    </div>
  )
}

/* ─── Tiny shared components ─────────────────────────────── */
function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-3">
      <XCircle size={14} /> {msg}
    </div>
  )
}
function OK() {
  return (
    <div className="text-xs text-green-600 flex items-center gap-1">
      <CheckCircle size={13} /> API call successful
    </div>
  )
}

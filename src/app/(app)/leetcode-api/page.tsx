'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { stripScripts, leetCodeUrl } from '@/lib/utils'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import {
  Search, Trophy, CheckCircle, XCircle, Loader2, User,
  Play, Key, Eye, EyeOff, ChevronDown, ChevronUp,
  Info, Calendar, ExternalLink,
  Tag, ChevronRight, Star, BookOpen,
} from 'lucide-react'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import { lcFetch } from '@/lib/leetcodeLocalConnector'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import WhiteboardNotes from '@/components/WhiteboardNotes'

function EditorialCodeBlock({ code, lang }: { code: string; lang: string }) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (codeRef.current && code && (lang === 'python' || lang === 'cpp')) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = code
      hljs.highlightElement(codeRef.current)
    }
  }, [code, lang])
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-[#282c34] my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#21252b] border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400">{lang === 'cpp' ? 'C++' : lang === 'python' ? 'Python' : lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-[12px] leading-relaxed m-0 bg-[#282c34]">
          <code ref={codeRef} className={`language-${lang}`}>{code}</code>
        </pre>
      </div>
    </div>
  )
}

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
/* ─── GraphQL ────────────────────────────────────────────── */
const DAILY_Q = `query { activeDailyCodingChallengeQuestion { date link question { questionId title titleSlug difficulty topicTags { name } } } }`
const USER_Q  = `query($u:String!){matchedUser(username:$u){username profile{realName ranking userAvatar}submitStatsGlobal{acSubmissionNum{difficulty count}}}}`
const QUEST_Q = `query($s:String!){question(titleSlug:$s){questionId questionFrontendId title titleSlug difficulty content topicTags{name} codeSnippets{lang langSlug code} exampleTestcases sampleTestCase metaData}}`
const SEARCH_Q    = `query($q:String!){problemsetQuestionListV2(categorySlug:"",limit:1,skip:0,searchKeyword:$q,filters:{filterCombineType:ALL}){questions{titleSlug title}}}`
const SEARCH_MANY_Q = `query($q:String!,$limit:Int!,$skip:Int!){problemsetQuestionListV2(categorySlug:"",limit:$limit,skip:$skip,searchKeyword:$q,filters:{filterCombineType:ALL}){totalLength questions{titleSlug title questionFrontendId}}}`
const EDITORIAL_Q = `query($s:String!){question(titleSlug:$s){solution{content paidOnly}}}`
const PLAYGROUND_Q = `query($u:String!){allPlaygroundCodes(uuid:$u){code langSlug}}`

async function gql(query: string, variables?: Record<string, unknown>, creds?: { session: string; csrfToken: string }) {
  const res = await lcFetch('/api/leetcode', {
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

function absolutizeLeetCodeUrl(raw: string | undefined): string {
  const src = String(raw ?? '').trim()
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `https://leetcode.com${src}`
  // Some editorials include relative paths; treat as leetcode.com relative.
  return `https://leetcode.com/${src.replace(/^\.?\//, '')}`
}

function absolutizeSrcSet(raw: string | undefined): string | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  // srcset = "url1 1x, url2 2x" (or widths). Rewrite each URL part.
  return s
    .split(',')
    .map(part => {
      const trimmed = part.trim()
      if (!trimmed) return ''
      const pieces = trimmed.split(/\s+/)
      const url = pieces[0]
      const rest = pieces.slice(1).join(' ')
      const abs = absolutizeLeetCodeUrl(url)
      return rest ? `${abs} ${rest}` : abs
    })
    .filter(Boolean)
    .join(', ')
}

/* ─── Constants ──────────────────────────────────────────── */
const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-500',
  Medium: 'text-yellow-500',
  Hard:   'text-red-500',
}

/* ══════════════════════════════════════════════════════════ */
export default function LeetCodePage() {
  const online = useOnlineStatus()
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const lcSearchReqId = useRef(0)
  /* Session */
  const [session,    setSession]    = useState('')
  const [csrfToken,  setCsrfToken]  = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [sessionPanelOpen, setSPO]  = useState(false)
  const sessionOK = !!(session && csrfToken)
  /* LC login form */
  const [loginTab,    setLoginTab]    = useState<'login' | 'cookies'>('login')
  const [lcUsername,  setLcUsername]  = useState('')
  const [lcPassword,  setLcPassword]  = useState('')
  const [lcLoginErr,  setLcLoginErr]  = useState('')
  const [lcLogging,   setLcLogging]   = useState(false)
  const [showLcPwd,   setShowLcPwd]   = useState(false)

  /* Question state */
  const [slugInput, setSlugInput]   = useState('')
  const [question,  setQuestion]    = useState<QuestionDetail | null>(null)
  const [qLoad,     setQL]          = useState(false)
  const [qErr,      setQE]          = useState('')

  /* Editor is handled by shared LeetCodeEditor */

  /* App question list — loaded once to match solved-sync + local typeahead */
  const [appQuestions, setAppQuestions] = useState<Array<{ id: number; slug: string; title?: string }>>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [lcMatches, setLcMatches] = useState<Array<{ slug: string; title: string; frontendId?: string }>>([])
  const [lcSearching, setLcSearching] = useState(false)
  const [lcHasMore, setLcHasMore] = useState(false)
  const [lcNextSkip, setLcNextSkip] = useState(0)
  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((qs: Array<{ id: number; slug: string; title?: string }>) => setAppQuestions(qs))
      .catch(() => {})
  }, [])

  const matches = useMemo(() => {
    const q = slugInput.trim().toLowerCase()
    if (!q) return []
    const byId = q.replace(/^#/, '')
    return appQuestions
      .filter(x => {
        if (byId && String(x.id).includes(byId)) return true
        if ((x.slug ?? '').toLowerCase().includes(q)) return true
        if ((x.title ?? '').toLowerCase().includes(q)) return true
        return false
      })
      .slice(0, 8)
  }, [slugInput, appQuestions])

  const fetchLcSuggestions = useCallback(async (q: string, skip: number, append: boolean) => {
    const id = ++lcSearchReqId.current
    setLcSearching(true)
    try {
      const data = await gql(SEARCH_MANY_Q, { q, limit: 50, skip }, { session, csrfToken })
      if (lcSearchReqId.current !== id) return
      const qs: Array<{ titleSlug: string; title: string; questionFrontendId?: string }> =
        data?.problemsetQuestionListV2?.questions ?? []
      const total: number = data?.problemsetQuestionListV2?.totalLength ?? qs.length

      setLcMatches(prev => {
        const incoming = qs.map(x => ({ slug: x.titleSlug, title: x.title, frontendId: x.questionFrontendId }))
        const next = append ? [...prev, ...incoming] : incoming
        const seen = new Set<string>()
        return next.filter(x => {
          if (seen.has(x.slug)) return false
          seen.add(x.slug)
          return true
        })
      })

      const nextSkip = skip + qs.length
      setLcNextSkip(nextSkip)
      setLcHasMore(nextSkip < total && qs.length > 0)
    } catch {
      if (lcSearchReqId.current !== id) return
      if (!append) setLcMatches([])
      setLcHasMore(false)
      setLcNextSkip(0)
    } finally {
      if (lcSearchReqId.current !== id) return
      setLcSearching(false)
    }
  }, [session, csrfToken])

  useEffect(() => {
    const q = slugInput.trim()
    if (!searchOpen || q.length < 2) { setLcMatches([]); setLcSearching(false); setLcHasMore(false); setLcNextSkip(0); return }
    if (!(session && csrfToken)) { setLcMatches([]); setLcSearching(false); setLcHasMore(false); setLcNextSkip(0); return }
    const t = window.setTimeout(async () => {
      await fetchLcSuggestions(q, 0, false)
    }, 200)
    return () => {
      window.clearTimeout(t)
    }
  }, [slugInput, searchOpen, session, csrfToken, fetchLcSuggestions])


  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node
      if (searchWrapRef.current?.contains(t)) return
      setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  /* Left panel tab */
  const [leftTab, setLeftTab]       = useState<'description' | 'editorial' | 'notes' | 'best' | 'accepted' | 'profile'>('description')

  /* Editorial */
  const [editorial,     setEditorial]     = useState<string | null>(null)
  const [editorialLoad, setEditorialLoad] = useState(false)
  const editorialSlugRef = useRef<string | null>(null)

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

  const lcLogin = async () => {
    setLcLoginErr('')
    setLcLogging(true)
    try {
      const res = await fetch('/api/lc-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: lcUsername, password: lcPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLcLoginErr(data.error ?? 'Login failed.')
        return
      }
      const { lc_session, lc_csrf } = data
      setSession(lc_session)
      setCsrfToken(lc_csrf)
      localStorage.setItem('lc_session', lc_session)
      localStorage.setItem('lc_csrf', lc_csrf)
      try {
        await fetch('/api/lc-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lc_session, lc_csrf }),
        })
      } catch { /* silent */ }
      setSPO(false)
      setLcUsername('')
      setLcPassword('')
      fetchDailyInternal({ session: lc_session, csrfToken: lc_csrf })
    } catch (e) {
      setLcLoginErr(`Network error: ${String(e)}`)
    } finally {
      setLcLogging(false)
    }
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
    setQL(true); setQE(''); setQuestion(null); setLeftTab('description'); setEditorial(null); editorialSlugRef.current = null
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
    } catch (e) { setQE(String(e)) }
    finally { setQL(false) }
  }, [slugInput, session, csrfToken])

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

  /* ── Fetch editorial when tab opens ── */
  useEffect(() => {
    if (leftTab !== 'editorial' || !question) return
    if (editorialSlugRef.current === question.titleSlug) return // already fetched
    editorialSlugRef.current = question.titleSlug
    setEditorialLoad(true)
    setEditorial(null)
    const creds = session && csrfToken ? { session, csrfToken } : {}
    ;(async () => {
      try {
        const data = await gql(EDITORIAL_Q, { s: question.titleSlug }, creds as any)
        const content: string | undefined = data?.question?.solution?.content
        if (!content) { setEditorial(''); setEditorialLoad(false); return }

        // Replace playground iframes with fetched code blocks
        const iframeRe = /https:\/\/leetcode\.com\/playground\/([A-Za-z0-9]+)\/shared/g
        const uuids: string[] = []
        let m: RegExpExecArray | null
        while ((m = iframeRe.exec(content)) !== null) {
          if (!uuids.includes(m[1])) uuids.push(m[1])
        }

        if (uuids.length === 0) { setEditorial(content); setEditorialLoad(false); return }

        const codeMap: Record<string, string> = {}
        await Promise.all(uuids.map(async uuid => {
          try {
            const d = await gql(PLAYGROUND_Q, { u: uuid }, creds as any)
            const codes: { code: string; langSlug: string }[] = d?.allPlaygroundCodes ?? []
            const pick = codes.find(c => c.langSlug === 'cpp')
              ?? codes.find(c => c.langSlug === 'python3')
              ?? codes[0]
            if (pick) {
              const lang = pick.langSlug === 'python3' ? 'python' : pick.langSlug === 'cpp' ? 'cpp' : pick.langSlug
              codeMap[uuid] = `\`\`\`${lang}\n${pick.code}\n\`\`\``
            }
          } catch { /* ignore */ }
        }))

        let processed = content
        for (const uuid of uuids) {
          const pat = new RegExp(`<iframe[^>]*leetcode\\.com/playground/${uuid}/shared[^>]*>\\s*</iframe>`, 'gs')
          processed = processed.replace(pat, codeMap[uuid] ?? '')
        }
        // Strip Video Solution section
        processed = processed.replace(/#{1,3}\s*Video Solution[\s\S]*?(?=#{1,3}\s|\s*$)/i, '')
        setEditorial(processed)
      } catch { setEditorial('') }
      finally { setEditorialLoad(false) }
    })()
  }, [leftTab, question, session, csrfToken])

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(question?.titleSlug, leftTab === 'accepted')
  const bestAnswersId = question ? Number.parseInt(question.questionFrontendId || '0', 10) : 0
  const acStats = profile?.submitStatsGlobal.acSubmissionNum ?? []

  const matchId = useMemo(() => {
    if (!question) return 0
    const qFrontendId = Number.parseInt(question.questionFrontendId || '0', 10)
    const match = appQuestions.find(q => q.id === qFrontendId || q.slug === question.titleSlug)
    return match?.id ?? 0
  }, [question, appQuestions])

  useEffect(() => {
    if (!question) return
    const id = Number.parseInt(question.questionFrontendId || '0', 10)
    if (!Number.isFinite(id) || id <= 0) return
    setOpenQuestionContext({ id, slug: question.titleSlug, title: question.title })
  }, [question])

  /*  ══ RENDER ══════════════════════════════════════════════ */
  if (!online) return (
    <div className="flex flex-col items-center justify-center h-[calc(100dvh-56px)] gap-4 text-center px-4">
      <OfflineBanner feature="LeetCode section" />
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] bg-[#1a1a2e] text-gray-100 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="relative z-40 flex flex-col gap-1.5 px-3 pt-2 pb-2 bg-[#16213e] border-b border-gray-700/50 shrink-0 overflow-visible">
        {/* Row 1 (mobile): Daily pill + Session badge side by side */}
        <div className="flex items-center gap-2">
          {/* Daily pill */}
          {daily && !qLoad && (
            <button onClick={() => { setSlugInput(daily.question.titleSlug); loadQuestion(daily.question.titleSlug) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/30 transition shrink-0 border border-orange-500/30">
              <Calendar size={11} /> Daily
            </button>
          )}

          {/* Session badge — pushed to right on mobile Row 1, hidden on sm+ (shown in Row 2 below) */}
          <button onClick={() => setSPO(o => !o)}
            className={`sm:hidden ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shrink-0 ${sessionOK ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}>
            <Key size={11} />
            {sessionOK ? 'Connected' : 'Setup'}
          </button>
        </div>

        {/* Row 2: Search + Load (full width on mobile) + Session badge (desktop only) */}
        <div className="flex items-center gap-2">
          <div ref={searchWrapRef} className="relative flex flex-1 gap-1.5 items-center bg-gray-800/60 rounded-lg px-3 py-1.5 border border-gray-700/50">
            <Search size={12} className="text-gray-500 shrink-0" />
            <input
              type="text"
              value={slugInput}
              onChange={e => { setSlugInput(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={e => e.key === 'Enter' && loadQuestion()}
              placeholder="Paste LeetCode URL or slug…"
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none min-w-0"
            />
            <button onClick={() => loadQuestion()} disabled={qLoad || !slugInput.trim()}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-500 disabled:opacity-40 transition shrink-0">
              {qLoad ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />}
              Load
            </button>

            {/* Typeahead suggestions (LeetCode + local library) */}
            {searchOpen && slugInput.trim().length > 0 && (lcSearching || lcMatches.length > 0 || matches.length > 0) && (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-gray-700 bg-[#0b1020] shadow-2xl"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {lcSearching && (
                  <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    Searching LeetCode…
                  </div>
                )}

                {lcMatches.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-t border-gray-800">
                    LeetCode
                  </div>
                )}
                {lcMatches.map((m, idx) => (
                  <button
                    key={`lc:${m.slug}:${idx}`}
                    type="button"
                    onClick={() => {
                      setSlugInput(m.slug)
                      setSearchOpen(false)
                      loadQuestion(m.slug)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-gray-800 last:border-b-0"
                  >
                    <div className="text-xs font-semibold text-gray-100">
                      {m.frontendId ? `#${m.frontendId} ` : ''}{m.title}
                    </div>
                    <div className="text-[11px] text-gray-500">{m.slug}</div>
                  </button>
                ))}

                {lcHasMore && (
                  <button
                    type="button"
                    disabled={lcSearching}
                    onClick={() => fetchLcSuggestions(slugInput.trim(), lcNextSkip, true)}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-300 hover:bg-white/5 transition-colors border-t border-gray-800 disabled:opacity-50"
                  >
                    {lcSearching ? 'Loading more…' : 'More results'}
                  </button>
                )}

                {matches.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-t border-gray-800">
                    Library
                  </div>
                )}
                {matches.map(m => (
                  <button
                    key={`lib:${m.id}`}
                    type="button"
                    onClick={() => {
                      setSlugInput(m.slug)
                      setSearchOpen(false)
                      loadQuestion(m.slug)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-gray-800 last:border-b-0"
                  >
                    <div className="text-xs font-semibold text-gray-100">
                      #{m.id} {m.title ?? m.slug}
                    </div>
                    <div className="text-[11px] text-gray-500">{m.slug}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session badge — desktop only (shown on sm+) */}
          <button onClick={() => setSPO(o => !o)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shrink-0 ${sessionOK ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}>
            <Key size={11} />
            {sessionOK ? 'Connected' : 'Setup'}
          </button>
        </div>
      </div>

      {/* ── Session panel overlay ─────────────────────────── */}
      {sessionPanelOpen && (
        <div className="absolute top-[96px] right-0 sm:right-3 z-50 w-full sm:w-80 bg-[#16213e] border border-gray-700 sm:rounded-2xl shadow-2xl p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-200">LeetCode Account</p>
            <button onClick={() => setSPO(false)} className="text-gray-500 hover:text-gray-300"><XCircle size={16} /></button>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg bg-gray-800/60 p-0.5 gap-0.5">
            {(['login', 'cookies'] as const).map(tab => (
              <button key={tab} onClick={() => { setLoginTab(tab); setLcLoginErr('') }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${loginTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {tab === 'login' ? '🔑 Login' : '🍪 Cookies'}
              </button>
            ))}
          </div>

          {/* Login tab */}
          {loginTab === 'login' && (
            <div className="space-y-2">
              <input
                type="text"
                value={lcUsername}
                onChange={e => setLcUsername(e.target.value)}
                placeholder="Username or email"
                autoComplete="username"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 placeholder-gray-500"
              />
              <div className="relative">
                <input
                  type={showLcPwd ? 'text' : 'password'}
                  value={lcPassword}
                  onChange={e => setLcPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && lcLogin()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 placeholder-gray-500 pr-8"
                />
                <button onClick={() => setShowLcPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
                  {showLcPwd ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              {lcLoginErr && (
                <p className="text-xs text-red-400 flex items-start gap-1">
                  <XCircle size={11} className="shrink-0 mt-0.5" /> {lcLoginErr}
                </p>
              )}
              <button
                onClick={lcLogin}
                disabled={lcLogging || !lcUsername.trim() || !lcPassword.trim()}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
              >
                {lcLogging ? <><Loader2 size={12} className="animate-spin" /> Signing in…</> : 'Sign in to LeetCode'}
              </button>
              {lcLoginErr?.includes('CAPTCHA') && (
                <p className="text-xs text-yellow-400/80">
                  Tip: LeetCode is blocking automated login. Switch to the Cookies tab and paste your session manually.
                </p>
              )}
              {sessionOK && (
                <button onClick={clearSession} className="w-full py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition">
                  Disconnect
                </button>
              )}
            </div>
          )}

          {/* Cookies tab */}
          {loginTab === 'cookies' && (
            <div className="space-y-2">
              <div className="flex gap-1.5 bg-blue-500/10 rounded-xl p-3 text-xs text-blue-300 border border-blue-500/20">
                <Info size={12} className="shrink-0 mt-0.5 text-blue-400" />
                <div className="space-y-1">
                  <p>Go to <strong>leetcode.com</strong> → DevTools → Application → Cookies</p>
                  <p>Copy <code className="bg-blue-900/50 px-1 rounded">LEETCODE_SESSION</code> and <code className="bg-blue-900/50 px-1 rounded">csrftoken</code></p>
                </div>
              </div>
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
        <div className="relative z-0 flex-1 flex flex-col sm:flex-row overflow-hidden">

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
            <div className="flex overflow-x-auto border-b border-gray-700/50 shrink-0 bg-[#16213e] scrollbar-none">
              {(['description', 'editorial', 'notes', 'best', 'accepted', 'profile'] as const).map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  className={`px-3 sm:px-4 py-2.5 text-xs font-semibold capitalize transition shrink-0 ${leftTab === tab ? (tab === 'accepted' ? 'text-green-400 border-b-2 border-green-400' : tab === 'best' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-indigo-400 border-b-2 border-indigo-400') : 'text-gray-500 hover:text-gray-300'}`}>
                  {tab === 'profile' ? 'Profile' : tab === 'editorial' ? 'Editorial' : tab === 'notes' ? 'Notes' : tab === 'best' ? 'Best answers' : tab === 'accepted' ? '🏆 Solutions' : 'Description'}
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
                    <a href={leetCodeUrl(question.titleSlug)}
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
                    prose-code:px-1 prose-code:rounded prose-strong:text-gray-100
                    [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:whitespace-pre-wrap
                    [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full
                    [&_img]:max-w-full [&_p]:break-words [&_li]:break-words
                    overflow-x-hidden"
                  dangerouslySetInnerHTML={{ __html: stripScripts(question.content) }}
                />
              </div>
            )}

            {leftTab === 'notes' && (
              <div className="flex-1 overflow-y-auto p-4">
                <WhiteboardNotes storageKey={`lm_whiteboard:${bestAnswersId || matchId || 0}:${question.titleSlug}`} />
              </div>
            )}

            {leftTab === 'editorial' && (
              <div className="flex-1 overflow-y-auto">
                {editorialLoad && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                  </div>
                )}
                {!editorialLoad && editorial === '' && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                    <BookOpen size={24} className="text-gray-600" />
                    <p className="text-sm text-gray-500">No editorial available for this problem.</p>
                    {!sessionOK && <p className="text-xs text-gray-600">Connect your LeetCode session — some editorials require it.</p>}
                  </div>
                )}
                {!editorialLoad && editorial && (
                  <div className="p-5 editorial-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        iframe: ({ src, ...props }: any) => {
                          const url = absolutizeLeetCodeUrl(src)
                          // Only allow embeds from known-safe hosts
                          const ok =
                            url.startsWith('https://leetcode.com/') ||
                            url.startsWith('https://assets.leetcode.com/') ||
                            url.startsWith('https://www.youtube.com/') ||
                            url.startsWith('https://youtube.com/') ||
                            url.startsWith('https://youtu.be/') ||
                            url.startsWith('https://player.vimeo.com/') ||
                            url.startsWith('https://player.bilibili.com/') ||
                            url.startsWith('https://www.bilibili.com/')
                          if (!ok) return null
                          return (
                            <div className="my-4 overflow-hidden rounded-xl border border-gray-700 bg-black">
                              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                                <iframe
                                  src={url}
                                  className="absolute inset-0 h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  referrerPolicy="no-referrer"
                                  {...props}
                                />
                              </div>
                            </div>
                          )
                        },
                        h2: ({ children }: any) => <h2 className="text-base font-bold text-gray-100 mt-6 mb-2 pb-1 border-b border-gray-700">{children}</h2>,
                        h3: ({ children }: any) => <h3 className="text-sm font-bold text-indigo-400 mt-5 mb-2 flex items-center gap-1.5"><span className="w-1 h-4 bg-indigo-400 rounded-full inline-block shrink-0"/>{children}</h3>,
                        h4: ({ children }: any) => <h4 className="text-sm font-semibold text-gray-300 mt-3 mb-1.5">{children}</h4>,
                        p: ({ children }: any) => {
                          const text = String(children)
                          if (text.startsWith('[TOC]') || text === '&nbsp;') return null
                          return <p className="text-sm text-gray-300 leading-relaxed my-2.5">{children}</p>
                        },
                        ul: ({ children }: any) => <ul className="my-2 space-y-1 pl-5 list-none">{children}</ul>,
                        ol: ({ children }: any) => <ol className="my-2 space-y-1 pl-5 list-decimal text-sm text-gray-300">{children}</ol>,
                        li: ({ children }: any) => <li className="text-sm text-gray-300 leading-relaxed flex gap-2"><span className="text-indigo-400 shrink-0 mt-0.5">•</span><span>{children}</span></li>,
                        code: ({ children, className }: any) =>
                          className
                            ? <code className="text-[12px] font-mono">{children}</code>
                            : <code className="bg-gray-800 text-orange-300 border border-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                        pre: ({ children }: any) => {
                          const child = children as React.ReactElement<{ className?: string; children?: string }>
                          const lang = (child?.props?.className ?? '').replace('language-', '') || 'text'
                          const code = child?.props?.children ?? ''
                          return <EditorialCodeBlock code={String(code).trimEnd()} lang={lang} />
                        },
                        hr: () => <hr className="my-4 border-gray-700" />,
                        strong: ({ children }: any) => <strong className="font-semibold text-gray-100">{children}</strong>,
                        blockquote: ({ children }: any) => <blockquote className="border-l-4 border-indigo-500 pl-4 my-3 text-sm text-gray-400 italic">{children}</blockquote>,
                        table: ({ children }: any) => <div className="overflow-x-auto my-3"><table className="text-xs border-collapse w-full">{children}</table></div>,
                        th: ({ children }: any) => <th className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-left font-semibold text-gray-200">{children}</th>,
                        td: ({ children }: any) => <td className="border border-gray-700 px-3 py-1.5 text-gray-300">{children}</td>,
                        img: ({ src, alt, ...props }: any) => {
                          const resolved = src ?? props['data-src'] ?? props['dataSrc']
                          const url = absolutizeLeetCodeUrl(resolved)
                          const srcSet = absolutizeSrcSet(props.srcSet ?? props['srcset'])
                          return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={alt ?? ''}
                            srcSet={srcSet}
                            loading="lazy"
                            className="max-w-full rounded-lg my-3 border border-gray-700"
                            referrerPolicy="no-referrer"
                          />
                          )
                        },
                        source: ({ src, ...props }: any) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <source src={absolutizeLeetCodeUrl(src)} {...props} />
                        ),
                        video: ({ src, ...props }: any) => {
                          const url = absolutizeLeetCodeUrl(src)
                          return (
                            <video
                              {...(url ? { src: url } : {})}
                              controls
                              playsInline
                              className="my-4 w-full max-w-full rounded-xl border border-gray-700 bg-black"
                              {...props}
                            />
                          )
                        },
                      }}
                    >
                      {editorial
                        .replace(/\[TOC\]/g, '')
                        .replace(/\$\$([^$]+)\$\$/g, '`$1`')
                        // Fix protocol-relative URLs (//host/path → https://host/path)
                        .replace(/(src|href|poster)="\/\//g, '$1="https://')
                        // Fix absolute-path URLs (/path → https://leetcode.com/path)
                        .replace(/(src|href|poster)="\//g, '$1="https://leetcode.com/')
                        // Fix markdown image links with protocol-relative URLs
                        .replace(/!\[([^\]]*)\]\(\/\//g, '![$1](https://')
                        .replace(/!\[([^\]]*)\]\(\//g, '![$1](https://leetcode.com/')
                        .trim()}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'best' && bestAnswersId > 0 && (
              <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#16213e] text-gray-100">
                <BestAnswersPanel
                  questionId={bestAnswersId}
                  slug={question.titleSlug}
                  active={leftTab === 'best'}
                  theme="default"
                />
              </div>
            )}

            {leftTab === 'accepted' && (
              <div className="flex-1 overflow-y-auto p-4 h-full min-h-0 bg-[#16213e] text-gray-100">
                <AcceptedSolutions
                  surface="dark"
                  submissions={submissions} loading={subsLoading}
                  selectedSub={selectedSub} subCodeLoading={subCodeLoading}
                  copied={copiedSub} onSelect={loadSubCode} onCopy={copyCode} onBack={clearSub}
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

          {/* RIGHT PANEL — Shared editor */}
          <div className={`${mobilePanel === 'code' ? 'flex' : 'hidden'} sm:flex flex-1 flex-col overflow-hidden`}>
            <LeetCodeEditor appQuestionId={matchId || 0} slug={question.titleSlug} syncToApp={matchId > 0} />
          </div>
        </div>
      )}
    </div>
  )
}


'use client'
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Brain, CheckCircle, Star,
  BookOpen, List, Code2, ExternalLink, Loader2,
  Copy, Check, Circle, RotateCcw, WifiOff, Gauge,
} from 'lucide-react'
import {
  getProgress, updateProgress, completeReview, failReview,
  getStudyPlan, getFcVisited, addFcVisited, addMasteryRunEvent, getMasteryRunsByQuestion,
} from '@/lib/db'
import { QUICK_PATTERNS, QUESTION_SOURCES } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { isDue, formatLocalDate, nextIntervalDays, stripScripts } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import StatusRadio from '@/components/StatusRadio'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import LearnAcSubmitTable from '@/components/learn/LearnAcSubmitTable'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import {
  listDropdownMobileBackdrop, listDropdownMobilePanelClasses,
  listDropdownMobileBackdropDense, listDropdownMobilePanelViewportOnly,
} from '@/lib/listDropdownUi'
import toast from 'react-hot-toast'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISOChicago() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}
function isoAddDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function fmtShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
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

function PremiumBlock({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-bold text-[var(--text)] text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed max-w-xs">
        This question requires a LeetCode Premium subscription to view.
      </p>
      {slug && (
        <a href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          Open on LeetCode ↗
        </a>
      )}
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  description?: string
  python_solution?: string
  cpp_solution?: string
  doocs_url?: string
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SpeedyLearnPage() {
  const online = useOnlineStatus()

  // ── Data ──
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [planOrder,    setPlanOrder]    = useState<number[]>([])
  const [progress,     setProgress]     = useState<Record<string, any>>({})
  const [perDay,       setPerDay]       = useState(3)
  const [planStartISO, setPlanStartISO] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [visited,      setVisited]      = useState<Set<number>>(new Set())
  const [runs,         setRuns]         = useState<Record<string, number>>({})

  // ── Learn panel state ──
  const [qIdx,        setQIdx]        = useState(0)
  const [leftTab,     setLeftTab]     = useState<'description' | 'solution' | 'accepted'>('description')
  const [studyMode,   setStudyMode]   = useState<'show' | 'hide' | null>(null)
  const [reviewDone,  setReviewDone]  = useState(false)
  const [showList,    setShowList]    = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterDiff,  setFilterDiff]  = useState('All')
  const [filterSource, setFilterSource] = useState('All')
  const [filterPattern, setFilterPattern] = useState<string | null>(null)
  const [filterSolved, setFilterSolved] = useState<'All' | 'Unsolved' | 'Solved'>('All')

  // ── LC fetch state ──
  const [lcContent,    setLcContent]    = useState<string | null>(null)
  const [lcLoading,    setLcLoading]    = useState(false)
  const [isPremium,    setIsPremium]    = useState(false)
  const [editorial,    setEditorial]    = useState<string | null>(null)
  const [editorialLoad, setEditorialLoad] = useState(false)
  const [lcSession,    setLcSession]    = useState('')
  const [lcCsrf,       setLcCsrf]       = useState('')
  const lcCacheRef = useRef<Record<string, string>>({})

  // ── Flashcard-specific LC state (separate from description panel) ──
  const [fcLcContent, setFcLcContent] = useState<string | null>(null)
  const [fcLcLoading, setFcLcLoading] = useState(false)
  const [fcIsPremium, setFcIsPremium] = useState(false)

  // ── Day card / reviews / flashcard state ──
  const [dayIdx,       setDayIdx]       = useState(0)
  const [reviewWeek,   setReviewWeek]   = useState(0)
  const [reviewFocus,  setReviewFocus]  = useState<'due' | string>('due')
  const [cardIdx,      setCardIdx]      = useState(0)
  const [flipped,      setFlipped]      = useState(false)
  const [fading,       setFading]       = useState(false)
  const [showCardList, setShowCardList] = useState(false)
  const [fcFilterDiff,    setFcFilterDiff]    = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All')
  const [fcFilterSolved,  setFcFilterSolved]  = useState<'All' | 'Unsolved' | 'Solved'>('All')
  const [fcFilterSource,  setFcFilterSource]  = useState('All')
  const [fcFilterPattern, setFcFilterPattern] = useState<string | null>(null)

  // ── Mobile layout ──
  const [mobileTab, setMobileTab] = useState<'daily' | 'description' | 'editor'>('daily')

  // ── Refs ──
  const listWrapRef           = useRef<HTMLDivElement>(null)
  const cardsPanelRef         = useRef<HTMLDivElement>(null)
  const cardListWrapMobileRef = useRef<HTMLDivElement>(null)
  const cardListWrapDesktopRef = useRef<HTMLDivElement>(null)
  const todayCardsRef         = useRef<HTMLDivElement>(null)

  // ── Load data ──
  useEffect(() => {
    async function load() {
      try {
        const [qs, plan, prog, vis, mr] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getStudyPlan(),
          getProgress(),
          getFcVisited(),
          getMasteryRunsByQuestion(),
        ])
        setQuestions(qs)
        setProgress(prog)
        setVisited(vis)
        setRuns(mr)
        if (plan?.question_order?.length) {
          setPlanOrder(plan.question_order)
          setPerDay(plan.per_day || 3)
          if (plan?.start_date) setPlanStartISO(String(plan.start_date))
        } else {
          setPlanOrder((qs as Question[]).map((q: Question) => q.id))
        }
      } catch (e) {
        console.error('[speedylearn] load failed:', e)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Study mode from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lm_study_mode')
      setStudyMode(saved === 'show' || saved === 'hide' ? saved : null)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (studyMode !== null) {
      try { localStorage.setItem('lm_study_mode', studyMode) } catch { /* ignore */ }
    }
  }, [studyMode])

  // ── LC session from API ──
  useEffect(() => {
    fetch('/api/lc-session').then(r => r.json()).then(d => {
      setLcSession(d.lc_session ?? '')
      setLcCsrf(d.lc_csrf ?? '')
    }).catch(() => {})
  }, [])

  // ── Close list on outside click ──
  useEffect(() => {
    if (!showList) return
    function onDown(e: MouseEvent | TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-sl-list]')) return
      setShowList(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showList])

  // ── Close filters on outside click ──
  useEffect(() => {
    if (!showFilters) return
    function onDown(e: MouseEvent | TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-sl-filter]')) return
      setShowFilters(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showFilters])

  // ── Close card list on outside click ──
  useEffect(() => {
    if (!showCardList) return
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node
      if (cardListWrapMobileRef.current?.contains(t) || cardListWrapDesktopRef.current?.contains(t)) return
      setShowCardList(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showCardList])

  // ── Derived: question map + filtered list ──
  const qMap = useMemo(() => Object.fromEntries(questions.map(q => [q.id, q])), [questions])
  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])

  const orderedQuestions: Question[] = useMemo(() => {
    const ordered = planOrder.length
      ? planOrder.map(id => qMap[id]).filter(Boolean) as Question[]
      : questions
    return ordered.filter(q => {
      if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
      if (filterSource !== 'All' && !(q.source || []).includes(filterSource)) return false
      if (filterPattern && exclusiveMap[q.id] !== filterPattern) return false
      const p = progress[String(q.id)] || {}
      if (filterSolved === 'Solved' && !p.solved) return false
      if (filterSolved === 'Unsolved' && p.solved) return false
      return true
    })
  }, [questions, planOrder, qMap, filterDiff, filterSource, filterPattern, filterSolved, exclusiveMap, progress])

  const safeIdx = Math.min(qIdx, Math.max(orderedQuestions.length - 1, 0))
  const q       = orderedQuestions[safeIdx] || null
  const p       = q ? (progress[String(q.id)] || {}) : {}
  const solved    = p.solved    || false
  const starred   = p.starred   || false
  const status    = p.status    || null
  const reviewCount = p.review_count || 0
  const nextReview  = p.next_review  || null
  const due = isDue(nextReview) && solved

  const solvedCount = orderedQuestions.filter(fq => progress[String(fq.id)]?.solved).length

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(q?.slug, leftTab === 'accepted')

  // ── Pattern context ──
  const currentPatternName = q ? (exclusiveMap[q.id] ?? null) : null
  const currentPattern     = currentPatternName ? QUICK_PATTERNS.find(p => p.name === currentPatternName) ?? null : null
  const patternQs          = currentPatternName ? questions.filter(qq => exclusiveMap[qq.id] === currentPatternName) : []
  const patternSolved      = patternQs.filter(qq => progress[String(qq.id)]?.solved).length
  const patternPct         = patternQs.length ? Math.round((patternSolved / patternQs.length) * 100) : 0

  // ── Reset per question ──
  useEffect(() => {
    setReviewDone(false)
    setLcContent(null)
    setIsPremium(false)
    setLeftTab('description')
  }, [q?.id])

  // ── Fetch live LC description ──
  useEffect(() => {
    if (!q?.slug) return
    if (lcCacheRef.current[q.slug]) {
      setLcContent(lcCacheRef.current[q.slug])
      setLcLoading(false)
      return
    }
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const session   = typeof window !== 'undefined' ? localStorage.getItem('lc_session')  || '' : ''
    const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('lc_csrf')     || '' : ''
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug: q.slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[q.slug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.slug])

  // ── Fetch editorial ──
  useEffect(() => {
    if (leftTab !== 'solution' || !q?.slug) return
    setEditorial(null)
    setEditorialLoad(true)
    const creds = lcSession && lcCsrf ? { session: lcSession, csrfToken: lcCsrf } : {}
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($s:String!){question(titleSlug:$s){solution{content paidOnly}}}',
        variables: { s: q.slug },
        ...creds,
      }),
    })
      .then(r => r.json())
      .then(async data => {
        const content = data?.data?.question?.solution?.content
        if (!content) return
        const iframeRe = /https:\/\/leetcode\.com\/playground\/([A-Za-z0-9]+)\/shared/g
        const uuids: string[] = []
        let m: RegExpExecArray | null
        while ((m = iframeRe.exec(content)) !== null) {
          if (!uuids.includes(m[1])) uuids.push(m[1])
        }
        if (uuids.length === 0) { setEditorial(content); return }
        const codeMap: Record<string, string> = {}
        await Promise.all(uuids.map(async uuid => {
          try {
            const res = await fetch('/api/leetcode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: 'query($u:String!){allPlaygroundCodes(uuid:$u){code langSlug}}', variables: { u: uuid }, ...creds }),
            })
            const d = await res.json()
            const codes: Array<{ code: string; langSlug: string }> = d?.data?.allPlaygroundCodes ?? []
            const pick = codes.find(c => c.langSlug === 'cpp') ?? codes.find(c => c.langSlug === 'python3') ?? codes.find(c => c.langSlug === 'python') ?? codes[0]
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
        setEditorial(processed)
      })
      .catch(() => {})
      .finally(() => setEditorialLoad(false))
  }, [leftTab, q?.slug, lcSession, lcCsrf])

  // ── Navigation ──
  const goNext = useCallback(() => {
    if (safeIdx < orderedQuestions.length - 1) setQIdx(safeIdx + 1)
  }, [safeIdx, orderedQuestions.length])

  const goPrev = useCallback(() => {
    if (safeIdx > 0) setQIdx(safeIdx - 1)
  }, [safeIdx])

  const goTo = useCallback((i: number) => {
    setQIdx(i)
    setShowList(false)
  }, [])

  // ── Save progress ──
  const save = useCallback(async (patch: any = {}) => {
    if (!q) return
    const updated = { solved, starred, status, ...patch, question_id: q.id }
    await updateProgress(q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
  }, [q, solved, starred, status])

  const handleCompleteReview = useCallback(async () => {
    if (!q) return
    const result = await completeReview(q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
    }))
    setReviewDone(true)
  }, [q])

  const handleFailReview = useCallback(async () => {
    if (!q) return
    const result = await failReview(q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
    }))
    setReviewDone(true)
  }, [q])

  // ── onAccepted: mark solved + complete review if due ──
  const handleAccepted = useCallback(async () => {
    if (!q) return
    const updated = { solved: true, question_id: q.id }
    await updateProgress(q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
    toast.success(`✅ ${q.title} marked as solved!`)
    if (due && !reviewDone) {
      const result = await completeReview(q.id)
      setProgress(prev => ({
        ...prev,
        [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
      }))
      setReviewDone(true)
    }
  }, [q, due, reviewDone])

  // ── Speedster: day cards ──
  const days = useMemo(() => {
    const d: number[][] = []
    for (let i = 0; i < planOrder.length; i += perDay) d.push(planOrder.slice(i, i + perDay))
    return d
  }, [planOrder, perDay])

  const todayScheduleIdx = useMemo(() => {
    try {
      const base = planStartISO || todayISOChicago()
      const [sy, sm, sd] = base.split('-').map(Number)
      const [ty, tm, td] = todayISOChicago().split('-').map(Number)
      const start = new Date(sy, (sm ?? 1) - 1, sd ?? 1, 12, 0, 0).getTime()
      const today = new Date(ty, (tm ?? 1) - 1, td ?? 1, 12, 0, 0).getTime()
      const diff = Math.floor((today - start) / (24 * 60 * 60 * 1000))
      return !Number.isFinite(diff) || diff < 0 ? 0 : diff
    } catch { return 0 }
  }, [planStartISO])

  const totalDays  = days.length
  const currentDay = days[dayIdx] ?? []
  const daySolved  = currentDay.filter(id => !!progress[String(id)]?.solved).length
  const [dayFilter, setDayFilter] = useState<'All' | 'Unsolved' | 'Solved'>('All')
  const currentDayFiltered = currentDay.filter(id => {
    const s = !!progress[String(id)]?.solved
    if (dayFilter === 'Unsolved' && s) return false
    if (dayFilter === 'Solved' && !s) return false
    return true
  })

  // ── Speedster: SR reviews ──
  const srItems = planOrder
    .map(id => {
      const pp = progress[String(id)] || {}
      return { id, next_review: pp.next_review as string | null, review_count: pp.review_count as number | undefined, solved: !!pp.solved }
    })
    .filter(x => x.solved && !!x.next_review)

  const srToday  = todayISOChicago()
  const srStart  = isoAddDays(srToday, reviewWeek * 7)
  const srEnd    = isoAddDays(srStart, 7)
  const srDays   = Array.from({ length: 8 }, (_, i) => isoAddDays(srStart, i))
  const srDue    = srItems.filter(x => (x.next_review as string) <= srStart)
  const srByDay: Record<string, typeof srItems> = {}
  for (const d of srDays) srByDay[d] = []
  for (const it of srItems) {
    const nr = it.next_review as string
    if (nr < srStart || nr > srEnd) continue
    if (!srByDay[nr]) srByDay[nr] = []
    srByDay[nr].push(it)
  }

  // ── Speedster: flashcard filtered list ──
  const fcFilteredOrder = useMemo(() => planOrder.filter(id => {
    const fq = qMap[id]
    if (!fq) return false
    if (fcFilterDiff !== 'All' && fq.difficulty !== fcFilterDiff) return false
    const s = !!progress[String(id)]?.solved
    if (fcFilterSolved === 'Unsolved' && s) return false
    if (fcFilterSolved === 'Solved'   && !s) return false
    if (fcFilterSource !== 'All' && !(fq.source || []).includes(fcFilterSource)) return false
    if (fcFilterPattern && exclusiveMap[id] !== fcFilterPattern) return false
    return true
  }), [planOrder, qMap, fcFilterDiff, fcFilterSolved, fcFilterSource, fcFilterPattern, progress, exclusiveMap])

  const fcTotal         = fcFilteredOrder.length
  const fcCurrentQ      = qMap[fcFilteredOrder[cardIdx]]
  const filteredVisited = fcFilteredOrder.filter(id => visited.has(id)).length

  useEffect(() => { setCardIdx(0); setFlipped(false) }, [fcFilterDiff, fcFilterSolved, fcFilterSource, fcFilterPattern])

  // ── Fetch LC description for current flashcard question ──
  useEffect(() => {
    const slug = fcCurrentQ?.slug
    if (!slug) return
    setFcIsPremium(false)
    if (lcCacheRef.current[slug]) {
      setFcLcContent(lcCacheRef.current[slug])
      setFcLcLoading(false)
      return
    }
    setFcLcContent(null)
    let cancelled = false
    setFcLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const session   = typeof window !== 'undefined' ? localStorage.getItem('lc_session')  || '' : ''
    const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('lc_csrf')     || '' : ''
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug: slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setFcIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[slug] = qd.content; setFcLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setFcLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [fcCurrentQ?.slug])

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    const panel = cardsPanelRef.current
    const savedScroll = panel ? panel.scrollTop : window.scrollY
    const restore = () => {
      if (panel) panel.scrollTop = savedScroll
      else window.scrollTo(0, savedScroll)
    }
    fadeSwap(() => setFlipped(f => !f))
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }, [fadeSwap])

  const goCard = useCallback((dir: number) => {
    fadeSwap(() => { setFlipped(false); setCardIdx(i => Math.max(0, Math.min(fcTotal - 1, i + dir))) })
  }, [fcTotal, fadeSwap])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return
      if (el?.getAttribute?.('contenteditable') !== null) return
      if (e.key === 'ArrowRight') goCard(1)
      if (e.key === 'ArrowLeft')  goCard(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goCard, handleFlip])

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm gap-2">
        <Gauge size={16} className="animate-spin" /> Loading…
      </div>
    )
  }

  // ─── Question list for dropdown ────────────────────────────────────────────

  const questionListItems = (
    <>
      {orderedQuestions.map((fq, i) => {
        const fp = progress[String(fq.id)] || {}
        return (
          <button key={fq.id} type="button" onClick={() => goTo(i)}
            className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 border-b border-gray-50 ${i === safeIdx ? 'bg-indigo-50' : ''}`}>
            <span className="shrink-0 tabular-nums text-xs font-mono text-gray-500">#{fq.id}</span>
            <span className="min-w-0 flex-1 truncate text-gray-700">{fq.title}</span>
            <span className={`text-xs font-semibold shrink-0 ${fq.difficulty === 'Easy' ? 'text-green-600' : fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
              {fq.difficulty[0]}
            </span>
            {fp.solved && <CheckCircle size={11} className="text-green-500 shrink-0" />}
          </button>
        )
      })}
      {orderedQuestions.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No questions match.</p>}
    </>
  )

  // ─── Left panel (description / solution / accepted) ───────────────────────

  const leftPanel = q ? (
    <div className="flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] overflow-hidden text-[var(--text)]">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        <button onClick={() => setLeftTab('description')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          <BookOpen size={12} /> Description
          {lcLoading && <Loader2 size={10} className="animate-spin text-gray-300 ml-0.5" />}
        </button>
        {(q.python_solution || q.cpp_solution) && studyMode === 'show' && (
          <button onClick={() => setLeftTab('solution')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'solution' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <Code2 size={12} /> Solution
          </button>
        )}
        <button onClick={() => setLeftTab('accepted')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          🏆 My Solutions
        </button>
        <button onClick={() => setStudyMode(prev => prev === 'hide' ? 'show' : 'hide')}
          className={`ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${studyMode === 'hide' ? 'text-orange-500 hover:text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
          🧠 {studyMode === 'hide' ? 'Challenge' : 'Review'}
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {/* Description tab */}
        {leftTab === 'description' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                <DifficultyBadge difficulty={q.difficulty} />
                {status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border capitalize ${
                    status === 'mastered' ? 'bg-green-100 text-green-700 border-green-300'
                    : status === 'revised' ? 'bg-orange-100 text-orange-700 border-orange-300'
                    : status === 'reviewed' ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}>{status}</span>
                )}
              </div>
              <h1 className="font-bold text-[var(--text)] text-base leading-snug">{q.title}</h1>
              {solved && nextReview && !due && (
                <p className="text-xs text-green-600 mt-1">
                  🗓 Next review: {formatLocalDate(nextReview)} · {nextIntervalDays(reviewCount + 1)}d interval
                </p>
              )}
            </div>

            {(q.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {q.tags.map(t => (
                  <span key={t} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}

            {/* SR review banner */}
            {due && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Review #{reviewCount + 1} due!</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleFailReview} disabled={reviewDone}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${reviewDone ? 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)]' : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-300'}`}>
                    Again
                  </button>
                  <button onClick={handleCompleteReview} disabled={reviewDone}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${reviewDone ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                    {reviewDone ? `✓ Next in ${nextIntervalDays(reviewCount + 1)}d` : 'Pass'}
                  </button>
                </div>
              </div>
            )}

            {/* Live LC description */}
            {lcContent ? (
              <div className="lc-description text-sm text-[var(--text)]" dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
            ) : isPremium ? (
              <PremiumBlock slug={q.slug} />
            ) : lcLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-2" />
                <div className="h-3 bg-[var(--bg-muted)] rounded w-3/4" />
              </div>
            ) : (
              <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {q.description || (
                  <span className="text-[var(--text-subtle)] italic text-xs">
                    No description cached.{' '}
                    <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                      className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                  </span>
                )}
              </div>
            )}

            {(q.source || []).length > 0 && (
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide mb-1.5">Asked by</p>
                <div className="flex flex-wrap gap-1.5">
                  {q.source.map(s => (
                    <span key={s} className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Brain size={12} className="text-indigo-500" /> How well do you know this?
                </span>
                {solved && nextReview && (
                  <span className="text-xs text-green-600 font-medium">{formatLocalDate(nextReview)}</span>
                )}
              </div>
              <StatusRadio
                value={status}
                onChange={s => {
                  if (s === 'mastered' && !solved) save({ status: s, solved: true })
                  else if (s === null && status === 'mastered') save({ status: null, solved: false })
                  else save({ status: s })
                }}
              />
              {solved && nextReview ? (
                <p className="text-xs text-green-600 mt-2">
                  ✅ Review #{reviewCount + 1} in {nextIntervalDays(reviewCount)} day{nextIntervalDays(reviewCount) !== 1 ? 's' : ''} · {formatLocalDate(nextReview)}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-subtle)] mt-2">Mark Solved to start spaced repetition.</p>
              )}
            </div>
          </div>
        )}

        {/* Solution tab */}
        {leftTab === 'solution' && studyMode === 'show' && (
          <div className="p-4 space-y-4">
            <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
            <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 dark:from-indigo-950/30 to-transparent border-b border-[var(--border)]">
                <BookOpen size={14} className="text-indigo-500 shrink-0" />
                <span className="text-sm font-bold text-[var(--text)]">Official Editorial</span>
                <span className="ml-auto text-xs text-indigo-400 font-medium">LeetCode</span>
              </div>
              {editorialLoad ? (
                <div className="flex items-center justify-center py-10 gap-2 text-[var(--text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs">Loading editorial…</span>
                </div>
              ) : editorial ? (
                <div className="p-5 editorial-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      iframe: () => null,
                      h2: ({ children }) => <h2 className="text-base font-bold text-[var(--text)] mt-6 mb-2 pb-1 border-b border-[var(--border)]">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-5 mb-2 flex items-center gap-1.5"><span className="w-1 h-4 bg-indigo-400 rounded-full inline-block shrink-0"/>{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-semibold text-[var(--text)] mt-3 mb-1.5">{children}</h4>,
                      p: ({ children }) => {
                        const text = String(children)
                        if (text.startsWith('[TOC]') || text === '&nbsp;') return null
                        return <p className="text-sm text-[var(--text)] leading-relaxed my-2.5">{children}</p>
                      },
                      ul: ({ children }) => <ul className="my-2 space-y-1 pl-5 list-none">{children}</ul>,
                      ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal text-sm text-[var(--text)]">{children}</ol>,
                      li: ({ children }) => <li className="text-sm text-[var(--text)] leading-relaxed flex gap-2"><span className="text-indigo-400 shrink-0 mt-0.5">•</span><span>{children}</span></li>,
                      code: ({ children, className }) =>
                        className
                          ? <code className="text-[12px] font-mono">{children}</code>
                          : <code className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                      pre: ({ children }) => {
                        const child = children as React.ReactElement<{ className?: string; children?: string }>
                        const lang = (child?.props?.className ?? '').replace('language-', '') || 'text'
                        const code = child?.props?.children ?? ''
                        return <EditorialCodeBlock code={String(code).trimEnd()} lang={lang} />
                      },
                      hr: () => <hr className="my-4 border-[var(--border)]" />,
                      strong: ({ children }) => <strong className="font-semibold text-[var(--text)]">{children}</strong>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-300 pl-4 my-3 text-sm text-[var(--text-muted)] italic">{children}</blockquote>,
                      table: ({ children }) => <div className="overflow-x-auto my-3"><table className="text-xs border-collapse w-full">{children}</table></div>,
                      th: ({ children }) => <th className="bg-[var(--bg-muted)] border border-[var(--border)] px-3 py-1.5 text-left font-semibold text-[var(--text)]">{children}</th>,
                      td: ({ children }) => <td className="border border-[var(--border)] px-3 py-1.5 text-[var(--text)]">{children}</td>,
                    }}
                  >
                    {editorial
                      .replace(/\[TOC\]/g, '')
                      .replace(/##\s*Video Solution[\s\S]*?(?=##\s|\z)/m, '')
                      .replace(/<div[^>]*class="video-container"[^>]*>[\s\S]*?<\/div>/g, '')
                      .replace(/\$\$([^$]+)\$\$/g, '`$1`')
                      .trim()}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[var(--text-subtle)]">
                  No editorial available for this question.
                </div>
              )}
            </div>
          </div>
        )}
        {leftTab === 'solution' && studyMode === 'hide' && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="font-bold text-[var(--text)] text-sm mb-1">Answers Hidden</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">You're in Challenge Mode. Try solving it yourself first!</p>
            <button onClick={() => setStudyMode('show')} className="text-xs text-indigo-500 underline">Switch to Review Mode</button>
          </div>
        )}
        {leftTab === 'accepted' && (
          <div className="p-4 h-full">
            <AcceptedSolutions
              submissions={submissions} loading={subsLoading}
              selectedSub={selectedSub} subCodeLoading={subCodeLoading}
              copied={copiedSub} onSelect={loadSubCode} onCopy={copyCode} onBack={clearSub}
            />
          </div>
        )}
      </div>
    </div>
  ) : null

  // ─── Editor panel ─────────────────────────────────────────────────────────

  const editorPanel = q ? (
    online ? (
      <LeetCodeEditor
        key={q.slug}
        appQuestionId={q.id}
        slug={q.slug}
        onAccepted={handleAccepted}
      />
    ) : (
      <div className="flex flex-col flex-1 min-h-0 bg-[#1a1a2e] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#16213e] border-b border-gray-700/50 shrink-0">
          <WifiOff size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 font-semibold">You're offline — live editor unavailable</p>
        </div>
        <div className="p-4 min-w-0 w-full">
          <p className="text-xs text-gray-400 mb-3">Showing saved solution for #{q.id} · {q.title}</p>
          <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
        </div>
      </div>
    )
  ) : null

  // ─── Flashcard filter bar (shared) ───────────────────────────────────────

  const anyFcFilter = fcFilterDiff !== 'All' || fcFilterSolved !== 'All' || fcFilterSource !== 'All' || fcFilterPattern !== null
  const fcFilterBar = (
    <div className="space-y-2 mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
          <button key={d} onClick={() => setFcFilterDiff(d)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              fcFilterDiff === d
                ? d === 'Easy' ? 'bg-green-500 text-white border-green-500'
                : d === 'Medium' ? 'bg-yellow-500 text-white border-yellow-500'
                : d === 'Hard' ? 'bg-red-500 text-white border-red-500'
                : 'bg-gray-800 text-white border-gray-800'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-400'
            }`}>
            {d}
          </button>
        ))}
        <div className="w-px h-4 bg-[var(--border)] mx-0.5 shrink-0" />
        <button onClick={() => setFcFilterSolved(s => s === 'Unsolved' ? 'All' : 'Unsolved')} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${fcFilterSolved === 'Unsolved' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-400'}`}>
          Unsolved
        </button>
        <button onClick={() => setFcFilterSolved(s => s === 'Solved' ? 'All' : 'Solved')} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${fcFilterSolved === 'Solved' ? 'bg-green-600 text-white border-green-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-400'}`}>
          Solved
        </button>
        <span className="text-xs text-[var(--text-subtle)] ml-auto shrink-0">{fcTotal} shown</span>
        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-500/30 px-2 py-0.5 rounded-full shrink-0">
          <CheckCircle size={11} /> {visited.size} visited
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUESTION_SOURCES.map(s => (
          <button key={s.value} onClick={() => setFcFilterSource(s.value)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${fcFilterSource === s.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFcFilterPattern(null)} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${!fcFilterPattern ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-cyan-300'}`}>
          All Patterns
        </button>
        {QUICK_PATTERNS.map(pp => (
          <button key={pp.name} onClick={() => setFcFilterPattern(fcFilterPattern === pp.name ? null : pp.name)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${fcFilterPattern === pp.name ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-cyan-300'}`}>
            {pp.name}
          </button>
        ))}
      </div>
      {anyFcFilter && (
        <button onClick={() => { setFcFilterDiff('All'); setFcFilterSolved('All'); setFcFilterSource('All'); setFcFilterPattern(null) }}
          style={{ touchAction: 'manipulation' }}
          className="px-2.5 py-1 rounded-lg text-xs text-[var(--text-subtle)] border border-[var(--border)] hover:text-[var(--text-muted)] transition-colors">
          Clear all filters
        </button>
      )}
    </div>
  )

  const cardListDropdownRows = fcFilteredOrder.map((qid, i) => {
    const fq = qMap[qid]
    if (!fq) return null
    const done = !!progress[String(qid)]?.solved
    return (
      <button key={qid} type="button"
        onClick={() => { setCardIdx(i); setFlipped(false); setShowCardList(false) }}
        className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-yellow-50 border-b border-[var(--border)] last:border-0 transition-colors ${i === cardIdx ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
        <span className="shrink-0 tabular-nums text-xs font-mono text-[var(--text-subtle)]">#{fq.id}</span>
        <span className="min-w-0 flex-1 truncate text-[var(--text)]">{fq.title}</span>
        <span className={`text-xs font-semibold shrink-0 ${fq.difficulty === 'Easy' ? 'text-green-600' : fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
          {fq.difficulty[0]}
        </span>
        {done && <CheckCircle size={11} className="text-green-500 shrink-0" />}
      </button>
    )
  })

  // ─── Speedster sections (day cards + reviews + flashcards) ────────────────

  const speedsterSections = (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
          <Gauge size={18} className="text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h2 className="font-black text-[var(--text)] text-lg leading-tight">SpeedyLearn</h2>
          <p className="text-xs text-[var(--text-subtle)]">Accepted submissions mark questions as solved</p>
        </div>
      </div>

      {/* Day card navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDayIdx(i => Math.max(0, i - 1))} disabled={dayIdx === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={16} /> Prev
        </button>
        <div className="text-center">
          <p className="text-base font-black text-[var(--text)]">Day {dayIdx + 1}</p>
          <p className="text-xs text-[var(--text-subtle)]">{daySolved}/{currentDay.length} solved · {dayIdx + 1} of {totalDays} days</p>
        </div>
        <button onClick={() => setDayIdx(i => Math.min(totalDays - 1, i + 1))} disabled={dayIdx === totalDays - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next <ChevronRight size={16} />
        </button>
      </div>

      <div className="h-1 bg-[var(--bg-muted)] rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: totalDays ? `${((dayIdx + 1) / totalDays) * 100}%` : '0%' }} />
      </div>

      {/* Day filter pills */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {(['All', 'Unsolved', 'Solved'] as const).map(f => (
          <button key={f} type="button" onClick={() => setDayFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              dayFilter === f
                ? f === 'Unsolved' ? 'bg-orange-600 text-white border-orange-600'
                : f === 'Solved'   ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-400'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Day card — clicking a question navigates the editor to it */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden mb-3">
        {currentDayFiltered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-[var(--text-subtle)]">No questions match this filter.</div>
        )}
        {currentDayFiltered.map((qid, i) => {
          const dq = qMap[qid]
          if (!dq) return null
          const isSolved = !!progress[String(qid)]?.solved
          const idxInFiltered = orderedQuestions.findIndex(oq => oq.id === qid)
          return (
            <button key={qid} type="button"
              onClick={() => {
                if (idxInFiltered >= 0) {
                  setQIdx(idxInFiltered)
                  setMobileTab('editor')
                }
              }}
              className={`flex w-full items-center gap-3 px-3 sm:px-5 py-3 sm:py-4 text-left transition-colors group ${i > 0 ? 'border-t border-[var(--border)]' : ''} ${isSolved ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100/60 dark:hover:bg-green-900/30' : 'hover:bg-yellow-50/40 dark:hover:bg-yellow-950/20'}`}>
              <div className="shrink-0">
                {isSolved
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <Circle size={18} className="text-[var(--border)] group-hover:text-yellow-300 transition-colors" />}
              </div>
              <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{dq.id}</span>
              <span className={`flex-1 text-sm font-semibold truncate ${isSolved ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>{dq.title}</span>
              <DifficultyBadge difficulty={dq.difficulty} />
              <ChevronRight size={14} className="text-[var(--border)] group-hover:text-yellow-400 shrink-0 transition-colors" />
            </button>
          )
        })}
      </div>

      <button type="button"
        onPointerDown={e => {
          e.preventDefault()
          const idx = Math.max(0, Math.min(totalDays - 1, todayScheduleIdx))
          setDayIdx(idx)
          if (cardsPanelRef.current) cardsPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          else window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        className="w-full mt-3 mb-6 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 text-sm font-bold hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
        style={{ touchAction: 'manipulation' }}>
        View today questions
      </button>

      {totalDays <= 20 && (
        <div className="flex justify-center gap-1.5 mb-10 flex-wrap">
          {days.map((_, i) => (
            <button key={i} onClick={() => setDayIdx(i)}
              className={`rounded-full transition-all ${i === dayIdx ? 'w-4 h-4 bg-yellow-500' : 'w-3 h-3 bg-[var(--bg-muted)] hover:bg-yellow-300'}`} />
          ))}
        </div>
      )}

      {/* Reviews calendar */}
      <div className="mb-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <Brain size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text)]">Reviews</p>
              <p className="text-xs text-[var(--text-subtle)]">
                {reviewWeek === 0 ? 'Due + next 7 days' : `${fmtShort(srStart)} → ${fmtShort(srEnd)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => { setReviewWeek(w => Math.max(0, w - 1)); setReviewFocus('due') }}
              disabled={reviewWeek === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <button type="button" onClick={() => { setReviewWeek(w => w + 1); setReviewFocus(srDays[0] ?? 'due') }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-[var(--border)] scrollbar-none">
            <button type="button" onClick={() => setReviewFocus('due')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${reviewFocus === 'due' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
              Due <span className="opacity-80">· {srDue.length}</span>
            </button>
            {srDays.map(d => (
              <button key={d} type="button" onClick={() => setReviewFocus(d)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${reviewFocus === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
                {fmtShort(d)} <span className="opacity-80">· {srByDay[d]?.length ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="p-3 space-y-2">
            {(reviewFocus === 'due' ? srDue : (srByDay[reviewFocus] ?? [])).length === 0 ? (
              <div className="text-xs text-[var(--text-subtle)] py-2">No reviews in this bucket.</div>
            ) : (
              (reviewFocus === 'due' ? srDue : (srByDay[reviewFocus] ?? [])).map(it => {
                const rq = qMap[it.id]
                if (!rq) return null
                const idxInFiltered = orderedQuestions.findIndex(oq => oq.id === it.id)
                return (
                  <button key={it.id} type="button"
                    onClick={() => { if (idxInFiltered >= 0) { setQIdx(idxInFiltered); setMobileTab('editor') } }}
                    className="flex w-full items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-indigo-200 hover:bg-indigo-50/10 text-left transition-colors">
                    <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{it.id}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-[var(--text)] truncate">{rq.title}</span>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0">
                      Review #{(it.review_count ?? 0) + 1}
                    </span>
                    <DifficultyBadge difficulty={rq.difficulty} />
                    <ChevronRight size={14} className="text-[var(--text-subtle)] shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Flashcards section */}
      <div className="border-t-2 border-dashed border-yellow-200 dark:border-yellow-800/40 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[var(--text)]">⚡ Flashcards</h2>
          <p className="text-xs text-[var(--text-subtle)] hidden sm:block">Tap to flip · ← → keys · Space</p>
        </div>

        {fcFilterBar}

        {/* Nav bar */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => goCard(-1)} disabled={cardIdx === 0}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
            <ChevronLeft size={15} />
          </button>

          <div ref={cardListWrapDesktopRef} className="relative z-10">
            <button type="button" onClick={() => setShowCardList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-yellow-400 transition-colors">
              <List size={12} />
              <span className="font-mono">{cardIdx + 1}/{fcTotal}</span>
              <span className="text-[var(--text-subtle)]">·</span>
              <span className="flex items-center gap-0.5 text-green-600"><CheckCircle size={10} />{filteredVisited}/{fcTotal} visited</span>
            </button>
            {showCardList && (
              <div className="absolute top-full left-0 z-[100] mt-1 max-h-[min(70vh,20rem)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl sm:w-80">
                {cardListDropdownRows}
              </div>
            )}
          </div>

          <button onClick={() => goCard(1)} disabled={cardIdx === fcTotal - 1}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
            <ChevronRight size={15} />
          </button>

          <div className="flex-1 bg-[var(--bg-muted)] rounded-full h-1.5 min-w-[40px]">
            <div className="bg-yellow-400 h-1.5 rounded-full transition-all"
              style={{ width: fcTotal ? `${((cardIdx + 1) / fcTotal) * 100}%` : '0%' }} />
          </div>

          <button onClick={() => fadeSwap(() => { setCardIdx(0); setFlipped(false) })}
            title="Reset to start"
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition-colors">
            <RotateCcw size={13} />
          </button>
        </div>

        {fcTotal === 0 && (
          <div className="text-center py-10 text-[var(--text-subtle)] text-sm">No questions match this filter.</div>
        )}
        {fcCurrentQ && (
          <>
            <div onClick={handleFlip} className="cursor-pointer select-none w-full min-w-0"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease', touchAction: 'manipulation' }}>
              {!flipped ? (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-md overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-[var(--border)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--text-subtle)] font-mono">#{fcCurrentQ.id}</span>
                      <DifficultyBadge difficulty={fcCurrentQ.difficulty} />
                      {(fcCurrentQ.source || []).map(s => (
                        <span key={s} className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/30">{s}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const next = new Set(visited)
                          if (next.has(fcCurrentQ.id)) { next.delete(fcCurrentQ.id) } else { next.add(fcCurrentQ.id); addFcVisited(fcCurrentQ.id) }
                          setVisited(next)
                        }}
                        style={{ touchAction: 'manipulation' }}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                          visited.has(fcCurrentQ.id) ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/40' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                        }`}>
                        {visited.has(fcCurrentQ.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                      </button>
                      <span className="hidden sm:inline text-xs text-[var(--text-subtle)] font-medium">Tap to reveal →</span>
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 pt-2 sm:pt-3 pb-1">
                    <h3 className="text-base font-bold text-[var(--text)]">{fcCurrentQ.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(fcCurrentQ.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 pb-3 sm:pb-5 mt-2" onClick={e => e.stopPropagation()}>
                    {fcLcContent ? (
                      <div className="lc-description text-sm text-[var(--text)]"
                        dangerouslySetInnerHTML={{ __html: stripScripts(fcLcContent) }} />
                    ) : fcLcLoading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                        <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                        <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                        <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-2" />
                      </div>
                    ) : fcIsPremium ? (
                      <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium question</p>
                    ) : (
                      <p className="text-xs text-[var(--text-subtle)] italic">Tap card to reveal solution</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-300 dark:border-indigo-500/50 shadow-md overflow-hidden w-full min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs text-[var(--text-subtle)] font-mono">#{fcCurrentQ.id}</span>
                      <DifficultyBadge difficulty={fcCurrentQ.difficulty} />
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">{fcCurrentQ.title}</span>
                    </div>
                    <span className="text-xs text-indigo-400 dark:text-indigo-300 font-medium shrink-0">← Flip back</span>
                  </div>
                  <div className="p-4 min-w-0" onClick={e => e.stopPropagation()}>
                    <CodePanel pythonCode={fcCurrentQ.python_solution} cppCode={fcCurrentQ.cpp_solution} />
                  </div>
                </div>
              )}
            </div>

            {/* Open this card in editor */}
            <button
              onClick={() => {
                const idx = orderedQuestions.findIndex(oq => oq.id === fcCurrentQ.id)
                if (idx >= 0) { setQIdx(idx); setMobileTab('editor') }
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
              <Code2 size={14} /> Code this in editor →
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Study mode modal */}
      {studyMode === null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setStudyMode('show')}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-indigo-600" />
              <h2 className="text-lg font-black text-[var(--text)]">Study Mode</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-5">How do you want to study this session?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setStudyMode('hide')}
                className="flex items-start gap-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-left hover:bg-indigo-100 transition">
                <span className="text-xl mt-0.5">🧠</span>
                <div>
                  <p className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">Challenge Mode</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Answers are hidden — try to solve before looking</p>
                </div>
              </button>
              <button onClick={() => setStudyMode('show')}
                className="flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--border)] text-left hover:border-[var(--border)] hover:bg-[var(--bg-muted)] transition">
                <span className="text-xl mt-0.5">📖</span>
                <div>
                  <p className="font-bold text-[var(--text)] text-sm">Review Mode</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Answers are visible — study at your own pace</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE layout ── */}
      <div className="flex flex-col md:hidden h-[calc(100dvh-56px)]">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
          <button onClick={() => setMobileTab('daily')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobileTab === 'daily' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-[var(--text-subtle)]'}`}>
            ⚡ Daily
          </button>
          <button onClick={() => setMobileTab('description')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobileTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)]'}`}>
            📖 Description
          </button>
          <button onClick={() => setMobileTab('editor')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobileTab === 'editor' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)]'}`}>
            💻 Editor
          </button>
        </div>

        {/* Daily + speedster panel */}
        <div ref={cardsPanelRef} className={`${mobileTab === 'daily' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0 overflow-y-auto`}>
          {speedsterSections}
        </div>

        {/* Description panel */}
        <div className={`${mobileTab === 'description' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0 overflow-hidden`}>
          {/* Top bar for mobile description */}
          <div className="relative z-30 flex flex-wrap items-center gap-2 overflow-visible border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shrink-0">
            <button onClick={goPrev} disabled={safeIdx === 0}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <div data-sl-list ref={listWrapRef} className="relative z-0">
              <button type="button" onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-indigo-300 transition-colors">
                <List size={12} />
                <span className="font-mono">{safeIdx + 1}/{orderedQuestions.length}</span>
                <span className="text-green-600 ml-1">{solvedCount} solved</span>
              </button>
              {showList && (
                <>
                  <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                  <div className={listDropdownMobilePanelClasses('left')}>{questionListItems}</div>
                </>
              )}
            </div>
            <button onClick={goNext} disabled={safeIdx === orderedQuestions.length - 1}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
              <ChevronRight size={15} />
            </button>
            <div className="flex-1 bg-[var(--bg-muted)] rounded-full h-1.5 min-w-[40px]">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{ width: orderedQuestions.length ? `${((safeIdx + 1) / orderedQuestions.length) * 100}%` : '0%' }} />
            </div>
            {q && (
              <>
                <button onClick={() => save({ starred: !starred })}
                  className={`p-1.5 rounded-lg border transition-colors ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-yellow-300'}`}>
                  <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--text-subtle)]'} />
                </button>
                <button onClick={() => save({ solved: !solved })}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-green-300'}`}>
                  <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
                  {solved ? '✓' : '+'}
                </button>
                <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-[var(--text-subtle)] hover:text-orange-400 transition-colors">
                  <ExternalLink size={14} />
                </a>
              </>
            )}
          </div>
          {leftPanel}
        </div>

        {/* Editor panel */}
        <div className={`${mobileTab === 'editor' ? 'flex flex-col' : 'hidden'} flex-1 min-h-0 overflow-x-hidden`}>
          {editorPanel}
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden md:flex flex-col h-[calc(100dvh-56px)]">
        {/* Top bar */}
        <div className="relative z-30 flex flex-wrap items-center gap-2 overflow-visible border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shrink-0">
          <span className="text-xs font-black text-indigo-500 hidden sm:inline">⚡ SpeedyLearn</span>
          <span className="w-px h-4 bg-[var(--border)] hidden sm:inline-block" />

          <button onClick={goPrev} disabled={safeIdx === 0}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
            <ChevronLeft size={15} />
          </button>

          <div data-sl-list ref={listWrapRef} className="relative z-0">
            <button type="button" onClick={() => setShowList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-indigo-300 transition-colors">
              <List size={12} />
              <span className="font-mono">{safeIdx + 1}/{orderedQuestions.length}</span>
              <span className="text-[var(--text-subtle)]">·</span>
              <span className="text-green-600">{solvedCount} solved</span>
            </button>
            {showList && (
              <>
                <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                <div className={listDropdownMobilePanelClasses('left')}>{questionListItems}</div>
              </>
            )}
          </div>

          <button onClick={goNext} disabled={safeIdx === orderedQuestions.length - 1}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
            <ChevronRight size={15} />
          </button>

          {/* Progress bar */}
          <div className="flex-1 bg-[var(--bg-muted)] rounded-full h-1.5 min-w-[60px]">
            <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: orderedQuestions.length ? `${((safeIdx + 1) / orderedQuestions.length) * 100}%` : '0%' }} />
          </div>

          {/* Filters toggle */}
          <button type="button" data-sl-filter onClick={() => setShowFilters(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300'}`}>
            Filter {filterDiff !== 'All' || filterSource !== 'All' || filterPattern ? '•' : ''}
          </button>

          {q && (
            <>
              <button onClick={() => save({ starred: !starred })}
                className={`p-1.5 rounded-lg border transition-colors ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-yellow-300'}`}>
                <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--text-subtle)]'} />
              </button>
              <button onClick={() => save({ solved: !solved })}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-green-300'}`}>
                <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
                <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
                <span className="sm:hidden">{solved ? '✓' : '+'}</span>
              </button>
              <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-[var(--text-subtle)] hover:text-orange-400 transition-colors" title="Open on LeetCode">
                <ExternalLink size={14} />
              </a>
            </>
          )}
        </div>

        {/* Filter pills */}
        {showFilters && (
          <div data-sl-filter className="border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0 space-y-1 px-3 py-2">
            <div className="flex items-center flex-wrap gap-2">
              {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                <button key={d} onClick={() => setFilterDiff(d)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
                  {d}
                </button>
              ))}
              <span className="w-px h-4 bg-[var(--border)] shrink-0" />
              {['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal'].map(s => (
                <button key={s} onClick={() => setFilterSource(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterSource === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {(['All', 'Solved', 'Unsolved'] as const).map(s => (
                <button key={s} onClick={() => setFilterSolved(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterSolved === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button onClick={() => setFilterPattern(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${!filterPattern ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-cyan-300'}`}>
                All Patterns
              </button>
              {QUICK_PATTERNS.map(pp => (
                <button key={pp.name} onClick={() => setFilterPattern(filterPattern === pp.name ? null : pp.name)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterPattern === pp.name ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-cyan-300'}`}>
                  {pp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pattern context strip */}
        {currentPattern && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
            <span className="text-xs font-semibold text-[var(--text)] truncate">{currentPattern.name}</span>
            {patternPct >= 80 && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 shrink-0">🔥 Crushing it!</span>}
            {patternPct >= 50 && patternPct < 80 && <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 shrink-0">💪 Solid progress</span>}
            {patternPct > 0 && patternPct < 50 && <span className="text-[10px] font-semibold text-amber-500 shrink-0">📈 Building momentum</span>}
            {patternPct === 0 && <span className="text-[10px] font-semibold text-[var(--text-subtle)] shrink-0">🧩 Fresh territory</span>}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <div className="w-16 sm:w-24 h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${patternPct === 100 ? 'bg-green-500' : patternPct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                  style={{ width: patternPct + '%' }} />
              </div>
              <span className={`text-[11px] font-bold ${patternPct === 100 ? 'text-green-500' : patternPct >= 50 ? 'text-indigo-400' : 'text-amber-500'}`}>
                {patternSolved}/{patternQs.length}
              </span>
            </div>
          </div>
        )}

        {!q ? (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">No questions match your filters.</div>
        ) : (
          <div className="relative z-0 flex min-h-0 flex-1 overflow-hidden">
            {leftPanel}
            <div className="flex flex-1 flex-col min-h-0 overflow-x-hidden overflow-y-auto">
              {/* Editor (fixed height) */}
              <div className="flex flex-col shrink-0" style={{ height: '60vh', minHeight: '400px' }}>
                {editorPanel}
              </div>
              {/* Speedster sections scroll below */}
              <div className="border-t border-[var(--border)]">
                {speedsterSections}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AC submissions table — same as Learn page bottom section */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-muted)]/40">
        <div className="mx-auto max-w-6xl px-3 py-6 pb-10">
          <LearnAcSubmitTable
            onSolve={questionId => {
              const idx = orderedQuestions.findIndex(oq => oq.id === questionId)
              if (idx >= 0) setQIdx(idx)
            }}
          />
        </div>
      </section>
    </>
  )
}

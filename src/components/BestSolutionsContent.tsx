'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Bookmark, BookmarkCheck, Search, Copy, Check, Download,
  Loader2, Clock, ExternalLink,
  BookOpen, Sparkles, Rows3, Columns3, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY } from '@/lib/constants'
import PriorityBadge from '@/components/PriorityBadge'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { studyOrder } from '@/lib/studyOrder'
import StudyRoundHeader, { isNewRound } from '@/components/StudyRoundHeader'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'
import { stripScripts, leetCodeUrl } from '@/lib/utils'
import { getSet2Questions, getSet3Questions, buildSetExclusiveMap } from '@/lib/questionSets'

const CONTENT_Q = `query($s:String!){question(titleSlug:$s){content isPaidOnly topicTags{name}}}`
const PY_LANGS = ['python3', 'python']

async function getLcSession(): Promise<{ session: string; csrfToken: string }> {
  let session   = localStorage.getItem('lc_session') ?? ''
  let csrfToken = localStorage.getItem('lc_csrf')    ?? ''
  if (!session) {
    try {
      const d = await fetch('/api/lc-session').then(r => r.json())
      if (d.lc_session) {
        session = d.lc_session
        csrfToken = d.lc_csrf || ''
        localStorage.setItem('lc_session', session)
        localStorage.setItem('lc_csrf', csrfToken)
      }
    } catch { /* silent */ }
  }
  return { session, csrfToken }
}

interface Question {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tags?: string[]
  category?: string
}

interface BestSolution {
  question_id: number
  language: string
  code: string
  updated_at: string
}

type LcState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; code: string; lang: string }
  | { status: 'none' }
  | { status: 'error'; msg: string }

const HLJS_STYLE = `
  .bs-hljs .hljs { background: transparent; color: #abb2bf; }
  ${CODE_HIGHLIGHT_TOKEN_CSS}
`

const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-400 bg-green-500/10 border-green-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Hard:   'text-red-400 bg-red-500/10 border-red-500/20',
}

const LANG_LABEL: Record<string, string> = {
  python3: 'Python', python: 'Python', cpp: 'C++', javascript: 'JS',
}

const HLJS_LANG: Record<string, string> = {
  python3: 'python', python: 'python', cpp: 'cpp',
  javascript: 'javascript', js: 'javascript',
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 2)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function DiffBadge({ d }: { d: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${DIFF_CLS[d] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
      {d}
    </span>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const hlLang  = HLJS_LANG[lang] ?? 'python'

  useEffect(() => {
    const el = codeRef.current
    if (!el || !code) return
    el.removeAttribute('data-highlighted')
    el.textContent = code
    import('highlight.js/lib/core').then(async ({ default: hljs }) => {
      const [py, cpp, js] = await Promise.all([
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/cpp'),
        import('highlight.js/lib/languages/javascript'),
      ])
      if (!hljs.getLanguage('python'))     hljs.registerLanguage('python',     py.default)
      if (!hljs.getLanguage('cpp'))        hljs.registerLanguage('cpp',        cpp.default)
      if (!hljs.getLanguage('javascript')) hljs.registerLanguage('javascript', js.default)
      if (el.textContent === code) hljs.highlightElement(el)
    }).catch(() => {})
  }, [code, hlLang])

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bs-hljs rounded-lg overflow-hidden border border-gray-700/60">
      <style>{HLJS_STYLE}</style>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21252b] border-b border-gray-700/60">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {LANG_LABEL[lang] ?? lang}
        </span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="bg-[#282c34]">
        <pre className="p-4 m-0 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words">
          <code ref={codeRef} className={`language-${hlLang}`}>{code}</code>
        </pre>
      </div>
    </div>
  )
}

type DescState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; content: string; tags: string[] }
  | { status: 'premium' }
  | { status: 'error' }

function RevisionCard({
  q, sol, pattern, onSaved, onUnpinned, fixedWidth, jumpKey,
}: {
  q: Question
  sol: BestSolution | undefined
  pattern: string
  onSaved: (qid: number, lang: string, code: string) => void
  onUnpinned: (qid: number) => void
  fixedWidth?: boolean
  jumpKey?: string
}) {
  const [desc, setDesc] = useState<DescState>({ status: 'idle' })
  const [lc,   setLc]   = useState<LcState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [unpinning, setUnpinning] = useState(false)
  const loadedRef = useRef(false)
  const rootRef   = useRef<HTMLDivElement>(null)

  const pinnedIsPython = !!sol && PY_LANGS.includes(sol.language)

  const loadDescription = useCallback(async () => {
    setDesc({ status: 'loading' })
    try {
      const { session, csrfToken } = await getLcSession()
      const res = await fetch('/api/leetcode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, csrfToken, query: CONTENT_Q, variables: { s: q.slug } }),
      }).then(r => r.json())
      const question = res?.data?.question
      if (question?.isPaidOnly && !question?.content) setDesc({ status: 'premium' })
      else if (question?.content) setDesc({ status: 'done', content: question.content, tags: (question.topicTags ?? []).map((t: { name: string }) => t.name) })
      else setDesc({ status: 'error' })
    } catch { setDesc({ status: 'error' }) }
  }, [q.slug])

  const loadLatestPython = useCallback(async () => {
    const { session, csrfToken } = await getLcSession()
    if (!session || !csrfToken) { setLc({ status: 'none' }); return }
    setLc({ status: 'loading' })
    try {
      const r1 = await fetch('/api/leetcode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session, csrfToken,
          query: `query($slug:String!,$offset:Int!,$limit:Int!){questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){submissions{id lang timestamp}}}`,
          variables: { slug: q.slug, offset: 0, limit: 10 },
        }),
      }).then(r => r.json())
      const subs: { id: string; lang: string }[] = r1?.data?.questionSubmissionList?.submissions ?? []
      const pySub = subs.find(s => PY_LANGS.includes(s.lang))
      if (!pySub) { setLc({ status: 'none' }); return }
      const r2 = await fetch('/api/leetcode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session, csrfToken,
          query: `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
          variables: { id: Number(pySub.id) },
        }),
      }).then(r => r.json())
      const code = r2?.data?.submissionDetails?.code ?? ''
      if (!code) { setLc({ status: 'error', msg: 'Could not load code — session may be expired' }); return }
      setLc({ status: 'done', code, lang: pySub.lang })
    } catch { setLc({ status: 'error', msg: 'Network error' }) }
  }, [q.slug])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (!loadedRef.current && entries.some(e => e.isIntersecting)) {
        loadedRef.current = true
        loadDescription()
        if (!pinnedIsPython) loadLatestPython()
        obs.disconnect()
      }
    }, { rootMargin: '500px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadDescription, loadLatestPython, pinnedIsPython])

  const saveLcAsBest = async () => {
    if (lc.status !== 'done') return
    setSaving(true)
    try {
      const res = await fetch('/api/best-solutions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id, language: lc.lang, code: lc.code }),
      })
      if (res.ok) { onSaved(q.id, lc.lang, lc.code); toast.success('Saved as your best solution ✓') }
      else toast.error('Could not save — try again')
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  const unpinSolution = async () => {
    if (!sol || unpinning) return
    setUnpinning(true)
    try {
      const res = await fetch('/api/best-solutions', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id }),
      })
      if (res.ok) {
        onUnpinned(q.id)
        loadedRef.current = false
        setLc({ status: 'idle' })
        toast.success('Unpinned — showing your recent LeetCode submission')
      } else toast.error('Could not unpin — try again')
    } catch { toast.error('Network error') }
    finally { setUnpinning(false) }
  }

  useEffect(() => {
    if (!sol && loadedRef.current && lc.status === 'idle') loadLatestPython()
  }, [sol, lc.status, loadLatestPython])

  const codeSource: 'pinned' | 'live' = pinnedIsPython ? 'pinned' : 'live'

  return (
    <div ref={rootRef} data-jump={jumpKey} className={`rounded-xl border bg-[var(--bg-card)] flex flex-col overflow-hidden ${
      sol ? 'border-amber-400/30' : 'border-[var(--border)]'
    } ${fixedWidth ? 'w-[92vw] sm:w-[440px] shrink-0 snap-start' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-mono text-[var(--text-subtle)] shrink-0 w-7 sm:w-9">#{q.id}</span>
        <Link href={`/practice/${q.id}`}
          className="font-semibold text-sm text-[var(--text)] hover:text-amber-400 transition-colors truncate flex-1 min-w-[80px]">
          {q.title}
        </Link>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="hidden md:inline text-[10px] font-semibold text-[var(--text-subtle)] uppercase tracking-wider truncate max-w-[120px]">{pattern}</span>
          <DiffBadge d={q.difficulty} />
          {sol && (
            <button onClick={unpinSolution} disabled={unpinning} title="Unpin — fall back to your recent LeetCode submission"
              className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 shrink-0 transition-colors disabled:opacity-50">
              {unpinning ? <Loader2 size={11} className="animate-spin" /> : <Bookmark size={11} className="fill-amber-400" />}
              <span className="hidden lg:inline">{unpinning ? 'Unpinning…' : 'Unpin'}</span>
            </button>
          )}
          <a href={leetCodeUrl(q.slug)} target="_blank" rel="noopener noreferrer"
            className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors shrink-0" title="Open on LeetCode">
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4 ${fixedWidth ? 'max-h-[75vh] sm:max-h-[70vh]' : ''}`}>
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
            <BookOpen size={11} /> Description
          </div>
          {desc.status === 'idle' && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
              <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
              <div className="h-3 bg-[var(--bg-muted)] rounded w-2/3" />
            </div>
          )}
          {desc.status === 'loading' && (
            <div className="flex items-center gap-2 py-3 text-indigo-400">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Loading description…</span>
            </div>
          )}
          {desc.status === 'premium' && (
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <span className="text-2xl">🔒</span>
              <p className="text-xs text-[var(--text-subtle)]">LeetCode Premium question</p>
              <a href={leetCodeUrl(q.slug)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">View on LeetCode →</a>
            </div>
          )}
          {desc.status === 'error' && (
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <AlertCircle size={16} className="text-gray-600" />
              <p className="text-xs text-[var(--text-subtle)]">Could not load description.</p>
              <a href={leetCodeUrl(q.slug)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">View on LeetCode →</a>
            </div>
          )}
          {desc.status === 'done' && (
            <>
              {desc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {desc.tags.map(t => <span key={t} className="text-[10px] bg-[var(--bg-muted)] text-[var(--text-subtle)] px-1.5 py-0.5 rounded-full">{t}</span>)}
                </div>
              )}
              <div className="lc-description text-[13px] leading-relaxed text-[var(--text)]"
                dangerouslySetInnerHTML={{ __html: stripScripts(desc.content) }} />
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
              {codeSource === 'pinned' ? <BookmarkCheck size={11} /> : <Sparkles size={11} />}
              {codeSource === 'pinned' ? 'My Best · Python' : 'Recent Accepted · Python'}
            </span>
            {sol && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Clock size={9} /> {timeAgo(sol.updated_at)}</span>}
          </div>
          {codeSource === 'pinned' && sol ? (
            <CodeBlock code={sol.code} lang={sol.language} />
          ) : (
            <>
              {(lc.status === 'idle' || lc.status === 'loading') && (
                <div className="flex items-center gap-2 py-3 text-indigo-400">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-xs">Loading recent Python submission…</span>
                </div>
              )}
              {lc.status === 'error' && <p className="text-xs text-red-400 py-2">{lc.msg}</p>}
              {lc.status === 'none' && (
                <p className="text-xs text-gray-500 py-2 italic">
                  No accepted Python submissions found — or connect your LeetCode session first.
                </p>
              )}
              {lc.status === 'done' && (
                <>
                  <CodeBlock code={lc.code} lang={lc.lang} />
                  <button onClick={saveLcAsBest} disabled={saving}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <BookmarkCheck size={11} />}
                    {saving ? 'Saving…' : 'Pin as My Best'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el || el === document.body) return null
  const s = window.getComputedStyle(el)
  if ((s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el
  return getScrollParent(el.parentElement as HTMLElement | null)
}

/* ══ BestSolutionsContent ════════════════════════════════════════════════════ */
export default function BestSolutionsContent({
  lockedLayout,
  set = 1,
}: {
  lockedLayout?: 'vertical' | 'horizontal'
  set?: 1 | 2 | 3
}) {
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [solutions,  setSolutions]  = useState<BestSolution[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tableReady,     setTableReady]     = useState(true)
  const [query,          setQuery]          = useState('')
  const [filter,         setFilter]         = useState<'all' | 'saved' | 'waiting'>('all')
  const [diffFilter,     setDiffFilter]     = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all')
  const [layout,         setLayout]         = useState<'vertical' | 'horizontal'>(lockedLayout ?? 'vertical')
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number; found: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      fetch('/api/best-solutions').then(r => r.json()),
    ])
      .then(([qs, solData]) => {
        const mainQs: Question[] = Array.isArray(qs) ? qs : []
        if (set === 1) {
          setQuestions(mainQs)
        } else {
          const mainIds = new Set(mainQs.map(q => q.id))
          const setQs = set === 2
            ? getSet2Questions(mainIds, mainQs as any)
            : getSet3Questions(mainIds, mainQs as any)
          setQuestions(setQs.map(q => ({
            id: q.id,
            title: q.title,
            slug: q.slug,
            difficulty: q.difficulty,
            tags: q.tags,
            category: q.category,
          })))
        }
        setSolutions(Array.isArray(solData.solutions) ? solData.solutions : [])
        setTableReady(solData.tableReady !== false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [set])

  const solByQid = useMemo(() => {
    const m = new Map<number, BestSolution>()
    for (const s of solutions) m.set(s.question_id, s)
    return m
  }, [solutions])

  const patternMap = useMemo(() => {
    if (set !== 1) return buildSetExclusiveMap(questions as any)
    return buildExclusivePatternMap(questions.map(q => ({ ...q, tags: q.tags ?? [] })))
  }, [questions, set])

  const sortedQuestions = useMemo(() => {
    if (set !== 1) return questions  // already sorted by getSet2/3Questions
    const orderedIds = studyOrder(questions.map(q => ({ ...q, tags: q.tags ?? [] })))
    const qMap = new Map(questions.map(q => [q.id, q]))
    return orderedIds.map(id => qMap.get(id)).filter(Boolean) as typeof questions
  }, [questions, set])

  const patternGroups = useMemo(() => {
    const groups: { pattern: string; questions: Question[] }[] = []
    for (const q of sortedQuestions) {
      const p = patternMap[q.id] ?? 'Other'
      const last = groups[groups.length - 1]
      if (last && last.pattern === p) last.questions.push(q)
      else groups.push({ pattern: p, questions: [q] })
    }
    return groups
  }, [sortedQuestions, patternMap])

  const handleSaved = useCallback((qid: number, lang: string, code: string) => {
    const now = new Date().toISOString()
    setSolutions(prev => {
      const exists = prev.find(s => s.question_id === qid)
      if (exists) return prev.map(s => s.question_id === qid ? { ...s, language: lang, code, updated_at: now } : s)
      return [...prev, { question_id: qid, language: lang, code, updated_at: now }]
    })
  }, [])

  const handleUnpinned = useCallback((qid: number) => {
    setSolutions(prev => prev.filter(s => s.question_id !== qid))
  }, [])

  const savedCount = useMemo(() => questions.filter(q => solByQid.has(q.id)).length, [questions, solByQid])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patternGroups
      .map(({ pattern, questions: qs }) => ({
        pattern,
        questions: qs.filter(question => {
          const hasSol = solByQid.has(question.id)
          if (filter === 'saved'   && !hasSol) return false
          if (filter === 'waiting' &&  hasSol) return false
          if (diffFilter !== 'all' && question.difficulty !== diffFilter) return false
          if (q) {
            return String(question.id).includes(q) ||
                   question.title.toLowerCase().includes(q) ||
                   (question.tags ?? []).some(t => t.toLowerCase().includes(q))
          }
          return true
        }),
      }))
      .filter(g => g.questions.length > 0)
  }, [patternGroups, solByQid, filter, diffFilter, query])

  const totalVisible = useMemo(() => filteredGroups.reduce((s, g) => s + g.questions.length, 0), [filteredGroups])

  const flatFiltered = useMemo(
    () => filteredGroups.flatMap(({ pattern, questions: qs }) => qs.map(q => ({ q, pattern }))),
    [filteredGroups]
  )

  const jumpChips = useMemo(() => {
    const seen = new Set<string>()
    const counts = new Map<string, number>()
    const order: { key: string; priority: string; difficulty: 'Easy' | 'Medium' | 'Hard' }[] = []
    for (const { q, pattern } of flatFiltered) {
      const pri = PATTERN_PRIORITY[pattern] ?? 'Low'
      const key = `${pri}-${q.difficulty}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (!seen.has(key)) {
        seen.add(key)
        order.push({ key, priority: pri, difficulty: q.difficulty as 'Easy' | 'Medium' | 'Hard' })
      }
    }
    const PRI_ORD: Record<string, number> = { High: 0, Mid: 1, Low: 2 }
    const DIFF_ORD: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }
    return order
      .map(r => ({ ...r, count: counts.get(r.key) ?? 0 }))
      .sort((a, b) => {
        const pd = (PRI_ORD[a.priority] ?? 3) - (PRI_ORD[b.priority] ?? 3)
        if (pd !== 0) return pd
        return (DIFF_ORD[a.difficulty] ?? 3) - (DIFF_ORD[b.difficulty] ?? 3)
      })
  }, [flatFiltered])

  const scrollToChip = useCallback((key: string) => {
    if (layout === 'horizontal') {
      const container = scrollRef.current
      if (!container) return
      const target = container.querySelector(`[data-jump="${key}"]`) as HTMLElement | null
      if (!target) return
      const containerLeft = container.getBoundingClientRect().left
      const targetLeft = target.getBoundingClientRect().left
      container.scrollTo({ left: container.scrollLeft + (targetLeft - containerLeft) - 16, behavior: 'smooth' })
    } else {
      const target = document.querySelector(`[data-jump="${key}"]`) as HTMLElement | null
      if (!target) return
      const scrollParent = getScrollParent(target)
      if (scrollParent) {
        const parentTop = scrollParent.getBoundingClientRect().top
        const targetTop = target.getBoundingClientRect().top
        scrollParent.scrollTo({ top: scrollParent.scrollTop + (targetTop - parentTop) - 100, behavior: 'smooth' })
      } else {
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' })
      }
    }
  }, [layout])

  const exportPython = useCallback(async () => {
    if (exportProgress) return

    const session   = typeof window !== 'undefined' ? (localStorage.getItem('lc_session') ?? '') : ''
    const csrfToken = typeof window !== 'undefined' ? (localStorage.getItem('lc_csrf')    ?? '') : ''
    const hasSession = !!(session && csrfToken)

    const codeMap = new Map<number, string>()
    for (const sol of solutions) {
      if (['python3', 'python'].includes(sol.language)) codeMap.set(sol.question_id, sol.code)
    }
    for (const q of sortedQuestions) {
      if (codeMap.has(q.id)) continue
      const draft = localStorage.getItem(`lm_draft_${q.id}_python3`) ?? localStorage.getItem(`lm_draft_${q.id}_python`)
      if (draft) codeMap.set(q.id, draft)
    }

    if (hasSession) {
      const toFetch = sortedQuestions.filter(q => !codeMap.has(q.id))
      if (toFetch.length) {
        setExportProgress({ done: 0, total: toFetch.length, found: codeMap.size })
        const BATCH = 5
        for (let i = 0; i < toFetch.length; i += BATCH) {
          const batch = toFetch.slice(i, i + BATCH)
          await Promise.allSettled(batch.map(async q => {
            try {
              const r1 = await fetch('/api/leetcode', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  session, csrfToken,
                  query: `query($slug:String!,$offset:Int!,$limit:Int!){questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){submissions{id lang}}}`,
                  variables: { slug: q.slug, offset: 0, limit: 5 },
                }),
              }).then(r => r.json())
              const subs: { id: string; lang: string }[] = r1?.data?.questionSubmissionList?.submissions ?? []
              const pySub = subs.find(s => ['python3', 'python'].includes(s.lang))
              if (!pySub) return
              const r2 = await fetch('/api/leetcode', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  session, csrfToken,
                  query: `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
                  variables: { id: Number(pySub.id) },
                }),
              }).then(r => r.json())
              const code = r2?.data?.submissionDetails?.code ?? ''
              if (code) codeMap.set(q.id, code)
            } catch { /* skip */ }
          }))
          setExportProgress({ done: Math.min(i + BATCH, toFetch.length), total: toFetch.length, found: codeMap.size })
        }
      }
    }

    setExportProgress(null)
    const toExport = sortedQuestions.map(q => ({ q, code: codeMap.get(q.id) })).filter(x => x.code)
    if (!toExport.length) { toast.error('No Python solutions found — pin some using the Best button in the editor.'); return }

    const lines = [
      '# ═══════════════════════════════════════════════════════',
      '# My LeetCode Solutions (Python)',
      `# Generated: ${new Date().toLocaleDateString()}`,
      `# ${toExport.length} questions`,
      '# ═══════════════════════════════════════════════════════', '',
    ]
    for (const { q, code } of toExport) {
      const pattern = patternMap[q.id] ?? ''
      lines.push(`# ─── #${q.id} ${q.title} [${q.difficulty}]${pattern ? ` · ${pattern}` : ''} ${'─'.repeat(Math.max(0, 40 - q.title.length))}`)
      lines.push(code!)
      lines.push('', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'my_solutions.py'; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${toExport.length} Python solutions ✓`)
  }, [exportProgress, solutions, sortedQuestions, patternMap])

  return (
    <div className="min-h-0 bg-[var(--bg)] pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8">

        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
              <Bookmark size={18} className="text-amber-400" /> My Best Solutions
            </h1>
            <p className="text-xs text-[var(--text-subtle)] mt-1">
              Click any card to see your latest accepted submission. Hit{' '}
              <kbd className="bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">Best</kbd>{' '}
              in the editor to pin a specific version.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-black text-amber-400 leading-none">{savedCount}</p>
              <p className="text-[10px] text-[var(--text-subtle)]">of {questions.length} pinned</p>
            </div>
            <button onClick={exportPython} disabled={!!exportProgress}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60 min-w-[100px] justify-center">
              {exportProgress
                ? <><Loader2 size={13} className="animate-spin shrink-0" /> {exportProgress.done}/{exportProgress.total}</>
                : <><Download size={13} /> Export .py</>
              }
            </button>
          </div>
        </div>

        {!tableReady && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-400">One-time setup needed</p>
            <p className="text-xs text-amber-300/80 mt-1">
              Run <code className="bg-black/20 px-1 rounded">supabase/create_best_solutions.sql</code> in your{' '}
              <a href="https://supabase.com/dashboard/project/azrokoorufejfoeddzrw/sql" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Supabase SQL Editor</a>.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by # or title…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-amber-400/60" />
          </div>

          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {([['all', `All ${questions.length}`], ['saved', `Pinned ${savedCount}`], ['waiting', `Unpinned ${questions.length - savedCount}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filter === k ? 'bg-amber-500 text-white' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
                {label}
              </button>
            ))}
          </div>

          {!lockedLayout && (
            <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
              <button onClick={() => setLayout('vertical')} title="Scroll vertically"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${layout === 'vertical' ? 'bg-indigo-500 text-white' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
                <Rows3 size={12} /> <span className="hidden sm:inline">Vertical</span>
              </button>
              <button onClick={() => setLayout('horizontal')} title="Scroll horizontally"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${layout === 'horizontal' ? 'bg-indigo-500 text-white' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
                <Columns3 size={12} /> <span className="hidden sm:inline">Horizontal</span>
              </button>
            </div>
          )}

          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {(['all', 'Easy', 'Medium', 'Hard'] as const).map(d => (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  diffFilter === d
                    ? d === 'Easy' ? 'bg-green-500 text-white' : d === 'Medium' ? 'bg-amber-500 text-white' : d === 'Hard' ? 'bg-red-500 text-white' : 'bg-gray-600 text-white'
                    : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                }`}>
                {d === 'all' ? 'All' : d}
              </button>
            ))}
          </div>
        </div>

        {!loading && jumpChips.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none -mx-1 px-1">
            {jumpChips.map(({ key, priority, difficulty, count }) => (
              <button key={key} onClick={() => scrollToChip(key)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                  difficulty === 'Easy'   ? 'border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/25' :
                  difficulty === 'Medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/25' :
                                           'border-red-500/30   bg-red-500/10   text-red-300   hover:bg-red-500/25'
                }`}>
                <span className="opacity-60 text-[10px] font-mono">{priority[0]}</span>
                <span>{difficulty}</span>
                <span className="opacity-40 text-[9px]">{count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-subtle)]">
            <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-subtle)]">No questions match your filter.</p>
          </div>
        ) : layout === 'horizontal' ? (
          <div className="-mx-4 px-4">
            <div ref={scrollRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth">
              {flatFiltered.map(({ q, pattern }) => {
                const pri = PATTERN_PRIORITY[pattern] ?? 'Low'
                return (
                  <RevisionCard key={q.id} q={q} sol={solByQid.get(q.id)} pattern={pattern} onSaved={handleSaved} onUnpinned={handleUnpinned} fixedWidth jumpKey={`${pri}-${q.difficulty}`} />
                )
              })}
            </div>
            <p className="text-center text-[10px] text-gray-600 mt-1">← scroll horizontally · {flatFiltered.length} questions in topic order →</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredGroups.map(({ pattern, questions: qs }, gi) => {
              const pri = PATTERN_PRIORITY[pattern] ?? 'Low'
              const diff = qs[0]?.difficulty ?? 'Easy'
              const prev = gi > 0 ? filteredGroups[gi - 1] : null
              const prevPri = prev ? (PATTERN_PRIORITY[prev.pattern] ?? 'Low') : null
              const prevDiff = prev?.questions[0]?.difficulty ?? null
              const showRound = isNewRound(pri, diff, prevPri, prevDiff)
              return (
                <div key={`${pattern}-${diff}`} data-jump={`${pri}-${diff}`}>
                  {showRound && <StudyRoundHeader priority={pri} difficulty={diff} className="-mx-1 mb-4" />}
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-widest">{pattern}</p>
                    <span className="text-[10px] font-mono text-gray-600">· {qs.length}</span>
                    <PriorityBadge pattern={pattern} />
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                  <div className="space-y-4">
                    {qs.map(q => (
                      <RevisionCard key={q.id} q={q} sol={solByQid.get(q.id)} pattern={pattern} onSaved={handleSaved} onUnpinned={handleUnpinned} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && totalVisible > 0 && (
          <p className="text-center text-xs text-gray-600 mt-8">
            {totalVisible} questions across {filteredGroups.length} patterns
          </p>
        )}
      </div>
    </div>
  )
}

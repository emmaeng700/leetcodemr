'use client'
import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Brain, CheckCircle, Star,
  BookOpen, List, ExternalLink, Loader2, FileText,
  Copy, Check, Sparkles,
} from 'lucide-react'
import { getProgress, updateProgress, completeReview, failReview, getStudyPlan } from '@/lib/db'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { isDue, formatLocalDate, nextIntervalDays, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import DifficultyBadge from '@/components/DifficultyBadge'
import StatusRadio from '@/components/StatusRadio'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import LearnAcSubmitTable from '@/components/learn/LearnAcSubmitTable'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'
import DescriptionRenderer from '@/components/DescriptionRenderer'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

function EditorialCodeBlock({ code, lang }: { code: string; lang: string }) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!codeRef.current) return
    codeRef.current.removeAttribute('data-highlighted')
    codeRef.current.textContent = code || ''
    if (code && (lang === 'python' || lang === 'cpp')) hljs.highlightElement(codeRef.current)
  }, [code, lang])

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="learn-editorial-hljs rounded-xl overflow-hidden border border-gray-700 bg-[#282c34] my-4">
      <style>{`
        .learn-editorial-hljs .hljs { background: #282c34; color: #abb2bf; }
        ${CODE_HIGHLIGHT_TOKEN_CSS}
      `}</style>
      <div className="flex items-center justify-between px-4 py-2 bg-[#21252b] border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400">{lang === 'cpp' ? 'C++' : lang === 'python' ? 'Python' : lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-[12px] leading-relaxed m-0 bg-[#282c34]">
          <code ref={codeRef} className={`hljs language-${lang}`} />
        </pre>
      </div>
    </div>
  )
}

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

function PremiumBlock({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-bold text-gray-800 text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-xs">
        This question requires a LeetCode Premium subscription to view the description.
        Your subscription may have lapsed or you may not have one active.
      </p>
      {slug && (
        <a href={leetCodeUrl(slug)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          Open on LeetCode ↗
        </a>
      )}
      <p className="text-xs text-gray-400 mt-3">You can still use the code editor on the right to practice.</p>
    </div>
  )
}

function LearnInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initDiff    = searchParams.get('diff')    || 'All'
  const initSource  = searchParams.get('source')  || 'All'
  const initSearch  = searchParams.get('search')  || ''
  const initStarred = searchParams.get('starred') === '1'
  const initTagsRaw = searchParams.get('tags')    || ''
  const initTags    = initTagsRaw ? initTagsRaw.split(',') : []
  const initSolvedParam = searchParams.get('solved')
  const initSolved: null | boolean = initSolvedParam === 'true' ? true : initSolvedParam === 'false' ? false : null

  const [questions, setQuestions]   = useState<Question[]>([])
  const [planOrder, setPlanOrder]   = useState<number[]>([])
  const [progress, setProgress]     = useState<Record<string, any>>({})
  const [showList, setShowList]     = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [activeTab, setActiveTab]   = useState<'description' | 'editorial' | 'best' | 'accepted' | 'editor'>('description')
  // IMPORTANT: don't read localStorage during render (causes hydration mismatch).
  const [studyMode, setStudyMode]   = useState<'show' | 'hide' | null>(null)
  const [filterDiff, setFilterDiff]         = useState(initDiff)
  const [filterSource, setFilterSource]     = useState(initSource)
  const [filterPattern, setFilterPattern]   = useState<string | null>(
    initTags.length > 0 ? (QUICK_PATTERNS.find(p => p.tags.some(t => initTags.includes(t)))?.name ?? null) : null
  )
  const [showFilters, setShowFilters]       = useState(false)
  const listWrapRef = useRef<HTMLDivElement>(null)

  const [lcContent, setLcContent]   = useState<string | null>(null)
  const [lcLoading, setLcLoading]   = useState(false)
  const [isPremium, setIsPremium]   = useState(false)
  const [editorial, setEditorial]       = useState<string | null>(null)
  const [editorialLoad, setEditorialLoad] = useState(false)
  const [lcSession, setLcSession]       = useState('')
  const [lcCsrf, setLcCsrf]            = useState('')
  const leftPanelTab = activeTab === 'editor' ? 'description' : activeTab

  const rawParamIndex = params.index
  const indexSegment = Array.isArray(rawParamIndex) ? rawParamIndex[0] : rawParamIndex
  const routeIndexRaw = Number(indexSegment ?? 0)
  const routeIndex =
    Number.isFinite(routeIndexRaw) && routeIndexRaw >= 0 ? Math.floor(routeIndexRaw) : 0

  /** Merge filter UI + existing search params so prev/next keep ?diff= etc. */
  const buildLearnQuery = useCallback(
    (overrides?: {
      diff?: typeof filterDiff
      source?: typeof filterSource
      pattern?: typeof filterPattern | null
      solved?: null | boolean
    }) => {
      const sp = new URLSearchParams(searchParams.toString())
      const diff = overrides?.diff !== undefined ? overrides.diff : filterDiff
      const source = overrides?.source !== undefined ? overrides.source : filterSource
      const pattern = overrides?.pattern !== undefined ? overrides.pattern : filterPattern
      const solved = overrides?.solved !== undefined ? overrides.solved : initSolved
      if (diff !== 'All') sp.set('diff', diff)
      else sp.delete('diff')
      if (source !== 'All') sp.set('source', source)
      else sp.delete('source')
      if (pattern) {
        const tags = QUICK_PATTERNS.find(p => p.name === pattern)?.tags ?? []
        if (tags.length) sp.set('tags', tags.join(','))
      } else {
        sp.delete('tags')
      }
      if (solved === true) sp.set('solved', 'true')
      else if (solved === false) sp.set('solved', 'false')
      else sp.delete('solved')
      return sp.toString()
    },
    [searchParams, filterDiff, filterSource, filterPattern, initSolved],
  )

  const learnQs = useMemo(() => buildLearnQuery(), [buildLearnQuery])

  useClickOutside(listWrapRef, () => setShowList(false), showList)

  useEffect(() => {
    if (!showFilters) return
    function onDown(e: MouseEvent | TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-learn-filter]')) return
      setShowFilters(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showFilters])

  useEffect(() => {
    setFilterDiff(searchParams.get('diff') || 'All')
    setFilterSource(searchParams.get('source') || 'All')
    const tr = searchParams.get('tags') || ''
    const tags = tr ? tr.split(',') : []
    setFilterPattern(
      tags.length > 0
        ? (QUICK_PATTERNS.find(p => p.tags.some(t => tags.includes(t)))?.name ?? null)
        : null,
    )
  }, [searchParams])

  useEffect(() => {
    fetch('/api/lc-session').then(r => r.json()).then(d => {
      setLcSession(d.lc_session ?? '')
      setLcCsrf(d.lc_csrf ?? '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lm_study_mode')
      setStudyMode(saved === 'show' || saved === 'hide' ? saved : null)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getStudyPlan(),
    ]).then(([qs, prog, plan]) => {
      setQuestions(qs)
      setProgress(prog)
      if (plan?.question_order?.length) {
        setPlanOrder(plan.question_order)
      } else {
        setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      }
    })
  }, [])

  // Exclusive map — each question belongs to exactly one pattern, no repetition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])

  /** Solved/total counts per pattern — drives the progress fractions on filter buttons */
  const patternProgressMap = useMemo(() => {
    const map: Record<string, { solved: number; total: number }> = {}
    for (const p of QUICK_PATTERNS) {
      const qs = questions.filter(q => exclusiveMap[q.id] === p.name)
      const solved = qs.filter(q => (progress[String(q.id)] as any)?.solved).length
      map[p.name] = { solved, total: qs.length }
    }
    return map
  }, [questions, exclusiveMap, progress])

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))
  const ordered = planOrder.length
    ? planOrder.map(id => qMap[id]).filter(Boolean) as Question[]
    : questions
  const filtered = ordered.filter(q => {
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
    if (filterSource !== 'All' && !(q.source || []).includes(filterSource)) return false
    if (initSearch) {
      const s = initSearch.toLowerCase()
      if (!q.title.toLowerCase().includes(s) && !String(q.id).includes(s.replace(/^#/, ''))) return false
    }
    if (filterPattern && exclusiveMap[q.id] !== filterPattern) return false
    const p = progress[String(q.id)] || {}
    if (initStarred && !p.starred) return false
    if (initSolved === true  && !p.solved) return false
    if (initSolved === false &&  p.solved) return false
    return true
  })

  const safeIdx = Math.min(routeIndex, Math.max(filtered.length - 1, 0))
  const q         = filtered[safeIdx] || null
  const lcTitleSlug = q ? resolveLeetCodeSlug(q.id, q.slug) : undefined
  const p         = q ? (progress[String(q.id)] || {}) : {}
  const solved    = p.solved    || false
  const starred   = p.starred   || false
  const status    = p.status    || null
  const reviewCount = p.review_count || 0
  const nextReview  = p.next_review  || null
  const due = isDue(nextReview) && solved
  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(lcTitleSlug, activeTab === 'accepted')

  useEffect(() => {
    if (filtered.length === 0) return
    if (routeIndex !== safeIdx) {
      router.replace(`/learn/${safeIdx}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    }
  }, [filtered.length, routeIndex, safeIdx, learnQs, router])

  // Persist study mode to localStorage
  useEffect(() => {
    if (studyMode !== null) localStorage.setItem('lm_study_mode', studyMode)
  }, [studyMode])

  // In challenge mode, kick off any answer-revealing tab back to description
  useEffect(() => {
    if (studyMode === 'hide' && (activeTab === 'editorial' || activeTab === 'best' || activeTab === 'accepted')) {
      setActiveTab('description')
    }
  }, [studyMode, activeTab])

  // Reset per question
  useEffect(() => {
    setReviewDone(false)
    setLcContent(null)
    setIsPremium(false)
  }, [q?.id])

  useEffect(() => {
    if (!q) return
    setOpenQuestionContext({ id: q.id, slug: q.slug, title: q.title })
  }, [q?.id, q?.slug, q?.title])

  // Fetch live LeetCode description
  useEffect(() => {
    if (!q?.slug) return
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)

    const session   = localStorage.getItem('lc_session') || ''
    const csrfToken = localStorage.getItem('lc_csrf')    || ''

    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) {
          question(titleSlug: $titleSlug) { content isPaidOnly }
        }`,
        variables: { titleSlug: resolveLeetCodeSlug(q.id, q.slug) },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) setLcContent(qd.content)
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })

    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.id, q?.slug])

  // Fetch editorial when Editorial tab opens (requires LeetCode session for premium)
  useEffect(() => {
    if (activeTab !== 'editorial' || !q?.slug) return
    setEditorial(null)
    setEditorialLoad(true)
    const creds = lcSession && lcCsrf ? { session: lcSession, csrfToken: lcCsrf } : {}
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($s:String!){question(titleSlug:$s){solution{content paidOnly}}}',
        variables: { s: resolveLeetCodeSlug(q.id, q.slug) },
        ...creds,
      }),
    })
      .then(r => r.json())
      .then(async data => {
        const content = data?.data?.question?.solution?.content
        if (!content) return

        // Extract playground UUIDs from iframes
        const iframeRe = /https:\/\/leetcode\.com\/playground\/([A-Za-z0-9]+)\/shared/g
        const uuids: string[] = []
        let m: RegExpExecArray | null
        while ((m = iframeRe.exec(content)) !== null) {
          if (!uuids.includes(m[1])) uuids.push(m[1])
        }

        if (uuids.length === 0) { setEditorial(content); return }

        // Fetch code for each playground UUID (LeetCode API has intentional typo: playgoundUuid)
        const codeMap: Record<string, string> = {}
        await Promise.all(uuids.map(async uuid => {
          try {
            const res = await fetch('/api/leetcode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'query($u:String!){allPlaygroundCodes(uuid:$u){code langSlug}}',
                variables: { u: uuid },
                ...creds,
              }),
            })
            const d = await res.json()
            const codes: Array<{ code: string; langSlug: string }> = d?.data?.allPlaygroundCodes ?? []
            // Prefer python3 > python > cpp > first available
            const pick = codes.find(c => c.langSlug === 'cpp')
              ?? codes.find(c => c.langSlug === 'python3')
              ?? codes.find(c => c.langSlug === 'python')
              ?? codes[0]
            if (pick) {
              const lang = pick.langSlug === 'python3' ? 'python' : pick.langSlug === 'cpp' ? 'cpp' : pick.langSlug
              codeMap[uuid] = `\`\`\`${lang}\n${pick.code}\n\`\`\``
            }
          } catch { /* ignore individual failures */ }
        }))

        // Replace each iframe tag with the fetched code block (or strip if unavailable)
        let processed = content
        for (const uuid of uuids) {
          const pat = new RegExp(`<iframe[^>]*leetcode\\.com/playground/${uuid}/shared[^>]*>\\s*</iframe>`, 'gs')
          processed = processed.replace(pat, codeMap[uuid] ?? '')
        }
        setEditorial(processed)
      })
      .catch(() => {})
      .finally(() => setEditorialLoad(false))
  }, [activeTab, q?.id, q?.slug, lcSession, lcCsrf])

  const goNext = () => {
    if (safeIdx < filtered.length - 1) {
      const ni = safeIdx + 1
      router.push(`/learn/${ni}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    }
  }
  const goPrev = () => {
    if (safeIdx > 0) {
      const ni = safeIdx - 1
      router.push(`/learn/${ni}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    }
  }
  const goTo = (i: number) => {
    router.push(`/learn/${i}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    setShowList(false)
  }

  /** Open a question in this Learn view (editor). Resets URL filters if the question is hidden by current filters. */
  const openQuestionInLearn = useCallback(
    (questionId: number) => {
      const idxFiltered = filtered.findIndex(q => q.id === questionId)
      if (idxFiltered >= 0) {
        router.push(`/learn/${idxFiltered}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
        setActiveTab('editor')
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
        return
      }
      const idxOrdered = ordered.findIndex(q => q.id === questionId)
      if (idxOrdered < 0) return
      router.push(`/learn/${idxOrdered}`, { scroll: false })
      setActiveTab('editor')
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    },
    [filtered, ordered, learnQs, router],
  )

  const save = async (patch: any = {}) => {
    if (!q) return
    const updated = { solved, starred, status, ...patch, question_id: q.id }
    await updateProgress(q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
  }

  const handleCompleteReview = async () => {
    if (!q) return
    const result = await completeReview(q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
    }))
    setReviewDone(true)
  }

  const handleFailReview = async () => {
    if (!q) return
    const result = await failReview(q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
    }))
    setReviewDone(true)
  }

  const solvedCount = filtered.filter(fq => progress[String(fq.id)]?.solved).length

  // Pattern context for current question — uses exclusive map (no repetition)
  const currentPatternName = q ? (exclusiveMap[q.id] ?? null) : null
  const currentPattern = currentPatternName ? QUICK_PATTERNS.find(p => p.name === currentPatternName) ?? null : null
  const patternQs = currentPatternName
    ? questions.filter(qq => exclusiveMap[qq.id] === currentPatternName)
    : []
  const patternSolved = patternQs.filter(qq => progress[String(qq.id)]?.solved).length
  const patternPct = patternQs.length ? Math.round((patternSolved / patternQs.length) * 100) : 0

  const questionListItems = (
    <>
      {filtered.map((fq, i) => {
        const fp = progress[String(fq.id)] || {}
        return (
          <button
            key={fq.id}
            type="button"
            onClick={() => goTo(i)}
            className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 border-b border-gray-50 ${i === safeIdx ? 'bg-indigo-50' : ''}`}
          >
            <span className="shrink-0 tabular-nums text-xs font-mono text-gray-500">#{fq.id}</span>
            <span className="min-w-0 flex-1 truncate text-gray-700">{fq.title}</span>
            <span
              className={`text-xs font-semibold shrink-0 ${fq.difficulty === 'Easy' ? 'text-green-600' : fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
            >
              {fq.difficulty[0]}
            </span>
            {fp.solved && <CheckCircle size={11} className="text-green-500 shrink-0" />}
          </button>
        )
      })}
      {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No questions match.</p>}
    </>
  )

  return (
    <>
    <div className="flex flex-col h-[calc(100dvh-56px)]">

      {/* ── Study mode modal ── */}
      {studyMode === null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setStudyMode('show')}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-indigo-600" />
              <h2 className="text-lg font-black text-gray-900">Study Mode</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">How do you want to study this session?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStudyMode('hide')}
                className="flex items-start gap-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-left hover:bg-indigo-100 transition"
              >
                <span className="text-xl mt-0.5">🧠</span>
                <div>
                  <p className="font-bold text-indigo-700 text-sm">Challenge Mode</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Answers are hidden — try to solve before looking</p>
                </div>
              </button>
              <button
                onClick={() => setStudyMode('show')}
                className="flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 text-left hover:border-gray-300 hover:bg-gray-50 transition"
              >
                <span className="text-xl mt-0.5">📖</span>
                <div>
                  <p className="font-bold text-gray-700 text-sm">Review Mode</p>
                  <p className="text-xs text-gray-500 mt-0.5">Answers are visible — study at your own pace</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar (above editor toolbar, below navbar mobile menu) ── */}
      <div className="relative z-30 flex flex-wrap items-center gap-2 overflow-visible border-b border-gray-100 bg-white px-3 py-2 shrink-0">

        {/* Back to home */}
        <button onClick={() => router.push('/')}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title="Back to questions">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs text-gray-300 font-medium hidden sm:inline">Learn</span>
        <span className="w-px h-4 bg-gray-200 hidden sm:inline-block" />

        {/* Prev / counter / Next */}
        <button onClick={goPrev} disabled={safeIdx === 0}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronLeft size={15} />
        </button>

        <div ref={listWrapRef} className="relative z-0">
          <button
            type="button"
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors"
          >
            <List size={12} />
            <span className="font-mono">{safeIdx + 1}/{filtered.length}</span>
            <span className="hidden sm:inline text-gray-400">·</span>
            <span className="hidden sm:inline text-green-600">{solvedCount} solved</span>
          </button>

          {/* Question list: mobile = fixed, centered on viewport; sm+ = under button */}
          {showList && (
            <>
              <div
                className={listDropdownMobileBackdrop}
                aria-hidden
                onClick={() => setShowList(false)}
              />
              <div className={listDropdownMobilePanelClasses('left')}>{questionListItems}</div>
            </>
          )}
        </div>

        <button onClick={goNext} disabled={safeIdx === filtered.length - 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronRight size={15} />
        </button>

        {/* Progress bar */}
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: filtered.length ? `${((safeIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>

        {/* Filters toggle */}
        <button type="button" data-learn-filter onClick={() => setShowFilters(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
          Filter {filterDiff !== 'All' || filterSource !== 'All' || filterPattern ? '•' : ''}
        </button>

        {q && (
          <>
            {/* Star */}
            <button onClick={() => save({ starred: !starred })}
              className={`p-1.5 rounded-lg border transition-colors ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 hover:border-yellow-300'}`}>
              <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
            </button>

            {/* Mark solved */}
            <button onClick={() => save({ solved: !solved })}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'}`}>
              <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
              <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
              <span className="sm:hidden">{solved ? '✓' : '+'}</span>
            </button>

            {/* Open on LeetCode */}
            <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-gray-300 hover:text-orange-400 transition-colors" title="Open on LeetCode">
              <ExternalLink size={14} />
            </a>

            {/* Question title — own line below buttons on all screen sizes */}
            <p className="order-last w-full text-sm font-bold text-gray-800 leading-snug">{q.title}</p>
          </>
        )}
      </div>

      {/* Pattern context strip */}
      {currentPattern && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
          <span className="text-xs font-semibold text-[var(--text)] truncate">{currentPattern.name}</span>
          {patternPct >= 80 && <span className="text-[10px] font-bold text-green-600  shrink-0">🔥 Crushing it!</span>}
          {patternPct >= 50 && patternPct < 80 && <span className="text-[10px] font-bold text-indigo-500  shrink-0">💪 Solid progress</span>}
          {patternPct > 0 && patternPct < 50 && <span className="text-[10px] font-semibold text-amber-500 shrink-0">📈 Building momentum</span>}
          {patternPct === 0 && <span className="text-[10px] font-semibold text-[var(--text-subtle)] shrink-0">🧩 Fresh territory</span>}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <div className="w-16 sm:w-24 h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${patternPct === 100 ? 'bg-green-500' : patternPct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                style={{ width: patternPct + '%' }}
              />
            </div>
            <span className={`text-[11px] font-bold ${patternPct === 100 ? 'text-green-500' : patternPct >= 50 ? 'text-indigo-400' : 'text-amber-500'}`}>
              {patternSolved}/{patternQs.length}
            </span>
          </div>
        </div>
      )}

      {/* Filter pills row */}
      {showFilters && (
        <div data-learn-filter className="border-b border-gray-100 bg-gray-50 shrink-0 space-y-1 px-3 py-2">
          {/* Difficulty + Source */}
          <div className="flex items-center flex-wrap gap-2">
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} onClick={() => { setFilterDiff(d); const q = buildLearnQuery({ diff: d }); router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false }) }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                {d}
              </button>
            ))}
            <span className="w-px h-4 bg-gray-300 shrink-0" />
            {['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal'].map(s => (
              <button key={s} onClick={() => { setFilterSource(s); const q = buildLearnQuery({ source: s }); router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false }) }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterSource === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Solved filter */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const next = initSolved === true ? null : true
                const q = buildLearnQuery({ solved: next })
                router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                initSolved === true ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
              }`}
            >
              Solved
            </button>
            <button
              type="button"
              onClick={() => {
                const next = initSolved === false ? null : false
                const q = buildLearnQuery({ solved: next })
                router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                initSolved === false ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}
            >
              Unsolved
            </button>
          </div>

          {/* Pattern filter */}
          <div className="flex items-center flex-wrap gap-2">
            <button onClick={() => { setFilterPattern(null); const q = buildLearnQuery({ pattern: null }); router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false }) }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${!filterPattern ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'}`}>
              All Patterns
            </button>
            {QUICK_PATTERNS.map(p => {
              const pp = patternProgressMap[p.name] || { solved: 0, total: 0 }
              const isActive = filterPattern === p.name
              return (
                <button key={p.name}
                  onClick={() => {
                    const next = filterPattern === p.name ? null : p.name
                    setFilterPattern(next)
                    const q = buildLearnQuery({ pattern: next })
                    router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false })
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${isActive ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'}`}>
                  <span>{p.name}</span>
                  {pp.total > 0 && (
                    <span className={`font-mono text-[10px] ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                      {pp.solved}/{pp.total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!q ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No questions match your filters.</div>
      ) : (
        <>
        {/* Unified tab bar */}
        <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
          <button onClick={() => setActiveTab('description')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <BookOpen size={12} /> Description
            {lcLoading && <Loader2 size={10} className="animate-spin text-[var(--text-muted)]" />}
          </button>
          {studyMode !== 'hide' && (
            <button onClick={() => setActiveTab('editorial')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'editorial' ? 'border-purple-500 text-purple-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
              <FileText size={12} /> Editorial
            </button>
          )}
          {studyMode !== 'hide' && (
            <button onClick={() => setActiveTab('best')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'best' ? 'border-amber-500 text-amber-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
              <Sparkles size={12} /> Best answers
            </button>
          )}
          {studyMode !== 'hide' && (
            <button onClick={() => setActiveTab('accepted')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
              🏆 My Solutions
            </button>
          )}
          <button onClick={() => setStudyMode(prev => prev === 'hide' ? 'show' : 'hide')}
            className={`ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${studyMode === 'hide' ? 'text-orange-500 hover:text-orange-600' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            🧠 {studyMode === 'hide' ? 'Challenge Mode' : 'Review Mode'}
          </button>
        </div>
        <div className="relative z-0 flex flex-col md:flex-row min-h-0 flex-1 overflow-hidden">

          {/* ── Content panel (all non-editor tabs) ── */}
          <div className="flex flex-col w-full md:w-[42%] md:shrink-0 bg-[var(--bg-card)] overflow-hidden text-[var(--text)] border-r border-[var(--border)]">

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Description tab ── */}
              {leftPanelTab === 'description' && (
                <div className="p-4 space-y-4">

                  {/* Title + meta */}
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
                    <h1 className="font-bold text-gray-800 text-base leading-snug">{q.title}</h1>
                    {solved && nextReview && !due && (
                      <p className="text-xs text-green-600 mt-1">
                        🗓 Next review: {formatLocalDate(nextReview)} · {nextIntervalDays(reviewCount + 1)}d interval
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {(q.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.tags.map(t => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* SR review banner */}
                  {due && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-indigo-600" />
                        <span className="text-xs font-semibold text-indigo-700">Review #{reviewCount + 1} due!</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFailReview}
                          disabled={reviewDone}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${
                            reviewDone
                              ? 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)]'
                              : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-300'
                          }`}
                        >
                          Again
                        </button>
                        <button
                          onClick={handleCompleteReview}
                          disabled={reviewDone}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            reviewDone ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {reviewDone ? `✓ Next in ${nextIntervalDays(reviewCount + 1)}d` : 'Pass'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live LeetCode description */}
                  {lcContent ? (
                    <div className="lc-description text-sm text-[var(--text)]" dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                  ) : isPremium ? (
                    <PremiumBlock slug={lcTitleSlug} />
                  ) : lcLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-5/6" />
                      <div className="h-3 bg-gray-100 rounded w-4/6" />
                      <div className="h-10 bg-gray-100 rounded w-full mt-2" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  ) : (
                    q.description
                      ? <DescriptionRenderer description={q.description} />
                      : <span className="text-gray-400 italic text-xs">
                          No description cached.{' '}
                          <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                        </span>
                  )}

                  {/* Company sources */}
                  {(q.source || []).length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Asked by</p>
                      <div className="flex flex-wrap gap-1.5">
                        {q.source.map(s => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge level */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
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
                      <p className="text-xs text-gray-400 mt-2">Mark Solved to start spaced repetition.</p>
                    )}
                  </div>
                </div>
              )}

              {leftPanelTab === 'best' && (
                <div className="p-4 h-full">
                  <BestAnswersPanel questionId={q.id} slug={lcTitleSlug ?? q.slug} active={leftPanelTab === 'best'} />
                </div>
              )}
              {leftPanelTab === 'editorial' && (
                <div className="p-4 space-y-4">
                  <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-200">
                      <BookOpen size={14} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-gray-800">Editorial</span>
                      <span className="ml-auto text-xs text-indigo-400 font-medium">LeetCode</span>
                    </div>
                    {editorialLoad ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
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
                            h2: ({ children }) => <h2 className="text-base font-bold text-gray-900 mt-6 mb-2 pb-1 border-b border-gray-100">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold text-indigo-700 mt-5 mb-2 flex items-center gap-1.5"><span className="w-1 h-4 bg-indigo-400 rounded-full inline-block shrink-0"/>{children}</h3>,
                            h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-1.5">{children}</h4>,
                            p: ({ children }) => {
                              const text = String(children)
                              if (text.startsWith('[TOC]') || text === '&nbsp;') return null
                              return <p className="text-sm text-gray-700 leading-relaxed my-2.5">{children}</p>
                            },
                            ul: ({ children }) => <ul className="my-2 space-y-1 pl-5 list-none">{children}</ul>,
                            ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal text-sm text-gray-700">{children}</ol>,
                            li: ({ children }) => <li className="text-sm text-gray-700 leading-relaxed flex gap-2"><span className="text-indigo-400 shrink-0 mt-0.5">•</span><span>{children}</span></li>,
                            code: ({ children, className }) =>
                              className
                                ? <code className="text-[12px] font-mono">{children}</code>
                                : <code className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                            pre: ({ children }) => {
                              const child = children as React.ReactElement<{ className?: string; children?: string }>
                              const lang = (child?.props?.className ?? '').replace('language-', '') || 'text'
                              const code = child?.props?.children ?? ''
                              return <EditorialCodeBlock code={String(code).trimEnd()} lang={lang} />
                            },
                            hr: () => <hr className="my-4 border-gray-100" />,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-300 pl-4 my-3 text-sm text-gray-600 italic">{children}</blockquote>,
                            table: ({ children }) => <div className="overflow-x-auto my-3"><table className="text-xs border-collapse w-full">{children}</table></div>,
                            th: ({ children }) => <th className="bg-gray-100 border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-700">{children}</th>,
                            td: ({ children }) => <td className="border border-gray-200 px-3 py-1.5 text-gray-700">{children}</td>,
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
                      <div className="py-8 text-center text-xs text-gray-400">
                        No editorial available for this question.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {leftPanelTab === 'accepted' && (
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

          {/* ── Editor panel ── */}
          <div className="flex flex-col w-full md:w-[58%] flex-1 min-h-[28rem] overflow-x-hidden border-t border-[var(--border)] md:border-t-0">
            <LeetCodeEditor appQuestionId={q.id} slug={q.slug} onAccepted={due && !reviewDone ? handleCompleteReview : undefined} />
          </div>
        </div>
        </>
      )}

      {/* lc-description styles live in globals.css — no inline override needed */}
    </div>

    <section className="border-t border-gray-100 bg-gray-50/90">
      <div className="mx-auto max-w-6xl px-3 py-6 pb-10">
        <LearnAcSubmitTable onSolve={openQuestionInLearn} />
      </div>
    </section>
    </>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100dvh-56px)] text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>}>
      <LearnInner />
    </Suspense>
  )
}

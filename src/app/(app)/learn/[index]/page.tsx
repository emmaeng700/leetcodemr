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
  BookOpen, List, Code2, ExternalLink, Loader2, FileText, StickyNote,
  Copy, Check,
} from 'lucide-react'
import { getProgress, updateProgress, completeReview, getStudyPlan } from '@/lib/db'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { QUICK_PATTERNS } from '@/lib/constants'
import { isDue, formatLocalDate, nextIntervalDays } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import StatusRadio from '@/components/StatusRadio'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import LeetCodeEditor from '@/components/LeetCodeEditor'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

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
        <a href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noopener noreferrer"
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
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [showList, setShowList]     = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [leftTab, setLeftTab]       = useState<'description' | 'notes' | 'solution' | 'accepted'>('description')
  const [studyMode, setStudyMode]   = useState<'show' | 'hide' | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem('lm_study_mode')
    return (saved === 'show' || saved === 'hide') ? saved : null
  })
  const [filterDiff, setFilterDiff]         = useState(initDiff)
  const [filterSource, setFilterSource]     = useState(initSource)
  const [filterPattern, setFilterPattern]   = useState<string | null>(
    initTags.length > 0 ? (QUICK_PATTERNS.find(p => p.tags.some(t => initTags.includes(t)))?.name ?? null) : null
  )
  const [showFilters, setShowFilters]       = useState(false)
  const [mobilePanel, setMobilePanel]       = useState<'description' | 'editor'>('description')
  const listWrapRef = useRef<HTMLDivElement>(null)

  const [lcContent, setLcContent]   = useState<string | null>(null)
  const [lcLoading, setLcLoading]   = useState(false)
  const [isPremium, setIsPremium]   = useState(false)
  const [editorial, setEditorial]       = useState<string | null>(null)
  const [editorialLoad, setEditorialLoad] = useState(false)
  const [lcSession, setLcSession]       = useState('')
  const [lcCsrf, setLcCsrf]            = useState('')

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
    }) => {
      const sp = new URLSearchParams(searchParams.toString())
      const diff = overrides?.diff !== undefined ? overrides.diff : filterDiff
      const source = overrides?.source !== undefined ? overrides.source : filterSource
      const pattern = overrides?.pattern !== undefined ? overrides.pattern : filterPattern
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
      return sp.toString()
    },
    [searchParams, filterDiff, filterSource, filterPattern],
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

  const activePatternTags = filterPattern
    ? (QUICK_PATTERNS.find(p => p.name === filterPattern)?.tags ?? []) as readonly string[]
    : (initTags.length > 0 ? initTags : []) as string[]

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
    if (activePatternTags.length > 0 && !(q.tags || []).some(t => activePatternTags.includes(t))) return false
    const p = progress[String(q.id)] || {}
    if (initStarred && !p.starred) return false
    if (initSolved === true  && !p.solved) return false
    if (initSolved === false &&  p.solved) return false
    return true
  })

  const safeIdx = Math.min(routeIndex, Math.max(filtered.length - 1, 0))
  const q         = filtered[safeIdx] || null
  const p         = q ? (progress[String(q.id)] || {}) : {}
  const solved    = p.solved    || false
  const starred   = p.starred   || false
  const status    = p.status    || null
  const reviewCount = p.review_count || 0
  const nextReview  = p.next_review  || null
  const due = isDue(nextReview) && solved
  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(q?.slug, leftTab === 'accepted')

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

  // Learn Hub: resume "Continue session"
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (filtered.length === 0) return
    try {
      localStorage.setItem(
        'lm_learn_resume',
        JSON.stringify({ index: safeIdx, query: learnQs || '' }),
      )
    } catch {
      /* ignore quota */
    }
  }, [safeIdx, learnQs, filtered.length])

  // Reset per question
  useEffect(() => {
    if (q) setNotes(progress[String(q.id)]?.notes || '')
    setReviewDone(false)
    setLcContent(null)
    setIsPremium(false)
  }, [q?.id])

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
        variables: { titleSlug: q.slug },
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
  }, [q?.slug])

  // Fetch editorial when solution tab opens (requires LeetCode session for premium)
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
  }, [leftTab, q?.slug, lcSession, lcCsrf])

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

  const save = async (patch: any = {}) => {
    if (!q) return
    setSaving(true)
    const updated = { solved, starred, notes, status, ...patch, question_id: q.id }
    await updateProgress(q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
    setSaving(false)
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

  const solvedCount = filtered.filter(fq => progress[String(fq.id)]?.solved).length

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
    <div className="flex flex-col h-[calc(100vh-56px)]">

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

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white shrink-0 flex-wrap overflow-visible">

        {/* Back to home */}
        <button onClick={() => router.push('/')}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title="Back to questions">
          <ChevronLeft size={15} />
        </button>
        <a
          href="/learn"
          className="shrink-0 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Hub
        </a>
        <a
          href="/learn/submissions"
          className="shrink-0 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
          title="Accepted submit counts"
        >
          AC
        </a>
        <span className="text-xs text-gray-300 font-medium hidden sm:inline">Learn</span>
        <span className="w-px h-4 bg-gray-200 hidden sm:inline-block" />

        {/* Prev / counter / Next */}
        <button onClick={goPrev} disabled={safeIdx === 0}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronLeft size={15} />
        </button>

        <div ref={listWrapRef} className="relative z-10">
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
            <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-gray-300 hover:text-orange-400 transition-colors" title="Open on LeetCode">
              <ExternalLink size={14} />
            </a>
          </>
        )}
      </div>

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

          {/* Pattern filter */}
          <div className="flex items-center flex-wrap gap-2">
            <button onClick={() => { setFilterPattern(null); const q = buildLearnQuery({ pattern: null }); router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false }) }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${!filterPattern ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'}`}>
              All Patterns
            </button>
            {QUICK_PATTERNS.map(p => (
              <button key={p.name}
                onClick={() => {
                  const next = filterPattern === p.name ? null : p.name
                  setFilterPattern(next)
                  const q = buildLearnQuery({ pattern: next })
                  router.push(`/learn/0${q ? `?${q}` : ''}`, { scroll: false })
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterPattern === p.name ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!q ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No questions match your filters.</div>
      ) : (
        <>
        {/* Mobile panel tabs */}
        <div className="flex md:hidden border-b border-gray-100 bg-white shrink-0">
          <button onClick={() => setMobilePanel('description')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400'}`}>
            📖 Description
          </button>
          <button onClick={() => setMobilePanel('editor')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'editor' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400'}`}>
            💻 Editor
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT panel ── */}
          <div className={`${mobilePanel === 'description' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-gray-100 bg-white overflow-hidden text-gray-900`}>

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 bg-white shrink-0">
              <button onClick={() => setLeftTab('description')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <BookOpen size={12} /> Description
                {lcLoading && <Loader2 size={10} className="animate-spin text-gray-300 ml-0.5" />}
              </button>
              <button onClick={() => setLeftTab('notes')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'notes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <StickyNote size={12} /> Notes
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
                🧠 {studyMode === 'hide' ? 'Challenge Mode' : 'Review Mode'}
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Description tab ── */}
              {leftTab === 'description' && (
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
                      <button onClick={handleCompleteReview} disabled={reviewDone}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${reviewDone ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {reviewDone ? `✓ Next in ${nextIntervalDays(reviewCount + 1)}d` : 'Mark Done'}
                      </button>
                    </div>
                  )}

                  {/* Live LeetCode description */}
                  {lcContent ? (
                    <div className="lc-description text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: lcContent }} />
                  ) : isPremium ? (
                    <PremiumBlock slug={q.slug} />
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
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {q.description || (
                        <span className="text-gray-400 italic text-xs">
                          No description cached.{' '}
                          <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                        </span>
                      )}
                    </div>
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

              {/* ── Notes tab ── */}
              {leftTab === 'notes' && (
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">📝 My Notes — {q.title}</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onBlur={() => save({ notes })}
                    rows={12}
                    placeholder="Write your notes, intuition, edge cases, time complexity…"
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                  <button onClick={() => save({ notes })} disabled={saving}
                    className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              )}

              {/* ── Solution tab ── */}
              {leftTab === 'solution' && studyMode === 'show' && (
                <div className="p-4 space-y-4">
                  <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />

                  {/* ── LeetCode Editorial ── */}
                  <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-200">
                      <BookOpen size={14} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-gray-800">Official Editorial</span>
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
                            // Strip TOC, iframes, video divs
                            iframe: () => null,
                            // Headings
                            h2: ({ children }) => <h2 className="text-base font-bold text-gray-900 mt-6 mb-2 pb-1 border-b border-gray-100">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold text-indigo-700 mt-5 mb-2 flex items-center gap-1.5"><span className="w-1 h-4 bg-indigo-400 rounded-full inline-block shrink-0"/>{children}</h3>,
                            h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-1.5">{children}</h4>,
                            // Paragraphs
                            p: ({ children }) => {
                              const text = String(children)
                              if (text.startsWith('[TOC]') || text === '&nbsp;') return null
                              return <p className="text-sm text-gray-700 leading-relaxed my-2.5">{children}</p>
                            },
                            // Lists
                            ul: ({ children }) => <ul className="my-2 space-y-1 pl-5 list-none">{children}</ul>,
                            ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal text-sm text-gray-700">{children}</ol>,
                            li: ({ children }) => <li className="text-sm text-gray-700 leading-relaxed flex gap-2"><span className="text-indigo-400 shrink-0 mt-0.5">•</span><span>{children}</span></li>,
                            // Inline code
                            code: ({ children, className }) =>
                              className
                                ? <code className="text-[12px] font-mono">{children}</code>
                                : <code className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                            // Fenced code blocks — syntax highlighted, same style as CodePanel
                            pre: ({ children }) => {
                              const child = children as React.ReactElement<{ className?: string; children?: string }>
                              const lang = (child?.props?.className ?? '').replace('language-', '') || 'text'
                              const code = child?.props?.children ?? ''
                              return <EditorialCodeBlock code={String(code).trimEnd()} lang={lang} />
                            },
                            // Horizontal rules as section dividers
                            hr: () => <hr className="my-4 border-gray-100" />,
                            // Bold
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            // Block quotes
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-300 pl-4 my-3 text-sm text-gray-600 italic">{children}</blockquote>,
                            // Tables
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
              {leftTab === 'solution' && studyMode === 'hide' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="font-bold text-gray-700 text-sm mb-1">Answers Hidden</p>
                  <p className="text-xs text-gray-400 mb-4">You're in Challenge Mode. Try solving it yourself first!</p>
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

          {/* ── RIGHT panel — editor ── */}
          <div className={`${mobilePanel === 'editor' ? 'flex flex-col' : 'hidden'} md:flex flex-1 min-h-0 overflow-x-hidden`}>
            <LeetCodeEditor appQuestionId={q.id} slug={q.slug} onAccepted={due && !reviewDone ? handleCompleteReview : undefined} />
          </div>
        </div>
        </>
      )}

      {/* LeetCode description styles */}
      <style>{`
        .lc-description pre { background:#f6f8fa; border-radius:6px; padding:12px; overflow-x:auto; font-size:12px; margin:8px 0; }
        .lc-description code { background:#f0f0f0; border-radius:3px; padding:1px 4px; font-size:12px; }
        .lc-description pre code { background:none; padding:0; }
        .lc-description p { margin:6px 0; font-size:13px; line-height:1.6; }
        .lc-description ul, .lc-description ol { padding-left:20px; margin:6px 0; font-size:13px; }
        .lc-description li { margin:3px 0; }
        .lc-description strong { font-weight:600; }
        .lc-description img { max-width:100%; border-radius:6px; margin:8px 0; }
        .lc-description sup { font-size:10px; }
      `}</style>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>}>
      <LearnInner />
    </Suspense>
  )
}

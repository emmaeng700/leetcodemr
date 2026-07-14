'use client'
import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import toast from 'react-hot-toast'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Brain, CheckCircle, Circle, Star,
  BookOpen, List, ExternalLink, Loader2,
  Sparkles, RefreshCw, X, Play, RotateCcw,
} from 'lucide-react'
import { getProgress, updateProgress, completeReview, failReview, getCycleState, saveCycleState, clampCycleIdx, getWrongSubmitCounts } from '@/lib/db'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap, getPatternForQuestion } from '@/lib/patternUtils'
import { PATTERN_PRIORITY } from '@/lib/constants'
import StudyRoundHeader, { isNewRound } from '@/components/StudyRoundHeader'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
import { isDue, formatLocalDate, nextIntervalDays, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import MobileSplitPanelTabs, { type MobileSplitPanel } from '@/components/MobileSplitPanelTabs'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import LearnSetTabs from '@/components/LearnSetTabs'
import CycleProgressBanner from '@/components/CycleProgressBanner'
import BestSolutionsSection from '@/components/BestSolutionsContent'
import { canonicalCycleBaseIds, readSessionCycleOrder } from '@/lib/cycleLapReset'

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
  const fromFlashcards = searchParams.get('from') === 'flashcards'

  const [questions, setQuestions]   = useState<Question[]>([])
  const [planOrder, setPlanOrder]   = useState<number[]>([])
  const [progress, setProgress]     = useState<Record<string, any>>({})
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({})
  const [runs, setRuns]             = useState<Record<string, number>>({})
  const [showList, setShowList]     = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [activeTab, setActiveTab]   = useState<'description' | 'best' | 'editor'>('description')
  const [mobilePanel, setMobilePanel] = useState<MobileSplitPanel>('content')
  // IMPORTANT: don't read localStorage during render (causes hydration mismatch).
  const [studyMode, setStudyMode]   = useState<'show' | 'hide' | null>(null)
  const [lcListHashes, setLcListHashes] = useState<Record<string, string>>({})
  const [lcListLoading, setLcListLoading] = useState(false)

  // ── Cycle marker — persisted in Supabase + localStorage + sessionStorage ──
  const [cycleRange, setCycleRangeRaw] = useState<{ start: number; end: number } | null>(null)
  const [cycleReps, setCycleRepsRaw] = useState(0)
  const [cyclePos, setCyclePosRaw] = useState(0)
  const cycleAcceptedRef = useRef<Set<number>>(new Set())
  const [cycleAcceptedCount, setCycleAcceptedCount] = useState(0)
  const cycleRangeForSave   = useRef<{ start: number; end: number } | null>(null)
  const cycleRepsRef        = useRef(cycleReps)
  const cyclePosRef         = useRef(cyclePos)
  const cycleIdxRef         = useRef(0)
  const cycleOrderedIdsRef  = useRef<number[]>([])
  const cycleHydratedRef    = useRef(false)

  // ── Determines traversal order for a given lap rep count ──────────────────
  // Lap 0 → normal study order. Every subsequent lap → weighted shuffle:
  // questions with more wrong submissions appear earlier (weight = 1 + wrongCount).
  const buildCycleOrder = (baseIds: number[], reps: number, wrongCounts: Record<string, number> = {}): number[] => {
    if (reps === 0) return [...baseIds]
    const arr = [...baseIds]
    // Weight: 1 (never wrong) up to 1+N (wrong N times). Forward weighted Fisher-Yates
    // fills position 0 first, so high-weight items land near the front.
    const weights = arr.map(id => 1 + (wrongCounts[String(id)] ?? 0))
    for (let i = 0; i < arr.length - 1; i++) {
      let total = 0
      for (let k = i; k < arr.length; k++) total += weights[k]
      let r = Math.random() * total
      let j = i
      for (; j < arr.length - 1; j++) {
        r -= weights[j]
        if (r <= 0) break
      }
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      ;[weights[i], weights[j]] = [weights[j], weights[i]]
    }
    return arr
  }

  const syncCycleToSession = (state: {
    cycleRange: { start: number; end: number } | null
    cycleReps: number
    cyclePos: number
    cycleIdx?: number
    cycleAccepted: number[]
    cycleOrderedIds?: number[]
  }) => {
    try {
      if (state.cycleRange) {
        sessionStorage.setItem('lm_learn_cycle', JSON.stringify(state.cycleRange))
        sessionStorage.setItem('lm_learn_cycle_reps', String(state.cycleReps))
        sessionStorage.setItem('lm_learn_cycle_pos', String(state.cyclePos))
        if (typeof state.cycleIdx === 'number') {
          sessionStorage.setItem('lm_learn_cycle_idx', String(state.cycleIdx))
        }
        sessionStorage.setItem('lm_learn_cycle_accepted', JSON.stringify(state.cycleAccepted))
        if (state.cycleOrderedIds) {
          sessionStorage.setItem('lm_learn_cycle_order', JSON.stringify(state.cycleOrderedIds))
        }
      } else {
        sessionStorage.removeItem('lm_learn_cycle')
        sessionStorage.removeItem('lm_learn_cycle_reps')
        sessionStorage.removeItem('lm_learn_cycle_pos')
        sessionStorage.removeItem('lm_learn_cycle_idx')
        sessionStorage.removeItem('lm_learn_cycle_accepted')
        sessionStorage.removeItem('lm_learn_cycle_order')
      }
    } catch {}
  }

  const applyCycleState = (state: {
    cycleRange: { start: number; end: number } | null
    cycleReps: number
    cyclePos: number
    cycleIdx?: number
    cycleAccepted: number[]
    cycleOrderedIds?: number[]
  }) => {
    setCycleRangeRaw(state.cycleRange)
    setCycleRepsRaw(state.cycleReps)
    setCyclePosRaw(state.cyclePos)
    if (state.cycleRange && typeof state.cycleIdx === 'number') {
      cycleIdxRef.current = state.cycleIdx
    }
    if (Array.isArray(state.cycleOrderedIds) && state.cycleOrderedIds.length > 0) {
      cycleOrderedIdsRef.current = state.cycleOrderedIds
    }
    cycleAcceptedRef.current = new Set(state.cycleAccepted)
    setCycleAcceptedCount(state.cycleAccepted.length)
    cycleRangeForSave.current = state.cycleRange
    syncCycleToSession(state)
  }

  const persistCycleState = (state: {
    cycleRange: { start: number; end: number } | null
    cycleReps: number
    cyclePos: number
    cycleIdx?: number
    cycleAccepted: number[]
    cycleOrderedIds?: number[]
  } | null) => {
    // Avoid overwriting Supabase with empty accepts before async restore finishes
    if (!cycleHydratedRef.current && state?.cycleRange) return
    const withOrder = state ? { ...state, cycleOrderedIds: state.cycleOrderedIds ?? cycleOrderedIdsRef.current } : null
    syncCycleToSession(withOrder ?? { cycleRange: null, cycleReps: 0, cyclePos: 0, cycleAccepted: [] })
    saveCycleState(withOrder).catch(() => {})
  }

  useEffect(() => { cycleRangeForSave.current = cycleRange }, [cycleRange])
  useEffect(() => { cycleRepsRef.current = cycleReps }, [cycleReps])
  useEffect(() => { cyclePosRef.current = cyclePos }, [cyclePos])

  const setCycleRange = (range: { start: number; end: number } | null) => {
    const prev = cycleRangeForSave.current
    const sameRange = !!range && !!prev && range.start === prev.start && range.end === prev.end
    if (sameRange) return

    if (!range) {
      applyCycleState({ cycleRange: null, cycleReps: 0, cyclePos: 0, cycleAccepted: [] })
      persistCycleState(null)
      return
    }

    const startIdx = range.start
    cycleIdxRef.current = startIdx
    // reps=0 → normal order (studyOrder as in filtered)
    const baseIds = filteredRef.current.slice(range.start, range.end + 1).map(q => q.id)
    cycleOrderedIdsRef.current = baseIds
    applyCycleState({ cycleRange: range, cycleReps: 0, cyclePos: 0, cycleIdx: startIdx, cycleAccepted: [], cycleOrderedIds: baseIds })
    persistCycleState({ cycleRange: range, cycleReps: 0, cyclePos: 0, cycleIdx: startIdx, cycleAccepted: [], cycleOrderedIds: baseIds })
  }

  const setCycleReps = (n: number) => {
    setCycleRepsRaw(n)
    const rng = cycleRangeForSave.current
    if (!rng) return
    persistCycleState({
      cycleRange: rng,
      cycleReps: n,
      cyclePos: cyclePosRef.current,
      cycleIdx: cycleIdxRef.current,
      cycleAccepted: [...cycleAcceptedRef.current],
    })
  }
  const setCyclePos = (n: number) => {
    setCyclePosRaw(n)
    const rng = cycleRangeForSave.current
    if (!rng) return
    persistCycleState({
      cycleRange: rng,
      cycleReps: cycleRepsRef.current,
      cyclePos: n,
      cycleIdx: cycleIdxRef.current,
      cycleAccepted: [...cycleAcceptedRef.current],
    })
  }
  const CYCLE_REP_TARGET = 10

  const recordCycleAccepted = (questionId: number): boolean => {
    if (cycleAcceptedRef.current.has(questionId)) return false
    cycleAcceptedRef.current.add(questionId)
    const arr = [...cycleAcceptedRef.current]
    setCycleAcceptedCount(arr.length)
    const rng = cycleRangeForSave.current
    if (rng) {
      persistCycleState({
        cycleRange: rng,
        cycleReps: cycleRepsRef.current,
        cyclePos: cyclePosRef.current,
        cycleIdx: cycleIdxRef.current,
        cycleAccepted: arr,
      })
    }
    return true
  }
  const resetCycleAccepted = () => {
    cycleAcceptedRef.current = new Set()
    setCycleAcceptedCount(0)
    const rng = cycleRangeForSave.current
    if (rng) {
      persistCycleState({
        cycleRange: rng,
        cycleReps: cycleRepsRef.current,
        cyclePos: cyclePosRef.current,
        cycleIdx: cycleIdxRef.current,
        cycleAccepted: [],
      })
    }
  }

  const [showCyclePanel, setShowCyclePanel] = useState(false)
  const [cycleFromInput, setCycleFromInput] = useState('1')
  const [cycleToInput,   setCycleToInput]   = useState('')
  // ─────────────────────────────────────────────────────────────────────────────
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

  const lcListKey = useMemo(
    () => filterPattern ? `p:${filterPattern}` : filterDiff !== 'All' ? `d:${filterDiff}` : 'all',
    [filterPattern, filterDiff],
  )

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
    try {
      const saved = localStorage.getItem('lm_study_mode')
      setStudyMode(saved === 'show' || saved === 'hide' ? saved : null)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getWrongSubmitCounts(),
    ]).then(([qs, prog, wc]) => {
      setQuestions(qs)
      setProgress(prog ?? {})
      setWrongCounts(wc)
      setPlanOrder(defaultStudyQuestionOrder(qs as Question[]))
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

  const safeIdx  = filtered.length ? Math.min(Math.max(routeIndex, 0), filtered.length - 1) : 0
  const gatedIdx = safeIdx
  const q        = filtered[gatedIdx] || null
  const lcTitleSlug = q ? resolveLeetCodeSlug(q.id, q.slug) : undefined
  const p         = q ? (progress[String(q.id)] || {}) : {}
  const solved    = p.solved    || false
  const starred   = p.starred   || false
  const reviewCount = p.review_count || 0
  const nextReview  = p.next_review  || null
  const due = isDue(nextReview) && solved
  useEffect(() => {
    if (filtered.length === 0) return
    if (routeIndex !== safeIdx) {
      router.replace(`/learn/${safeIdx}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    }
  }, [filtered.length, routeIndex, safeIdx, learnQs, router])

  // Persist current question index so coming back to /learn restores position
  useEffect(() => {
    try { localStorage.setItem('lm_learn_idx', String(gatedIdx)) } catch {}
  }, [gatedIdx])

  // Persist position within active cycle (used when re-opening from Cycles page).
  // Guard: only persist when gatedIdx matches the INTENDED position (cycleIdxRef.current).
  // This prevents a race where React re-renders (state changed) before router.push completes,
  // firing this effect with the OLD gatedIdx and writing a stale cycleIdx to Supabase.
  // Every code path that calls router.push in cycle mode must update cycleIdxRef.current first.
  useEffect(() => {
    const rng = cycleRangeForSave.current
    if (!rng) return
    if (gatedIdx < rng.start || gatedIdx > rng.end) return
    if (gatedIdx !== cycleIdxRef.current) return   // navigation not yet landed — skip
    persistCycleState({
      cycleRange: rng,
      cycleReps: cycleRepsRef.current,
      cyclePos: cyclePosRef.current,
      cycleIdx: gatedIdx,
      cycleAccepted: [...cycleAcceptedRef.current],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatedIdx])

  // Persist study mode to localStorage
  useEffect(() => {
    if (studyMode !== null) localStorage.setItem('lm_study_mode', studyMode)
  }, [studyMode])

  // Load LC list hashes from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lm_lc_lists')
      if (raw) setLcListHashes(JSON.parse(raw))
    } catch {}
  }, [])

  // In challenge mode, kick off any answer-revealing tab back to description
  useEffect(() => {
    if (studyMode === 'hide' && activeTab === 'best') {
      setActiveTab('description')
    }
  }, [studyMode, activeTab])

  useEffect(() => {
    if (activeTab === 'editor') setMobilePanel('editor')
  }, [activeTab])

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

  // ── Cycle-aware navigation — wraps within the active range ───────────────────
  // Derived convenience values (used in JSX for display)
  const cycleStart = cycleRange?.start ?? 0
  const cycleEnd   = cycleRange?.end   ?? Math.max(filtered.length - 1, 0)
  const cycleResumeIdx = cycleRange ? clampCycleIdx(cycleIdxRef.current, cycleRange) : null
  const needsCycleResume = !!cycleRange && cycleResumeIdx != null && gatedIdx !== cycleResumeIdx

  // Refs hold always-fresh copies so goNext/goPrev never close over stale values.
  // This prevents the race where a useCallback closure sees old gatedIdx/cycleEnd
  // when the user clicks → before the re-render from router.push completes.
  const gatedIdxRef      = useRef(gatedIdx)
  const cycleRangeRef    = useRef(cycleRange)
  const filteredLenRef   = useRef(filtered.length)
  const filteredRef      = useRef(filtered)
  const orderedRef       = useRef(ordered)
  const learnQsRef       = useRef(learnQs)
  const wrongCountsRef   = useRef(wrongCounts)
  useEffect(() => { gatedIdxRef.current    = gatedIdx },        [gatedIdx])
  useEffect(() => { cycleRangeRef.current  = cycleRange },      [cycleRange])
  useEffect(() => { wrongCountsRef.current = wrongCounts },     [wrongCounts])
  useEffect(() => { filteredLenRef.current = filtered.length }, [filtered.length])
  useEffect(() => { filteredRef.current    = filtered },        [filtered])
  useEffect(() => { orderedRef.current     = ordered },         [ordered])
  useEffect(() => { learnQsRef.current     = learnQs },         [learnQs])

  // Restore full cycle progress on mount (survives tab close / navigation away).
  // Must live AFTER filtered is declared, and fires only once filtered is non-empty so
  // filteredRef is populated before we try to rebuild orderedIds.
  // Without this guard, getCycleState() resolves before /questions_full.json loads,
  // orderedIds can't be rebuilt, cycleIdx defaults to rng.start while cyclePos stays
  // at the stored value → counter shows 3/3 but question 1 is displayed, and Next
  // overflows to 4/3.
  const cycleRestoredRef = useRef(false)
  useEffect(() => {
    if (filtered.length === 0) return       // wait for questions to load
    if (cycleRestoredRef.current) return    // only run once regardless of filter changes
    cycleRestoredRef.current = true

    let cancelled = false
    getCycleState().then(state => {
      if (cancelled) return
      if (cycleRangeForSave.current !== null) {
        cycleHydratedRef.current = true
        return
      }
      if (!state?.cycleRange) {
        cycleHydratedRef.current = true
        return
      }
      const rng      = state.cycleRange
      const reps     = state.cycleReps ?? 0
      const pos      = state.cyclePos  ?? 0
      const accepted = Array.isArray(state.cycleAccepted) ? state.cycleAccepted : []

      // Rebuild orderedIds if missing or wrong length (filteredRef is guaranteed non-empty here).
      let orderedIds = Array.isArray(state.cycleOrderedIds) ? state.cycleOrderedIds : []
      const expectedLen = rng.end - rng.start + 1
      let trustedOrder = orderedIds.length === expectedLen
      if (!trustedOrder) {
        const fromSession = readSessionCycleOrder()
        if (fromSession && fromSession.length === expectedLen) {
          orderedIds = fromSession
          trustedOrder = true
        } else {
          const baseIds = filteredRef.current.slice(rng.start, rng.end + 1).map(q => q.id)
          if (baseIds.length === expectedLen) {
            orderedIds = buildCycleOrder(baseIds, reps, wrongCountsRef.current)
          }
        }
      }

      // Derive cycleIdx from orderedIds[pos] only when we had the ORIGINAL stored order.
      // If orderedIds was just rebuilt (fresh shuffle), it's a different random sequence —
      // using orderedIds[pos] from it would point to a wrong question and trigger a
      // router.replace loop (component remounts → guard resets → new shuffle → new replace…).
      // Instead, trust the stored cycleIdx directly when the order had to be rebuilt.
      let cycleIdx = rng.start
      if (trustedOrder && orderedIds.length > 0 && pos < orderedIds.length) {
        const targetId  = orderedIds[pos]
        const targetIdx = filteredRef.current.findIndex(q => q.id === targetId)
        cycleIdx = targetIdx >= 0 ? targetIdx : rng.start
      } else {
        // No stored order — use the saved cycleIdx (set by handleActivate / goNext / etc.)
        const stored = state.cycleIdx
        cycleIdx = typeof stored === 'number'
          ? Math.max(rng.start, Math.min(stored, rng.end))
          : rng.start
      }

      applyCycleState({ cycleRange: rng, cycleReps: reps, cyclePos: pos, cycleIdx, cycleAccepted: accepted, cycleOrderedIds: orderedIds })
      cycleHydratedRef.current = true
      if (accepted.length > 0 || orderedIds.length === expectedLen) {
        persistCycleState({
          cycleRange: rng,
          cycleReps: reps,
          cyclePos: pos,
          cycleIdx,
          cycleAccepted: accepted,
          cycleOrderedIds: orderedIds,
        })
      }

      // Auto-correct URL if we landed on the wrong question.
      if (cycleIdx !== gatedIdxRef.current) {
        const qs = learnQsRef.current
        router.replace(`/learn/${cycleIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
      }
    }).catch(() => { cycleHydratedRef.current = true })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  const resumeCycle = useCallback(() => {
    const rng = cycleRangeRef.current
    if (!rng) return
    const idx = clampCycleIdx(cycleIdxRef.current, rng)
    const qs = learnQsRef.current
    router.push(`/learn/${idx}${qs ? `?${qs}` : ''}`, { scroll: false })
    toast.success(`Resumed cycle at question ${idx + 1}`)
  }, [router])

  const resetToLapOne = useCallback(() => {
    const rng = cycleRangeRef.current
    if (!rng) return
    const ids = cycleOrderedIdsRef.current
    const membership = ids.length > 0
      ? canonicalCycleBaseIds(ids, orderedRef.current)
      : filteredRef.current.slice(rng.start, rng.end + 1).map(q => q.id)
    if (membership.length === 0) {
      toast.error('Could not restore cycle questions — try re-activating from Cycles.')
      return
    }
    const newOrder = buildCycleOrder(membership, 0, wrongCountsRef.current)
    cycleOrderedIdsRef.current = newOrder
    cycleAcceptedRef.current = new Set()
    setCycleAcceptedCount(0)
    setCycleRepsRaw(0)
    cycleRepsRef.current = 0
    setCyclePosRaw(0)
    cyclePosRef.current = 0

    const firstId = newOrder[0]
    const firstIdx = filteredRef.current.findIndex(q => q.id === firstId)
    const startIdx = firstIdx >= 0 ? firstIdx : rng.start
    cycleIdxRef.current = startIdx

    const patch = {
      cycleRange: rng,
      cycleReps: 0,
      cyclePos: 0,
      cycleIdx: startIdx,
      cycleAccepted: [] as number[],
      cycleOrderedIds: newOrder,
    }
    applyCycleState(patch)
    persistCycleState(patch)

    const qs = learnQsRef.current
    router.push(`/learn/${startIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
    toast.success('Back on Lap 1 — same questions, fresh accepted list.')
  }, [router])

  const fireConfetti = useCallback((big = false) => {
    import('canvas-confetti').then(({ default: confetti }) => {
      if (big) {
        // Cannon burst from both sides for 10/10
        confetti({ particleCount: 120, spread: 70, origin: { x: 0.2, y: 0.6 } })
        setTimeout(() => confetti({ particleCount: 120, spread: 70, origin: { x: 0.8, y: 0.6 } }), 200)
        setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.4 } }), 400)
      } else {
        confetti({ particleCount: 60, spread: 55, origin: { x: 0.5, y: 0.6 } })
      }
    }).catch(() => {})
  }, [])

  const LAP_MESSAGES = [
    'Lap 1 done! 🔥 Warming up!',
    'Lap 2 done! 💪 You\'re building momentum!',
    'Lap 3 done! 🧠 Patterns are sinking in!',
    'Lap 4 done! ⚡ Getting faster!',
    'Lap 5 done! 🎯 Halfway there! You\'re unstoppable!',
    'Lap 6 done! 🚀 More than halfway — keep pushing!',
    'Lap 7 done! 🏃 In the zone now!',
    'Lap 8 done! 💎 Almost elite level!',
    'Lap 9 done! 🔑 One more lap — you\'ve got this!',
    '🏆 10/10 LAPS COMPLETE! You\'ve mastered this set!',
  ]

  // ── Lap completion check — runs after EVERY accepted solution, not just on wrap ──
  // Returns the startIdx of the new lap when complete, or false when not yet done.
  const checkCycleLapComplete = useCallback((): number | false => {
    const rng = cycleRangeRef.current
    if (!rng) return false

    // Use the stored ordered IDs (set at cycle start) not a re-slice of the current
    // filtered list — filters can narrow the visible set and cause a false "all done".
    const cycleIds = cycleOrderedIdsRef.current
    if (cycleIds.length === 0) return false
    const solved = cycleIds.filter(id => cycleAcceptedRef.current.has(id))
    if (solved.length < cycleIds.length) return false   // not done yet

    // All solved — celebrate and reset for next lap
    resetCycleAccepted()
    const newReps = Math.min(cycleRepsRef.current + 1, CYCLE_REP_TARGET)
    setCycleReps(newReps)

    // Rebuild next-lap order from the same question IDs (not from filteredRef which
    // may have changed due to an active filter).
    const newOrderedIds = buildCycleOrder(cycleIds, newReps, wrongCountsRef.current)
    cycleOrderedIdsRef.current = newOrderedIds

    // Navigate to the first question in the new order
    const firstId  = newOrderedIds[0]
    const firstIdx = filteredRef.current.findIndex(q => q.id === firstId)
    const startIdx = firstIdx >= 0 ? firstIdx : rng.start
    cycleIdxRef.current = startIdx

    saveCycleState({
      cycleRange: rng,
      cycleReps: newReps,
      cyclePos: 0,
      cycleIdx: startIdx,
      cycleAccepted: [],
      cycleOrderedIds: newOrderedIds,
    }).catch(() => {})

    const isFinal = newReps >= CYCLE_REP_TARGET
    fireConfetti(isFinal)
    toast(LAP_MESSAGES[newReps - 1] ?? `Lap ${newReps} done! 🔥`, {
      duration: isFinal ? 6000 : 3500,
      icon: isFinal ? '🏆' : undefined,
    })

    // Show shuffle toast after a brief pause so it doesn't overlap the lap toast
    if (!isFinal) {
      setTimeout(() => {
        toast('🎲 Questions shuffled — new order, fresh challenge!', { duration: 4000 })
      }, 2500)
    }

    // Return the first index of the new lap so the caller can navigate there
    // directly — goNext() would otherwise advance past it.
    return startIdx
  }, [fireConfetti, setCycleReps])

  const goNext = useCallback(() => {
    const n   = filteredLenRef.current
    if (n === 0) return
    const idx        = gatedIdxRef.current
    const rng        = cycleRangeRef.current
    const orderedIds = cycleOrderedIdsRef.current
    const qs         = learnQsRef.current

    if (rng && orderedIds.length > 0) {
      const currentId  = filteredRef.current[idx]?.id
      const posInOrder = orderedIds.indexOf(currentId)
      const nextPos    = posInOrder >= orderedIds.length - 1 ? 0 : posInOrder + 1
      const nextId     = orderedIds[nextPos]
      const nextIdx    = filteredRef.current.findIndex(q => q.id === nextId)
      if (nextIdx >= 0) {
        cycleIdxRef.current = nextIdx   // set eagerly so position-persist guard passes
        setCyclePos(nextPos)
        router.push(`/learn/${nextIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
        return
      }
    }

    // Fallback (no cycle order set, or ID not found)
    const start = rng?.start ?? 0
    const end   = rng?.end   ?? Math.max(n - 1, 0)
    const next  = idx >= end ? start : idx + 1
    cycleIdxRef.current = next   // set eagerly so position-persist guard passes
    if (rng) setCyclePos(next === start ? 0 : cyclePosRef.current + 1)
    router.push(`/learn/${next}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, setCyclePos])

  const goNextUnaccepted = useCallback(() => {
    const rng = cycleRangeRef.current
    const orderedIds = cycleOrderedIdsRef.current
    const qs = learnQsRef.current
    if (!rng || orderedIds.length === 0) {
      goNext()
      return
    }
    const idx = gatedIdxRef.current
    const currentId = filteredRef.current[idx]?.id
    const startPos = currentId != null ? orderedIds.indexOf(currentId) : -1
    for (let step = 1; step <= orderedIds.length; step++) {
      const pos = (startPos + step) % orderedIds.length
      const id = orderedIds[pos]
      if (cycleAcceptedRef.current.has(id)) continue
      const nextIdx = filteredRef.current.findIndex(q => q.id === id)
      if (nextIdx < 0) continue
      cycleIdxRef.current = nextIdx
      setCyclePos(pos)
      router.push(`/learn/${nextIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
      return
    }
    toast.success('All questions accepted this lap!')
  }, [router, setCyclePos, goNext])

  const goPrev = useCallback(() => {
    const n   = filteredLenRef.current
    if (n === 0) return
    const idx        = gatedIdxRef.current
    const rng        = cycleRangeRef.current
    const orderedIds = cycleOrderedIdsRef.current
    const qs         = learnQsRef.current

    if (rng && orderedIds.length > 0) {
      const currentId  = filteredRef.current[idx]?.id
      const posInOrder = orderedIds.indexOf(currentId)
      const prevPos    = posInOrder <= 0 ? orderedIds.length - 1 : posInOrder - 1
      const prevId     = orderedIds[prevPos]
      const prevIdx    = filteredRef.current.findIndex(q => q.id === prevId)
      if (prevIdx >= 0) {
        cycleIdxRef.current = prevIdx   // set eagerly so position-persist guard passes
        setCyclePos(prevPos)
        router.push(`/learn/${prevIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
        return
      }
    }

    // Fallback (no ordered list)
    const start = rng?.start ?? 0
    const end   = rng?.end   ?? Math.max(n - 1, 0)
    const prev  = idx <= start ? end : idx - 1
    cycleIdxRef.current = prev
    if (rng) {
      // Mirror goNext fallback: decrement pos (or wrap to last)
      const prevPos = prev === end ? (end - start) : Math.max(0, cyclePosRef.current - 1)
      setCyclePos(prevPos)
    }
    router.push(`/learn/${prev}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, setCyclePos])

  const goTo = (i: number) => {
    cycleIdxRef.current = i   // set eagerly so position-persist guard passes
    const rng = cycleRangeRef.current
    const orderedIds = cycleOrderedIdsRef.current
    if (rng && orderedIds.length > 0) {
      const qid = filteredRef.current[i]?.id
      if (qid != null) {
        const pos = orderedIds.indexOf(qid)
        if (pos >= 0) setCyclePos(pos)
      }
    }
    router.push(`/learn/${i}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    setShowList(false)
  }

  // ── Cycle presets — auto-detect priority+difficulty boundaries ───────────────
  const cyclePresets = useMemo(() => {
    const PRI = ['High', 'Mid', 'Low'] as const
    const DIFF = ['Easy', 'Medium', 'Hard'] as const
    const out: { label: string; start: number; end: number }[] = []
    for (const pri of PRI) {
      for (const diff of DIFF) {
        const indices = filtered
          .map((fq, i) => ({ i, pri: PATTERN_PRIORITY[exclusiveMap[fq.id] ?? ''] ?? null, diff: fq.difficulty }))
          .filter(x => x.pri === pri && x.diff === diff)
          .map(x => x.i)
        if (indices.length > 1)
          out.push({ label: `${pri} ${diff} (${indices.length})`, start: indices[0], end: indices[indices.length - 1] })
      }
    }
    return out
  }, [filtered, exclusiveMap])

  const applyCycleRange = (start: number, end: number) => {
    const s = Math.max(0, Math.min(start, filtered.length - 1))
    const e = Math.max(s, Math.min(end, filtered.length - 1))
    // Clear any stale order so setCycleRange always recomputes it fresh (lap 0, normal order).
    cycleOrderedIdsRef.current = []
    cycleHydratedRef.current = true
    setCycleRange({ start: s, end: e })  // resets cyclePos → 0 and cycleIdx → s internally
    setShowCyclePanel(false)
    // Set eagerly so position-persist guard passes when gatedIdx lands at s.
    cycleIdxRef.current = s
    router.push(`/learn/${s}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
  }
  // ─────────────────────────────────────────────────────────────────────────────

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

  const saveLcListHashes = (next: Record<string, string>) => {
    setLcListHashes(next)
    try { localStorage.setItem('lm_lc_lists', JSON.stringify(next)) } catch {}
  }

  const handleCreateLcList = async () => {
    if (lcListLoading) return
    setLcListLoading(true)
    try {
      const listName = filterPattern ?? (filterDiff !== 'All' ? `Set 1 · ${filterDiff}` : 'LeetMastery Set 1')
      const existingHash = lcListHashes[lcListKey] ?? null
      const res = await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          listName,
          existingHash,
          questions: filtered.map(q => ({ id: q.id, slug: q.slug })),
        }),
      })
      const data = await res.json()
      if (data.favoriteIdHash) {
        saveLcListHashes({ ...lcListHashes, [lcListKey]: data.favoriteIdHash })
        window.open(`https://leetcode.com/list/?selectedList=${data.favoriteIdHash}`, '_blank', 'noopener')
        toast.success(`"${listName}" list ready — ${data.added}/${data.total} questions added`)
      } else {
        toast.error(data.error === 'no LC session' ? 'No LC session — connect in Settings' : 'Failed to create list on LeetCode')
      }
    } catch {
      toast.error('Failed to create LC list')
    }
    setLcListLoading(false)
  }

  const handleDeleteLcList = async () => {
    if (lcListLoading) return
    const hash = lcListHashes[lcListKey]
    if (!hash) return
    setLcListLoading(true)
    try {
      await fetch('/api/lc-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', favoriteIdHash: hash }),
      })
      const next = { ...lcListHashes }
      delete next[lcListKey]
      saveLcListHashes(next)
      toast.success('LC list deleted')
    } catch {
      toast.error('Failed to delete LC list')
    }
    setLcListLoading(false)
  }

  const save = async (patch: any = {}) => {
    if (!q) return
    const updated = { solved, starred, ...patch, question_id: q.id }
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

  const solvedCount  = filtered.filter(fq => progress[String(fq.id)]?.solved).length
  // When a cycle is active, only count solved questions within the cycle range
  const displaySolvedCount = cycleRange
    ? filtered.slice(cycleRange.start, cycleRange.end + 1).filter(fq => progress[String(fq.id)]?.solved).length
    : solvedCount
  const cycleRangeSize = cycleRange ? cycleRange.end - cycleRange.start + 1 : 0
  const inActiveCycleRange = !!(cycleRange && gatedIdx >= cycleRange.start && gatedIdx <= cycleRange.end)
  const currentAcceptedThisLap = inActiveCycleRange && q != null && cycleAcceptedRef.current.has(q.id)

  // Pattern context for current question — uses exclusive map (no repetition)
  const currentPatternName = q ? (exclusiveMap[q.id] ?? null) : null
  const currentPattern = currentPatternName ? QUICK_PATTERNS.find(p => p.name === currentPatternName) ?? null : null
  const patternQs = currentPatternName
    ? questions.filter(qq => exclusiveMap[qq.id] === currentPatternName)
    : []
  const patternSolved = patternQs.filter(qq => progress[String(qq.id)]?.solved).length
  const patternPct = patternQs.length ? Math.round((patternSolved / patternQs.length) * 100) : 0

  const listPatternCounts = useMemo(() => {
    const visibleQs = cycleRange
      ? filtered.filter((_, i) => i >= cycleRange.start && i <= cycleRange.end)
      : filtered
    const counts = new Map<string, number>()
    for (const q of visibleQs) {
      const pat = exclusiveMap[q.id] ?? getPatternForQuestion(q.tags) ?? null
      if (pat) counts.set(pat, (counts.get(pat) ?? 0) + 1)
    }
    return counts
  }, [filtered, cycleRange, exclusiveMap])

  const questionListItems = (
    <>
      {/* Cycle banner — shown at top of list when a cycle is active */}
      {cycleRange && (
        <div className="sticky top-0 z-10 flex flex-col gap-1.5 px-3 py-2 bg-indigo-50 border-b border-indigo-100 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-indigo-600 text-wrap block">
              Lap list · {cycleAcceptedCount}/{cycleRangeSize} accepted · {cycleRangeSize - cycleAcceptedCount} todo
            </span>
            <span className="text-[10px] text-indigo-500/90 mt-0.5 block">
              <CheckCircle size={10} className="inline text-green-600 mr-0.5 -mt-px" /> accepted
              <Circle size={10} className="inline text-amber-500 mx-1 -mt-px" /> skip &amp; return later
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {cycleReps > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(
                    'Reset to Lap 1? Same question set, but lap counter and accepted list start over.',
                  )) return
                  resetToLapOne()
                  setShowList(false)
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors"
              >
                <RotateCcw size={10} /> Reset Lap 1
              </button>
            )}
            {needsCycleResume && (
              <button
                type="button"
                onClick={() => { resumeCycle(); setShowList(false) }}
                className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded-lg transition-colors"
              >
                <Play size={10} /> Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => { setCycleRange(null); setShowList(false) }}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
            >
              <X size={11} /> Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.map((fq, i) => {
        const fp = progress[String(fq.id)] || {}
        const inRange = cycleRange ? i >= cycleRange.start && i <= cycleRange.end : true
        const curPat = exclusiveMap[fq.id] ?? getPatternForQuestion(fq.tags) ?? null
        const curPri = curPat ? (PATTERN_PRIORITY[curPat] ?? null) : null
        const prev = i > 0 ? filtered[i - 1] : null
        const prevPat = prev ? (exclusiveMap[prev.id] ?? getPatternForQuestion(prev.tags) ?? null) : null
        const prevPri = prevPat ? (PATTERN_PRIORITY[prevPat] ?? null) : null
        const showRound = curPri && isNewRound(curPri, fq.difficulty, prevPri, prev?.difficulty)
        const showPattern = curPat && curPat !== prevPat
        const acceptedLap = cycleRange && inRange && cycleAcceptedRef.current.has(fq.id)
        const todoLap = cycleRange && inRange && !acceptedLap
        return (
          <div key={fq.id}>
            {showRound && <StudyRoundHeader priority={curPri!} difficulty={fq.difficulty} />}
            {showPattern && (
              <div className="px-3 py-1 flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">{curPat}</span>
                <span className="text-[10px] font-semibold text-gray-400">· {listPatternCounts.get(curPat!) ?? 0}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!inRange && cycleRange) {
                  // Don't navigate — show toast with escape options
                  toast(t => (
                    <span className="flex items-center gap-2 text-xs">
                      <span>🔄 Outside cycle</span>
                      <button
                        onClick={() => { setCycleRange(null); goTo(i); toast.dismiss(t.id) }}
                        className="px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold"
                      >
                        Cancel cycle &amp; go
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Stay
                      </button>
                    </span>
                  ), { duration: 5000 })
                  return
                }
                goTo(i)
              }}
              className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm border-b border-gray-50 transition-colors ${
                !inRange && cycleRange ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-50'
              } ${i === gatedIdx ? 'bg-indigo-100 ring-1 ring-inset ring-indigo-200' : ''} ${
                acceptedLap ? 'bg-green-50/60' : todoLap ? '' : ''
              }`}
            >
              {cycleRange && inRange ? (
                acceptedLap
                  ? <CheckCircle size={14} className="text-green-600 shrink-0" aria-label="Accepted this lap" />
                  : <Circle size={14} className="text-amber-500 shrink-0" aria-label="Not accepted this lap" />
              ) : null}
              <span className="shrink-0 tabular-nums text-xs font-mono text-gray-500">#{fq.id}</span>
              <span className={`min-w-0 flex-1 truncate ${acceptedLap ? 'text-green-800' : 'text-gray-700'}`}>{fq.title}</span>
              {!inRange && cycleRange
                ? <span className="shrink-0 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">outside</span>
                : null
              }
              <span className={`text-xs font-semibold shrink-0 ${fq.difficulty === 'Easy' ? 'text-green-600' : fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                {fq.difficulty[0]}
              </span>
              {fp.solved && <CheckCircle size={11} className="text-green-500 shrink-0" />}
            </button>
          </div>
        )
      })}
      {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No questions match.</p>}
    </>
  )

  return (
    <>
    <LearnSetTabs activeSet={1} />
    <div className="flex flex-col">

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
      <div className="relative z-30 isolate flex flex-wrap items-center gap-2 overflow-visible border-b border-gray-100 bg-white px-3 py-2 shrink-0">

        {/* Back to home */}
        <button onClick={() => router.push('/questions')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title="Back to questions">
          <ChevronLeft size={15} />
        </button>

        {/* Back to Flashcards — shown when arriving from flashcard page */}
        {fromFlashcards && (
          <button
            onClick={() => router.push('/flashcards')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            <ChevronLeft size={12} /> Flashcards
          </button>
        )}

        <span className="text-xs text-gray-300 font-medium hidden sm:inline">Learn</span>
        <span className="w-px h-4 bg-gray-200 hidden sm:inline-block" />

        <div className="flex items-center gap-1.5">
        {/* Prev / counter / Next */}
        <button onClick={goPrev} disabled={gatedIdx === 0}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronLeft size={15} />
        </button>

        <div ref={listWrapRef} className="relative z-40">
          <button
            type="button"
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors"
          >
            <List size={12} />
            <span className="font-mono">
              {cycleRange
                ? `${cycleAcceptedCount}/${cycleRangeSize}`
                : `${gatedIdx + 1}/${filtered.length}`}
            </span>
            {cycleRange ? (
              <span className="text-indigo-600 text-[10px] sm:text-xs">accepted</span>
            ) : (
              <>
                <span className="hidden sm:inline text-gray-400">·</span>
                <span className="hidden sm:inline text-green-600">{displaySolvedCount} solved</span>
              </>
            )}
          </button>

          {/* Question list: mobile = fixed, centered on viewport; sm+ = under button */}
          {showList && (
            <>
              <div
                className={listDropdownMobileBackdrop}
                aria-hidden
                onClick={() => setShowList(false)}
              />
              <div className={listDropdownMobilePanelClasses('left', 'learn')}>{questionListItems}</div>
            </>
          )}
        </div>

        {cycleRange && (
          <button
            type="button"
            onClick={goNextUnaccepted}
            title="Next question not accepted this lap"
            className="flex min-h-11 items-center px-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold hover:bg-amber-100 transition-colors"
          >
            Todo
          </button>
        )}

        <button onClick={() => goNext()}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
          <ChevronRight size={15} />
        </button>
        </div>

        {/* Progress bar — desktop inline */}
        <div className="hidden sm:block flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: cycleRange
              ? `${cycleRangeSize > 0 ? (cycleAcceptedCount / cycleRangeSize) * 100 : 0}%`
              : filtered.length ? `${((gatedIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>

        {/* Filters toggle */}
        <button type="button" data-learn-filter onClick={() => setShowFilters(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
          Filter {filterDiff !== 'All' || filterSource !== 'All' || filterPattern ? '•' : ''}
        </button>

        {/* LC List button */}
        {lcListLoading ? (
          <span className="px-2.5 py-1.5 text-xs text-gray-400 animate-pulse">LC List…</span>
        ) : lcListHashes[lcListKey] ? (
          <div className="flex items-center gap-0.5">
            <a
              href={`https://leetcode.com/list/?selectedList=${lcListHashes[lcListKey]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-l-lg border border-orange-200 bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition-colors"
            >
              LC List ↗
            </a>
            <button
              type="button"
              onClick={handleDeleteLcList}
              title="Delete this LC list"
              className="px-2 py-1.5 rounded-r-lg border border-l-0 border-orange-200 bg-orange-50 text-orange-300 hover:text-red-500 text-xs transition-colors"
            >
              🗑
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCreateLcList}
            title={`Create a LeetCode list from ${filtered.length} question${filtered.length === 1 ? '' : 's'}`}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500 text-xs font-semibold transition-colors"
          >
            LC List +
          </button>
        )}

        {/* Cycle button (stats shown in banner below when active) */}
        <div className="relative">
          {!cycleRange && (
            <button type="button" onClick={() => setShowCyclePanel(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showCyclePanel ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
              <RefreshCw size={11} /> Cycle
            </button>
          )}

          {showCyclePanel && !cycleRange && (
            <>
              <div
                className="sm:hidden fixed inset-0 z-40 bg-black/40"
                onClick={() => setShowCyclePanel(false)}
              />
            <div className="
              fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
              w-[min(92vw,18rem)]
              sm:absolute sm:left-auto sm:top-full sm:right-0 sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-72
              bg-white border border-gray-200 rounded-xl shadow-xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-2">🔄 Set Cycle Range</p>
              <p className="text-[11px] text-gray-400 mb-3">Cycle within a range — → wraps back to start automatically.</p>

              {cyclePresets.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Quick presets</p>
                  <div className="flex flex-wrap gap-1">
                    {cyclePresets.map(p => (
                      <button key={p.label} type="button"
                        onClick={() => applyCycleRange(p.start, p.end)}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Custom range</p>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={filtered.length}
                  value={cycleFromInput}
                  onChange={e => setCycleFromInput(e.target.value)}
                  placeholder="From"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:border-indigo-400 outline-none" />
                <span className="text-xs text-gray-400">–</span>
                <input type="number" min={1} max={filtered.length}
                  value={cycleToInput}
                  onChange={e => setCycleToInput(e.target.value)}
                  placeholder={String(filtered.length)}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:border-indigo-400 outline-none" />
                <button type="button"
                  onClick={() => {
                    const s = (parseInt(cycleFromInput, 10) || 1) - 1
                    const e = (parseInt(cycleToInput, 10) || filtered.length) - 1
                    applyCycleRange(s, e)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors">
                  Set
                </button>
              </div>
              <button type="button" onClick={() => setShowCyclePanel(false)}
                className="mt-2 w-full text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                Cancel
              </button>
            </div>
            </>
          )}
        </div>

        {q && (
          <>
            <button onClick={() => save({ starred: !starred })}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition-colors ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 hover:border-yellow-300'}`}>
              <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
            </button>

            <button onClick={() => save({ solved: !solved })}
              className={`flex min-h-11 items-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold border transition-colors ${solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'}`}>
              <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
              <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
              <span className="sm:hidden">{solved ? '✓' : '+'}</span>
            </button>

            <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer"
              className="flex min-h-11 min-w-11 items-center justify-center text-gray-300 hover:text-orange-400 transition-colors" title="Open on LeetCode">
              <ExternalLink size={14} />
            </a>
          </>
        )}

        {/* Progress bar — mobile full width */}
        <div className="w-full sm:hidden bg-gray-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: cycleRange
              ? `${cycleRangeSize > 0 ? (cycleAcceptedCount / cycleRangeSize) * 100 : 0}%`
              : filtered.length ? `${((gatedIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>
      </div>

      {cycleRange && (
        <CycleProgressBanner
          acceptedCount={cycleAcceptedCount}
          rangeSize={cycleRangeSize}
          cycleReps={cycleReps}
          repTarget={CYCLE_REP_TARGET}
          onCancel={() => setCycleRange(null)}
          needsResume={needsCycleResume}
          onResume={resumeCycle}
          resumeQuestionNum={cycleResumeIdx != null ? cycleResumeIdx + 1 : undefined}
          onNextTodo={goNextUnaccepted}
          onOpenList={() => setShowList(true)}
          showResetToLapOne={!!cycleRange}
          onResetToLapOne={() => {
            if (!window.confirm(
              'Reset to Lap 1? Same question set, but lap counter and accepted list start over. Use this if the lap advanced too early.',
            )) return
            resetToLapOne()
          }}
        />
      )}

      {q && (
        <div className="hidden md:block px-3 py-2.5 border-b border-gray-100 bg-white shrink-0">
          <div className="flex flex-col items-center gap-1">
            {inActiveCycleRange && (
              currentAcceptedThisLap ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <CheckCircle size={10} /> Accepted this lap
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Circle size={10} /> Todo this lap — Accept when solved
                </span>
              )
            )}
            <h1 className="text-sm sm:text-base font-bold text-gray-800 leading-snug text-center">{q.title}</h1>
          </div>
        </div>
      )}

      {/* Pattern context strip */}
      {currentPattern && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
          <span className="text-xs font-semibold text-[var(--text)] truncate">{currentPattern.name}</span>
          <PriorityBadge pattern={currentPattern.name} />
          {/* Difficulty sweep round badge */}
          {q?.difficulty === 'Easy'   && filterDiff === 'All' && <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full shrink-0">🟢 Round 1 · Easy</span>}
          {q?.difficulty === 'Medium' && filterDiff === 'All' && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full shrink-0">🟡 Round 2 · Medium</span>}
          {q?.difficulty === 'Hard'   && filterDiff === 'All' && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0">🔴 Round 3 · Hard</span>}
          {patternPct >= 80 && <span className="hidden sm:inline text-[10px] font-bold text-green-600 shrink-0">Crushing it!</span>}
          {patternPct >= 50 && patternPct < 80 && <span className="hidden sm:inline text-[10px] font-bold text-indigo-500 shrink-0">Solid progress</span>}
          {patternPct > 0 && patternPct < 50 && <span className="hidden sm:inline text-[10px] font-semibold text-amber-500 shrink-0">Building momentum</span>}
          {patternPct === 0 && <span className="hidden sm:inline text-[10px] font-semibold text-[var(--text-subtle)] shrink-0">Fresh territory</span>}
          <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto shrink-0">
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
            {QUICK_PATTERNS
              .slice()
              .sort((a, b) => DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) - DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number]))
              .map(p => {
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
                  <PriorityBadge pattern={p.name} active={isActive} />
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
            <button onClick={() => setActiveTab('best')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'best' ? 'border-amber-500 text-amber-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
              <Sparkles size={12} /> Best answers
            </button>
          )}
          <button onClick={() => setStudyMode(prev => prev === 'hide' ? 'show' : 'hide')}
            className={`md:ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${studyMode === 'hide' ? 'text-orange-500 hover:text-orange-600' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            {studyMode === 'hide' ? 'Challenge' : 'Review'}
          </button>
        </div>
        <div className="hidden"><MobileSplitPanelTabs panel={mobilePanel} onPanelChange={setMobilePanel} /></div>
        <div className="relative z-0 flex flex-col">

          {/* ── Content panel (all non-editor tabs) ── */}
          <div className="flex relative z-10 flex-col w-full bg-[var(--bg-card)] overflow-visible text-[var(--text)] border-b border-[var(--border)]">

            {/* Panel content */}
            <div className="overflow-visible">

              {/* ── Description tab ── */}
              {leftPanelTab === 'description' && (
                <div className="p-4 space-y-4">

                  {/* Title + meta */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                      {(() => { const p = currentPatternName ?? getPatternForQuestion(q.tags ?? []); return p ? <PriorityBadge pattern={p} /> : null })()}
                      {inActiveCycleRange && (
                        currentAcceptedThisLap ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle size={10} /> Accepted this lap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Circle size={10} /> Todo this lap
                          </span>
                        )
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

                  {/* SR next review info */}
                  {solved && nextReview && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-green-600">
                        ✅ Review #{reviewCount + 1} in {nextIntervalDays(reviewCount)} day{nextIntervalDays(reviewCount) !== 1 ? 's' : ''} · {formatLocalDate(nextReview)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {leftPanelTab === 'best' && (
                <div className="p-4 h-full">
                  <BestAnswersPanel
                    questionId={q.id}
                    slug={lcTitleSlug ?? q.slug}
                    active={leftPanelTab === 'best'}
                    preferredLangs={q.tags?.includes('JavaScript') ? ['javascript', 'python', 'cpp'] : ['python', 'cpp', 'javascript']}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Editor panel ── */}
          <div className="flex flex-col w-full min-h-[50dvh] md:h-[65vh] overflow-hidden border-t border-[var(--border)]">
            <LeetCodeEditor
              appQuestionId={q.id}
              slug={q.slug}
              questionTitle={q.title}
              preferredLangs={q.tags?.includes('JavaScript') ? ['javascript', 'python3', 'cpp'] : undefined}
              onAccepted={() => {
                toast.success('Accepted! Moving to next question.', { duration: 2000 })
                // Fire confetti and advance immediately — don't block the UI on the
                // review-completion network round trip (it was adding a noticeable
                // lag before the celebration / next-question transition).
                // Use ref (not state) to avoid stale closure — same reason goNext uses cycleRangeRef
                if (q && cycleRangeRef.current) {
                  const isNew = recordCycleAccepted(q.id)   // returns true if first time this lap
                  if (isNew) fireConfetti(false)             // small burst for each new solve
                  const lapStartIdx = checkCycleLapComplete() // returns new startIdx or false
                  if (lapStartIdx !== false) {
                    // Lap complete — go directly to the FIRST question of the new order,
                    // not goNext() which would advance past it into position 1.
                    setTimeout(() => {
                      const qs = learnQsRef.current
                      cycleIdxRef.current = lapStartIdx  // set eagerly so position-persist guard passes
                      setCyclePos(0)
                      router.push(`/learn/${lapStartIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
                    }, 700)
                  } else {
                    setTimeout(() => goNext(), 700)
                  }
                } else {
                  goNext()
                }
                // Persist the review completion in the background — UI has already moved on.
                if (due && !reviewDone) { handleCompleteReview().catch(() => {}) }
              }}
            />
          </div>

        </div>
        </>
      )}

      {/* ── My Best — full section, same as Reviews tab, persists across questions ── */}
      <div className="border-t-4 border-amber-400/30 mt-2">
        <BestSolutionsSection lockedLayout="horizontal" />
      </div>

      {/* lc-description styles live in globals.css — no inline override needed */}
    </div>

</>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100dvh-56px)] items-center justify-center text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>}>
      <LearnInner />
    </Suspense>
  )
}

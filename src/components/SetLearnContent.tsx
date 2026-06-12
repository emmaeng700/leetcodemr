'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Star, CheckCircle, Circle, ExternalLink,
  RefreshCw, List, BookOpen, Brain, Loader2, X, Play, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getSetProgress, updateSetQProgress, getSetCycleState, saveSetCycleState,
  srIntervalDays, nextReviewDate, type SetQProgress,
} from '@/lib/setProgress'
import {
  getSet2Questions, getSet3Questions, buildSetExclusiveMap,
  buildPriorityDifficultyPresets, type SetQuestion,
} from '@/lib/questionSets'
import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY, QUICK_PATTERNS } from '@/lib/constants'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import StudyRoundHeader, { isNewRound } from '@/components/StudyRoundHeader'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { QuestionCountHighlight, SetExclusiveCountLabel } from '@/components/QuestionCountHighlight'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import MobileSplitPanelTabs, { type MobileSplitPanel } from '@/components/MobileSplitPanelTabs'
import { stripScripts, resolveLeetCodeSlug, leetCodeUrl, formatLocalDate } from '@/lib/utils'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import LearnSetTabs from '@/components/LearnSetTabs'
import CycleProgressBanner from '@/components/CycleProgressBanner'

interface Props { set: 2 | 3; index: number }

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

function todayISO() { return new Date().toISOString().slice(0, 10) }

const CYCLE_REP_TARGET = 10
const LAP_MESSAGES = [
  'Lap 1 done! 🔥 Warming up!',
  "Lap 2 done! 💪 You're building momentum!",
  'Lap 3 done! 🧠 Patterns are sinking in!',
  'Lap 4 done! ⚡ Getting faster!',
  "Lap 5 done! 🎯 Halfway there! You're unstoppable!",
  'Lap 6 done! 🚀 More than halfway — keep pushing!',
  'Lap 7 done! 🏃 In the zone now!',
  'Lap 8 done! 💎 Almost elite level!',
  "Lap 9 done! 🔑 One more lap — you've got this!",
  '🏆 10/10 LAPS COMPLETE! You\'ve mastered this set!',
]

function buildCycleOrder(baseIds: number[], reps: number): number[] {
  if (reps === 0) return [...baseIds]
  const arr = [...baseIds]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default function SetLearnContent({ set, index }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const learnBase = set === 2 ? '/learn2' : '/learn3'
  const idxKey = set === 2 ? 'lm_learn2_idx' : 'lm_learn3_idx'

  // URL filter params
  const initDiff        = searchParams.get('diff')   || 'All'
  const initSearch      = searchParams.get('search') || ''
  const initStarred     = searchParams.get('starred') === '1'
  const initTagsRaw     = searchParams.get('tags')   || ''
  const initTags        = initTagsRaw ? initTagsRaw.split(',') : []
  const initSolvedParam = searchParams.get('solved')
  const initSolved: null | boolean =
    initSolvedParam === 'true' ? true : initSolvedParam === 'false' ? false : null

  const [allQuestions, setAllQuestions] = useState<SetQuestion[]>([])
  const [progress,     setProgress]     = useState<Record<string, SetQProgress>>({})
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<'description' | 'best' | 'editor'>('description')
  const [mobilePanel,  setMobilePanel]  = useState<MobileSplitPanel>('content')
  const [studyMode,    setStudyMode]    = useState<'show' | 'hide' | null>(null)
  const leftPanelTab = activeTab === 'editor' ? 'description' : activeTab
  const [showList,     setShowList]     = useState(false)
  const [showFilters,  setShowFilters]  = useState(false)
  const [filterDiff,     setFilterDiff]     = useState(initDiff)
  const [filterPattern, setFilterPattern] = useState<string | null>(
    initTags.length > 0
      ? (QUICK_PATTERNS.find(p => p.tags.some(t => initTags.includes(t)))?.name ?? null)
      : null,
  )
  const listWrapRef = useRef<HTMLDivElement>(null)

  // Live LC description
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

  // Cycle state
  const [cycleRange,         setCycleRangeState]      = useState<{ start: number; end: number } | null>(null)
  const [cycleReps,          setCycleRepsState]        = useState(0)
  const [cyclePos,           setCyclePosState]         = useState(0)
  const [cycleAcceptedCount, setCycleAcceptedCount]    = useState(0)
  const [showCyclePanel,     setShowCyclePanel]        = useState(false)
  const [cycleFromInput,     setCycleFromInput]        = useState('1')
  const [cycleToInput,       setCycleToInput]          = useState('')
  const cycleAcceptedRef    = useRef<Set<number>>(new Set())
  const cycleRangeForSave   = useRef<{ start: number; end: number } | null>(null)
  const cycleRepsRef        = useRef(0)
  const cyclePosRef         = useRef(0)
  const cycleIdxRef         = useRef(0)
  const cycleOrderedIdsRef  = useRef<number[]>([])
  const filteredRef         = useRef<SetQuestion[]>([])
  const gatedIdxRef         = useRef(0)
  const learnQsRef          = useRef('')
  const filteredLenRef      = useRef(0)

  // Load questions + restore cycle
  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds, main) : getSet3Questions(mainIds, main)
      const prog = getSetProgress(set)
      setAllQuestions(qs)
      setProgress(prog)
      setLoading(false)
    }
    load()
  }, [set])

  const exclusiveMap = useMemo(() => buildSetExclusiveMap(allQuestions), [allQuestions])

  // Filtered list
  const filtered = useMemo(() => {
    return allQuestions.filter(q => {
      if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
      if (filterPattern && exclusiveMap[q.id] !== filterPattern) return false
      if (initSearch) {
        const s = initSearch.toLowerCase()
        if (!q.title.toLowerCase().includes(s) && !String(q.id).includes(s.replace(/^#/, ''))) return false
      }
      const p = progress[String(q.id)] || {}
      if (initStarred        && !p.starred) return false
      if (initSolved === true  && !p.solved) return false
      if (initSolved === false &&  p.solved) return false
      return true
    })
  }, [allQuestions, filterDiff, filterPattern, exclusiveMap, initSearch, initStarred, initSolved, progress])

  const safeIdx = filtered.length ? Math.min(Math.max(index, 0), filtered.length - 1) : 0
  const q = filtered[safeIdx] ?? null

  const patternProgressMap = useMemo(() => {
    const map: Record<string, { solved: number; total: number }> = {}
    for (const p of QUICK_PATTERNS) {
      const qs = allQuestions.filter(aq => exclusiveMap[aq.id] === p.name)
      map[p.name] = {
        solved: qs.filter(aq => progress[String(aq.id)]?.solved).length,
        total: qs.length,
      }
    }
    return map
  }, [allQuestions, exclusiveMap, progress])

  const currentPatternName = q ? (exclusiveMap[q.id] ?? null) : null
  const currentPattern = currentPatternName
    ? QUICK_PATTERNS.find(p => p.name === currentPatternName) ?? null
    : null
  const patternQs = currentPatternName
    ? allQuestions.filter(qq => exclusiveMap[qq.id] === currentPatternName)
    : []
  const patternSolved = patternQs.filter(qq => progress[String(qq.id)]?.solved).length
  const patternPct = patternQs.length ? Math.round((patternSolved / patternQs.length) * 100) : 0

  // Build URL query string preserving current filters
  const buildQuery = useCallback((overrides?: {
    diff?: string
    pattern?: string | null
    solved?: null | boolean
  }) => {
    const sp = new URLSearchParams(searchParams.toString())
    const diff    = overrides?.diff    !== undefined ? overrides.diff    : filterDiff
    const pattern = overrides?.pattern !== undefined ? overrides.pattern : filterPattern
    const solved  = overrides?.solved  !== undefined ? overrides.solved  : initSolved
    if (diff !== 'All') sp.set('diff', diff); else sp.delete('diff')
    if (pattern) {
      const tags = QUICK_PATTERNS.find(p => p.name === pattern)?.tags ?? []
      if (tags.length) sp.set('tags', tags.join(','))
    } else {
      sp.delete('tags')
    }
    if (solved === true)  sp.set('solved', 'true')
    else if (solved === false) sp.set('solved', 'false')
    else sp.delete('solved')
    return sp.toString()
  }, [searchParams, filterDiff, filterPattern, initSolved])

  const learnQs = useMemo(() => buildQuery(), [buildQuery])

  // Keep refs fresh
  useEffect(() => { filteredRef.current    = filtered },        [filtered])
  useEffect(() => { filteredLenRef.current = filtered.length }, [filtered.length])
  useEffect(() => { gatedIdxRef.current    = safeIdx },         [safeIdx])
  useEffect(() => { learnQsRef.current     = learnQs },         [learnQs])
  useEffect(() => { cycleRepsRef.current   = cycleReps },       [cycleReps])
  useEffect(() => { cyclePosRef.current    = cyclePos },        [cyclePos])

  // Restore cycle from localStorage once questions load
  const cycleRestoredRef = useRef(false)
  useEffect(() => {
    if (allQuestions.length === 0) return
    if (cycleRestoredRef.current) return
    cycleRestoredRef.current = true
    const state = getSetCycleState(set)
    if (!state?.cycleRange) return
    const rng      = state.cycleRange
    const reps     = state.cycleReps ?? 0
    const pos      = state.cyclePos  ?? 0
    const accepted = Array.isArray(state.cycleAccepted) ? state.cycleAccepted : []
    const storedOrderedIds = (state as any).cycleOrderedIds
    const expectedLen = rng.end - rng.start + 1
    const orderedIds = Array.isArray(storedOrderedIds) && storedOrderedIds.length === expectedLen
      ? storedOrderedIds
      : buildCycleOrder(filtered.slice(rng.start, rng.end + 1).map(q => q.id), reps)
    cycleAcceptedRef.current = new Set(accepted)
    setCycleAcceptedCount(accepted.length)
    setCycleRangeState(rng)
    setCycleRepsState(reps)
    setCyclePosState(pos)
    cycleRangeForSave.current = rng
    cycleRepsRef.current = reps
    cyclePosRef.current = pos
    cycleOrderedIdsRef.current = orderedIds
    cycleIdxRef.current = typeof state.cycleIdx === 'number' ? state.cycleIdx : rng.start
  }, [allQuestions, filtered, set])

  // Save last visited index
  useEffect(() => {
    if (!q) return
    try { localStorage.setItem(idxKey, String(safeIdx)) } catch {}
  }, [q, safeIdx, idxKey])

  // Redirect if index is out of filtered range
  useEffect(() => {
    if (filtered.length === 0) return
    if (index !== safeIdx) {
      router.replace(`${learnBase}/${safeIdx}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    }
  }, [filtered.length, index, safeIdx, learnQs, router, learnBase])

  // Sync filter state from URL on back/forward navigation
  useEffect(() => {
    setFilterDiff(searchParams.get('diff') || 'All')
    const tr = searchParams.get('tags') || ''
    const tags = tr ? tr.split(',') : []
    setFilterPattern(
      tags.length > 0
        ? (QUICK_PATTERNS.find(p => p.tags.some(t => tags.includes(t)))?.name ?? null)
        : null,
    )
  }, [searchParams])

  // Reset LC content on question change
  useEffect(() => {
    setLcContent(null)
    setIsPremium(false)
  }, [q?.id])

  // Fetch live LeetCode description
  useEffect(() => {
    if (!q?.slug) return
    const titleSlug = resolveLeetCodeSlug(q.id, q.slug)
    if (lcCacheRef.current[titleSlug]) {
      setLcContent(lcCacheRef.current[titleSlug])
      setIsPremium(false)
      setLcLoading(false)
      return
    }
    let cancelled = false
    setLcLoading(true)
    const ctrl  = new AbortController()
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
        variables: { titleSlug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[titleSlug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.id, q?.slug])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lm_study_mode')
      setStudyMode(saved === 'show' || saved === 'hide' ? saved : null)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (studyMode !== null) localStorage.setItem('lm_study_mode', studyMode)
  }, [studyMode])

  useEffect(() => {
    if (studyMode === 'hide' && activeTab === 'best') setActiveTab('description')
  }, [studyMode, activeTab])

  useEffect(() => {
    if (activeTab === 'editor') setMobilePanel('editor')
  }, [activeTab])

  useEffect(() => {
    if (!q) return
    setOpenQuestionContext({ id: q.id, slug: q.slug, title: q.title })
    return () => setOpenQuestionContext(null)
  }, [q?.id, q?.slug, q?.title])

  // Close list dropdown on outside click
  useEffect(() => {
    if (!showList) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (listWrapRef.current?.contains(e.target as Node)) return
      setShowList(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showList])

  // Close filter panel on outside click
  useEffect(() => {
    if (!showFilters) return
    function onDown(e: MouseEvent | TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-set-filter]')) return
      setShowFilters(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showFilters])

  // ── Cycle helpers ────────────────────────────────────────────────────────────
  const fireConfetti = useCallback((big = false) => {
    import('canvas-confetti').then(({ default: confetti }) => {
      if (big) {
        confetti({ particleCount: 120, spread: 70, origin: { x: 0.2, y: 0.6 } })
        setTimeout(() => confetti({ particleCount: 120, spread: 70, origin: { x: 0.8, y: 0.6 } }), 200)
        setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.4 } }), 400)
      } else {
        confetti({ particleCount: 60, spread: 55, origin: { x: 0.5, y: 0.6 } })
      }
    }).catch(() => {})
  }, [])

  const checkCycleLapComplete = useCallback((): number | false => {
    const rng = cycleRangeForSave.current
    if (!rng) return false
    const cycleQs  = filteredRef.current.slice(rng.start, rng.end + 1)
    const solved   = cycleQs.filter(q => cycleAcceptedRef.current.has(q.id))
    if (solved.length < cycleQs.length) return false
    cycleAcceptedRef.current = new Set()
    setCycleAcceptedCount(0)
    const newReps = Math.min(cycleRepsRef.current + 1, CYCLE_REP_TARGET)
    setCycleRepsState(newReps)
    cycleRepsRef.current = newReps
    const baseIds      = filteredRef.current.slice(rng.start, rng.end + 1).map(q => q.id)
    const newOrderedIds = buildCycleOrder(baseIds, newReps)
    cycleOrderedIdsRef.current = newOrderedIds
    const firstId  = newOrderedIds[0]
    const firstIdx = filteredRef.current.findIndex(q => q.id === firstId)
    const startIdx = firstIdx >= 0 ? firstIdx : rng.start
    cycleIdxRef.current = startIdx
    saveSetCycleState(set, {
      cycleRange: rng, cycleReps: newReps, cyclePos: 0, cycleIdx: startIdx, cycleAccepted: [],
    } as any)
    const isFinal = newReps >= CYCLE_REP_TARGET
    fireConfetti(isFinal)
    toast(LAP_MESSAGES[newReps - 1] ?? `Lap ${newReps} done! 🔥`, {
      duration: isFinal ? 6000 : 3500,
      icon: isFinal ? '🏆' : undefined,
    })
    if (!isFinal) {
      setTimeout(() => toast('🎲 Questions shuffled — new order, fresh challenge!', { duration: 4000 }), 2500)
    }
    return startIdx
  }, [set, fireConfetti])

  const recordCycleAccepted = useCallback((questionId: number): boolean => {
    if (cycleAcceptedRef.current.has(questionId)) return false
    cycleAcceptedRef.current.add(questionId)
    const arr = [...cycleAcceptedRef.current]
    setCycleAcceptedCount(arr.length)
    const rng = cycleRangeForSave.current
    if (rng) {
      saveSetCycleState(set, {
        cycleRange: rng, cycleReps: cycleRepsRef.current,
        cyclePos: cyclePosRef.current, cycleIdx: cycleIdxRef.current, cycleAccepted: arr,
      } as any)
    }
    return true
  }, [set])

  const startCycle = (start: number, end: number) => {
    const n = filteredLenRef.current
    const s = Math.max(0, Math.min(start, n - 1))
    const e = Math.max(s, Math.min(end, n - 1))
    const baseIds    = filteredRef.current.slice(s, e + 1).map(q => q.id)
    const orderedIds = buildCycleOrder(baseIds, 0)
    cycleOrderedIdsRef.current = orderedIds
    cycleAcceptedRef.current   = new Set()
    setCycleAcceptedCount(0)
    setCycleRangeState({ start: s, end: e })
    setCycleRepsState(0)
    setCyclePosState(0)
    cycleRangeForSave.current = { start: s, end: e }
    cycleRepsRef.current = 0
    cyclePosRef.current  = 0
    setShowCyclePanel(false)
    saveSetCycleState(set, { cycleRange: { start: s, end: e }, cycleReps: 0, cyclePos: 0, cycleIdx: s, cycleAccepted: [] } as any)
    cycleIdxRef.current = s
    const qs = learnQsRef.current
    router.push(`${learnBase}/${s}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const cancelCycle = () => {
    cycleRangeForSave.current = null
    cycleAcceptedRef.current  = new Set()
    setCycleAcceptedCount(0)
    setCycleRangeState(null)
    setCycleRepsState(0)
    setCyclePosState(0)
    cycleOrderedIdsRef.current = []
    saveSetCycleState(set, null)
  }

  // Navigation
  const goNext = useCallback(() => {
    const n   = filteredLenRef.current
    if (n === 0) return
    const idx        = gatedIdxRef.current
    const rng        = cycleRangeForSave.current
    const orderedIds = cycleOrderedIdsRef.current
    const qs         = learnQsRef.current

    if (rng && orderedIds.length > 0) {
      const currentId  = filteredRef.current[idx]?.id
      const posInOrder = orderedIds.indexOf(currentId)
      const nextPos    = posInOrder >= orderedIds.length - 1 ? 0 : posInOrder + 1
      const nextId     = orderedIds[nextPos]
      const nextIdx    = filteredRef.current.findIndex(q => q.id === nextId)
      if (nextIdx >= 0) {
        cycleIdxRef.current = nextIdx
        setCyclePosState(nextPos)
        cyclePosRef.current = nextPos
        router.push(`${learnBase}/${nextIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
        return
      }
    }

    // Fallback: cycle's next question is filtered out — just advance by 1 in filtered list
    const next = idx >= n - 1 ? 0 : idx + 1
    cycleIdxRef.current = next
    if (rng) {
      const nextPos = cyclePosRef.current + 1
      setCyclePosState(nextPos)
      cyclePosRef.current = nextPos
    }
    router.push(`${learnBase}/${next}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, learnBase])

  const goNextUnaccepted = useCallback(() => {
    const rng = cycleRangeForSave.current
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
      setCyclePosState(pos)
      cyclePosRef.current = pos
      router.push(`${learnBase}/${nextIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
      return
    }
    toast.success('All questions accepted this lap!')
  }, [router, learnBase, goNext])

  const goPrev = useCallback(() => {
    const n   = filteredLenRef.current
    if (n === 0) return
    const idx        = gatedIdxRef.current
    const rng        = cycleRangeForSave.current
    const orderedIds = cycleOrderedIdsRef.current
    const qs         = learnQsRef.current

    if (rng && orderedIds.length > 0) {
      const currentId  = filteredRef.current[idx]?.id
      const posInOrder = orderedIds.indexOf(currentId)
      const prevPos    = posInOrder <= 0 ? orderedIds.length - 1 : posInOrder - 1
      const prevId     = orderedIds[prevPos]
      const prevIdx    = filteredRef.current.findIndex(q => q.id === prevId)
      if (prevIdx >= 0) {
        cycleIdxRef.current = prevIdx
        setCyclePosState(prevPos)
        cyclePosRef.current = prevPos
        router.push(`${learnBase}/${prevIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
        return
      }
    }

    // Fallback: cycle's prev question is filtered out — just go back by 1 in filtered list
    const prev = idx <= 0 ? n - 1 : idx - 1
    cycleIdxRef.current = prev
    router.push(`${learnBase}/${prev}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, learnBase])

  const goTo = (i: number) => {
    cycleIdxRef.current = i
    const rng = cycleRangeForSave.current
    const orderedIds = cycleOrderedIdsRef.current
    if (rng && orderedIds.length > 0) {
      const qid = filteredRef.current[i]?.id
      if (qid != null) {
        const pos = orderedIds.indexOf(qid)
        if (pos >= 0) setCyclePosState(pos)
      }
    }
    router.push(`${learnBase}/${i}${learnQs ? `?${learnQs}` : ''}`, { scroll: false })
    setShowList(false)
  }

  // Cycle presets — priority × difficulty rounds (same as Learn 1)
  const cyclePresets = useMemo(
    () => buildPriorityDifficultyPresets(filtered, exclusiveMap, { minCount: 2, labelSuffix: '' }),
    [filtered, exclusiveMap],
  )

  // SR actions
  const prog: SetQProgress = progress[String(q?.id)] ?? {
    solved: false, starred: false, review_count: 0, next_review: null, last_reviewed: null, notes: '',
  }
  const reviewDue = prog.solved && prog.next_review != null && prog.next_review <= todayISO()

  function toggleSolved() {
    if (!q) return
    const newVal   = !prog.solved
    const newCount = newVal ? (prog.review_count ?? 0) + 1 : prog.review_count
    const updated  = updateSetQProgress(set, q.id, {
      solved: newVal,
      last_reviewed: todayISO(),
      review_count: newCount,
      next_review: newVal ? nextReviewDate(newCount) : prog.next_review,
    })
    setProgress(p => ({ ...p, [String(q.id)]: updated }))
    if (cycleRange && newVal) {
      const isNew = recordCycleAccepted(q.id)
      if (isNew) fireConfetti(false)
      const lapStartIdx = checkCycleLapComplete()
      if (lapStartIdx !== false) {
        setTimeout(() => {
          cycleIdxRef.current = lapStartIdx
          setCyclePosState(0)
          cyclePosRef.current = 0
          const qs = learnQsRef.current
          router.push(`${learnBase}/${lapStartIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
        }, 700)
        return
      }
    }
    toast.success(newVal ? 'Marked solved!' : 'Unmarked')
    if (newVal) setTimeout(() => goNext(), 700)
  }

  function toggleStar() {
    if (!q) return
    const updated = updateSetQProgress(set, q.id, { starred: !prog.starred })
    setProgress(p => ({ ...p, [String(q.id)]: updated }))
  }

  function handlePass() {
    if (!q) return
    const newCount = (prog.review_count ?? 0) + 1
    const updated  = updateSetQProgress(set, q.id, {
      review_count: newCount,
      next_review: nextReviewDate(newCount),
      last_reviewed: todayISO(),
    })
    setProgress(p => ({ ...p, [String(q.id)]: updated }))
    toast.success(`✓ Next review in ${srIntervalDays(newCount)}d`)
    setTimeout(() => goNext(), 700)
  }

  function handleAgain() {
    if (!q) return
    const updated = updateSetQProgress(set, q.id, {
      next_review: nextReviewDate(1),
      last_reviewed: todayISO(),
    })
    setProgress(p => ({ ...p, [String(q.id)]: updated }))
    toast('↩ Review again soon')
    setTimeout(() => goNext(), 700)
  }

  const lcTitleSlug        = q ? resolveLeetCodeSlug(q.id, q.slug) : ''
  const rangeSize          = cycleRange ? cycleRange.end - cycleRange.start + 1 : filtered.length
  const inActiveCycleRange = !!(cycleRange && safeIdx >= cycleRange.start && safeIdx <= cycleRange.end)
  const currentAcceptedThisLap = inActiveCycleRange && q != null && cycleAcceptedRef.current.has(q.id)
  const displaySolvedCount = cycleRange
    ? filtered.slice(cycleRange.start, cycleRange.end + 1).filter(fq => progress[String(fq.id)]?.solved).length
    : filtered.filter(fq => progress[String(fq.id)]?.solved).length

  // ── Question list dropdown ───────────────────────────────────────────────────
  const questionListItems = (
    <div>
      {cycleRange && (
        <div className="sticky top-0 z-10 flex flex-col gap-1.5 px-3 py-2 bg-indigo-50 border-b border-indigo-100 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-indigo-600 text-wrap block">
              Lap list · {cycleAcceptedCount}/{rangeSize} accepted · {rangeSize - cycleAcceptedCount} todo
            </span>
            <span className="text-[10px] text-indigo-500/90 mt-0.5 block">
              <CheckCircle size={10} className="inline text-green-600 mr-0.5 -mt-px" /> accepted
              <Circle size={10} className="inline text-amber-500 mx-1 -mt-px" /> skip &amp; return later
            </span>
          </div>
          <button type="button" onClick={() => { cancelCycle(); setShowList(false) }}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700">
            <X size={11} /> Cancel
          </button>
        </div>
      )}
      {filtered.map((fq, i) => {
        const fp       = progress[String(fq.id)] || {}
        const inRange  = cycleRange ? i >= cycleRange.start && i <= cycleRange.end : true
        const curPat   = exclusiveMap[fq.id] ?? null
        const curPri   = curPat ? (PATTERN_PRIORITY[curPat] ?? null) : null
        const prev     = i > 0 ? filtered[i - 1] : null
        const prevPat  = prev ? (exclusiveMap[prev.id] ?? null) : null
        const prevPri  = prevPat ? (PATTERN_PRIORITY[prevPat] ?? null) : null
        const showRound = curPri && isNewRound(curPri, fq.difficulty, prevPri, prev?.difficulty)
        const acceptedLap = cycleRange && inRange && cycleAcceptedRef.current.has(fq.id)
        const todoLap = cycleRange && inRange && !acceptedLap
        return (
          <div key={fq.id}>
            {showRound && <StudyRoundHeader priority={curPri!} difficulty={fq.difficulty} />}
            <button type="button"
              onClick={() => {
                if (!inRange && cycleRange) {
                  toast(t => (
                    <span className="flex items-center gap-2 text-xs">
                      <span>🔄 Outside cycle</span>
                      <button onClick={() => { cancelCycle(); goTo(i); toast.dismiss(t.id) }}
                        className="px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold">
                        Cancel &amp; go
                      </button>
                      <button onClick={() => toast.dismiss(t.id)} className="text-gray-400 hover:text-gray-600">Stay</button>
                    </span>
                  ), { duration: 5000 })
                  return
                }
                goTo(i)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm border-b border-gray-50 last:border-0 transition-colors ${
                i === safeIdx ? 'bg-indigo-100 ring-1 ring-inset ring-indigo-200' :
                (!inRange && cycleRange) ? 'opacity-30 cursor-not-allowed' :
                'hover:bg-indigo-50/40'
              } ${acceptedLap ? 'bg-green-50/60' : ''}`}>
              {cycleRange && inRange ? (
                acceptedLap
                  ? <CheckCircle size={14} className="text-green-600 shrink-0" aria-label="Accepted this lap" />
                  : <Circle size={14} className="text-amber-500 shrink-0" aria-label="Not accepted this lap" />
              ) : null}
              <span className="shrink-0 tabular-nums text-xs font-mono text-gray-500">#{fq.id}</span>
              <span className={`min-w-0 flex-1 truncate ${acceptedLap ? 'text-green-800' : 'text-gray-700'}`}>{fq.title}</span>
              {!inRange && cycleRange
                ? <span className="shrink-0 text-[10px] text-gray-400">outside</span>
                : null
              }
              {!cycleRange && fp.solved && <CheckCircle size={11} className="text-green-500 shrink-0" />}
              {fp.starred && <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
              <span className={`text-xs font-semibold shrink-0 ${
                fq.difficulty === 'Easy' ? 'text-green-600' :
                fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'
              }`}>{fq.difficulty[0]}</span>
            </button>
          </div>
        )
      })}
      {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No questions match.</p>}
    </div>
  )

  const exclusiveCountMeta = SetExclusiveCountLabel(set, allQuestions.length)

  if (loading) return (
    <div className="flex min-h-[calc(100dvh-56px)] items-center justify-center gap-2 text-[var(--text-subtle)] text-sm">
      <Loader2 size={15} className="animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="flex min-h-0 flex-col md:h-[calc(100dvh-162px)]">
      <LearnSetTabs activeSet={set} />

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
      <div className="relative z-30 flex flex-wrap items-center gap-2 overflow-visible border-b border-gray-100 bg-white px-3 py-2 shrink-0">

        {/* Back */}
        <button onClick={() => router.push(learnBase)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title={`Back to Learn ${set}`}>
          <ChevronLeft size={15} />
        </button>

        <span className="text-xs text-gray-300 font-medium hidden sm:inline">Learn {set}</span>
        <span className="w-px h-4 bg-gray-200 hidden sm:inline-block" />

        <div className="flex items-center gap-1.5">
        {/* Prev */}
        <button onClick={goPrev}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          style={{ opacity: safeIdx === 0 && !cycleRange ? 0.3 : 1 }}>
          <ChevronLeft size={15} />
        </button>

        {/* Counter + list dropdown */}
        <div ref={listWrapRef} className="relative z-40">
          <button type="button" onClick={() => setShowList(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors">
            <List size={12} />
            <span className="font-mono">
              {cycleRange
                ? `${cycleAcceptedCount}/${rangeSize}`
                : `${safeIdx + 1}/${filtered.length}`}
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
          {showList && (
            <>
              <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
              <div className={listDropdownMobilePanelClasses('left', 'learn')}>{questionListItems}</div>
            </>
          )}
        </div>

        {/* Next */}
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
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          style={{ opacity: safeIdx >= filtered.length - 1 && !cycleRange ? 0.3 : 1 }}>
          <ChevronRight size={15} />
        </button>
        </div>

        {/* Progress bar — desktop inline */}
        <div className="hidden sm:block flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: cycleRange
              ? `${rangeSize > 0 ? (cycleAcceptedCount / rangeSize) * 100 : 0}%`
              : filtered.length ? `${((safeIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>

        {/* Filter toggle */}
        <button type="button" data-set-filter onClick={() => setShowFilters(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            showFilters ? 'bg-indigo-600 text-white border-indigo-600' :
            'border-gray-200 text-gray-500 hover:border-indigo-300'
          }`}>
          Filter {filterDiff !== 'All' || filterPattern || initStarred || initSolved !== null ? '•' : ''}
        </button>

        {/* Cycle button (stats shown in banner below when active) */}
        <div className="relative">
          {!cycleRange && (
            <button type="button" onClick={() => setShowCyclePanel(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                showCyclePanel ? 'bg-indigo-600 text-white border-indigo-600' :
                'border-gray-200 text-gray-500 hover:border-indigo-300'
              }`}>
              <RefreshCw size={11} /> Cycle
            </button>
          )}

          {showCyclePanel && !cycleRange && (
            <>
              <div className="sm:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setShowCyclePanel(false)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,18rem)] sm:absolute sm:left-auto sm:top-full sm:translate-x-0 sm:translate-y-0 sm:right-0 sm:mt-1 sm:w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4">
                <p className="text-xs font-bold text-gray-700 mb-2">🔄 Set Cycle Range</p>
                <p className="text-[11px] text-gray-400 mb-3">Navigate within a range — wraps back automatically.</p>
                {cyclePresets.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Quick presets</p>
                    <div className="flex flex-wrap gap-1">
                      {cyclePresets.map(p => (
                        <button key={p.label} type="button" onClick={() => startCycle(p.start, p.end)}
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
                    value={cycleFromInput} onChange={e => setCycleFromInput(e.target.value)}
                    placeholder="From"
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:border-indigo-400 outline-none" />
                  <span className="text-xs text-gray-400">–</span>
                  <input type="number" min={1} max={filtered.length}
                    value={cycleToInput} onChange={e => setCycleToInput(e.target.value)}
                    placeholder={String(filtered.length)}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:border-indigo-400 outline-none" />
                  <button type="button"
                    onClick={() => {
                      const s = (parseInt(cycleFromInput, 10) || 1) - 1
                      const e = (parseInt(cycleToInput, 10) || filtered.length) - 1
                      startCycle(s, e)
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
            <button onClick={toggleStar}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition-colors ${prog.starred ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 hover:border-yellow-300'}`}>
              <Star size={13} className={prog.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
            </button>

            <button onClick={toggleSolved}
              className={`flex min-h-11 items-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold border transition-colors ${
                prog.solved ? 'bg-green-50 text-green-600 border-green-200' :
                'bg-white text-gray-500 border-gray-200 hover:border-green-300'
              }`}>
              <CheckCircle size={12} className={prog.solved ? 'fill-green-500 text-white' : ''} />
              <span className="hidden sm:inline">{prog.solved ? 'Solved ✓' : 'Mark Solved'}</span>
              <span className="sm:hidden">{prog.solved ? '✓' : '+'}</span>
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
              ? `${rangeSize > 0 ? (cycleAcceptedCount / rangeSize) * 100 : 0}%`
              : filtered.length ? `${((safeIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>
      </div>

      {cycleRange && (
        <CycleProgressBanner
          acceptedCount={cycleAcceptedCount}
          rangeSize={rangeSize}
          cycleReps={cycleReps}
          repTarget={CYCLE_REP_TARGET}
          onCancel={cancelCycle}
          onNextTodo={goNextUnaccepted}
          onOpenList={() => setShowList(true)}
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

      {!loading && allQuestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80 shrink-0">
          <QuestionCountHighlight
            value={exclusiveCountMeta.value}
            label={exclusiveCountMeta.label}
            variant="exclusive"
          />
          <span className="text-[11px] text-gray-500">
            Learn {set} · {set === 2 ? 'from NeetCode 150' : 'from AlgoMaster 600'}
          </span>
        </div>
      )}

      {/* ── Filter panel ── */}
      {showFilters && (
        <div data-set-filter className="border-b border-gray-100 bg-gray-50 shrink-0 space-y-1 px-3 py-2">
          {/* Difficulty */}
          <div className="flex items-center flex-wrap gap-2">
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} type="button" data-set-filter
                onClick={() => {
                  setFilterDiff(d)
                  const qs = buildQuery({ diff: d })
                  router.push(`${learnBase}/0${qs ? `?${qs}` : ''}`, { scroll: false })
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                  filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' :
                  'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                }`}>
                {d}
              </button>
            ))}
          </div>

          {/* Solved / Unsolved */}
          <div className="flex items-center flex-wrap gap-2">
            <button type="button" data-set-filter
              onClick={() => {
                const next = initSolved === true ? null : true
                const qs = buildQuery({ solved: next })
                router.push(`${learnBase}/0${qs ? `?${qs}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                initSolved === true ? 'bg-green-600 text-white border-green-600' :
                'bg-white text-gray-500 border-gray-200 hover:border-green-300'
              }`}>
              Solved
            </button>
            <button type="button" data-set-filter
              onClick={() => {
                const next = initSolved === false ? null : false
                const qs = buildQuery({ solved: next })
                router.push(`${learnBase}/0${qs ? `?${qs}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                initSolved === false ? 'bg-orange-600 text-white border-orange-600' :
                'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}>
              Unsolved
            </button>
          </div>

          {/* Starred */}
          <div className="flex items-center flex-wrap gap-2">
            <button type="button" data-set-filter
              onClick={() => {
                const sp = new URLSearchParams(buildQuery())
                if (initStarred) sp.delete('starred')
                else sp.set('starred', '1')
                router.push(`${learnBase}/0${sp.toString() ? `?${sp}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                initStarred ? 'bg-yellow-500 text-white border-yellow-500' :
                'bg-white text-gray-500 border-gray-200 hover:border-yellow-300'
              }`}>
              Starred
            </button>
          </div>

          {/* Pattern filter — matches Learn 1 */}
          <div className="flex items-center flex-wrap gap-2">
            <button type="button" data-set-filter
              onClick={() => {
                setFilterPattern(null)
                const qs = buildQuery({ pattern: null })
                router.push(`${learnBase}/0${qs ? `?${qs}` : ''}`, { scroll: false })
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                !filterPattern ? 'bg-cyan-600 text-white border-cyan-600' :
                'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'
              }`}>
              All Patterns
            </button>
            {QUICK_PATTERNS
              .slice()
              .sort((a, b) =>
                DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
                DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number]))
              .map(p => {
              const pp = patternProgressMap[p.name] || { solved: 0, total: 0 }
              if (pp.total === 0) return null
              const isActive = filterPattern === p.name
              return (
                <button key={p.name} type="button" data-set-filter
                  onClick={() => {
                    const next = filterPattern === p.name ? null : p.name
                    setFilterPattern(next)
                    const qs = buildQuery({ pattern: next })
                    router.push(`${learnBase}/0${qs ? `?${qs}` : ''}`, { scroll: false })
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                    isActive ? 'bg-cyan-600 text-white border-cyan-600' :
                    'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'
                  }`}>
                  <span>{p.name}</span>
                  <PriorityBadge pattern={p.name} active={isActive} />
                  <span className={`font-mono text-[10px] ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                    {pp.solved}/{pp.total}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pattern / priority context strip (matches Learn 1) */}
      {q && currentPattern && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">Pattern</span>
          <span className="text-xs font-semibold text-[var(--text)] truncate">{currentPattern.name}</span>
          <PriorityBadge pattern={currentPattern.name} />
          <span className="text-[10px] text-[var(--text-subtle)] truncate hidden sm:inline">- {q.category}</span>
          {q.difficulty === 'Easy'   && filterDiff === 'All' && <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full shrink-0">Round - Easy</span>}
          {q.difficulty === 'Medium' && filterDiff === 'All' && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full shrink-0">Round - Medium</span>}
          {q.difficulty === 'Hard'   && filterDiff === 'All' && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0">Round - Hard</span>}
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
      {q && !currentPattern && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🗂</span>
          <span className="text-xs font-semibold text-[var(--text)] truncate">{q.category}</span>
          <span className="text-xs text-[var(--text-subtle)]">· Set {set}</span>
        </div>
      )}

      {!q ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          {filtered.length === 0 && allQuestions.length > 0
            ? 'No questions match your filters.'
            : 'No question at this position.'}
        </div>
      ) : (
        <>
          {/* Unified tab bar — matches Learn 1 (description / best answers; editor always visible) */}
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

          <MobileSplitPanelTabs panel={mobilePanel} onPanelChange={setMobilePanel} />
          <div className="relative z-0 flex flex-col min-h-0 flex-1 overflow-hidden">

            {/* ── Content panel (description / best answers) ── */}
            <div className={`${mobilePanel === 'content' ? 'flex' : 'hidden'} md:flex relative z-10 flex-col w-full md:shrink-0 md:h-1/3 bg-[var(--bg-card)] overflow-hidden text-[var(--text)] border-b border-[var(--border)]`}>
              <div className="flex-1 overflow-visible md:overflow-y-auto">

                {leftPanelTab === 'description' && (
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                        <DifficultyBadge difficulty={q.difficulty} />
                        {currentPatternName && <PriorityBadge pattern={currentPatternName} />}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-subtle)] border border-[var(--border)]">
                          {q.category}
                        </span>
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
                      {prog.solved && prog.next_review && !reviewDue && (
                        <p className="text-xs text-green-600 mt-1">
                          🗓 Next review: {formatLocalDate(prog.next_review)} · {srIntervalDays((prog.review_count ?? 0) + 1)}d interval
                        </p>
                      )}
                    </div>

                    {reviewDue && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Brain size={14} className="text-indigo-600" />
                          <span className="text-xs font-semibold text-indigo-700">
                            Review #{(prog.review_count ?? 0) + 1} due!
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleAgain}
                            className="px-3 py-1 rounded-lg text-xs font-bold transition-colors border bg-white text-indigo-700 border-indigo-200 hover:border-indigo-300">
                            Again
                          </button>
                          <button onClick={handlePass}
                            className="px-3 py-1 rounded-lg text-xs font-bold transition-colors bg-indigo-600 text-white hover:bg-indigo-700">
                            Pass
                          </button>
                        </div>
                      </div>
                    )}

                    {lcContent ? (
                      <div className="lc-description text-sm text-[var(--text)]"
                        dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
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
                      <span className="text-gray-400 italic text-xs">
                        No description cached.{' '}
                        <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
                    )}

                    {prog.solved && prog.next_review && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-green-600">
                          ✅ Review #{(prog.review_count ?? 0) + 1} in {srIntervalDays(prog.review_count ?? 0)}d · {formatLocalDate(prog.next_review)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className={`p-4 h-full ${leftPanelTab !== 'best' ? 'hidden' : ''}`}>
                  <BestAnswersPanel
                    questionId={q.id}
                    slug={lcTitleSlug ?? q.slug}
                    active={leftPanelTab === 'best'}
                    lcActive
                    preferredLangs={['python', 'cpp', 'javascript']}
                  />
                </div>
              </div>
            </div>

            {/* ── Editor panel ── */}
            <div className={`${mobilePanel === 'editor' ? 'flex flex-col' : 'hidden'} md:flex flex-col w-full flex-1 min-h-[50dvh] md:min-h-0 overflow-hidden border-t border-[var(--border)]`}>
              <LeetCodeEditor
                appQuestionId={q.id}
                slug={q.slug}
                syncToApp={false}
                onAccepted={() => {
                  const newCount = (prog.review_count ?? 0) + 1
                  const updated  = updateSetQProgress(set, q.id, {
                    solved: true,
                    last_reviewed: todayISO(),
                    review_count: newCount,
                    next_review: nextReviewDate(newCount),
                  })
                  setProgress(p => ({ ...p, [String(q.id)]: updated }))
                  toast.success('Accepted! Moving to next question.', { duration: 2000 })
                  if (cycleRange) {
                    const isNew = recordCycleAccepted(q.id)
                    if (isNew) fireConfetti(false)
                    const lapStartIdx = checkCycleLapComplete()
                    if (lapStartIdx !== false) {
                      setTimeout(() => {
                        cycleIdxRef.current = lapStartIdx
                        setCyclePosState(0)
                        cyclePosRef.current = 0
                        const qs = learnQsRef.current
                        router.push(`${learnBase}/${lapStartIdx}${qs ? `?${qs}` : ''}`, { scroll: false })
                      }, 700)
                      return
                    }
                  }
                  setTimeout(() => goNext(), 700)
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

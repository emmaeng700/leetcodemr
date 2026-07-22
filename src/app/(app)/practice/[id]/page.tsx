'use client'
import { useState, useEffect, useRef } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, BookOpen, ExternalLink, Loader2, Trophy, List, Sparkles, Star } from 'lucide-react'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { dailyRepsFromProgress, normalizeRepDate } from '@/lib/dailyCompletion'
import { getProgress, updateProgress, addTimeSpent, completeReview, failReview, getStudyPlan, addMasteryRunEvent, getUserProfile, markDailyCompleteToday, bumpDailyRep, setDailyRep, getDueReviews } from '@/lib/db'
import { readReviewSessionReps, writeReviewSessionRep } from '@/lib/reviewSessionReps'
import {
  parseReviewSet,
  reviewQueueKey,
  reviewHubPath,
  dailyQueueKey,
  flowNavQuery,
  loadSetQuestions,
  getSetDueReviews,
  resolveQuestionForPractice,
  getSetQProgressRow,
  completeSetReview,
  failSetReview,
  completeSetDailyQuestion,
} from '@/lib/setReviewFlow'
import { readSetDailyReps, writeSetDailyRep } from '@/lib/setDailyReps'
import { getSetProgress, updateSetQProgress, type SetQProgress } from '@/lib/setProgress'
import type { SetQuestion } from '@/lib/questionSets'
import { todayISOChicago } from '@/lib/studyPlanDay'
import { formatTime, isDue, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import { getPatternForQuestion } from '@/lib/patternUtils'
import { checkAndRecordBreather } from '@/lib/breatherUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import MobileSplitPanelTabs, { type MobileSplitPanel } from '@/components/MobileSplitPanelTabs'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  description?: string
  explanation?: string
  python_solution?: string
  cpp_solution?: string
}

function PremiumBlock({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-bold text-[var(--text)] text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed max-w-xs">
        This question requires a LeetCode Premium subscription to view the description.
        Your subscription may have lapsed or you may not have one active.
      </p>
      {slug && (
        <a
          href={leetCodeUrl(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
        >
          Open on LeetCode ↗
        </a>
      )}
      <p className="text-xs text-[var(--text-subtle)] mt-3">You can still use the code editor on the right to practice.</p>
    </div>
  )
}

function getDailyRepTarget() {
  const raw = localStorage.getItem('lm_reps_per_q')
  const parsed = Number.parseInt(raw ?? '2', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2
}

async function resolveRepTarget(): Promise<number> {
  const local = getDailyRepTarget()
  try {
    const profile = await getUserProfile()
    const profileReps = profile?.repsPerQ
    if (typeof profileReps === 'number' && profileReps > 0) {
      localStorage.setItem('lm_reps_per_q', String(profileReps))
      return profileReps
    }
  } catch {
    /* profile optional */
  }
  return local
}

export default function PracticePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowMode = searchParams.get('from')
  const isDailyMode     = flowMode === 'daily'
  const isReviewFromUrl = flowMode === 'review'
  const reviewSet = parseReviewSet(searchParams.get('set'))
  const flowSet = reviewSet
  const isImbibitionMode = false
  const [activeReviewFlow, setActiveReviewFlow] = useState(isReviewFromUrl)
  const usesThreeSolveGate = isDailyMode || activeReviewFlow
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [showList, setShowList] = useState(false)
  const [solved, setSolved] = useState(false)
  const [dailyDoneToday, setDailyDoneToday] = useState(false)
  const [starred, setStarred] = useState(false)
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState(false)
  const [queuedNextId, setQueuedNextId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'description' | 'best' | 'editor'>('description')
  const [mobilePanel, setMobilePanel] = useState<MobileSplitPanel>('content')
  const [modeRuns, setModeRuns] = useState<Record<string, number>>({})
  const [dailyRepTarget, setDailyRepTarget] = useState(2)
  const [setQuestions, setSetQuestions] = useState<SetQuestion[]>([])
  const [setProgRow, setSetProgRow] = useState<SetQProgress | null>(null)

  const lcTitleSlug = question ? resolveLeetCodeSlug(question.id, question.slug) : undefined

  const [timer, setTimer] = useState(0)
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  // LeetCode live description state
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [lcFailed, setLcFailed] = useState(false)
  const [lcFromCache, setLcFromCache] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const leftPanelTab = activeTab === 'editor' ? 'description' : activeTab

  useEffect(() => {
    if (activeTab === 'editor') setMobilePanel('editor')
  }, [activeTab])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const progressRef = useRef<Record<string, {
    solved?: boolean
    last_daily_done?: string | null
    daily_rep_count?: number
    daily_rep_date?: string | null
    review_count?: number
    next_review?: string | null
    last_reviewed?: string | null
  }>>({})

  // Load local data immediately — no spinner blocking the page
  useEffect(() => {
    async function load() {
      const [qs, prog, plan] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getStudyPlan(),
      ])
      const safeProg = prog ?? {}
      const mainQs = qs as Question[]

      let loadedSetQs: SetQuestion[] = []
      if (flowSet) {
        loadedSetQs = await loadSetQuestions(flowSet)
        setSetQuestions(loadedSetQs)
      }

      // Legacy ID remap: Supabase records may reference old IDs before a correction.
      // Look up the correct question data but preserve the original URL id so all
      // DB writes (completeReview, failReview, updateProgress…) stay consistent.
      const LEGACY_ID_REMAP: Record<number, number> = { 1086: 1133 }
      const lookupId = LEGACY_ID_REMAP[id] ?? id
      const resolved = resolveQuestionForPractice(lookupId, mainQs, flowSet, loadedSetQs)
      const q = resolved && lookupId !== id ? { ...resolved, id } : resolved
      if (!q) {
        if (flowSet) router.replace(isDailyMode ? '/daily' : reviewHubPath(flowSet))
        return
      }
      setQuestion(q as Question)
      setAllQuestions(flowSet && !isDailyMode ? [] : mainQs)

      const setRow = flowSet ? getSetQProgressRow(flowSet, id) : null
      if (flowSet) setSetProgRow(setRow)

      const reviewDue = flowSet
        ? !!(setRow?.solved && isDue(setRow?.next_review ?? null))
        : !!safeProg[String(id)]?.solved && isDue(safeProg[String(id)]?.next_review ?? null)
      const inReviewFlow = isReviewFromUrl || reviewDue
      setActiveReviewFlow(inReviewFlow)

      const queueKey = isDailyMode
        ? dailyQueueKey(flowSet)
        : inReviewFlow
          ? reviewQueueKey(flowSet)
          : null

      let modeQueue: number[] | null = null
      if (queueKey) {
        try {
          const stored = sessionStorage.getItem(queueKey)
          if (stored) {
            const parsed = JSON.parse(stored) as number[]
            modeQueue = inReviewFlow && flowSet
              ? parsed.filter(qid => {
                  const p = getSetProgress(flowSet)[String(qid)]
                  return !!p?.solved && !!p.next_review && isDue(p.next_review)
                })
              : inReviewFlow
                ? parsed.filter(qid => {
                    const next = safeProg[String(qid)]?.next_review
                    return !!next && isDue(next)
                  })
                : parsed
          }
        } catch { /* ignore */ }
      }

      if (modeQueue?.length) {
        if (!modeQueue.includes(id)) {
          modeQueue = [id, ...modeQueue]
          try { sessionStorage.setItem(queueKey!, JSON.stringify(modeQueue)) } catch { /* ignore */ }
        }
        setPlanOrder(modeQueue)
      } else if (inReviewFlow) {
        if (flowSet) {
          const due = getSetDueReviews(flowSet, loadedSetQs)
          const ids = due.map(d => d.id)
          if (ids.includes(id)) setPlanOrder(ids)
          else setPlanOrder([id, ...ids.filter(qid => qid !== id)])
        } else {
          try {
            const due = await getDueReviews()
            const ids = due.map(d => d.id)
            if (ids.includes(id)) setPlanOrder(ids)
            else setPlanOrder([id, ...ids.filter(qid => qid !== id)])
          } catch {
            setPlanOrder([id])
          }
        }
      } else if (isDailyMode) {
        setPlanOrder([id])
      } else if (plan?.question_order?.length) setPlanOrder(plan.question_order)
      else setPlanOrder(mainQs.map((q: Question) => q.id))

      if (flowSet) {
        setSolved(!!setRow?.solved)
        setStarred(!!setRow?.starred)
        setNextReview(setRow?.next_review ?? null)
      } else {
        setSolved(!!safeProg[String(id)]?.solved)
        setStarred(!!safeProg[String(id)]?.starred)
        setNextReview(safeProg[String(id)]?.next_review ?? null)
        progressRef.current = safeProg
      }

      const today = todayISOChicago()
      const repTarget = await resolveRepTarget()
      const dailyRuns = isDailyMode
        ? (flowSet ? readSetDailyReps(flowSet) : dailyRepsFromProgress(safeProg, today))
        : {}
      const dailyDone =
        isDailyMode &&
        (flowSet
          ? (dailyRuns[String(id)] ?? 0) >= repTarget
          : ((dailyRuns[String(id)] ?? 0) >= repTarget || normalizeRepDate(safeProg[String(id)]?.last_daily_done) === today))
      setDailyDoneToday(!!dailyDone)
      if (isDailyMode || inReviewFlow) setDailyRepTarget(repTarget)
      if (isDailyMode || inReviewFlow) {
        const runs = isDailyMode
          ? dailyRuns
          : readReviewSessionReps(flowSet ?? undefined)
        setModeRuns(runs)
      }
    }
    void load()
  }, [id, usesThreeSolveGate, isDailyMode, isReviewFromUrl, isImbibitionMode, flowSet, router])

  useEffect(() => {
    if (!question) return
    setOpenQuestionContext({ id: question.id, slug: question.slug, title: question.title })
  }, [question])

  const targetReps = dailyRepTarget

  useEffect(() => {
    setQueuedNextId(null)
  }, [id])

  // Fetch real LeetCode description in the background once we have the slug.
  // Reads session from localStorage first; if empty falls back to Supabase
  // so the live HTML loads correctly even when the user hasn't visited
  // the LeetCode page yet in this browser session.
  useEffect(() => {
    if (!question?.slug) return
    let cancelled = false
    setLcLoading(true)
    setLcFailed(false)
    setLcFromCache(false)
    setIsPremium(false)

    async function doFetch() {
      // Resolve session — localStorage first, Supabase fallback
      let session  = localStorage.getItem('lc_session')  || ''
      let csrfToken = localStorage.getItem('lc_csrf')    || ''
      if (!session || !csrfToken) {
        try {
          const d = await fetch('/api/lc-session').then(r => r.json())
          if (d.lc_session && d.lc_csrf) {
            session = d.lc_session; csrfToken = d.lc_csrf
            localStorage.setItem('lc_session', session)
            localStorage.setItem('lc_csrf', csrfToken)
          }
        } catch { /* ignore — will try without session */ }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      try {
        const res = await fetch('/api/leetcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            session, csrfToken,
            query: `query questionContent($titleSlug: String!) {
              question(titleSlug: $titleSlug) { content isPaidOnly }
            }`,
            variables: { titleSlug: resolveLeetCodeSlug(question!.id, question!.slug) },
          }),
        })
        const data = await res.json()
        if (cancelled) return
        const q = data?.data?.question
        if (q?.isPaidOnly && !q?.content) {
          setIsPremium(true)
        } else if (q?.content) {
          setLcContent(q.content)
        } else {
          setLcFailed(true)
          if (!cancelled && question?.description) setLcFromCache(true)
        }
      } catch {
        if (!cancelled) { setLcFailed(true); if (question?.description) setLcFromCache(true) }
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setLcLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true }
  }, [question?.id, question?.slug])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    startRef.current = Date.now()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      const elapsed = Math.round((Date.now() - startRef.current) / 1000)
      if (elapsed > 5) addTimeSpent(id, elapsed)
    }
  }, [id])

  const due = flowSet
    ? !!(setProgRow?.solved && isDue(setProgRow?.next_review ?? null))
    : isDue(nextReview) && solved

  function questionTitle(qid: number): string | null {
    return allQuestions.find(q => q.id === qid)?.title
      ?? setQuestions.find(q => q.id === qid)?.title
      ?? null
  }

  function repCountForQueueItem(qid: number, override?: { id: number; reps: number }): number {
    if (override && qid === override.id) return override.reps
    return modeRuns[String(qid)] ?? 0
  }

  /** Queue items still needing reps today — preserves plan order. */
  function incompleteQueueItems(override?: { id: number; reps: number }): number[] {
    return planOrder.filter(qid => repCountForQueueItem(qid, override) < targetReps)
  }

  function persistFlowQueue(key: string, items: number[]) {
    try {
      if (items.length) sessionStorage.setItem(key, JSON.stringify(items))
      else sessionStorage.removeItem(key)
    } catch { /* ignore */ }
  }

  function exitFlowToHub(mode: 'daily' | 'review') {
    if (mode === 'daily') persistFlowQueue(dailyQueueKey(flowSet), [])
    else persistFlowQueue(reviewQueueKey(flowSet), [])
    router.push(mode === 'daily' ? '/daily' : reviewHubPath(flowSet))
  }

  function advanceFlowTo(mode: 'daily' | 'review', nextId: number | null) {
    if (nextId) {
      router.push(`/practice/${nextId}${flowNavQuery(flowSet, mode)}`)
    } else {
      exitFlowToHub(mode)
    }
  }

  async function forceCurrentRunsComplete() {
    if (!question || !usesThreeSolveGate) return
    const current = modeRuns[String(question.id)] ?? 0
    if (current >= targetReps) return
    const missing = targetReps - current
    setModeRuns(prev => ({ ...prev, [String(question.id)]: targetReps }))
    if (isDailyMode) {
      if (flowSet) {
        writeSetDailyRep(flowSet, question.id, targetReps)
        return
      }
      await setDailyRep(question.id, targetReps)
      progressRef.current = {
        ...progressRef.current,
        [String(question.id)]: {
          ...progressRef.current[String(question.id)],
          daily_rep_count: targetReps,
          daily_rep_date: todayISOChicago(),
        },
      }
      return
    }
    writeReviewSessionRep(question.id, targetReps, flowSet ?? undefined)
    if (flowSet) return
    const res = await addMasteryRunEvent(question.id, missing)
    if (!res.ok) {
      toast.error(`Couldn't fully sync review reps: ${res.error ?? 'unknown error'}`)
    }
  }

  async function handleCompleteReview(): Promise<boolean> {
    if (activeReviewFlow) await forceCurrentRunsComplete()
    if (reviewDone) return false
    const queueKey = reviewQueueKey(flowSet)
    const incomplete = incompleteQueueItems({ id, reps: targetReps })
    const nextReviewId = incomplete[0] ?? null
    if (activeReviewFlow) {
      persistFlowQueue(queueKey, incomplete)
      setQueuedNextId(nextReviewId)
    }
    setReviewDone(true)
    let savedNextReview: string | null = null
    if (flowSet) {
      const result = completeSetReview(flowSet, id)
      savedNextReview = result.next_review
      setNextReview(result.next_review)
      setSetProgRow(getSetQProgressRow(flowSet, id))
    } else {
      const result = await completeReview(id)
      if (result.error) {
        toast.error(`Review save failed: ${result.error}`)
        setReviewDone(false)
        return false
      }
      savedNextReview = result.next_review
      setNextReview(result.next_review)
      progressRef.current = {
        ...progressRef.current,
        [String(id)]: {
          ...progressRef.current[String(id)],
          review_count: result.review_count,
          next_review: result.next_review,
          last_reviewed: todayISOChicago(),
        },
      }
    }
    toast.success(`✓ Review done! Next review: ${savedNextReview}`)
    if (activeReviewFlow) {
      advanceFlowTo('review', nextReviewId)
      return true
    }
    return false
  }

  async function handleAcceptedRun() {
    if (!question || !usesThreeSolveGate) return
    const before = modeRuns[String(question.id)] ?? 0
    const currentIdx = planOrder.indexOf(question.id)
    const navSuffix = flowNavQuery(flowSet, isDailyMode ? 'daily' : 'review')
    if (isDailyMode && flowSet) {
      writeSetDailyRep(flowSet, question.id, Math.min(before + 1, targetReps))
    } else if (isDailyMode) {
      const repRes = await bumpDailyRep(question.id)
      if (!repRes.ok) {
        toast.error(`Couldn't save daily rep: ${repRes.error ?? 'unknown error'}`)
        return
      }
      progressRef.current = {
        ...progressRef.current,
        [String(question.id)]: {
          ...progressRef.current[String(question.id)],
          daily_rep_count: repRes.count,
          daily_rep_date: todayISOChicago(),
        },
      }
    } else if (!flowSet) {
      const res = await addMasteryRunEvent(question.id, 1)
      if (!res.ok) {
        toast.error(`Couldn't save mastery run: ${res.error ?? 'unknown error'}`)
        return
      }
    }
    const after = Math.min(before + 1, targetReps)
    setModeRuns(prev => ({ ...prev, [String(question.id)]: (prev[String(question.id)] ?? 0) + 1 }))
    if (activeReviewFlow) writeReviewSessionRep(question.id, after, flowSet ?? undefined)

    const modeLabel = isDailyMode ? 'Daily' : 'Review'
    let autoAdvanceId: number | null = null

    if (after >= targetReps) {
      const incomplete = incompleteQueueItems({ id: question.id, reps: after })
      if (isDailyMode) {
        if (flowSet) {
          completeSetDailyQuestion(flowSet, question.id)
          setSolved(true)
          setSetProgRow(getSetQProgressRow(flowSet, question.id))
          setDailyDoneToday(true)
        } else if (!dailyDoneToday) {
          await markDailyCompleteToday(question.id)
          setDailyDoneToday(true)
          await setDailyRep(question.id, targetReps)
          progressRef.current = {
            ...progressRef.current,
            [String(question.id)]: {
              ...progressRef.current[String(question.id)],
              last_daily_done: todayISOChicago(),
              daily_rep_count: targetReps,
              daily_rep_date: todayISOChicago(),
            },
          }
        }
        persistFlowQueue(dailyQueueKey(flowSet), incomplete)
        autoAdvanceId = incomplete[0] ?? null
        setQueuedNextId(autoAdvanceId)
      } else if (activeReviewFlow) {
        persistFlowQueue(reviewQueueKey(flowSet), incomplete)
        autoAdvanceId = incomplete[0] ?? null
        setQueuedNextId(autoAdvanceId)
      } else {
        const nextQuestionId = currentIdx >= 0 ? planOrder[currentIdx + 1] : null
        autoAdvanceId = nextQuestionId ?? null
        setQueuedNextId(autoAdvanceId)
      }
      const toastNext = autoAdvanceId ? questionTitle(autoAdvanceId) : null
      toast.success(
        toastNext
          ? `${modeLabel} complete: ${targetReps}/${targetReps}. ${toastNext} is next.`
          : `${modeLabel} complete: ${targetReps}/${targetReps}. All done!`,
        { duration: 4500 }
      )
    } else {
      toast.success(`${modeLabel} progress: ${after}/${targetReps}`, { duration: 3000 })
    }

    // Complete the review at target reps for due reviews
    let reviewNavigated = false
    if (activeReviewFlow && due && !reviewDone && after >= targetReps) {
      reviewNavigated = await handleCompleteReview()
    }

    if (!reviewNavigated) {
      if (autoAdvanceId) {
        router.push(`/practice/${autoAdvanceId}${navSuffix}`)
      } else if (isDailyMode && after >= targetReps) {
        exitFlowToHub('daily')
      } else if (activeReviewFlow && after >= targetReps) {
        exitFlowToHub('review')
      }
    }
  }

  async function handleFailReview() {
    if (activeReviewFlow) await forceCurrentRunsComplete()
    if (reviewDone) return
    const incomplete = incompleteQueueItems({ id, reps: targetReps })
    const nextReviewId = incomplete[0] ?? null
    if (activeReviewFlow) {
      persistFlowQueue(reviewQueueKey(flowSet), incomplete)
      setQueuedNextId(nextReviewId)
    }
    setReviewDone(true)
    let savedNextReview: string | null = null
    if (flowSet) {
      const result = failSetReview(flowSet, id)
      savedNextReview = result.next_review
      setNextReview(result.next_review)
      setSetProgRow(getSetQProgressRow(flowSet, id))
    } else {
      const result = await failReview(id)
      if (result.error) {
        toast.error(`Review save failed: ${result.error}`)
        setReviewDone(false)
        return
      }
      savedNextReview = result.next_review
      setNextReview(result.next_review)
      progressRef.current = {
        ...progressRef.current,
        [String(id)]: {
          ...progressRef.current[String(id)],
          review_count: result.review_count,
          next_review: result.next_review,
          last_reviewed: todayISOChicago(),
        },
      }
    }
    toast(`Again scheduled — next review: ${savedNextReview}`)
    if (activeReviewFlow) {
      advanceFlowTo('review', nextReviewId)
    }
  }

  async function handlePassDaily() {
    if (!question || !isDailyMode || dailyDoneToday) return
    const navSuffix = flowNavQuery(flowSet, 'daily')

    setModeRuns(prev => ({ ...prev, [String(question.id)]: targetReps }))
    if (activeReviewFlow) writeReviewSessionRep(question.id, targetReps, flowSet ?? undefined)

    if (flowSet) {
      completeSetDailyQuestion(flowSet, question.id)
      setSolved(true)
      setSetProgRow(getSetQProgressRow(flowSet, question.id))
      setDailyDoneToday(true)
    } else {
      await markDailyCompleteToday(question.id)
      setDailyDoneToday(true)
      await setDailyRep(question.id, targetReps)
      progressRef.current = {
        ...progressRef.current,
        [String(question.id)]: {
          ...progressRef.current[String(question.id)],
          last_daily_done: todayISOChicago(),
          daily_rep_count: targetReps,
          daily_rep_date: todayISOChicago(),
        },
      }
    }

    const incomplete = incompleteQueueItems({ id: question.id, reps: targetReps })
    persistFlowQueue(dailyQueueKey(flowSet), incomplete)
    const autoAdvanceId = incomplete[0] ?? null
    setQueuedNextId(autoAdvanceId)

    const toastNext = autoAdvanceId ? questionTitle(autoAdvanceId) : null
    toast.success(
      toastNext
        ? `Passed! ${targetReps}/${targetReps}. Next: ${toastNext}`
        : `Passed! ${targetReps}/${targetReps}. All done!`,
      { duration: 4500 },
    )

    if (autoAdvanceId) {
      router.push(`/practice/${autoAdvanceId}${navSuffix}`)
    } else {
      exitFlowToHub('daily')
    }
  }

  async function handleMarkSolved() {
    if (!question) return
    if (isDailyMode) {
      if (dailyDoneToday) {
        toast.success('Already done for today\'s Daily block')
        return
      }
      if (flowSet) {
        writeSetDailyRep(flowSet, id, targetReps)
        completeSetDailyQuestion(flowSet, id)
        setSolved(true)
        setSetProgRow(getSetQProgressRow(flowSet, id))
        setModeRuns(prev => ({ ...prev, [String(id)]: targetReps }))
        setDailyDoneToday(true)
        toast.success('Marked done for today\'s Daily', { duration: 3500 })
        return
      }
      await markDailyCompleteToday(id)
      setDailyDoneToday(true)
      await setDailyRep(id, targetReps)
      setModeRuns(prev => ({ ...prev, [String(id)]: targetReps }))
      progressRef.current = {
        ...progressRef.current,
        [String(id)]: {
          ...progressRef.current[String(id)],
          last_daily_done: todayISOChicago(),
          daily_rep_count: targetReps,
          daily_rep_date: todayISOChicago(),
        },
      }
      toast.success('Marked done for today\'s Daily — Learn progress unchanged', { duration: 3500 })
      return
    }
    const newSolved = !solved
    setSolved(newSolved)
    progressRef.current = { ...progressRef.current, [String(id)]: { ...progressRef.current[String(id)], solved: newSolved } }
    await updateProgress(id, { solved: newSolved })
    if (newSolved) {
      const completed = checkAndRecordBreather(id, allQuestions, progressRef.current)
      if (completed) {
        toast.success(`🎉 ${completed} pattern complete! Take 2 days to revise before moving on.`, { duration: 5000 })
      } else {
        const pattern = getPatternForQuestion(question.tags ?? [])
        const SOLVE_MSGS = [
          `${pattern ? `${pattern} pattern ` : ''}locked in! Keep the streak alive 🔥`,
          `One more down${pattern ? ` in ${pattern}` : ''}! You're building real pattern recognition 🧠`,
          `${pattern ?? 'Question'} solved — each rep makes the next one easier 💪`,
          `Another one bites the dust${pattern ? ` (${pattern})` : ''}! Stay consistent 🚀`,
          `Nailed it${pattern ? ` — ${pattern} is getting clearer` : ''}! That muscle memory is building 🏆`,
        ]
        toast.success(SOLVE_MSGS[Math.floor(Math.random() * SOLVE_MSGS.length)], { duration: 3500 })
      }
    } else {
      toast.success('Unmarked')
    }
  }

  // Show skeleton top bar immediately, fill in once question loads
  return (
    <div className="flex flex-col">

      {/* Top bar */}
      <div className="flex flex-wrap items-start sm:items-center px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 gap-x-2 gap-y-1.5">
        {/* Back button */}
        <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>

        {/* Title — own full-width line on mobile, inline on sm+ */}
        {question ? (
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 hidden sm:inline">#{question.id}</span>
            <h1 className="min-w-0 flex-1 font-bold text-[var(--text)] text-sm leading-snug break-words">{question.title}</h1>
            <div className="shrink-0"><DifficultyBadge difficulty={question.difficulty} /></div>
            <PriorityBadge pattern={getPatternForQuestion(question.tags ?? []) ?? ''} />
            <a
              href={leetCodeUrl(lcTitleSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[var(--text-muted)] hover:text-orange-400 transition-colors"
              title="Open on LeetCode"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="order-last w-full sm:order-none h-4 w-32 sm:w-48 bg-[var(--bg-muted)] rounded animate-pulse" />
        )}

        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5 shrink overflow-visible">
          {/* Question list */}
          {planOrder.length > 0 && (() => {
            const qMap = Object.fromEntries([
              ...allQuestions.map(q => [q.id, q] as const),
              ...setQuestions.map(sq => [sq.id, {
                id: sq.id,
                title: sq.title,
                slug: sq.slug,
                difficulty: sq.difficulty,
                tags: sq.tags,
                source: [],
              } satisfies Question] as const),
            ])
            const currentIdx = planOrder.indexOf(id)
            const prevId = currentIdx > 0 ? planOrder[currentIdx - 1] : null
            const nextId = queuedNextId ?? (currentIdx >= 0 && currentIdx < planOrder.length - 1 ? planOrder[currentIdx + 1] : null)
            const navSuffix = isDailyMode
              ? flowNavQuery(flowSet, 'daily')
              : activeReviewFlow
                ? flowNavQuery(flowSet, 'review')
                : ''
            const practiceListItems = planOrder.map((qid) => {
              const lq = qMap[qid]
              if (!lq) return null
              return (
                <button
                  key={qid}
                  type="button"
                  onClick={() => {
                    router.push(`/practice/${qid}${navSuffix}`)
                    setShowList(false)
                  }}
                  className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-b border-[var(--border-soft)] hover:bg-indigo-600/10 ${qid === id ? 'bg-indigo-600/15' : ''}`}
                >
                  <span className="shrink-0 tabular-nums text-xs font-mono text-[var(--text-subtle)]">#{lq.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text)]">{lq.title}</span>
                  <span
                    className={`text-xs font-semibold shrink-0 ${lq.difficulty === 'Easy' ? 'text-green-600' : lq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
                  >
                    {lq.difficulty[0]}
                  </span>
                  {usesThreeSolveGate && (
                    <span className="shrink-0 text-[10px] font-bold text-cyan-600">
                      {Math.min(modeRuns[String(qid)] ?? 0, targetReps)}/{targetReps}
                    </span>
                  )}
                </button>
              )
            })
            return (
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                {isDailyMode && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shrink-0">
                    📅 Daily{flowSet === 2 ? ' · Set 2' : flowSet === 3 ? ' · Set 3' : ''}
                  </span>
                )}
                {activeReviewFlow && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold shrink-0">
                    🔁 Review{flowSet === 2 ? ' · Set 2' : flowSet === 3 ? ' · Set 3' : ''}
                  </span>
                )}
                <button onClick={() => prevId && router.push(`/practice/${prevId}${navSuffix}`)} disabled={!prevId}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 transition-colors bg-[var(--bg-muted)]">
                  <ArrowLeft size={13} />
                </button>
                <div ref={listWrapRef} className="relative z-10">
                  <button type="button" onClick={() => setShowList(v => !v)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-indigo-500/50 transition-colors bg-[var(--bg-muted)]">
                    <List size={12} />
                    <span className="font-mono">{currentIdx + 1}/{planOrder.length}</span>
                  </button>
                  {showList && (
                    <>
                      <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                      <div className={listDropdownMobilePanelClasses('right')}>{practiceListItems}</div>
                    </>
                  )}
                </div>
                <button onClick={() => nextId && router.push(`/practice/${nextId}${navSuffix}`)} disabled={!nextId}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 transition-colors bg-[var(--bg-muted)]">
                  <ArrowLeft size={13} className="rotate-180" />
                </button>
              </div>
            )
          })()}
          {usesThreeSolveGate && question && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold shrink-0">
              <Trophy size={12} />
              <span>{Math.min(modeRuns[String(question.id)] ?? 0, targetReps)}/{targetReps}</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] text-xs sm:text-sm font-mono font-semibold text-[var(--text-muted)] shrink-0">
            <Clock size={12} className="sm:hidden" />
            <Clock size={13} className="hidden sm:block" />
            {formatTime(timer)}
          </div>
          <button
            onClick={() => {
              const n = !starred
              setStarred(n)
              if (flowSet) {
                updateSetQProgress(flowSet, id, { starred: n })
                setSetProgRow(getSetQProgressRow(flowSet, id))
              } else {
                updateProgress(id, { starred: n })
              }
            }}
            disabled={!question}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-[var(--bg-muted)] border-[var(--border)] hover:border-yellow-300'}`}
            aria-label={starred ? 'Unstar' : 'Star'}
          >
            <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
          </button>
          <button
            onClick={handleMarkSolved}
            disabled={!question}
            className={`flex min-w-0 items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors border disabled:opacity-40 ${
              isDailyMode
                ? dailyDoneToday
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
                : solved
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
            }`}
          >
            <CheckCircle size={13} className={(isDailyMode ? dailyDoneToday : solved) ? 'fill-green-500 text-white' : ''} />
            <span className="hidden sm:inline">
              {isDailyMode ? (dailyDoneToday ? 'Daily done ✓' : 'Mark daily done') : solved ? 'Solved ✓' : 'Mark Solved'}
            </span>
            <span className="sm:hidden">{isDailyMode ? (dailyDoneToday ? '✓' : 'Daily') : solved ? '✓' : 'Solve'}</span>
          </button>
        </div>
      </div>

      {/* SR review actions — due today */}
      {due && (
        <div className="px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-indigo-50/60 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-indigo-700">
              🧠 Spaced repetition review due
            </div>
            <div className="flex w-full sm:w-auto items-center justify-end gap-2">
              <button
                onClick={handleFailReview}
                disabled={reviewDone}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 bg-white text-indigo-700 hover:border-indigo-300 disabled:opacity-50"
              >
                Again
              </button>
              <button
                onClick={handleCompleteReview}
                disabled={reviewDone}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily pass button — fill reps and move on */}
      {isDailyMode && usesThreeSolveGate && !dailyDoneToday && (
        <div className="px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-green-50/60 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-green-700">
              📅 Daily question · {Math.min(modeRuns[String(question?.id ?? 0)] ?? 0, targetReps)}/{targetReps} reps
            </div>
            <button
              onClick={handlePassDaily}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {/* Pattern context strip */}
      {question && (() => { const p = getPatternForQuestion(question.tags ?? []); return p ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
          <span className="text-xs font-semibold text-[var(--text)]">{p}</span>
          <PriorityBadge pattern={p} />
          {usesThreeSolveGate && (
            <span className="ml-auto text-[11px] font-bold text-cyan-700 shrink-0">
              {isDailyMode ? 'Daily' : 'Review'} {Math.min(modeRuns[String(question.id)] ?? 0, targetReps)}/{targetReps}
            </span>
          )}
        </div>
      ) : null })()}

      {/* Unified tab bar */}
      <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 scrollbar-none">
        <button onClick={() => setActiveTab('description')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <BookOpen size={12} /> Description
          {lcLoading && <Loader2 size={10} className="animate-spin text-[var(--text-muted)]" />}
          {lcFromCache && !lcLoading && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 border border-amber-200 font-bold">Cached</span>}
        </button>
        {question && (
          <button onClick={() => setActiveTab('best')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'best' ? 'border-amber-500 text-amber-600 ' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <Sparkles size={12} /> Best answers
          </button>
        )}
      </div>

      <div className="hidden"><MobileSplitPanelTabs panel={mobilePanel} onPanelChange={setMobilePanel} /></div>

      {/* Content area */}
      <div className="flex flex-col">

        {/* Description panel (all non-editor tabs) */}
        <div className="flex relative z-10 flex-col w-full bg-[var(--bg-card)] overflow-visible text-[var(--text)] border-b border-[var(--border)]">
          <div className="overflow-visible p-4">
            {leftPanelTab === 'description' && (
              <>
                {/* Tags */}
                {question && (question.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {question.tags.map(t => (
                      <span key={t} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}

                {/* Live LeetCode HTML content */}
                {lcContent ? (
                  <div className="lc-description text-sm text-[var(--text)]"
                    dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                ) : isPremium ? (
                  <PremiumBlock slug={lcTitleSlug} />
                ) : lcLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                    <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-4" />
                    <div className="h-3 bg-slate-700 rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-3/4" />
                    <div className="h-3 bg-slate-700 rounded w-5/6" />
                  </div>
                ) : (
                  /* Live fetch failed — render cached plain-text description
                     with the same parser used on the learn page */
                  question?.description
                    ? <DescriptionRenderer description={question.description} />
                    : <span className="text-[var(--text-subtle)] italic text-xs">
                        Description unavailable.{' '}
                        <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
                )}

                {/* Company tags */}
                {question && (question.source || []).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Asked by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.source.map(s => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {leftPanelTab === 'best' && question && (
              <BestAnswersPanel
                questionId={question.id}
                slug={lcTitleSlug ?? question.slug}
                active={leftPanelTab === 'best'}
                preferredLangs={question.tags?.includes('JavaScript') ? ['javascript', 'python', 'cpp'] : ['python', 'cpp', 'javascript']}
              />
            )}

          </div>
        </div>

        {/* Editor panel */}
        <div className="flex flex-col w-full min-h-[50dvh] md:h-[65vh] overflow-hidden border-t border-[var(--border)]">
          {question ? (
            <LeetCodeEditor
              appQuestionId={question.id}
              slug={question.slug}
              questionTitle={question.title}
              preferredLangs={question.tags?.includes('JavaScript') ? ['javascript', 'python3', 'cpp'] : undefined}
              onAccepted={async () => {
                await handleAcceptedRun()
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading editor...
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

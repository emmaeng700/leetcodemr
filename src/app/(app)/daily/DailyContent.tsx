'use client'
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useClickOutside } from '@/hooks/useClickOutside'
import { CalendarCheck, Rocket, RotateCcw, ArrowRight, CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, List, Brain, Star, Wind, Bell, BookOpen, Settings } from 'lucide-react'
import { getStudyPlan, saveStudyPlan, clearStudyPlan, getProgress, getDueReviews, rebalanceReviews, updateProgress, getTodayDailyDoneCount, getDailyLog, syncStreakActivityFromGoals, getUserRevisionCap, syncDailyRepsFromLocal } from '@/lib/db'
import { getActiveBreathers, type ActiveBreather } from '@/lib/breatherUtils'
import { studyOrder } from '@/lib/studyOrder'
import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS, PATTERN_PRIORITY } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import StudyRoundHeader, { isNewRound } from '@/components/StudyRoundHeader'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import {
  DAILY_REPS_CHANGED,
  dailyRepsFromProgress,
  getDailyRepCount,
  getPushedCatchUpQuestionIds,
  hasCompletedDailyRepsOnOrAfter,
  isActiveDailyBlockComplete,
  isPlanDayComplete,
  isQuestionDoneForDailyToday,
  isCatchUpDailyCleared,
  normalizeRepDate,
  RECENT_PLAN_DAY_WINDOW,
} from '@/lib/dailyCompletion'
import { diffDaysSincePlanStart } from '@/lib/studyPlanDay'
import { isDayComplete } from '@/lib/streakGoals'
import { getSetProgress, type SetQProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import {
  buildExtensionPhases,
  findActiveExtensionDay,
  getActiveExtensionPhase,
  getGrandTotalDays,
  isSet1PlanAllDaysComplete,
  questionIdsForScheduleDay,
  resolveScheduleDay,
  learnHrefForSetQuestion,
  dailyHrefForSetQuestion,
  reviewHrefForQuestion,
} from '@/lib/dailyExtension'
import { dailyQueueKey, practiceDailyHref, getSetDueReviews, practiceReviewHref } from '@/lib/setReviewFlow'
import { learnHrefForQuestionId } from '@/lib/learnNav'
import { readSetDailyReps, isSetQuestionDoneForDailyToday } from '@/lib/setDailyReps'
import ReviewCatchUpBox from '@/components/ReviewCatchUpBox'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
}

interface ProgressData {
  solved: boolean
  starred: boolean
  notes: string
  last_reviewed?: string | null
  last_daily_done?: string | null
  daily_rep_count?: number
  daily_rep_date?: string | null
}

type PlanMode = 'strict' | 'random'
const PLAN_MODE_KEY      = 'lm_plan_mode_v1'
const FOCUS_PATTERN_KEY  = 'lm_focus_pattern_v1'
const REPS_PER_Q_KEY     = 'lm_reps_per_q'
const DAILY_QUEUE_KEY    = 'lm_daily_queue'

// ─── Rep dots ─────────────────────────────────────────────────────────────────
function RepDots({ done, total, complete }: { done: number; total: number; complete?: boolean }) {
  const capped = Math.min(Math.max(0, done), total)
  return (
    <div className="flex items-center gap-[3px]" aria-label={`${capped} of ${total} daily reps`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full border transition-colors ${
            i < capped
              ? complete
                ? 'bg-green-500 border-green-600'
                : 'bg-indigo-500 border-indigo-600'
              : 'bg-[var(--bg-input)] border-[var(--border)]'
          }`}
        />
      ))}
    </div>
  )
}
const ORDERED_QUICK_PATTERNS = QUICK_PATTERNS
  .slice()
  .filter(p => p.name !== 'JavaScript')
  .sort(
    (a, b) =>
      DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
      DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number])
  )

interface StudyPlan {
  start_date: string
  per_day: number
  question_order: number[]
  lock_code: string
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function fmtDate(iso: string) {
  // Add T12:00:00 to avoid midnight UTC → previous-day local timezone drift
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function dayScheduledDate(startDate: string, dayIdx: number): string {
  const d = new Date(startDate + 'T12:00:00')
  d.setDate(d.getDate() + dayIdx)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Returns the ISO date (YYYY-MM-DD) for a given plan day index. */
function dayScheduledISO(startDate: string, dayIdx: number): string {
  const d = new Date(startDate + 'T12:00:00')
  d.setDate(d.getDate() + dayIdx)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function calcFinish(startDate: string, perDay: number, total: number) {
  const days = Math.ceil(total / perDay)
  const d = new Date(startDate)
  d.setDate(d.getDate() + days - 1)
  return { days, date: d.toISOString().split('T')[0] }
}

function getDayInfo(plan: StudyPlan, dayIndex: number, allQuestions: Question[], progress: Record<string, ProgressData>) {
  const start = plan.per_day * dayIndex
  const end = start + plan.per_day
  const questionIds = plan.question_order.slice(start, end)
  const questions = questionIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean) as Question[]
  return { questionIds, questions }
}

function getTodayInfo(
  plan: StudyPlan,
  allQuestions: Question[],
  _progress: Record<string, ProgressData>,
  _dailyReps: Record<string, number>,
  _repsPerQ: number,
) {
  const diffDays = diffDaysSincePlanStart(plan.start_date)

  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  const finishDate = calcFinish(plan.start_date, plan.per_day, plan.question_order.length).date

  if (diffDays < 0) {
    return { pending: true, daysUntil: -diffDays, startDate: plan.start_date, totalDays, finishDate }
  }

  if (diffDays >= totalDays) {
    return { complete: true, totalDays, finishDate, dayNumber: totalDays, daysLeft: 0 }
  }

  // Today = calendar schedule day. Unfinished past days push in separately as catch-up.
  const dayNumber = diffDays + 1
  const daysLeft = totalDays - dayNumber
  const { questionIds, questions } = getDayInfo(plan, diffDays, allQuestions, _progress)

  return {
    pending: false,
    complete: false,
    dayNumber,
    totalDays,
    finishDate,
    daysLeft,
    questionIds,
    questions,
  }
}

export default function DailyPage() {
  const pathname = usePathname()
  const router = useRouter()
  const prevPathRef = useRef<string | null>(null)
  const online = useOnlineStatus()
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressData>>({})
  const [dueReviews, setDueReviews] = useState<Array<{ id: number; review_count: number; next_review: string; carried?: boolean }>>([])
  const [dueOpen, setDueOpen] = useState(true)
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  // dailyLog: date (YYYY-MM-DD) → number of daily questions done that day
  const [dailyLog, setDailyLog] = useState<Record<string, number>>({})

  // Setup form
  const [startDate, setStartDate] = useState(todayISO())
  const [perDay, setPerDay] = useState(3)
  const [perDayStr, setPerDayStr] = useState('3')
  const [planCode, setPlanCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [startFromPattern, setStartFromPattern] = useState<string | null>(null)
  const [setupMode, setSetupMode] = useState<PlanMode>('strict')   // chosen in setup form

  // Active plan mode + random-mode state
  const [activePlanMode, setActivePlanMode] = useState<PlanMode>('strict')
  const [focusPattern, setFocusPattern] = useState<string | null>(null)
  const [todayDailyDoneCount, setTodayDailyDoneCount] = useState(0)

  // Rep tracking
  const [repsPerQ, setRepsPerQ] = useState(2)
  const repsPerQRef = useRef(2)
  const todayQsRef  = useRef<Question[]>([])
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Setup-form reps picker
  const [setupRepsPerQ, setSetupRepsPerQ] = useState(2)

  // Setup-form review + email settings
  const [setupReviewStartDays, setSetupReviewStartDays] = useState(14)
  const [setupRevisionCap,     setSetupRevisionCap]     = useState(3)
  const [setupEmailEnabled,    setSetupEmailEnabled]     = useState(true)
  const [setupTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/Chicago' }
  })

  // Reset gate
  const [showResetPrompt, setShowResetPrompt] = useState(false)
  const [resetAttempt, setResetAttempt] = useState('')
  const [resetError, setResetError] = useState(false)

  // Change pace
  const [showChangePace, setShowChangePace] = useState(false)
  const [newPerDay, setNewPerDay] = useState(5)
  const [newPerDayStr, setNewPerDayStr] = useState('5')
  const [savingPace, setSavingPace] = useState(false)

  // Past days (accordion per day + global “show more” for long plans)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [pastDaysShowAll, setPastDaysShowAll] = useState(false)

  // Upcoming days preview (offset from today: 0 = tomorrow, 1 = day after, …)
  const [previewOffset, setPreviewOffset] = useState(0)
  const [showList, setShowList] = useState(false)
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  // Extra days

  const [breathers, setBreathers] = useState<ActiveBreather[]>([])

  // Set 2/3 state
  const [set2Questions, setSet2Questions] = useState<SetQuestion[]>([])
  const [set3Questions, setSet3Questions] = useState<SetQuestion[]>([])
  const [set2Progress, setSet2Progress] = useState<Record<string, SetQProgress>>({})
  const [set3Progress, setSet3Progress] = useState<Record<string, SetQProgress>>({})
  const [set2DailyReps, setSet2DailyReps] = useState<Record<string, number>>({})
  const [set3DailyReps, setSet3DailyReps] = useState<Record<string, number>>({})

  const calendarDayIndex = useMemo(() => {
    if (!plan) return 0
    return diffDaysSincePlanStart(plan.start_date)
  }, [plan])

  const topicMap = useMemo(() => buildExclusivePatternMap(allQuestions), [allQuestions])

  const dailyReps = useMemo(
    () => dailyRepsFromProgress(progress, todayISO()),
    [progress],
  )

  const learnOrderIds = useMemo(() => studyOrder(allQuestions), [allQuestions])

  // ── Derived values that must live before any early return (Rules of Hooks) ──
  const isRandomMode = activePlanMode === 'random'

  // Random mode: questions for selected focus pattern (unsolved first)
  const randomFocusQs = useMemo(() => {
    if (!isRandomMode || !focusPattern) return []
    return allQuestions
      .filter(q => (topicMap[q.id] ?? 'Other') === focusPattern)
      .sort((a, b) => {
        const aS = progress[String(a.id)]?.solved ? 1 : 0
        const bS = progress[String(b.id)]?.solved ? 1 : 0
        if (aS !== bS) return aS - bS  // unsolved first
        const order = ['Easy', 'Medium', 'Hard']
        return order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
      })
  }, [isRandomMode, focusPattern, allQuestions, topicMap, progress])

  // Count unsolved per pattern for the pattern picker badge
  const unsolvedByPattern = useMemo(() => {
    if (!isRandomMode) return {}
    const counts: Record<string, number> = {}
    for (const q of allQuestions) {
      const pat = topicMap[q.id] ?? 'Other'
      if (!progress[String(q.id)]?.solved) counts[pat] = (counts[pat] ?? 0) + 1
    }
    return counts
  }, [isRandomMode, allQuestions, topicMap, progress])

  const totalSolved = useMemo(
    () => allQuestions.filter(q => !!progress[String(q.id)]?.solved).length,
    [allQuestions, progress]
  )

  // Set 2/3 SR reviews due — computed before early returns (Rules of Hooks)
  const set2DueReviews = useMemo(() => {
    return getSetDueReviews(2, set2Questions).map(d => {
      const q = set2Questions.find(x => x.id === d.id)
      return { ...d, title: q?.title ?? '', slug: q?.slug ?? '' }
    })
  }, [set2Questions, set2Progress])

  const set3DueReviews = useMemo(() => {
    return getSetDueReviews(3, set3Questions).map(d => {
      const q = set3Questions.find(x => x.id === d.id)
      return { ...d, title: q?.title ?? '', slug: q?.slug ?? '' }
    })
  }, [set3Questions, set3Progress])

  const set1CarriedReviews = useMemo(
    () => dueReviews.filter(r => r.carried),
    [dueReviews],
  )
  const set1NaturalReviews = useMemo(
    () => dueReviews.filter(r => !r.carried),
    [dueReviews],
  )
  const set2CarriedReviews = useMemo(
    () => set2DueReviews.filter(r => r.carried),
    [set2DueReviews],
  )
  const set2NaturalReviews = useMemo(
    () => set2DueReviews.filter(r => !r.carried),
    [set2DueReviews],
  )
  const set3CarriedReviews = useMemo(
    () => set3DueReviews.filter(r => r.carried),
    [set3DueReviews],
  )
  const set3NaturalReviews = useMemo(
    () => set3DueReviews.filter(r => !r.carried),
    [set3DueReviews],
  )
  const totalReviewCatchUpCount = set1CarriedReviews.length + set2CarriedReviews.length + set3CarriedReviews.length

  const set2Unsolved = useMemo(
    () => set2Questions.filter(q => !set2Progress[String(q.id)]?.solved),
    [set2Questions, set2Progress]
  )

  const set3Unsolved = useMemo(
    () => set3Questions.filter(q => !set3Progress[String(q.id)]?.solved),
    [set3Questions, set3Progress]
  )

  const refreshProgress = useCallback(async () => {
    try {
      const [prog, dailyDoneToday, logData] = await Promise.all([
        getProgress(),
        getTodayDailyDoneCount(),
        getDailyLog(),
      ])
      if (prog !== null) setProgress(prog)
      setDailyLog(logData ?? {})
      setTodayDailyDoneCount(dailyDoneToday)
      setBreathers(getActiveBreathers())
      setSet2Progress(getSetProgress(2))
      setSet3Progress(getSetProgress(3))
      setSet2DailyReps(readSetDailyReps(2))
      setSet3DailyReps(readSetDailyReps(3))
    } catch {
      /* ignore — keep existing progress so rep dots don't vanish */
    }
  }, [])

  const refreshDue = useCallback(async () => {
    try {
      const due = await getDueReviews()
      setDueReviews(due)
      setSet2Progress(getSetProgress(2))
      setSet3Progress(getSetProgress(3))
      setSet2DailyReps(readSetDailyReps(2))
      setSet3DailyReps(readSetDailyReps(3))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function load() {
      // Rebalance reviews whenever the user's cap changes.
      // Key includes the cap value so any setting change triggers a fresh re-spread.
      const capForRebalance = await getUserRevisionCap()
      const REBALANCE_KEY = `lm_rebalanced_cap_${capForRebalance}`
      if (!localStorage.getItem(REBALANCE_KEY)) {
        // Remove old rebalance keys so they don't accumulate.
        for (const k of [...Object.keys(localStorage)]) {
          if (k.startsWith('lm_rebalanced_')) localStorage.removeItem(k)
        }
        await rebalanceReviews()
        localStorage.setItem(REBALANCE_KEY, '1')
      }

      const savedFocus = localStorage.getItem(FOCUS_PATTERN_KEY)
      if (savedFocus) setFocusPattern(savedFocus)

      const [qs, prog, p, due, dailyDoneToday, profileRes, logData] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getStudyPlan(),
        getDueReviews(),
        getTodayDailyDoneCount(),
        fetch('/api/user/profile')
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null),
        getDailyLog(),
      ])
      setDailyLog(logData ?? {})

      // Load reps-per-question setting and today's rep counts.
      // DB (profile) wins — it is the source of truth across devices.
      // localStorage is only used as a fallback when the profile has no value.
      // Use a presence check (not Math.max) so a missing DB value (null/undefined)
      // stays 0 and correctly falls through to the localStorage fallback.
      const rawProfileRpq = typeof profileRes?.profile?.repsPerQ === 'number' && profileRes.profile.repsPerQ > 0
        ? profileRes.profile.repsPerQ : 0
      const rawLocalRpq = parseInt(localStorage.getItem(REPS_PER_Q_KEY) ?? '0', 10) || 0
      const savedRpq = rawProfileRpq > 0 ? rawProfileRpq : (rawLocalRpq > 0 ? rawLocalRpq : 2)
      setRepsPerQ(savedRpq)
      setSetupRepsPerQ(savedRpq)
      repsPerQRef.current = savedRpq
      localStorage.setItem(REPS_PER_Q_KEY, String(savedRpq))
      await syncDailyRepsFromLocal()
      const progAfterMigrate = await getProgress()
      if (progAfterMigrate !== null) setProgress(progAfterMigrate)

      // Resolve mode: localStorage wins; fall back to plan.mode from DB (once
      // that column is populated), then to 'strict'. Write back to localStorage
      // so every code-path that reads it gets the correct value.
      const localMode = localStorage.getItem(PLAN_MODE_KEY) as PlanMode | null
      const dbMode = ((p as any)?.mode ?? null) as PlanMode | null
      const resolvedMode: PlanMode = localMode ?? dbMode ?? 'strict'
      if (resolvedMode !== localMode) {
        // DB has a mode that localStorage doesn't — persist it so future reads are consistent
        localStorage.setItem(PLAN_MODE_KEY, resolvedMode)
      }
      setActivePlanMode(resolvedMode)

      // Backfill DB mode for older plans created before `mode` existed.
      // This keeps server-side features (emails/cron) aligned with the UI mode.
      if (p && !dbMode && resolvedMode) {
        void saveStudyPlan({ ...(p as any), mode: resolvedMode }).catch(() => {/* silent */})
      }

      // ── Auto-migrate plan to diff-first ordering ───────────────────────────
      // If the stored question_order follows the old pattern-based ordering, silently
      // re-sort it to diff-first (all Easys → all Mediums → all Hards) and save back.
      // Progress is tracked per question ID so no solved data is lost.
      let migratedPlan = p
      if (p && Array.isArray(p.question_order) && p.question_order.length > 0) {
        const allQs = qs as Question[]
        const planIdSet = new Set(p.question_order as number[])
        const planQs = allQs.filter(q => planIdSet.has(q.id))
        const correctOrder = studyOrder(planQs)
        const needsMigration = correctOrder.length !== p.question_order.length ||
          correctOrder.some((id: number, i: number) => id !== p.question_order[i])
        if (needsMigration) {
          migratedPlan = { ...p, question_order: correctOrder }
          void saveStudyPlan({ ...(migratedPlan as any), mode: ((p as any).mode ?? resolvedMode) })
            .catch(() => {/* silent — plan still works from local state */})
        }
      }

      setAllQuestions(qs)
      if (progAfterMigrate !== null) setProgress(progAfterMigrate)
      else if (prog !== null) setProgress(prog)
      setPlan(migratedPlan)
      setDueReviews(due)
      setTodayDailyDoneCount(dailyDoneToday)
      setBreathers(getActiveBreathers())

      // Load Set 2/3 questions and progress
      const mainIds = new Set((qs as { id: number }[]).map(q => q.id))
      setSet2Questions(getSet2Questions(mainIds))
      setSet3Questions(getSet3Questions(mainIds))
      setSet2Progress(getSetProgress(2))
      setSet3Progress(getSetProgress(3))
      setSet2DailyReps(readSetDailyReps(2))
      setSet3DailyReps(readSetDailyReps(3))

      setLoading(false)

      // Re-evaluate streak on every page load so any missed marks get caught.
      void syncStreakActivityFromGoals(resolvedMode).catch(() => {/* silent */})
    }
    load()
  }, [])

  // Refresh progress (incl. daily reps) whenever Daily is shown again.
  useLayoutEffect(() => {
    if (pathname === '/daily' && !loading) void refreshProgress()
  }, [pathname, loading, refreshProgress])

  useEffect(() => {
    if (!loading && pathname === '/daily') {
      const prev = prevPathRef.current
      prevPathRef.current = pathname
      if (prev !== null && prev !== '/daily') {
        void refreshProgress()
        void refreshDue()
        if (activePlanMode === 'random') {
          void syncStreakActivityFromGoals(activePlanMode).catch(() => {/* silent */})
        }
      }
    } else if (pathname !== '/daily') {
      prevPathRef.current = pathname
    }
  }, [pathname, loading, refreshProgress, refreshDue, activePlanMode])

  useEffect(() => {
    if (pathname !== '/daily') return

    const syncFromDb = () => {
      if (!loading) {
        void refreshProgress()
        void refreshDue()
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') syncFromDb()
    }

    window.addEventListener(DAILY_REPS_CHANGED, syncFromDb)
    window.addEventListener('focus', syncFromDb)
    window.addEventListener('popstate', syncFromDb)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', syncFromDb)
    return () => {
      window.removeEventListener(DAILY_REPS_CHANGED, syncFromDb)
      window.removeEventListener('focus', syncFromDb)
      window.removeEventListener('popstate', syncFromDb)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', syncFromDb)
    }
  }, [loading, pathname, refreshProgress, refreshDue])

  // ── Slacking email: fire once when past-day catch-up debt exists ─────────────
  // Only for strict mode. Guards with localStorage so we send at most once per
  // stuck day index — prevents spam if the user keeps opening the page.
  // Do NOT email just because today's calendar day is unfinished — that showed
  // as "1 day behind" next to Past Days that were already complete.
  useEffect(() => {
    if (loading || isRandomMode || !plan) return
    const info = getTodayInfo(plan, allQuestions, progress, dailyReps, repsPerQ)
    if (info.pending || info.complete || !info.dayNumber) return
    const activeDayIdx = info.dayNumber - 1
    let incompletePast = 0
    for (let i = 0; i < activeDayIdx; i++) {
      const ids = plan.question_order.slice(i * plan.per_day, (i + 1) * plan.per_day)
      if (!isPlanDayComplete(i, ids, progress, calendarDayIndex, todayISO(), dailyReps, repsPerQ, plan.start_date)) {
        incompletePast++
      }
    }
    if (incompletePast === 0) return
    const key = `lm_slacking_notified_${activeDayIdx}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    fetch('/api/notify-slacking', { method: 'POST' }).catch(() => {})
  }, [loading, isRandomMode, plan, allQuestions, progress, calendarDayIndex, dailyReps, repsPerQ])

  const { days: previewDays, date: previewFinish } = calcFinish(startDate, perDay, allQuestions.length)

  async function handleGenerate() {
    if (!planCode.trim()) return
    setGenerating(true)
    // For random mode the order is still generated (full pool), just not used day-by-day.
    // Diff-first: all Easys across all patterns → all Mediums → all Hards.
    const order = studyOrder(allQuestions)
    const newPlan: StudyPlan = {
      start_date: startDate,
      per_day: perDay,
      question_order: order,
      lock_code: planCode.trim(),
    }
    const [planOk] = await Promise.all([
      saveStudyPlan({ ...newPlan, mode: setupMode, review_start_days: setupReviewStartDays }),
      // Save email + review settings alongside plan creation
      fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: setupEmailEnabled,
          timezone: setupTimezone,
          reviewStartDays: setupReviewStartDays,
          revisionCap: setupRevisionCap,
          repsPerQ: setupRepsPerQ,
        }),
      }).catch(() => null),
    ])
    setGenerating(false)
    if (planOk) {
      localStorage.setItem(PLAN_MODE_KEY, setupMode)
      // Persist reps-per-question choice
      localStorage.setItem(REPS_PER_Q_KEY, String(setupRepsPerQ))
      setRepsPerQ(setupRepsPerQ)
      repsPerQRef.current = setupRepsPerQ
      setActivePlanMode(setupMode)
      setPlan(newPlan)
      toast.success('Study plan created!')
    } else {
      toast.error('Failed to save plan — check Supabase RLS policies.')
    }
  }

  async function handleChangePace() {
    const val = Math.max(1, Math.min(50, parseInt(newPerDayStr) || newPerDay))
    if (!plan || val < 1 || val > 50) return
    setSavingPace(true)
    const ok = await saveStudyPlan({ ...plan, per_day: val, mode: activePlanMode })
    if (ok) {
      setPlan({ ...plan, per_day: val })
      setShowChangePace(false)
      toast.success(`Pace updated to ${val}/day!`)
    } else {
      toast.error('Failed to update pace.')
    }
    setSavingPace(false)
  }

  async function handleResetConfirm() {
    if (!plan) return
    if (resetAttempt.trim() === plan.lock_code) {
      await clearStudyPlan()
      setPlan(null)
      setShowResetPrompt(false)
      toast.success('Plan reset!')
    } else {
      setResetError(true)
      setTimeout(() => setResetError(false), 2000)
    }
  }

  function getQById(id: number) {
    return allQuestions.find(q => q.id === id)
  }

  function isSolved(id: number) {
    return !!progress[String(id)]?.solved
  }

  /** Learn progress only — does not mean today's Daily block is done. */
  function isLearned(id: number) {
    return isSolved(id)
  }

  /**
   * Was this question done as a daily for its plan day (on schedule or catch-up)?
   * Independent of Learn `solved` — Past Days uses this for green Daily badges.
   * Requires real daily reps (≥ repsPerQ); Learn alone never fills this.
   */
  function isDailyDoneForPlanDay(dayIdx: number, id: number) {
    if (!plan || dayIdx > calendarDayIndex) return false
    const today = todayISO()
    const repsPerQ = repsPerQRef.current
    if (dayIdx === calendarDayIndex) {
      return isQuestionDoneForDailyToday(id, progress, today, dailyReps, repsPerQ)
    }
    // Deep past: Learn solved is enough so old history stays quiet
    if (dayIdx < calendarDayIndex - RECENT_PLAN_DAY_WINDOW && isSolved(id)) {
      return true
    }
    const scheduledDate = dayScheduledISO(plan.start_date, dayIdx)
    return hasCompletedDailyRepsOnOrAfter(id, scheduledDate, progress, today, dailyReps, repsPerQ)
  }

  /**
   * Was a past day completed as a proper daily session on its scheduled date?
   * Uses daily_rep_* on that date (not Learn, not bare last_daily_done).
   */
  function wasDayDoneAsDaily(dayIdx: number): boolean {
    if (!plan) return false
    if (dayIdx >= calendarDayIndex) return false
    const scheduledDate = dayScheduledISO(plan.start_date, dayIdx)
    const dayIds = plan.question_order.slice(dayIdx * plan.per_day, (dayIdx + 1) * plan.per_day)
    if (dayIds.length === 0) return true
    const repsPerQ = repsPerQRef.current
    return dayIds.every(id => {
      const row = progress[String(id)]
      const repDate = normalizeRepDate(row?.daily_rep_date)
      const repCount = row?.daily_rep_count ?? 0
      return repDate === scheduledDate && repCount >= repsPerQ
    })
  }

  function countDailyDoneOnPlanDay(dayIdx: number, questionIds: number[]) {
    return questionIds.filter(id => isDailyDoneForPlanDay(dayIdx, id)).length
  }

  /**
   * Questions from missed past days not yet cleared via daily (today or prior catch-up).
   * Learn solved does not clear these — only real daily reps do.
   */
  const pushedForwardIds = useMemo((): number[] => {
    if (!plan || isRandomMode) return []
    return getPushedCatchUpQuestionIds(plan, progress, {
      dailyReps,
      repsPerQ: repsPerQRef.current,
      today: todayISO(),
    })
  }, [plan, calendarDayIndex, progress, dailyReps, isRandomMode])

  function isStarred(id: number) {
    return !!progress[String(id)]?.starred
  }

  function setFocusPatternPersist(name: string | null) {
    setFocusPattern(name)
    if (name) localStorage.setItem(FOCUS_PATTERN_KEY, name)
    else localStorage.removeItem(FOCUS_PATTERN_KEY)
  }

  function toggleStar(id: number) {
    const n = !isStarred(id)
    setProgress(prev => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], starred: n },
    }))
    updateProgress(id, { starred: n })
  }

  // ── Rep helpers ─────────────────────────────────────────────────────────────
  function getDailyRep(id: number) {
    return getDailyRepCount(id, progress, todayISO(), dailyReps)
  }
  function isRepDone(id: number) {
    return isQuestionDoneForDailyToday(id, progress, todayISO(), dailyReps, repsPerQRef.current)
  }

  function getSetDailyRep(id: number, set: 2 | 3) {
    const reps = set === 2 ? set2DailyReps : set3DailyReps
    return reps[String(id)] ?? 0
  }
  function isSetRepDone(id: number, set: 2 | 3) {
    const reps = set === 2 ? set2DailyReps : set3DailyReps
    return isSetQuestionDoneForDailyToday(id, reps, repsPerQRef.current)
  }
  function isSetLearned(id: number, set: 2 | 3) {
    const prog = set === 2 ? set2Progress : set3Progress
    return !!prog[String(id)]?.solved
  }

  function saveRepsPerQ(n: number) {
    const v = Math.max(1, Math.min(10, n))
    setRepsPerQ(v)
    setSetupRepsPerQ(v)
    repsPerQRef.current = v
    localStorage.setItem(REPS_PER_Q_KEY, String(v))
    void fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repsPerQ: v }),
    }).catch(() => {
      // Local persistence is already updated; silent fail keeps the UI snappy.
    })
  }

  function cycleRepsPerQ() {
    const opts  = [1, 2, 3, 5]
    const idx   = opts.indexOf(repsPerQ)
    saveRepsPerQ(opts[(idx + 1) % opts.length])
  }

  function daysOverdue(nr: string) {
    const [y, m, d] = nr.split('-').map(Number)
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d).getTime()) / 86400000)
    if (diff === 0) return 'due today'
    if (diff === 1) return '1 day overdue'
    return diff + ' days overdue'
  }

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading...</div>

  // SETUP VIEW
  if (!plan) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        {!online && <OfflineBanner feature="Daily plan (Supabase)" />}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚔</div>
          <h1 className="text-2xl font-black text-[var(--text)] mb-1">LeetCode Police</h1>
          <p className="text-[var(--text-subtle)] text-sm">Daily Study Plan — commit to a schedule and stick to it.</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-semibold text-[var(--text-muted)]">Total questions</span>
            <span className="text-2xl font-black text-indigo-600">{allQuestions.length}</span>
          </div>

          {/* Mode selector */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Plan mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSetupMode('strict')}
                className={`flex flex-col items-start px-3 py-3 rounded-xl border-2 text-left transition-colors ${
                  setupMode === 'strict' ? 'border-indigo-500 bg-indigo-50' : 'border-[var(--border)] hover:border-indigo-300'
                }`}
              >
                <span className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">🚔 Strict</span>
                <span className="text-xs text-[var(--text-subtle)] mt-0.5 leading-snug">Fixed daily questions — follow the plan, no skipping</span>
              </button>
              <button
                type="button"
                onClick={() => setSetupMode('random')}
                className={`flex flex-col items-start px-3 py-3 rounded-xl border-2 text-left transition-colors ${
                  setupMode === 'random' ? 'border-purple-500 bg-purple-50' : 'border-[var(--border)] hover:border-purple-300'
                }`}
              >
                <span className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">🎲 Random</span>
                <span className="text-xs text-[var(--text-subtle)] mt-0.5 leading-snug">Pick any topic each day — just hit your daily quota</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Questions per day</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => { setPerDay(n); setPerDayStr(String(n)) }}
                    className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      perDay === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="20"
                  value={perDayStr}
                  onChange={e => setPerDayStr(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(1, Math.min(20, parseInt(perDayStr) || 1))
                    setPerDay(v)
                    setPerDayStr(String(v))
                  }}
                  className="w-16 px-2 py-1.5 border-2 border-[var(--border)] rounded-xl text-sm text-center text-[var(--text)] bg-[var(--bg-input)] focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Reps per question / day</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSetupRepsPerQ(n)}
                    className={`w-12 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      setupRepsPerQ === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-subtle)] mt-1">Practice each question this many times before it counts as done for the day.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                min={todayISO()}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-[var(--border)] rounded-xl text-sm text-[var(--text)] bg-[var(--bg-input)] focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* ── When do reviews start? ── */}
            <div className="border-t border-[var(--border)] pt-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-1">
                <BookOpen size={11} /> When do reviews start?
              </label>
              <p className="text-[11px] text-[var(--text-subtle)] mb-2">After solving a question, when should your first review be scheduled?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[{ days: 14, label: '2 weeks' }, { days: 21, label: '3 weeks' }, { days: 30, label: '1 month' }].map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setSetupReviewStartDays(opt.days)}
                    className={`py-2 rounded-xl border-2 text-sm font-bold transition-colors ${
                      setupReviewStartDays === opt.days
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-violet-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Daily revision limit ── */}
            <div className="border-t border-[var(--border)] pt-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-1">
                <RotateCcw size={11} /> Daily revision limit
              </label>
              <p className="text-[11px] text-[var(--text-subtle)] mb-2">Max spaced-repetition reviews per day (separate from new questions).</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSetupRevisionCap(n)}
                    className={`py-2 rounded-xl border-2 text-sm font-bold transition-colors ${
                      setupRevisionCap === n
                        ? 'border-green-500 bg-green-500/10 text-green-700'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-green-300'
                    }`}
                  >
                    {n} {n === 1 ? 'review' : 'reviews'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Email reminders ── */}
            <div className="border-t border-[var(--border)] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-0.5">
                    <Bell size={11} /> Email reminders
                  </label>
                  {setupEmailEnabled && (
                    <p className="text-[11px] text-[var(--text-subtle)]">
                      Sends daily until your quota is done. Adjust in Settings.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSetupEmailEnabled(v => !v)}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${setupEmailEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${setupEmailEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Plan lock code</label>
              <input
                type="text"
                value={planCode}
                onChange={e => setPlanCode(e.target.value)}
                placeholder="e.g. grind2026"
                className="w-full px-3 py-2.5 border-2 border-[var(--border)] rounded-xl text-sm text-[var(--text)] bg-[var(--bg-input)] focus:outline-none focus:border-indigo-400"
              />
              <p className="text-xs text-[var(--text-subtle)] mt-1">You need this code to reset the plan. Do not forget it.</p>
            </div>
          </div>

          {/* Difficulty-first ordering info — strict mode only */}
          {setupMode === 'strict' && (
            <div className="mt-4 bg-violet-50 border border-violet-200 rounded-xl px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">🎯</span>
                <div>
                  <p className="text-xs font-bold text-violet-700">Difficulty-First Order</p>
                  <p className="text-xs text-violet-600 leading-snug">
                    Round 1 — all <strong>Easy</strong> questions across every pattern · Round 2 — all <strong>Medium</strong> · Round 3 — all <strong>Hard</strong>. Within each round patterns follow priority order.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="mt-4 bg-indigo-50  border border-indigo-200  rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-indigo-600  font-semibold">At {perDay}/day you finish in</span>
              <span className="text-lg font-black text-indigo-700 ">{previewDays} days</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-indigo-500 ">Estimated finish</span>
              <span className="text-sm font-bold text-indigo-700 ">{fmtDate(previewFinish)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-500">Daily practice sessions</span>
              <span className="text-xs font-bold text-indigo-600">{perDay} × {setupRepsPerQ} = {perDay * setupRepsPerQ} reps</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !planCode.trim() || !online}
          className="w-full py-4 bg-indigo-600 text-white font-bold text-base rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Rocket size={18} />
          {generating ? 'Generating...' : !planCode.trim() ? 'Set a lock code to continue' : 'Generate & Lock My Plan'}
        </button>
      </div>
    )
  }

  // ── Active view derived data (plan is guaranteed non-null here) ────────────
  const todayInfo = getTodayInfo(plan, allQuestions, progress, dailyReps, repsPerQ)
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)

  // Build pushed-forward questions from missed past days (deduplicated, not in today's plan)
  const todayPlanIds = new Set((todayInfo.questions || []).map(q => q.id))
  const pushedQs = pushedForwardIds
    .filter(id => !todayPlanIds.has(id))
    .map(id => allQuestions.find(q => q.id === id))
    .filter((q): q is Question => !!q)

  // Catch-ups first, then today's scheduled questions
  const todayQs = [...pushedQs, ...(todayInfo.questions || [])]
  todayQsRef.current = todayQs   // keep ref fresh for incrementRep auto-advance
  const todayDone  = todayQs.filter(q => isRepDone(q.id)).length

  // Rep-based day completion
  const todayRepsDone   = todayQs.filter(q => isRepDone(q.id)).length
  const todayAllRepsDone = todayQs.length > 0 && todayQs.every(q => isRepDone(q.id))
  // First question that still needs more reps (for highlight + auto-advance)
  const nextFocusId = todayQs.find(q => !isRepDone(q.id))?.id ?? null

  // "Days behind" = incomplete plan days that appear under Past Days (before the
  // day currently shown as Today). Do NOT count the active Today day as behind —
  // that wrongly showed "1 day behind" next to Past Days that were already 2/2
  // when the calendar had simply rolled past yesterday's unfinished day.
  let daysBehind = 0
  if (!isRandomMode && todayInfo.dayNumber) {
    const activeDayIdx = todayInfo.dayNumber - 1
    for (let i = 0; i < activeDayIdx; i++) {
      const ids = plan.question_order.slice(i * plan.per_day, (i + 1) * plan.per_day)
      if (!isPlanDayComplete(i, ids, progress, calendarDayIndex, todayISO(), dailyReps, repsPerQ, plan.start_date)) {
        daysBehind++
      }
    }
  }

  // Random mode: day goal met when per_day new questions solved today
  const randomGoalMet = isRandomMode && todayDailyDoneCount >= plan.per_day

  const dailyGoalsOpts = {
    mode: activePlanMode,
    dailyDoneTodayCount: todayDailyDoneCount,
    dailyReps,
    repsPerQ,
  }
  const planForGoals = {
    start_date: plan.start_date,
    per_day: plan.per_day,
    question_order: plan.question_order,
    mode: activePlanMode,
  }
  const dailyBlockDone = isActiveDailyBlockComplete(planForGoals, progress, dailyGoalsOpts)
  const dayComplete = isDayComplete(plan, progress, dueReviews.length, dailyGoalsOpts)

  // Extension: after all Set 1 plan days are done, continue Set 2 → Set 3 on the same schedule
  const set1AllDaysComplete = isSet1PlanAllDaysComplete(
    plan.question_order,
    plan.per_day,
    progress,
    calendarDayIndex,
    todayISO(),
    dailyReps,
    repsPerQ,
    plan.start_date,
  )
  const inExtensionMode = set1AllDaysComplete || !!todayInfo.complete
  const extensionPhases = buildExtensionPhases(
    set2Questions,
    set3Questions,
    set2Progress,
    set3Progress,
    plan.per_day,
    totalDays,
  )
  const grandTotalDays = getGrandTotalDays(totalDays, extensionPhases)
  const activeExtensionPhase = inExtensionMode
    ? getActiveExtensionPhase(
        extensionPhases,
        plan.per_day,
        calendarDayIndex,
        set2DailyReps,
        set3DailyReps,
        repsPerQ,
      )
    : null
  const extensionSet = activeExtensionPhase?.set ?? null
  const extensionActiveDay = activeExtensionPhase
    ? findActiveExtensionDay(
        activeExtensionPhase,
        plan.per_day,
        calendarDayIndex,
        extensionSet === 2 ? set2DailyReps : set3DailyReps,
        repsPerQ,
      )
    : null
  const extensionQsToday: SetQuestion[] = extensionActiveDay
    ? extensionActiveDay.questionIds
        .map(id => activeExtensionPhase!.questions.find(q => q.id === id))
        .filter(Boolean) as SetQuestion[]
    : []
  const extensionBlockDone = !activeExtensionPhase || extensionQsToday.length === 0 ||
    (extensionSet !== null && extensionQsToday.every(q => isSetRepDone(q.id, extensionSet)))
  const extensionRepsDone = extensionSet !== null
    ? extensionQsToday.filter(q => isSetRepDone(q.id, extensionSet)).length
    : 0
  const extensionNextFocusId = extensionSet !== null
    ? (extensionQsToday.find(q => !isSetRepDone(q.id, extensionSet))?.id ?? null)
    : null
  const extensionPool = activeExtensionPhase
    ? activeExtensionPhase.questions.filter(q => !activeExtensionPhase.progress[String(q.id)]?.solved)
    : []
  const totalDueCount = dueReviews.length + set2DueReviews.length + set3DueReviews.length
  const effectiveDayComplete = activeExtensionPhase
    ? extensionBlockDone && totalDueCount === 0
    : dayComplete
  const effectiveDailyBlockDone = activeExtensionPhase ? extensionBlockDone : dailyBlockDone
  const extTotalCount = activeExtensionPhase?.questions.length ?? 0
  const extSolvedCount = activeExtensionPhase
    ? activeExtensionPhase.questions.filter(q => activeExtensionPhase.progress[String(q.id)]?.solved).length
    : 0
  const globalTodayDayIdx = activeExtensionPhase && extensionActiveDay
    ? activeExtensionPhase.startDayIndex + extensionActiveDay.dayIndex
    : (todayInfo.dayNumber ?? 1) - 1
  const allSetsComplete = inExtensionMode && !activeExtensionPhase

  const progressPct = isRandomMode
    ? Math.round((totalSolved / Math.max(allQuestions.length, 1)) * 100)
    : Math.round(((globalTodayDayIdx + 1) / Math.max(grandTotalDays, 1)) * 100)

  function launchDailyQuestion(qid: number) {
    const strictQueue = todayQs.map(q => q.id)
    const randomQueue = [qid, ...randomFocusQs.filter(q => q.id !== qid).map(q => q.id)].slice(0, plan!.per_day)
    const queue = isRandomMode ? randomQueue : strictQueue
    try {
      sessionStorage.setItem(DAILY_QUEUE_KEY, JSON.stringify(queue))
    } catch {
      // Ignore storage issues and still navigate.
    }
    router.push(`/practice/${qid}?from=daily`)
  }

  function launchSetDailyQuestion(qid: number, set: 2 | 3, queueIds: number[]) {
    try {
      sessionStorage.setItem(dailyQueueKey(set), JSON.stringify(queueIds))
    } catch {
      // Ignore storage issues and still navigate.
    }
    router.push(practiceDailyHref(qid, set))
  }

  const dailyListItems = todayQs.map(q => (
    <button
      key={q.id}
      type="button"
      onClick={() => {
        launchDailyQuestion(q.id)
        setShowList(false)
      }}
      className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-muted)] border-b border-[var(--border-soft)] transition-colors"
    >
      <span className="shrink-0 tabular-nums text-xs font-mono text-[var(--text-subtle)]">#{q.id}</span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{q.title}</span>
      <span
        className={`text-xs font-semibold shrink-0 ${q.difficulty === 'Easy' ? 'text-green-600' : q.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
      >
        {q.difficulty[0]}
      </span>
      {isRepDone(q.id) && <CheckCircle2 size={11} className="text-green-400 shrink-0" aria-label="Daily done" />}
      {isLearned(q.id) && <CheckCircle2 size={11} className="text-indigo-400 shrink-0" aria-label="Learn solved" />}
    </button>
  ))
  const pastDayCount = todayInfo.dayNumber ? todayInfo.dayNumber - 1 : totalDays
  const PAST_DAYS_INITIAL = 7
  const displayPast = pastDaysShowAll ? pastDayCount : Math.min(PAST_DAYS_INITIAL, pastDayCount)
  const hasMorePastToReveal = pastDayCount > PAST_DAYS_INITIAL

  // Upcoming days preview — includes Set 2/3 after Set 1
  const todayDayIdx = !isRandomMode && (todayInfo.dayNumber || activeExtensionPhase) ? globalTodayDayIdx : -1
  const futureDayCount = todayDayIdx >= 0 ? grandTotalDays - (todayDayIdx + 1) : 0
  const safePreviewOffset = Math.min(previewOffset, Math.max(0, futureDayCount - 1))
  const previewGlobalDayIdx = todayDayIdx + 1 + safePreviewOffset
  const previewScheduleDay = futureDayCount > 0
    ? resolveScheduleDay(previewGlobalDayIdx, totalDays, extensionPhases)
    : null
  const previewQuestionIds = previewScheduleDay
    ? questionIdsForScheduleDay(previewScheduleDay, plan.question_order, plan.per_day)
    : []
  const previewQuestions: Array<Question | SetQuestion> = previewScheduleDay
    ? previewQuestionIds.map(id => {
        if (previewScheduleDay.kind === 'set1') {
          return allQuestions.find(q => q.id === id)
        }
        return previewScheduleDay.phase.questions.find(q => q.id === id)
      }).filter(Boolean) as Array<Question | SetQuestion>
    : []
  const previewSetLabel = previewScheduleDay?.kind === 'extension'
    ? `Set ${previewScheduleDay.phase.set}`
    : 'Set 1'

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="Daily plan (Supabase)" />}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-[var(--text)] flex flex-wrap items-center gap-2">
            Study Plan
            {isRandomMode && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">🎲 Random</span>
            )}
          </h1>
          {!todayInfo.pending && !allSetsComplete && (todayInfo.dayNumber || activeExtensionPhase) && (
            <p className="text-xs text-[var(--text-subtle)] mt-0.5">
              {isRandomMode
                ? `Day ${todayInfo.dayNumber} · ${totalSolved}/${allQuestions.length} solved · ${plan.per_day}/day goal`
                : activeExtensionPhase
                  ? `Day ${globalTodayDayIdx + 1} of ${grandTotalDays} · Set ${activeExtensionPhase.set} · ${extensionPool.length} new left`
                  : `Day ${todayInfo.dayNumber} of ${grandTotalDays} · finish by ${fmtDate(todayInfo.finishDate || '')}`
              }
            </p>
          )}
          {todayInfo.pending && (
            <p className="text-xs text-amber-500 mt-0.5">
              Starts in {todayInfo.daysUntil} day{todayInfo.daysUntil !== 1 ? 's' : ''} ({fmtDate(todayInfo.startDate || '')})
            </p>
          )}
          {allSetsComplete && (
            <p className="text-xs text-green-500 font-semibold mt-0.5">All sets complete!</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 overflow-visible">
          {todayQs.length > 0 && (
            <div ref={listWrapRef} className="relative z-10">
              <button type="button"
                onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:border-indigo-400 hover:text-indigo-500 transition-colors font-semibold"
              >
                <List size={12} />
                Today&apos;s Qs
              </button>
              {showList && (
                <>
                  <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                  <div className={listDropdownMobilePanelClasses('right')}>{dailyListItems}</div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onPointerDown={cycleRepsPerQ}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-subtle)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
            title="Tap to cycle reps per question"
          >
            Reps: {repsPerQ}×
          </button>
          <button
            onClick={() => { setShowChangePace(v => !v); setNewPerDay(plan.per_day); setNewPerDayStr(String(plan.per_day)) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-subtle)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
          >
            Pace: {plan.per_day}/day
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-subtle)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
            title="Review start delay, revision limit, email reminders"
          >
            <Settings size={12} />
          </Link>
          <button
            onClick={() => setShowResetPrompt(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-subtle)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Change pace */}
      {showChangePace && (
        <div className="bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-[var(--text)] mb-1">Change daily pace</p>
          <p className="text-xs text-[var(--text-subtle)] mb-3">Your question order and solved progress stay intact.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={newPerDayStr}
              onChange={e => setNewPerDayStr(e.target.value)}
              onBlur={() => {
                const v = Math.max(1, Math.min(50, parseInt(newPerDayStr) || 1))
                setNewPerDay(v)
                setNewPerDayStr(String(v))
              }}
              onKeyDown={e => e.key === 'Enter' && handleChangePace()}
              className="w-20 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] text-sm focus:outline-none focus:border-indigo-400"
            />
            <span className="text-xs text-[var(--text-subtle)]">questions/day</span>
            <button onClick={handleChangePace} disabled={savingPace}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {savingPace ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowChangePace(false)}
              className="px-4 py-2 bg-[var(--bg-card)] text-[var(--text-muted)] text-sm font-bold rounded-lg border border-[var(--border)] hover:brightness-110 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reset gate */}
      {showResetPrompt && (
        <div className="bg-red-50  border border-red-200  rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-red-700 mb-1">Enter your plan lock code to reset</p>
          <p className="text-xs text-red-500 mb-3">This will wipe the entire plan. Your solved progress is safe.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={resetAttempt}
              onChange={e => { setResetAttempt(e.target.value); setResetError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleResetConfirm()}
              placeholder="Your lock code"
              autoFocus
              className={`px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors ${
                resetError ? 'border-red-500 bg-red-100  text-[var(--text)]' : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)]'
              }`}
            />
            <button onClick={handleResetConfirm} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
              Confirm Reset
            </button>
            <button onClick={() => setShowResetPrompt(false)} className="px-4 py-2 bg-[var(--bg-muted)] text-[var(--text-muted)] text-sm font-bold rounded-lg hover:brightness-110 transition-colors">
              Cancel
            </button>
            {resetError && <span className="text-red-600 text-xs font-semibold">Wrong code</span>}
          </div>
        </div>
      )}

      {/* Breather banners */}
      {breathers.map(b => (
        <div
          key={b.name}
          className="bg-emerald-50  border border-emerald-200  rounded-xl p-4 mb-4 flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-100  flex items-center justify-center shrink-0 mt-0.5">
            <Wind size={15} className="text-emerald-600 " />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-emerald-800 ">
              Breather — {b.name} (Day {b.day} of 2)
            </p>
            <p className="text-xs text-emerald-700  mt-0.5 mb-2">
              You finished all <span className="font-semibold">{b.name}</span> questions! Spend today revising — re-read solutions and trace through edge cases before moving on.
            </p>
            <Link
              href={`/learn/0?tags=${encodeURIComponent((QUICK_PATTERNS.find(p => p.name === b.name)?.tags[0]) ?? b.name)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <ArrowRight size={12} /> Revise {b.name}
            </Link>
          </div>
        </div>
      ))}

      {/* Day complete / daily done banners */}
      {!todayInfo.pending && effectiveDayComplete && (
        <div className="mb-4 rounded-xl border border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-center shadow-sm">
          <p className="text-base font-black text-green-700">Done for the day! 🎉</p>
          <p className="mt-1 text-xs text-green-600">
            Daily questions finished{totalDueCount > 0 ? ' and reviews cleared' : ''} — streak counts for today.
          </p>
        </div>
      )}
      {!todayInfo.pending && !effectiveDayComplete && effectiveDailyBlockDone && totalDueCount > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-indigo-800">
            Daily done — finish {totalDueCount} review{totalDueCount !== 1 ? 's' : ''} to complete today.
          </p>
          <Link
            href="/review"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            Open reviews <ArrowRight size={12} />
          </Link>
        </div>
      )}
      {!todayInfo.pending && !effectiveDayComplete && effectiveDailyBlockDone && totalDueCount === 0 && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-sm font-bold text-green-700">Daily complete — no reviews due. You&apos;re done for today! 🎉</p>
        </div>
      )}

      {/* Progress bar */}
      {!todayInfo.pending && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 mb-4">
          {isRandomMode ? (
            <>
              <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)] mb-2">
                <span>{totalSolved}/{allQuestions.length} questions solved</span>
                <span className="text-purple-600">{progressPct}%</span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Today's quota mini-bar */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-[var(--text-subtle)] shrink-0">Today:</span>
                <div className="flex-1 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${randomGoalMet ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, Math.round((todayDailyDoneCount / plan.per_day) * 100))}%` }}
                  />
                </div>
                <span className={`text-xs font-bold shrink-0 ${randomGoalMet ? 'text-green-600' : 'text-amber-600'}`}>
                  {todayDailyDoneCount}/{plan.per_day}
                  {randomGoalMet ? ' ✓' : ''}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)] mb-2">
                <span>
                  {allSetsComplete
                    ? 'All sets complete!'
                    : activeExtensionPhase
                      ? `Day ${globalTodayDayIdx + 1}/${grandTotalDays} · Set ${activeExtensionPhase.set}`
                      : `${todayInfo.dayNumber ?? 0}/${grandTotalDays} days`}
                </span>
                <span className="text-indigo-600">{progressPct}%</span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-subtle)] mt-2">
                <span>{fmtDate(plan.start_date)}</span>
                <span>{grandTotalDays - (globalTodayDayIdx + 1)} days left</span>
                <span>{dayScheduledDate(plan.start_date, grandTotalDays - 1)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Extension set progress bar */}
      {extensionSet !== null && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 mb-4">
          <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)] mb-2">
            <span>Set {extensionSet} · {extensionSet === 2 ? 'NeetCode 250' : 'AlgoMaster 600'}</span>
            <span className={extensionSet === 2 ? 'text-emerald-600' : 'text-purple-600'}>
              {extSolvedCount}/{extTotalCount} solved
            </span>
          </div>
          <div className="w-full h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${extensionSet === 2 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-purple-500 to-fuchsia-500'}`}
              style={{ width: `${extTotalCount > 0 ? Math.round((extSolvedCount / extTotalCount) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-[var(--text-subtle)]">
            {extensionPool.length} remaining · Set 1 complete 🎉
          </div>
        </div>
      )}

      {/* TODAY'S QUESTIONS — random mode: pattern picker + pool */}
      {!todayInfo.pending && !todayInfo.complete && todayInfo.dayNumber && isRandomMode && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--text)] text-sm flex items-center gap-2">
              <CalendarCheck size={15} className="text-purple-500" />
              Today — Day {todayInfo.dayNumber}
              <span className="text-xs font-normal text-[var(--text-subtle)]">· {fmtDate(todayISO())}</span>
            </h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              randomGoalMet ? 'bg-green-100 text-green-700' :
              todayDailyDoneCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {todayDailyDoneCount}/{plan.per_day} today
            </span>
          </div>

          {randomGoalMet && !dayComplete && dueReviews.length > 0 && (
            <div className="mb-4 text-center text-indigo-700 font-bold text-sm bg-indigo-50 border border-indigo-200 rounded-xl py-2">
              🎉 Daily quota hit — clear reviews to finish the day.
            </div>
          )}
          {randomGoalMet && dayComplete && (
            <div className="mb-4 text-center text-green-600 font-bold text-sm bg-green-50 border border-green-200 rounded-xl py-2">
              🎉 Done for the day — quota and reviews complete!
            </div>
          )}

          {/* Pattern focus tabs */}
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Focus on a pattern:</p>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {ORDERED_QUICK_PATTERNS.map(p => {
              const unsolved = unsolvedByPattern[p.name] ?? 0
              const active = focusPattern === p.name
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setFocusPatternPersist(active ? null : p.name)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-purple-600 text-white border-purple-600'
                      : unsolved === 0
                        ? 'bg-green-50 text-green-600 border-green-200 line-through opacity-60'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-purple-400'
                  }`}
                >
                  {p.name}
                  <PriorityBadge pattern={p.name} active={active} />
                  {unsolved > 0 && <span className={`ml-0.5 ${active ? 'text-purple-200' : 'text-[var(--text-subtle)]'}`}>({unsolved})</span>}
                </button>
              )
            })}
          </div>

          {/* Questions for the focused pattern */}
          {focusPattern ? (
            <div className="space-y-2">
              {randomFocusQs.length === 0 ? (
                <p className="text-xs text-[var(--text-subtle)] text-center py-4">No questions in this pattern.</p>
              ) : (
                randomFocusQs.map(q => {
                  const solved   = isSolved(q.id)
                  const repCount = getDailyRep(q.id)
                  const repDone  = repCount >= repsPerQ
                  return (
                    <div
                      key={q.id}
                      className={`flex flex-col items-start gap-3 p-3 rounded-xl border transition-colors sm:flex-row sm:items-center ${
                        repDone ? 'bg-green-50 border-green-200' : solved ? 'bg-green-50 border-green-200 opacity-70' : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-purple-400/60'
                      }`}
                    >
                      <div className="shrink-0">
                        {repDone ? <CheckCircle2 size={18} className="text-green-500" /> : solved ? <CheckCircle2 size={18} className="text-indigo-400" /> : <Circle size={18} className="text-[var(--text-subtle)]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                          <span className={`text-sm font-semibold truncate ${repDone ? 'text-green-600 line-through' : 'text-[var(--text)]'}`}>
                            {q.title}
                          </span>
                          <a href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors" onClick={e => e.stopPropagation()}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <DifficultyBadge difficulty={q.difficulty} />
                          <RepDots done={repCount} total={repsPerQ} complete={repDone} />
                          <span className={`text-[10px] font-bold ${repDone ? 'text-green-600' : repCount > 0 ? 'text-purple-500' : 'text-[var(--text-subtle)]'}`}>
                            {Math.min(repCount, repsPerQ)}/{repsPerQ}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => launchDailyQuestion(q.id)}
                        className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                          repDone
                            ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {repDone ? <><RotateCcw size={11} /> Extra</> : <>Solve <ArrowRight size={12} /></>}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-subtle)] text-center py-6">
              Pick a pattern above to see its questions
            </p>
          )}
        </div>
      )}

      {/* TODAY'S QUESTIONS — strict mode (Set 1 only until all plan days done) */}
      {!todayInfo.pending && !set1AllDaysComplete && !todayInfo.complete && todayInfo.dayNumber && !isRandomMode && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="min-w-0 font-bold text-[var(--text)] text-sm flex items-center gap-2">
              <CalendarCheck size={15} className="text-indigo-500" />
              Today — Day {todayInfo.dayNumber}
              <span className="text-xs font-normal text-[var(--text-subtle)]">· {fmtDate(todayISO())}</span>
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`shrink-0 text-[11px] sm:text-xs font-bold px-2 py-1 rounded-full ${
                todayAllRepsDone ? 'bg-green-100 text-green-700' :
                todayRepsDone > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>
                {todayRepsDone}/{todayQs.length} daily
              </span>
              {pushedQs.length > 0 && (
                <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                  +{pushedQs.length} pushed
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-subtle)] mb-3">
            <span className="text-green-600 font-semibold">Daily ✓</span> = today&apos;s reps done
            {' · '}
            <span className="text-indigo-500 font-semibold">Learn ✓</span> = marked solved on Learn
            {pushedQs.length > 0 && <>{' · '}<span className="text-amber-600 font-semibold">⚠️ {pushedQs.length} catch-up</span> from missed days</>}
          </p>

          <div className="space-y-3">
            {todayQs.map((q, idx) => {
              const learned   = isLearned(q.id)
              const repCount  = getDailyRep(q.id)
              const repDone   = isRepDone(q.id)
              const isFocus   = q.id === nextFocusId
              const topic     = topicMap[q.id] ?? 'Other'
              const curPri    = PATTERN_PRIORITY[topic] ?? null
              const prev      = idx > 0 ? todayQs[idx - 1] : null
              const prevTopic = prev ? (topicMap[prev.id] ?? 'Other') : null
              const prevPri   = prevTopic ? (PATTERN_PRIORITY[prevTopic] ?? null) : null
              const showRound = curPri && isNewRound(curPri, q.difficulty, prevPri, prev?.difficulty)
              const isPushed  = pushedQs.some(pq => pq.id === q.id)
              return (
                <div key={q.id}>
                  {showRound && <StudyRoundHeader priority={curPri!} difficulty={q.difficulty} />}
                  <div
                    ref={el => { questionRefs.current[q.id] = el }}
                    className={`flex flex-col items-start gap-3 sm:flex-row sm:items-center p-3 rounded-xl border transition-all mt-2 ${
                      repDone
                        ? 'bg-green-50 border-green-200'
                        : isFocus
                          ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-200/50'
                          : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-indigo-400/50'
                    }`}
                  >
                    <div className="shrink-0">
                      {repDone
                        ? <CheckCircle2 size={20} className="text-green-500" />
                        : learned
                          ? <CheckCircle2 size={20} className="text-indigo-400" />
                          : <Circle size={20} className="text-[var(--text-subtle)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                        <span className={`text-sm font-semibold truncate ${repDone ? 'text-green-600 line-through' : 'text-[var(--text)]'}`}>
                          {q.title}
                        </span>
                        <a
                          href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors"
                          title="Open on LeetCode"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <DifficultyBadge difficulty={q.difficulty} />
                        <PriorityBadge pattern={topic} />
                        <RepDots done={repCount} total={repsPerQ} complete={repDone} />
                        <span className={`text-[10px] font-bold ${repDone ? 'text-green-600' : repCount > 0 ? 'text-indigo-500' : 'text-[var(--text-subtle)]'}`}>
                          {Math.min(repCount, repsPerQ)}/{repsPerQ}
                        </span>
                        {isPushed && !repDone && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">⚠️ catch-up</span>
                        )}
                        {repDone && (
                          <span className="text-[10px] font-semibold text-green-600">Daily ✓</span>
                        )}
                        {learned && (
                          <span className="text-[10px] font-semibold text-indigo-500">Learn ✓</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchDailyQuestion(q.id)}
                      className={`w-full sm:w-auto shrink-0 justify-center flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        repDone
                          ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                          : isFocus
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {repDone ? <><RotateCcw size={11} /> Extra</> : <>Solve <ArrowRight size={12} /></>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {dailyBlockDone && !dayComplete && dueReviews.length > 0 && (
            <div className="mt-4 text-center text-indigo-600 font-bold text-sm">
              Daily questions done — finish reviews to complete today.
            </div>
          )}
          {dayComplete && todayQs.length > 0 && (
            <div className="mt-4 text-center text-green-500 font-bold text-sm">
              🎉 Done for the day! See you tomorrow.
            </div>
          )}

        </div>
      )}

      {/* REVIEWS DUE */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl mb-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setDueOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-indigo-600" />
            <span className="text-sm font-bold text-indigo-700">
              {totalDueCount > 0
                ? `Reviews due — ${totalDueCount} question${totalDueCount > 1 ? 's' : ''}`
                : 'No reviews due today ✓'}
              {totalReviewCatchUpCount > 0 && (
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                  +{totalReviewCatchUpCount} catch-up
                </span>
              )}
            </span>
          </div>
          {dueOpen ? <ChevronUp size={15} className="text-indigo-400" /> : <ChevronDown size={15} className="text-indigo-400" />}
        </button>
        {dueOpen && (
          <div className="px-4 pb-3">
            {totalDueCount === 0 ? (
              <p className="text-xs text-indigo-500">You&apos;re all caught up — no spaced repetition reviews due.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {totalReviewCatchUpCount > 0 && (
                  <p className="text-[10px] text-amber-700 font-semibold">
                    ⚠️ {totalReviewCatchUpCount} review catch-up{totalReviewCatchUpCount > 1 ? 's' : ''} rolled forward from missed days
                  </p>
                )}
                <ReviewCatchUpBox
                  setLabel="Set 1 · Main"
                  accent="indigo"
                  items={set1CarriedReviews.map(q => {
                    const LEGACY_ID_REMAP: Record<number, number> = { 1086: 1133 }
                    const displayId = LEGACY_ID_REMAP[q.id] ?? q.id
                    return {
                      id: q.id,
                      displayId,
                      title: allQuestions.find(x => x.id === displayId)?.title ?? `#${displayId}`,
                      review_count: q.review_count,
                      next_review: q.next_review,
                    }
                  })}
                  hrefFor={id => `/practice/${id}?from=review`}
                  daysOverdue={daysOverdue}
                  hubHref="/review"
                  hubLabel="Open Set 1 reviews"
                />
                <ReviewCatchUpBox
                  setLabel="Set 2 · NeetCode 250"
                  accent="emerald"
                  items={set2CarriedReviews.map(q => ({
                    id: q.id,
                    title: q.title,
                    review_count: q.review_count,
                    next_review: q.next_review,
                  }))}
                  hrefFor={id => practiceReviewHref(id, 2)}
                  daysOverdue={daysOverdue}
                  hubHref="/review?tab=sr-set2"
                  hubLabel="Open Set 2 reviews"
                />
                <ReviewCatchUpBox
                  setLabel="Set 3 · AlgoMaster 600"
                  accent="purple"
                  items={set3CarriedReviews.map(q => ({
                    id: q.id,
                    title: q.title,
                    review_count: q.review_count,
                    next_review: q.next_review,
                  }))}
                  hrefFor={id => practiceReviewHref(id, 3)}
                  daysOverdue={daysOverdue}
                  hubHref="/review?tab=sr-set3"
                  hubLabel="Open Set 3 reviews"
                />
                {/* Set 1 reviews — today's batch */}
                {set1NaturalReviews.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Set 1 · Today&apos;s reviews</p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/review"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 hover:border-indigo-400 hover:shadow-sm transition-all"
                      >
                        Open reviews <ArrowRight size={12} />
                      </Link>
                      {set1NaturalReviews.map(q => (
                        <Link key={q.id} href={`/practice/${q.id}?from=review`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs hover:border-indigo-400 hover:shadow-sm transition-all text-left">
                          <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
                          <span className="text-indigo-400 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {/* Set 2 reviews — today's batch */}
                {set2NaturalReviews.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">Set 2 · Today&apos;s reviews</p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/review?tab=sr-set2"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 hover:border-emerald-400 hover:shadow-sm transition-all">
                        Open Set 2 <ArrowRight size={12} />
                      </Link>
                      {set2NaturalReviews.map(q => (
                          <Link key={q.id} href={practiceReviewHref(q.id, 2)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs hover:border-emerald-400 hover:shadow-sm transition-all text-left">
                            <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
                            <span className="text-emerald-600 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
                          </Link>
                      ))}
                    </div>
                  </div>
                )}
                {/* Set 3 reviews — today's batch */}
                {set3NaturalReviews.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1.5">Set 3 · Today&apos;s reviews</p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/review?tab=sr-set3"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-purple-700 hover:border-purple-400 hover:shadow-sm transition-all">
                        Open Set 3 <ArrowRight size={12} />
                      </Link>
                      {set3NaturalReviews.map(q => (
                          <Link key={q.id} href={practiceReviewHref(q.id, 3)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs hover:border-purple-400 hover:shadow-sm transition-all text-left">
                            <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
                            <span className="text-purple-600 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
                          </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PENDING */}
      {todayInfo.pending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold text-amber-800 text-sm">Plan starts on {fmtDate(todayInfo.startDate || '')}</p>
          <p className="text-xs text-amber-600 mt-1">Come back then and your questions will be waiting.</p>
        </div>
      )}

      {/* COMPLETE — only shown when all three sets are done */}
      {allSetsComplete && (
        <div className="bg-green-50  border border-green-200  rounded-xl p-5 mb-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="font-bold text-green-700">
            {set2Questions.length > 0 || set3Questions.length > 0
              ? 'All sets complete! Incredible work!'
              : `You finished all ${plan.question_order.length} questions!`}
          </p>
          <button
            onClick={async () => { await clearStudyPlan(); setPlan(null) }}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            Start New Plan
          </button>
        </div>
      )}

      {/* EXTENSION: Set 2/3 daily questions after Set 1 plan days are complete */}
      {activeExtensionPhase && extensionSet !== null && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-[var(--text)] text-sm flex items-center gap-2">
              <CalendarCheck size={15} className={extensionSet === 2 ? 'text-emerald-500' : 'text-purple-500'} />
              Set {extensionSet} — Day {globalTodayDayIdx + 1}
              <span className="text-xs font-normal text-[var(--text-subtle)]">· {fmtDate(todayISO())}</span>
            </h2>
            <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${
              extensionBlockDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {extensionRepsDone}/{extensionQsToday.length} done
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-subtle)] mb-3">
            Set 1 complete 🎉 · Continuing with Set {extensionSet} · {extensionPool.length} questions remaining
            {' · '}
            <span className="text-green-600 font-semibold">Daily ✓</span> = today&apos;s reps done
            {' · '}
            <span className="text-indigo-500 font-semibold">Learn ✓</span> = marked solved on Learn
          </p>
          <div className="space-y-3">
            {extensionQsToday.map(q => {
              const learned = isSetLearned(q.id, extensionSet!)
              const repCount = getSetDailyRep(q.id, extensionSet!)
              const repDone = isSetRepDone(q.id, extensionSet!)
              const isFocus = q.id === extensionNextFocusId
              return (
                <div key={q.id} className={`flex flex-col items-start gap-3 sm:flex-row sm:items-center p-3 rounded-xl border transition-all ${
                  repDone
                    ? 'bg-green-50 border-green-200'
                    : isFocus
                      ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-200/50'
                      : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-indigo-400/50'
                }`}>
                  <div className="shrink-0">
                    {repDone
                      ? <CheckCircle2 size={20} className="text-green-500" />
                      : learned
                        ? <CheckCircle2 size={20} className="text-indigo-400" />
                        : <Circle size={20} className="text-[var(--text-subtle)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                      <span className={`text-sm font-semibold truncate ${repDone ? 'text-green-600 line-through' : 'text-[var(--text)]'}`}>
                        {q.title}
                      </span>
                      <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <DifficultyBadge difficulty={q.difficulty} />
                      <span className="text-[10px] text-[var(--text-subtle)]">{q.category}</span>
                      <RepDots done={repCount} total={repsPerQ} complete={repDone} />
                      <span className={`text-[10px] font-bold ${repDone ? 'text-green-600' : repCount > 0 ? 'text-indigo-500' : 'text-[var(--text-subtle)]'}`}>
                        {Math.min(repCount, repsPerQ)}/{repsPerQ}
                      </span>
                      {repDone && (
                        <span className="text-[10px] font-semibold text-green-600">Daily ✓</span>
                      )}
                      {learned && (
                        <span className="text-[10px] font-semibold text-indigo-500">Learn ✓</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => launchSetDailyQuestion(q.id, extensionSet!, extensionQsToday.map(x => x.id))}
                    className={`w-full sm:w-auto shrink-0 justify-center flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      repDone
                        ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {repDone
                      ? <><RotateCcw size={11} /> Revisit</>
                      : repCount > 0
                        ? <>Continue <ArrowRight size={12} /></>
                        : <>Solve <ArrowRight size={12} /></>}
                  </button>
                </div>
              )
            })}
          </div>
          {extensionBlockDone && !effectiveDayComplete && totalDueCount > 0 && (
            <div className="mt-4 text-center text-indigo-600 font-bold text-sm">
              Today&apos;s questions done — finish reviews to complete today.
            </div>
          )}
          {effectiveDayComplete && extensionQsToday.length > 0 && (
            <div className="mt-4 text-center text-green-500 font-bold text-sm">
              🎉 Done for the day! See you tomorrow.
            </div>
          )}
        </div>
      )}

      {/* UPCOMING DAYS PREVIEW */}
      {!isRandomMode && !todayInfo.pending && !allSetsComplete && futureDayCount > 0 && previewScheduleDay && previewQuestions.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-[var(--text)] text-sm">Upcoming Days</h2>
              <p className="text-[10px] text-[var(--text-subtle)] mt-0.5">{previewSetLabel}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewOffset(o => Math.max(0, o - 1))}
                disabled={safePreviewOffset === 0}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-mono text-[var(--text-subtle)] min-w-[90px] text-center">
                Day {previewGlobalDayIdx + 1} · {dayScheduledDate(plan.start_date, previewGlobalDayIdx)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewOffset(o => Math.min(futureDayCount - 1, o + 1))}
                disabled={safePreviewOffset >= futureDayCount - 1}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {previewQuestions.map((q, idx) => {
              const learned = previewScheduleDay.kind === 'set1'
                ? isLearned(q.id)
                : !!activeExtensionPhase?.progress[String(q.id)]?.solved
              const pTopic  = previewScheduleDay.kind === 'set1'
                ? (topicMap[q.id] ?? 'Other')
                : null
              const curPri  = pTopic ? (PATTERN_PRIORITY[pTopic] ?? null) : null
              const prev    = idx > 0 ? previewQuestions[idx - 1] : null
              const prevTopic = prev && previewScheduleDay.kind === 'set1'
                ? (topicMap[prev.id] ?? 'Other')
                : null
              const prevPri = prevTopic ? (PATTERN_PRIORITY[prevTopic] ?? null) : null
              const showRound = curPri && isNewRound(curPri, q.difficulty, prevPri, prev?.difficulty)
              const learnHref = previewScheduleDay.kind === 'extension'
                ? dailyHrefForSetQuestion(q.id, previewScheduleDay.phase.set, set2Questions, set3Questions)
                : `/practice/${q.id}`
              return (
                <div key={q.id}>
                  {showRound && <StudyRoundHeader priority={curPri!} difficulty={q.difficulty} className="py-1" />}
                  <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                    {learned
                      ? <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
                      : <Circle size={14} className="text-[var(--text-subtle)] shrink-0" />
                    }
                    <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      <Link href={learnHref} className="text-sm text-[var(--text)] hover:text-indigo-500 break-words">
                        {q.title}
                      </Link>
                      {learned && (
                        <span className="text-[10px] font-semibold text-indigo-500 shrink-0">Solved</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors"
                        title="Open on LeetCode"
                      >
                        <ExternalLink size={11} />
                      </a>
                      <DifficultyBadge difficulty={q.difficulty} />
                      {pTopic && curPri && <PriorityBadge pattern={pTopic} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PAST DAYS — most recent first; default 7 rows, expand for full history */}
      {displayPast > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-bold text-[var(--text)] text-sm">Past Days</h2>
              <p className="text-[11px] text-[var(--text-subtle)] mt-0.5">
                {pastDaysShowAll
                  ? `All ${pastDayCount} completed day${pastDayCount !== 1 ? 's' : ''}`
                  : `Last ${Math.min(PAST_DAYS_INITIAL, pastDayCount)} of ${pastDayCount} · newest first`}
              </p>
            </div>
            {!isRandomMode && !todayInfo.complete && daysBehind > 0 && (
              <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600 border border-red-200">
                ⚠️ {daysBehind} day{daysBehind !== 1 ? 's' : ''} behind
              </span>
            )}
          </div>
          <div className="space-y-2">
            {Array.from({ length: displayPast }, (_, i) => {
              const dayIdx = (todayInfo.dayNumber ? todayInfo.dayNumber - 2 - i : totalDays - 1 - i)
              if (dayIdx < 0) return null
              const { questionIds, questions: dayQs } = getDayInfo(plan, dayIdx, allQuestions, progress)
              const doneCnt = countDailyDoneOnPlanDay(dayIdx, questionIds)
              const expanded = expandedDays[dayIdx]
              const wasMissedOnSchedule = !wasDayDoneAsDaily(dayIdx)
              const catchUpCleared = wasMissedOnSchedule && questionIds.every(id =>
                isCatchUpDailyCleared(id, dayScheduledISO(plan.start_date, dayIdx), progress, todayISO(), dailyReps, repsPerQRef.current)
              )
              const showMissedBanner = wasMissedOnSchedule && !catchUpCleared
              const fullyDoneAsDaily = !wasMissedOnSchedule || catchUpCleared
              return (
                <div key={dayIdx} className={`border rounded-xl overflow-hidden ${showMissedBanner ? 'border-amber-400/40' : 'border-[var(--border)]'}`}>
                  <button
                    onClick={() => setExpandedDays(p => ({ ...p, [dayIdx]: !p[dayIdx] }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-muted)] transition-colors"
                  >
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {showMissedBanner ? '⚠️ ' : ''}Day {dayIdx + 1}
                      <span className="ml-1.5 text-xs font-normal text-[var(--text-subtle)]">· {dayScheduledDate(plan.start_date, dayIdx)}</span>
                      {showMissedBanner && (
                        <span className="ml-2 text-[10px] font-bold text-amber-500">missed · pushed forward</span>
                      )}
                      {catchUpCleared && (
                        <span className="ml-2 text-[10px] font-bold text-green-600">catch-up done</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {fullyDoneAsDaily
                        ? <span className="text-xs font-bold text-green-600">{doneCnt}/{dayQs.length}</span>
                        : <span className="text-xs font-bold text-amber-500">{doneCnt}/{dayQs.length}</span>
                      }
                      {expanded ? <ChevronUp size={14} className="text-[var(--text-subtle)]" /> : <ChevronDown size={14} className="text-[var(--text-subtle)]" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-[var(--border-soft)]">
                      {dayQs.map(q => {
                        const learned = isLearned(q.id)
                        const dailyDone = isDailyDoneForPlanDay(dayIdx, q.id)
                        return (
                        <div key={q.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="flex items-center gap-1" title={dailyDone ? 'Daily done' : 'Daily not done'}>
                              {dailyDone
                                ? <CheckCircle2 size={14} className="text-green-400 shrink-0" aria-label="Daily done" />
                                : <Circle size={14} className="text-[var(--text-subtle)] shrink-0" aria-label="Daily not done" />
                              }
                              <span className="text-[9px] font-bold text-green-600">Daily</span>
                            </span>
                            <span className="flex items-center gap-1" title={learned ? 'Learn done' : 'Learn — tap circle to revise'}>
                              {learned
                                ? <CheckCircle2 size={11} className="text-indigo-400 shrink-0" aria-label="Learn done" />
                                : (
                                  <Link
                                    href={learnHrefForQuestionId(q.id, learnOrderIds, { from: 'daily' })}
                                    className="shrink-0"
                                    aria-label="Learn not done — open in Learn"
                                  >
                                    <Circle size={11} className="text-[var(--text-subtle)] hover:text-indigo-400 transition-colors" />
                                  </Link>
                                )
                              }
                              <span className="text-[9px] font-bold text-indigo-500">Learn</span>
                            </span>
                          </span>
                          <Link
                            href={learnHrefForQuestionId(q.id, learnOrderIds, { from: 'daily' })}
                            className="text-[var(--text)] hover:text-indigo-500 break-words flex-1 min-w-[8rem]"
                          >
                            {q.title}
                          </Link>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--text-subtle)] hover:text-orange-400 transition-colors"
                              title="Open on LeetCode"
                            >
                              <ExternalLink size={11} />
                            </a>
                            <DifficultyBadge difficulty={q.difficulty} />
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {hasMorePastToReveal && (
            <button
              type="button"
              onClick={() => setPastDaysShowAll(v => !v)}
              className="mt-4 w-full py-2.5 text-sm font-semibold text-indigo-600  bg-indigo-50  border border-indigo-100  rounded-xl hover:bg-indigo-100  transition-colors"
            >
              {pastDaysShowAll
                ? 'Show less (last 7 days)'
                : `Show ${pastDayCount - PAST_DAYS_INITIAL} more day${pastDayCount - PAST_DAYS_INITIAL !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

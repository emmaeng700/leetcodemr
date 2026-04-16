'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useClickOutside } from '@/hooks/useClickOutside'
import { CalendarCheck, Rocket, RotateCcw, ArrowRight, CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, List, Brain, Star, Wind } from 'lucide-react'
import { getStudyPlan, saveStudyPlan, clearStudyPlan, getProgress, getDueReviews, rebalanceReviews, updateProgress } from '@/lib/db'
import { getActiveBreathers, type ActiveBreather } from '@/lib/breatherUtils'
import { patternBasedStudyOrder } from '@/lib/studyPlanOrder'
import { QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'

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
}

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

function getTodayInfo(plan: StudyPlan, allQuestions: Question[], progress: Record<string, ProgressData>) {
  const today = todayISO()
  const start = new Date(plan.start_date)
  start.setHours(0, 0, 0, 0)
  const now = new Date(today)
  now.setHours(0, 0, 0, 0)

  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  const finishDate = calcFinish(plan.start_date, plan.per_day, plan.question_order.length).date

  if (diffDays < 0) {
    return { pending: true, daysUntil: -diffDays, startDate: plan.start_date, totalDays, finishDate }
  }

  if (diffDays >= totalDays) {
    return { complete: true, totalDays, finishDate, dayNumber: totalDays, daysLeft: 0 }
  }

  // Stay on the first incomplete day — don't advance by calendar date alone
  let activeDayIndex = diffDays
  for (let i = 0; i <= diffDays; i++) {
    const { questionIds } = getDayInfo(plan, i, allQuestions, progress)
    const allSolved = questionIds.every(id => {
      const p = progress[String(id)]
      return p && p.solved
    })
    if (!allSolved) {
      activeDayIndex = i
      break
    }
  }

  const dayNumber = activeDayIndex + 1
  const daysLeft = totalDays - dayNumber

  const { questionIds, questions } = getDayInfo(plan, activeDayIndex, allQuestions, progress)

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
  const prevPathRef = useRef<string | null>(null)
  const online = useOnlineStatus()
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressData>>({})
  const [dueReviews, setDueReviews] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [dueOpen, setDueOpen] = useState(true)
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  // Setup form
  const [startDate, setStartDate] = useState(todayISO())
  const [perDay, setPerDay] = useState(3)
  const [planCode, setPlanCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [startFromPattern, setStartFromPattern] = useState<string | null>(null)

  // Reset gate
  const [showResetPrompt, setShowResetPrompt] = useState(false)
  const [resetAttempt, setResetAttempt] = useState('')
  const [resetError, setResetError] = useState(false)

  // Change pace
  const [showChangePace, setShowChangePace] = useState(false)
  const [newPerDay, setNewPerDay] = useState(5)
  const [savingPace, setSavingPace] = useState(false)

  // Past days (accordion per day + global “show more” for long plans)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [pastDaysShowAll, setPastDaysShowAll] = useState(false)
  const [showList, setShowList] = useState(false)
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  // Extra days
  const [extraDays, setExtraDays] = useState(0)

  const [breathers, setBreathers] = useState<ActiveBreather[]>([])

  const topicMap = useMemo(() => buildExclusivePatternMap(allQuestions), [allQuestions])

  const refreshProgress = useCallback(async () => {
    try {
      const prog = await getProgress()
      setProgress(prog)
      setBreathers(getActiveBreathers())
    } catch {
      /* ignore */
    }
  }, [])

  const refreshDue = useCallback(async () => {
    try {
      const due = await getDueReviews()
      setDueReviews(due)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function load() {
      // One-time rebalance: if reviews were spread with old small cap (2/4),
      // pull them forward using the current 35/60 cap. Runs once per device.
      const REBALANCE_KEY = 'lm_rebalanced_v1'
      if (!localStorage.getItem(REBALANCE_KEY)) {
        await rebalanceReviews()
        localStorage.setItem(REBALANCE_KEY, '1')
      }

      const [qs, prog, p, due] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getStudyPlan(),
        getDueReviews(),
      ])
      setAllQuestions(qs)
      setProgress(prog)
      setPlan(p)
      setDueReviews(due)
      setBreathers(getActiveBreathers())
      setLoading(false)
    }
    load()
  }, [])

  // When coming back from /practice (or any route), merge latest solved state immediately — no full-page reload.
  useEffect(() => {
    if (!loading && pathname === '/daily') {
      const prev = prevPathRef.current
      prevPathRef.current = pathname
      if (prev !== null && prev !== '/daily') {
        void refreshProgress()
        void refreshDue()
      }
    } else {
      prevPathRef.current = pathname
    }
  }, [pathname, loading, refreshProgress, refreshDue])

  useEffect(() => {
    if (loading || pathname !== '/daily') return
    const onVis = () => {
      if (document.visibilityState === 'visible') { void refreshProgress(); void refreshDue() }
    }
    const onPageShow = (e: Event) => {
      if ((e as PageTransitionEvent).persisted) { void refreshProgress(); void refreshDue() }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [loading, pathname, refreshProgress, refreshDue])

  const { days: previewDays, date: previewFinish } = calcFinish(startDate, perDay, allQuestions.length)

  async function handleGenerate() {
    if (!planCode.trim()) return
    setGenerating(true)
    const order = patternBasedStudyOrder(allQuestions, startFromPattern)
    const newPlan: StudyPlan = {
      start_date: startDate,
      per_day: perDay,
      question_order: order,
      lock_code: planCode.trim(),
    }
    const ok = await saveStudyPlan(newPlan)
    setGenerating(false)
    if (ok) {
      setPlan(newPlan)
      toast.success('Study plan created!')
    } else {
      toast.error('Failed to save plan — check Supabase RLS policies.')
    }
  }

  async function handleChangePace() {
    if (!plan || newPerDay < 1 || newPerDay > 50) return
    setSavingPace(true)
    const ok = await saveStudyPlan({ ...plan, per_day: newPerDay })
    if (ok) {
      setPlan({ ...plan, per_day: newPerDay })
      setShowChangePace(false)
      toast.success(`Pace updated to ${newPerDay}/day!`)
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

  function isStarred(id: number) {
    return !!progress[String(id)]?.starred
  }

  function toggleStar(id: number) {
    const n = !isStarred(id)
    setProgress(prev => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], starred: n },
    }))
    updateProgress(id, { starred: n })
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

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Questions per day</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 5, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setPerDay(n)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      perDay === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={perDay}
                  onChange={e => setPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1.5 border-2 border-[var(--border)] rounded-xl text-sm text-center text-[var(--text)] bg-[var(--bg-input)] focus:outline-none focus:border-indigo-400"
                />
              </div>
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

          {/* Pattern order + start-from picker */}
          <div className="mt-4 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/30 rounded-xl px-3 py-3">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-base shrink-0">🧩</span>
              <div>
                <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Pattern-First Order</p>
                <p className="text-xs text-violet-600 dark:text-violet-400/80 leading-snug">Questions are grouped by the 20 core patterns, Easy→Hard within each. Choose which pattern to start from below.</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">Start from pattern:</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setStartFromPattern(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    startFromPattern === null
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-400'
                  }`}
                >
                  From beginning
                </button>
                {QUICK_PATTERNS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => setStartFromPattern(startFromPattern === p.name ? null : p.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      startFromPattern === p.name
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-400'
                    }`}
                  >
                    {i + 1}. {p.name}
                  </button>
                ))}
              </div>
              {startFromPattern && (
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">
                  ✓ Plan starts at <strong>{startFromPattern}</strong>, then continues through all remaining patterns.
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">At {perDay}/day you finish in</span>
              <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">{previewDays} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-500 dark:text-indigo-400">Estimated finish</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{fmtDate(previewFinish)}</span>
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

  // ACTIVE VIEW
  const todayInfo = getTodayInfo(plan, allQuestions, progress)
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  const progressPct = todayInfo.dayNumber ? Math.round((todayInfo.dayNumber / totalDays) * 100) : 0
  const todayQs = todayInfo.questions || []
  const todayDone = (todayInfo.questionIds || []).filter(id => isSolved(id)).length

  const dailyListItems = todayQs.map(q => (
    <a
      key={q.id}
      href={`/practice/${q.id}`}
      onClick={() => setShowList(false)}
      className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-muted)] border-b border-[var(--border-soft)] transition-colors"
    >
      <span className="shrink-0 tabular-nums text-xs font-mono text-[var(--text-subtle)]">#{q.id}</span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{q.title}</span>
      <span
        className={`text-xs font-semibold shrink-0 ${q.difficulty === 'Easy' ? 'text-green-600' : q.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
      >
        {q.difficulty[0]}
      </span>
      {isSolved(q.id) && <CheckCircle2 size={11} className="text-green-400 shrink-0" />}
    </a>
  ))
  const pastDayCount = todayInfo.dayNumber ? todayInfo.dayNumber - 1 : totalDays
  const PAST_DAYS_INITIAL = 7
  const displayPast = pastDaysShowAll ? pastDayCount : Math.min(PAST_DAYS_INITIAL, pastDayCount)
  const hasMorePastToReveal = pastDayCount > PAST_DAYS_INITIAL

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {!online && <OfflineBanner feature="Daily plan (Supabase)" />}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-[var(--text)] flex items-center gap-2">Study Plan</h1>
          {!todayInfo.pending && !todayInfo.complete && todayInfo.dayNumber && (
            <p className="text-xs text-[var(--text-subtle)] mt-0.5">
              Day {todayInfo.dayNumber} of {totalDays} · finish by {fmtDate(todayInfo.finishDate || '')}
            </p>
          )}
          {todayInfo.pending && (
            <p className="text-xs text-amber-500 mt-0.5">
              Starts in {todayInfo.daysUntil} day{todayInfo.daysUntil !== 1 ? 's' : ''} ({fmtDate(todayInfo.startDate || '')})
            </p>
          )}
          {todayInfo.complete && (
            <p className="text-xs text-green-500 dark:text-green-400 font-semibold mt-0.5">Plan complete!</p>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-visible">
          {todayQs.length > 0 && (
            <div ref={listWrapRef} className="relative z-10">
              <button type="button"
                onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:border-indigo-400 hover:text-indigo-500 transition-colors font-semibold"
              >
                <List size={12} />
                Today's Qs
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
            onClick={() => { setShowChangePace(v => !v); setNewPerDay(plan.per_day) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-subtle)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
          >
            Pace: {plan.per_day}/day
          </button>
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
              min={1}
              max={50}
              value={newPerDay}
              onChange={e => setNewPerDay(Math.max(1, Math.min(50, Number(e.target.value))))}
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
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-4">
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
                resetError ? 'border-red-500 bg-red-100 dark:bg-red-950/40 text-[var(--text)]' : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)]'
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
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 mb-4 flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
            <Wind size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
              Breather — {b.name} (Day {b.day} of 2)
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              You finished all <span className="font-semibold">{b.name}</span> questions! Spend today revising the pattern — re-read solutions, trace through edge cases, and make sure it sticks before moving on.
            </p>
          </div>
        </div>
      ))}

      {/* Progress bar */}
      {!todayInfo.pending && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-4 mb-4">
          <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)] mb-2">
            <span>{todayInfo.complete ? 'Completed!' : `${todayInfo.dayNumber}/${totalDays} days`}</span>
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
            <span>{todayInfo.daysLeft !== undefined ? `${todayInfo.daysLeft} days left` : ''}</span>
            <span>{fmtDate(todayInfo.finishDate || '')}</span>
          </div>
        </div>
      )}

      {/* TODAY'S QUESTIONS */}
      {!todayInfo.pending && !todayInfo.complete && todayInfo.dayNumber && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--text)] text-sm flex items-center gap-2">
              <CalendarCheck size={15} className="text-indigo-500" />
              Today — Day {todayInfo.dayNumber}
            </h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              todayDone === todayQs.length ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
              todayDone > 0 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
            }`}>
              {todayDone}/{todayQs.length} done
            </span>
          </div>

          <div className="space-y-3">
            {todayQs.map((q, idx) => {
              const solved = isSolved(q.id)
              const topic = topicMap[q.id] ?? 'Other'
              const prev = idx > 0 ? todayQs[idx - 1] : null
              const prevTopic = prev ? (topicMap[prev.id] ?? 'Other') : null
              const showTopic = idx === 0 || topic !== prevTopic
              return (
                <div key={q.id}>
                  {showTopic && (
                    <div className="px-3 py-2 text-[11px] font-bold text-[var(--text-subtle)] bg-[var(--bg-muted)] rounded-xl border border-[var(--border)]">
                      🧩 Topic: <span className="text-[var(--text)]">{topic}</span>
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors mt-2 ${
                      solved ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-500/30' : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-indigo-400/50'
                    }`}
                  >
                    <div className="shrink-0">
                      {solved ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-[var(--text-subtle)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                        <span className={`text-sm font-semibold truncate ${solved ? 'text-green-500 dark:text-green-400 line-through' : 'text-[var(--text)]'}`}>
                          {q.title}
                        </span>
                        <a
                          href={`https://leetcode.com/problems/${q.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors"
                          title="Open on LeetCode"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                      <div className="mt-1">
                        <DifficultyBadge difficulty={q.difficulty} />
                      </div>
                    </div>
                    <Link
                      href={`/practice/${q.id}`}
                      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        solved
                          ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {solved ? <><RotateCcw size={11} /> Revisit</> : <>Solve <ArrowRight size={12} /></>}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {todayDone === todayQs.length && todayQs.length > 0 && (
            <div className="mt-4 text-center text-green-500 dark:text-green-400 font-bold text-sm">
              All done for today! See you tomorrow.
            </div>
          )}

          {/* Sneak peek days */}
          {Array.from({ length: extraDays }, (_, i) => {
            const nextDayIdx = (todayInfo.dayNumber ?? 1) - 1 + i + 1
            if (nextDayIdx >= totalDays) return null
            const { questionIds: nextIds, questions: nextQs } = getDayInfo(plan, nextDayIdx, allQuestions, progress)
            const alreadySolved = nextIds.filter(id => isSolved(id)).length
            const allPreSolved = alreadySolved === nextQs.length
            return (
              <div key={nextDayIdx} className="mt-4 border-t border-dashed border-purple-100 pt-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[var(--text-muted)] text-sm flex items-center gap-2">
                    <span className="text-base">👀</span>
                    Day {nextDayIdx + 1}
                    <span className="text-xs font-normal text-purple-400">sneak peek</span>
                  </h3>
                  {alreadySolved > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      allPreSolved ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                    }`}>
                      {alreadySolved}/{nextQs.length} pre-solved ✓
                    </span>
                  )}
                </div>

                {/* Hint */}
                <p className="text-xs text-[var(--text-subtle)] mb-3 italic">
                  Start learning now — these count on their allocated day, not today.
                </p>

                <div className="space-y-2">
                  {nextQs.map(q => {
                    const solved = isSolved(q.id)
                    return (
                      <div
                        key={q.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          solved
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-500/30'
                            : 'bg-purple-50/40 border-purple-100 hover:border-purple-200'
                        }`}
                      >
                        {/* Solved indicator */}
                        <div className="shrink-0">
                          {solved
                            ? <CheckCircle2 size={18} className="text-green-500" />
                            : <Circle size={18} className="text-purple-200" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-[var(--text-subtle)] font-mono">#{q.id}</span>
                            <span className={`text-sm font-medium truncate ${solved ? 'text-green-500 dark:text-green-400 line-through' : 'text-[var(--text)]'}`}>
                              {q.title}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <DifficultyBadge difficulty={q.difficulty} />
                            {solved && <span className="text-xs text-green-400 font-medium">already solved ✓</span>}
                          </div>
                        </div>

                        {/* Star */}
                        <button
                          type="button"
                          onClick={() => toggleStar(q.id)}
                          className={`shrink-0 p-1.5 rounded-lg border transition-colors ${isStarred(q.id) ? 'bg-yellow-50 border-yellow-200' : 'border-[var(--border)] hover:border-yellow-300'}`}
                          aria-label={isStarred(q.id) ? 'Unstar' : 'Star'}
                        >
                          <Star size={13} className={isStarred(q.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
                        </button>

                        {/* Preview link — read-only intent, not solve pressure */}
                        <Link
                          href={`/practice/${q.id}`}
                          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            solved
                              ? 'border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                              : 'border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 bg-white dark:bg-purple-950/30 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                          }`}
                        >
                          {solved ? 'Review' : 'Preview'}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Do More button — only unlocked when today is fully done */}
          {todayDone === todayQs.length && todayQs.length > 0 &&
           (todayInfo.dayNumber ?? 1) - 1 + extraDays + 1 < totalDays && (
            <button
              onClick={() => setExtraDays(e => e + 1)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-purple-200 text-purple-600 text-sm font-semibold rounded-xl hover:bg-purple-50 transition-colors"
            >
              👀 Sneak peek tomorrow <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* PENDING */}
      {todayInfo.pending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold text-amber-800 text-sm">Plan starts on {fmtDate(todayInfo.startDate || '')}</p>
          <p className="text-xs text-amber-600 mt-1">Come back then and your questions will be waiting.</p>
        </div>
      )}

      {/* COMPLETE */}
      {todayInfo.complete && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-500/30 rounded-xl p-5 mb-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="font-bold text-green-700 dark:text-green-400">You finished all {plan.question_order.length} questions!</p>
          <button
            onClick={async () => { await clearStudyPlan(); setPlan(null) }}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            Start New Plan
          </button>
        </div>
      )}

      {/* REVIEWS DUE */}
      {dueReviews.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl mb-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setDueOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">
                Reviews due — {dueReviews.length} question{dueReviews.length > 1 ? 's' : ''}
              </span>
            </div>
            {dueOpen ? <ChevronUp size={15} className="text-indigo-400" /> : <ChevronDown size={15} className="text-indigo-400" />}
          </button>
          {dueOpen && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              <Link
                href="/review"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 hover:shadow-sm transition-all"
              >
                Open reviews <ArrowRight size={12} />
              </Link>
              {dueReviews.map(q => (
                <Link
                  key={q.id}
                  href={`/practice/${q.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs hover:border-indigo-400 hover:shadow-sm transition-all text-left"
                >
                  <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
                  <span className="text-indigo-400 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
                </Link>
              ))}
            </div>
          )}
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
          </div>
          <div className="space-y-2">
            {Array.from({ length: displayPast }, (_, i) => {
              const dayIdx = (todayInfo.dayNumber ? todayInfo.dayNumber - 2 - i : totalDays - 1 - i)
              if (dayIdx < 0) return null
              const { questionIds, questions: dayQs } = getDayInfo(plan, dayIdx, allQuestions, progress)
              const doneCnt = questionIds.filter(id => isSolved(id)).length
              const expanded = expandedDays[dayIdx]
              return (
                <div key={dayIdx} className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedDays(p => ({ ...p, [dayIdx]: !p[dayIdx] }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-muted)] transition-colors"
                  >
                    <span className="text-sm font-semibold text-[var(--text)]">Day {dayIdx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${doneCnt === dayQs.length ? 'text-green-600' : doneCnt > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {doneCnt}/{dayQs.length}
                      </span>
                      {expanded ? <ChevronUp size={14} className="text-[var(--text-subtle)]" /> : <ChevronDown size={14} className="text-[var(--text-subtle)]" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-[var(--border-soft)]">
                      {dayQs.map(q => (
                        <div key={q.id} className="flex items-center gap-2 text-sm py-1">
                          {isSolved(q.id)
                            ? <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                            : <Circle size={14} className="text-[var(--text-subtle)] shrink-0" />
                          }
                          <Link href={`/practice/${q.id}`} className="text-[var(--text)] hover:text-indigo-500 truncate flex-1 min-w-0">
                            {q.title}
                          </Link>
                          <a
                            href={`https://leetcode.com/problems/${q.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors"
                            title="Open on LeetCode"
                          >
                            <ExternalLink size={11} />
                          </a>
                          <DifficultyBadge difficulty={q.difficulty} />
                        </div>
                      ))}
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
              className="mt-4 w-full py-2.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-500/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
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

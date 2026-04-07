'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import OfflineBanner from '@/components/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useClickOutside } from '@/hooks/useClickOutside'
import { CalendarCheck, Rocket, RotateCcw, ArrowRight, CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, List } from 'lucide-react'
import { getStudyPlan, saveStudyPlan, clearStudyPlan, getProgress } from '@/lib/db'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'

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
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  // Setup form
  const [startDate, setStartDate] = useState(todayISO())
  const [perDay, setPerDay] = useState(3)
  const [planCode, setPlanCode] = useState('')
  const [generating, setGenerating] = useState(false)

  // Reset gate
  const [showResetPrompt, setShowResetPrompt] = useState(false)
  const [resetAttempt, setResetAttempt] = useState('')
  const [resetError, setResetError] = useState(false)

  // Past days (accordion per day + global “show more” for long plans)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [pastDaysShowAll, setPastDaysShowAll] = useState(false)
  const [showList, setShowList] = useState(false)
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  // Extra days
  const [extraDays, setExtraDays] = useState(0)

  const refreshProgress = useCallback(async () => {
    try {
      const prog = await getProgress()
      setProgress(prog)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function load() {
      const [qs, prog, p] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getStudyPlan(),
      ])
      setAllQuestions(qs)
      setProgress(prog)
      setPlan(p)
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
      }
    } else {
      prevPathRef.current = pathname
    }
  }, [pathname, loading, refreshProgress])

  useEffect(() => {
    if (loading || pathname !== '/daily') return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshProgress()
    }
    const onPageShow = (e: Event) => {
      if ((e as PageTransitionEvent).persisted) void refreshProgress()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [loading, pathname, refreshProgress])

  const { days: previewDays, date: previewFinish } = calcFinish(startDate, perDay, allQuestions.length)

  async function handleGenerate() {
    if (!planCode.trim()) return
    setGenerating(true)
    const order = defaultStudyQuestionOrder(allQuestions)
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

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>

  // SETUP VIEW
  if (!plan) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        {!online && <OfflineBanner feature="Daily plan (Supabase)" />}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚔</div>
          <h1 className="text-2xl font-black text-gray-800 mb-1">LeetCode Police</h1>
          <p className="text-gray-500 text-sm">Daily Study Plan — commit to a schedule and stick to it.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-semibold text-gray-700">Total questions</span>
            <span className="text-2xl font-black text-indigo-600">{allQuestions.length}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Questions per day</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 5, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setPerDay(n)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      perDay === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
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
                  className="w-16 px-2 py-1.5 border-2 border-gray-200 rounded-xl text-sm text-center text-gray-900 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                min={todayISO()}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plan lock code</label>
              <input
                type="text"
                value={planCode}
                onChange={e => setPlanCode(e.target.value)}
                placeholder="e.g. grind2026"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">You need this code to reset the plan. Do not forget it.</p>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-indigo-600 font-semibold">At {perDay}/day you finish in</span>
              <span className="text-lg font-black text-indigo-700">{previewDays} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-500">Estimated finish</span>
              <span className="text-sm font-bold text-indigo-700">{fmtDate(previewFinish)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !planCode.trim() || !online}
          className="w-full py-4 bg-gray-900 text-white font-bold text-base rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
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
          <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">Study Plan</h1>
          {!todayInfo.pending && !todayInfo.complete && todayInfo.dayNumber && (
            <p className="text-xs text-gray-400 mt-0.5">
              Day {todayInfo.dayNumber} of {totalDays} · finish by {fmtDate(todayInfo.finishDate || '')}
            </p>
          )}
          {todayInfo.pending && (
            <p className="text-xs text-amber-500 mt-0.5">
              Starts in {todayInfo.daysUntil} day{todayInfo.daysUntil !== 1 ? 's' : ''} ({fmtDate(todayInfo.startDate || '')})
            </p>
          )}
          {todayInfo.complete && (
            <p className="text-xs text-green-600 font-semibold mt-0.5">Plan complete!</p>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-visible">
          {todayQs.length > 0 && (
            <div ref={listWrapRef} className="relative z-10">
              <button type="button"
                onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors font-semibold"
              >
                <List size={12} />
                Today's Qs
              </button>
              {showList && (
                <div className="absolute top-full right-0 z-[100] mt-1 max-h-[min(70vh,20rem)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  {todayQs.map(q => (
                    <a key={q.id} href={`/practice/${q.id}`} onClick={() => setShowList(false)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 border-b border-gray-50 transition-colors text-sm">
                      <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{q.id}</span>
                      <span className="flex-1 truncate text-gray-700">{q.title}</span>
                      <span className={`text-xs font-semibold shrink-0 ${q.difficulty === 'Easy' ? 'text-green-600' : q.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                        {q.difficulty[0]}
                      </span>
                      {isSolved(q.id) && <CheckCircle2 size={11} className="text-green-500 shrink-0" />}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowResetPrompt(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Reset gate */}
      {showResetPrompt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
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
              className={`px-3 py-2 rounded-lg border text-sm text-gray-900 focus:outline-none transition-colors ${
                resetError ? 'border-red-500 bg-red-100' : 'border-gray-300 bg-white'
              }`}
            />
            <button onClick={handleResetConfirm} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
              Confirm Reset
            </button>
            <button onClick={() => setShowResetPrompt(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            {resetError && <span className="text-red-600 text-xs font-semibold">Wrong code</span>}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {!todayInfo.pending && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
            <span>{todayInfo.complete ? 'Completed!' : `${todayInfo.dayNumber}/${totalDays} days`}</span>
            <span className="text-indigo-600">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{fmtDate(plan.start_date)}</span>
            <span>{todayInfo.daysLeft !== undefined ? `${todayInfo.daysLeft} days left` : ''}</span>
            <span>{fmtDate(todayInfo.finishDate || '')}</span>
          </div>
        </div>
      )}

      {/* TODAY'S QUESTIONS */}
      {!todayInfo.pending && !todayInfo.complete && todayInfo.dayNumber && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <CalendarCheck size={15} className="text-indigo-500" />
              Today — Day {todayInfo.dayNumber}
            </h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              todayDone === todayQs.length ? 'bg-green-100 text-green-700' :
              todayDone > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }`}>
              {todayDone}/{todayQs.length} done
            </span>
          </div>

          <div className="space-y-3">
            {todayQs.map(q => {
              const solved = isSolved(q.id)
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    solved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="shrink-0">
                    {solved ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                      <span className={`text-sm font-semibold truncate ${solved ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                        {q.title}
                      </span>
                      <a
                        href={`https://leetcode.com/problems/${q.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors"
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
                        ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {solved ? <><RotateCcw size={11} /> Revisit</> : <>Solve <ArrowRight size={12} /></>}
                  </Link>
                </div>
              )
            })}
          </div>

          {todayDone === todayQs.length && todayQs.length > 0 && (
            <div className="mt-4 text-center text-green-600 font-bold text-sm">
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
                  <h3 className="font-bold text-gray-600 text-sm flex items-center gap-2">
                    <span className="text-base">👀</span>
                    Day {nextDayIdx + 1}
                    <span className="text-xs font-normal text-purple-400">sneak peek</span>
                  </h3>
                  {alreadySolved > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      allPreSolved ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {alreadySolved}/{nextQs.length} pre-solved ✓
                    </span>
                  )}
                </div>

                {/* Hint */}
                <p className="text-xs text-gray-400 mb-3 italic">
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
                            ? 'bg-green-50 border-green-200'
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
                            <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                            <span className={`text-sm font-medium truncate ${solved ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                              {q.title}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <DifficultyBadge difficulty={q.difficulty} />
                            {solved && <span className="text-xs text-green-500 font-medium">already solved ✓</span>}
                          </div>
                        </div>

                        {/* Preview link — read-only intent, not solve pressure */}
                        <Link
                          href={`/practice/${q.id}`}
                          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            solved
                              ? 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
                              : 'border-purple-200 text-purple-600 bg-white hover:bg-purple-50'
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="font-bold text-green-800">You finished all {plan.question_order.length} questions!</p>
          <button
            onClick={async () => { await clearStudyPlan(); setPlan(null) }}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            Start New Plan
          </button>
        </div>
      )}

      {/* PAST DAYS — most recent first; default 7 rows, expand for full history */}
      {displayPast > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-bold text-gray-700 text-sm">Past Days</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
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
                <div key={dayIdx} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedDays(p => ({ ...p, [dayIdx]: !p[dayIdx] }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-700">Day {dayIdx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${doneCnt === dayQs.length ? 'text-green-600' : doneCnt > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {doneCnt}/{dayQs.length}
                      </span>
                      {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50">
                      {dayQs.map(q => (
                        <div key={q.id} className="flex items-center gap-2 text-sm py-1">
                          {isSolved(q.id)
                            ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                            : <Circle size={14} className="text-gray-300 shrink-0" />
                          }
                          <Link href={`/practice/${q.id}`} className="text-gray-700 hover:text-indigo-600 truncate flex-1 min-w-0">
                            {q.title}
                          </Link>
                          <a
                            href={`https://leetcode.com/problems/${q.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors"
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
              className="mt-4 w-full py-2.5 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
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

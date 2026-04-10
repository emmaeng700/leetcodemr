'use client'
import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Star, CheckCircle2, Layers, BookOpen, CheckCircle, Target, Calendar, ChevronRight, Flame, Brain, ChevronDown, ChevronUp, TrendingUp, RotateCcw } from 'lucide-react'
import { QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { getProgress, updateProgress, getActivityLog, getDueReviews, getInterviewDate, getStudyPlan, setInterviewDate, clearInterviewDate, getDailyReviewCapChicago } from '@/lib/db'
import { computeDailyGoalsMetToday, computePlanStreakDisplayNumber, normalizeStudyPlanRow } from '@/lib/streakGoals'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'
import { addToRebootQueue, getRebootQueue, removeFromRebootQueue } from '@/lib/rebootQueue'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
  description?: string
}

interface ProgressData {
  solved: boolean
  starred: boolean
  notes: string
  status?: string | null
  review_count?: number
  next_review?: string | null
}

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']
const SOURCES = ['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal']


function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function computeStreak(log: Record<string, number>) {
  let streak = 0
  const d = new Date()
  // If today isn’t a “goals met” day yet, don’t zero the streak — count backward from
  // yesterday so the number stays “14 days through yesterday” while you finish today.
  if (!log[localISO(d)]) {
    d.setDate(d.getDate() - 1)
  }
  while (true) {
    const key = localISO(d)
    if (!log[key]) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return Math.abs(h)
}

const STREAK_MESSAGES: Record<string, string[]> = {
  '0':  ['Start your streak today!', 'Day 1 begins with a single problem 💡', 'Every expert was once a beginner 🌱', 'Your future self will thank you 🙏'],
  '1':  ['First step taken — keep going! 🚶', 'One day in, momentum is building 💪', 'You showed up. That\'s everything. ✅'],
  '2':  ['Two days straight — you\'re building a habit! 🔥', 'Consistency beats intensity. Day 2! 💯', 'Two down, many more to go 🎯'],
  '3':  ['Three days strong! 🔥🔥', 'The magic happens at day 3 ✨', 'Three days of showing up — that\'s discipline 💪'],
  '5':  ['Halfway to a full week! 🎯', 'Five days in — you\'re on fire 🔥', 'Five-day grinder detected 🤖'],
  '7':  ['One full week! 🎉', 'Seven days of pure dedication 🏆', 'A week of coding greatness — unstoppable! ⚡'],
  '14': ['Two week warrior! ⚡', '14 days and counting — elite consistency 🥇', 'Two weeks? You\'re built different 🦾'],
  '21': ['Three week streak — legendary! 🏅', '21 days = a fully formed habit 🧠', 'Three weeks straight — nothing stops you! 🚀'],
  '30': ['30-day grinder — absolute beast! 🔥🏆', 'A month of dedication — FAANG ready! 🎯', '30 days! You\'re going to crush that interview 💼'],
}

function getStreakMessage(streak: number): string {
  const msgs =
    streak === 0 ? STREAK_MESSAGES['0'] :
    streak === 1 ? STREAK_MESSAGES['1'] :
    streak <= 2  ? STREAK_MESSAGES['2'] :
    streak <= 4  ? STREAK_MESSAGES['3'] :
    streak <= 6  ? STREAK_MESSAGES['5'] :
    streak <= 13 ? STREAK_MESSAGES['7'] :
    streak <= 20 ? STREAK_MESSAGES['14'] :
    streak <= 29 ? STREAK_MESSAGES['21'] :
                   STREAK_MESSAGES['30']
  // pick one deterministically per day so it doesn't change on re-render
  const seed = todayISO() + streak
  let h = 0; for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return msgs[Math.abs(h) % msgs.length]
}

function StreakCard({
  streak,
  log,
  goalsMetToday,
}: {
  streak: number
  log: Record<string, number>
  /** Today’s dot uses live daily+SR rules; stale activity_log rows can’t show “done” early. */
  goalsMetToday: boolean
}) {
  // Build Mon→Sun for the current ISO week
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = localISO(d)
    const isToday = key === todayISO()
    const isFuture = d > today && !isToday
    const active = isToday ? goalsMetToday : !!log[key]
    return { label: ['M','T','W','T','F','S','S'][i], key, active, isToday, isFuture }
  })

  const weekActive = weekDays.filter(d => d.active).length
  const message = getStreakMessage(streak)

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/70 dark:to-amber-950/50 border border-orange-200 dark:border-orange-500/30 rounded-xl p-4 mb-3 shadow-lg shadow-orange-900/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Flame size={18} className="text-orange-400" />
            <span className="text-2xl font-black text-orange-500 dark:text-orange-400">{streak}</span>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-500">{streak === 1 ? 'day' : 'days'}</span>
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-300/80 font-medium leading-snug max-w-[200px]">{message}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold text-[var(--text-muted)] mb-0.5">This week</p>
          <p className="text-lg font-black text-[var(--text)]">{weekActive}<span className="text-xs font-semibold text-[var(--text-subtle)]"> / 7</span></p>
        </div>
      </div>
      {/* Week day dots */}
      <div className="flex gap-1.5 justify-between">
        {weekDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-full aspect-square rounded-full max-w-[28px] transition-colors ${
              d.active   ? 'bg-orange-400 shadow-sm shadow-orange-500/40' :
              d.isToday  ? 'bg-orange-100 dark:bg-orange-900/50 border-2 border-orange-400 dark:border-orange-500/60' :
              d.isFuture ? 'bg-[var(--bg-muted)]/60' :
                           'bg-[var(--bg-muted)]'
            }`} />
            <span className={`text-[10px] font-semibold ${d.isToday ? 'text-orange-400' : 'text-[var(--text-subtle)]'}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PatternCoverageGrid({ questions, progress }: { questions: Question[]; progress: Record<string, ProgressData> }) {
  const [collapsed, setCollapsed] = useState(false)

  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])
  const patternStats = useMemo(() => QUICK_PATTERNS.map(p => {
    const qs = questions.filter(q => exclusiveMap[q.id] === p.name)
    const solved = qs.filter(q => progress[String(q.id)]?.solved).length
    const mastered = qs.filter(q => progress[String(q.id)]?.status === 'mastered').length
    const pct = qs.length ? Math.round((solved / qs.length) * 100) : 0
    return { name: p.name, tags: p.tags, total: qs.length, solved, mastered, pct }
  }).filter(p => p.total > 0), [questions, progress, exclusiveMap])

  const weakest = [...patternStats].filter(p => p.total >= 3).sort((a, b) => a.pct - b.pct)[0]
  const overallSolved = patternStats.reduce((s, p) => s + p.solved, 0)
  const overallTotal = patternStats.reduce((s, p) => s + p.total, 0)
  const overallPct = overallTotal ? Math.round((overallSolved / overallTotal) * 100) : 0
  const crushing = [...patternStats].filter(p => p.pct >= 70 && p.pct < 100).sort((a, b) => b.pct - a.pct)[0]
  const untouched = patternStats.filter(p => p.solved === 0)
  const almostDone = [...patternStats].filter(p => p.pct >= 85 && p.pct < 100).sort((a, b) => b.pct - a.pct)[0]

  return (
    <div className="mb-5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-400" />
          <span className="text-sm font-bold text-[var(--text)]">Pattern Coverage</span>
          <span className="text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">{overallPct}% overall</span>
        </div>
        <div className="flex items-center gap-2">
          {weakest && collapsed && (
            <span className="text-xs text-amber-500 font-semibold hidden sm:inline">Focus: {weakest.name} ({weakest.pct}%)</span>
          )}
          {collapsed ? <ChevronDown size={15} className="text-[var(--text-subtle)]" /> : <ChevronUp size={15} className="text-[var(--text-subtle)]" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Motivational messages */}
          <div className="space-y-2 mb-3">
            {almostDone && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-500/30 rounded-lg px-3 py-2">
                <span className="text-base shrink-0">🏆</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-green-700 dark:text-green-400">{almostDone.name} is almost conquered!</p>
                  <p className="text-xs text-green-600 dark:text-green-400/80">Just {almostDone.total - almostDone.solved} more question{almostDone.total - almostDone.solved !== 1 ? 's' : ''} — finish it off, these will feel like a breeze 🔥</p>
                </div>
                <Link href={`/learn/0?tags=${(almostDone.tags as readonly string[]).join(',')}`}
                  className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-500/40 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                  Finish →
                </Link>
              </div>
            )}
            {crushing && !almostDone && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-2">
                <span className="text-base shrink-0">🔥</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">You&apos;re crushing {crushing.name}!</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400/80">{crushing.pct}% done — these questions will feel like a breeze. Try a harder one 💪</p>
                </div>
                <Link href={`/learn/0?tags=${(crushing.tags as readonly string[]).join(',')}`}
                  className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-500/40 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                  Keep going →
                </Link>
              </div>
            )}
            {untouched.length > 0 && (
              <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/30 rounded-lg px-3 py-2">
                <span className="text-base shrink-0">🧩</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-400">Try a never-seen topic: {untouched[0].name}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400/80">{untouched.length} pattern{untouched.length !== 1 ? 's' : ''} untouched — explore something new today!</p>
                </div>
                <Link href={`/learn/0?tags=${(untouched[0].tags as readonly string[]).join(',')}`}
                  className="text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-500/40 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                  Explore →
                </Link>
              </div>
            )}
            {weakest && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">🎯</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Focus next — weakest pattern</p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold truncate">{weakest.name} — {weakest.solved}/{weakest.total} solved ({weakest.pct}%)</p>
                  </div>
                </div>
                <Link
                  href={`/learn/0?tags=${(weakest.tags as readonly string[]).join(',')}`}
                  className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-500/40 px-3 py-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors shrink-0 whitespace-nowrap"
                >
                  Study now →
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {patternStats.map(p => {
              const barColor = p.pct === 100 ? 'bg-green-500' : p.pct >= 60 ? 'bg-indigo-500' : p.pct >= 25 ? 'bg-amber-500' : 'bg-red-400'
              const pctColor = p.pct === 100 ? 'text-green-500' : p.pct >= 60 ? 'text-indigo-400' : p.pct >= 25 ? 'text-amber-500' : 'text-red-400'
              const isWeakest = weakest?.name === p.name
              return (
                <Link
                  key={p.name}
                  href={`/learn/0?tags=${(p.tags as readonly string[]).join(',')}`}
                  className={`flex flex-col gap-1 px-3 py-2 rounded-lg border transition-all hover:border-indigo-400/60 hover:bg-[var(--bg-muted)] ${
                    isWeakest
                      ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-[var(--border-soft)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text)] truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono text-[var(--text-subtle)]">{p.solved}/{p.total}</span>
                      <span className={`text-[11px] font-bold ${pctColor}`}>{p.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: p.pct + '%' }} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function InterviewCountdownWidget({ questions, progress }: { questions: Question[]; progress: Record<string, ProgressData> }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [editing, setEditing] = useState(false)
  const [activityLog, setActivityLog] = useState<Record<string, number>>({})
  const [studyPlan, setStudyPlan] = useState<Awaited<ReturnType<typeof getStudyPlan>>>(null)
  const [dueReviews, setDueReviews] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [dailyQ, setDailyQ] = useState<Question | null>(null)
  const [loaded, setLoaded] = useState(false)
  const streakHydratedRef = useRef(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [log, interviewData, plan, due] = await Promise.all([
        getActivityLog(),
        getInterviewDate(),
        getStudyPlan(),
        getDueReviews(),
      ])
      if (cancelled) return
      setActivityLog(log)
      setStudyPlan(plan)
      setDueReviews(due)
      if (interviewData?.target_date) setDate(interviewData.target_date)
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!loaded) return
    if (!streakHydratedRef.current) {
      streakHydratedRef.current = true
      return
    }
    let cancelled = false
    ;(async () => {
      const [log, due] = await Promise.all([getActivityLog(), getDueReviews()])
      if (cancelled) return
      setActivityLog(log)
      setDueReviews(due)
    })()
    return () => { cancelled = true }
  }, [progress, loaded])
  const goalsMetToday = computeDailyGoalsMetToday(studyPlan, progress, dueReviews.length)
  const planNorm = normalizeStudyPlanRow(studyPlan)
  const streakDisplay = planNorm
    ? (computePlanStreakDisplayNumber(studyPlan, progress, dueReviews.length) ?? 0)
    : computeStreak(activityLog)
  // Only show activity log dots from the current plan's start date onwards.
  // Old plan entries shouldn't bleed into a freshly generated plan's week view.
  const planFilteredLog = planNorm?.start_date
    ? Object.fromEntries(Object.entries(activityLog).filter(([date]) => date >= planNorm.start_date))
    : activityLog
  useEffect(() => {
    if (!questions.length) return
    const todayKey = 'daily_q_' + todayISO()
    const stored = localStorage.getItem(todayKey)
    if (stored) { try { setDailyQ(JSON.parse(stored)); return } catch {} }
    const unsolved = questions.filter(q => !progress[String(q.id)]?.solved)
    const pool = unsolved.length ? unsolved : questions
    const seed = new Date().toDateString()
    const idx = seededRandom(seed) % pool.length
    const q = pool[idx]
    localStorage.setItem(todayKey, JSON.stringify({ id: q.id, title: q.title, difficulty: q.difficulty }))
    setDailyQ(q)
  }, [questions, progress])
  const handleDateSave = async (val: string) => {
    setDate(val)
    await setInterviewDate(val, '')
    setEditing(false)
  }
  const handleDateClear = async () => {
    setDate('')
    await clearInterviewDate()
    setEditing(false)
  }
  const daysLeft = date ? Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
  const diffColor: Record<string, string> = {
    Easy: 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30',
    Medium: 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30',
    Hard: 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
  }
  if (!loaded) return null
  return (
    <>
      <StreakCard streak={streakDisplay} log={planFilteredLog} goalsMetToday={goalsMetToday} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1"><Target size={13} /> Interview Countdown</span>
        </div>
        {editing ? (
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" defaultValue={date} min={todayISO()}
              className="text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={e => { if (e.key === 'Enter') handleDateSave((e.target as HTMLInputElement).value) }}
              onBlur={e => { if (e.target.value) handleDateSave(e.target.value); else setEditing(false) }}
              autoFocus />
            <button onClick={() => setEditing(false)} className="text-xs text-[var(--text-subtle)] hover:text-[var(--text)]">Cancel</button>
            {date && <button onClick={handleDateClear} className="text-xs text-red-400 hover:text-red-300">Remove</button>}
          </div>
        ) : date ? (
          <div>
            <div className={`text-3xl font-black mb-0.5 ${daysLeft !== null && daysLeft <= 7 ? 'text-red-400' : daysLeft !== null && daysLeft <= 14 ? 'text-orange-400' : 'text-indigo-400'}`}>
              {daysLeft !== null && daysLeft <= 0 ? 'Today!' : daysLeft + 'd'}
            </div>
            <p className="text-xs text-[var(--text-subtle)]">{daysLeft !== null && daysLeft <= 0 ? 'Interview day!' : 'until your interview'}</p>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => setEditing(true)} className="text-xs text-indigo-400 hover:underline">Change date</button>
              <span className="text-[var(--border)] opacity-50">·</span>
              <button onClick={handleDateClear} className="text-xs text-red-400 hover:text-red-300 hover:underline">Remove</button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-[var(--text-subtle)] mb-2">Set your interview date to track countdown</p>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors">
              <Calendar size={12} /> Set date
            </button>
          </div>
        )}
      </div>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg p-4">
        <div className="text-xs font-bold text-[var(--text-muted)] mb-3 flex items-center gap-1">⭐ Today's Question</div>
        {dailyQ ? (
          <div>
            <div className="flex items-start gap-2 mb-2">
              <span className={'text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ' + (diffColor[dailyQ.difficulty] || 'bg-slate-700 text-slate-400 border-white/10')}>{dailyQ.difficulty}</span>
              <span className="text-sm font-semibold text-[var(--text)] leading-snug">{dailyQ.title}</span>
            </div>
            <button onClick={() => router.push('/practice/' + dailyQ.id)} className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Solve now <ChevronRight size={13} />
            </button>
          </div>
        ) : <p className="text-xs text-[var(--text-subtle)]">Loading…</p>}
      </div>
    </div>
    </>
  )
}

function DueReviewBanner() {
  const router = useRouter()
  const [due, setDue] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [open, setOpen] = useState(true)
  useEffect(() => { getDueReviews().then(setDue).catch(() => {}) }, [])
  if (!due.length) return null
  function daysOverdue(nr: string) {
    const [y, m, d] = nr.split('-').map(Number)
    const diff = Math.round((new Date().setHours(0,0,0,0) - new Date(y, m-1, d).getTime()) / 86400000)
    if (diff === 0) return 'due today'
    if (diff === 1) return '1 day overdue'
    return diff + ' days overdue'
  }
  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 rounded-xl mb-5 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-900/30 transition-colors">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-indigo-400" />
          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">🧠 Spaced Repetition — {due.length} question{due.length > 1 ? 's' : ''} due for review</span>
        </div>
        {open ? <ChevronUp size={15} className="text-indigo-400" /> : <ChevronDown size={15} className="text-indigo-400" />}
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {due.map(q => (
            <button key={q.id} onClick={() => router.push('/practice/' + q.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[var(--bg-card)] border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs hover:border-indigo-400 dark:hover:border-indigo-400/60 hover:shadow-sm transition-all text-left">
              <span className="text-[var(--text-subtle)] font-mono">#{q.id}</span>
              <span className="text-indigo-600 dark:text-indigo-400 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TodayPlanCard({ questions, progress }: { questions: Question[]; progress: Record<string, ProgressData> }) {
  const router = useRouter()
  const [due, setDue] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [reboot, setReboot] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const d = await getDueReviews()
      if (cancelled) return
      setDue(d)
      setReboot(getRebootQueue())
    })()
    return () => { cancelled = true }
  }, [progress])

  const reviewSlots = getDailyReviewCapChicago()
  // Default: 2/day. Weekend catch-up: +4 extra (6 total).
  const duePick = due.slice(0, reviewSlots)
  const duePickSet = new Set(duePick.map(d => d.id))
  const rebootPick = reboot.filter(id => !duePickSet.has(id)).slice(0, Math.max(0, reviewSlots - duePick.length))

  const reviewSlotsUsed = rebootPick.length + duePick.length
  const newSlots = 3

  const titleFor = (id: number) => questions.find(q => q.id === id)?.title ?? `#${id}`

  return (
    <div className="mb-5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-[var(--border-soft)]">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-indigo-400" />
          <span className="text-sm font-bold text-[var(--text)]">Today&apos;s plan</span>
          <span className="text-xs text-[var(--text-subtle)] font-mono">{reviewSlotsUsed}/{reviewSlots} reviews · {newSlots} new</span>
        </div>
        <button
          onClick={() => setReboot(getRebootQueue())}
          className="text-xs font-semibold text-[var(--text-subtle)] hover:text-[var(--text)]"
          title="Refresh reboot queue"
        >
          Refresh
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-bold text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <RotateCcw size={13} className="text-amber-500" /> Reboot (fills leftover slots)
          </div>
          <div className="flex flex-wrap gap-2">
            {rebootPick.length ? rebootPick.map(id => (
              <div key={id} className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/practice/' + id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 hover:border-amber-300 dark:hover:border-amber-400/60"
                >
                  {titleFor(id)}
                </button>
                <button
                  onClick={() => { removeFromRebootQueue(id); setReboot(getRebootQueue()) }}
                  className="text-xs text-[var(--text-subtle)] hover:text-red-400"
                >
                  remove
                </button>
              </div>
            )) : (
              <div className="text-xs text-[var(--text-subtle)]">No reboot items yet. Add any “few days ago” question IDs below.</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-[var(--text-muted)] mb-2">Due reviews (up to {reviewSlots})</div>
          <div className="flex flex-wrap gap-2">
            {duePick.length ? duePick.map(d => (
              <button
                key={d.id}
                onClick={() => router.push('/practice/' + d.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-200 hover:border-indigo-300 dark:hover:border-indigo-400/60"
              >
                {titleFor(d.id)}
              </button>
            )) : (
              <div className="text-xs text-[var(--text-subtle)]">No due reviews right now.</div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-soft)]">
          <div className="text-xs font-bold text-[var(--text-muted)] mb-2">Add to reboot queue</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const raw = prompt('Add question id to Reboot queue (example: 206 or #206)')
                if (!raw) return
                const id = Number(String(raw).trim().replace(/^#/, ''))
                if (!Number.isFinite(id) || id <= 0) { toast.error('Invalid id'); return }
                addToRebootQueue(id)
                setReboot(getRebootQueue())
                toast.success('Added to reboot queue')
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text)] hover:border-indigo-400/60"
            >
              + Add by id
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-subtle)] mt-2">
            Fixed rule: weekdays 2 reviews/day. Weekends: 4 reviews/day total. 3 new/day stays constant.
          </p>
        </div>
      </div>
    </div>
  )
}

function buildStudyParams(
  difficulty: string,
  source: string,
  search: string,
  showStarred: boolean,
  showSolved: null | boolean,
  patternTags?: string[],
): string {
  const p = new URLSearchParams()
  if (difficulty !== 'All') p.set('diff', difficulty)
  if (source !== 'All') p.set('source', source)
  if (search) p.set('search', search)
  if (showStarred) p.set('starred', '1')
  if (showSolved === true) p.set('solved', 'true')
  if (showSolved === false) p.set('solved', 'false')
  if (patternTags && patternTags.length > 0) p.set('tags', patternTags.join(','))
  return p.toString()
}

function HomeInner() {
  const sp = useSearchParams()
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressData>>({})
  const [loading, setLoading] = useState(true)
  const [difficulty, setDifficulty] = useState('All')
  const [source, setSource] = useState('All')
  const [showStarred, setShowStarred] = useState(false)
  const [showSolved, setShowSolved] = useState<null | boolean>(null)
  const [activePattern, setActivePattern] = useState<string | null>(null)
  const [qPage, setQPage] = useState(1)

  const search = sp.get('search') || ''

  const PAGE_SIZE = 10

  useEffect(() => {
    Promise.all([fetch('/questions_full.json').then(r => r.json()), getProgress()]).then(([qs, prog]) => {
      setQuestions(qs); setProgress(prog); setLoading(false)
    })
  }, [])

  // Supabase is source of truth — reload is safe. Re-sync client state when returning to this page
  // or the tab so streak/progress match DB without requiring a full refresh.
  useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (pathname === '/' && prev !== null && prev !== '/') {
      getProgress().then(prog => setProgress(prog)).catch(() => {})
    }
  }, [pathname])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || pathname !== '/') return
      getProgress().then(prog => setProgress(prog)).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pathname])

  const DIFF_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }

  // Exclusive map for accurate per-pattern counts and filtering (no repetition)
  const exclusiveMapHome = useMemo(() => buildExclusivePatternMap(questions), [questions])

  const filtered = useMemo(() => questions.filter(q => {
    if (difficulty !== 'All' && q.difficulty !== difficulty) return false
    if (source !== 'All' && !(q.source || []).includes(source)) return false
    if (search) {
      const s = search.toLowerCase()
      const byId = s.replace(/^#/, '')
      if (!q.title.toLowerCase().includes(s) && !String(q.id).includes(byId)) return false
    }
    if (activePattern && exclusiveMapHome[q.id] !== activePattern) return false
    const p = progress[String(q.id)] || {}
    if (showStarred && !p.starred) return false
    if (showSolved === true && !p.solved) return false
    if (showSolved === false && p.solved) return false
    return true
  }).sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1)), [
    questions,
    difficulty,
    source,
    search,
    activePattern,
    exclusiveMapHome,
    progress,
    showStarred,
    showSolved,
    DIFF_ORDER,
  ])

  // Reset to page 1 whenever filters change
  useEffect(() => { setQPage(1) }, [difficulty, source, search, activePattern, showStarred, showSolved])

  const totalQPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((qPage - 1) * PAGE_SIZE, qPage * PAGE_SIZE)

  const solved = Object.values(progress).filter(p => p.solved).length

  async function toggleSolved(e: React.MouseEvent, q: Question) {
    e.preventDefault()
    const p = progress[String(q.id)] || { solved: false, starred: false, notes: '' }
    const newSolved = !p.solved
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...p, solved: newSolved } }))
    await updateProgress(q.id, { solved: newSolved })
    toast.success(newSolved ? 'Marked solved!' : 'Unmarked')
  }

  async function toggleStarred(e: React.MouseEvent, q: Question) {
    e.preventDefault()
    const p = progress[String(q.id)] || { solved: false, starred: false, notes: '' }
    const newStarred = !p.starred
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...p, starred: newStarred } }))
    await updateProgress(q.id, { starred: newStarred })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg px-5 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" />
          <span className="text-sm font-bold text-[var(--text)]">{solved} / {questions.length} solved</span>
        </div>
        <div className="flex-1 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: (questions.length ? Math.round((solved / questions.length) * 100) : 0) + '%' }} />
        </div>
        <span className="text-sm font-semibold text-indigo-400">{questions.length ? Math.round((solved / questions.length) * 100) : 0}%</span>
      </div>

      {!loading && <InterviewCountdownWidget questions={questions} progress={progress} />}
      {!loading && <TodayPlanCard questions={questions} progress={progress} />}
      <DueReviewBanner />
      {!loading && <PatternCoverageGrid questions={questions} progress={progress} />}

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-6 shadow-lg">
        <div className="flex flex-wrap gap-1">
          {DIFFICULTIES.map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ' + (difficulty === d ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:brightness-110 border border-[var(--border-soft)]')}>{d}</button>
          ))}
          <span className="w-px bg-[var(--border)] mx-0.5 shrink-0" />
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSource(s)}
              className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ' + (source === s ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:brightness-110 border border-[var(--border-soft)]')}>{s}</button>
          ))}
          <span className="w-px bg-white/10 mx-0.5 shrink-0" />
          <button onClick={() => setShowStarred(v => !v)}
            className={'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ' + (showStarred ? 'bg-yellow-500 text-white shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:brightness-110 border border-[var(--border-soft)]')}>
            <Star size={12} /> Starred
          </button>
          <button onClick={() => setShowSolved(v => v === null ? false : v === false ? true : null)}
            className={'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ' + (showSolved === false ? 'bg-orange-500 text-white' : showSolved === true ? 'bg-green-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:brightness-110 border border-[var(--border-soft)]')}>
            <CheckCircle2 size={12} />
            {showSolved === false ? 'Unsolved' : showSolved === true ? 'Solved' : 'All'}
          </button>
        </div>

        {/* Pattern / category filter row */}
        <div className="flex flex-wrap gap-1 pt-2 border-t border-[var(--border-soft)] mt-2">
          <span className="text-xs text-[var(--text-subtle)] self-center shrink-0 mr-1">Pattern:</span>
          {activePattern && (
            <button onClick={() => setActivePattern(null)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 bg-[var(--bg-muted)] text-[var(--text-muted)] hover:brightness-110 transition-colors border border-[var(--border)]">
              ✕ Clear
            </button>
          )}
          {QUICK_PATTERNS.map(pat => {
            const count = questions.filter(q => exclusiveMapHome[q.id] === pat.name).length
            const active = activePattern === pat.name
            return (
              <button key={pat.name}
                onClick={() => setActivePattern(active ? null : pat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 border ${
                  active
                    ? 'bg-cyan-700 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-soft)] hover:border-cyan-500/50 hover:text-cyan-300'
                }`}>
                {pat.name} <span className="opacity-50">·{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[var(--text-subtle)]">{filtered.length} questions{activePattern ? ` · ${activePattern}` : ''}</span>
          {(activePattern || difficulty !== 'All' || source !== 'All' || showStarred || showSolved !== null || search) && (
            <button
              onClick={() => {
                const p = new URLSearchParams(sp.toString())
                p.delete('search')
                window.history.replaceState(null, '', p.toString() ? `/?${p.toString()}` : '/')
                setActivePattern(null); setDifficulty('All'); setSource('All'); setShowStarred(false); setShowSolved(null)
              }}
              className="text-xs text-[var(--text-subtle)] hover:text-red-400 transition-colors">
              Clear all filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-subtle)] self-center">Study {filtered.length} as:</span>
          <Link href={`/flashcards?${buildStudyParams(difficulty, source, search, showStarred, showSolved, activePattern ? ([...(QUICK_PATTERNS.find(p => p.name === activePattern)?.tags ?? [])]) : [])}`} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors">
            <Layers size={12} /> Flashcards
          </Link>
          <Link href={`/learn/0?${buildStudyParams(difficulty, source, search, showStarred, showSolved, activePattern ? ([...(QUICK_PATTERNS.find(p => p.name === activePattern)?.tags ?? [])]) : [])}`} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors">
            <BookOpen size={12} /> Learn mode
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-subtle)] text-sm animate-pulse">Loading questions...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginated.map(q => {
            const p = progress[String(q.id)] || {}
            const isDue = (nextReview: string | null | undefined) => {
              if (!nextReview) return false
              const [y, m, d] = nextReview.split('-').map(Number)
              const rev = new Date(y, m - 1, d)
              const today = new Date(); today.setHours(0, 0, 0, 0)
              return rev <= today
            }
            const STATUS_STYLES: Record<string, string> = {
              learnt: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
              reviewed: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
              revised: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
              mastered: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
            }
            return (
              <Link key={q.id} href={'/practice/' + q.id} className={'group block rounded-xl border p-4 transition-all duration-150 hover:shadow-xl hover:shadow-indigo-900/20 hover:border-indigo-500/50 ' + (p.solved ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-500/30' : 'bg-[var(--bg-card)] border-[var(--border-soft)]')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                    <h3 className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-indigo-400 transition-colors">{q.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.starred && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                    {p.solved && <CheckCircle size={14} className="text-green-400" />}
                    {p.status === 'mastered' && isDue(p.next_review) && (
                      <Brain size={14} className="text-indigo-400" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <DifficultyBadge difficulty={q.difficulty} />
                  {(q.tags || []).slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                  {q.python_solution && <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">Py ✓</span>}
                  {q.cpp_solution && <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">C++ ✓</span>}
                </div>
                {p.status && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={'text-xs px-2 py-0.5 rounded-full font-semibold ' + (STATUS_STYLES[p.status] || '')}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                    {p.status === 'mastered' && p.next_review && !isDue(p.next_review) && (
                      <span className="text-xs text-slate-500">
                        📅 Review {(() => { const [y,mo,d] = (p.next_review as string).split('-').map(Number); return new Date(y,mo-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'}) })()}
                      </span>
                    )}
                    {p.status === 'mastered' && isDue(p.next_review) && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">🧠 Review due!</span>
                    )}
                  </div>
                )}
                {p.notes && <p className="text-xs text-[var(--text-subtle)] mt-2 italic truncate">📝 {p.notes}</p>}
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalQPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={() => setQPage(p => Math.max(1, p - 1))}
            disabled={qPage === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-400 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <span className="text-xs text-[var(--text-subtle)] font-mono">
            {(qPage - 1) * PAGE_SIZE + 1}–{Math.min(qPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <button
            onClick={() => setQPage(p => Math.min(totalQPages, p + 1))}
            disabled={qPage === totalQPages}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm font-semibold text-[var(--text-muted)] hover:border-indigo-400 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-[var(--text-subtle)] text-sm animate-pulse">Loading…</div>}>
      <HomeInner />
    </Suspense>
  )
}


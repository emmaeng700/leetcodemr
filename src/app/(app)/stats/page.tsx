'use client'
import { useState, useEffect, useRef } from 'react'
import { Trophy, TrendingUp, Download, Upload, CheckCircle, AlertTriangle, Lock, Unlock } from 'lucide-react'
import { getProgress, getSolvedLog, getTimeTracking, getDailyTarget, setDailyTarget, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import StreakCalendar from '@/components/StreakCalendar'
import StudyPaceCalculator from '@/components/StudyPaceCalculator'
import toast from 'react-hot-toast'

interface Question {
  id: number
  title: string
  difficulty: string
}

export default function StatsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [solvedLog, setSolvedLog] = useState<Record<string, number>>({})
  const [planLog, setPlanLog] = useState<Record<string, number>>({})
  const [timeData, setTimeData] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [importStatus, setImportStatus] = useState<'ok' | 'err' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Daily target lock state
  const [dailyTarget, setDailyTargetState] = useState(0)
  const [dailyLockCode, setDailyLockCode] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const [lockCodeInput, setLockCodeInput] = useState('')
  const [unlockAttempt, setUnlockAttempt] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [unlockError, setUnlockError] = useState(false)

  useEffect(() => {
    async function load() {
      const [qs, prog, sl, td, plan, dt] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getSolvedLog(),
        getTimeTracking(),
        getStudyPlan(),
        getDailyTarget(),
      ])
      setQuestions(qs)
      setProgress(prog)
      setSolvedLog(sl)
      setTimeData(td)
      setLoading(false)

      // Build daily plan heatmap from plan structure + progress
      // For each plan day: count how many of that day's questions are solved
      if (plan?.question_order?.length && plan.start_date) {
        const log: Record<string, number> = {}
        const perDay = plan.per_day || 3
        const totalDays = Math.ceil(plan.question_order.length / perDay)
        for (let day = 0; day < totalDays; day++) {
          const dayIds = plan.question_order.slice(day * perDay, day * perDay + perDay)
          const solvedCount = dayIds.filter((id: number) => prog[String(id)]?.solved).length
          if (solvedCount > 0) {
            const date = new Date(plan.start_date + 'T00:00:00')
            date.setDate(date.getDate() + day)
            log[date.toISOString().split('T')[0]] = solvedCount
          }
        }
        setPlanLog(log)
      } else {
        setPlanLog(sl) // fallback to solved_log if no plan
      }

      setDailyTargetState(dt.target || 0)
      setDailyLockCode(dt.lock_code || '')
      setTargetInput(dt.target > 0 ? String(dt.target) : '')
    }
    load()
  }, [])

  const totalQ = questions.length
  const solvedQ = Object.values(progress).filter((p: any) => p.solved).length
  const starredQ = Object.values(progress).filter((p: any) => p.starred).length
  const percent = totalQ ? Math.round((solvedQ / totalQ) * 100) : 0

  const byDiff: Record<string, { total: number; solved: number }> = {}
  for (const q of questions) {
    if (!byDiff[q.difficulty]) byDiff[q.difficulty] = { total: 0, solved: 0 }
    byDiff[q.difficulty].total++
    if (progress[String(q.id)]?.solved) byDiff[q.difficulty].solved++
  }

  const solvedList = questions.filter(q => progress[String(q.id)]?.solved).slice(0, 10)
  const totalTime = Math.round(Object.values(timeData).reduce((a, b) => a + b, 0) / 60)

  async function handleSetAndLock() {
    const n = parseInt(targetInput) || 0
    if (!n || !lockCodeInput.trim()) return
    await setDailyTarget(n, lockCodeInput.trim())
    setDailyTargetState(n)
    setDailyLockCode(lockCodeInput.trim())
    setLockCodeInput('')
    setIsUnlocked(false)
    toast.success('Daily target locked!')
  }

  function handleUnlock() {
    if (unlockAttempt.trim() === dailyLockCode) {
      setIsUnlocked(true)
      setUnlockError(false)
      setUnlockAttempt('')
      setTargetInput(String(dailyTarget))
      setLockCodeInput('')
    } else {
      setUnlockError(true)
      setTimeout(() => setUnlockError(false), 2000)
    }
  }

  async function handleUpdateAndLock() {
    const n = parseInt(targetInput) || 0
    if (!n || !lockCodeInput.trim()) return
    await setDailyTarget(n, lockCodeInput.trim())
    setDailyTargetState(n)
    setDailyLockCode(lockCodeInput.trim())
    setLockCodeInput('')
    setIsUnlocked(false)
    toast.success('Daily target updated!')
  }

  async function handleRemoveTarget() {
    await setDailyTarget(0, '')
    setDailyTargetState(0)
    setDailyLockCode('')
    setTargetInput('')
    setLockCodeInput('')
    setIsUnlocked(false)
    toast.success('Daily target removed')
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Trophy className="text-yellow-500" /> Your Stats
      </h1>

      {/* Big number cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
        {[
          { label: 'Solved', value: solvedQ, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'Total', value: totalQ, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Starred', value: starredQ, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-3 sm:p-5 text-center ${c.bg}`}>
            <div className={`text-3xl sm:text-4xl font-black ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex justify-between text-sm font-semibold text-gray-700 mb-2">
          <span>Overall Progress</span>
          <span className="text-indigo-600">{percent}%</span>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* By difficulty */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
          <TrendingUp size={15} /> By Difficulty
        </h2>
        <div className="space-y-3">
          {Object.entries(byDiff).map(([diff, data]) => {
            const pct = data.total ? Math.round((data.solved / data.total) * 100) : 0
            return (
              <div key={diff}>
                <div className="flex items-center justify-between mb-1">
                  <DifficultyBadge difficulty={diff} />
                  <span className="text-xs text-gray-500">{data.solved} / {data.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${diff === 'Easy' ? 'bg-green-400' : diff === 'Medium' ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recently solved */}
      {solvedList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-700 text-sm mb-3">✅ Solved Questions</h2>
          <div className="space-y-2">
            {solvedList.map(q => (
              <div key={q.id} className="flex items-center justify-between gap-2 text-sm min-w-0">
                <span className="text-gray-700 truncate min-w-0">
                  <span className="text-gray-400 font-mono text-xs mr-2">#{q.id}</span>
                  {q.title}
                </span>
                <div className="shrink-0"><DifficultyBadge difficulty={q.difficulty} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Target Lock System */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-5 mb-6">
        <h2 className="font-bold text-white text-sm mb-1 flex items-center gap-2">🚔 LeetCode Police — Daily Target</h2>

        {dailyTarget === 0 && (
          <>
            <p className="text-xs text-gray-400 mb-4">Commit to a daily goal and lock it with a code. You can only change it by entering that code.</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Questions / day</label>
                <input type="number" min="1" max="20" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="e.g. 3"
                  className="w-full sm:w-24 px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lock code</label>
                <input type="text" value={lockCodeInput} onChange={e => setLockCodeInput(e.target.value)} placeholder="e.g. GRIND2026"
                  className="w-full sm:w-40 px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <button onClick={handleSetAndLock} disabled={!targetInput || !lockCodeInput.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
                🔒 Set & Lock
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">Remember your code — there is no recovery if you forget it.</p>
          </>
        )}

        {dailyTarget > 0 && !isUnlocked && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-black text-indigo-400">{dailyTarget}</span>
              <div>
                <p className="text-white text-sm font-semibold">questions / day 🔒</p>
                <p className="text-xs text-gray-500">Goal is locked. Enter your code to change it.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <input type="text" value={unlockAttempt}
                onChange={e => { setUnlockAttempt(e.target.value); setUnlockError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                placeholder="Enter lock code"
                className={`w-full sm:w-44 px-3 py-2 rounded-lg border bg-gray-800 text-white text-sm focus:outline-none transition-colors ${unlockError ? 'border-red-500' : 'border-gray-600 focus:border-indigo-400'}`} />
              <button onClick={handleUnlock} className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-500 transition-colors">
                🔓 Unlock
              </button>
              {unlockError && <span className="text-red-400 text-xs font-semibold">Wrong code ❌</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> {dailyTarget}+ solved = green</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> {dailyTarget - 1} solved = yellow</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> less = red</span>
            </div>
          </>
        )}

        {dailyTarget > 0 && isUnlocked && (
          <>
            <p className="text-xs text-green-400 mb-4 font-semibold">🔓 Unlocked — update your goal or remove it.</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">New questions / day</label>
                <input type="number" min="1" max="20" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                  className="w-full sm:w-24 px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New lock code</label>
                <input type="text" value={lockCodeInput} onChange={e => setLockCodeInput(e.target.value)} placeholder="Set new code"
                  className="w-full sm:w-40 px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <button onClick={handleUpdateAndLock} disabled={!targetInput || !lockCodeInput.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
                🔒 Update & Lock
              </button>
            </div>
            <button onClick={handleRemoveTarget} className="px-4 py-2 bg-red-900 text-red-300 text-sm font-semibold rounded-lg hover:bg-red-800 transition-colors">
              Remove Goal Entirely
            </button>
          </>
        )}
      </div>

      {/* Activity Heatmap — green shades for any activity */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-bold text-gray-700 text-sm mb-1 flex items-center gap-2">🔥 Activity Heatmap</h2>
        <p className="text-xs text-gray-400 mb-4">Any question solved that day shows green</p>
        <StreakCalendar log={solvedLog} target={0} />
      </div>

      {/* Daily Police Heatmap — red/yellow/green vs daily target (default 3) */}
      {(() => {
        const policeTarget = dailyTarget > 0 ? dailyTarget : 3
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="font-bold text-gray-700 text-sm mb-1 flex items-center gap-2">🚔 Daily Plan Heatmap</h2>
            <p className="text-xs text-gray-400 mb-4">
              <span className="inline-flex items-center gap-1 mr-3"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> {policeTarget} solved — full day ✅</span>
              <span className="inline-flex items-center gap-1 mr-3"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> {policeTarget - 1} solved — partial</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> less — behind</span>
            </p>
            <StreakCalendar log={planLog} target={policeTarget} />
          </div>
        )
      })()}


      {/* Time Spent */}
      {totalTime > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">⏱ Time Spent</h2>
          <div className="text-3xl font-black text-indigo-600 mb-1">{totalTime}m</div>
          <p className="text-xs text-gray-400">total practice time across {Object.keys(timeData).length} questions</p>
        </div>
      )}

      {/* Study Pace Calculator */}
      <StudyPaceCalculator total={totalQ} solved={solvedQ} />
    </div>
  )
}

'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Timer, Zap, CheckCircle, XCircle, RotateCcw, Trophy, Lock, Unlock
} from 'lucide-react'
import { getProgress, updateProgress, getMockSessions, saveMockSession, type MockSessionRecord } from '@/lib/db'
import { formatTime } from '@/lib/utils'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import DifficultyBadge from '@/components/DifficultyBadge'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import CodePanel from '@/components/CodePanel'
import { createClient } from '@supabase/supabase-js'

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
  starter_python?: string
  starter_cpp?: string
}

type Phase = 'setup' | 'active' | 'done'
type Outcome = 'solved' | 'gave_up' | 'timeout'

// Re-export from db shape into local view shape
interface SessionRecord {
  date: string
  questionId?: number | null
  questionTitle?: string | null
  difficulty?: string | null
  outcome: Outcome
  elapsedSeconds: number
}

export default function MockInterviewPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [difficulty, setDifficulty] = useState('All')
  const [unseenOnly, setUnseenOnly] = useState(true)
  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(45 * 60)
  const [duration, setDuration] = useState(45 * 60)
  const [result, setResult] = useState<Outcome | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const [imageError, setImageError] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Answer unlocks after 2/3 of session
  const revealThreshold = Math.floor((duration * 2) / 3)
  const elapsed = duration - timeLeft
  const answerUnlocked = elapsed >= revealThreshold
  const timeUntilReveal = revealThreshold - elapsed

  const pct = Math.round((timeLeft / duration) * 100)
  const urgent = timeLeft < 5 * 60

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) { setLoading(false); return }
      load(uid)
    })
  }, [])

  async function load(uid: string) {
      const [qs, prog, rawSessions] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(uid),
        getMockSessions(uid, 20),
      ])
      setAllQuestions(qs as Question[])
      setProgress(prog)
      setSessions(rawSessions.map(s => ({
        date: s.date,
        questionId: s.question_id,
        questionTitle: s.question_title,
        difficulty: s.difficulty,
        outcome: s.outcome as Outcome,
        elapsedSeconds: s.elapsed_seconds,
      })))
      setLoading(false)
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const pickQuestion = useCallback((): Question | null => {
    let pool = allQuestions
    if (difficulty !== 'All') pool = pool.filter(q => q.difficulty === difficulty)
    if (unseenOnly) pool = pool.filter(q => !progress[String(q.id)]?.solved)
    if (!pool.length) pool = allQuestions.filter(q => difficulty === 'All' || q.difficulty === difficulty)
    if (!pool.length) pool = allQuestions
    if (!pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
  }, [allQuestions, difficulty, unseenOnly, progress])

  const endInterview = useCallback(async (outcome: Outcome, q?: Question) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setResult(outcome)
    setPhase('done')

    const elapsedSec = Math.round((Date.now() - (startTimeRef.current ?? Date.now())) / 1000)
    const activeQ = q || question

    const session: SessionRecord = {
      date: new Date().toISOString().split('T')[0],
      questionId: activeQ?.id,
      questionTitle: activeQ?.title,
      difficulty: activeQ?.difficulty,
      outcome,
      elapsedSeconds: elapsedSec,
    }

    // Persist to Supabase
    if (userId) {
      await saveMockSession(userId, {
        date: session.date,
        question_id: activeQ?.id ?? null,
        question_title: activeQ?.title ?? null,
        difficulty: activeQ?.difficulty ?? null,
        outcome,
        elapsed_seconds: elapsedSec,
        duration_seconds: duration,
        created_at: new Date().toISOString(),
      })
    }

    setSessions(prev => [session, ...prev].slice(0, 20))

    if (outcome === 'solved' && activeQ && userId) {
      await updateProgress(userId, activeQ.id, {
        solved: true,
        starred: progress[String(activeQ.id)]?.starred ?? false,
        notes: progress[String(activeQ.id)]?.notes ?? '',
        status: progress[String(activeQ.id)]?.status ?? null,
      })
    }
  }, [question, progress, duration, userId])

  const startInterview = () => {
    const q = pickQuestion()
    if (!q) return
    setQuestion(q)
    setTimeLeft(duration)
    setResult(null)
    setImageError(false)
    setPhase('active')
    startTimeRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          endInterview('timeout', q)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  if (loading) {
    return <div className="text-center py-32 text-gray-400 text-sm animate-pulse">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <Timer className="text-indigo-500" /> Mock Interview
      </h1>

      {/* SETUP */}
      {phase === 'setup' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 space-y-5">
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    difficulty === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Duration</p>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45].map(m => (
                <button
                  key={m}
                  onClick={() => setDuration(m * 60)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    duration === m * 60
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Answer/solution reveals after {Math.floor(revealThreshold / 60)} min — giving you time to attempt first.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={unseenOnly}
              onChange={e => setUnseenOnly(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
            <span className="text-sm text-gray-700 font-medium">Unseen (unsolved) questions only</span>
          </label>

          <button
            onClick={startInterview}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Zap size={16} /> Start Interview
          </button>

          {sessions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 mt-2">Recent Sessions</p>
              <div className="space-y-1.5">
                {sessions.slice(0, 5).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5 flex-wrap"
                  >
                    <span
                      className={`font-bold shrink-0 ${
                        s.outcome === 'solved'
                          ? 'text-green-600'
                          : s.outcome === 'timeout'
                          ? 'text-red-500'
                          : 'text-orange-500'
                      }`}
                    >
                      {s.outcome === 'solved' ? '✓' : s.outcome === 'timeout' ? '⏰' : '✗'}
                    </span>
                    <span className="truncate flex-1 min-w-0">{s.questionTitle}</span>
                    <span className="text-gray-400 shrink-0">{formatTime(s.elapsedSeconds || 0)}</span>
                    <span className="text-gray-300 shrink-0">{s.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE */}
      {phase === 'active' && question && (
        <div className="space-y-4">
          {/* Sticky timer bar */}
          <div
            className={`sticky top-14 z-10 rounded-2xl border p-4 ${
              urgent ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className={`text-4xl font-black font-mono shrink-0 ${urgent ? 'text-red-600 animate-pulse' : 'text-indigo-700'}`}>
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => endInterview('solved')}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-xs sm:text-sm"
                >
                  <CheckCircle size={14} /> <span className="hidden xs:inline">I </span>Solved ✓
                </button>
                <button
                  onClick={() => endInterview('gave_up')}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:border-red-300 hover:text-red-500 transition-colors text-xs sm:text-sm"
                >
                  <XCircle size={14} /> Give Up
                </button>
              </div>
            </div>
            <div className="w-full bg-white bg-opacity-70 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {!answerUnlocked && (
              <p className="text-xs mt-1.5 text-gray-500 flex items-center gap-1">
                <Lock size={10} /> Answer reveals in{' '}
                <span className="font-mono font-bold text-indigo-500">{formatTime(timeUntilReveal)}</span>
              </p>
            )}
            {answerUnlocked && (
              <p className="text-xs mt-1.5 text-green-600 font-semibold flex items-center gap-1">
                <Unlock size={10} /> Answer & solution now visible below
              </p>
            )}
          </div>

          {/* Question header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-4 pb-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-gray-400 font-mono">#{question.id}</span>
              <DifficultyBadge difficulty={question.difficulty} />
              {(question.source || []).map(s => (
                <span
                  key={s}
                  className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100"
                >
                  {s}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{question.title}</h2>
            {(question.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {question.tags.map(t => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Question image */}
          {!imageError && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <img
                src={`/question-images/${question.id}.jpg`}
                alt={question.title}
                className="w-full rounded-lg block"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Description */}
          {question.description && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Problem</h3>
              <DescriptionRenderer description={question.description} />
            </div>
          )}

          {/* Practice Editor — full features */}
          <LeetCodeEditor appQuestionId={question.id} slug={question.slug} />

          {/* Answer section — locked until reveal threshold */}
          <div className="rounded-xl border overflow-hidden">
            {!answerUnlocked ? (
              <div className="bg-gray-50 border-gray-200 p-8 text-center">
                <Lock size={28} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-bold text-gray-500 mb-1">Answer locked</p>
                <p className="text-xs text-gray-400">
                  Solution reveals in{' '}
                  <span className="font-mono font-bold text-indigo-500">{formatTime(timeUntilReveal)}</span> — keep trying!
                </p>
              </div>
            ) : (
              <div className="bg-white border-green-200">
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border-b border-green-200">
                  <Unlock size={14} className="text-green-600" />
                  <span className="text-sm font-bold text-green-700">Official Solution</span>
                  <span className="text-xs text-green-500 ml-auto">Review and compare with your approach</span>
                </div>
                {question.explanation && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-bold text-gray-500 mb-1">Approach</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
                  </div>
                )}
                <div className="p-3">
                  <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === 'done' && question && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 text-center space-y-4">
            <div className="text-5xl">
              {result === 'solved' ? '🏆' : result === 'timeout' ? '⏰' : '💪'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {result === 'solved' ? 'Solved!' : result === 'timeout' ? "Time's Up" : 'Keep Practicing'}
              </h2>
              <p className="text-sm text-gray-500">
                {result === 'solved'
                  ? 'Marked as solved and added to your spaced repetition.'
                  : result === 'timeout'
                  ? 'Time ran out — review the solution below.'
                  : "Don't worry — review the solution below and come back stronger."}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <DifficultyBadge difficulty={question.difficulty} />
                <span className="text-sm font-semibold text-gray-700">{question.title}</span>
              </div>
              {sessions[0] && (
                <p className="text-xs text-gray-400 mt-1">
                  Time taken: <span className="font-mono font-semibold">{formatTime(sessions[0].elapsedSeconds || 0)}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => { setPhase('setup'); setQuestion(null); setResult(null) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <RotateCcw size={15} /> Try Another
              </button>
              <button
                onClick={() => router.push(`/question/${question.id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-gray-400 transition-colors"
              >
                <Trophy size={15} /> View Full Question
              </button>
              <button
                onClick={() => router.push(`/practice/${question.id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-gray-400 transition-colors"
              >
                Go Practice
              </button>
            </div>
          </div>

          {/* Full solution on done screen */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
              <span className="text-sm font-bold text-green-700 flex items-center gap-2">
                <Unlock size={14} /> Official Solution
              </span>
            </div>
            {question.explanation && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-bold text-gray-500 mb-1">Approach</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
              </div>
            )}
            <div className="p-3">
              <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

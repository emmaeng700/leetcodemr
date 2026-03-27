'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Timer, Zap, CheckCircle, XCircle, RotateCcw, Trophy,
  Lock, Unlock, BookOpen, Code2, Loader2, ExternalLink,
} from 'lucide-react'
import { getProgress, updateProgress, getMockSessions, saveMockSession, type MockSessionRecord } from '@/lib/db'
import { formatTime } from '@/lib/utils'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'

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

type Phase = 'setup' | 'active' | 'done'
type Outcome = 'solved' | 'gave_up' | 'timeout'

interface SessionRecord {
  date: string
  questionId?: number | null
  questionTitle?: string | null
  difficulty?: string | null
  outcome: Outcome
  elapsedSeconds: number
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
  const [leftTab, setLeftTab] = useState<'description' | 'solution'>('description')
  const [mobilePanel, setMobilePanel] = useState<'description' | 'editor'>('description')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Live LeetCode description
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  const revealThreshold = Math.floor((duration * 2) / 3)
  const elapsed = duration - timeLeft
  const answerUnlocked = elapsed >= revealThreshold
  const timeUntilReveal = revealThreshold - elapsed
  const pct = Math.round((timeLeft / duration) * 100)
  const urgent = timeLeft < 5 * 60

  useEffect(() => {
    async function load() {
      const [qs, prog, rawSessions] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getMockSessions(20),
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
    load()
  }, [])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // Fetch live LeetCode description when question changes
  useEffect(() => {
    if (!question?.slug) return
    let cancelled = false
    setLcContent(null)
    setIsPremium(false)
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
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug: question.slug },
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
  }, [question?.slug])

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
    await saveMockSession({
      date: session.date,
      question_id: activeQ?.id ?? null,
      question_title: activeQ?.title ?? null,
      difficulty: activeQ?.difficulty ?? null,
      outcome,
      elapsed_seconds: elapsedSec,
      duration_seconds: duration,
      created_at: new Date().toISOString(),
    })
    setSessions(prev => [session, ...prev].slice(0, 20))
    if (outcome === 'solved' && activeQ) {
      await updateProgress(activeQ.id, {
        solved: true,
        starred: progress[String(activeQ.id)]?.starred ?? false,
        notes: progress[String(activeQ.id)]?.notes ?? '',
        status: progress[String(activeQ.id)]?.status ?? null,
      })
    }
  }, [question, progress, duration])

  const startInterview = () => {
    const q = pickQuestion()
    if (!q) return
    setQuestion(q)
    setTimeLeft(duration)
    setResult(null)
    setLeftTab('description')
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

  if (loading) return <div className="text-center py-32 text-gray-400 text-sm animate-pulse">Loading...</div>

  /* ── SETUP ── */
  if (phase === 'setup') return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <Timer className="text-indigo-500" /> Mock Interview
      </h1>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 space-y-5">
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${difficulty === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">Duration</p>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 45].map(m => (
              <button key={m} onClick={() => setDuration(m * 60)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${duration === m * 60 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                {m} min
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Solution reveals after {Math.floor(Math.floor((duration * 2) / 3) / 60)} min — attempt first.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={unseenOnly} onChange={e => setUnseenOnly(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 rounded" />
          <span className="text-sm text-gray-700 font-medium">Unseen (unsolved) questions only</span>
        </label>
        <button onClick={startInterview}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2">
          <Zap size={16} /> Start Interview
        </button>
        {sessions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">Recent Sessions</p>
            <div className="space-y-1.5">
              {sessions.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5 flex-wrap">
                  <span className={`font-bold shrink-0 ${s.outcome === 'solved' ? 'text-green-600' : s.outcome === 'timeout' ? 'text-red-500' : 'text-orange-500'}`}>
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
    </div>
  )

  /* ── ACTIVE ── */
  if (phase === 'active' && question) return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Timer top bar */}
      <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 border-b shrink-0 flex-wrap ${urgent ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'}`}>
        {/* Countdown */}
        <div className={`text-2xl font-black font-mono shrink-0 ${urgent ? 'text-red-600 animate-pulse' : 'text-indigo-700'}`}>
          {formatTime(timeLeft)}
        </div>

        {/* Progress bar */}
        <div className="flex-1 bg-white bg-opacity-70 rounded-full h-2 overflow-hidden min-w-[80px]">
          <div className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }} />
        </div>

        {/* Lock status */}
        <div className="text-xs shrink-0 hidden sm:block">
          {answerUnlocked
            ? <span className="text-green-600 font-semibold flex items-center gap-1"><Unlock size={11} /> Solution visible</span>
            : <span className="text-gray-500 flex items-center gap-1"><Lock size={11} /> Reveals in {formatTime(timeUntilReveal)}</span>
          }
        </div>

        {/* Question info — hidden on mobile to save space */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-mono">#{question.id}</span>
          <DifficultyBadge difficulty={question.difficulty} />
          <a href={`https://leetcode.com/problems/${question.slug}/`} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 hover:text-orange-400 transition-colors"><ExternalLink size={12} /></a>
        </div>

        {/* Action buttons */}
        <button onClick={() => endInterview('solved')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xs shrink-0">
          <CheckCircle size={13} /> Solved ✓
        </button>
        <button onClick={() => endInterview('gave_up')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-gray-200 text-gray-600 font-semibold rounded-lg hover:border-red-300 hover:text-red-500 transition-colors text-xs shrink-0">
          <XCircle size={13} /> Give Up
        </button>
      </div>

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

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — question */}
        <div className={`${mobilePanel === 'description' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-gray-100 overflow-hidden`}>
          <div className="flex border-b border-gray-100 bg-white shrink-0">
            <button onClick={() => setLeftTab('description')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <BookOpen size={12} /> Description
              {lcLoading && <Loader2 size={10} className="animate-spin text-gray-300 ml-0.5" />}
            </button>
            {answerUnlocked && (
              <button onClick={() => setLeftTab('solution')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'solution' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Unlock size={12} /> Solution
              </button>
            )}
            {!answerUnlocked && (
              <div className="flex items-center gap-1 px-4 py-2.5 text-xs text-gray-300">
                <Lock size={11} /> Solution locked
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === 'description' && (
              <div>
                <h2 className="font-bold text-gray-800 text-base mb-2">{question.title}</h2>
                {(question.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {question.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                )}

                {/* Live LeetCode description */}
                {lcContent ? (
                  <div className="lc-description text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: lcContent }} />
                ) : isPremium ? (
                  <PremiumBlock slug={question.slug} />
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
                    {question.description || <span className="text-gray-400 italic text-xs">No local description. <a href={`https://leetcode.com/problems/${question.slug}/`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a></span>}
                  </div>
                )}
              </div>
            )}

            {leftTab === 'solution' && answerUnlocked && (
              <div>
                {question.explanation && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-xs font-bold text-green-700 mb-1">Approach</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
                  </div>
                )}
                <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — editor */}
        <div className={`${mobilePanel === 'editor' ? 'flex flex-col' : 'hidden'} md:flex flex-1 min-h-0 overflow-x-hidden`}>
          <LeetCodeEditor appQuestionId={question.id} slug={question.slug} />
        </div>
      </div>

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

  /* ── DONE ── */
  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 text-center space-y-4">
        <div className="text-5xl">{result === 'solved' ? '🏆' : result === 'timeout' ? '⏰' : '💪'}</div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {result === 'solved' ? 'Solved!' : result === 'timeout' ? "Time's Up" : 'Keep Practicing'}
          </h2>
          <p className="text-sm text-gray-500">
            {result === 'solved'
              ? 'Marked as solved and added to spaced repetition.'
              : result === 'timeout'
              ? 'Time ran out — review the solution below.'
              : "Don't worry — review the solution and come back stronger."}
          </p>
        </div>
        {question && (
          <div className="bg-gray-50 rounded-xl p-3 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <DifficultyBadge difficulty={question.difficulty} />
              <span className="text-sm font-semibold text-gray-700">{question.title}</span>
            </div>
            {sessions[0] && (
              <p className="text-xs text-gray-400 mt-1">Time taken: <span className="font-mono font-semibold">{formatTime(sessions[0].elapsedSeconds || 0)}</span></p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => { setPhase('setup'); setQuestion(null); setResult(null) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            <RotateCcw size={15} /> Try Another
          </button>
          {question && (
            <button onClick={() => router.push(`/practice/${question.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-gray-400 transition-colors">
              <Trophy size={15} /> Open in Practice
            </button>
          )}
        </div>
      </div>

      {/* Full solution on done screen */}
      {question && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
            <span className="text-sm font-bold text-green-700 flex items-center gap-2"><Unlock size={14} /> Official Solution</span>
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
  )
}

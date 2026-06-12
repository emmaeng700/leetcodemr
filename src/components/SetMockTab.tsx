'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, CheckCircle, XCircle, RotateCcw, ExternalLink, Play } from 'lucide-react'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import { getSetProgress, updateSetQProgress } from '@/lib/setProgress'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

type Phase = 'setup' | 'active' | 'done'
type Outcome = 'solved' | 'gave_up' | 'timeout'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function SetMockTab({ set }: Props) {
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')
  const [difficulty, setDifficulty] = useState('All')
  const [category, setCategory] = useState('All')
  const [unseenOnly, setUnseenOnly] = useState(false)
  const [duration, setDuration] = useState(45 * 60)
  const [timeLeft, setTimeLeft] = useState(45 * 60)
  const [question, setQuestion] = useState<SetQuestion | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [history, setHistory] = useState<{ q: SetQuestion; outcome: Outcome; elapsed: number }[]>([])
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progress, setProgress] = useState<Record<string, ReturnType<typeof getSetProgress>[string]>>({})

  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds) : getSet3Questions(mainIds)
      setQuestions(qs)
      setProgress(getSetProgress(set))
      setLoading(false)
    }
    load()
  }, [set])

  const categories = ['All', ...Array.from(new Set(questions.map(q => q.category))).sort()]

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  function pickQuestion() {
    let pool = questions
    if (difficulty !== 'All') pool = pool.filter(q => q.difficulty === difficulty)
    if (category !== 'All') pool = pool.filter(q => q.category === category)
    if (unseenOnly) pool = pool.filter(q => !progress[String(q.id)]?.solved)
    if (pool.length === 0) pool = questions
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function startSession() {
    const q = pickQuestion()
    if (!q) return
    setQuestion(q)
    setTimeLeft(duration)
    setOutcome(null)
    setPhase('active')
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          stopTimer()
          setOutcome('timeout')
          setPhase('done')
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function finish(o: Outcome) {
    stopTimer()
    setOutcome(o)
    setPhase('done')
    const elapsed = Math.round((Date.now() - startRef.current) / 1000)
    if (question) {
      setHistory(h => [{ q: question, outcome: o, elapsed }, ...h.slice(0, 9)])
      if (o === 'solved') {
        const updated = updateSetQProgress(set, question.id, { solved: true })
        setProgress(prev => ({ ...prev, [String(question.id)]: updated }))
      }
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm animate-pulse">
      Loading…
    </div>
  )

  const pct = Math.round((timeLeft / duration) * 100)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Timer size={18} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="font-black text-[var(--text)] text-base">Mock Interview — Set {set}</h2>
          <p className="text-xs text-[var(--text-subtle)]">Timed practice with Set {set} questions</p>
        </div>
      </div>

      {phase === 'setup' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    difficulty === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    category === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Duration</p>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60].map(m => (
                <button key={m} onClick={() => setDuration(m * 60)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    duration === m * 60 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}>{m} min</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={unseenOnly} onChange={e => setUnseenOnly(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)]" />
            <span className="text-xs text-[var(--text-subtle)]">Unsolved questions only</span>
          </label>
          <button onClick={startSession}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors">
            <Play size={14} /> Start Session
          </button>
        </div>
      )}

      {phase === 'active' && question && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Timer size={14} className={timeLeft < 300 ? 'text-red-500' : 'text-indigo-500'} />
                <span className={`font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-[var(--text)]'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="flex-1 mx-4 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${timeLeft < 300 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: pct + '%' }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-[var(--text-subtle)] font-mono">#{question.id}</span>
              <DifficultyBadge difficulty={question.difficulty} />
              <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{question.category}</span>
            </div>
            <h3 className="font-bold text-lg text-[var(--text)] mb-3">{question.title}</h3>
            <a href={`https://leetcode.com/problems/${question.slug}/`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors mb-3">
              <ExternalLink size={13} /> Open on LeetCode
            </a>
          </div>
          <div className="flex gap-2">
            <button onClick={() => finish('solved')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors">
              <CheckCircle size={15} /> Solved
            </button>
            <button onClick={() => finish('gave_up')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm hover:border-red-400 hover:text-red-400 transition-colors">
              <XCircle size={15} /> Give Up
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && question && (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 text-center ${
            outcome === 'solved' ? 'bg-green-50 border-green-200' : outcome === 'timeout' ? 'bg-amber-50 border-amber-200' : 'bg-[var(--bg-card)] border-[var(--border)]'
          }`}>
            <div className="text-3xl mb-2">
              {outcome === 'solved' ? '🎉' : outcome === 'timeout' ? '⏰' : '🤔'}
            </div>
            <p className="font-black text-[var(--text)] text-base">
              {outcome === 'solved' ? 'Solved!' : outcome === 'timeout' ? 'Time\'s Up' : 'Gave Up'}
            </p>
            <p className="text-sm text-[var(--text-subtle)] mt-1">{question.title}</p>
          </div>
          <button onClick={() => { setPhase('setup'); setQuestion(null); setOutcome(null) }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors">
            <RotateCcw size={13} /> New Session
          </button>
        </div>
      )}

      {history.length > 0 && phase !== 'active' && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-3">Recent Sessions</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5">
                <span className="text-base">{h.outcome === 'solved' ? '✅' : h.outcome === 'timeout' ? '⏰' : '❌'}</span>
                <span className="flex-1 text-sm text-[var(--text)] truncate">{h.q.title}</span>
                <DifficultyBadge difficulty={h.q.difficulty} />
                <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">{formatTime(h.elapsed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

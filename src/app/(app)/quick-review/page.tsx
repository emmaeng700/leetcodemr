'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Pause, Play, SkipForward, RotateCcw, Zap, CheckCircle } from 'lucide-react'
import { shuffle, stripScripts } from '@/lib/utils'
import { DIFFICULTY_LEVELS, QUESTION_SOURCES } from '@/lib/constants'
import { getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import QuestionImage from '@/components/QuestionImage'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
}

const Q_SECS = 15
const SOL_SECS = 15

export default function QuickReviewPage() {
  const [all, setAll] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [deck, setDeck] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDiff, setFilterDiff] = useState('All')
  const [filterSrc, setFilterSrc] = useState('All')

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'question' | 'solution' | 'done'>('question')
  const [timeLeft, setTimeLeft] = useState(Q_SECS)
  const [paused, setPaused] = useState(false)
  const [started, setStarted] = useState(false)

  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

  const startedAtRef = useRef<number | null>(null)
  const phaseRef = useRef<'question' | 'solution' | 'done'>('question')
  const idxRef = useRef(0)
  const pausedRef = useRef(false)
  const deckRef = useRef<Question[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { idxRef.current = idx }, [idx])
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { deckRef.current = deck }, [deck])

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getStudyPlan(),
    ]).then(([qs, plan]) => {
      setAll(qs)
      if (plan?.question_order?.length) {
        setPlanOrder(plan.question_order)
      } else {
        setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!all.length || !planOrder.length) return
    const qMap = Object.fromEntries(all.map(q => [q.id, q]))
    // Follow plan order, then apply filters
    const ordered = planOrder.map(id => qMap[id]).filter(Boolean) as Question[]
    let filtered = ordered
    if (filterDiff !== 'All') filtered = filtered.filter(q => q.difficulty === filterDiff)
    if (filterSrc !== 'All') filtered = filtered.filter(q => (q.source || []).includes(filterSrc))
    setDeck(filtered)
    deckRef.current = filtered
    resetSession(filtered)
  }, [filterDiff, filterSrc, all, planOrder])

  const stopTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const resetSession = (newDeck?: Question[]) => {
    stopTimer()
    setIdx(0); idxRef.current = 0
    setPhase('question'); phaseRef.current = 'question'
    setTimeLeft(Q_SECS)
    setPaused(false); pausedRef.current = false
    setStarted(false)
    startedAtRef.current = null
    if (newDeck) deckRef.current = newDeck
  }

  const advancePhase = useCallback(() => {
    const currentPhase = phaseRef.current
    const currentIdx = idxRef.current
    const currentDeck = deckRef.current

    if (currentPhase === 'question') {
      phaseRef.current = 'solution'
      setPhase('solution')
      setTimeLeft(SOL_SECS)
      startedAtRef.current = Date.now()
    } else {
      const nextIdx = currentIdx + 1
      if (nextIdx >= currentDeck.length) {
        stopTimer()
        phaseRef.current = 'done'
        setPhase('done')
      } else {
        idxRef.current = nextIdx
        setIdx(nextIdx)
        phaseRef.current = 'question'
        setPhase('question')
        setTimeLeft(Q_SECS)
        startedAtRef.current = Date.now()
      }
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    startedAtRef.current = Date.now()
    const totalSecs = phaseRef.current === 'question' ? Q_SECS : SOL_SECS

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return
      const elapsed = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)
      const tl = Math.max(0, totalSecs - elapsed)
      setTimeLeft(tl)
      if (tl === 0) advancePhase()
    }, 300)
  }, [advancePhase])

  useEffect(() => {
    if (!started || phase === 'done') return
    startTimer()
    return () => stopTimer()
  }, [phase, started])

  const handleStart = () => {
    setStarted(true)
    setPhase('question')
    phaseRef.current = 'question'
    setTimeLeft(Q_SECS)
    startedAtRef.current = Date.now()
  }

  const togglePause = () => {
    if (paused) {
      startedAtRef.current = Date.now() - (totalPhase - timeLeft) * 1000
      setPaused(false); pausedRef.current = false
    } else {
      setPaused(true); pausedRef.current = true
    }
  }

  const skip = () => {
    stopTimer()
    advancePhase()
    if (phaseRef.current !== 'done') {
      startedAtRef.current = Date.now()
      startTimer()
    }
  }

  useEffect(() => () => stopTimer(), [])

  // Fetch live LeetCode description when question changes
  useEffect(() => {
    const slug = deck[idx]?.slug
    if (!slug) return
    setLcContent(lcCacheRef.current[slug] ?? null)
    setIsPremium(false)
    if (lcCacheRef.current[slug]) return
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
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
        variables: { titleSlug: slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[slug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [deck, idx])

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading…</div>

  const q = deck[idx] || null
  const totalPhase = phase === 'question' ? Q_SECS : SOL_SECS
  const progress = phase === 'done' ? 1 : timeLeft / totalPhase
  const overall = deck.length ? (idx + (phase === 'solution' ? 0.5 : 0)) / deck.length : 0
  const urgent = timeLeft <= 20 && started && phase !== 'done'

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')

  const isQuestion = phase === 'question'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <Zap className="text-yellow-500" /> Quick Review
          </h1>
          <p className="text-xs text-[var(--text-subtle)] mt-0.5">
            Automatic · {Q_SECS}s question → {SOL_SECS}s solution → next · {deck.length} questions
          </p>
        </div>
        <button
          onClick={() => resetSession()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--text-subtle)] transition-colors bg-[var(--bg-card)]"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DIFFICULTY_LEVELS.map(d => (
          <button key={d} onClick={() => setFilterDiff(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
            }`}>{d}</button>
        ))}
        <div className="w-px bg-[var(--border)] mx-0.5 shrink-0" />
        {QUESTION_SOURCES.map(s => (
          <button key={s.value} onClick={() => setFilterSrc(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              filterSrc === s.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
            }`}>{s.label}</button>
        ))}
      </div>

      {started && phase !== 'done' && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[var(--text-subtle)] mb-1">
            <span>{idx + 1} / {deck.length} questions</span>
            <span>{Math.round(overall * 100)}% through session</span>
          </div>
          <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
            <div className="h-full bg-indigo-300 rounded-full transition-all duration-500" style={{ width: `${overall * 100}%` }} />
          </div>
        </div>
      )}

      {phase === 'done' ? (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-green-200 shadow-md p-6 sm:p-10 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[var(--text)] mb-2">Session Complete! 🎉</h2>
          <p className="text-sm text-[var(--text-subtle)] mb-8">
            You reviewed all <strong>{deck.length}</strong> questions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { resetSession(); setTimeout(handleStart, 50) }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <RotateCcw size={16} /> Start Over
            </button>
            <button
              onClick={() => resetSession()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bg-card)] border-2 border-[var(--border)] text-[var(--text-muted)] font-bold rounded-xl hover:border-[var(--text-subtle)] transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      ) : !started ? (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-md p-6 sm:p-10 text-center">
          <Zap size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-[var(--text)] mb-2">Ready to Study?</h2>
          <p className="text-sm text-[var(--text-subtle)] mb-2">The session runs automatically:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-[var(--text-muted)] mb-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-indigo-600">{Q_SECS}s</span>
              <span className="text-xs">View question</span>
            </div>
            <div className="text-[var(--text-subtle)] text-2xl self-center">→</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-green-600">{SOL_SECS}s</span>
              <span className="text-xs">Study solution</span>
            </div>
            <div className="text-[var(--text-subtle)] text-2xl self-center">→</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-[var(--text-muted)]">{deck.length}</span>
              <span className="text-xs">questions</span>
            </div>
          </div>
          <button
            onClick={handleStart}
            className="flex items-center justify-center gap-2 mx-auto px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-base"
          >
            <Play size={18} /> Start Session
          </button>
        </div>
      ) : (
        q && (
          <div className={`bg-[var(--bg-card)] rounded-2xl border shadow-md overflow-hidden transition-all ${
            isQuestion ? 'border-indigo-200' : 'border-green-200'
          }`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${
              isQuestion
                ? urgent ? 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-500/30' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-500/30'
                : urgent ? 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-500/30' : 'bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-500/30'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  isQuestion ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300'
                }`}>
                  {isQuestion ? '📖 Question' : '💡 Solution'}
                </span>
                <DifficultyBadge difficulty={q.difficulty} />
                <span className="text-xs text-[var(--text-subtle)] font-mono truncate hidden sm:inline">#{q.id} {q.title}</span>
              </div>
              <span className={`text-2xl font-black tabular-nums shrink-0 ml-3 ${
                urgent ? 'text-red-500' : isQuestion ? 'text-indigo-600' : 'text-green-600'
              }`}>
                {mm}:{ss}
              </span>
            </div>

            <div className={`h-1.5 ${isQuestion ? 'bg-indigo-100' : 'bg-green-100'}`}>
              <div
                className={`h-full transition-all duration-300 ${
                  urgent ? 'bg-red-400' : isQuestion ? 'bg-indigo-500' : 'bg-green-500'
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="p-5">
              {isQuestion ? (
                <div>
                  <p className="text-sm font-bold text-[var(--text)] mb-3">{q.title}</p>
                  {lcContent ? (
                    <div className="lc-description text-sm text-[var(--text)]"
                      dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                  ) : lcLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                      <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-2" />
                      <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    </div>
                  ) : isPremium ? (
                    <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium question</p>
                  ) : (
                    <QuestionImage questionId={q.id} alt={q.title} />
                  )}
                </div>
              ) : (
                <div onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">{q.title}</p>
                  <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePause}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    paused
                      ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-subtle)]'
                  }`}
                >
                  {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
                </button>
                <button
                  onClick={skip}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--text-subtle)] transition-colors"
                >
                  <SkipForward size={13} /> Skip
                </button>
              </div>
              <span className="text-xs text-[var(--text-subtle)] font-mono">{idx + 1} / {deck.length}</span>
            </div>
          </div>
        )
      )}

      {paused && phase !== 'done' && (
        <div className="mt-3 text-center text-xs text-indigo-500 font-semibold animate-pulse">
          ⏸ Paused — press Resume to continue
        </div>
      )}
    </div>
  )
}

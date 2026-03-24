'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Pause, Play, SkipForward, RotateCcw, Zap, CheckCircle } from 'lucide-react'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
}

const Q_SECS = 15
const SOL_SECS = 15
const DIFFS = ['All', 'Easy', 'Medium', 'Hard']
const SOURCES = [
  { label: 'All',           value: 'All' },
  { label: 'Grind 169',     value: 'Grind 169' },
  { label: 'Denny Zhang',   value: 'Denny Zhang' },
  { label: 'Premium 98',    value: 'Premium 98' },
  { label: 'CodeSignal 21', value: 'CodeSignal' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuickReviewPage() {
  const [all, setAll] = useState<Question[]>([])
  const [deck, setDeck] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDiff, setFilterDiff] = useState('All')
  const [filterSrc, setFilterSrc] = useState('All')

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'question' | 'solution' | 'done'>('question')
  const [timeLeft, setTimeLeft] = useState(Q_SECS)
  const [paused, setPaused] = useState(false)
  const [started, setStarted] = useState(false)

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
    fetch('/questions_full.json').then(r => r.json()).then(qs => {
      setAll(qs)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!all.length) return
    let filtered = all
    if (filterDiff !== 'All') filtered = filtered.filter(q => q.difficulty === filterDiff)
    if (filterSrc !== 'All') filtered = filtered.filter(q => (q.source || []).includes(filterSrc))
    const newDeck = shuffle(filtered)
    setDeck(newDeck)
    deckRef.current = newDeck
    resetSession(newDeck)
  }, [filterDiff, filterSrc, all])

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

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading…</div>

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
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="text-yellow-500" /> Quick Review
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Automatic · {Q_SECS}s question → {SOL_SECS}s solution → next · {deck.length} questions
          </p>
        </div>
        <button
          onClick={() => resetSession()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-500 hover:border-gray-400 transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DIFFS.map(d => (
          <button key={d} onClick={() => setFilterDiff(d)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
            }`}>{d}</button>
        ))}
        <div className="w-px bg-gray-200 mx-0.5" />
        {SOURCES.map(s => (
          <button key={s.value} onClick={() => setFilterSrc(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterSrc === s.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
            }`}>{s.label}</button>
        ))}
      </div>

      {started && phase !== 'done' && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{idx + 1} / {deck.length} questions</span>
            <span>{Math.round(overall * 100)}% through session</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-300 rounded-full transition-all duration-500" style={{ width: `${overall * 100}%` }} />
          </div>
        </div>
      )}

      {phase === 'done' ? (
        <div className="bg-white rounded-2xl border border-green-200 shadow-md p-6 sm:p-10 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">Session Complete! 🎉</h2>
          <p className="text-sm text-gray-500 mb-8">
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
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:border-gray-400 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      ) : !started ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-10 text-center">
          <Zap size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-gray-800 mb-2">Ready to Study?</h2>
          <p className="text-sm text-gray-400 mb-2">The session runs automatically:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 mb-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-indigo-600">{Q_SECS}s</span>
              <span className="text-xs">View question</span>
            </div>
            <div className="text-gray-300 text-2xl self-center">→</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-green-600">{SOL_SECS}s</span>
              <span className="text-xs">Study solution</span>
            </div>
            <div className="text-gray-300 text-2xl self-center">→</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-gray-600">{deck.length}</span>
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
          <div className={`bg-white rounded-2xl border shadow-md overflow-hidden transition-all ${
            isQuestion ? 'border-indigo-200' : 'border-green-200'
          }`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${
              isQuestion
                ? urgent ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'
                : urgent ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  isQuestion ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'
                }`}>
                  {isQuestion ? '📖 Question' : '💡 Solution'}
                </span>
                <DifficultyBadge difficulty={q.difficulty} />
                <span className="text-xs text-gray-500 font-mono truncate hidden sm:inline">#{q.id} {q.title}</span>
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
                <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 min-h-48">
                  <img
                    src={`/question-images/${q.id}.jpg`}
                    alt={q.title}
                    className="w-full block"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const next = (e.target as HTMLElement).nextSibling as HTMLElement
                      if (next) next.style.display = 'flex'
                    }}
                  />
                  <div style={{ display: 'none' }} className="flex-col items-center justify-center py-16 w-full text-center text-gray-400">
                    <p className="text-sm font-semibold text-gray-700 mb-3">{q.title}</p>
                  </div>
                </div>
              ) : (
                <div onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-700 mb-3">{q.title}</p>
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
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
                </button>
                <button
                  onClick={skip}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border bg-white text-gray-500 border-gray-200 hover:border-gray-400 transition-colors"
                >
                  <SkipForward size={13} /> Skip
                </button>
              </div>
              <span className="text-xs text-gray-400 font-mono">{idx + 1} / {deck.length}</span>
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

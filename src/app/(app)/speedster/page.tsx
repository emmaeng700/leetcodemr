'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'

interface Question {
  id: number
  title: string
  difficulty: string
  slug: string
  tags: string[]
  source: string[]
  description?: string
  python_solution?: string
  cpp_solution?: string
}

export default function SpeedsterPage() {
  const [questions, setQuestions]   = useState<Question[]>([])
  const [planOrder, setPlanOrder]   = useState<number[]>([])
  const [progress,  setProgress]    = useState<Record<string, any>>({})
  const [perDay,    setPerDay]       = useState(3)
  const [loading,   setLoading]     = useState(true)

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading,  setFading]  = useState(false)

  useEffect(() => {
    async function load() {
      const [qs, plan, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
        getProgress(),
      ])
      setQuestions(qs)
      setProgress(prog)
      if (plan?.question_order?.length) {
        setPlanOrder(plan.question_order)
        setPerDay(plan.per_day || 3)
      } else {
        setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  const qMap  = Object.fromEntries(questions.map(q => [q.id, q]))
  const total = planOrder.length
  const currentQ = qMap[planOrder[cardIdx]]

  // Fade helper — same as flashcards page
  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    fadeSwap(() => setFlipped(f => !f))
  }, [fadeSwap])

  const go = useCallback((dir: number) => {
    fadeSwap(() => {
      setFlipped(false)
      setCardIdx(i => Math.max(0, Math.min(total - 1, i + dir)))
    })
  }, [total, fadeSwap])

  const reset = () => fadeSwap(() => { setCardIdx(0); setFlipped(false) })

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft')  go(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, handleFlip])

  // Group by day for list
  const days: number[][] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push(planOrder.slice(i, i + perDay))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading...
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center">
          <Gauge size={18} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-lg">Speedster</h1>
          <p className="text-xs text-gray-400">Learn any question in plan order — submissions won't mark as solved</p>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-6 mb-12">
        {days.map((dayIds, dayIdx) => (
          <div key={dayIdx}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Day {dayIdx + 1}</p>
            <div className="space-y-1.5">
              {dayIds.map((qid) => {
                const q = qMap[qid]
                if (!q) return null
                const solved = !!progress[String(qid)]?.solved
                return (
                  <Link key={qid} href={`/speedster/${qid}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${
                      solved ? 'bg-green-50 border-green-100 hover:border-green-200'
                             : 'bg-white border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/30'
                    }`}>
                    <div className="shrink-0">
                      {solved
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <Circle size={16} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />}
                    </div>
                    <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                    <span className={`flex-1 text-sm font-medium truncate ${solved ? 'text-green-700' : 'text-gray-700'}`}>
                      {q.title}
                    </span>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Flashcard section ── */}
      <div className="border-t-2 border-dashed border-yellow-200 pt-8">

        {/* Flashcard header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              ⚡ Flashcards
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Tap card to flip · ← → to navigate · Space to flip</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 mb-5">
          <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-full">
            {total === 0 ? '0 / 0' : `${cardIdx + 1} / ${total}`}
          </span>
          <button onClick={reset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border bg-white text-gray-500 border-gray-200 hover:border-gray-400 transition-colors">
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        {currentQ && (
          <>
            {/* Card — click to flip */}
            <div
              onClick={handleFlip}
              className="cursor-pointer select-none"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
            >
              {!flipped ? (
                /* FRONT */
                <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      {(currentQ.source || []).map(s => (
                        <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">{s}</span>
                      ))}
                    </div>
                    <span className="hidden sm:inline text-xs text-gray-300 font-medium">Tap to reveal →</span>
                  </div>

                  <div className="px-5 py-3">
                    <h3 className="text-lg font-bold text-gray-800">{currentQ.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(currentQ.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <img
                      src={`/question-images/${currentQ.id}.jpg`}
                      alt={currentQ.title}
                      className="w-full rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
              ) : (
                /* BACK */
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-2 border-b border-indigo-100 bg-indigo-50">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      <span className="text-sm font-bold text-indigo-700 truncate">{currentQ.title}</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-medium shrink-0">← Flip back</span>
                  </div>

                  <div className="p-4" onClick={e => e.stopPropagation()}>
                    <CodePanel pythonCode={currentQ.python_solution} cppCode={currentQ.cpp_solution} />
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5">
              <button onClick={() => go(-1)} disabled={cardIdx === 0}
                className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} /> Prev
              </button>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[160px] sm:max-w-none">
                {total <= 15 ? (
                  planOrder.map((_, i) => (
                    <button key={i} onClick={() => { setCardIdx(i); setFlipped(false) }}
                      className={`rounded-full transition-all ${i === cardIdx ? 'w-3 h-3 bg-yellow-500' : 'w-2 h-2 bg-gray-200 hover:bg-gray-400'}`}
                    />
                  ))
                ) : (
                  <span className="text-xs text-gray-400 font-mono">{cardIdx + 1} / {total}</span>
                )}
              </div>

              <button onClick={() => go(1)} disabled={cardIdx === total - 1}
                className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

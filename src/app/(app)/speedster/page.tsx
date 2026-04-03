'use client'
import { useState, useEffect, useCallback } from 'react'
import { Gauge, CheckCircle, Circle, ChevronLeft, ChevronRight, RotateCcw, List, X } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import Link from 'next/link'

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
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress,  setProgress]  = useState<Record<string, any>>({})
  const [loading,   setLoading]   = useState(true)
  const [cardIdx,   setCardIdx]   = useState(0)
  const [flipped,   setFlipped]   = useState(false)
  const [fading,    setFading]    = useState(false)
  const [showList,  setShowList]  = useState(false)

  useEffect(() => {
    async function load() {
      const [qs, plan, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
        getProgress(),
      ])
      setQuestions(qs)
      setProgress(prog)
      setPlanOrder(
        plan?.question_order?.length
          ? plan.question_order
          : (qs as Question[]).map((q: Question) => q.id)
      )
      setLoading(false)
    }
    load()
  }, [])

  const qMap    = Object.fromEntries(questions.map(q => [q.id, q]))
  const total   = planOrder.length
  const current = qMap[planOrder[cardIdx]]

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 160)
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

  const jumpTo = (i: number) => {
    fadeSwap(() => { setFlipped(false); setCardIdx(i) })
    setShowList(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft')  go(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, handleFlip])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading…
    </div>
  )

  const solved = !!progress[String(current?.id)]?.solved

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
            <Gauge size={18} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-lg leading-tight">Speedster</h1>
            <p className="text-xs text-gray-400">Tap card to flip · ← → keys to navigate</p>
          </div>
        </div>

        {/* Counter + controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full tabular-nums">
            {total === 0 ? '0 / 0' : `${cardIdx + 1} / ${total}`}
          </span>
          <button onClick={() => fadeSwap(() => { setCardIdx(0); setFlipped(false) })}
            title="Reset to start"
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <RotateCcw size={14} />
          </button>
          {/* Question list picker */}
          <div className="relative">
            <button onClick={() => setShowList(v => !v)}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
              {showList ? <X size={14} /> : <List size={14} />}
            </button>
            {showList && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-72 max-h-80 overflow-y-auto">
                {planOrder.map((qid, i) => {
                  const q = qMap[qid]
                  if (!q) return null
                  const done = !!progress[String(qid)]?.solved
                  return (
                    <button key={qid} onClick={() => jumpTo(i)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-yellow-50 border-b border-gray-50 last:border-0 transition-colors ${i === cardIdx ? 'bg-yellow-50' : ''}`}>
                      {done
                        ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                        : <Circle size={13} className="text-gray-200 shrink-0" />}
                      <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{q.id}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{q.title}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: total ? `${((cardIdx + 1) / total) * 100}%` : '0%' }} />
      </div>

      {/* Card */}
      {current && (
        <>
          <div onClick={handleFlip} className="cursor-pointer select-none"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.16s ease' }}>

            {!flipped ? (
              /* FRONT */
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden min-h-[55vh] flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">#{current.id}</span>
                    <DifficultyBadge difficulty={current.difficulty} />
                    {solved && <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">✓ Solved</span>}
                    {(current.source || []).map(s => (
                      <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">{s}</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-300 font-medium">Tap to reveal →</span>
                </div>

                <div className="px-5 py-3">
                  <h3 className="text-xl font-bold text-gray-800">{current.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(current.tags || []).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center px-5 pb-5">
                  <img
                    src={`/question-images/${current.id}.jpg`}
                    alt={current.title}
                    className="w-full rounded-xl object-contain"
                    style={{ maxHeight: 'min(52vh, 480px)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400 font-mono">#{current.id}</span>
                    <DifficultyBadge difficulty={current.difficulty} />
                    <span className="text-sm font-bold text-indigo-700 truncate">{current.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/speedster/${current.id}`} onClick={e => e.stopPropagation()}
                      className="text-xs font-semibold text-indigo-600 hover:underline shrink-0">
                      Practice →
                    </Link>
                    <span className="text-xs text-indigo-400 shrink-0">← Flip back</span>
                  </div>
                </div>
                <div className="p-4" onClick={e => e.stopPropagation()}>
                  <CodePanel pythonCode={current.python_solution} cppCode={current.cpp_solution} />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            <button onClick={() => go(-1)} disabled={cardIdx === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} /> Prev
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[140px] sm:max-w-xs">
              {total <= 12 ? (
                planOrder.map((_, i) => (
                  <button key={i} onClick={() => jumpTo(i)}
                    className={`rounded-full shrink-0 transition-all ${i === cardIdx ? 'w-3 h-3 bg-yellow-500' : 'w-2 h-2 bg-gray-200 hover:bg-yellow-300'}`} />
                ))
              ) : (
                <span className="text-xs text-gray-400 font-mono">{cardIdx + 1} / {total}</span>
              )}
            </div>

            <button onClick={() => go(1)} disabled={cardIdx === total - 1}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle, ArrowLeft, ArrowRight, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

interface Question {
  id: number
  title: string
  difficulty: string
  slug: string
  tags: string[]
  description?: string
  python_solution?: string
  cpp_solution?: string
}

export default function SpeedsterPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [perDay, setPerDay] = useState(3)
  const [loading, setLoading] = useState(true)

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [lang, setLang] = useState<'python' | 'cpp'>('python')

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

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))

  // Group by day
  const days: number[][] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push(planOrder.slice(i, i + perDay))
  }

  const total = planOrder.length
  const currentQ = qMap[planOrder[cardIdx]]

  const goNext = useCallback(() => {
    if (cardIdx < total - 1) { setCardIdx(i => i + 1); setFlipped(false) }
  }, [cardIdx, total])

  const goPrev = useCallback(() => {
    if (cardIdx > 0) { setCardIdx(i => i - 1); setFlipped(false) }
  }, [cardIdx])

  // Keyboard: space = flip, arrows = navigate (only when not in an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); setFlipped(f => !f) }
      if (e.code === 'ArrowRight') goNext()
      if (e.code === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  const activeLang = currentQ?.python_solution && lang === 'python' ? 'python'
    : currentQ?.cpp_solution ? 'cpp' : 'python'
  const activeCode = activeLang === 'python' ? currentQ?.python_solution : currentQ?.cpp_solution
  const highlighted = activeCode ? hljs.highlight(activeCode, { language: activeLang }).value : ''

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

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
      <div className="space-y-6 mb-10">
        {days.map((dayIds, dayIdx) => (
          <div key={dayIdx}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Day {dayIdx + 1}</p>
            <div className="space-y-1.5">
              {dayIds.map((qid, qi) => {
                const q = qMap[qid]
                if (!q) return null
                const solved = !!progress[String(qid)]?.solved
                return (
                  <Link
                    key={qid}
                    href={`/speedster/${qid}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${
                      solved
                        ? 'bg-green-50 border-green-100 hover:border-green-200'
                        : 'bg-white border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/30'
                    }`}
                  >
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-gray-800 text-base flex items-center gap-2">
              ⚡ Flashcards
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Space to flip · ← → arrows to navigate</p>
          </div>
          <span className="text-sm font-bold text-gray-400">{cardIdx + 1} / {total}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all duration-300"
            style={{ width: `${((cardIdx + 1) / total) * 100}%` }}
          />
        </div>

        {/* Card */}
        {currentQ && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">

            {/* Front */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-xs text-gray-400 font-mono shrink-0">#{currentQ.id}</span>
                  <h3 className="font-black text-gray-900 text-base leading-snug">{currentQ.title}</h3>
                </div>
                <div className="shrink-0"><DifficultyBadge difficulty={currentQ.difficulty} /></div>
              </div>
              {currentQ.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {currentQ.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              {currentQ.description ? (
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                  {currentQ.description}
                </p>
              ) : (
                <a href={`https://leetcode.com/problems/${currentQ.slug}/`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-500 hover:underline">
                  View problem on LeetCode ↗
                </a>
              )}
            </div>

            {/* Flip toggle */}
            <button
              onClick={() => setFlipped(f => !f)}
              className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                flipped ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {flipped ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {flipped ? 'Hide answer' : 'Reveal answer'}
            </button>

            {/* Back — solution */}
            {flipped && (
              <div className="p-5">
                {activeCode ? (
                  <>
                    {currentQ.python_solution && currentQ.cpp_solution && (
                      <div className="flex gap-1 mb-3">
                        {(['python', 'cpp'] as const).map(l => (
                          <button key={l} onClick={() => setLang(l)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              lang === l ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                            }`}>
                            {l === 'python' ? 'Python 3' : 'C++'}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="rounded-xl overflow-hidden">
                      <pre className="bg-gray-900 p-4 overflow-x-auto text-xs leading-relaxed">
                        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                      </pre>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">No solution stored locally.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={goPrev} disabled={cardIdx === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ArrowLeft size={15} /> Prev
          </button>
          <button onClick={() => { setFlipped(false) }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600 border border-gray-100 hover:border-gray-200 transition-colors">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={goNext} disabled={cardIdx === total - 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

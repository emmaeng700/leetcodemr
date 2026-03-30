'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, RotateCcw, ChevronDown, ChevronUp, Gauge } from 'lucide-react'
import { getStudyPlan } from '@/lib/db'
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

export default function SpeedsterFlashcardsPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [lang, setLang] = useState<'python' | 'cpp'>('python')

  useEffect(() => {
    async function load() {
      const [qs, plan] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
      ])
      const order: number[] = plan?.question_order?.length
        ? plan.question_order
        : (qs as Question[]).map((q: Question) => q.id)
      setPlanOrder(order)
      setQuestions(qs)
      setLoading(false)
    }
    load()
  }, [])

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))
  const total = planOrder.length
  const currentQ = qMap[planOrder[currentIdx]]

  const goNext = useCallback(() => {
    if (currentIdx < total - 1) { setCurrentIdx(i => i + 1); setFlipped(false) }
  }, [currentIdx, total])

  const goPrev = useCallback(() => {
    if (currentIdx > 0) { setCurrentIdx(i => i - 1); setFlipped(false) }
  }, [currentIdx])

  // Keyboard: space = flip, arrows = navigate
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

  const solution = currentQ?.python_solution || currentQ?.cpp_solution
  const activeLang = currentQ?.python_solution && lang === 'python' ? 'python'
    : currentQ?.cpp_solution ? 'cpp' : 'python'
  const activeCode = activeLang === 'python' ? currentQ?.python_solution : currentQ?.cpp_solution

  const highlighted = activeCode
    ? hljs.highlight(activeCode, { language: activeLang }).value
    : ''

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-2">
      <Gauge size={16} className="animate-spin" /> Loading...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/speedster')} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Gauge size={16} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-base">Speedster Flashcards</h1>
            <p className="text-xs text-gray-400">Space to flip · ← → to navigate</p>
          </div>
        </div>
        <span className="text-sm font-bold text-gray-400">{currentIdx + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      {currentQ && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">

          {/* Front — always visible */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                <h2 className="font-black text-gray-900 text-lg leading-snug">{currentQ.title}</h2>
              </div>
              <DifficultyBadge difficulty={currentQ.difficulty} />
            </div>
            {currentQ.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {currentQ.tags.map(t => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            {currentQ.description ? (
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                {currentQ.description}
              </p>
            ) : (
              <a
                href={`https://leetcode.com/problems/${currentQ.slug}/`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:underline"
              >
                View problem on LeetCode ↗
              </a>
            )}
          </div>

          {/* Flip button */}
          <button
            onClick={() => setFlipped(f => !f)}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              flipped
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {flipped ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {flipped ? 'Hide answer' : 'Reveal answer'}
          </button>

          {/* Back — answer */}
          {flipped && (
            <div className="p-5">
              {solution ? (
                <>
                  {/* Lang toggle */}
                  {currentQ.python_solution && currentQ.cpp_solution && (
                    <div className="flex gap-1 mb-3">
                      {(['python', 'cpp'] as const).map(l => (
                        <button
                          key={l}
                          onClick={() => setLang(l)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            lang === l
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {l === 'python' ? 'Python 3' : 'C++'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl overflow-hidden text-sm">
                    <pre className="bg-gray-900 p-4 overflow-x-auto text-xs leading-relaxed">
                      <code
                        className={`language-${activeLang}`}
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                      />
                    </pre>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">No solution available locally. Check LeetCode.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={15} /> Prev
        </button>

        <button
          onClick={() => setFlipped(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600 border border-gray-100 hover:border-gray-200 transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>

        <button
          onClick={goNext}
          disabled={currentIdx === total - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight size={15} />
        </button>
      </div>

      <p className="text-center text-xs text-gray-300 mt-4">Press Space to flip · ← → arrow keys to navigate</p>
    </div>
  )
}

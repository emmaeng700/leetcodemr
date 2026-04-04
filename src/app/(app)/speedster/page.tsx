'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle, ChevronLeft, ChevronRight, RotateCcw, List, Code2 } from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'

interface Question {
  id: number
  title: string
  difficulty: string
  slug: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
}

export default function SpeedsterPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress,  setProgress]  = useState<Record<string, any>>({})
  const [perDay,    setPerDay]    = useState(3)
  const [loading,   setLoading]  = useState(true)

  // Day card state
  const [dayIdx,  setDayIdx]  = useState(0)

  // Flashcard state
  const [cardIdx,      setCardIdx]      = useState(0)
  const [flipped,      setFlipped]      = useState(false)
  const [fading,       setFading]       = useState(false)
  const [showCardList, setShowCardList] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Mobile panel: 'cards' = day cards + flashcards, 'editor' = code editor
  const [mobilePanel, setMobilePanel] = useState<'cards' | 'editor'>('cards')

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
        setPlanOrder((qs as Question[]).map(q => q.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]))

  // Group into days
  const days: number[][] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push(planOrder.slice(i, i + perDay))
  }

  const totalDays  = days.length
  const currentDay = days[dayIdx] ?? []
  const daySolved  = currentDay.filter(id => !!progress[String(id)]?.solved).length

  // Flashcard helpers
  const total      = planOrder.length
  const currentQ   = qMap[planOrder[cardIdx]]
  const solvedCount = planOrder.filter(id => !!progress[String(id)]?.solved).length

  // Close card list on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setShowCardList(false)
    }
    if (showCardList) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCardList])

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      const tag = el?.tagName
      // Skip if typing in any input, textarea, OR CodeMirror's contenteditable div
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (el?.getAttribute?.('contenteditable') !== null) return
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

  // ─── Cards + Flashcards content (shared between mobile panel and desktop) ───
  const cardsContent = (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
          <Gauge size={18} className="text-yellow-600" />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-lg leading-tight">Speedster</h1>
          <p className="text-xs text-gray-400">Practice daily questions — submissions won't mark as solved</p>
        </div>
      </div>

      {/* ── Day card section ── */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDayIdx(i => Math.max(0, i - 1))} disabled={dayIdx === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={16} /> Prev
        </button>
        <div className="text-center">
          <p className="text-base font-black text-gray-800">Day {dayIdx + 1}</p>
          <p className="text-xs text-gray-400">{daySolved}/{currentDay.length} solved · {dayIdx + 1} of {totalDays} days</p>
        </div>
        <button onClick={() => setDayIdx(i => Math.min(totalDays - 1, i + 1))} disabled={dayIdx === totalDays - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-5 overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: totalDays ? `${((dayIdx + 1) / totalDays) * 100}%` : '0%' }} />
      </div>

      {/* Day card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-3">
        {currentDay.map((qid, i) => {
          const q = qMap[qid]
          if (!q) return null
          const solved = !!progress[String(qid)]?.solved
          return (
            <Link key={qid} href={`/speedster/${qid}`}
              className={`flex items-center gap-3 px-5 py-4 transition-colors group ${i !== 0 ? 'border-t border-gray-100' : ''} ${solved ? 'bg-green-50 hover:bg-green-100/60' : 'hover:bg-yellow-50/40'}`}>
              <div className="shrink-0">
                {solved
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <Circle size={18} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />}
              </div>
              <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
              <span className={`flex-1 text-sm font-semibold truncate ${solved ? 'text-green-700' : 'text-gray-800'}`}>{q.title}</span>
              <DifficultyBadge difficulty={q.difficulty} />
              <ChevronRight size={14} className="text-gray-300 group-hover:text-yellow-400 shrink-0 transition-colors" />
            </Link>
          )
        })}
      </div>

      {/* Day dots */}
      {totalDays <= 20 && (
        <div className="flex justify-center gap-1.5 mb-10 flex-wrap">
          {days.map((_, i) => (
            <button key={i} onClick={() => setDayIdx(i)}
              className={`rounded-full transition-all ${i === dayIdx ? 'w-3 h-3 bg-yellow-500' : 'w-2 h-2 bg-gray-200 hover:bg-yellow-300'}`} />
          ))}
        </div>
      )}

      {/* ── Flashcard section ── */}
      <div className="border-t-2 border-dashed border-yellow-200 pt-6">

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">⚡ Flashcards</h2>
          <p className="text-xs text-gray-400 hidden sm:block">Tap card to flip · ← → keys · Space</p>
        </div>

        {/* Learn-style nav bar */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => go(-1)} disabled={cardIdx === 0}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
            <ChevronLeft size={15} />
          </button>

          <div className="relative" ref={listRef}>
            <button onClick={() => setShowCardList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-yellow-400 transition-colors">
              <List size={12} />
              <span className="font-mono">{cardIdx + 1}/{total}</span>
              <span className="text-gray-300">·</span>
              <span className="text-green-600">{solvedCount} solved</span>
            </button>

            {showCardList && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 max-h-80 overflow-y-auto">
                {planOrder.map((qid, i) => {
                  const q = qMap[qid]
                  if (!q) return null
                  const done = !!progress[String(qid)]?.solved
                  return (
                    <button key={qid} onClick={() => { setCardIdx(i); setFlipped(false); setShowCardList(false) }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-yellow-50 border-b border-gray-50 last:border-0 transition-colors text-sm ${i === cardIdx ? 'bg-yellow-50' : ''}`}>
                      <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{q.id}</span>
                      <span className="flex-1 truncate text-gray-700">{q.title}</span>
                      <span className={`text-xs font-semibold shrink-0 ${q.difficulty === 'Easy' ? 'text-green-600' : q.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                        {q.difficulty[0]}
                      </span>
                      {done && <CheckCircle size={11} className="text-green-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={() => go(1)} disabled={cardIdx === total - 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
            <ChevronRight size={15} />
          </button>

          {/* Progress bar */}
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[40px]">
            <div className="bg-yellow-400 h-1.5 rounded-full transition-all"
              style={{ width: total ? `${((cardIdx + 1) / total) * 100}%` : '0%' }} />
          </div>

          {/* Reset */}
          <button onClick={() => fadeSwap(() => { setCardIdx(0); setFlipped(false) })}
            title="Reset to start"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <RotateCcw size={13} />
          </button>
        </div>

        {currentQ && (
          <>
            <div onClick={handleFlip} className="cursor-pointer select-none"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}>

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
                    <img src={`/question-images/${currentQ.id}.jpg`} alt={currentQ.title}
                      className="w-full rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      onClick={e => e.stopPropagation()} />
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

            {/* Mobile: shortcut to jump to editor for this card */}
            <button
              onClick={() => setMobilePanel('editor')}
              className="md:hidden mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-700 text-sm font-semibold hover:bg-yellow-100 transition-colors"
            >
              <Code2 size={14} /> Code it →
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ─── Editor panel content — mirrors learn page exactly ───
  const editorContent = currentQ ? (
    <LeetCodeEditor
      key={currentQ.slug}
      appQuestionId={currentQ.id}
      slug={currentQ.slug}
      speedster
    />
  ) : null

  // ─── Mobile: full-height layout with tab bar ───
  // ─── Desktop: stacked scroll layout (existing feel) ───
  return (
    <>
      {/* ── MOBILE layout: full viewport height, tab-switched panels ── */}
      <div className="flex flex-col md:hidden h-[calc(100vh-56px)]">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-white shrink-0">
          <button
            onClick={() => setMobilePanel('cards')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'cards' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}
          >
            ⚡ Daily + Flashcards
          </button>
          <button
            onClick={() => setMobilePanel('editor')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'editor' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}
          >
            💻 Editor
          </button>
        </div>

        {/* Cards panel */}
        <div className={`${mobilePanel === 'cards' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0 overflow-y-auto`}>
          {cardsContent}
        </div>

        {/* Editor panel — exact same wrapper as learn page */}
        <div className={`${mobilePanel === 'editor' ? 'flex flex-col' : 'hidden'} flex-1 min-h-0 overflow-x-hidden`}>
          {editorContent}
        </div>
      </div>

      {/* ── DESKTOP layout: original stacked scroll ── */}
      <div className="hidden md:block max-w-4xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
            <Gauge size={18} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-lg leading-tight">Speedster</h1>
            <p className="text-xs text-gray-400">Practice daily questions — submissions won't mark as solved</p>
          </div>
        </div>

        {/* ── Day card section ── */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setDayIdx(i => Math.max(0, i - 1))} disabled={dayIdx === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} /> Prev
          </button>
          <div className="text-center">
            <p className="text-base font-black text-gray-800">Day {dayIdx + 1}</p>
            <p className="text-xs text-gray-400">{daySolved}/{currentDay.length} solved · {dayIdx + 1} of {totalDays} days</p>
          </div>
          <button onClick={() => setDayIdx(i => Math.min(totalDays - 1, i + 1))} disabled={dayIdx === totalDays - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-yellow-400 rounded-full transition-all duration-300"
            style={{ width: totalDays ? `${((dayIdx + 1) / totalDays) * 100}%` : '0%' }} />
        </div>

        {/* Day card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-3">
          {currentDay.map((qid, i) => {
            const q = qMap[qid]
            if (!q) return null
            const solved = !!progress[String(qid)]?.solved
            return (
              <Link key={qid} href={`/speedster/${qid}`}
                className={`flex items-center gap-3 px-5 py-4 transition-colors group ${i !== 0 ? 'border-t border-gray-100' : ''} ${solved ? 'bg-green-50 hover:bg-green-100/60' : 'hover:bg-yellow-50/40'}`}>
                <div className="shrink-0">
                  {solved
                    ? <CheckCircle size={18} className="text-green-500" />
                    : <Circle size={18} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />}
                </div>
                <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                <span className={`flex-1 text-sm font-semibold truncate ${solved ? 'text-green-700' : 'text-gray-800'}`}>{q.title}</span>
                <DifficultyBadge difficulty={q.difficulty} />
                <ChevronRight size={14} className="text-gray-300 group-hover:text-yellow-400 shrink-0 transition-colors" />
              </Link>
            )
          })}
        </div>

        {/* Day dots */}
        {totalDays <= 20 && (
          <div className="flex justify-center gap-1.5 mb-10 flex-wrap">
            {days.map((_, i) => (
              <button key={i} onClick={() => setDayIdx(i)}
                className={`rounded-full transition-all ${i === dayIdx ? 'w-3 h-3 bg-yellow-500' : 'w-2 h-2 bg-gray-200 hover:bg-yellow-300'}`} />
            ))}
          </div>
        )}

        {/* ── Flashcard section ── */}
        <div className="border-t-2 border-dashed border-yellow-200 pt-6">

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">⚡ Flashcards</h2>
            <p className="text-xs text-gray-400">Tap card to flip · ← → keys · Space</p>
          </div>

          {/* Learn-style nav bar */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => go(-1)} disabled={cardIdx === 0}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ChevronLeft size={15} />
            </button>

            <div className="relative" ref={listRef}>
              <button onClick={() => setShowCardList(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-yellow-400 transition-colors">
                <List size={12} />
                <span className="font-mono">{cardIdx + 1}/{total}</span>
                <span className="text-gray-300">·</span>
                <span className="text-green-600">{solvedCount} solved</span>
              </button>

              {showCardList && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 max-h-80 overflow-y-auto">
                  {planOrder.map((qid, i) => {
                    const q = qMap[qid]
                    if (!q) return null
                    const done = !!progress[String(qid)]?.solved
                    return (
                      <button key={qid} onClick={() => { setCardIdx(i); setFlipped(false); setShowCardList(false) }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-yellow-50 border-b border-gray-50 last:border-0 transition-colors text-sm ${i === cardIdx ? 'bg-yellow-50' : ''}`}>
                        <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{q.id}</span>
                        <span className="flex-1 truncate text-gray-700">{q.title}</span>
                        <span className={`text-xs font-semibold shrink-0 ${q.difficulty === 'Easy' ? 'text-green-600' : q.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                          {q.difficulty[0]}
                        </span>
                        {done && <CheckCircle size={11} className="text-green-500 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button onClick={() => go(1)} disabled={cardIdx === total - 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ChevronRight size={15} />
            </button>

            {/* Progress bar */}
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[40px]">
              <div className="bg-yellow-400 h-1.5 rounded-full transition-all"
                style={{ width: total ? `${((cardIdx + 1) / total) * 100}%` : '0%' }} />
            </div>

            {/* Reset */}
            <button onClick={() => fadeSwap(() => { setCardIdx(0); setFlipped(false) })}
              title="Reset to start"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
              <RotateCcw size={13} />
            </button>
          </div>

          {currentQ && (
            <div onClick={handleFlip} className="cursor-pointer select-none"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}>

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
                    <span className="text-xs text-gray-300 font-medium">Tap to reveal →</span>
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
                    <img src={`/question-images/${currentQ.id}.jpg`} alt={currentQ.title}
                      className="w-full rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      onClick={e => e.stopPropagation()} />
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
          )}
        </div>

        {/* ── Editor section (desktop only — full width below flashcards) ── */}
        {currentQ && (
          <div className="border-t-2 border-dashed border-yellow-200 pt-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                <Code2 size={14} className="text-yellow-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">Code Editor</h2>
                <p className="text-xs text-gray-400">
                  #{currentQ.id} · {currentQ.title} — submissions won't mark as solved
                </p>
              </div>
            </div>

            <div className="h-[820px] rounded-xl overflow-hidden flex flex-col">
              <LeetCodeEditor
                key={currentQ.slug}
                appQuestionId={currentQ.id}
                slug={currentQ.slug}
                speedster
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Gauge, CheckCircle, Circle, ChevronLeft, ChevronRight, RotateCcw, List, Code2, WifiOff } from 'lucide-react'
import { addMasteryRunEvent, getMasteryRunsByQuestion, getProgress, getStudyPlan, getFcVisited, addFcVisited } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { QUESTION_SOURCES, QUICK_PATTERNS } from '@/lib/constants'
import toast from 'react-hot-toast'

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
  const [filterDiff,    setFilterDiff]    = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All')
  const [filterSolved,  setFilterSolved]  = useState<'All' | 'Unsolved' | 'Solved'>('All')
  const [filterSource,  setFilterSource]  = useState('All')
  const [filterPattern, setFilterPattern] = useState<string | null>(null)
  const [visited,       setVisited]       = useState<Set<number>>(new Set())
  const [runs, setRuns] = useState<Record<string, number>>({})
  // Mobile panel: 'cards' = day cards + flashcards, 'editor' = code editor
  const [mobilePanel, setMobilePanel] = useState<'cards' | 'editor'>('cards')
  const online = useOnlineStatus()

  // Ref to the mobile scrollable panel so we can lock scroll position on flip
  const cardsPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const [qs, plan, prog, vis, mr] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getStudyPlan(),
          getProgress(),
          getFcVisited(),
          getMasteryRunsByQuestion(),
        ])
        setQuestions(qs)
        setProgress(prog)
        setVisited(vis)
        setRuns(mr)
        if (plan?.question_order?.length) {
          setPlanOrder(plan.question_order)
          setPerDay(plan.per_day || 3)
        } else {
          setPlanOrder((qs as Question[]).map(q => q.id))
        }
      } catch (e) {
        console.error('[speedster] load failed:', e)
        toast.error('Failed to load Speedster data — check console/Supabase policies')
      } finally {
        setLoading(false)
      }
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

  // Flashcard helpers — respects active filters
  const filteredOrder = planOrder.filter(id => {
    const q = qMap[id]
    if (!q) return false
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
    const solved = !!progress[String(id)]?.solved
    if (filterSolved === 'Unsolved' && solved) return false
    if (filterSolved === 'Solved'   && !solved) return false
    if (filterSource !== 'All' && !(q.source || []).includes(filterSource)) return false
    if (filterPattern) {
      const patTags = QUICK_PATTERNS.find(p => p.name === filterPattern)?.tags ?? []
      if (!(q.tags || []).some(t => (patTags as readonly string[]).includes(t))) return false
    }
    return true
  })
  const total          = filteredOrder.length
  const currentQ       = qMap[filteredOrder[cardIdx]]
  const currentRuns    = currentQ ? (runs[String(currentQ.id)] ?? 0) : 0
  const solvedCount    = planOrder.filter(id => !!progress[String(id)]?.solved).length
  const filteredVisited = filteredOrder.filter(id => visited.has(id)).length

  // Reset to first card when filters change
  useEffect(() => { setCardIdx(0); setFlipped(false) }, [filterDiff, filterSolved, filterSource, filterPattern])

  // Close card list on outside click — use class check so it works regardless
  // of whether mobile or desktop DOM node is active (both render simultaneously)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.('.speedster-card-list-wrapper')) {
        setShowCardList(false)
      }
    }
    if (showCardList) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCardList])

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    const panel = cardsPanelRef.current
    // Capture scroll immediately — before React does anything
    const savedScroll = panel ? panel.scrollTop : window.scrollY
    const restore = () => {
      if (panel) panel.scrollTop = savedScroll
      else window.scrollTo(0, savedScroll)
    }
    fadeSwap(() => setFlipped(f => !f))
    // Restore once after the fade (180ms), then once more after paint
    // to handle browser scroll-adjustment caused by content height change
    setTimeout(() => {
      restore()
      requestAnimationFrame(restore)
    }, 190)
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

  // ─── Flashcard filter bar (shared) ───
  const anyFilter = filterDiff !== 'All' || filterSolved !== 'All' || filterSource !== 'All' || filterPattern !== null
  const filterBar = (
    <div className="space-y-2 mb-3">
      {/* Row 1: Difficulty + Solved status */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
          <button key={d} onClick={() => setFilterDiff(d)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              filterDiff === d
                ? d === 'Easy'   ? 'bg-green-500 text-white border-green-500'
                : d === 'Medium' ? 'bg-yellow-500 text-white border-yellow-500'
                : d === 'Hard'   ? 'bg-red-500 text-white border-red-500'
                : 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {d}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />
        <button onClick={() => setFilterSolved(s => s === 'Unsolved' ? 'All' : 'Unsolved')} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
            filterSolved === 'Unsolved' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}>
          Unsolved
        </button>
        <button onClick={() => setFilterSolved(s => s === 'Solved' ? 'All' : 'Solved')} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
            filterSolved === 'Solved' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}>
          Solved
        </button>
        <span className="text-xs text-gray-400 ml-auto shrink-0">{total} shown</span>
        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
          <CheckCircle size={11} /> {visited.size} visited
        </span>
      </div>

      {/* Row 2: Source */}
      <div className="flex flex-wrap gap-1.5">
        {QUESTION_SOURCES.map(s => (
          <button key={s.value} onClick={() => setFilterSource(s.value)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              filterSource === s.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Row 3: Patterns */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilterPattern(null)} style={{ touchAction: 'manipulation' }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
            !filterPattern ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'
          }`}>
          All Patterns
        </button>
        {QUICK_PATTERNS.map(p => (
          <button key={p.name} onClick={() => setFilterPattern(filterPattern === p.name ? null : p.name)} style={{ touchAction: 'manipulation' }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              filterPattern === p.name ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300'
            }`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Clear all */}
      {anyFilter && (
        <button onClick={() => { setFilterDiff('All'); setFilterSolved('All'); setFilterSource('All'); setFilterPattern(null) }}
          style={{ touchAction: 'manipulation' }}
          className="px-2.5 py-1 rounded-lg text-xs text-gray-400 border border-gray-200 hover:text-gray-600 transition-colors">
          Clear all filters
        </button>
      )}
    </div>
  )

  // ─── Cards + Flashcards content (shared between mobile panel and desktop) ───
  const cardsContent = (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">

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
              className={`flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-4 transition-colors group ${i !== 0 ? 'border-t border-gray-100' : ''} ${solved ? 'bg-green-50 hover:bg-green-100/60' : 'hover:bg-yellow-50/40'}`}>
              <div className="shrink-0">
                {solved
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <Circle size={18} className="text-gray-200 group-hover:text-yellow-300 transition-colors" />}
              </div>
              <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
              <span className={`flex-1 text-sm font-semibold truncate ${solved ? 'text-green-700' : 'text-gray-800'}`}>{q.title}</span>
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                Runs {runs[String(q.id)] ?? 0}/4
              </span>
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
              className={`rounded-full transition-all ${i === dayIdx ? 'w-4 h-4 bg-yellow-500' : 'w-3 h-3 bg-gray-200 hover:bg-yellow-300'}`} />
          ))}
        </div>
      )}

      {/* ── Flashcard section ── */}
      <div className="border-t-2 border-dashed border-yellow-200 pt-6">

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">⚡ Flashcards</h2>
          <p className="text-xs text-gray-400 hidden sm:block">Tap card to flip · ← → keys · Space</p>
        </div>

        {filterBar}

        {/* Learn-style nav bar */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => go(-1)} disabled={cardIdx === 0}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
            <ChevronLeft size={15} />
          </button>

          <div className="relative speedster-card-list-wrapper">
            <button onClick={() => setShowCardList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-yellow-400 transition-colors">
              <List size={12} />
              <span className="font-mono">{cardIdx + 1}/{total}</span>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-0.5 text-green-600"><CheckCircle size={10} />{filteredVisited}/{total}</span>
            </button>

            {showCardList && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-[min(288px,calc(100vw-1rem))] max-h-80 overflow-y-auto">
                {filteredOrder.map((qid, i) => {
                  const q = qMap[qid]
                  if (!q) return null
                  const done = !!progress[String(qid)]?.solved
                  return (
                    <button key={qid} onClick={() => { setCardIdx(i); setFlipped(false); setShowCardList(false) }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-yellow-50 border-b border-gray-50 last:border-0 transition-colors text-sm ${i === cardIdx ? 'bg-yellow-50' : ''}`}>
                      <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{q.id}</span>
                      <span className="flex-1 truncate text-gray-700">{q.title}</span>
                      <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                        {runs[String(q.id)] ?? 0}/4
                      </span>
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

        {total === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No questions match this filter.</div>
        )}
        {currentQ && (
          <>
            <div onClick={handleFlip} className="cursor-pointer select-none w-full min-w-0"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease', touchAction: 'manipulation' }}>

              {!flipped ? (
                /* FRONT */
                <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      {(currentQ.source || []).map(s => (
                        <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">{s}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        Mastery runs: {currentRuns}/4
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const next = new Set(visited)
                          if (next.has(currentQ.id)) { next.delete(currentQ.id) } else { next.add(currentQ.id); addFcVisited(currentQ.id) }
                          setVisited(next)
                        }}
                        style={{ touchAction: 'manipulation' }}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                          visited.has(currentQ.id) ? 'bg-green-50 text-green-600 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-500'
                        }`}
                      >
                        {visited.has(currentQ.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                      </button>
                      <span className="hidden sm:inline text-xs text-gray-300 font-medium">Tap to reveal →</span>
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 py-2 sm:py-3">
                    <h3 className="text-lg font-bold text-gray-800">{currentQ.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(currentQ.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 pb-3 sm:pb-5">
                    <img src={`/question-images/${currentQ.id}.jpg`} alt={currentQ.title}
                      className="w-full max-h-52 sm:max-h-72 object-contain object-top rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      onClick={e => e.stopPropagation()} />
                  </div>
                </div>
              ) : (
                /* BACK */
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden w-full min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-indigo-100 bg-indigo-50">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      <span className="text-sm font-bold text-indigo-700 truncate">{currentQ.title}</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-medium shrink-0">← Flip back</span>
                  </div>
                  <div className="p-4 min-w-0" onClick={e => e.stopPropagation()}>
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
    online ? (
      <LeetCodeEditor
        key={currentQ.slug}
        appQuestionId={currentQ.id}
        slug={currentQ.slug}
        speedster
        onAccepted={async () => {
          const res = await addMasteryRunEvent(currentQ.id, 1)
          if (!res.ok) {
            toast.error(`Failed to save mastery run — ${res.error ?? 'check Supabase RLS'}`)
            return
          }
          setRuns(prev => ({ ...prev, [String(currentQ.id)]: (prev[String(currentQ.id)] ?? 0) + 1 }))
          toast.success('Mastery run saved')
        }}
      />
    ) : (
      /* Offline fallback — show cached solution instead of broken editor */
      <div className="flex flex-col flex-1 min-h-0 bg-[#1a1a2e] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#16213e] border-b border-gray-700/50 shrink-0">
          <WifiOff size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 font-semibold">You're offline — live editor unavailable</p>
        </div>
        <div className="p-4 min-w-0 w-full">
          <p className="text-xs text-gray-400 mb-3">Showing saved solution for #{currentQ.id} · {currentQ.title}</p>
          <CodePanel pythonCode={currentQ.python_solution} cppCode={currentQ.cpp_solution} />
        </div>
      </div>
    )
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
        <div ref={cardsPanelRef} className={`${mobilePanel === 'cards' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0 overflow-y-auto`}>
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
                className={`flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-4 transition-colors group ${i !== 0 ? 'border-t border-gray-100' : ''} ${solved ? 'bg-green-50 hover:bg-green-100/60' : 'hover:bg-yellow-50/40'}`}>
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
                className={`rounded-full transition-all ${i === dayIdx ? 'w-4 h-4 bg-yellow-500' : 'w-3 h-3 bg-gray-200 hover:bg-yellow-300'}`} />
            ))}
          </div>
        )}

        {/* ── Flashcard section ── */}
        <div className="border-t-2 border-dashed border-yellow-200 pt-6">

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">⚡ Flashcards</h2>
            <p className="text-xs text-gray-400">Tap card to flip · ← → keys · Space</p>
          </div>

          {filterBar}

          {/* Learn-style nav bar */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => go(-1)} disabled={cardIdx === 0}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ChevronLeft size={15} />
            </button>

            <div className="relative speedster-card-list-wrapper">
              <button onClick={() => setShowCardList(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-yellow-400 transition-colors">
                <List size={12} />
                <span className="font-mono">{cardIdx + 1}/{total}</span>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-0.5 text-green-600"><CheckCircle size={10} />{filteredVisited}/{total} visited</span>
              </button>

              {showCardList && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-[min(288px,calc(100vw-1rem))] max-h-80 overflow-y-auto">
                  {filteredOrder.map((qid, i) => {
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

          {total === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No questions match this filter.</div>
          )}
          {currentQ && (
            <div onClick={handleFlip} className="cursor-pointer select-none w-full min-w-0"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease', touchAction: 'manipulation' }}>

              {!flipped ? (
                /* FRONT */
                <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      {(currentQ.source || []).map(s => (
                        <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">{s}</span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-300 font-medium">Tap to reveal →</span>
                  </div>
                  <div className="px-3 sm:px-5 py-2 sm:py-3">
                    <h3 className="text-lg font-bold text-gray-800">{currentQ.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(currentQ.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 pb-3 sm:pb-5">
                    <img src={`/question-images/${currentQ.id}.jpg`} alt={currentQ.title}
                      className="w-full max-h-52 sm:max-h-72 object-contain object-top rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      onClick={e => e.stopPropagation()} />
                  </div>
                </div>
              ) : (
                /* BACK */
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden w-full min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-indigo-100 bg-indigo-50">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 font-mono">#{currentQ.id}</span>
                      <DifficultyBadge difficulty={currentQ.difficulty} />
                      <span className="text-sm font-bold text-indigo-700 truncate">{currentQ.title}</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-medium shrink-0">← Flip back</span>
                  </div>
                  <div className="p-4 min-w-0" onClick={e => e.stopPropagation()}>
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

            {online ? (
              <div className="h-[820px] rounded-xl overflow-hidden flex flex-col">
                <LeetCodeEditor
                  key={currentQ.slug}
                  appQuestionId={currentQ.id}
                  slug={currentQ.slug}
                  speedster
                  onAccepted={async () => {
                    const res = await addMasteryRunEvent(currentQ.id, 1)
                    if (!res.ok) {
                      toast.error(`Failed to save mastery run — ${res.error ?? 'check Supabase RLS'}`)
                      return
                    }
                    setRuns(prev => ({ ...prev, [String(currentQ.id)]: (prev[String(currentQ.id)] ?? 0) + 1 }))
                    toast.success('Mastery run saved')
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <WifiOff size={13} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 font-semibold">You're offline — live editor unavailable. Showing saved solution.</p>
                </div>
                <div className="p-4">
                  <CodePanel pythonCode={currentQ.python_solution} cppCode={currentQ.cpp_solution} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

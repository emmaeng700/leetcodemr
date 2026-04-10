'use client'
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Shuffle, RotateCcw, ChevronLeft, ChevronRight, CheckCircle, Circle } from 'lucide-react'
import { getBehavioralVisited, addBehavioralVisited } from '@/lib/db'
import { shuffle } from '@/lib/utils'

interface Story {
  title: string
  situation: string
  task: string
  action: string
  result: string
}

interface BehavioralQuestion {
  id: number
  category: string
  question: string
  stories: Story[]
}

const CATEGORIES = [
  'All', 'Background', 'Conflict & Communication', 'Failure & Growth', 'Leadership',
  'Pressure & Resilience', 'Decision Making', 'Initiative', 'Learning & Adaptability',
  'Prioritisation', 'Problem Solving', 'Stakeholder Management', 'Collaboration',
  'Technical', 'Motivation', 'Design & Product', 'Communication', 'Achievement', 'Judgment',
]

const STAR = [
  { key: 'situation' as keyof Story, label: 'S — Situation', cls: 'bg-blue-50 border-blue-200 text-blue-900' },
  { key: 'task' as keyof Story,      label: 'T — Task',      cls: 'bg-purple-50 border-purple-200 text-purple-900' },
  { key: 'action' as keyof Story,    label: 'A — Action',    cls: 'bg-orange-50 border-orange-200 text-orange-900' },
  { key: 'result' as keyof Story,    label: 'R — Result',    cls: 'bg-green-50 border-green-200 text-green-900' },
]

const STORY_STYLES = [
  { idle: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
  { idle: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  { idle: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-600 text-white border-amber-600' },
]

export default function BehavioralPage() {
  const [allQuestions, setAllQuestions] = useState<BehavioralQuestion[]>([])
  const [cat, setCat] = useState('All')
  const [deck, setDeck] = useState<BehavioralQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [storyTab, setStoryTab] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [qs, vis] = await Promise.all([
        fetch('/behavioral_questions.json').then(r => r.json()),
        getBehavioralVisited(),
      ])
      setAllQuestions(qs)
      setVisited(vis)
      setDeck(qs)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!allQuestions.length) return
    const filtered = cat === 'All' ? allQuestions : allQuestions.filter(q => q.category === cat)
    setDeck(isShuffled ? shuffle(filtered) : filtered)
    setIdx(0)
    setFlipped(false)
    setStoryTab(0)
  }, [cat, isShuffled, allQuestions])

  const card = deck[idx] || null

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const go = useCallback((dir: number) => {
    if (!deck.length) return
    fadeSwap(() => {
      setIdx(i => (i + dir + deck.length) % deck.length)
      setFlipped(false)
      setStoryTab(0)
    })
  }, [deck, fadeSwap])

  const handleFlip = useCallback(() => {
    if (!card) return
    const savedScroll = window.scrollY
    const restore = () => window.scrollTo(0, savedScroll)
    fadeSwap(() => {
      const nowFlipping = !flipped
      setFlipped(nowFlipping)
      setStoryTab(0)
      if (nowFlipping && !visited.has(card.id)) {
        const next = new Set(visited)
        next.add(card.id)
        setVisited(next)
        addBehavioralVisited(card.id)
      }
    })
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }, [card, flipped, fadeSwap, visited])

  const reset = () => {
    setIdx(0)
    setFlipped(false)
    setStoryTab(0)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, handleFlip])

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2 mb-0.5">
          <BookOpen className="text-indigo-500" /> Behavioural
        </h1>
        <p className="text-xs text-[var(--text-subtle)]">Tap card to reveal STAR stories · ← → to navigate · Space to flip</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-full">
          {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
        </span>
        <span className="text-xs font-semibold bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-full flex items-center gap-1">
          <CheckCircle size={11} /> {visited.size} / {allQuestions.length} visited
        </span>
        <button
          onClick={() => setIsShuffled(s => !s)}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            isShuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-indigo-300'
          }`}
        >
          <Shuffle size={11} /> Shuffle
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--border-soft)] transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              cat === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-indigo-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Card */}
      {card && (
        <>
          <div
            onClick={handleFlip}
            className="cursor-pointer select-none mb-4"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
          >
            {!flipped ? (
              /* FRONT */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-[var(--border)]">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {card.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const next = new Set(visited)
                        if (next.has(card.id)) { next.delete(card.id) } else { next.add(card.id); addBehavioralVisited(card.id) }
                        setVisited(next)
                      }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        visited.has(card.id) ? 'bg-green-50 text-green-600 border-green-300' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                      }`}
                    >
                      {visited.has(card.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                    </button>
                    <span className="hidden sm:inline text-xs text-[var(--text-subtle)] font-medium">Tap to reveal →</span>
                  </div>
                </div>
                <div className="px-4 py-8 sm:py-10 flex items-center justify-center min-h-[140px]">
                  <p className="text-lg sm:text-xl font-bold text-[var(--text)] text-center leading-snug">{card.question}</p>
                </div>
                <div className="px-5 pb-4 flex justify-center">
                  <span className="text-xs text-[var(--text-subtle)]">
                    {card.stories.length} STAR {card.stories.length === 1 ? 'story' : 'stories'} prepared
                  </span>
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                      {card.category}
                    </span>
                    <span className="text-sm font-bold text-indigo-800 leading-snug">{card.question}</span>
                  </div>
                  <span className="hidden sm:inline text-xs text-indigo-400 font-medium shrink-0">← Flip back</span>
                </div>

                {/* Story tabs */}
                <div className="px-5 pt-4 pb-0 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {card.stories.map((story, i) => (
                    <button
                      key={i}
                      onClick={() => setStoryTab(i)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                        storyTab === i ? STORY_STYLES[i % 3].active : STORY_STYLES[i % 3].idle
                      }`}
                    >
                      Story {i + 1} — {story.title}
                    </button>
                  ))}
                </div>

                {/* STAR sections */}
                <div className="px-5 py-4 space-y-2" onClick={e => e.stopPropagation()}>
                  {STAR.map(({ key, label, cls }) => (
                    <div key={key} className={`rounded-xl border p-3 ${cls}`}>
                      <div className="text-xs font-bold mb-1">{label}</div>
                      <p className="text-sm leading-relaxed">{card.stories[storyTab]?.[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => go(-1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm font-medium"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-xs text-[var(--text-subtle)] font-medium">{idx + 1} / {deck.length}</span>
            <button
              onClick={() => go(1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm font-medium"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {deck.length === 0 && (
        <div className="text-center py-20 text-[var(--text-subtle)] text-sm">No questions in this category.</div>
      )}
    </div>
  )
}

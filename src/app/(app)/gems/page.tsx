'use client'
import { useState, useCallback, useEffect } from 'react'
import { Gem, Copy, Check, ChevronLeft, ChevronRight, Shuffle, RotateCcw, CheckCircle, Circle } from 'lucide-react'
import { addGemsVisited, getGemsVisited } from '@/lib/db'
import { shuffle } from '@/lib/utils'
import { GEMS_CARDS, GEMS_CATEGORIES, GEMS_CAT_COLOR } from '@/data/gemsCards'

interface GemCard {
  id: string
  category: string
  emoji: string
  front: string
  sub: string
  note?: string | null
  attach?: string | null
  type: string
  body: string
}

export default function GemsPage() {
  const [cat, setCat] = useState('All')
  const [deck, setDeck] = useState<GemCard[]>(GEMS_CARDS as GemCard[])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getGemsVisited().then(vis => setVisited(vis))
  }, [])

  useEffect(() => {
    const all = GEMS_CARDS as GemCard[]
    const filtered = cat === 'All' ? all : all.filter(c => c.category === cat)
    setDeck(isShuffled ? shuffle(filtered) : filtered)
    setIdx(0)
    setFlipped(false)
  }, [cat, isShuffled])

  const card = deck[idx] || null

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const handleFlip = useCallback(() => {
    if (!card) return
    const savedScroll = window.scrollY
    const restore = () => window.scrollTo(0, savedScroll)
    fadeSwap(() => {
      const nowFlipping = !flipped
      setFlipped(nowFlipping)
      if (nowFlipping && !visited.has(card.id)) {
        const next = new Set(visited)
        next.add(card.id)
        setVisited(next)
        addGemsVisited(card.id)
      }
    })
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }, [card, flipped, fadeSwap, visited])

  const go = useCallback((dir: number) => {
    fadeSwap(() => {
      setFlipped(false)
      setIdx(i => Math.max(0, Math.min(deck.length - 1, i + dir)))
    })
  }, [deck.length, fadeSwap])

  const reset = () => fadeSwap(() => { setIdx(0); setFlipped(false) })

  const toggleShuffle = () => setIsShuffled(s => !s)

  async function handleCopy(text: string, e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, handleFlip])

  const catColor = card ? (GEMS_CAT_COLOR[card.category] || 'bg-gray-50 text-gray-700 border-gray-200') : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2 mb-0.5">
          <Gem className="text-indigo-500" /> Gems
        </h1>
        <p className="text-xs text-[var(--text-subtle)]">Recruiter playbooks, templates & interview strategies</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-full">
          {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
        </span>
        <span className="text-xs font-semibold bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-full flex items-center gap-1">
          <CheckCircle size={11} /> {visited.size} / {(GEMS_CARDS as GemCard[]).length} visited
        </span>
        <button
          onClick={toggleShuffle}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            isShuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-indigo-300'
          }`}
        >
          <Shuffle size={11} /> Shuffle
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--text-subtle)] transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {GEMS_CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              cat === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-indigo-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {deck.length === 0 && (
        <div className="text-center py-20 text-[var(--text-subtle)] text-sm">No cards in this category.</div>
      )}

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
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catColor}`}>
                    {card.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const next = new Set(visited)
                        if (next.has(card.id)) { next.delete(card.id) } else { next.add(card.id); addGemsVisited(card.id) }
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
                <div className="px-5 py-8 flex flex-col items-center justify-center min-h-[160px] text-center gap-2">
                  <span className="text-3xl">{card.emoji}</span>
                  <h2 className="text-xl font-bold text-[var(--text)]">{card.front}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{card.sub}</p>
                  {card.note && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-1">{card.note}</p>
                  )}
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-[var(--bg-card)] rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50 ">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{card.emoji}</span>
                    <span className="text-sm font-bold text-indigo-700 ">{card.front}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.type === 'template' && (
                      <button
                        onClick={e => handleCopy(card.body, e)}
                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-[var(--bg-card)] text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-colors"
                      >
                        {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                      </button>
                    )}
                    <span className="hidden sm:inline text-xs text-indigo-400 font-medium">← Flip back</span>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <pre className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed font-sans break-words">
                    {card.body}
                  </pre>
                  {card.attach && (
                    <p className="mt-3 text-xs text-[var(--text-subtle)] italic">Attach: {card.attach}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            <div className="flex items-center gap-1.5">
              {deck.length <= 15 ? (
                deck.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setIdx(i); setFlipped(false) }}
                    className={`rounded-full transition-all ${i === idx ? 'w-3 h-3 bg-indigo-500' : 'w-2 h-2 bg-[var(--bg-muted)] hover:bg-[var(--text-subtle)]'}`}
                  />
                ))
              ) : (
                <span className="text-xs text-[var(--text-subtle)] font-mono">{idx + 1} / {deck.length}</span>
              )}
            </div>

            <button
              onClick={() => go(1)}
              disabled={idx === deck.length - 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

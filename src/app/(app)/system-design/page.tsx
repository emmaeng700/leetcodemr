'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Server, Layers, ExternalLink, Lightbulb, PenTool, Repeat2,
  Calculator, Smile, Search, Flag, ChevronLeft, ChevronRight,
  Shuffle, RotateCcw, CheckCircle, Circle
} from 'lucide-react'
import { SD_CARDS, SD_CATEGORIES } from '@/data/systemDesignCards'

interface SDCard {
  id: string
  category: string
  q: string
  a: string
}

function sdShuffle(arr: SDCard[]): SDCard[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CORE_ITEMS = [
  { num: '1', label: 'Requirements', desc: 'What data do you need?' },
  { num: '2', label: 'Data characteristics', desc: 'Size, patterns, access methods' },
  { num: '3', label: 'Data handling', desc: 'Storage, retrieval, integrity' },
]

const CASE_STUDIES = [
  {
    title: 'Rate Limiter',
    url: null,
    urlLabel: null,
    note: 'Popular YouTube tutorial on rate limiting. Solid for interviews.',
    schema: 'Schema is simple: store numbers and identity',
    missing: 'Design is not one-way — can use local rate limiters as safeguards',
    deeper: 'Think deeper: CPU/memory-based rate limiting, N² mesh problems',
  },
  {
    title: 'Chat Application',
    url: 'https://towardsdatascience.com/ace-your-system-design-interview-chat-application-3f34fd5b85d0',
    urlLabel: 'Read on Towards Data Science ↗',
    note: 'Written by a new grad but better than many "expert" solutions. Good data handling for entry-level.',
    schema: null, missing: null, deeper: null,
  },
  {
    title: 'Job Scheduling System',
    url: 'https://towardsdatascience.com/ace-your-system-design-interview-job-scheduling-system-b25693817950',
    urlLabel: 'Read on Towards Data Science ↗',
    note: 'Same author as above, similar quality.',
    schema: null, missing: null, deeper: null,
  },
]

function SectionCard({ icon: Icon, iconColor, borderColor, bgColor, headingColor, title, children }: {
  icon: React.ElementType; iconColor: string; borderColor: string; bgColor: string; headingColor: string; title: string; children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-white shadow-sm">
          <Icon size={18} className={iconColor} />
        </div>
        <h2 className={`text-base font-bold ${headingColor}`}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SDFlashcards() {
  const [cat, setCat] = useState('All')
  const [deck, setDeck] = useState<SDCard[]>(SD_CARDS as SDCard[])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(new Set())

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const buildDeck = useCallback((category: string, doShuffle: boolean) => {
    let cards = category === 'All' ? (SD_CARDS as SDCard[]) : (SD_CARDS as SDCard[]).filter(c => c.category === category)
    return doShuffle ? sdShuffle(cards) : cards
  }, [])

  const changeFilter = (newCat: string) => {
    setCat(newCat)
    fadeSwap(() => { setDeck(buildDeck(newCat, isShuffled)); setIdx(0); setFlipped(false) })
  }

  const toggleShuffle = () => {
    const next = !isShuffled
    setIsShuffled(next)
    fadeSwap(() => { setDeck(buildDeck(cat, next)); setIdx(0); setFlipped(false) })
  }

  const handleFlip = () => {
    const savedScroll = window.scrollY
    const restore = () => window.scrollTo(0, savedScroll)
    fadeSwap(() => setFlipped(f => !f))
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }

  const go = useCallback((dir: number) => {
    fadeSwap(() => {
      setFlipped(false)
      setIdx(i => Math.max(0, Math.min(deck.length - 1, i + dir)))
    })
  }, [deck.length, fadeSwap])

  const reset = () => fadeSwap(() => { setIdx(0); setFlipped(false) })

  const card = deck[idx] || null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, handleFlip])

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200 px-3 py-1.5 rounded-full">
          {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
        </span>
        <span className="text-xs font-semibold bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-full flex items-center gap-1">
          <CheckCircle size={11} /> {visited.size} / {SD_CARDS.length} visited
        </span>
        <button
          onClick={toggleShuffle}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            isShuffled ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
          }`}
        >
          <Shuffle size={11} /> Shuffle
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border bg-white text-gray-500 border-gray-200 hover:border-gray-400 transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(SD_CATEGORIES as string[]).map(c => (
          <button
            key={c}
            onClick={() => changeFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              cat === c ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {card && (
        <>
          <div
            onClick={handleFlip}
            className="cursor-pointer select-none"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
          >
            {!flipped ? (
              /* FRONT */
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden min-h-[200px]">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-gray-100">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
                    {card.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const next = new Set(visited)
                        next.has(card.id) ? next.delete(card.id) : next.add(card.id)
                        setVisited(next)
                      }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        visited.has(card.id) ? 'bg-green-50 text-green-600 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-500'
                      }`}
                    >
                      {visited.has(card.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                    </button>
                    <span className="hidden sm:inline text-xs text-gray-300 font-medium">Tap to reveal →</span>
                  </div>
                </div>
                <div className="px-5 py-6 flex items-center justify-center min-h-[160px]">
                  <h2 className="text-lg font-bold text-gray-800 text-center leading-snug">{card.q}</h2>
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-gray-700">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-900 text-sky-300 border border-sky-700">
                    {card.category}
                  </span>
                  <span className="hidden sm:inline text-xs text-gray-500 font-medium">← Flip back</span>
                </div>
                <div className="px-5 py-4 overflow-x-auto">
                  <p className="text-xs font-bold text-sky-400 mb-3 uppercase tracking-wide">{card.q}</p>
                  <pre className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed font-sans break-words">
                    {card.a}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => go(-1)}
              disabled={idx === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-30 bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <p className="text-xs text-gray-400">Space or tap to flip</p>
            <button
              onClick={() => go(1)}
              disabled={idx === deck.length - 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-30 bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function SystemDesignPage() {
  const [tab, setTab] = useState('tips')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-md">
          <Server size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">System Design</h1>
          <p className="text-sm text-gray-500">How to think, draw, and communicate large-scale systems</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[{ id: 'tips', icon: Server, label: 'Interview Tips' }, { id: 'flashcards', icon: Layers, label: 'Flashcards' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'flashcards' && <SDFlashcards />}

      {tab === 'tips' && (
        <>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Interview Tips</p>

          <SectionCard icon={Lightbulb} iconColor="text-amber-500" borderColor="border-amber-100" bgColor="bg-amber-50" headingColor="text-amber-700" title="Core Understanding">
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Most system design interviews revolve around these three things — in order:</p>
            <div className="space-y-2 mb-4">
              {CORE_ITEMS.map(item => (
                <div key={item.num} className="flex items-start gap-3 bg-white rounded-xl border border-amber-100 px-4 py-3 shadow-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">{item.num}</span>
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                    <span className="text-sm text-gray-400"> → {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-100 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                This is why DDIA (Designing Data-Intensive Applications) is so valuable — it is entirely data-centric design.
              </p>
            </div>
          </SectionCard>

          <SectionCard icon={PenTool} iconColor="text-indigo-500" borderColor="border-indigo-100" bgColor="bg-indigo-50" headingColor="text-indigo-700" title="Drawing & Explaining">
            <p className="text-sm text-gray-500 mb-3">Interviewers want to see three things from you:</p>
            <div className="space-y-2">
              {['Reasonable infrastructure choices', 'Correct data flow', 'Clear thinking process'].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-indigo-100 px-4 py-3 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <p className="text-sm text-gray-700 font-medium">{item}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard icon={Repeat2} iconColor="text-violet-500" borderColor="border-violet-100" bgColor="bg-violet-50" headingColor="text-violet-700" title="Pattern Recognition">
            <p className="text-sm text-gray-500 mb-3">Many design problems share common patterns — the more you study, the more you see them:</p>
            <div className="space-y-2">
              <div className="bg-white rounded-xl border border-violet-100 px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Group chat</span>
                  <span className="text-gray-400"> ≈ </span>
                  <span className="font-semibold">Multiplayer card games</span>
                  <span className="text-gray-400 text-xs block mt-0.5">Similar data handling patterns underneath</span>
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Calculator} iconColor="text-emerald-500" borderColor="border-emerald-100" bgColor="bg-emerald-50" headingColor="text-emerald-700" title="Capacity Estimation">
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-emerald-100 px-4 py-3 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">In interviews</p>
                <p className="text-sm text-gray-700">Order of magnitude is usually enough: TB vs GB? Million vs thousand QPS?</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Smile} iconColor="text-pink-400" borderColor="border-pink-100" bgColor="bg-pink-50" headingColor="text-pink-600" title="Luck Factor">
            <p className="text-sm text-gray-500 leading-relaxed">
              Sometimes you get difficult interviewers — no technique helps there. Do not let one bad interview shake your confidence.
            </p>
          </SectionCard>

          <div className="border-t border-gray-200" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recommended Case Studies</p>

          <div className="space-y-3">
            {CASE_STUDIES.map((cs, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <h3 className="text-sm font-bold text-gray-800">{cs.title}</h3>
                </div>
                <div className="space-y-2 ml-9">
                  <p className="text-sm text-gray-500 leading-relaxed">{cs.note}</p>
                  {cs.schema && <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">{cs.schema}</p>}
                  {cs.missing && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Missing: {cs.missing}</p>}
                  {cs.deeper && <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2">{cs.deeper}</p>}
                  {cs.url && (
                    <a href={cs.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-800 transition-colors">
                      <ExternalLink size={11} />{cs.urlLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <SectionCard icon={Flag} iconColor="text-rose-500" borderColor="border-rose-100" bgColor="bg-rose-50" headingColor="text-rose-700" title="Final Thoughts">
            <p className="text-sm text-gray-600 leading-relaxed">
              The key to system design mastery is accumulating real experience and learning from actual industrial solutions.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  )
}

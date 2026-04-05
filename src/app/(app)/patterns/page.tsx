'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, ChevronLeft, Shuffle, RotateCcw,
  CheckCircle, Circle, List, Layers,
} from 'lucide-react'
import { getProgress, getPatternFcVisited, addPatternFcVisited } from '@/lib/db'
import { shuffle } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
  python_solution?: string
  cpp_solution?: string
}

const PATTERNS = [
  { id: 'arrays',    name: 'Arrays & Hashing',        icon: '🗂',  tags: ['Array', 'Hash Table'] },
  { id: 'twoptr',    name: 'Two Pointers',             icon: '👇',  tags: ['Two Pointers'] },
  { id: 'sliding',   name: 'Sliding Window',           icon: '🪟',  tags: ['Sliding Window'] },
  { id: 'binsearch', name: 'Binary Search',            icon: '🔍',  tags: ['Binary Search'] },
  { id: 'stack',     name: 'Stack',                    icon: '📚',  tags: ['Stack', 'Monotonic Stack'] },
  { id: 'll',        name: 'Linked List',              icon: '🔗',  tags: ['Linked List', 'Doubly-Linked List', 'Doubly Linked List'] },
  { id: 'trees',     name: 'Trees & BST',              icon: '🌳',  tags: ['Tree', 'Binary Tree', 'Binary Search Tree', 'BST'] },
  { id: 'trie',      name: 'Tries',                    icon: '🌐',  tags: ['Trie'] },
  { id: 'heap',      name: 'Heap / Priority Queue',    icon: '⛰️', tags: ['Heap', 'Heap (Priority Queue)'] },
  { id: 'backtrack', name: 'Backtracking',             icon: '↩️', tags: ['Backtracking'] },
  { id: 'graphs',    name: 'Graphs',                   icon: '🕸️', tags: ['Graph', 'Union Find', 'Topological Sort'] },
  { id: 'bfs',       name: 'Breadth-First Search',     icon: '🌊',  tags: ['BFS', 'Breadth-First Search'] },
  { id: 'dfs',       name: 'Depth-First Search',       icon: '🤿',  tags: ['DFS', 'Depth-First Search'] },
  { id: 'dp',        name: 'Dynamic Programming',      icon: '💡',  tags: ['Dynamic Programming', 'Memoization'] },
  { id: 'greedy',    name: 'Greedy',                   icon: '🎯',  tags: ['Greedy'] },
  { id: 'math',      name: 'Math & Bit Manipulation',  icon: '🔢',  tags: ['Math', 'Bit Manipulation', 'Number Theory'] },
  { id: 'strings',   name: 'Strings',                  icon: '📝',  tags: ['String'] },
  { id: 'sorting',   name: 'Sorting & Divide',         icon: '📊',  tags: ['Sorting', 'Divide and Conquer'] },
  { id: 'matrix',    name: 'Matrix / Grid',            icon: '⬜',  tags: ['Matrix'] },
  { id: 'design',    name: 'Design & Simulation',      icon: '🏗️', tags: ['Design', 'Simulation', 'Recursion'] },
]

const PALETTE: [string, string, string][] = [
  ['bg-blue-50',    'border-blue-200',    'bg-blue-500'],
  ['bg-cyan-50',    'border-cyan-200',    'bg-cyan-500'],
  ['bg-sky-50',     'border-sky-200',     'bg-sky-500'],
  ['bg-violet-50',  'border-violet-200',  'bg-violet-500'],
  ['bg-orange-50',  'border-orange-200',  'bg-orange-500'],
  ['bg-pink-50',    'border-pink-200',    'bg-pink-500'],
  ['bg-green-50',   'border-green-200',   'bg-green-500'],
  ['bg-teal-50',    'border-teal-200',    'bg-teal-500'],
  ['bg-yellow-50',  'border-yellow-200',  'bg-yellow-500'],
  ['bg-rose-50',    'border-rose-200',    'bg-rose-500'],
  ['bg-indigo-50',  'border-indigo-200',  'bg-indigo-500'],
  ['bg-blue-50',    'border-blue-300',    'bg-blue-400'],
  ['bg-emerald-50', 'border-emerald-200', 'bg-emerald-500'],
  ['bg-amber-50',   'border-amber-200',   'bg-amber-500'],
  ['bg-lime-50',    'border-lime-200',    'bg-lime-500'],
  ['bg-purple-50',  'border-purple-200',  'bg-purple-500'],
  ['bg-fuchsia-50', 'border-fuchsia-200', 'bg-fuchsia-500'],
  ['bg-slate-50',   'border-slate-200',   'bg-slate-500'],
  ['bg-gray-50',    'border-gray-300',    'bg-gray-400'],
  ['bg-zinc-50',    'border-zinc-200',    'bg-zinc-500'],
]

// Only renders the image block if the image actually loads — no dead zone on 404s
function ImageIfExists({ id, title }: { id: number; title: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <img
        src={`/question-images/${id}.jpg`}
        alt={title}
        className={`mx-4 mb-4 w-[calc(100%-2rem)] rounded-lg border border-gray-100 ${loaded ? 'block' : 'hidden'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </>
  )
}

function PatternFlashcards({
  questions,
  progress,
  visited,
  onVisit,
}: {
  questions: Question[]
  progress: Record<string, any>
  visited: Set<number>
  onVisit: (id: number) => void
}) {
  const router = useRouter()
  const [deck, setDeck] = useState(questions)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [shuffled, setShuffled] = useState(false)

  const prevQsRef = useRef(questions)
  useEffect(() => {
    if (prevQsRef.current !== questions) {
      prevQsRef.current = questions
      setDeck(shuffled ? shuffle(questions) : questions)
      setIdx(0)
      setFlipped(false)
    }
  }, [questions, shuffled])

  useEffect(() => {
    setDeck(shuffled ? shuffle(questions) : questions)
    setIdx(0)
    setFlipped(false)
  }, [shuffled])

  const card = deck[idx] || null
  const visitedInDeck = deck.filter(q => visited.has(q.id)).length

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const go = useCallback((dir: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!deck.length) return
    fadeSwap(() => {
      setIdx(i => (i + dir + deck.length) % deck.length)
      setFlipped(false)
    })
  }, [deck, fadeSwap])

  const handleFlip = useCallback(() => {
    if (!card) return
    const savedScroll = window.scrollY
    const restore = () => window.scrollTo(0, savedScroll)
    fadeSwap(() => {
      const next = !flipped
      setFlipped(next)
      if (next) onVisit(card.id)
    })
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }, [card, flipped, fadeSwap, onVisit])

  const toggleVisited = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    onVisit(id)
  }, [onVisit])

  if (!card) return null

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600">
          {idx + 1} / {deck.length}
        </span>
        <span className="text-xs font-semibold bg-green-50 text-green-600 border border-green-200 px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle size={10} /> {visitedInDeck} visited
        </span>
        <button
          onClick={e => { e.stopPropagation(); setShuffled(s => !s) }}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
            shuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
          }`}
        >
          <Shuffle size={10} /> Shuffle
        </button>
        <button
          onClick={e => { e.stopPropagation(); setIdx(0); setFlipped(false); setShuffled(false) }}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border bg-white text-gray-500 border-gray-200 hover:border-gray-400 transition-colors"
        >
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div
        onClick={handleFlip}
        className="cursor-pointer select-none"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
      >
        {!flipped ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">#{card.id}</span>
                <DifficultyBadge difficulty={card.difficulty} />
                {progress[String(card.id)]?.solved && (
                  <span className="text-xs text-green-600 font-semibold">✓ Solved</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50 text-green-600 border-green-300'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-500'
                  }`}
                >
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-gray-300">Tap to reveal →</span>
              </div>
            </div>
            <div className="px-4 py-5 flex items-center justify-center min-h-[100px]">
              <h3 className="text-base font-bold text-gray-800 text-center leading-snug">{card.title}</h3>
            </div>
            <ImageIfExists id={card.id} title={card.title} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-indigo-100 bg-indigo-50">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 font-mono shrink-0">#{card.id}</span>
                <DifficultyBadge difficulty={card.difficulty} />
                <span
                  className="text-sm font-bold text-indigo-800 truncate cursor-pointer hover:underline"
                  onClick={e => { e.stopPropagation(); router.push(`/practice/${card.id}`) }}
                >
                  {card.title} ↗
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50 text-green-600 border-green-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-500'
                  }`}
                >
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-indigo-400">← Flip back</span>
              </div>
            </div>
            <div className="p-3" onClick={e => e.stopPropagation()}>
              <CodePanel pythonCode={card.python_solution} cppCode={card.cpp_solution} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          onClick={e => go(-1, e)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs font-medium"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          onClick={e => { e.stopPropagation(); router.push(`/practice/${card.id}`) }}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs font-medium"
        >
          Open question ↗
        </button>
        <button
          onClick={e => go(1, e)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs font-medium"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export default function PatternsPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
      getPatternFcVisited(),
    ]).then(([qs, prog, vis]) => {
      setQuestions(qs)
      setProgress(prog)
      setVisited(vis)
      setLoading(false)
    })
  }, [])

  const handleVisit = useCallback(async (id: number) => {
    setVisited(prev => {
      const s = new Set(prev)
      s.add(id)
      return s
    })
    await addPatternFcVisited(id)
  }, [])

  // Hooks must be before any early returns
  const patternData = useMemo(() =>
    PATTERNS.map(p => {
      const qs = questions.filter(q => (q.tags || []).some(t => p.tags.includes(t)))
      const solvedCount = qs.filter(q => progress[String(q.id)]?.solved).length
      return { ...p, questions: qs, solved: solvedCount, total: qs.length }
    }).filter(p => p.total > 0),
  [questions, progress])

  const totalSolved = questions.filter(q => progress[String(q.id)]?.solved).length

  const getMode = (id: string) => viewMode[id] || 'flashcards'
  const setMode = (id: string, mode: string) => setViewMode(prev => ({ ...prev, [id]: mode }))

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading patterns…</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
        🕸️ Patterns
      </h1>
      <p className="text-sm text-gray-400 mb-2">
        Study by algorithm pattern. Questions can appear in multiple patterns.
      </p>
      <p className="text-xs text-indigo-500 font-semibold mb-7">
        {totalSolved} / {questions.length} questions solved overall
      </p>

      <div className="space-y-3">
        {patternData.map((p, i) => {
          const [bg, border, bar] = PALETTE[i % PALETTE.length]
          const pct = p.total ? Math.round((p.solved / p.total) * 100) : 0
          const isOpen = expanded === p.id
          const mode = getMode(p.id)

          return (
            <div key={p.id} className={`rounded-xl border ${bg} ${border} overflow-hidden`}>
              <button
                className="w-full px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 text-left hover:brightness-[0.97] transition-all"
                onClick={() => setExpanded(isOpen ? null : p.id)}
              >
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="font-bold text-gray-800 text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500 shrink-0 font-mono">
                      {p.solved}/{p.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-gray-400 shrink-0">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/60">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <button
                      onClick={() => setMode(p.id, 'flashcards')}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                        mode === 'flashcards'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <Layers size={11} /> Flashcards
                    </button>
                    <button
                      onClick={() => setMode(p.id, 'list')}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                        mode === 'list'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <List size={11} /> List
                    </button>
                  </div>

                  {mode === 'flashcards' ? (
                    <PatternFlashcards
                      questions={p.questions}
                      progress={progress}
                      visited={visited}
                      onVisit={handleVisit}
                    />
                  ) : (
                    <div className="bg-white/70 divide-y divide-white/60">
                      {p.questions.map(q => {
                        const prog = progress[String(q.id)] || {}
                        return (
                          <div
                            key={q.id}
                            onClick={() => router.push(`/practice/${q.id}`)}
                            className="flex items-center gap-2 px-3 sm:px-5 py-2.5 cursor-pointer hover:bg-white/90 transition-colors group"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${prog.solved ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 truncate flex-1">
                              {q.title}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <DifficultyBadge difficulty={q.difficulty} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

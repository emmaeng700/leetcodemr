'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, ChevronLeft, Shuffle, RotateCcw,
  CheckCircle, Circle, List, Layers,
} from 'lucide-react'
import { getProgress, getPatternFcVisited, addPatternFcVisited } from '@/lib/db'
import { shuffle } from '@/lib/utils'
import { QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import QuestionImage from '@/components/QuestionImage'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
  python_solution?: string
  cpp_solution?: string
}

// One icon per QUICK_PATTERNS entry — order matches QUICK_PATTERNS in constants.ts
const PATTERN_ICONS: Record<string, string> = {
  'Bit Manipulation':    '⚡',
  'Trie':                '🌐',
  'Heap':                '⛰️',
  'Stack':               '📚',
  'Sliding Window':      '🪟',
  'Backtracking':        '↩️',
  'Linked List':         '🔗',
  'Trees & BST':         '🌳',
  'DFS':                 '🤿',
  'BFS':                 '🌊',
  'Graphs':              '🕸️',
  'Matrix':              '⬜',
  'Two Pointers':        '👇',
  'Binary Search':       '🔍',
  'Dynamic Programming': '💡',
  'Greedy':              '🎯',
  'Sorting':             '📊',
  'Math':                '🔢',
  'String':              '📝',
  'JavaScript':          '🟨',
  'Arrays & Hashing':    '🗂',
}

const PALETTE: [string, string, string][] = [
  ['bg-blue-50 dark:bg-blue-950/40',    'border-blue-200 dark:border-blue-500/30',    'bg-blue-500'],
  ['bg-pink-50 dark:bg-pink-950/40',    'border-pink-200 dark:border-pink-500/30',    'bg-pink-500'],
  ['bg-cyan-50 dark:bg-cyan-950/40',    'border-cyan-200 dark:border-cyan-500/30',    'bg-cyan-500'],
  ['bg-violet-50 dark:bg-violet-950/40','border-violet-200 dark:border-violet-500/30','bg-violet-500'],
  ['bg-sky-50 dark:bg-sky-950/40',      'border-sky-200 dark:border-sky-500/30',      'bg-sky-500'],
  ['bg-orange-50 dark:bg-orange-950/40','border-orange-200 dark:border-orange-500/30','bg-orange-500'],
  ['bg-indigo-50 dark:bg-indigo-950/40','border-indigo-200 dark:border-indigo-500/30','bg-indigo-500'],
  ['bg-green-50 dark:bg-green-950/40',  'border-green-200 dark:border-green-500/30',  'bg-green-500'],
  ['bg-teal-50 dark:bg-teal-950/40',    'border-teal-200 dark:border-teal-500/30',    'bg-teal-500'],
  ['bg-yellow-50 dark:bg-yellow-950/40','border-yellow-200 dark:border-yellow-500/30','bg-yellow-500'],
  ['bg-rose-50 dark:bg-rose-950/40',    'border-rose-200 dark:border-rose-500/30',    'bg-rose-500'],
  ['bg-emerald-50 dark:bg-emerald-950/40','border-emerald-200 dark:border-emerald-500/30','bg-emerald-500'],
  ['bg-amber-50 dark:bg-amber-950/40',  'border-amber-200 dark:border-amber-500/30',  'bg-amber-500'],
  ['bg-fuchsia-50 dark:bg-fuchsia-950/40','border-fuchsia-200 dark:border-fuchsia-500/30','bg-fuchsia-500'],
  ['bg-lime-50 dark:bg-lime-950/40',    'border-lime-200 dark:border-lime-500/30',    'bg-lime-500'],
  ['bg-purple-50 dark:bg-purple-950/40','border-purple-200 dark:border-purple-500/30','bg-purple-500'],
  ['bg-slate-50 dark:bg-slate-800/60',  'border-slate-200 dark:border-slate-500/30',  'bg-slate-500'],
  ['bg-blue-50 dark:bg-blue-950/40',    'border-blue-300 dark:border-blue-400/30',    'bg-blue-400'],
  ['bg-zinc-50 dark:bg-zinc-900/40',    'border-zinc-200 dark:border-zinc-500/30',    'bg-zinc-500'],
  ['bg-red-50 dark:bg-red-950/40',      'border-red-200 dark:border-red-500/30',      'bg-red-500'],
]

function ImageIfExists({ id, title }: { id: number; title: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      {loaded && (
        <div className="mx-4 mb-4 w-[calc(100%-2rem)]">
          <QuestionImage questionId={id} alt={title} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/question-images/${id}.jpg`} alt="" className="hidden"
        onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} />
    </>
  )
}

function PatternFlashcards({
  questions, progress, visited, onVisit,
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
      setIdx(0); setFlipped(false)
    }
  }, [questions, shuffled])

  useEffect(() => {
    setDeck(shuffled ? shuffle(questions) : questions)
    setIdx(0); setFlipped(false)
  }, [shuffled]) // eslint-disable-line react-hooks/exhaustive-deps

  const card = deck[idx] || null
  const visitedInDeck = deck.filter(q => visited.has(q.id)).length

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const go = useCallback((dir: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!deck.length) return
    fadeSwap(() => { setIdx(i => (i + dir + deck.length) % deck.length); setFlipped(false) })
  }, [deck, fadeSwap])

  const handleFlip = useCallback(() => {
    if (!card) return
    const savedScroll = window.scrollY
    const restore = () => window.scrollTo(0, savedScroll)
    fadeSwap(() => { const next = !flipped; setFlipped(next); if (next) onVisit(card.id) })
    setTimeout(() => { restore(); requestAnimationFrame(restore) }, 190)
  }, [card, flipped, fadeSwap, onVisit])

  const toggleVisited = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation(); onVisit(id)
  }, [onVisit])

  if (!card) return null

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded-full text-[var(--text-muted)]">
          {idx + 1} / {deck.length}
        </span>
        <span className="text-xs font-semibold bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle size={10} /> {visitedInDeck} visited
        </span>
        <button onClick={e => { e.stopPropagation(); setShuffled(s => !s) }}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
            shuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
          }`}>
          <Shuffle size={10} /> Shuffle
        </button>
        <button onClick={e => { e.stopPropagation(); setIdx(0); setFlipped(false); setShuffled(false) }}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-subtle)] transition-colors">
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div onClick={handleFlip} className="cursor-pointer select-none"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}>
        {!flipped ? (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--text-subtle)] font-mono">#{card.id}</span>
                <DifficultyBadge difficulty={card.difficulty} />
                {progress[String(card.id)]?.solved && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✓ Solved</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/40'
                      : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                  }`}>
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-[var(--text-subtle)]">Tap to reveal →</span>
              </div>
            </div>
            <div className="px-4 py-5 flex items-center justify-center min-h-[100px]">
              <h3 className="text-base font-bold text-[var(--text)] text-center leading-snug">{card.title}</h3>
            </div>
            <ImageIfExists id={card.id} title={card.title} />
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-xl border border-indigo-300 dark:border-indigo-500/50 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{card.id}</span>
                <DifficultyBadge difficulty={card.difficulty} />
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate cursor-pointer hover:underline"
                  onClick={e => { e.stopPropagation(); router.push(`/practice/${card.id}`) }}>
                  {card.title} ↗
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/40'
                      : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                  }`}>
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-indigo-400 dark:text-indigo-300">← Flip back</span>
              </div>
            </div>
            <div className="p-3">
              <CodePanel pythonCode={card.python_solution} cppCode={card.cpp_solution} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 mt-3">
        <button onClick={e => go(-1, e)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-500 transition-colors text-xs font-medium">
          <ChevronLeft size={14} /> Prev
        </button>
        <button onClick={e => { e.stopPropagation(); router.push(`/practice/${card.id}`) }}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-500 transition-colors text-xs font-medium">
          Open question ↗
        </button>
        <button onClick={e => go(1, e)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-500 transition-colors text-xs font-medium">
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
      setQuestions(qs); setProgress(prog); setVisited(vis); setLoading(false)
    })
  }, [])

  const handleVisit = useCallback(async (id: number) => {
    setVisited(prev => { const s = new Set(prev); s.add(id); return s })
    await addPatternFcVisited(id)
  }, [])

  // Build exclusive map — each question belongs to exactly one pattern
  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])

  const patternData = useMemo(() =>
    QUICK_PATTERNS.map((p, i) => {
      const qs = questions
        .filter(q => exclusiveMap[q.id] === p.name)
        .sort((a, b) => ({ Easy: 0, Medium: 1, Hard: 2 }[a.difficulty] ?? 1) - ({ Easy: 0, Medium: 1, Hard: 2 }[b.difficulty] ?? 1))
      const solved = qs.filter(q => progress[String(q.id)]?.solved).length
      const palette = PALETTE[i % PALETTE.length]
      return { name: p.name, icon: PATTERN_ICONS[p.name] ?? '🧩', questions: qs, solved, total: qs.length, palette }
    }).filter(p => p.total > 0),
  [questions, progress, exclusiveMap])

  const totalSolved = questions.filter(q => progress[String(q.id)]?.solved).length
  const getMode = (name: string) => viewMode[name] || 'flashcards'
  const setMode = (name: string, mode: string) => setViewMode(prev => ({ ...prev, [name]: mode }))

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading patterns…</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">🕸️ Patterns</h1>
      <p className="text-sm text-[var(--text-muted)] mb-1">
        Each question belongs to exactly one pattern — no repetition across sections.
      </p>
      <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold mb-7">
        {totalSolved} / {questions.length} questions solved overall
      </p>

      <div className="space-y-3">
        {patternData.map(p => {
          const [bg, border, bar] = p.palette
          const pct = p.total ? Math.round((p.solved / p.total) * 100) : 0
          const isOpen = expanded === p.name
          const mode = getMode(p.name)

          return (
            <div key={p.name} className={`rounded-xl border ${bg} ${border} overflow-hidden`}>
              <button
                className="w-full px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 text-left hover:brightness-[0.97] dark:hover:brightness-110 transition-all"
                onClick={() => setExpanded(isOpen ? null : p.name)}
              >
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="font-bold text-[var(--text)] text-sm">{p.name}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0 font-mono">
                      {p.solved}/{p.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-[var(--text-subtle)] shrink-0">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/40 dark:border-white/10">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <button onClick={() => setMode(p.name, 'flashcards')}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                        mode === 'flashcards' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
                      }`}>
                      <Layers size={11} /> Flashcards
                    </button>
                    <button onClick={() => setMode(p.name, 'list')}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                        mode === 'list' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
                      }`}>
                      <List size={11} /> List
                    </button>
                  </div>

                  {mode === 'flashcards' ? (
                    <PatternFlashcards questions={p.questions} progress={progress} visited={visited} onVisit={handleVisit} />
                  ) : (
                    <div className="divide-y divide-white/30 dark:divide-white/5">
                      {p.questions.map(q => {
                        const prog = progress[String(q.id)] || {}
                        return (
                          <div key={q.id} onClick={() => router.push(`/practice/${q.id}`)}
                            className="flex items-center gap-2 px-3 sm:px-5 py-2.5 cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${prog.solved ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
                            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
                            <span className="text-sm font-medium text-[var(--text)] group-hover:text-indigo-500 truncate flex-1">{q.title}</span>
                            <DifficultyBadge difficulty={q.difficulty} />
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

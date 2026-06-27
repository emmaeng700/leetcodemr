'use client'
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { isMcpPath, mcpTabUrl } from '@/lib/mcpNav'
import {
  ChevronDown, ChevronRight, ChevronLeft, Shuffle, RotateCcw,
  CheckCircle, Circle, List, Layers, ExternalLink,
} from 'lucide-react'
import { getProgress, getPatternFcVisited, addPatternFcVisited } from '@/lib/db'
import { shuffle, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { DISPLAY_PATTERN_ORDER, QUICK_PATTERNS } from '@/lib/constants'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import { getSetProgress, updateSetQProgress, type SetQProgress } from '@/lib/setProgress'
import { learnHrefForSetQuestion } from '@/lib/dailyExtension'
import DifficultyBadge from '@/components/DifficultyBadge'
import PriorityBadge from '@/components/PriorityBadge'
import CodePanel from '@/components/CodePanel'
import QuestionImage from '@/components/QuestionImage'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  python_solution?: string
  cpp_solution?: string
}

const ORDERED_QUICK_PATTERNS = QUICK_PATTERNS
  .slice()
  .sort(
    (a, b) =>
      DISPLAY_PATTERN_ORDER.indexOf(a.name as typeof DISPLAY_PATTERN_ORDER[number]) -
      DISPLAY_PATTERN_ORDER.indexOf(b.name as typeof DISPLAY_PATTERN_ORDER[number])
  )

// One icon per pattern name; render order comes from DISPLAY_PATTERN_ORDER.
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
  ['bg-blue-50 ',    'border-blue-200 ',    'bg-blue-500'],
  ['bg-pink-50 ',    'border-pink-200 ',    'bg-pink-500'],
  ['bg-cyan-50 ',    'border-cyan-200 ',    'bg-cyan-500'],
  ['bg-violet-50 ','border-violet-200 ','bg-violet-500'],
  ['bg-sky-50 ',      'border-sky-200 ',      'bg-sky-500'],
  ['bg-orange-50 ','border-orange-200 ','bg-orange-500'],
  ['bg-indigo-50 ','border-indigo-200 ','bg-indigo-500'],
  ['bg-green-50 ',  'border-green-200 ',  'bg-green-500'],
  ['bg-teal-50 ',    'border-teal-200 ',    'bg-teal-500'],
  ['bg-yellow-50 ','border-yellow-200 ','bg-yellow-500'],
  ['bg-rose-50 ',    'border-rose-200 ',    'bg-rose-500'],
  ['bg-emerald-50 ','border-emerald-200 ','bg-emerald-500'],
  ['bg-amber-50 ',  'border-amber-200 ',  'bg-amber-500'],
  ['bg-fuchsia-50 ','border-fuchsia-200 ','bg-fuchsia-500'],
  ['bg-lime-50 ',    'border-lime-200 ',    'bg-lime-500'],
  ['bg-purple-50 ','border-purple-200 ','bg-purple-500'],
  ['bg-slate-50 ',  'border-slate-200 ',  'bg-slate-500'],
  ['bg-blue-50 ',    'border-blue-300 ',    'bg-blue-400'],
  ['bg-zinc-50 ',    'border-zinc-200 ',    'bg-zinc-500'],
  ['bg-red-50 ',      'border-red-200 ',      'bg-red-500'],
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

type PatternFlashcardsProps = {
  questions: Question[]
  progress: Record<string, any>
  visited: Set<number>
  onVisit: (id: number) => void
  questionHref: (q: Question) => string
  isSolved: (id: number) => boolean
  extensionSet?: 2 | 3
  onToggleSolved?: (id: number) => void
  solutionBase?: string
  solutionLabel?: string
}

function PatternFlashcards({
  questions, progress, visited, onVisit,
  questionHref, isSolved, extensionSet,
  onToggleSolved, solutionBase, solutionLabel,
}: PatternFlashcardsProps) {
  const router = useRouter()
  const [deck, setDeck] = useState(questions)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [shuffled, setShuffled] = useState(false)
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const lcCacheRef = useRef<Record<string, string>>({})

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

  // Reset + fetch live LeetCode description when card changes
  useEffect(() => {
    if (!card?.slug) return
    const titleSlug = resolveLeetCodeSlug(card.id, card.slug)
    setLcContent(lcCacheRef.current[titleSlug] ?? null)
    setIsPremium(false)
    if (lcCacheRef.current[titleSlug]) return
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const session   = typeof window !== 'undefined' ? localStorage.getItem('lc_session')  || '' : ''
    const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('lc_csrf')     || '' : ''
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const qd = data?.data?.question
        if (qd?.isPaidOnly && !qd?.content) setIsPremium(true)
        else if (qd?.content) { lcCacheRef.current[titleSlug] = qd.content; setLcContent(qd.content) }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [card?.id, card?.slug])

  if (!card) return null

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded-full text-[var(--text-muted)]">
          {idx + 1} / {deck.length}
        </span>
        <span className="text-xs font-semibold bg-green-50  text-green-600  border border-green-200  px-3 py-1 rounded-full flex items-center gap-1">
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
                {isSolved(card.id) && (
                  <span className="text-xs text-green-600  font-semibold">✓ Solved</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50  text-green-600  border-green-300 '
                      : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                  }`}>
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-[var(--text-subtle)]">Tap to reveal →</span>
              </div>
            </div>
            <div className="px-4 pt-3 pb-1">
              <h3 className="text-base font-bold text-[var(--text)] leading-snug">{card.title}</h3>
            </div>
            <div className="px-4 pb-4 mt-1" onClick={e => e.stopPropagation()}>
              {lcContent ? (
                <div className="lc-description text-sm text-[var(--text)]"
                  dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
              ) : lcLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                  <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                  <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                  <div className="h-8 bg-[var(--bg-muted)] rounded w-full mt-2" />
                </div>
              ) : isPremium ? (
                <p className="text-xs text-[var(--text-subtle)] italic">🔒 Premium — <a href={leetCodeUrl(resolveLeetCodeSlug(card.id, card.slug))} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">view on LeetCode ↗</a></p>
              ) : (
                <ImageIfExists id={card.id} title={card.title} />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-xl border border-indigo-300  shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-indigo-200  bg-indigo-50 ">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{card.id}</span>
                <DifficultyBadge difficulty={card.difficulty} />
                <span className="text-sm font-bold text-indigo-700  truncate cursor-pointer hover:underline"
                  onClick={e => { e.stopPropagation(); router.push(questionHref(card)) }}>
                  {card.title} ↗
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e => toggleVisited(e, card.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    visited.has(card.id)
                      ? 'bg-green-50  text-green-600  border-green-300 '
                      : 'bg-[var(--bg-card)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-300 hover:text-green-500'
                  }`}>
                  {visited.has(card.id) ? <><CheckCircle size={10} /> Visited</> : <><Circle size={10} /> Mark</>}
                </button>
                <span className="hidden sm:inline text-xs text-indigo-400 ">← Flip back</span>
              </div>
            </div>
            <div className="p-3" onClick={e => e.stopPropagation()}>
              {extensionSet && solutionBase && solutionLabel ? (
                <div className="space-y-3">
                  <Link href={`${solutionBase}/${card.slug}`}
                    className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors ${
                      extensionSet === 2 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'
                    }`}>
                    <ExternalLink size={14} /> View Solution on {solutionLabel}
                  </Link>
                  <a href={leetCodeUrl(resolveLeetCodeSlug(card.id, card.slug))} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors">
                    <ExternalLink size={14} /> Open on LeetCode
                  </a>
                  {onToggleSolved && (
                    <button type="button" onClick={() => onToggleSolved(card.id)}
                      className={`flex w-full items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        isSolved(card.id)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-green-400'
                      }`}>
                      {isSolved(card.id) ? <><CheckCircle size={13} /> Solved</> : <><Circle size={13} /> Mark Solved</>}
                    </button>
                  )}
                </div>
              ) : (
                <CodePanel pythonCode={card.python_solution} cppCode={card.cpp_solution} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 mt-3">
        <button onClick={e => go(-1, e)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-500 transition-colors text-xs font-medium">
          <ChevronLeft size={14} /> Prev
        </button>
        <button onClick={e => { e.stopPropagation(); router.push(questionHref(card)) }}
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

function PatternsSetTabBar({ set, setSet }: { set: 1|2|3; setSet: (s: 1|2|3) => void }) {
  return (
    <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
      {([1, 2, 3] as const).map(s => (
        <button key={s} onClick={() => setSet(s)}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
            set === s ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
          }`}>
          {s === 1 ? 'Set 1 (331)' : s === 2 ? 'Set 2 (NC250)' : 'Set 3 (AM600)'}
        </button>
      ))}
    </div>
  )
}

function PatternsHub() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [set, setSet] = useState<1|2|3>(() => {
    const s = parseInt(searchParams.get('set') ?? '1', 10)
    return (s === 2 || s === 3) ? s : 1
  })
  const pickSet = (s: 1 | 2 | 3) => {
    setSet(s)
    router.replace(
      isMcpPath(pathname) ? mcpTabUrl('patterns', { set: s }) : `/patterns?set=${s}`,
      { scroll: false },
    )
  }
  return (
    <>
      <PatternsSetTabBar set={set} setSet={pickSet} />
      <PatternsPage set={set} key={set} />
    </>
  )
}

export default function PatternsRoot() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm">Loading…</div>}>
      <PatternsHub />
    </Suspense>
  )
}

function setQuestionToPatternQuestion(q: SetQuestion): Question {
  return {
    id: q.id,
    title: q.title,
    slug: q.slug,
    difficulty: q.difficulty,
    tags: q.tags,
  }
}

const SET_META: Record<2 | 3, { label: string; solutionBase: string; solutionLabel: string }> = {
  2: { label: 'NeetCode 250', solutionBase: '/neetcode', solutionLabel: 'NeetCode' },
  3: { label: 'AlgoMaster 600', solutionBase: '/algomaster', solutionLabel: 'AlgoMaster' },
}

function PatternsPage({ set }: { set: 1 | 2 | 3 }) {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [extensionQuestions, setExtensionQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const main = await fetch('/questions_full.json').then(r => r.json())
      const vis = await getPatternFcVisited()
      if (cancelled) return
      if (set === 1) {
        const prog = await getProgress()
        if (cancelled) return
        setQuestions(main)
        setExtensionQuestions([])
        setProgress(prog ?? {})
      } else {
        const mainIds = new Set((main as { id: number }[]).map(q => q.id))
        const qs = set === 2 ? getSet2Questions(mainIds, main) : getSet3Questions(mainIds, main)
        if (cancelled) return
        setExtensionQuestions(qs)
        setQuestions(qs.map(setQuestionToPatternQuestion))
        setProgress(getSetProgress(set))
      }
      setVisited(vis)
      setExpanded(null)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [set])

  const handleVisit = useCallback(async (id: number) => {
    setVisited(prev => { const s = new Set(prev); s.add(id); return s })
    await addPatternFcVisited(id)
  }, [])

  const isSolved = useCallback((id: number) => !!progress[String(id)]?.solved, [progress])

  const questionHref = useCallback((q: Question) => {
    if (set === 1) return `/practice/${q.id}`
    return learnHrefForSetQuestion(
      q.id,
      set,
      set === 2 ? extensionQuestions : [],
      set === 3 ? extensionQuestions : [],
    )
  }, [set, extensionQuestions])

  const handleToggleSolved = useCallback((id: number) => {
    if (set === 1) return
    const cur = progress[String(id)] as SetQProgress | undefined
    const updated = updateSetQProgress(set, id, { solved: !cur?.solved })
    setProgress(prev => ({ ...prev, [String(id)]: updated }))
  }, [set, progress])

  // Build exclusive map — each question belongs to exactly one pattern
  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])

  const patternData = useMemo(() =>
    ORDERED_QUICK_PATTERNS.map((p, i) => {
      const qs = questions
        .filter(q => exclusiveMap[q.id] === p.name)
        .sort((a, b) => ({ Easy: 0, Medium: 1, Hard: 2 }[a.difficulty] ?? 1) - ({ Easy: 0, Medium: 1, Hard: 2 }[b.difficulty] ?? 1))
      const solved = qs.filter(q => !!progress[String(q.id)]?.solved).length
      const palette = PALETTE[i % PALETTE.length]
      return { name: p.name, icon: PATTERN_ICONS[p.name] ?? '🧩', questions: qs, solved, total: qs.length, palette }
    }).filter(p => p.total > 0),
  [questions, progress, exclusiveMap])

  const totalSolved = questions.filter(q => isSolved(q.id)).length
  const getMode = (name: string) => viewMode[name] || 'flashcards'
  const setMode = (name: string, mode: string) => setViewMode(prev => ({ ...prev, [name]: mode }))
  const extensionMeta = set !== 1 ? SET_META[set] : null
  const flashcardExtras = extensionMeta
    ? {
        extensionSet: set as 2 | 3,
        onToggleSolved: handleToggleSolved,
        solutionBase: extensionMeta.solutionBase,
        solutionLabel: extensionMeta.solutionLabel,
      }
    : {}

  if (loading) return <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading patterns…</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1 flex items-center gap-2">🕸️ Patterns</h1>
      <p className="text-sm text-[var(--text-muted)] mb-1">
        {set === 1
          ? 'Each question belongs to exactly one pattern — no repetition across sections.'
          : `Set ${set} · ${extensionMeta?.label} — same pattern groupings as Set 1.`}
      </p>
      <p className="text-xs text-indigo-500  font-semibold mb-7">
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
                className="w-full px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 text-left hover:brightness-[0.97]  transition-all"
                onClick={() => setExpanded(isOpen ? null : p.name)}
              >
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-[var(--text)] text-sm">{p.name}</span>
                      <PriorityBadge pattern={p.name} />
                    </div>
                    <span className="text-xs text-[var(--text-muted)] shrink-0 font-mono">
                      {p.solved}/{p.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/50  rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-[var(--text-subtle)] shrink-0">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/40 ">
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
                    <PatternFlashcards
                      questions={p.questions}
                      progress={progress}
                      visited={visited}
                      onVisit={handleVisit}
                      questionHref={questionHref}
                      isSolved={isSolved}
                      {...flashcardExtras}
                    />
                  ) : (
                    <div className="divide-y divide-white/30 ">
                      {p.questions.map(q => {
                        const solved = isSolved(q.id)
                        return (
                          <div key={q.id} onClick={() => router.push(questionHref(q))}
                            className="flex items-center gap-2 px-3 sm:px-5 py-2.5 cursor-pointer hover:bg-white/50  transition-colors group">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${solved ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
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

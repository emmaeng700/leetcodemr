'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CheckCircle, Circle, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react'
import { NEETCODE_250, NC250_TOTAL, type NC250Category } from '@/lib/neetcode250'
import { ALGOMASTER_600 } from '@/lib/algomaster600'
import { QuestionCountHighlight } from '@/components/QuestionCountHighlight'
import { PATTERN_PRIORITY } from '@/lib/constants'
import PriorityBadge from '@/components/PriorityBadge'

const NC_PATTERN_MAP: Record<string, string> = {
  'Arrays & Hashing':         'Arrays & Hashing',
  'Two Pointers':              'Two Pointers',
  'Sliding Window':            'Sliding Window',
  'Stack':                     'Stack',
  'Binary Search':             'Binary Search',
  'Linked List':               'Linked List',
  'Trees':                     'Trees & BST',
  'Heap / Priority Queue':     'Heap',
  'Backtracking':              'Backtracking',
  'Tries':                     'Trie',
  'Graphs':                    'Graphs',
  'Advanced Graphs':           'Graphs',
  '1-D Dynamic Programming':   'Dynamic Programming',
  '2-D Dynamic Programming':   'Dynamic Programming',
  'Greedy':                    'Greedy',
  'Intervals':                 'Sorting',
  'Math & Geometry':           'Math',
  'Bit Manipulation':          'Bit Manipulation',
}

import { supabase, USER_ID } from '@/lib/supabase'

// Build AM600 id set once
const AM600_IDS = new Set(ALGOMASTER_600.flatMap(c => c.questions.map((q: any) => q.id)))

function questionHref(id: number, slug: string, libraryIds: Set<number>): string {
  if (libraryIds.has(id)) return `/practice/${id}`
  return `/neetcode/${slug}`
}

const DIFF_COLOR: Record<string, string> = {
  Easy:   'text-green-400',
  Medium: 'text-yellow-400',
  Hard:   'text-red-400',
}
const CAT_COLOR: Record<string, string> = {
  indigo:'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',cyan:'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  sky:'bg-sky-500/10 text-sky-300 border-sky-500/20',orange:'bg-orange-500/10 text-orange-300 border-orange-500/20',
  violet:'bg-violet-500/10 text-violet-300 border-violet-500/20',teal:'bg-teal-500/10 text-teal-300 border-teal-500/20',
  green:'bg-green-500/10 text-green-300 border-green-500/20',fuchsia:'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
  rose:'bg-rose-500/10 text-rose-300 border-rose-500/20',amber:'bg-amber-500/10 text-amber-300 border-amber-500/20',
  blue:'bg-blue-500/10 text-blue-300 border-blue-500/20',purple:'bg-purple-500/10 text-purple-300 border-purple-500/20',
  emerald:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',lime:'bg-lime-500/10 text-lime-300 border-lime-500/20',
  yellow:'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',pink:'bg-pink-500/10 text-pink-300 border-pink-500/20',
  slate:'bg-slate-500/10 text-slate-300 border-slate-500/20',red:'bg-red-500/10 text-red-300 border-red-500/20',
}
const CAT_BAR: Record<string, string> = {
  indigo:'bg-indigo-500',cyan:'bg-cyan-500',sky:'bg-sky-500',orange:'bg-orange-500',
  violet:'bg-violet-500',teal:'bg-teal-500',green:'bg-green-500',fuchsia:'bg-fuchsia-500',
  rose:'bg-rose-500',amber:'bg-amber-500',blue:'bg-blue-500',purple:'bg-purple-500',
  emerald:'bg-emerald-500',lime:'bg-lime-500',yellow:'bg-yellow-500',pink:'bg-pink-500',
  slate:'bg-slate-400',red:'bg-red-500',
}

export default function NeetCode250Page() {
  const [solved, setSolved]       = useState<Set<number>>(new Set())
  const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set())
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [diffFilter, setDiffFilter] = useState<'All'|'Easy'|'Medium'|'Hard'|'Not in sets'>('All')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((qs: { id: number }[]) => setLibraryIds(new Set(qs.map(q => q.id))))
      .catch(() => {})

    supabase
      .from('progress').select('question_id')
      .eq('user_id', USER_ID).eq('solved', true)
      .then(({ data }) => {
        if (data) setSolved(new Set(data.map((r: any) => Number(r.question_id))))
        setLoading(false)
      })
  }, [])

  const allQs    = useMemo(() => NEETCODE_250.flatMap(c => c.questions), [])
  const totalSolved = useMemo(() => allQs.filter(q => solved.has(q.id)).length, [allQs, solved])
  const easySolved  = useMemo(() => allQs.filter(q => q.difficulty==='Easy'   && solved.has(q.id)).length, [allQs, solved])
  const medSolved   = useMemo(() => allQs.filter(q => q.difficulty==='Medium' && solved.has(q.id)).length, [allQs, solved])
  const hardSolved  = useMemo(() => allQs.filter(q => q.difficulty==='Hard'   && solved.has(q.id)).length, [allQs, solved])
  const easyTotal   = useMemo(() => allQs.filter(q => q.difficulty==='Easy').length,   [allQs])
  const medTotal    = useMemo(() => allQs.filter(q => q.difficulty==='Medium').length, [allQs])
  const hardTotal   = useMemo(() => allQs.filter(q => q.difficulty==='Hard').length,   [allQs])

  // Count questions not in 331 AND not in AM600
  const notInSetsCount = useMemo(() =>
    libraryIds.size > 0
      ? allQs.filter(q => !libraryIds.has(q.id) && !AM600_IDS.has(q.id)).length
      : 0,
    [allQs, libraryIds])

  const filteredCategories = useMemo((): NC250Category[] => {
    const q = search.trim().toLowerCase()
    const PRIORITY_ORDER: Record<string, number> = { High: 0, Mid: 1, Low: 2 }
    const cats = NEETCODE_250.map(cat => ({
      ...cat,
      questions: cat.questions.filter(p => {
        if (diffFilter === 'Not in sets' && libraryIds.size > 0 &&
            (libraryIds.has(p.id) || AM600_IDS.has(p.id))) return false
        if (diffFilter !== 'All' && diffFilter !== 'Not in sets' && p.difficulty !== diffFilter) return false
        if (q && !p.title.toLowerCase().includes(q) && !String(p.id).includes(q)) return false
        return true
      }),
    })).filter(cat => cat.questions.length > 0)
    // Sort all High first, then Mid, then Low — preserves relative order within each tier
    cats.sort((a, b) => {
      const priA = PATTERN_PRIORITY[NC_PATTERN_MAP[a.name] ?? ''] ?? 'Low'
      const priB = PATTERN_PRIORITY[NC_PATTERN_MAP[b.name] ?? ''] ?? 'Low'
      return (PRIORITY_ORDER[priA] ?? 2) - (PRIORITY_ORDER[priB] ?? 2)
    })
    return cats
  }, [search, diffFilter, libraryIds])

  const toggleCollapse = (name: string) =>
    setCollapsed(prev => { const n=new Set(prev); n.has(name)?n.delete(name):n.add(name); return n })

  return (
    <div className="bg-[#0b1020] text-gray-100 pb-6">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold text-gray-100">NeetCode 250</h1>
            <QuestionCountHighlight value={NC250_TOTAL} label="questions" variant="total"
              className="!text-gray-200 !border-gray-600" />
          </div>
          <p className="text-xs text-gray-500 mb-2">
            NeetCode 250 — curated list with 100 extra beyond the classic 150. Track your progress below.
          </p>
          {notInSetsCount > 0 && (
            <QuestionCountHighlight
              value={notInSetsCount}
              label="not in your 331 or AM600 sets"
              variant="exclusive"
            />
          )}
        </div>

        {/* Progress */}
        <div className="bg-[#16213e] border border-gray-700/50 rounded-2xl p-5 mb-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-3xl font-black text-white">{loading ? '–' : totalSolved}</span>
              <span className="text-gray-500 text-sm font-medium ml-1">/ {NC250_TOTAL} solved</span>
            </div>
            <span className="text-xs text-gray-500">
              {loading ? '' : `${Math.round(totalSolved / NC250_TOTAL * 100)}% complete`}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${(totalSolved / NC250_TOTAL) * 100}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label:'Easy',   solved:easySolved, total:easyTotal,  cls:'text-green-400',  bg:'bg-green-500/10' },
              { label:'Medium', solved:medSolved,  total:medTotal,   cls:'text-yellow-400', bg:'bg-yellow-500/10' },
              { label:'Hard',   solved:hardSolved, total:hardTotal,  cls:'text-red-400',    bg:'bg-red-500/10' },
            ].map(({ label, solved: s, total, cls, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <div className={`text-lg font-black ${cls}`}>
                  {loading ? '–' : s}<span className="text-xs font-normal text-gray-500">/{total}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500/60" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['All','Easy','Medium','Hard','Not in sets'] as const).map(d => (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  diffFilter === d
                    ? d==='All'         ? 'bg-indigo-600 border-indigo-500 text-white'
                    : d==='Easy'        ? 'bg-green-600/30 border-green-500 text-green-300'
                    : d==='Medium'      ? 'bg-yellow-600/30 border-yellow-500 text-yellow-300'
                    : d==='Hard'        ? 'bg-red-600/30 border-red-500 text-red-300'
                                        : 'bg-gray-600/30 border-gray-500 text-gray-300'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-gray-200'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {filteredCategories.map((cat, ci) => {
            const mappedPattern = NC_PATTERN_MAP[cat.name] ?? ''
            const pri = PATTERN_PRIORITY[mappedPattern] ?? 'Low'
            const prevPri = ci > 0
              ? (PATTERN_PRIORITY[NC_PATTERN_MAP[filteredCategories[ci-1].name] ?? ''] ?? 'Low')
              : null
            const showTier = pri !== prevPri
            const tierStyles = {
              High:{ pill:'bg-red-900/30 text-red-300 border-red-700/40', line:'bg-red-700/40', dot:'🔴' },
              Mid: { pill:'bg-amber-900/30 text-amber-300 border-amber-700/40', line:'bg-amber-700/40', dot:'🟡' },
              Low: { pill:'bg-gray-700/40 text-gray-400 border-gray-600/40', line:'bg-gray-600/40', dot:'⚪' },
            }[pri] ?? { pill:'bg-gray-700/40 text-gray-400 border-gray-600/40', line:'bg-gray-600/40', dot:'⚪' }
            const catSolved  = cat.questions.filter(q => solved.has(q.id)).length
            const isCollapsed = collapsed.has(cat.name)
            const pct = cat.questions.length ? Math.round(catSolved/cat.questions.length*100) : 0
            return (
              <Fragment key={cat.name}>
              {showTier && (
                <div className="flex items-center gap-2 px-3 py-2 mt-2">
                  <div className={`h-px flex-1 rounded-full ${tierStyles.line}`} />
                  <span className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${tierStyles.pill}`}>
                    {tierStyles.dot} {pri} Priority
                  </span>
                  <div className={`h-px flex-1 rounded-full ${tierStyles.line}`} />
                </div>
              )}
              <div className="bg-[#16213e] border border-gray-700/40 rounded-2xl overflow-hidden">
                <button onClick={() => toggleCollapse(cat.name)}
                  className="w-full flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 hover:bg-white/[0.02] transition">
                  <span className="text-base">{cat.emoji}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${CAT_COLOR[cat.color]}`}>
                    {cat.name}
                  </span>
                  <PriorityBadge pattern={NC_PATTERN_MAP[cat.name] ?? ''} />
                  <div className="flex-1 flex items-center gap-2 ml-1">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${CAT_BAR[cat.color]}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{catSolved}/{cat.questions.length}</span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    : <ChevronUp   size={14} className="text-gray-500 shrink-0" />}
                </button>

                {!isCollapsed && (
                  <div className="border-t border-gray-700/40">
                    {cat.questions.map((q, i) => {
                      const isSolved   = solved.has(q.id)
                      const inMain     = libraryIds.size > 0 && libraryIds.has(q.id)
                      const inAM600    = AM600_IDS.has(q.id)
                      const inNeither  = libraryIds.size > 0 && !inMain && !inAM600
                      return (
                        <div key={q.id}
                          className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm border-b border-gray-800/60 last:border-b-0 hover:bg-white/[0.02] transition group ${i%2===0?'':'bg-white/[0.01]'} ${inNeither?'opacity-40':''}`}>
                          <span className="shrink-0">
                            {isSolved
                              ? <CheckCircle size={15} className="text-green-400" />
                              : <Circle      size={15} className="text-gray-700"  />}
                          </span>
                          <span className="text-[11px] font-mono text-gray-500 w-10 shrink-0">#{q.id}</span>
                          <Link href={questionHref(q.id, q.slug, libraryIds)}
                            className="flex-1 flex items-center gap-1.5 min-w-0 hover:text-indigo-300 transition">
                            <span className="text-sm text-gray-200 hover:text-indigo-300 font-medium truncate">{q.title}</span>
                            {inMain && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 whitespace-nowrap">331</span>
                            )}
                            {!inMain && inAM600 && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/50 whitespace-nowrap">AM600</span>
                            )}
                            {inNeither && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-700/80 text-gray-500 border border-gray-600/50 whitespace-nowrap">not in sets</span>
                            )}
                          </Link>
                          <span className="text-[11px] text-gray-600 shrink-0 hidden sm:block">{q.acceptance}%</span>
                          <span className={`text-[11px] font-bold shrink-0 w-14 text-right ${DIFF_COLOR[q.difficulty]}`}>
                            {q.difficulty==='Medium'?'Med.':q.difficulty}
                          </span>
                          <a href={`https://leetcode.com/problems/${q.slug}/`}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 text-gray-700 hover:text-gray-400 transition opacity-0 group-hover:opacity-100"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              </Fragment>
            )
          })}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-16 text-gray-600 text-sm">No questions match your filters.</div>
        )}
      </div>
    </div>
  )
}

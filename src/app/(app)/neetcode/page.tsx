'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CheckCircle, Circle, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { NEETCODE_150, type NC150Category } from '@/lib/neetcode150'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const USER_ID = 'emmanuel'

function questionHref(id: number, slug: string, libraryIds: Set<number>): string {
  if (libraryIds.has(id)) return `/practice/${id}`
  return `/leetcode-api?slug=${encodeURIComponent(slug)}`
}

const DIFF_COLOR: Record<string, string> = {
  Easy:   'text-green-400',
  Medium: 'text-yellow-400',
  Hard:   'text-red-400',
}

const CAT_COLOR: Record<string, string> = {
  indigo:  'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  cyan:    'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  sky:     'bg-sky-500/10 text-sky-300 border-sky-500/20',
  orange:  'bg-orange-500/10 text-orange-300 border-orange-500/20',
  violet:  'bg-violet-500/10 text-violet-300 border-violet-500/20',
  teal:    'bg-teal-500/10 text-teal-300 border-teal-500/20',
  green:   'bg-green-500/10 text-green-300 border-green-500/20',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
  rose:    'bg-rose-500/10 text-rose-300 border-rose-500/20',
  amber:   'bg-amber-500/10 text-amber-300 border-amber-500/20',
  blue:    'bg-blue-500/10 text-blue-300 border-blue-500/20',
  purple:  'bg-purple-500/10 text-purple-300 border-purple-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  lime:    'bg-lime-500/10 text-lime-300 border-lime-500/20',
  yellow:  'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  pink:    'bg-pink-500/10 text-pink-300 border-pink-500/20',
  slate:   'bg-slate-500/10 text-slate-300 border-slate-500/20',
  red:     'bg-red-500/10 text-red-300 border-red-500/20',
}

const CAT_BAR: Record<string, string> = {
  indigo: 'bg-indigo-500', cyan: 'bg-cyan-500', sky: 'bg-sky-500',
  orange: 'bg-orange-500', violet: 'bg-violet-500', teal: 'bg-teal-500',
  green: 'bg-green-500', fuchsia: 'bg-fuchsia-500', rose: 'bg-rose-500',
  amber: 'bg-amber-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
  emerald: 'bg-emerald-500', lime: 'bg-lime-500', yellow: 'bg-yellow-500',
  pink: 'bg-pink-500', slate: 'bg-slate-400', red: 'bg-red-500',
}

export default function NeetCode150Page() {
  const [solved, setSolved] = useState<Set<number>>(new Set())
  const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [diffFilter, setDiffFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((qs: { id: number }[]) => setLibraryIds(new Set(qs.map(q => q.id))))
      .catch(() => {})

    supabase
      .from('progress')
      .select('question_id')
      .eq('user_id', USER_ID)
      .eq('solved', true)
      .then(({ data }) => {
        if (data) setSolved(new Set(data.map((r: any) => Number(r.question_id))))
        setLoading(false)
      })
  }, [])

  const totalSolved = useMemo(
    () => NEETCODE_150.reduce((acc, cat) => acc + cat.questions.filter(q => solved.has(q.id)).length, 0),
    [solved]
  )

  const easySolved   = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Easy'   && solved.has(q.id)).length, [solved])
  const medSolved    = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Medium' && solved.has(q.id)).length, [solved])
  const hardSolved   = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Hard'   && solved.has(q.id)).length, [solved])
  const easyTotal    = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Easy').length, [])
  const medTotal     = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Medium').length, [])
  const hardTotal    = useMemo(() => NEETCODE_150.flatMap(c => c.questions).filter(q => q.difficulty === 'Hard').length, [])

  const filteredCategories = useMemo((): NC150Category[] => {
    const q = search.trim().toLowerCase()
    return NEETCODE_150.map(cat => ({
      ...cat,
      questions: cat.questions.filter(p => {
        if (diffFilter !== 'All' && p.difficulty !== diffFilter) return false
        if (q && !p.title.toLowerCase().includes(q) && !String(p.id).includes(q)) return false
        return true
      }),
    })).filter(cat => cat.questions.length > 0)
  }, [search, diffFilter])

  const toggleCollapse = (name: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  return (
    <div className="min-h-screen bg-[#0b1020] text-gray-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold text-gray-100">NeetCode 150</h1>
          </div>
          <p className="text-xs text-gray-500">Top 150 questions curated by NeetCode — track your progress below</p>
        </div>

        {/* Progress stats */}
        <div className="bg-[#16213e] border border-gray-700/50 rounded-2xl p-5 mb-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-3xl font-black text-white">{loading ? '–' : totalSolved}</span>
              <span className="text-gray-500 text-sm font-medium ml-1">/ 150 solved</span>
            </div>
            <span className="text-xs text-gray-500">{loading ? '' : `${Math.round(totalSolved / 150 * 100)}% complete`}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${(totalSolved / 150) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Easy',   solved: easySolved, total: easyTotal,  cls: 'text-green-400',  bg: 'bg-green-500/10' },
              { label: 'Medium', solved: medSolved,  total: medTotal,   cls: 'text-yellow-400', bg: 'bg-yellow-500/10' },
              { label: 'Hard',   solved: hardSolved, total: hardTotal,  cls: 'text-red-400',    bg: 'bg-red-500/10' },
            ].map(({ label, solved: s, total, cls, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <div className={`text-lg font-black ${cls}`}>{loading ? '–' : s}<span className="text-xs font-normal text-gray-500">/{total}</span></div>
                <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500/60"
            />
          </div>
          <div className="flex gap-1.5">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDiffFilter(d)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  diffFilter === d
                    ? d === 'All'    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : d === 'Easy'   ? 'bg-green-600/30 border-green-500 text-green-300'
                    : d === 'Medium' ? 'bg-yellow-600/30 border-yellow-500 text-yellow-300'
                                     : 'bg-red-600/30 border-red-500 text-red-300'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {filteredCategories.map(cat => {
            const catSolved  = cat.questions.filter(q => solved.has(q.id)).length
            const isCollapsed = collapsed.has(cat.name)
            const pct = Math.round(catSolved / cat.questions.length * 100)
            return (
              <div key={cat.name} className="bg-[#16213e] border border-gray-700/40 rounded-2xl overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleCollapse(cat.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition"
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${CAT_COLOR[cat.color]}`}>
                    {cat.name}
                  </span>
                  <div className="flex-1 flex items-center gap-2 ml-1">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${CAT_BAR[cat.color]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{catSolved}/{cat.questions.length}</span>
                  </div>
                  {isCollapsed ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronUp size={14} className="text-gray-500 shrink-0" />}
                </button>

                {/* Question rows */}
                {!isCollapsed && (
                  <div className="border-t border-gray-700/40">
                    {cat.questions.map((q, i) => {
                      const isSolved = solved.has(q.id)
                      return (
                        <div
                          key={q.id}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b border-gray-800/60 last:border-b-0 hover:bg-white/[0.02] transition group ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                        >
                          {/* Solved icon */}
                          <span className="shrink-0">
                            {isSolved
                              ? <CheckCircle size={15} className="text-green-400" />
                              : <Circle size={15} className="text-gray-700" />}
                          </span>

                          {/* ID */}
                          <span className="text-[11px] font-mono text-gray-500 w-10 shrink-0">#{q.id}</span>

                          {/* Title */}
                          <Link
                            href={questionHref(q.id, q.slug, libraryIds)}
                            className="flex-1 flex items-center gap-1.5 min-w-0 hover:text-indigo-300 transition"
                          >
                            <span className="text-sm text-gray-200 hover:text-indigo-300 font-medium truncate">{q.title}</span>
                            {libraryIds.size > 0 && !libraryIds.has(q.id) && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-700/80 text-gray-500 border border-gray-600/50 whitespace-nowrap">
                                not in 331
                              </span>
                            )}
                          </Link>

                          {/* Acceptance */}
                          <span className="text-[11px] text-gray-600 shrink-0 hidden sm:block">{q.acceptance}%</span>

                          {/* Difficulty */}
                          <span className={`text-[11px] font-bold shrink-0 w-14 text-right ${DIFF_COLOR[q.difficulty]}`}>
                            {q.difficulty === 'Medium' ? 'Med.' : q.difficulty}
                          </span>

                          {/* LC link */}
                          <a
                            href={`https://leetcode.com/problems/${q.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-gray-700 hover:text-gray-400 transition opacity-0 group-hover:opacity-100"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
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

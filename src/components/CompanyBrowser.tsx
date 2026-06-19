'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Loader2, ChevronRight, Briefcase, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getProgress } from '@/lib/db'

const TIMEFRAMES = [
  { slug: 'all',                  label: 'All Time' },
  { slug: 'thirty-days',          label: '30 Days'  },
  { slug: 'three-months',         label: '3 Months' },
  { slug: 'six-months',           label: '6 Months' },
  { slug: 'more-than-six-months', label: '6 Mo+'    },
]

const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-400',
  Medium: 'text-yellow-400',
  Hard:   'text-red-400',
}

interface Company  { slug: string; name: string; hasData: boolean }
interface Problem  { id: number; url: string; title: string; difficulty: string; acceptance: number; frequency: number }

function slugFromUrl(url: string) {
  return url.split('/problems/')[1]?.replace(/\/$/, '') ?? ''
}

export default function CompanyBrowser({ onSolve }: { onSolve: (slug: string) => void }) {
  const [companies,        setCompanies]        = useState<Company[]>([])
  const [compSearch,       setCompSearch]        = useState('')
  const [selected,         setSelected]          = useState<Company | null>(null)
  const [timeframe,        setTimeframe]         = useState('all')
  const [problems,         setProblems]          = useState<Problem[]>([])
  const [loadingCompanies, setLoadingCompanies]  = useState(true)
  const [loadingProblems,  setLoadingProblems]   = useState(false)
  const [compError,        setCompError]         = useState<string | null>(null)
  const [probError,        setProbError]         = useState<string | null>(null)
  const [solvedIds,        setSolvedIds]         = useState<Set<number>>(new Set())

  useEffect(() => {
    getProgress().then(prog => {
      if (!prog) return
      setSolvedIds(new Set(
        Object.entries(prog).filter(([, v]) => v?.solved).map(([k]) => Number(k))
      ))
    }).catch(() => {})
  }, [])

  // Load company list once
  useEffect(() => {
    fetch('/api/company-questions')
      .then(r => r.json())
      .then(data => {
        const list: Company[] = data?.data?.companies ?? []
        setCompanies(list.filter(c => c.hasData))
      })
      .catch(() => setCompError('Could not load companies. Check your connection.'))
      .finally(() => setLoadingCompanies(false))
  }, [])

  // Load problems when company or timeframe changes
  useEffect(() => {
    if (!selected) return
    setLoadingProblems(true)
    setProbError(null)
    setProblems([])
    fetch(`/api/company-problems?company=${encodeURIComponent(selected.slug)}&timeframe=${timeframe}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setProbError(data.error); return }
        setProblems(data?.data?.problems ?? [])
      })
      .catch(() => setProbError('Could not load problems.'))
      .finally(() => setLoadingProblems(false))
  }, [selected, timeframe])

  const filtered = useMemo(() => {
    const q = compSearch.trim().toLowerCase()
    if (!q) return companies.slice(0, 50)
    return companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50)
  }, [companies, compSearch])

  const showList = !selected || compSearch.trim().length > 0

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {selected && !compSearch && (
          <button
            onClick={() => { setSelected(null); setProblems([]) }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition shrink-0"
          >
            <ArrowLeft size={13} />
          </button>
        )}
        <Briefcase size={15} className="text-indigo-400 shrink-0" />
        <h2 className="text-sm font-bold text-gray-200">
          {selected && !compSearch ? selected.name : 'Company Questions'}
        </h2>
        {selected && !compSearch && (
          <span className="text-xs text-gray-500 ml-1 flex items-center gap-1.5">
            {loadingProblems ? '…' : `${problems.length} questions`}
            {!loadingProblems && problems.length > 0 && (() => {
              const n = problems.filter(p => solvedIds.has(p.id)).length
              return n > 0 ? (
                <span className="flex items-center gap-0.5 text-green-400 font-semibold">
                  <CheckCircle2 size={11} /> {n} solved
                </span>
              ) : null
            })()}
          </span>
        )}
      </div>

      {/* Company search */}
      <div className="relative mb-3">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={compSearch}
          onChange={e => setCompSearch(e.target.value)}
          placeholder={selected ? `Search companies…` : 'Search company…'}
          className="w-full bg-gray-800/80 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* ── Company list ─────────────────────────────── */}
      {showList && (
        <div className="bg-[#16213e] rounded-xl border border-gray-700/50 overflow-hidden max-h-56 overflow-y-auto">
          {loadingCompanies ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading companies…
            </div>
          ) : compError ? (
            <p className="text-xs text-red-400 text-center py-6 px-4">{compError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No companies match &ldquo;{compSearch}&rdquo;</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.slug}
                onClick={() => { setSelected(c); setCompSearch(''); setTimeframe('all') }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 border-b border-gray-800/60 last:border-b-0 flex items-center justify-between group transition"
              >
                <span className="group-hover:text-indigo-300 transition">{c.name}</span>
                <ChevronRight size={13} className="text-gray-600 group-hover:text-indigo-400 transition shrink-0" />
              </button>
            ))
          )}
          {!loadingCompanies && !compError && companies.length > 50 && compSearch.trim().length === 0 && (
            <p className="text-[11px] text-gray-600 text-center py-2">
              Showing 50 of {companies.length} — type to search
            </p>
          )}
        </div>
      )}

      {/* ── Company problems ─────────────────────────── */}
      {selected && !compSearch && (
        <>
          {/* Timeframe tabs */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
            {TIMEFRAMES.map(t => (
              <button
                key={t.slug}
                onClick={() => setTimeframe(t.slug)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                  timeframe === t.slug
                    ? 'bg-indigo-600 text-white shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Problems list */}
          {loadingProblems ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading problems…
            </div>
          ) : probError ? (
            <p className="text-xs text-red-400 text-center py-6 px-4">{probError}</p>
          ) : problems.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No questions for this timeframe.</p>
          ) : (
            <div className="bg-[#16213e] rounded-xl border border-gray-700/50 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1.5rem_1fr_5rem_4rem_1.5rem] gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <span>#</span>
                <span>Title</span>
                <span className="text-center">Difficulty</span>
                <span className="text-center">Freq</span>
                <span />
              </div>

              <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
                {problems.map((p, i) => {
                  const slug = slugFromUrl(p.url)
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSolve(slug)}
                      className={`w-full text-left px-4 py-2.5 border-b border-gray-800/50 last:border-b-0 grid grid-cols-[1.5rem_1fr_5rem_4rem_1.5rem] gap-2 items-center group transition ${
                        solvedIds.has(p.id) ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] tabular-nums flex items-center">
                        {solvedIds.has(p.id)
                          ? <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                          : <span className="text-gray-600">{i + 1}</span>
                        }
                      </span>

                      <span className={`text-xs truncate group-hover:text-indigo-300 transition ${solvedIds.has(p.id) ? 'text-green-300/90' : 'text-gray-200'}`}>
                        <span className="text-gray-500 mr-1">{p.id}.</span>{p.title}
                      </span>

                      <span className={`text-[11px] font-semibold text-center ${DIFF_CLS[p.difficulty] ?? 'text-gray-400'}`}>
                        {p.difficulty}
                      </span>

                      {/* Frequency bar */}
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-[40px]">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.max(3, p.frequency)}%` }}
                          />
                        </div>
                      </div>

                      <ChevronRight size={12} className="text-gray-700 group-hover:text-indigo-400 transition" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

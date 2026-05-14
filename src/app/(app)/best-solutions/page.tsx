'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Bookmark, Search, Copy, Check, Download, ChevronDown, ChevronUp,
  Loader2, Clock, Filter,
} from 'lucide-react'
import Link from 'next/link'

/* ── Types ───────────────────────────────────────────────────────────────── */
interface Question {
  id: number
  title: string
  slug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tags?: string[]
}

interface BestSolution {
  question_id: number
  language: string
  code: string
  updated_at: string
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-400 bg-green-500/10 border-green-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Hard:   'text-red-400 bg-red-500/10 border-red-500/20',
}

const LANG_LABEL: Record<string, string> = {
  python3: 'Python', cpp: 'C++', javascript: 'JS',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function DiffBadge({ d }: { d: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${DIFF_CLS[d] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
      {d}
    </span>
  )
}

/* ── Syntax-highlight-ish line count preview ─────────────────────────────── */
function CodePreview({ code, expanded }: { code: string; expanded: boolean }) {
  const lines = code.split('\n')
  const display = expanded ? lines : lines.slice(0, 8)
  return (
    <pre className="text-[11px] leading-relaxed font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
      {display.join('\n')}
      {!expanded && lines.length > 8 && (
        <span className="text-gray-600"> … {lines.length - 8} more lines</span>
      )}
    </pre>
  )
}

/* ── Single question card ────────────────────────────────────────────────── */
function QuestionCard({
  q,
  sol,
}: {
  q: Question
  sol: BestSolution | undefined
}) {
  const [expanded, setExpanded]   = useState(false)
  const [copied,   setCopied]     = useState(false)

  const copy = useCallback(async () => {
    if (!sol) return
    try {
      await navigator.clipboard.writeText(sol.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [sol])

  return (
    <div className={`rounded-xl border transition-all ${
      sol
        ? 'bg-[var(--bg-card)] border-[var(--border)] hover:border-amber-400/40'
        : 'bg-[var(--bg-card)]/50 border-dashed border-[var(--border)]'
    }`}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => sol && setExpanded(v => !v)}
      >
        <span className="text-xs font-mono text-[var(--text-subtle)] shrink-0 w-9">
          #{q.id}
        </span>

        <Link
          href={`/practice/${q.id}`}
          onClick={e => e.stopPropagation()}
          className="font-semibold text-sm text-[var(--text)] hover:text-amber-400 transition-colors truncate flex-1 min-w-0"
        >
          {q.title}
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <DiffBadge d={q.difficulty} />

          {sol ? (
            <>
              <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">
                {LANG_LABEL[sol.language] ?? sol.language}
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1 hidden sm:flex">
                <Clock size={9} /> {timeAgo(sol.updated_at)}
              </span>
              <button
                onClick={e => { e.stopPropagation(); copy() }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                title="Copy code"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
              {expanded
                ? <ChevronUp size={14} className="text-gray-500" />
                : <ChevronDown size={14} className="text-gray-500" />
              }
            </>
          ) : (
            <span className="text-[10px] italic text-gray-600">waiting on best answer</span>
          )}
        </div>
      </div>

      {/* Expanded code view */}
      {sol && expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 bg-gray-900/40 rounded-b-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">
              {LANG_LABEL[sol.language] ?? sol.language} · best solution
            </span>
            <button
              onClick={copy}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-amber-300 transition-colors"
            >
              {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              {copied ? 'Copied!' : 'Copy all'}
            </button>
          </div>
          <CodePreview code={sol.code} expanded={expanded} />
        </div>
      )}
    </div>
  )
}

/* ══ Page ════════════════════════════════════════════════════════════════════ */
export default function BestSolutionsPage() {
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [solutions,  setSolutions]  = useState<BestSolution[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [query,      setQuery]      = useState('')
  const [filter,     setFilter]     = useState<'all' | 'saved' | 'waiting'>('all')
  const [diffFilter, setDiffFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all')

  /* Load questions + solutions in parallel */
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      fetch('/api/best-solutions').then(r => r.json()),
    ])
      .then(([qs, solData]) => {
        setQuestions(Array.isArray(qs) ? qs : [])
        setSolutions(Array.isArray(solData.solutions) ? solData.solutions : [])
        setTableReady(solData.tableReady !== false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* Index solutions by question_id */
  const solByQid = useMemo(() => {
    const m = new Map<number, BestSolution>()
    for (const s of solutions) m.set(s.question_id, s)
    return m
  }, [solutions])

  /* Filtered + searched list */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return questions.filter(question => {
      if (filter === 'saved'   && !solByQid.has(question.id)) return false
      if (filter === 'waiting' &&  solByQid.has(question.id)) return false
      if (diffFilter !== 'all' && question.difficulty !== diffFilter) return false
      if (q) {
        const matchId    = String(question.id).includes(q)
        const matchTitle = question.title.toLowerCase().includes(q)
        const matchTag   = (question.tags ?? []).some(t => t.toLowerCase().includes(q))
        return matchId || matchTitle || matchTag
      }
      return true
    })
  }, [questions, solByQid, filter, diffFilter, query])

  /* Counts */
  const savedCount   = useMemo(() => questions.filter(q => solByQid.has(q.id)).length, [questions, solByQid])
  const waitingCount = questions.length - savedCount

  /* Export all Python solutions as a .py file */
  const exportPython = useCallback(() => {
    const pythonSols = questions
      .map(q => ({ q, sol: solByQid.get(q.id) }))
      .filter(({ sol }) => sol && (sol.language === 'python3' || sol.language === 'python'))

    if (pythonSols.length === 0) {
      alert('No Python best solutions saved yet.')
      return
    }

    const lines: string[] = [
      '# ═══════════════════════════════════════════════════════',
      '# My Best LeetCode Solutions (Python)',
      `# Generated: ${new Date().toLocaleDateString()}`,
      `# ${pythonSols.length} questions saved`,
      '# ═══════════════════════════════════════════════════════',
      '',
    ]

    for (const { q, sol } of pythonSols) {
      lines.push(`# ─── #${q.id} ${q.title} [${q.difficulty}] ${'─'.repeat(Math.max(0, 48 - q.title.length))}`)
      lines.push(sol!.code)
      lines.push('')
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'my_best_solutions.py'
    a.click()
    URL.revokeObjectURL(url)
  }, [questions, solByQid])

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
                <Bookmark size={18} className="text-amber-400" />
                My Best Solutions
              </h1>
              <p className="text-xs text-[var(--text-subtle)] mt-1">
                Code you've marked as your best answer from any editor in the app.
                Hit <kbd className="bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">Save Best</kbd> in the editor toolbar to overwrite.
              </p>
            </div>

            {/* Stats + Export */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-amber-400 leading-none">{savedCount}</p>
                <p className="text-[10px] text-[var(--text-subtle)] leading-none mt-0.5">of {questions.length} saved</p>
              </div>
              <button
                onClick={exportPython}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                <Download size={13} /> Export .py
              </button>
            </div>
          </div>
        </div>

        {/* ── DB setup banner (shown if table not created yet) ── */}
        {!tableReady && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-400">One-time setup needed</p>
            <p className="text-xs text-amber-300/80 mt-1">
              The <code className="bg-black/20 px-1 rounded">best_solutions</code> table doesn't exist yet.
              Go to your{' '}
              <a
                href="https://supabase.com/dashboard/project/azrokoorufejfoeddzrw/sql"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                Supabase SQL Editor
              </a>
              {' '}and paste the contents of{' '}
              <code className="bg-black/20 px-1 rounded">supabase/create_best_solutions.sql</code>.
            </p>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by # or title…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-amber-400/60"
            />
          </div>

          {/* Saved / Waiting / All tabs */}
          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {([
              ['all',     `All ${questions.length}`],
              ['saved',   `Saved ${savedCount}`],
              ['waiting', `Waiting ${waitingCount}`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  filter === k
                    ? 'bg-amber-500 text-white'
                    : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Difficulty filter */}
          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {(['all', 'Easy', 'Medium', 'Hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDiffFilter(d)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  diffFilter === d
                    ? d === 'all'
                      ? 'bg-gray-600 text-white'
                      : d === 'Easy'
                        ? 'bg-green-500 text-white'
                        : d === 'Medium'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white'
                    : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                }`}
              >
                {d === 'all' ? 'All' : d}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-subtle)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-subtle)]">No solutions match your filter.</p>
            {filter === 'saved' && savedCount === 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Open any question and hit <strong className="text-amber-400">Best</strong> in the editor toolbar to save your first one.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(q => (
              <QuestionCard key={q.id} q={q} sol={solByQid.get(q.id)} />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && visible.length > 0 && (
          <p className="text-center text-xs text-gray-600 mt-6">
            Showing {visible.length} of {questions.length} questions
          </p>
        )}
      </div>
    </div>
  )
}

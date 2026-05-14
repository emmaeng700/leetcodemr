'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Bookmark, BookmarkCheck, Search, Copy, Check, Download,
  ChevronDown, ChevronUp, Loader2, Clock, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

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

type LcState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; code: string; lang: string }
  | { status: 'none' }     // fetched but no AC submissions
  | { status: 'error'; msg: string }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const DIFF_CLS: Record<string, string> = {
  Easy:   'text-green-400 bg-green-500/10 border-green-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Hard:   'text-red-400 bg-red-500/10 border-red-500/20',
}

const LANG_LABEL: Record<string, string> = {
  python3: 'Python', python: 'Python', cpp: 'C++', javascript: 'JS',
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 2)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function DiffBadge({ d }: { d: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${DIFF_CLS[d] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
      {d}
    </span>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/60 border-b border-[var(--border)]">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {LANG_LABEL[lang] ?? lang}
        </span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-words bg-gray-950/40 max-h-64 overflow-y-auto">
        {code}
      </pre>
    </div>
  )
}

/* ── Single question card ────────────────────────────────────────────────── */
function QuestionCard({
  q,
  sol,
  lcSession,
  lcCsrf,
  onSaved,
}: {
  q: Question
  sol: BestSolution | undefined
  lcSession: string
  lcCsrf: string
  onSaved: (qid: number, lang: string, code: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [lc,       setLc]       = useState<LcState>({ status: 'idle' })
  const [saving,   setSaving]   = useState(false)
  const fetchedRef = useRef(false)

  /* ── Fetch latest accepted submission from LeetCode on demand ── */
  const loadFromLc = useCallback(async () => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    if (!lcSession || !lcCsrf) {
      setLc({ status: 'none' })
      return
    }
    setLc({ status: 'loading' })
    try {
      const r1 = await fetch('/api/leetcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: lcSession,
          csrfToken: lcCsrf,
          query: `query($slug:String!){questionSubmissionList(questionSlug:$slug,offset:0,limit:1,status:10){submissions{id lang langName}}}`,
          variables: { slug: q.slug },
        }),
      }).then(r => r.json())

      const subs = r1?.data?.questionSubmissionList?.submissions ?? []
      if (!subs.length) { setLc({ status: 'none' }); return }

      const { id, lang } = subs[0]

      const r2 = await fetch('/api/leetcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: lcSession,
          csrfToken: lcCsrf,
          query: `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
          variables: { id: Number(id) },
        }),
      }).then(r => r.json())

      const code = r2?.data?.submissionDetails?.code ?? ''
      if (!code) { setLc({ status: 'error', msg: 'Could not load code — session may be expired' }); return }
      setLc({ status: 'done', code, lang })
    } catch {
      setLc({ status: 'error', msg: 'Network error' })
    }
  }, [q.slug, lcSession, lcCsrf])

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    // Only fetch from LC if no manual save and not yet fetched
    if (next && !sol) loadFromLc()
  }

  /* ── Save the LeetCode-fetched code as pinned best ── */
  const saveLcAsBest = async () => {
    if (lc.status !== 'done') return
    setSaving(true)
    try {
      const res = await fetch('/api/best-solutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id, language: lc.lang, code: lc.code }),
      })
      if (res.ok) {
        onSaved(q.id, lc.lang, lc.code)
        toast.success('Saved as your best solution ✓')
      } else {
        toast.error('Could not save — try again')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  /* ── What to show when expanded ── */
  const lcNone  = lc.status === 'none'
  const waiting = !sol && lcNone   // truly never solved

  return (
    <div className={`rounded-xl border transition-all ${
      sol     ? 'bg-[var(--bg-card)] border-amber-400/30 hover:border-amber-400/60'
              : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-indigo-400/40'
    }`}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <span className="text-xs font-mono text-[var(--text-subtle)] shrink-0 w-9">#{q.id}</span>

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
              <span className="text-[10px] text-gray-500 hidden sm:flex items-center gap-0.5">
                <Clock size={9} /> {timeAgo(sol.updated_at)}
              </span>
              <Bookmark size={12} className="text-amber-400" />
            </>
          ) : waiting ? (
            <span className="text-[10px] italic text-gray-600 hidden sm:inline">waiting on best answer</span>
          ) : null}

          {expanded
            ? <ChevronUp  size={14} className="text-gray-500" />
            : <ChevronDown size={14} className="text-gray-500" />
          }
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">

          {/* Pinned best solution */}
          {sol && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider flex items-center gap-1">
                  <BookmarkCheck size={10} /> My Best · {LANG_LABEL[sol.language] ?? sol.language}
                </span>
                <Link href={`/practice/${q.id}`} onClick={e => e.stopPropagation()}
                  className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-0.5 transition-colors">
                  Open in editor <ExternalLink size={9} />
                </Link>
              </div>
              <CodeBlock code={sol.code} lang={sol.language} />
            </>
          )}

          {/* LeetCode fetch (no manual pin yet) */}
          {!sol && (
            <>
              {lc.status === 'loading' && (
                <div className="flex items-center gap-2 py-3 text-indigo-400">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-xs">Loading latest accepted submission…</span>
                </div>
              )}

              {lc.status === 'error' && (
                <p className="text-xs text-red-400 py-2">{lc.msg}</p>
              )}

              {lc.status === 'none' && (
                <p className="text-xs text-gray-500 py-2 italic">
                  {lcSession
                    ? 'No accepted submissions found on LeetCode for this question.'
                    : 'Connect your LeetCode session to load your submissions.'}
                </p>
              )}

              {lc.status === 'done' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                      Latest Accepted · {LANG_LABEL[lc.lang] ?? lc.lang}
                    </span>
                    <Link href={`/practice/${q.id}`} onClick={e => e.stopPropagation()}
                      className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-0.5 transition-colors">
                      Open in editor <ExternalLink size={9} />
                    </Link>
                  </div>
                  <CodeBlock code={lc.code} lang={lc.lang} />
                  <button
                    onClick={saveLcAsBest}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <BookmarkCheck size={11} />}
                    {saving ? 'Saving…' : 'Pin as My Best'}
                  </button>
                </>
              )}
            </>
          )}
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
  const [lcSession,  setLcSession]  = useState('')
  const [lcCsrf,     setLcCsrf]     = useState('')
  const [query,      setQuery]      = useState('')
  const [filter,     setFilter]     = useState<'all' | 'saved' | 'waiting'>('all')
  const [diffFilter, setDiffFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all')

  useEffect(() => {
    setLcSession(localStorage.getItem('lc_session') ?? '')
    setLcCsrf(localStorage.getItem('lc_csrf') ?? '')
  }, [])

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

  const solByQid = useMemo(() => {
    const m = new Map<number, BestSolution>()
    for (const s of solutions) m.set(s.question_id, s)
    return m
  }, [solutions])

  const handleSaved = useCallback((qid: number, lang: string, code: string) => {
    const now = new Date().toISOString()
    setSolutions(prev => {
      const exists = prev.find(s => s.question_id === qid)
      if (exists) return prev.map(s => s.question_id === qid ? { ...s, language: lang, code, updated_at: now } : s)
      return [...prev, { question_id: qid, language: lang, code, updated_at: now }]
    })
  }, [])

  const savedCount = useMemo(() => questions.filter(q => solByQid.has(q.id)).length, [questions, solByQid])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return questions.filter(question => {
      const hasSol = solByQid.has(question.id)
      if (filter === 'saved'   && !hasSol) return false
      if (filter === 'waiting' &&  hasSol) return false
      if (diffFilter !== 'all' && question.difficulty !== diffFilter) return false
      if (q) {
        return String(question.id).includes(q) ||
               question.title.toLowerCase().includes(q) ||
               (question.tags ?? []).some(t => t.toLowerCase().includes(q))
      }
      return true
    })
  }, [questions, solByQid, filter, diffFilter, query])

  const exportPython = useCallback(() => {
    const pythonSols = questions
      .map(q => ({ q, sol: solByQid.get(q.id) }))
      .filter(({ sol }) => sol && ['python3', 'python'].includes(sol.language))
    if (!pythonSols.length) { alert('No Python best solutions pinned yet.'); return }
    const lines = [
      '# ═══════════════════════════════════════════════════════',
      '# My Best LeetCode Solutions (Python)',
      `# Generated: ${new Date().toLocaleDateString()}`,
      `# ${pythonSols.length} questions saved`,
      '# ═══════════════════════════════════════════════════════', '',
    ]
    for (const { q, sol } of pythonSols) {
      lines.push(`# ─── #${q.id} ${q.title} [${q.difficulty}] ${'─'.repeat(Math.max(0, 48 - q.title.length))}`)
      lines.push(sol!.code)
      lines.push('', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'my_best_solutions.py'; a.click()
    URL.revokeObjectURL(url)
  }, [questions, solByQid])

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
              <Bookmark size={18} className="text-amber-400" /> My Best Solutions
            </h1>
            <p className="text-xs text-[var(--text-subtle)] mt-1">
              Click any card to see your latest accepted submission from LeetCode.
              Hit <kbd className="bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">Best</kbd> in the editor to pin a specific version.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-black text-amber-400 leading-none">{savedCount}</p>
              <p className="text-[10px] text-[var(--text-subtle)]">of {questions.length} pinned</p>
            </div>
            <button onClick={exportPython}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors">
              <Download size={13} /> Export .py
            </button>
          </div>
        </div>

        {/* Setup banner */}
        {!tableReady && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-400">One-time setup needed</p>
            <p className="text-xs text-amber-300/80 mt-1">
              Run <code className="bg-black/20 px-1 rounded">supabase/create_best_solutions.sql</code> in your{' '}
              <a href="https://supabase.com/dashboard/project/azrokoorufejfoeddzrw/sql" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Supabase SQL Editor</a>.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by # or title…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-amber-400/60" />
          </div>

          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {([['all', `All ${questions.length}`], ['saved', `Pinned ${savedCount}`], ['waiting', `Unpinned ${questions.length - savedCount}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filter === k ? 'bg-amber-500 text-white' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
            {(['all', 'Easy', 'Medium', 'Hard'] as const).map(d => (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  diffFilter === d
                    ? d === 'Easy' ? 'bg-green-500 text-white' : d === 'Medium' ? 'bg-amber-500 text-white' : d === 'Hard' ? 'bg-red-500 text-white' : 'bg-gray-600 text-white'
                    : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                }`}>
                {d === 'all' ? 'All' : d}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-subtle)]">
            <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-subtle)]">No questions match your filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(q => (
              <QuestionCard key={q.id} q={q} sol={solByQid.get(q.id)}
                lcSession={lcSession} lcCsrf={lcCsrf} onSaved={handleSaved} />
            ))}
          </div>
        )}

        {!loading && visible.length > 0 && (
          <p className="text-center text-xs text-gray-600 mt-6">
            Showing {visible.length} of {questions.length} questions
          </p>
        )}
      </div>
    </div>
  )
}

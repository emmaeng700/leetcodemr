'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  LayoutGrid,
  Loader2,
  Sparkles,
  Star,
  Target,
} from 'lucide-react'
import { getProgress, getStudyPlan } from '@/lib/db'
import { QUICK_PATTERNS } from '@/lib/constants'
import { isDue, formatLocalDate } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
}

const RESUME_KEY = 'lm_learn_resume'

type Resume = { index: number; query: string }

function readResume(): Resume | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Resume>
    if (typeof p.index !== 'number' || p.index < 0) return null
    return { index: p.index, query: typeof p.query === 'string' ? p.query : '' }
  } catch {
    return null
  }
}

function patternMatch(q: Question, pattern: (typeof QUICK_PATTERNS)[number]): boolean {
  const allow = new Set<string>(pattern.tags as readonly string[])
  return (q.tags || []).some(t => allow.has(t))
}

export default function LearnHub() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [qs, prog, plan] = await Promise.all([
          fetch('/questions_full.json').then(r => r.json()),
          getProgress(),
          getStudyPlan(),
        ])
        if (cancelled) return
        setQuestions(qs as Question[])
        setProgress(prog)
        if (plan?.question_order?.length) setPlanOrder(plan.question_order)
        else setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      } catch {
        setQuestions([])
        setPlanOrder([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const qMap = useMemo(() => Object.fromEntries(questions.map(q => [q.id, q])), [questions])

  const ordered = useMemo(() => {
    if (!planOrder.length) return questions
    return planOrder.map(id => qMap[id]).filter(Boolean) as Question[]
  }, [planOrder, qMap, questions])

  const stats = useMemo(() => {
    let solved = 0
    let starred = 0
    let due = 0
    for (const q of ordered) {
      const p = progress[String(q.id)] || {}
      if (p.solved) solved++
      if (p.starred) starred++
      if (p.solved && isDue(p.next_review)) due++
    }
    const pct = ordered.length ? Math.round((solved / ordered.length) * 100) : 0
    return { solved, starred, due, total: ordered.length, pct }
  }, [ordered, progress])

  const dueList = useMemo(() => {
    const rows: { q: Question; next: string }[] = []
    for (const q of ordered) {
      const p = progress[String(q.id)]
      if (!p?.solved || !isDue(p.next_review) || !p.next_review) continue
      rows.push({ q, next: p.next_review })
    }
    rows.sort((a, b) => a.next.localeCompare(b.next))
    return rows.slice(0, 6)
  }, [ordered, progress])

  const firstUnsolvedIdx = useMemo(() => {
    return ordered.findIndex(q => !progress[String(q.id)]?.solved)
  }, [ordered, progress])

  const firstDueIdx = useMemo(() => {
    if (!dueList[0]) return -1
    const id = dueList[0].q.id
    return ordered.findIndex(q => q.id === id)
  }, [dueList, ordered])

  const idToIndex = useMemo(() => {
    const m = new Map<number, number>()
    ordered.forEach((q, i) => m.set(q.id, i))
    return m
  }, [ordered])

  const patternRadar = useMemo(() => {
    return QUICK_PATTERNS.map(p => {
      const inDeck = ordered.filter(q => patternMatch(q, p))
      if (inDeck.length === 0) return { name: p.name, pct: 0, solved: 0, total: 0 }
      let solved = 0
      for (const q of inDeck) {
        if (progress[String(q.id)]?.solved) solved++
      }
      const pct = Math.round((solved / inDeck.length) * 100)
      return { name: p.name, pct, solved, total: inDeck.length }
    })
      .filter(x => x.total > 0)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8)
  }, [ordered, progress])

  const [resume, setResume] = useState<Resume | null>(null)
  useEffect(() => {
    setResume(readResume())
  }, [])

  const resumeHref = useMemo(() => {
    if (!resume) return null
    const q = resume.query ? `?${resume.query}` : ''
    return `/learn/${resume.index}${q}`
  }, [resume])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center gap-2 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-medium">Loading your deck…</span>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-indigo-50/80 via-white to-white">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-16">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100/50 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-violet-200/35 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                <Sparkles size={14} className="text-indigo-500" />
                Learn
              </div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
                Your study command center
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-gray-600">
                Spaced repetition, challenge mode, and the full editor — all in one flow. Pick up where you left off or
                drill what matters today.
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[220px]">
              {resumeHref && (
                <Link
                  href={resumeHref}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-700"
                >
                  Continue session
                  <ArrowRight size={18} />
                </Link>
              )}
              <Link
                href={firstUnsolvedIdx >= 0 ? `/learn/${firstUnsolvedIdx}` : '/learn/0'}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3.5 text-sm font-bold transition ${
                  resumeHref
                    ? 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/80'
                    : 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Target size={18} />
                {firstUnsolvedIdx >= 0 ? 'Jump to next unsolved' : 'Start from top'}
              </Link>
              <Link
                href="/learn/0"
                className="text-center text-xs font-semibold text-gray-500 hover:text-indigo-600"
              >
                Open deck from the beginning →
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Deck</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-green-100 bg-green-50/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-green-700/80">Solved</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-green-800">
                {stats.solved}
                <span className="ml-1 text-sm font-bold text-green-600">({stats.pct}%)</span>
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800/90">Due review</p>
              <p className="mt-1 flex items-center gap-1.5 text-2xl font-black tabular-nums text-amber-900">
                <Brain size={22} className="text-amber-600" />
                {stats.due}
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-yellow-50/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-yellow-800/90">Starred</p>
              <p className="mt-1 flex items-center gap-1.5 text-2xl font-black tabular-nums text-yellow-900">
                <Star size={22} className="text-yellow-500" />
                {stats.starred}
              </p>
            </div>
          </div>
        </div>

        {/* Quick filters */}
        <div className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-800">
            <LayoutGrid size={16} className="text-indigo-500" />
            Quick start
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Unsolved only', href: '/learn/0?solved=false' },
              { label: 'Starred', href: '/learn/0?starred=1' },
              { label: 'Easy warm-up', href: '/learn/0?diff=Easy' },
              { label: 'Medium focus', href: '/learn/0?diff=Medium' },
              { label: 'Hard push', href: '/learn/0?diff=Hard' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Due reviews */}
        <div className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-black text-gray-800">
              <Flame size={16} className="text-orange-500" />
              Due for spaced repetition
            </h2>
            {firstDueIdx >= 0 && (
              <Link
                href={`/learn/${firstDueIdx}`}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Open first due →
              </Link>
            )}
          </div>
          {dueList.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Nothing due right now — nice work. Mark problems solved in Learn to start your review cycle.
            </p>
          ) : (
            <ul className="space-y-2">
              {dueList.map(({ q, next }) => (
                <li key={q.id}>
                  <Link
                    href={`/learn/${idToIndex.get(q.id) ?? 0}`}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="text-xs font-mono text-gray-400">#{q.id}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">{q.title}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="hidden shrink-0 text-xs font-medium text-gray-400 sm:inline">
                      due {formatLocalDate(next)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pattern radar */}
        {patternRadar.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-800">
              <Target size={16} className="text-cyan-600" />
              Pattern coverage in your deck
            </h2>
            <p className="mb-4 text-xs text-gray-500">
              Lowest coverage first — tap a pattern to filter the deck by those tags.
            </p>
            <div className="space-y-3">
              {patternRadar.map(({ name, pct, solved, total }) => {
                const patternTags = QUICK_PATTERNS.find(p => p.name === name)?.tags ?? []
                const sp = new URLSearchParams()
                if (patternTags.length) sp.set('tags', patternTags.join(','))
                const href = `/learn/0${sp.toString() ? `?${sp}` : ''}`
                return (
                  <Link
                    key={name}
                    href={href}
                    className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-cyan-200"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-gray-800">{name}</span>
                      <span className="shrink-0 text-xs font-semibold text-gray-500">
                        {solved}/{total}{' '}
                        <span className={pct >= 80 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}>
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 flex flex-col items-center rounded-2xl border border-indigo-100 bg-indigo-50/50 px-6 py-8 text-center">
          <BookOpen className="mx-auto mb-2 text-indigo-500" size={28} />
          <p className="text-sm font-bold text-gray-800">Ready when you are</p>
          <p className="mt-1 max-w-md text-xs text-gray-600">
            Challenge mode hides solutions until you are ready. Reviews show up here when it is time to reinforce.
          </p>
          <Link
            href="/learn/0"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700"
          >
            <CheckCircle2 size={18} />
            Enter Learn
          </Link>
        </div>
      </div>
    </div>
  )
}

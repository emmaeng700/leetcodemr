'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, ExternalLink, CheckCircle, Circle, Play, Pause, RotateCcw } from 'lucide-react'
import { getSetProgress, updateSetQProgress, type SetQProgress } from '@/lib/setProgress'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import DifficultyBadge from '@/components/DifficultyBadge'

interface Props { set: 2 | 3 }

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function SetSpeedsterTab({ set }: Props) {
  const [questions, setQuestions] = useState<SetQuestion[]>([])
  const [progress, setProgress] = useState<Record<string, SetQProgress>>({})
  const [loading, setLoading] = useState(true)
  const [filterDiff, setFilterDiff] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All')
  const [filterCat, setFilterCat] = useState('All')
  const [filterSolved, setFilterSolved] = useState<'All' | 'Solved' | 'Unsolved'>('All')
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const main = await fetch('/questions_full.json').then(r => r.json())
      const mainIds = new Set((main as { id: number }[]).map(q => q.id))
      const qs = set === 2 ? getSet2Questions(mainIds) : getSet3Questions(mainIds)
      setQuestions(qs)
      setProgress(getSetProgress(set))
      setLoading(false)
    }
    load()
  }, [set])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  function toggleTimer() {
    if (running) {
      stopTimer()
      setRunning(false)
    } else {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      setRunning(true)
    }
  }

  function resetTimer() { stopTimer(); setRunning(false); setElapsed(0) }

  function toggleSolved(qId: number) {
    const cur = progress[String(qId)]
    const updated = updateSetQProgress(set, qId, { solved: !cur?.solved })
    setProgress(prev => ({ ...prev, [String(qId)]: updated }))
  }

  const categories = ['All', ...Array.from(new Set(questions.map(q => q.category))).sort()]

  const filtered = questions.filter(q => {
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
    if (filterCat !== 'All' && q.category !== filterCat) return false
    const solved = !!progress[String(q.id)]?.solved
    if (filterSolved === 'Solved' && !solved) return false
    if (filterSolved === 'Unsolved' && solved) return false
    return true
  })

  const solvedCount = questions.filter(q => progress[String(q.id)]?.solved).length

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-subtle)] text-sm animate-pulse">Loading…</div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-black text-[var(--text)] text-base">Speedster — Set {set}</h2>
          <p className="text-xs text-[var(--text-subtle)] mt-0.5">
            {solvedCount}/{questions.length} solved · {filtered.length} shown
          </p>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2">
          <Timer size={14} className={running ? 'text-yellow-500' : 'text-[var(--text-subtle)]'} />
          <span className="font-mono text-sm font-bold text-[var(--text)] min-w-[40px]">{formatTime(elapsed)}</span>
          <button onClick={toggleTimer}
            className={`p-1 rounded-lg transition-colors ${running ? 'text-yellow-500 hover:text-yellow-600' : 'text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button onClick={resetTimer} className="p-1 rounded-lg text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors">
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
            <button key={d} onClick={() => setFilterDiff(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-400'
              }`}>{d}</button>
          ))}
          <div className="w-px bg-[var(--border)] shrink-0" />
          {(['All', 'Solved', 'Unsolved'] as const).map(s => (
            <button key={s} onClick={() => setFilterSolved(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterSolved === s ? 'bg-green-600 text-white border-green-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]'
              }`}>{s}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterCat === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-400'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--text-subtle)] text-sm">No questions match this filter.</div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {filtered.map((q, i) => {
          const solved = !!progress[String(q.id)]?.solved
          return (
            <div key={q.id} className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-[var(--border)]' : ''} ${solved ? 'bg-green-50/30' : ''}`}>
              <button onClick={() => toggleSolved(q.id)} className="shrink-0">
                {solved
                  ? <CheckCircle size={17} className="text-green-500" />
                  : <Circle size={17} className="text-[var(--text-subtle)] hover:text-green-400 transition-colors" />}
              </button>
              <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0">#{q.id}</span>
              <span className={`flex-1 text-sm font-semibold truncate ${solved ? 'text-green-700 line-through opacity-60' : 'text-[var(--text)]'}`}>
                {q.title}
              </span>
              <span className="text-xs text-[var(--text-subtle)] shrink-0 hidden sm:inline">{q.category}</span>
              <DifficultyBadge difficulty={q.difficulty} />
              <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-[var(--text-subtle)] hover:text-orange-400 transition-colors">
                <ExternalLink size={13} />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw, Plus, Trash2, Play, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSavedCycles, setSavedCycles, saveCycleState, getCycleState, clampCycleIdx, type SavedCycle } from '@/lib/db'
import { defaultStudyQuestionOrder } from '@/lib/studyPlanOrder'
import { buildExclusivePatternMap } from '@/lib/patternUtils'
import { PATTERN_PRIORITY, QUICK_PATTERNS } from '@/lib/constants'
import SetCyclesPage from '@/components/SetCyclesPage'

interface Question { id: number; title: string; difficulty: string; tags: string[]; source: string[] }

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function CyclesInner() {
  const router = useRouter()
  const [cycles,    setCycles]    = useState<SavedCycle[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)

  // Form state
  const [formName,   setFormName]   = useState('')
  const [formFrom,   setFormFrom]   = useState('1')
  const [formTo,     setFormTo]     = useState('')
  const [formPreset, setFormPreset] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      getSavedCycles(),
      fetch('/questions_full.json').then(r => r.json()),
    ]).then(([saved, qs]) => {
      setCycles(saved)
      setQuestions(qs)
      setPlanOrder(defaultStudyQuestionOrder(qs as Question[]))
    }).finally(() => setLoading(false))
  }, [])

  const qMap         = Object.fromEntries(questions.map(q => [q.id, q]))
  const filtered     = planOrder.map(id => qMap[id]).filter(Boolean) as Question[]
  const exclusiveMap = useMemo(() => buildExclusivePatternMap(questions), [questions])

  // Auto-detect priority+difficulty preset ranges (same logic as learn page)
  const presets = useMemo(() => {
    const PRI  = ['High', 'Mid', 'Low'] as const
    const DIFF = ['Easy', 'Medium', 'Hard'] as const
    const out: { label: string; start: number; end: number }[] = []
    for (const pri of PRI) {
      for (const diff of DIFF) {
        const indices = filtered
          .map((q, i) => ({ i, pri: PATTERN_PRIORITY[exclusiveMap[q.id] ?? ''] ?? null, diff: q.difficulty }))
          .filter(x => x.pri === pri && x.diff === diff)
          .map(x => x.i)
        if (indices.length > 0)
          out.push({ label: `${pri} ${diff} (${indices.length} questions)`, start: indices[0], end: indices[indices.length - 1] })
      }
    }
    return out
  }, [filtered, exclusiveMap])

  const resolveRange = (): { start: number; end: number; label: string } | null => {
    if (formPreset) {
      const p = presets.find(p => p.label === formPreset)
      return p ? { start: p.start, end: p.end, label: p.label } : null
    }
    const from = parseInt(formFrom, 10) - 1
    const to   = parseInt(formTo || String(filtered.length), 10) - 1
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) return null
    const s = Math.max(0, Math.min(from, filtered.length - 1))
    const e = Math.max(s, Math.min(to,   filtered.length - 1))
    return { start: s, end: e, label: `Questions ${s + 1}–${e + 1}` }
  }

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Give the cycle a name'); return }
    const rng = resolveRange()
    if (!rng) { toast.error('Invalid range — check your from/to values'); return }
    setSaving(true)
    const newCycle: SavedCycle = {
      id: uid(), name: formName.trim(), rangeLabel: rng.label,
      range: { start: rng.start, end: rng.end }, reps: 0,
      createdAt: new Date().toISOString(),
    }
    const next = [...cycles, newCycle]
    await setSavedCycles(next)
    setCycles(next)
    setShowForm(false)
    setFormName(''); setFormFrom('1'); setFormTo(''); setFormPreset(null)
    toast.success(`Cycle "${newCycle.name}" created`)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const cycle = cycles.find(c => c.id === id)
    if (!cycle) return
    if (!confirm(`Delete cycle "${cycle.name}"?`)) return
    const next = cycles.filter(c => c.id !== id)
    await setSavedCycles(next)
    setCycles(next)

    // If this was the active cycle in Learn, clear it too
    const active = await getCycleState()
    const isActive = active?.cycleRange &&
      active.cycleRange.start === cycle.range.start &&
      active.cycleRange.end   === cycle.range.end
    if (isActive) {
      await saveCycleState(null)
      // Clear Learn page sessionStorage so the badge disappears immediately
      try {
        sessionStorage.removeItem('lm_learn_cycle')
        sessionStorage.removeItem('lm_learn_cycle_reps')
        sessionStorage.removeItem('lm_learn_cycle_pos')
        sessionStorage.removeItem('lm_learn_cycle_idx')
        sessionStorage.removeItem('lm_learn_cycle_accepted')
      } catch {}
      toast.success(`"${cycle.name}" deleted and deactivated from Learn`)
    } else {
      toast.success(`"${cycle.name}" deleted`)
    }
  }

  const handleActivate = async (cycle: SavedCycle) => {
    const active = await getCycleState()
    const sameAsActive = !!active?.cycleRange &&
      active.cycleRange.start === cycle.range.start &&
      active.cycleRange.end === cycle.range.end

    let cycleReps = cycle.reps
    let cyclePos = cycle.cyclePos ?? 0
    let cycleIdx = cycle.cycleIdx
    let cycleAccepted = Array.isArray(cycle.cycleAccepted) ? cycle.cycleAccepted : []

    if (sameAsActive && active) {
      cycleReps = active.cycleReps ?? cycle.reps
      cyclePos = active.cyclePos ?? 0
      cycleIdx = active.cycleIdx ?? cycle.cycleIdx
      cycleAccepted = Array.isArray(active.cycleAccepted) ? active.cycleAccepted : []
    }

    let fallbackIdx: number | undefined
    try {
      const stored = parseInt(localStorage.getItem('lm_learn_idx') ?? '', 10)
      if (Number.isFinite(stored)) fallbackIdx = stored
    } catch {}
    // For a fresh cycle (pos=0, reps=0, nothing accepted) always start at the
    // range start — avoids a stale cycleIdx (from a previous race condition) corrupting entry.
    const isFresh = cycleReps === 0 && cyclePos === 0 && cycleAccepted.length === 0
    const idx = isFresh
      ? cycle.range.start
      : clampCycleIdx(cycleIdx ?? fallbackIdx, cycle.range)

    const state = {
      cycleRange: cycle.range,
      cycleReps,
      cyclePos,
      cycleIdx: idx,
      cycleAccepted,
    }

    await saveCycleState(state)
    try {
      sessionStorage.setItem('lm_learn_cycle', JSON.stringify(cycle.range))
      sessionStorage.setItem('lm_learn_cycle_reps', String(cycleReps))
      sessionStorage.setItem('lm_learn_cycle_pos', String(cyclePos))
      sessionStorage.setItem('lm_learn_cycle_idx', String(idx))
      sessionStorage.setItem('lm_learn_cycle_accepted', JSON.stringify(cycleAccepted))
      localStorage.setItem('lm_learn_idx', String(idx))
    } catch {}
    toast.success(`"${cycle.name}" activated — opening Learn`)
    router.push(`/learn/${idx}`)
  }

  const lapBar = (reps: number) => {
    const pct = Math.min((reps / 10) * 100, 100)
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 bg-indigo-100 rounded-full overflow-hidden border border-indigo-200">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, minWidth: pct > 0 ? '8px' : '0' }}
          />
        </div>
        <span className="text-[11px] font-bold text-indigo-600 shrink-0">{reps}/10</span>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
      <RefreshCw size={15} className="animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <RefreshCw size={17} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-lg leading-tight">Manage Cycles</h1>
            <p className="text-xs text-gray-400">Create and activate question cycles for the Learn page</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'New Cycle'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-bold text-gray-800 text-sm mb-4">New Cycle</h2>

          <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
          <input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. High Easy Round, Graph Sprint…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-400 mb-4"
          />

          <label className="block text-xs font-semibold text-gray-500 mb-2">Range</label>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setFormPreset(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${!formPreset ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}
            >
              Custom
            </button>
            {presets.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setFormPreset(p.label)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${formPreset === p.label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range inputs */}
          {!formPreset && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1">
                <label className="block text-[11px] text-gray-400 mb-1">From question #</label>
                <input
                  type="number" min={1} max={filtered.length}
                  value={formFrom}
                  onChange={e => setFormFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-400"
                />
              </div>
              <span className="text-gray-400 pt-5">→</span>
              <div className="flex-1">
                <label className="block text-[11px] text-gray-400 mb-1">To question #</label>
                <input
                  type="number" min={1} max={filtered.length}
                  value={formTo}
                  onChange={e => setFormTo(e.target.value)}
                  placeholder={String(filtered.length)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {(() => {
            const rng = resolveRange()
            if (!rng) return null
            const size = rng.end - rng.start + 1
            const first = filtered[rng.start]?.title ?? '?'
            const last  = filtered[rng.end]?.title ?? '?'
            return (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 mb-4">
                <strong>{size} questions</strong> · starts with <em>{first}</em>, ends with <em>{last}</em>
              </p>
            )
          })()}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create Cycle'}
          </button>
        </div>
      )}

      {/* Cycle list */}
      {cycles.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
          No cycles yet — create one above
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <div key={cycle.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-gray-800 text-sm">{cycle.name}</h3>
                  <button
                    onClick={() => handleDelete(cycle.id)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                    title="Delete cycle"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">{cycle.rangeLabel}</p>
              </div>
              <div className="px-4 py-3">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-gray-500">Laps completed</span>
                    <span className="text-[11px] text-gray-400">{new Date(cycle.createdAt).toLocaleDateString()}</span>
                  </div>
                  {lapBar(cycle.reps)}
                  {Array.isArray(cycle.cycleAccepted) && cycle.cycleAccepted.length > 0 && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-2">
                      Current lap: {cycle.cycleAccepted.length}/{cycle.range.end - cycle.range.start + 1} accepted
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleActivate(cycle)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors"
                >
                  <Play size={12} /> Activate &amp; Go to Learn
                  <ChevronRight size={12} className="ml-auto" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SET_TABS = [
  { key: '1', label: 'Set 1 (331)' },
  { key: '2', label: 'Set 2 (NC150)' },
  { key: '3', label: 'Set 3 (AM600)' },
]

function CyclesHub() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeSet = searchParams.get('set') ?? '1'

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {SET_TABS.map(({ key, label }) => (
          <button key={key}
            onClick={() => router.replace(`/cycles?set=${key}`, { scroll: false })}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              activeSet === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {activeSet === '1' && <CyclesInner />}
        {activeSet === '2' && <SetCyclesPage set={2} />}
        {activeSet === '3' && <SetCyclesPage set={3} />}
      </div>
    </div>
  )
}

export default function CyclesPage() {
  return <Suspense><CyclesHub /></Suspense>
}

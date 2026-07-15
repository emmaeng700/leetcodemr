'use client'

import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY, type PatternPriority } from '@/lib/constants'
import type { GrindSummaryCounts } from '@/lib/grindList'

const DIFFS = ['Easy', 'Medium', 'Hard'] as const
const PRIOS = ['High', 'Mid', 'Low'] as const
type Diff = (typeof DIFFS)[number]
type SetNum = 1 | 2 | 3

const DIFF_CLASS: Record<string, string> = {
  Easy: 'text-[#a6e3a1]',
  Medium: 'text-[#f9e2af]',
  Hard: 'text-[#f38ba8]',
}

const PRIO_CLASS: Record<string, string> = {
  High: 'text-[#f38ba8]',
  Mid: 'text-[#fab387]',
  Low: 'text-[#6c7086]',
}

const SET_CLASS: Record<SetNum, string> = {
  1: 'text-[#89b4fa]',
  2: 'text-[#a6e3a1]',
  3: 'text-[#cba6f7]',
}

export type GrindFilterState = {
  difficulties: Set<Diff>
  priorities: Set<PatternPriority>
  sets: Set<SetNum>
  pattern: string
}

type Props = {
  counts: GrindSummaryCounts
  /** Counts for pattern options (usually scoped by set/diff/prio, not pattern). */
  patternCounts?: Record<string, number>
  filters: GrindFilterState
  onChange: (next: GrindFilterState) => void
  compact?: boolean
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function isNarrow<T>(set: Set<T>, fullSize: number) {
  return set.size > 0 && set.size < fullSize
}

export default function GrindCountStrip({
  counts,
  patternCounts,
  filters,
  onChange,
  compact,
}: Props) {
  const patterns = DISPLAY_PATTERN_ORDER.filter(p => (patternCounts?.[p] ?? counts.byPattern[p] ?? 0) > 0)
  const anyActive =
    isNarrow(filters.difficulties, 3) ||
    isNarrow(filters.priorities, 3) ||
    isNarrow(filters.sets, 3) ||
    filters.pattern !== 'all'

  return (
    <div className="grind-count-strip">
      <div className="grind-count-row" role="group" aria-label="Grind filters">
        {DIFFS.map(d => {
          const narrow = isNarrow(filters.difficulties, 3)
          const on = narrow && filters.difficulties.has(d)
          return (
            <button
              key={d}
              type="button"
              className={`grind-filter-chip ${on ? 'on' : ''} ${!narrow ? 'neutral' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, difficulties: toggleInSet(filters.difficulties, d) })}
            >
              <span className={`font-bold ${DIFF_CLASS[d]}`}>{d}</span>
              {' '}
              <span className="grind-count-num">{counts.byDifficulty[d] ?? 0}</span>
            </button>
          )
        })}
        <span className="grind-count-sep">|</span>
        {PRIOS.map(p => {
          const narrow = isNarrow(filters.priorities, 3)
          const on = narrow && filters.priorities.has(p)
          return (
            <button
              key={p}
              type="button"
              className={`grind-filter-chip ${on ? 'on' : ''} ${!narrow ? 'neutral' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, priorities: toggleInSet(filters.priorities, p) })}
            >
              <span className={`font-bold ${PRIO_CLASS[p]}`}>{p}</span>
              {' '}
              <span className="grind-count-num">{counts.byPriority[p] ?? 0}</span>
            </button>
          )
        })}
        <span className="grind-count-sep">|</span>
        {([1, 2, 3] as const).map(s => {
          const narrow = isNarrow(filters.sets, 3)
          const on = narrow && filters.sets.has(s)
          return (
            <button
              key={s}
              type="button"
              className={`grind-filter-chip ${on ? 'on' : ''} ${!narrow ? 'neutral' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, sets: toggleInSet(filters.sets, s) })}
            >
              <span className={`font-bold ${SET_CLASS[s]}`}>S{s}</span>
              {' '}
              <span className="grind-count-num">{counts.bySet[s]}</span>
            </button>
          )
        })}
        {anyActive && (
          <button
            type="button"
            className="grind-filter-chip clear"
            onClick={() =>
              onChange({
                difficulties: new Set(),
                priorities: new Set(),
                sets: new Set(),
                pattern: 'all',
              })
            }
          >
            Clear
          </button>
        )}
      </div>

      {!compact && (
        <div className="grind-count-patterns">
          <label className="grind-pattern-select-wrap">
            <span className="sr-only">Pattern</span>
            <select
              value={filters.pattern}
              onChange={e => onChange({ ...filters, pattern: e.target.value })}
              className="grind-pattern-select"
            >
              <option value="all">All patterns</option>
              {patterns.map(p => (
                <option key={p} value={p}>
                  {p} ({patternCounts?.[p] ?? counts.byPattern[p] ?? 0})
                </option>
              ))}
            </select>
          </label>
          {patterns.slice(0, 8).map(name => {
            const n = patternCounts?.[name] ?? counts.byPattern[name] ?? 0
            const on = filters.pattern === name
            return (
              <button
                key={name}
                type="button"
                title={name}
                className={`grind-filter-chip pattern ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => onChange({ ...filters, pattern: on ? 'all' : name })}
              >
                <span className="text-[#a6adc8] truncate max-w-[7rem]">{name}</span>
                {' '}
                <span className="grind-count-num">{n}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Empty / full sets mean "all" for that dimension. */
export function grindQuestionMatchesFilters(
  q: { set: 1 | 2 | 3; difficulty: string; pattern: string | null },
  filters: GrindFilterState,
): boolean {
  if (isNarrow(filters.sets, 3) && !filters.sets.has(q.set)) return false
  if (isNarrow(filters.difficulties, 3) && !filters.difficulties.has(q.difficulty as Diff)) return false
  if (isNarrow(filters.priorities, 3)) {
    const pri = q.pattern ? PATTERN_PRIORITY[q.pattern] : null
    if (!pri || !filters.priorities.has(pri)) return false
  }
  if (filters.pattern !== 'all' && q.pattern !== filters.pattern) return false
  return true
}

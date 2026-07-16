'use client'

import { DISPLAY_PATTERN_ORDER, PATTERN_PRIORITY, type PatternPriority } from '@/lib/constants'
import type { GrindSummaryCounts } from '@/lib/grindList'

const DIFFS = ['Easy', 'Medium', 'Hard'] as const
const PRIOS = ['High', 'Mid', 'Low'] as const
const SETS = [1, 2, 3] as const
type Diff = (typeof DIFFS)[number]
type SetNum = (typeof SETS)[number]

const DIFF_CLASS: Record<string, string> = {
  Easy: 'text-[#a6e3a1]',
  Medium: 'text-[#f9e2af]',
  Hard: 'text-[#f38ba8]',
}

const PRIO_CLASS: Record<string, string> = {
  High: 'text-[#f38ba8]',
  Mid: 'text-[#fab387]',
  Low: 'text-[#a6adc8]',
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

export const DEFAULT_GRIND_FILTERS: GrindFilterState = {
  difficulties: new Set(DIFFS),
  priorities: new Set(PRIOS),
  sets: new Set(SETS),
  pattern: 'all',
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

function isDefaultFilters(filters: GrindFilterState) {
  return (
    filters.pattern === 'all' &&
    DIFFS.every(d => filters.difficulties.has(d)) &&
    PRIOS.every(p => filters.priorities.has(p)) &&
    SETS.every(s => filters.sets.has(s))
  )
}

export default function GrindCountStrip({
  counts,
  patternCounts,
  filters,
  onChange,
  compact,
}: Props) {
  const patterns = DISPLAY_PATTERN_ORDER.filter(p => (patternCounts?.[p] ?? counts.byPattern[p] ?? 0) > 0)
  const anyCustom = !isDefaultFilters(filters)

  return (
    <div className="grind-count-strip" role="group" aria-label="Grind filters">
      <div className="grind-filter-row">
        <span className="grind-filter-label">Difficulty</span>
        {DIFFS.map(d => {
          const on = filters.difficulties.has(d)
          return (
            <button
              key={d}
              type="button"
              className={`grind-tick ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, difficulties: toggleInSet(filters.difficulties, d) })}
            >
              <span className="grind-tick-mark" aria-hidden>{on ? '✓' : ''}</span>
              <span className={`font-bold ${DIFF_CLASS[d]}`}>{d}</span>
              <span className="grind-count-num">{counts.byDifficulty[d] ?? 0}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="grind-filter-all"
          onClick={() => onChange({ ...filters, difficulties: new Set(DIFFS) })}
        >
          All
        </button>
      </div>

      <div className="grind-filter-row">
        <span className="grind-filter-label">Priority</span>
        {PRIOS.map(p => {
          const on = filters.priorities.has(p)
          return (
            <button
              key={p}
              type="button"
              className={`grind-tick ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, priorities: toggleInSet(filters.priorities, p) })}
            >
              <span className="grind-tick-mark" aria-hidden>{on ? '✓' : ''}</span>
              <span className={`font-bold ${PRIO_CLASS[p]}`}>{p}</span>
              <span className="grind-count-num">{counts.byPriority[p] ?? 0}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="grind-filter-all"
          onClick={() => onChange({ ...filters, priorities: new Set(PRIOS) })}
        >
          All
        </button>
      </div>

      <div className="grind-filter-row">
        <span className="grind-filter-label">Set</span>
        {SETS.map(s => {
          const on = filters.sets.has(s)
          return (
            <button
              key={s}
              type="button"
              className={`grind-tick ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filters, sets: toggleInSet(filters.sets, s) })}
            >
              <span className="grind-tick-mark" aria-hidden>{on ? '✓' : ''}</span>
              <span className={`font-bold ${SET_CLASS[s]}`}>S{s}</span>
              <span className="grind-count-num">{counts.bySet[s]}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="grind-filter-all"
          onClick={() => onChange({ ...filters, sets: new Set(SETS) })}
        >
          All
        </button>
        {anyCustom && (
          <button
            type="button"
            className="grind-filter-all"
            onClick={() =>
              onChange({
                difficulties: new Set(DIFFS),
                priorities: new Set(PRIOS),
                sets: new Set(SETS),
                pattern: 'all',
              })
            }
          >
            Reset
          </button>
        )}
      </div>

      {!compact && (
        <div className="grind-filter-row">
          <span className="grind-filter-label">Pattern</span>
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
          <div className="grind-count-patterns">
            <button
              type="button"
              className={`grind-tick ${filters.pattern === 'all' ? 'on' : ''}`}
              aria-pressed={filters.pattern === 'all'}
              onClick={() => onChange({ ...filters, pattern: 'all' })}
            >
              <span className="grind-tick-mark" aria-hidden>{filters.pattern === 'all' ? '✓' : ''}</span>
              All
            </button>
            {patterns.slice(0, 8).map(name => {
              const n = patternCounts?.[name] ?? counts.byPattern[name] ?? 0
              const on = filters.pattern === name
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  className={`grind-tick pattern ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onChange({ ...filters, pattern: on ? 'all' : name })}
                >
                  <span className="grind-tick-mark" aria-hidden>{on ? '✓' : ''}</span>
                  <span className="grind-tick-pattern-name">{name}</span>
                  <span className="grind-count-num">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Empty sets match nothing; otherwise require membership. Pattern `all` = any. */
export function grindQuestionMatchesFilters(
  q: { set: 1 | 2 | 3; difficulty: string; pattern: string | null; section?: string | null },
  filters: GrindFilterState,
): boolean {
  if (!filters.sets.has(q.set)) return false
  if (!filters.difficulties.has(q.difficulty as Diff)) return false
  let pri: PatternPriority | null = q.pattern ? (PATTERN_PRIORITY[q.pattern] ?? null) : null
  // Fallback: derive priority from section when pattern is missing
  if (!pri && q.section) {
    const m = q.section.match(/^(High|Mid|Low) /)
    if (m) pri = m[1] as PatternPriority
  }
  if (!pri || !filters.priorities.has(pri)) return false
  if (filters.pattern !== 'all' && q.pattern !== filters.pattern) return false
  return true
}

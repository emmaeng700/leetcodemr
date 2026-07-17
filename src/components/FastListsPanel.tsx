'use client'

import { useMemo } from 'react'
import { DISPLAY_PATTERN_ORDER } from '@/lib/constants'
import type { GrindQuestion } from '@/lib/grindQuestions'
import type { GrindFilterState } from '@/components/GrindCountStrip'

// ── abbrev maps (match generate_study_splits.py) ─────────────────────────────
const TIER_ABBREV: Record<string, string> = {
  'High Easy': 'HE', 'High Medium': 'HM', 'High Hard': 'HH',
  'Mid Easy': 'ME',  'Mid Medium': 'MM',  'Mid Hard': 'MH',
  'Low Easy': 'LE',  'Low Medium': 'LM',  'Low Hard': 'LH',
}
const PATTERN_ABBREV: Record<string, string> = {
  'Arrays & Hashing': 'A&H', 'String': 'Str', 'Two Pointers': '2P',
  'Sliding Window': 'SW', 'Sorting': 'Sort', 'Binary Search': 'BS',
  'Matrix': 'Mtx', 'Trees & BST': 'Trees', 'DFS': 'DFS', 'Graphs': 'Gph',
  'BFS': 'BFS', 'Linked List': 'LL', 'Stack': 'Stk', 'Heap': 'Heap',
  'Trie': 'Trie', 'Backtracking': 'BT', 'Greedy': 'Grdy',
  'Dynamic Programming': 'DP', 'Bit Manipulation': 'BitM',
  'Math': 'Math', 'JavaScript': 'JS',
}

const SET_COLOR: Record<number, string> = {
  1: 'var(--grind-blue)',
  2: 'var(--grind-green)',
  3: 'var(--grind-purple)',
}
const PRIO_COLOR: Record<string, string> = {
  High: 'var(--grind-red)',
  Mid:  'var(--grind-orange)',
  Low:  'var(--grind-soft)',
}
const PRIO_BG: Record<string, string> = {
  High: 'rgba(243,139,168,0.08)',
  Mid:  'rgba(250,179,135,0.08)',
  Low:  'rgba(166,173,200,0.08)',
}
const DIFF_COLOR: Record<string, string> = {
  E: 'var(--grind-green)',
  M: 'var(--grind-orange)',
  H: 'var(--grind-red)',
}

/** "HE" → H + colored E so the difficulty jump is visible while scanning. */
function TierAbbr({ abbr }: { abbr: string }) {
  const m = /^([HML])([EMH])$/.exec(abbr)
  if (!m) return <>{abbr}</>
  return (
    <>
      {m[1]}
      <span style={{ color: DIFF_COLOR[m[2]], fontWeight: 700 }}>{m[2]}</span>
    </>
  )
}

type FastGroup = {
  priority: string   // High | Mid | Low
  set: 1 | 2 | 3
  tier: string       // e.g. "High Easy"
  pattern: string    // e.g. "Arrays & Hashing"
  count: number
  tierAbbr: string
  patAbbr: string
  label: string      // e.g. "S1 A&H · HE · 6q"
}

function parseSection(section: string | null): { tier: string; pattern: string } | null {
  if (!section) return null
  const m = section.match(/^(High|Mid|Low) (Easy|Medium|Hard) - (.+)$/)
  if (!m) return null
  return { tier: `${m[1]} ${m[2]}`, pattern: m[3] }
}

function isActive(filters: GrindFilterState, g: FastGroup): boolean {
  return (
    filters.pattern === g.pattern &&
    filters.sets.size === 1 && filters.sets.has(g.set as 1|2|3) &&
    filters.priorities.size === 1 && filters.priorities.has(g.priority as 'High'|'Mid'|'Low') &&
    filters.difficulties.size === 1 && filters.difficulties.has(
      g.tier.split(' ')[1] as 'Easy'|'Medium'|'Hard'
    )
  )
}

type Props = {
  questions: GrindQuestion[]
  activeFilters: GrindFilterState
  onSelect: (filters: GrindFilterState) => void
  onClose: () => void
}

export default function FastListsPanel({ questions, activeFilters, onSelect, onClose }: Props) {
  const groups = useMemo<FastGroup[]>(() => {
    const bucket = new Map<string, number>()
    for (const q of questions) {
      const parsed = parseSection(q.section ?? null)
      if (!parsed) continue
      const key = `${q.set}|${parsed.tier}|${parsed.pattern}`
      bucket.set(key, (bucket.get(key) ?? 0) + 1)
    }

    const result: FastGroup[] = []
    for (const priority of ['High', 'Mid', 'Low']) {
      for (const s of [1, 2, 3] as const) {
        for (const diff of ['Easy', 'Medium', 'Hard']) {
          const tier = `${priority} ${diff}`
          for (const pattern of DISPLAY_PATTERN_ORDER) {
            const count = bucket.get(`${s}|${tier}|${pattern}`) ?? 0
            if (!count) continue
            const tierAbbr = TIER_ABBREV[tier] ?? tier
            const patAbbr = PATTERN_ABBREV[pattern] ?? pattern
            result.push({
              priority, set: s, tier, pattern, count,
              tierAbbr, patAbbr,
              label: `S${s} ${patAbbr} · ${tierAbbr} · ${count}q`,
            })
          }
        }
      }
    }
    return result
  }, [questions])

  const sections = useMemo(() => {
    return ['High', 'Mid', 'Low'].map(priority => ({
      priority,
      items: groups.filter(g => g.priority === priority),
    }))
  }, [groups])

  return (
    <div className="fast-lists-panel">
      <div className="fast-lists-head">
        <span>Fast Lists · {groups.length}</span>
        <button type="button" className="fast-lists-close" onClick={onClose}>✕</button>
      </div>
      <div className="fast-lists-scroll">
        {sections.map(({ priority, items }) => (
          <div key={priority} className="fast-lists-section">
            <div
              className="fast-lists-section-label"
              style={{ color: PRIO_COLOR[priority], background: PRIO_BG[priority] }}
            >
              {priority} · {items.length} lists
            </div>
            <div className="fast-lists-chips">
              {items.map(g => {
                const active = isActive(activeFilters, g)
                return (
                  <button
                    key={g.label}
                    type="button"
                    className={`fast-chip ${active ? 'fast-chip-on' : ''}`}
                    style={active ? {
                      borderColor: SET_COLOR[g.set],
                      color: SET_COLOR[g.set],
                      background: 'rgba(137,180,250,0.1)',
                    } : {}}
                    onClick={() => {
                      const diff = g.tier.split(' ')[1] as 'Easy' | 'Medium' | 'Hard'
                      onSelect({
                        difficulties: new Set([diff]),
                        priorities: new Set([g.priority as 'High' | 'Mid' | 'Low']),
                        sets: new Set([g.set]),
                        pattern: g.pattern,
                      })
                    }}
                  >
                    <span className="fast-chip-set" style={{ color: SET_COLOR[g.set] }}>
                      S{g.set}
                    </span>
                    {' '}{g.patAbbr} · <TierAbbr abbr={g.tierAbbr} />
                    <span className="fast-chip-count">· {g.count}q</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { PATTERN_PRIORITY } from '@/lib/constants'
import type { GrindQuestion } from './grindQuestions'

export type GrindListEntry =
  | { type: 'divider'; label: string; key: string; variant: 'set' | 'tier' | 'section' | 'lts-band' | 'lts-section'; count: number }
  | { type: 'question'; q: GrindQuestion; key: string }

export type GrindSummaryCounts = {
  total: number
  bySet: Record<1 | 2 | 3, number>
  byDifficulty: Record<string, number>
  byPriority: Record<string, number>
  byPattern: Record<string, number>
  /** e.g. "High Easy" -> count (within current filtered list, all sets). */
  byTier: Record<string, number>
}

const SET_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Set 1 - Main',
  2: 'Set 2 - NeetCode',
  3: 'Set 3 - AlgoMaster',
}

export const SET_SHORT_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Set 1',
  2: 'Set 2',
  3: 'Set 3',
}

/** "High Easy - Arrays & Hashing" -> { tier: "High Easy", pattern: "Arrays & Hashing" } */
export function parseGrindSection(section: string): { tier: string; pattern: string } {
  const m = section.match(/^(High|Mid|Low) (Easy|Medium|Hard) - (.+)$/)
  if (!m) return { tier: section, pattern: section }
  return { tier: `${m[1]} ${m[2]}`, pattern: m[3] }
}

/** Study rounds in PDF order (priority × difficulty). */
export const STUDY_TIER_ORDER = [
  'High Easy',
  'High Medium',
  'High Hard',
  'Mid Easy',
  'Mid Medium',
  'Mid Hard',
  'Low Easy',
  'Low Medium',
  'Low Hard',
] as const

export type StudyTier = (typeof STUDY_TIER_ORDER)[number]

export function questionStudyTier(
  q: Pick<GrindQuestion, 'section' | 'pattern' | 'difficulty'>,
): StudyTier | null {
  if (q.section) {
    const { tier } = parseGrindSection(q.section)
    return (STUDY_TIER_ORDER as readonly string[]).includes(tier) ? (tier as StudyTier) : null
  }
  // Fallback: derive from pattern priority + difficulty when section is missing
  const pri = PATTERN_PRIORITY[q.pattern ?? '']
  if (pri && q.difficulty) {
    const tier = `${pri} ${q.difficulty}` as StudyTier
    return (STUDY_TIER_ORDER as readonly string[]).includes(tier) ? tier : null
  }
  return null
}

export function matchesStudyTier(
  q: Pick<GrindQuestion, 'section' | 'pattern' | 'difficulty'>,
  tier: StudyTier,
): boolean {
  return questionStudyTier(q) === tier
}

function setTierKey(set: number, tier: string) {
  return `${set}|${tier}`
}

function setSectionKey(set: number, section: string) {
  return `${set}|${section}`
}

/** Totals per set, difficulty, priority tier, pattern, and priority+difficulty tier. */
export function grindSummaryCounts(questions: GrindQuestion[]): GrindSummaryCounts {
  const bySet: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  const byDifficulty: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byPattern: Record<string, number> = {}
  const byTier: Record<string, number> = {}

  for (const q of questions) {
    bySet[q.set]++
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1
    if (q.section) {
      const { tier } = parseGrindSection(q.section)
      byTier[tier] = (byTier[tier] ?? 0) + 1
    }
    if (q.pattern) {
      byPattern[q.pattern] = (byPattern[q.pattern] ?? 0) + 1
      const pri = PATTERN_PRIORITY[q.pattern]
      if (pri) byPriority[pri] = (byPriority[pri] ?? 0) + 1
    }
  }

  return { total: questions.length, bySet, byDifficulty, byPriority, byPattern, byTier }
}

/** Sidebar rows: Set -> priority/difficulty tier -> pattern section (counts per set). */
export function grindListWithDividers(questions: GrindQuestion[]): GrindListEntry[] {
  const setCounts = new Map<number, number>()
  const tierCounts = new Map<string, number>()
  const sectionCounts = new Map<string, number>()

  for (const q of questions) {
    setCounts.set(q.set, (setCounts.get(q.set) ?? 0) + 1)
    if (q.section) {
      const { tier } = parseGrindSection(q.section)
      tierCounts.set(setTierKey(q.set, tier), (tierCounts.get(setTierKey(q.set, tier)) ?? 0) + 1)
      sectionCounts.set(
        setSectionKey(q.set, q.section),
        (sectionCounts.get(setSectionKey(q.set, q.section)) ?? 0) + 1,
      )
    }
  }

  const out: GrindListEntry[] = []
  let lastSet = 0
  let lastTier: string | null = null
  let lastSection: string | null = null

  for (const q of questions) {
    if (q.set !== lastSet) {
      out.push({
        type: 'divider',
        label: SET_LABEL[q.set],
        key: `set-${q.set}-${out.length}`,
        variant: 'set',
        count: setCounts.get(q.set) ?? 0,
      })
      lastSet = q.set
      lastTier = null
      lastSection = null
    }

    if (q.section && q.section !== lastSection) {
      const { tier, pattern } = parseGrindSection(q.section)
      if (tier !== lastTier) {
        out.push({
          type: 'divider',
          label: `${SET_SHORT_LABEL[q.set as 1 | 2 | 3]} · ${tier}`,
          key: `tier-${q.set}-${tier}-${out.length}`,
          variant: 'tier',
          count: tierCounts.get(setTierKey(q.set, tier)) ?? 0,
        })
        lastTier = tier
      }
      out.push({
        type: 'divider',
        label: pattern,
        key: `sec-${q.set}-${q.section}-${out.length}`,
        variant: 'section',
        count: sectionCounts.get(setSectionKey(q.set, q.section)) ?? 0,
      })
      lastSection = q.section
    }

    out.push({ type: 'question', q, key: `q-${q.set}-${q.id}` })
  }

  return out
}

const LTS_BAND_LABEL: Record<string, string> = {
  long:   '16+q · deep work',
  medium: '10–15q · solid',
  short:  '5–9q · short',
  tiny:   '1–4q · tiny',
}

function ltsBand(n: number): string {
  if (n >= 16) return 'long'
  if (n >= 10) return 'medium'
  if (n >= 5)  return 'short'
  return 'tiny'
}

export function ltsListWithDividers(questions: GrindQuestion[]): GrindListEntry[] {
  // Pre-compute section sizes from this list
  const secSize = new Map<string, number>()
  for (const q of questions) {
    if (!q.section) continue
    const k = `${q.section}|${q.set}`
    secSize.set(k, (secSize.get(k) ?? 0) + 1)
  }

  const out: GrindListEntry[] = []
  let lastPri = ''
  let lastBand = ''
  let lastSecKey = ''
  let bandIdx = 0
  let secIdx = 0

  for (const q of questions) {
    const secKey = `${q.section}|${q.set}`
    const n = secSize.get(secKey) ?? 1
    const band = ltsBand(n)
    const priM = q.section?.match(/^(High|Mid|Low)/)
    const pri = priM?.[1] ?? ''
    const patM = q.section?.match(/- (.+)$/)
    const pattern = patM?.[1] ?? q.section ?? ''
    const diffM = q.section?.match(/^(?:High|Mid|Low) (Easy|Medium|Hard)/)
    const diff = diffM?.[1]?.slice(0, 3) ?? ''

    if (pri !== lastPri || band !== lastBand) {
      lastPri = pri
      lastBand = band
      lastSecKey = ''
      out.push({
        type: 'divider',
        label: `${pri} · ${LTS_BAND_LABEL[band] ?? band}`,
        key: `lts-band-${bandIdx++}`,
        variant: 'lts-band',
        count: 0,
      })
    }

    if (secKey !== lastSecKey) {
      lastSecKey = secKey
      out.push({
        type: 'divider',
        label: `S${q.set} ${pattern} · ${diff} · ${n}q`,
        key: `lts-sec-${secIdx++}`,
        variant: 'lts-section',
        count: n,
      })
    }

    out.push({ type: 'question', q, key: `q-${q.set}-${q.id}` })
  }

  return out
}

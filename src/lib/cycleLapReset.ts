/** Shared helpers for cycle lap reset and ordering (Learn 1, 2, 3). */

export function cycleRangeQuestionCount(range: { start: number; end: number }): number {
  return range.end - range.start + 1
}

/** Sort question IDs into stable study-list order for lap-1 reset. */
export function canonicalCycleBaseIds(
  ids: number[],
  orderedList: ReadonlyArray<{ id: number }>,
): number[] {
  const indexOf = new Map(orderedList.map((q, i) => [q.id, i]))
  return [...ids].sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0))
}

export function readSessionCycleOrder(): number[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('lm_learn_cycle_order')
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
  } catch {
    return null
  }
}

export interface ResetToLapOnePayload {
  cycleRange: { start: number; end: number }
  cycleReps: 0
  cyclePos: 0
  cycleIdx: number
  cycleAccepted: []
  cycleOrderedIds: number[]
}

export function makeResetToLapOneState(
  cycleRange: { start: number; end: number },
  membershipIds: number[],
  lapOneOrder: number[],
  startIdx: number,
): ResetToLapOnePayload {
  return {
    cycleRange,
    cycleReps: 0,
    cyclePos: 0,
    cycleIdx: startIdx,
    cycleAccepted: [],
    cycleOrderedIds: lapOneOrder.length > 0 ? lapOneOrder : membershipIds,
  }
}

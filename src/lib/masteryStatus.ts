export type MasteryStatus = 'learnt' | 'reviewed' | 'revised' | 'mastered'

export function deriveMasteryStatus(solved: boolean, runs: number): MasteryStatus | null {
  if (!solved) return null
  if (runs >= 3) return 'mastered'
  if (runs >= 2) return 'revised'
  if (runs >= 1) return 'reviewed'
  return 'learnt'
}

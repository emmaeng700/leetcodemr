export type MasteryStatus = 'learnt' | 'reviewed' | 'revised' | 'mastered'

export function deriveMasteryStatus(solved: boolean, runs: number): MasteryStatus | null {
  if (!solved) return null
  if (runs >= 4) return 'mastered'
  if (runs >= 3) return 'revised'
  if (runs >= 2) return 'reviewed'
  return 'learnt'
}

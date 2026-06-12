/**
 * cycleReps = completed full laps (0-9 while running laps 1-10; 10 = all done).
 * Banner shows current lap as 1-10 via currentCycleLap().
 */

/** Lap you are on now (1-based). Lap 1 at cycleReps 0, lap 10 at cycleReps 9. */
export function currentCycleLap(completedLaps: number, repTarget: number): number {
  return Math.min(completedLaps + 1, repTarget)
}

export function isCycleFullyComplete(completedLaps: number, repTarget: number): boolean {
  return completedLaps >= repTarget
}
export const CYCLE_LAP_MOTIVATION: readonly string[] = [
  'Lap 1 - chill and learn. First pass is exposure, not perfection.',
  'Lap 2 - keep going. Hunt down every question you forgot.',
  'Lap 3 - patterns are sticking. Notice what repeats across problems.',
  'Lap 4 - less peeking. Try the approach before you open a solution.',
  'Lap 5 - halfway. You should recognize most of these by now.',
  'Lap 6 - answer most questions without referring back. Trust what you know.',
  'Lap 7 - speed round. Can you state the approach in under 30 seconds?',
  'Lap 8 - almost there. Only your weakest spots should slow you down.',
  'Lap 9 - one more full pass. Make the hard ones feel routine.',
  'Lap 10 - final lap. Own this range cold. No notes, no excuses.',
]

export function cycleLapMotivation(completedLaps: number): string {
  const idx = Math.min(Math.max(0, completedLaps), CYCLE_LAP_MOTIVATION.length - 1)
  return CYCLE_LAP_MOTIVATION[idx]
}

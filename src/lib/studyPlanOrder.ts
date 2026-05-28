import { diffFirstStudyOrder } from './patternUtils'

/**
 * Default question order for the app's study flow.
 * Three sweeps over all patterns in display order:
 *   Round 1 — every pattern's Easy questions
 *   Round 2 — every pattern's Medium questions
 *   Round 3 — every pattern's Hard questions
 * This builds broad pattern recognition before adding difficulty.
 */
export function defaultStudyQuestionOrder<T extends { id: number; difficulty: string; tags: string[] }>(
  questions: T[]
): number[] {
  return diffFirstStudyOrder(questions)
}

export { diffFirstStudyOrder, patternBasedStudyOrder } from './patternUtils'

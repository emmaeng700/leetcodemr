import { patternBasedStudyOrder } from './patternUtils'

/**
 * Default question order for the app's study flow.
 * Questions progress pattern-by-pattern in the shared display order, with
 * Easy → Medium → Hard inside each pattern.
 */
export function defaultStudyQuestionOrder<T extends { id: number; difficulty: string; tags: string[] }>(
  questions: T[]
): number[] {
  return patternBasedStudyOrder(questions)
}

export { patternBasedStudyOrder } from './patternUtils'

import { studyOrder } from './studyOrder'
import { patternBasedStudyOrder } from './patternUtils'

/**
 * Default question order for the app's study flow.
 * Delegates to studyOrder — the single source of truth in studyOrder.ts.
 */
export function defaultStudyQuestionOrder<T extends { id: number; difficulty: string; tags: string[] }>(
  questions: T[]
): number[] {
  return studyOrder(questions)
}

export { studyOrder, patternBasedStudyOrder }

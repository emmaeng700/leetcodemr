/**
 * Default question order when creating a Daily study plan (Easy → Medium → Hard).
 * Keep in sync with Daily page behavior — used by Line Game for the same sequence.
 */
export function defaultStudyQuestionOrder<T extends { id: number; difficulty: string }>(
  questions: T[]
): number[] {
  const easy = questions.filter((q) => q.difficulty === 'Easy').map((q) => q.id)
  const medium = questions.filter((q) => q.difficulty === 'Medium').map((q) => q.id)
  const hard = questions.filter((q) => q.difficulty === 'Hard').map((q) => q.id)
  return [...easy, ...medium, ...hard]
}

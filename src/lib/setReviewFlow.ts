import ncExtraQuestions from '../../neetcode_extra_questions.json'
import am600ExtraQuestions from '../../am600_extra_questions.json'
import { getSet2Questions, getSet3Questions, type SetQuestion } from '@/lib/questionSets'
import {
  getSetProgress,
  updateSetQProgress,
  nextReviewDate,
  saveSetProgress,
  type SetQProgress,
} from '@/lib/setProgress'
import { todayISOChicago } from '@/lib/studyPlanDay'

export type ReviewSet = 2 | 3

export type PracticeQuestion = {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source?: string[]
  description?: string
  explanation?: string
  python_solution?: string
  cpp_solution?: string
}

export function parseReviewSet(raw: string | null): ReviewSet | null {
  if (raw === '2') return 2
  if (raw === '3') return 3
  return null
}

export function reviewQueueKey(reviewSet: ReviewSet | null): string {
  if (reviewSet === 2) return 'lm_review_queue_set2'
  if (reviewSet === 3) return 'lm_review_queue_set3'
  return 'lm_review_queue'
}

export function reviewHubPath(reviewSet: ReviewSet | null): string {
  if (reviewSet === 2) return '/review?tab=sr-set2'
  if (reviewSet === 3) return '/review?tab=sr-set3'
  return '/review?tab=sr-queue'
}

export function dailyQueueKey(flowSet: ReviewSet | null): string {
  if (flowSet === 2) return 'lm_daily_queue_set2'
  if (flowSet === 3) return 'lm_daily_queue_set3'
  return 'lm_daily_queue'
}

export function practiceDailyHref(id: number, flowSet: ReviewSet | null): string {
  const base = `/practice/${id}?from=daily`
  return flowSet ? `${base}&set=${flowSet}` : base
}

export function flowNavQuery(flowSet: ReviewSet | null, mode: 'daily' | 'review'): string {
  if (mode === 'daily') return flowSet ? `?from=daily&set=${flowSet}` : '?from=daily'
  return flowSet ? `?from=review&set=${flowSet}` : '?from=review'
}

/** @deprecated use flowNavQuery */
export function reviewNavQuery(reviewSet: ReviewSet | null, mode: 'daily' | 'review'): string {
  return flowNavQuery(reviewSet, mode)
}

export function practiceReviewHref(id: number, reviewSet: ReviewSet | null): string {
  const base = `/practice/${id}?from=review`
  return reviewSet ? `${base}&set=${reviewSet}` : base
}

export function completeSetDailyQuestion(set: ReviewSet, questionId: number) {
  const row = getSetQProgressRow(set, questionId)
  const today = todayISOChicago()
  if (row.solved) {
    return updateSetQProgress(set, questionId, { last_reviewed: today })
  }
  const newCount = (row.review_count ?? 0) + 1
  return updateSetQProgress(set, questionId, {
    solved: true,
    review_count: newCount,
    next_review: nextReviewDate(newCount),
    last_reviewed: today,
  })
}

export function reviewHrefForQuestion(
  id: number,
  set2Questions: SetQuestion[],
  set3Questions: SetQuestion[],
): string {
  if (set2Questions.some(q => q.id === id)) return practiceReviewHref(id, 2)
  if (set3Questions.some(q => q.id === id)) return practiceReviewHref(id, 3)
  return `/practice/${id}?from=review`
}

export async function loadSetQuestions(reviewSet: ReviewSet): Promise<SetQuestion[]> {
  const main = await fetch('/questions_full.json').then(r => r.json()) as Array<{ id: number; tags?: string[] }>
  const mainIds = new Set(main.map(q => q.id))
  return reviewSet === 2 ? getSet2Questions(mainIds, main) : getSet3Questions(mainIds, main)
}

export type SetDueReview = {
  id: number
  review_count: number
  next_review: string
  carried: boolean
}

function isReviewIncompleteOnDueDate(
  dueDate: string,
  lastReviewed: string | null | undefined,
): boolean {
  if (!lastReviewed) return true
  return lastReviewed < dueDate
}

/** Roll incomplete Set 2/3 reviews forward to today (Chicago), like Set 1 catch-up. */
export function rolloverIncompleteSetReviews(reviewSet: ReviewSet): void {
  const today = todayISOChicago()
  const progress = getSetProgress(reviewSet)
  let changed = false
  for (const [idStr, row] of Object.entries(progress)) {
    if (!row?.solved || !row.next_review || row.next_review >= today) continue
    if (!isReviewIncompleteOnDueDate(row.next_review, row.last_reviewed)) continue
    progress[idStr] = { ...row, next_review: today, review_carry_date: today }
    changed = true
  }
  if (changed) saveSetProgress(reviewSet, progress)
}

export function getSetDueReviews(
  reviewSet: ReviewSet,
  questions: SetQuestion[],
): SetDueReview[] {
  rolloverIncompleteSetReviews(reviewSet)
  const today = todayISOChicago()
  const progress = getSetProgress(reviewSet)
  const due = questions
    .filter(q => {
      const p = progress[String(q.id)]
      return !!p?.solved && !!p.next_review && p.next_review <= today
    })
    .map(q => ({
      id: q.id,
      review_count: progress[String(q.id)]?.review_count ?? 0,
      next_review: progress[String(q.id)]?.next_review ?? today,
      carried: !!progress[String(q.id)]?.review_carry_date,
    }))
  const carried = due.filter(d => d.carried)
  const natural = due.filter(d => !d.carried)
  return [...carried, ...natural]
}

export function resolveQuestionForPractice(
  id: number,
  mainQuestions: PracticeQuestion[],
  reviewSet: ReviewSet | null,
  setQuestions: SetQuestion[],
): PracticeQuestion | null {
  const inMain = mainQuestions.find(q => q.id === id)
  if (inMain) return inMain

  const extra = ([...ncExtraQuestions, ...am600ExtraQuestions] as PracticeQuestion[]).find(q => q.id === id)
  if (extra) return extra

  if (!reviewSet) return null
  const sq = setQuestions.find(q => q.id === id)
  if (!sq) return null

  return {
    id: sq.id,
    title: sq.title,
    slug: sq.slug,
    difficulty: sq.difficulty,
    tags: sq.tags ?? [],
    source: [reviewSet === 2 ? 'NeetCode 250' : 'AlgoMaster 600'],
  }
}

export function getSetQProgressRow(reviewSet: ReviewSet, questionId: number): SetQProgress {
  const all = getSetProgress(reviewSet)
  return all[String(questionId)] ?? {
    solved: false,
    starred: false,
    review_count: 0,
    next_review: null,
    last_reviewed: null,
    notes: '',
    review_carry_date: null,
  }
}

export function completeSetReview(reviewSet: ReviewSet, questionId: number) {
  const row = getSetQProgressRow(reviewSet, questionId)
  const newCount = (row.review_count ?? 0) + 1
  const nextReview = nextReviewDate(newCount)
  updateSetQProgress(reviewSet, questionId, {
    review_count: newCount,
    next_review: nextReview,
    last_reviewed: todayISOChicago(),
    review_carry_date: null,
  })
  return { review_count: newCount, next_review: nextReview, error: null as string | null }
}

export function failSetReview(reviewSet: ReviewSet, questionId: number) {
  const nextReview = nextReviewDate(1)
  updateSetQProgress(reviewSet, questionId, {
    review_count: 0,
    next_review: nextReview,
    last_reviewed: todayISOChicago(),
    review_carry_date: null,
  })
  return { review_count: 0, next_review: nextReview, error: null as string | null }
}

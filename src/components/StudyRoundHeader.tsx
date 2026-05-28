/**
 * Visual divider shown between study-order rounds in list views.
 * Round 1 = High·Easy … Round 9 = Low·Hard
 */

const ROUND_NUM: Record<string, number> = {
  'High-Easy': 1, 'High-Medium': 2, 'High-Hard': 3,
  'Mid-Easy':  4, 'Mid-Medium':  5, 'Mid-Hard':  6,
  'Low-Easy':  7, 'Low-Medium':  8, 'Low-Hard':  9,
}

const PRI_STYLES: Record<string, { pill: string; line: string }> = {
  High: { pill: 'bg-red-50 text-red-700 border-red-200',     line: 'bg-red-200' },
  Mid:  { pill: 'bg-amber-50 text-amber-700 border-amber-200', line: 'bg-amber-200' },
  Low:  { pill: 'bg-gray-100 text-gray-500 border-gray-200',  line: 'bg-gray-200' },
}

const DIFF_DOT: Record<string, string> = {
  Easy: '🟢', Medium: '🟡', Hard: '🔴',
}

interface Props {
  priority: string
  difficulty: string
  className?: string
}

export default function StudyRoundHeader({ priority, difficulty, className = '' }: Props) {
  const round = ROUND_NUM[`${priority}-${difficulty}`]
  if (!round) return null
  const { pill, line } = PRI_STYLES[priority] ?? PRI_STYLES['Low']
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
      <div className={`h-px flex-1 rounded-full ${line}`} />
      <span className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${pill}`}>
        Round {round} · {priority} · {DIFF_DOT[difficulty]} {difficulty}
      </span>
      <div className={`h-px flex-1 rounded-full ${line}`} />
    </div>
  )
}

/**
 * Returns true when two consecutive questions in study order cross a round boundary.
 * Pass null/undefined for prevPriority/prevDifficulty for the very first item (always shows).
 */
export function isNewRound(
  curPriority: string | null | undefined,
  curDifficulty: string,
  prevPriority: string | null | undefined,
  prevDifficulty: string | null | undefined,
): boolean {
  if (!curPriority) return false
  return curPriority !== prevPriority || curDifficulty !== prevDifficulty
}

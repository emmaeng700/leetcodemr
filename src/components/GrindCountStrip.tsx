import type { GrindSummaryCounts } from '@/lib/grindList'

const DIFFS = ['Easy', 'Medium', 'Hard'] as const
const PRIOS = ['High', 'Mid', 'Low'] as const

const PRIO_COLOR: Record<string, string> = {
  High: 'text-red-600 dark:text-red-400',
  Mid: 'text-amber-600 dark:text-amber-400',
  Low: 'text-zinc-500 dark:text-zinc-400',
}

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-emerald-600 dark:text-emerald-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Hard: 'text-red-600 dark:text-red-400',
}

type Props = {
  counts: GrindSummaryCounts
  compact?: boolean
}

export default function GrindCountStrip({ counts, compact }: Props) {
  const topPatterns = Object.entries(counts.byPattern)
    .sort((a, b) => b[1] - a[1])
    .slice(0, compact ? 0 : 6)

  return (
    <div className="flex flex-col gap-1.5 text-[10px] text-[var(--text-subtle)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {DIFFS.map(d => (
          <span key={d}>
            <span className={`font-bold ${DIFF_COLOR[d] ?? ''}`}>{d}</span>
            {' '}
            <span className="tabular-nums font-mono">{counts.byDifficulty[d] ?? 0}</span>
          </span>
        ))}
        <span className="hidden sm:inline text-[var(--border)]">|</span>
        {PRIOS.map(p => (
          <span key={p}>
            <span className={`font-bold ${PRIO_COLOR[p] ?? ''}`}>{p}</span>
            {' '}
            <span className="tabular-nums font-mono">{counts.byPriority[p] ?? 0}</span>
          </span>
        ))}
        <span className="hidden sm:inline text-[var(--border)]">|</span>
        <span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">S1</span>
          {' '}
          <span className="tabular-nums font-mono">{counts.bySet[1]}</span>
        </span>
        <span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">S2</span>
          {' '}
          <span className="tabular-nums font-mono">{counts.bySet[2]}</span>
        </span>
        <span>
          <span className="font-bold text-purple-600 dark:text-purple-400">S3</span>
          {' '}
          <span className="tabular-nums font-mono">{counts.bySet[3]}</span>
        </span>
      </div>
      {!compact && topPatterns.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {topPatterns.map(([name, n]) => (
            <span key={name} className="truncate max-w-[10rem]" title={name}>
              <span className="text-[var(--text-muted)]">{name}</span>
              {' '}
              <span className="tabular-nums font-mono">{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

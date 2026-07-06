import type { GrindSummaryCounts } from '@/lib/grindList'

const DIFFS = ['Easy', 'Medium', 'Hard'] as const
const PRIOS = ['High', 'Mid', 'Low'] as const

const DIFF_CLASS: Record<string, string> = {
  Easy: 'text-[#a6e3a1]',
  Medium: 'text-[#f9e2af]',
  Hard: 'text-[#f38ba8]',
}

const PRIO_CLASS: Record<string, string> = {
  High: 'text-[#f38ba8]',
  Mid: 'text-[#fab387]',
  Low: 'text-[#6c7086]',
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
    <div className="grind-count-strip">
      <div className="grind-count-row">
        {DIFFS.map(d => (
          <span key={d}>
            <span className={`font-bold ${DIFF_CLASS[d] ?? ''}`}>{d}</span>
            {' '}
            <span className="grind-count-num">{counts.byDifficulty[d] ?? 0}</span>
          </span>
        ))}
        <span className="grind-count-sep">|</span>
        {PRIOS.map(p => (
          <span key={p}>
            <span className={`font-bold ${PRIO_CLASS[p] ?? ''}`}>{p}</span>
            {' '}
            <span className="grind-count-num">{counts.byPriority[p] ?? 0}</span>
          </span>
        ))}
        <span className="grind-count-sep">|</span>
        <span>
          <span className="font-bold text-[#89b4fa]">S1</span>
          {' '}
          <span className="grind-count-num">{counts.bySet[1]}</span>
        </span>
        <span>
          <span className="font-bold text-[#a6e3a1]">S2</span>
          {' '}
          <span className="grind-count-num">{counts.bySet[2]}</span>
        </span>
        <span>
          <span className="font-bold text-[#cba6f7]">S3</span>
          {' '}
          <span className="grind-count-num">{counts.bySet[3]}</span>
        </span>
      </div>
      {!compact && topPatterns.length > 0 && (
        <div className="grind-count-patterns">
          {topPatterns.map(([name, n]) => (
            <span key={name} className="truncate max-w-[9rem]" title={name}>
              <span className="text-[#a6adc8]">{name}</span>
              {' '}
              <span className="grind-count-num">{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

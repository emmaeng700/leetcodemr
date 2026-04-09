export default function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    Easy:   'bg-green-900/60 text-green-400 border border-green-500/30',
    Medium: 'bg-yellow-900/60 text-yellow-400 border border-yellow-500/30',
    Hard:   'bg-red-900/60 text-red-400 border border-red-500/30',
  }
  const cls = styles[difficulty] ?? 'bg-slate-700/60 text-slate-400 border border-white/10'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {difficulty}
    </span>
  )
}

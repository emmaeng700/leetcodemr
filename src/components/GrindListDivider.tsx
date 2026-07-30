import type { GrindListEntry } from '@/lib/grindList'

type DividerEntry = Extract<GrindListEntry, { type: 'divider' }>

const VARIANT_CLASS: Record<DividerEntry['variant'], string> = {
  set: 'grind-divider-set',
  tier: 'grind-divider-tier',
  section: 'grind-divider-sec',
  'lts-band': 'grind-divider-tier',
  'lts-section': 'grind-divider-sec',
}

export default function GrindListDivider({ entry }: { entry: DividerEntry }) {
  return (
    <div className={`grind-divider shrink-0 ${VARIANT_CLASS[entry.variant]}`}>
      <span className="truncate min-w-0">{entry.label}</span>
      <span className="grind-divider-count">{entry.count}</span>
    </div>
  )
}

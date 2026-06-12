'use client'

type Panel = 'content' | 'editor'

interface Props {
  panel: Panel
  onPanelChange: (panel: Panel) => void
  contentLabel?: string
  editorLabel?: string
}

export default function MobileSplitPanelTabs({
  panel,
  onPanelChange,
  contentLabel = 'Description',
  editorLabel = 'Editor',
}: Props) {
  return (
    <div className="flex md:hidden border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
      <button
        type="button"
        onClick={() => onPanelChange('content')}
        className={`flex-1 min-h-11 py-3 text-xs font-semibold border-b-2 transition-colors ${
          panel === 'content'
            ? 'border-indigo-500 text-indigo-600'
            : 'border-transparent text-[var(--text-subtle)]'
        }`}
      >
        {contentLabel}
      </button>
      <button
        type="button"
        onClick={() => onPanelChange('editor')}
        className={`flex-1 min-h-11 py-3 text-xs font-semibold border-b-2 transition-colors ${
          panel === 'editor'
            ? 'border-indigo-500 text-indigo-600'
            : 'border-transparent text-[var(--text-subtle)]'
        }`}
      >
        {editorLabel}
      </button>
    </div>
  )
}

export type MobileSplitPanel = Panel

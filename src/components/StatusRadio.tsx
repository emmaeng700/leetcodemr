'use client'

const STATUSES = [
  {
    key: 'learnt',
    label: 'Hard for me',
    desc: 'Still struggling',
    color: 'bg-blue-100 border-blue-400 text-blue-700',
    dot: 'bg-blue-500',
    active: 'ring-2 ring-blue-400',
  },
  {
    key: 'reviewed',
    label: 'Getting there',
    desc: 'Starting to click',
    color: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    dot: 'bg-yellow-500',
    active: 'ring-2 ring-yellow-400',
  },
  {
    key: 'revised',
    label: 'Easy for me',
    desc: 'Feeling confident',
    color: 'bg-orange-100 border-orange-400 text-orange-700',
    dot: 'bg-orange-500',
    active: 'ring-2 ring-orange-400',
  },
  {
    key: 'mastered',
    label: 'Mastered',
    desc: 'Solved from memory ✓',
    color: 'bg-green-100 border-green-400 text-green-700',
    dot: 'bg-green-500',
    active: 'ring-2 ring-green-400',
  },
]

interface StatusRadioProps {
  value: string | null
  onChange: (val: string | null) => void
}

export default function StatusRadio({ value, onChange }: StatusRadioProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map(s => {
        const selected = value === s.key
        return (
          <button
            key={s.key}
            onClick={() => onChange(selected ? null : s.key)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold
              transition-all cursor-pointer select-none
              ${selected ? `${s.color} ${s.active}` : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}
            `}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${selected ? s.dot : 'bg-gray-300'}`} />
            <span>{s.label}</span>
            {selected && <span className="opacity-60 font-normal hidden sm:inline">— {s.desc}</span>}
          </button>
        )
      })}
    </div>
  )
}

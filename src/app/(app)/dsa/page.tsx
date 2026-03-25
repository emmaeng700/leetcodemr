'use client'
import { useState } from 'react'
import { Code2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { DSA_CATEGORIES } from './data'

export default function DSAPage() {
  const [activeCategory, setActiveCategory] = useState<string>(DSA_CATEGORIES[0]?.name ?? '')
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [activeLang, setActiveLang] = useState<Record<string, string>>({})

  function toggleFlip(id: string) {
    setFlipped(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getLang(card: { id: string; snippets: { lang: string }[] }) {
    return activeLang[card.id] ?? card.snippets[0]?.lang ?? 'C++'
  }

  const totalCards = DSA_CATEGORIES.reduce((s, c) => s + c.cards.length, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Code2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">DSA Templates</h1>
          <p className="text-sm text-gray-500">{totalCards} templates across {DSA_CATEGORIES.length} topics · tap a card to see the code</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DSA_CATEGORIES.map(cat => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeCategory === cat.name
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            {cat.name}
            <span className="ml-1.5 opacity-60">{cat.cards.length}</span>
          </button>
        ))}
      </div>

      {/* Cards for active category */}
      {DSA_CATEGORIES.filter(c => c.name === activeCategory).map(cat => (
        <div key={cat.name}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-lg">{cat.name}</h2>
            {flipped.size > 0 && (
              <button
                onClick={() => setFlipped(new Set())}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <RotateCcw size={12} /> Flip all back
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {cat.cards.map(card => {
              const isFlipped = flipped.has(card.id)
              const lang = getLang(card)
              const snippet = card.snippets.find(s => s.lang === lang) ?? card.snippets[0]

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                    isFlipped
                      ? 'border-indigo-200 bg-gray-950'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                  }`}
                  onClick={() => toggleFlip(card.id)}
                >
                  {!isFlipped ? (
                    /* Front */
                    <div className="p-5 min-h-[110px] flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-snug">{card.title}</p>
                        {card.description && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{card.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-1">
                          {card.snippets.map(s => (
                            <span
                              key={s.lang}
                              className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium"
                            >
                              {s.lang}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">tap to see code →</span>
                      </div>
                    </div>
                  ) : (
                    /* Back */
                    <div onClick={e => e.stopPropagation()}>
                      {/* Language selector */}
                      {card.snippets.length > 1 && (
                        <div className="flex gap-1 px-4 pt-3">
                          {card.snippets.map(s => (
                            <button
                              key={s.lang}
                              onClick={() => setActiveLang(prev => ({ ...prev, [card.id]: s.lang }))}
                              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                                lang === s.lang
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              }`}
                            >
                              {s.lang}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Code block */}
                      <pre
                        className="p-4 text-green-300 font-mono overflow-x-auto leading-relaxed"
                        style={{ fontSize: '11px' }}
                      >
                        <code>{snippet?.code}</code>
                      </pre>

                      <div
                        className="px-4 pb-3 text-right cursor-pointer"
                        onClick={() => toggleFlip(card.id)}
                      >
                        <span className="text-xs text-gray-500 hover:text-gray-300">← flip back</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

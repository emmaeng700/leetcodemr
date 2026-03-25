'use client'
import { useState } from 'react'
import { Code2, ChevronDown, ChevronUp } from 'lucide-react'

interface DSACard {
  id: string
  category: string
  title: string
  content: string
  code?: string
  language?: string
}

interface Category {
  name: string
  cards: DSACard[]
}

// Content will be populated once sites are scraped
const CATEGORIES: Category[] = []

export default function DSAPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [flipped, setFlipped] = useState<Set<string>>(new Set())

  function toggleFlip(id: string) {
    setFlipped(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Code2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">DSA Reference</h1>
          <p className="text-sm text-gray-500">Data structures, algorithms & templates as flashcards</p>
        </div>
      </div>

      {CATEGORIES.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Code2 size={28} className="text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">Content coming soon</h2>
          <p className="text-gray-400 text-sm">DSA templates and reference cards will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {CATEGORIES.map(cat => (
            <div key={cat.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-bold text-gray-800">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">{cat.cards.length} cards</span>
                  {activeCategory === cat.name
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                  }
                </div>
              </button>

              {activeCategory === cat.name && (
                <div className="px-5 pb-5 grid gap-3 sm:grid-cols-2">
                  {cat.cards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => toggleFlip(card.id)}
                      className="cursor-pointer bg-gray-50 rounded-xl border border-gray-100 p-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors min-h-[100px]"
                    >
                      {flipped.has(card.id) ? (
                        <div>
                          {card.code ? (
                            <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-auto">
                              {card.code}
                            </pre>
                          ) : (
                            <p className="text-sm text-gray-700">{card.content}</p>
                          )}
                          <p className="text-xs text-indigo-400 mt-2 text-right">tap to flip back</p>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-between h-full">
                          <p className="font-semibold text-gray-800 text-sm">{card.title}</p>
                          <p className="text-xs text-gray-400 mt-2">tap to reveal</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

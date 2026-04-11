'use client'
import { useState } from 'react'
import { Code2, RotateCcw, BookOpen } from 'lucide-react'
import { DSA_CATEGORIES } from './data'
import { TUTORIAL_SECTIONS } from './tutorials-data'
import DsaCodeBlock from '@/components/DsaCodeBlock'

type Mode = 'templates' | 'tutorials'

export default function DSAPage() {
  const [mode, setMode] = useState<Mode>('templates')

  // --- Templates state ---
  const [activeCategory, setActiveCategory] = useState<string>(DSA_CATEGORIES[0]?.name ?? '')
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [activeLang, setActiveLang] = useState<Record<string, string>>({})

  // --- Tutorials state ---
  const [activeSection, setActiveSection] = useState<string>(TUTORIAL_SECTIONS[0]?.section ?? '')
  const [activeTutCat, setActiveTutCat] = useState<string>(
    TUTORIAL_SECTIONS[0]?.categories[0]?.name ?? ''
  )
  const [tutFlipped, setTutFlipped] = useState<Set<string>>(new Set())
  const [tutLang, setTutLang] = useState<Record<string, string>>({})

  function toggleFlip(id: string) {
    setFlipped(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTutFlip(id: string) {
    setTutFlipped(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getLang(card: { id: string; snippets: { lang: string }[] }) {
    return activeLang[card.id] ?? card.snippets[0]?.lang ?? 'C++'
  }

  function getTutLang(card: { id: string; snippets: { lang: string }[] }) {
    return tutLang[card.id] ?? card.snippets[0]?.lang ?? 'C++'
  }

  const totalCards = DSA_CATEGORIES.reduce((s, c) => s + c.cards.length, 0)
  const totalTutCards = TUTORIAL_SECTIONS.reduce(
    (s, sec) => s + sec.categories.reduce((cs, cat) => cs + cat.cards.length, 0),
    0
  )

  const currentSection = TUTORIAL_SECTIONS.find(s => s.section === activeSection)
  const currentTutCat = currentSection?.categories.find(c => c.name === activeTutCat)

  function handleSectionChange(section: string) {
    setActiveSection(section)
    const sec = TUTORIAL_SECTIONS.find(s => s.section === section)
    setActiveTutCat(sec?.categories[0]?.name ?? '')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Code2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">DSA Reference</h1>
          <p className="text-sm text-[var(--text-subtle)]">
            {totalCards} templates · {totalTutCards} tutorial cards · tap to see code
          </p>
        </div>
      </div>

      {/* Top-level mode switcher */}
      <div className="flex gap-2 mb-6 border-b border-[var(--border)] pb-0">
        <button
          onClick={() => setMode('templates')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
            mode === 'templates'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
              : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
          }`}
        >
          <Code2 size={14} />
          Templates
        </button>
        <button
          onClick={() => setMode('tutorials')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
            mode === 'tutorials'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
              : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
          }`}
        >
          <BookOpen size={14} />
          Tutorials
        </button>
      </div>

      {/* ===== TEMPLATES MODE ===== */}
      {mode === 'templates' && (
        <>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {DSA_CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeCategory === cat.name
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-indigo-50 hover:text-indigo-600'
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
                <h2 className="font-bold text-[var(--text)] text-lg">{cat.name}</h2>
                {flipped.size > 0 && (
                  <button
                    onClick={() => setFlipped(new Set())}
                    className="flex items-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
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
                          ? 'border-indigo-300 bg-[var(--bg-muted)] dark:bg-[#1e2130] hover:border-indigo-400'
                          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-indigo-300 hover:shadow-md'
                      }`}
                      onClick={() => toggleFlip(card.id)}
                    >
                      {!isFlipped ? (
                        <div className="p-4 sm:p-5 min-h-[80px] sm:min-h-[110px] flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-[var(--text)] text-sm leading-snug">{card.title}</p>
                            {card.description && (
                              <p className="text-xs text-[var(--text-subtle)] mt-1.5 leading-relaxed">{card.description}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex gap-1 flex-wrap">
                              {card.snippets.map(s => (
                                <span
                                  key={s.lang}
                                  className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium"
                                >
                                  {s.lang}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-[var(--text-subtle)]">tap to see code →</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Language selector + flip back */}
                          <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <div className="flex gap-1">
                              {card.snippets.map(s => (
                                <button
                                  key={s.lang}
                                  onClick={(e) => { e.stopPropagation(); setActiveLang(prev => ({ ...prev, [card.id]: s.lang })) }}
                                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                                    lang === s.lang
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-gray-600'
                                  }`}
                                >
                                  {s.lang}
                                </button>
                              ))}
                            </div>
                            <span className="text-xs text-[var(--text-subtle)]">click card to close ↩</span>
                          </div>

                          {snippet && <DsaCodeBlock code={snippet.code} lang={lang} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ===== TUTORIALS MODE ===== */}
      {mode === 'tutorials' && (
        <>
          {/* Section tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TUTORIAL_SECTIONS.map(sec => (
              <button
                key={sec.section}
                onClick={() => handleSectionChange(sec.section)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeSection === sec.section
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                {sec.section}
                <span className="ml-1.5 opacity-60">
                  {sec.categories.reduce((s, c) => s + c.cards.length, 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Category sub-tabs */}
          {currentSection && (
            <div className="flex flex-wrap gap-2 mb-6">
              {currentSection.categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setActiveTutCat(cat.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTutCat === cat.name
                      ? 'bg-violet-600 text-white'
                      : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] hover:bg-violet-50 hover:text-violet-600'
                  }`}
                >
                  {cat.name}
                  <span className="ml-1 opacity-60">{cat.cards.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Cards */}
          {currentTutCat && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[var(--text)] text-lg">{currentTutCat.name}</h2>
                {tutFlipped.size > 0 && (
                  <button
                    onClick={() => setTutFlipped(new Set())}
                    className="flex items-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
                  >
                    <RotateCcw size={12} /> Flip all back
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {currentTutCat.cards.map(card => {
                  const isFlipped = tutFlipped.has(card.id)
                  const lang = getTutLang(card)
                  const snippet = card.snippets.find(s => s.lang === lang) ?? card.snippets[0]

                  return (
                    <div
                      key={card.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                        isFlipped
                          ? 'border-violet-300 bg-[var(--bg-muted)] dark:bg-[#1e2130] hover:border-violet-400'
                          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-violet-300 hover:shadow-md'
                      }`}
                      onClick={() => toggleTutFlip(card.id)}
                    >
                      {!isFlipped ? (
                        <div className="p-4 sm:p-5 min-h-[80px] sm:min-h-[120px] flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-[var(--text)] text-sm leading-snug">{card.title}</p>
                            <p className="text-xs text-[var(--text-subtle)] mt-1.5 leading-relaxed">{card.description}</p>
                            {card.complexity && (
                              <p className="text-xs text-violet-600 font-medium mt-2">{card.complexity}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex gap-1 flex-wrap">
                              {card.snippets.map(s => (
                                <span
                                  key={s.lang}
                                  className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium"
                                >
                                  {s.lang}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-[var(--text-subtle)]">tap to see code →</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Language selector + flip back */}
                          <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <div className="flex gap-1">
                              {card.snippets.map(s => (
                                <button
                                  key={s.lang}
                                  onClick={(e) => { e.stopPropagation(); setTutLang(prev => ({ ...prev, [card.id]: s.lang })) }}
                                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                                    lang === s.lang
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-gray-600'
                                  }`}
                                >
                                  {s.lang}
                                </button>
                              ))}
                            </div>
                            <span className="text-xs text-[var(--text-subtle)]">click card to close ↩</span>
                          </div>

                          {snippet && <DsaCodeBlock code={snippet.code} lang={lang} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

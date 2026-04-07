'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpen, Menu, X, LogOut, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2, Zap, Gauge, Gamepad2, RefreshCw,
} from 'lucide-react'

// Group 1a — Study-oriented links (shown left of the | separator)
// `also` = extra path prefixes that should also light up this link
const STUDY_LINKS = [
  { href: '/',        label: 'Questions', icon: Home,     also: ['/practice', '/question'] },
  { href: '/daily',   label: 'Daily',     icon: Calendar },
  { href: '/sr-queue', label: 'SR Queue', icon: RefreshCw },
  { href: '/review',  label: 'Reviews',  icon: Brain },
  { href: '/learn/0', label: 'Learn', icon: BookOpen },
]

// Group 1b — Speed / drill links (shown right of the | separator)
const DRILL_LINKS = [
  { href: '/speedster',    label: 'Speedster', icon: Gauge },
  { href: '/line-game',    label: 'Game',      icon: Gamepad2 },
  { href: '/mock',         label: 'Mock',      icon: Timer },
  { href: '/leetcode-api', label: 'LeetCode',  icon: Zap },
  { href: '/patterns',     label: 'Patterns',  icon: GitBranch },
]

// Combined for NAV_LINKS (active detection still works per-link)
const PRACTICE_LINKS = [...STUDY_LINKS, ...DRILL_LINKS]

// Group 2 — Flashcard-based study
const FLASHCARD_LINKS = [
  { href: '/flashcards',   label: 'Flashcards',   icon: Layers },
  { href: '/quick-review', label: 'Quick Review', icon: Clock },
]

// Group 3 — Deep-dive topics
const TOPIC_LINKS = [
  { href: '/behavioral',    label: 'Behavioral',   icon: MessageSquare },
  { href: '/system-design', label: 'System Design',icon: Server },
]

// Group 4 — Meta
const META_LINKS = [
  { href: '/gems',  label: 'Gems', icon: Gem },
  { href: '/dsa',   label: 'DSA',  icon: Code2 },
  { href: '/stats',  label: 'Stats',   icon: BarChart2 },
  { href: '/about',  label: 'About',   icon: Info },
]

const NAV_LINKS = [...PRACTICE_LINKS, ...FLASHCARD_LINKS, ...TOPIC_LINKS, ...META_LINKS]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top row: logo + logout/hamburger */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-black text-indigo-600 text-lg shrink-0">
            <BookOpen size={22} />
            <span>LeetMastery</span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex flex-wrap items-center gap-1 pb-2">
          {[STUDY_LINKS, DRILL_LINKS, FLASHCARD_LINKS, TOPIC_LINKS, META_LINKS].map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <span className="w-px h-4 bg-gray-200 mx-1 shrink-0" />}
              {group.map(({ href, label, also }: { href: string; label: string; icon: React.ElementType; also?: string[] }) => {
                const base = href === '/' ? '/' : '/' + href.split('/')[1]
                const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                  || (also ?? []).some(p => pathname.startsWith(p))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Mobile menu + dim backdrop (tap outside closes) */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-40 bg-black/25"
            onClick={() => setOpen(false)}
          />
          <div className="md:hidden absolute top-full left-0 right-0 z-50 border-t border-gray-100 bg-white shadow-xl px-4 py-3 space-y-1 max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {[
            { label: 'Study',      group: STUDY_LINKS },
            { label: 'Drill',      group: DRILL_LINKS },
            { label: 'Flashcards', group: FLASHCARD_LINKS },
            { label: 'Topics',     group: TOPIC_LINKS },
            { label: 'More',       group: META_LINKS },
          ].map(({ label, group }, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="h-px bg-gray-100 my-2" />}
              <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
              {group.map(({ href, label: lnk, icon: Icon, also }: { href: string; label: string; icon: React.ElementType; also?: string[] }) => {
                const base = href === '/' ? '/' : '/' + href.split('/')[1]
                const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                  || (also ?? []).some(p => pathname.startsWith(p))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} />
                    {lnk}
                  </Link>
                )
              })}
            </React.Fragment>
          ))}
          <div className="h-px bg-gray-100 my-2" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
        </>
      )}
    </nav>
  )
}

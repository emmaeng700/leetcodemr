'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  BookOpen, Menu, X, LogOut, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2, Zap, Gauge, Gamepad2, RefreshCw, Library,
  Sun, Moon,
} from 'lucide-react'

const STUDY_LINKS = [
  { href: '/',        label: 'Questions', icon: Home,     also: ['/practice', '/question'] },
  { href: '/daily',   label: 'Daily',     icon: Calendar },
  { href: '/speedster', label: 'Speedster', icon: Gauge },
  { href: '/learn/0', label: 'Learn', icon: BookOpen },
  { href: '/leetcode-api', label: 'LeetCode',  icon: Zap },
  { href: '/answers',     label: 'Answers',   icon: Library },
]
const DRILL_LINKS = [
  { href: '/line-game',    label: 'Game',      icon: Gamepad2 },
  { href: '/mock',         label: 'Mock',      icon: Timer },
  { href: '/patterns',     label: 'Patterns',  icon: GitBranch },
]
const PRACTICE_LINKS = [...STUDY_LINKS, ...DRILL_LINKS]
const FLASHCARD_LINKS = [
  { href: '/flashcards',   label: 'Flashcards',   icon: Layers },
  { href: '/quick-review', label: 'Quick Review', icon: Clock },
]
const TOPIC_LINKS = [
  { href: '/behavioral',    label: 'Behavioral',   icon: MessageSquare },
  { href: '/system-design', label: 'System Design',icon: Server },
  { href: '/gems',  label: 'Gems', icon: Gem },
  { href: '/dsa',   label: 'DSA',  icon: Code2 },
]
const META_LINKS = [
  { href: '/sr-queue', label: 'SR Queue', icon: RefreshCw },
  { href: '/review',  label: 'Reviews',  icon: Brain },
  { href: '/stats',  label: 'Stats',   icon: BarChart2 },
  { href: '/about',  label: 'About',   icon: Info },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-md border-b border-[var(--border)] shadow-[var(--shadow)]">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top row */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-black text-indigo-500 text-lg shrink-0 tracking-tight">
            <BookOpen size={22} />
            <span>LeetMastery</span>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg transition-colors"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex flex-wrap items-center gap-1 pb-2">
          {[STUDY_LINKS, DRILL_LINKS, FLASHCARD_LINKS, TOPIC_LINKS, META_LINKS].map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <span className="w-px h-4 bg-[var(--border)] mx-1 shrink-0" />}
              {group.map(({ href, label, also }: { href: string; label: string; icon: React.ElementType; also?: string[] }) => {
                const base = href === '/' ? '/' : '/' + href.split('/')[1]
                const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                  || (also ?? []).some(p => pathname.startsWith(p))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-indigo-600 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.4)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]'
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

      {/* Mobile menu */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-40 bg-black/25"
            onClick={() => setOpen(false)}
          />
          <div className="md:hidden absolute top-full left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-card)] shadow-2xl px-4 py-3 space-y-1 max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {[
              { label: 'Study',      group: STUDY_LINKS },
              { label: 'Drill',      group: DRILL_LINKS },
              { label: 'Flashcards', group: FLASHCARD_LINKS },
              { label: 'Topics',     group: TOPIC_LINKS },
              { label: 'More',       group: META_LINKS },
            ].map(({ label, group }, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="h-px bg-[var(--border)] my-2" />}
                <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-widest">{label}</p>
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
                        active
                          ? 'bg-indigo-600/15 text-indigo-500 font-semibold'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      <Icon size={16} />
                      {lnk}
                    </Link>
                  )
                })}
              </React.Fragment>
            ))}
            <div className="h-px bg-[var(--border)] my-2" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 w-full transition-colors"
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

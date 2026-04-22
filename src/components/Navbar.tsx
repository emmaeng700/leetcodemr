'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getOpenQuestionContext } from '@/lib/openQuestionContext'
import {
  Menu, X, LogOut, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2, Zap, Gauge, Gamepad2, RefreshCw, Library,
  BookOpen, Swords,
} from 'lucide-react'

const STUDY_LINKS = [
  { href: '/',        label: 'Questions', icon: Home,     also: ['/practice', '/question'] },
  { href: '/daily',       label: 'Daily',       icon: Calendar },
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
  { href: '/pileup', label: 'Pileup', icon: Layers },
  { href: '/stats',  label: 'Stats',   icon: BarChart2 },
  { href: '/about',  label: 'About',   icon: Info },
]

const MOBILE_SECTIONS = [
  { emoji: '⚔️', label: 'Study',      group: STUDY_LINKS },
  { emoji: '🎯', label: 'Drill',      group: DRILL_LINKS },
  { emoji: '🃏', label: 'Flashcards', group: FLASHCARD_LINKS },
  { emoji: '📚', label: 'Topics',     group: TOPIC_LINKS },
  { emoji: '⚙️', label: 'More',       group: META_LINKS },
]

function buildAnswersNavHref(): string {
  const ctx = getOpenQuestionContext()
  if (!ctx) return '/answers'
  const t = ctx.title ? `&title=${encodeURIComponent(ctx.title)}` : ''
  return `/answers?id=${ctx.id}&slug=${encodeURIComponent(ctx.slug)}${t}`
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [answersNavHref, setAnswersNavHref] = useState('/answers')
  const build = process.env.NEXT_PUBLIC_COMMIT_SHA

  useEffect(() => {
    setAnswersNavHref(buildAnswersNavHref())
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-card)]/96 backdrop-blur-xl border-b border-[var(--border)] shadow-[0_2px_24px_rgba(0,0,0,0.07),0_0_0_0.5px_rgba(176,136,72,0.18)]">
      <div className="max-w-7xl mx-auto px-4">

        {/* ── Top row ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.4)] group-hover:shadow-[0_4px_14px_rgba(99,102,241,0.55)] transition-shadow duration-200">
              <Swords size={16} className="text-white" />
            </div>
            <span className="font-black text-[1.1rem] tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 bg-clip-text text-transparent select-none">
              LeetMastery
            </span>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            {/* Build stamp */}
            {build && (
              <span className="hidden sm:inline text-[10px] font-mono text-[var(--text-subtle)] mr-2 select-none bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                {build}
              </span>
            )}
            {/* Desktop logout */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-subtle)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-150"
            >
              <LogOut size={14} />
              <span className="font-medium">Logout</span>
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] rounded-xl transition-colors"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ── Desktop Nav ────────────────────────────────────────── */}
        <div className="hidden md:flex flex-wrap items-center gap-1 pb-2.5">
          {[STUDY_LINKS, DRILL_LINKS, FLASHCARD_LINKS, TOPIC_LINKS, META_LINKS].map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && (
                <span className="w-px h-4 mx-1.5 shrink-0 rounded-full" style={{ background: 'var(--border)' }} />
              )}
              {group.map(({ href, label, also }: { href: string; label: string; icon: React.ElementType; also?: string[] }) => {
                const base = href === '/' ? '/' : '/' + href.split('/')[1]
                const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                  || (also ?? []).some(p => pathname.startsWith(p))
                return (
                  <Link
                    key={href}
                    href={href === '/answers' ? answersNavHref : href}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-[0_2px_10px_rgba(99,102,241,0.45),0_0_0_1px_rgba(124,58,237,0.4)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] hover:shadow-sm'
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

      {/* ── Mobile menu ────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel */}
          <div className="md:hidden absolute top-full left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_40px_rgba(0,0,0,0.14)] px-4 py-3 space-y-1 max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">

            {MOBILE_SECTIONS.map(({ emoji, label, group }, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && (
                  <div className="h-px my-2 rounded-full" style={{ background: 'var(--border)' }} />
                )}

                {/* Section header */}
                <div className="flex items-center gap-2 px-3 pt-1 pb-0.5">
                  <span className="text-base leading-none">{emoji}</span>
                  <p className="text-[10px] font-black text-[var(--text-subtle)] uppercase tracking-widest">{label}</p>
                </div>

                {group.map(({ href, label: lnk, icon: Icon, also }: { href: string; label: string; icon: React.ElementType; also?: string[] }) => {
                  const base = href === '/' ? '/' : '/' + href.split('/')[1]
                  const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                    || (also ?? []).some(p => pathname.startsWith(p))
                  return (
                    <Link
                      key={href}
                      href={href === '/answers' ? answersNavHref : href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-indigo-600 text-white shadow-[0_2px_6px_rgba(99,102,241,0.4)]'
                          : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'
                      }`}>
                        <Icon size={14} />
                      </div>
                      {lnk}
                    </Link>
                  )
                })}
              </React.Fragment>
            ))}

            {/* Logout */}
            <div className="h-px my-2 rounded-full" style={{ background: 'var(--border)' }} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 w-full transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={14} className="text-red-500" />
              </div>
              Logout
            </button>
          </div>
        </>
      )}
    </nav>
  )
}

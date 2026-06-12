'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { getOpenQuestionContext } from '@/lib/openQuestionContext'
import {
  Menu, X, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2, Zap, Gamepad2, RefreshCw, Library,
  BookOpen, Swords, Rocket, Download, Bookmark, ClipboardList, Settings, Check,
  ChevronDown,
} from 'lucide-react'
import { isMcpSectionPath, mcpTabUrl, type McpTab } from '@/lib/mcpNav'
import {
  activeLearnSetFromPath,
  isLearnSectionPath,
  learnHubHref,
  learnSetLabel,
  type LearnSet,
} from '@/lib/learnNav'

type NavLink = { href: string; label: string; icon: React.ElementType; also?: string[] }

// ── Starred (core daily-use pages) ───────────────────────────────────────────
const STARRED_LINKS: NavLink[] = [
  { href: '/daily',  label: '★ Daily',   icon: Calendar },
  { href: '/review', label: '★ Reviews', icon: Brain,    also: ['/quick-review', '/sr-queue', '/pattern-review', '/best-solutions'] },
]

const LEARN_CHILDREN: LearnSet[] = [1, 2, 3]

// ── Secondary (practice & reference) ─────────────────────────────────────────
const STUDY_LINKS: NavLink[] = [
  { href: '/',          label: 'Questions', icon: Home, also: ['/practice', '/question'] },
]
const MCP_CHILDREN: { tab: McpTab; label: string; icon: React.ElementType }[] = [
  { tab: 'mock',      label: 'Mock',      icon: Timer },
  { tab: 'patterns',  label: 'Patterns',  icon: GitBranch },
  { tab: 'clipboard', label: 'Clipboard', icon: ClipboardList },
]

const DRILL_LINKS: NavLink[] = [
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/cycles',     label: 'Cycles',     icon: RefreshCw },
]
const PRACTICE_LINKS = [...STUDY_LINKS, ...DRILL_LINKS]

const SITES_LINKS: NavLink[] = [
  { href: '/sites', label: 'Sites', icon: Zap, also: ['/neetcode', '/leetcode-api', '/answers'] },
]

// Behavioral, System Design, Gems, DSA → merged under /resources
const TOPIC_LINKS: NavLink[] = [
  { href: '/resources', label: 'Resources', icon: Server, also: ['/behavioral', '/system-design', '/gems', '/dsa', '/downloads'] },
]
const META_LINKS: NavLink[] = [
  { href: '/stats',    label: 'Stats',    icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const MOBILE_SECTIONS = [
  { emoji: '⭐', label: 'Core',      group: STARRED_LINKS },
  { emoji: '📖', label: 'Practice',  group: STUDY_LINKS },
  { emoji: '🎯', label: 'Tools',     group: DRILL_LINKS },
  { emoji: '🌐', label: 'Sites',     group: SITES_LINKS  },
  { emoji: '📚', label: 'Resources', group: TOPIC_LINKS },
  { emoji: '⚙️', label: 'More',     group: META_LINKS },
]

function buildAnswersNavHref(): string {
  const ctx = getOpenQuestionContext()
  if (!ctx) return '/answers'
  const t = ctx.title ? `&title=${encodeURIComponent(ctx.title)}` : ''
  return `/answers?id=${ctx.id}&slug=${encodeURIComponent(ctx.slug)}${t}`
}

function navLinkClass(active: boolean) {
  return `px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
    active
      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-[0_2px_10px_rgba(99,102,241,0.45),0_0_0_1px_rgba(124,58,237,0.4)]'
      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] hover:shadow-sm'
  }`
}

function LearnNavDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)
  const learnActive = isLearnSectionPath(pathname)
  const activeSet = activeLearnSetFromPath(pathname)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href={learnHubHref(1)} className={`${navLinkClass(learnActive)} inline-flex items-center gap-1`}>
        ★ Learn
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </Link>
      {open && (
        <div className="absolute top-full left-0 pt-1.5 z-[110] min-w-[9rem]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 overflow-hidden">
            {LEARN_CHILDREN.map(set => {
              const childActive = learnActive && activeSet === set
              return (
                <Link
                  key={set}
                  href={learnHubHref(set)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                    childActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <BookOpen size={14} className="shrink-0" />
                  {learnSetLabel(set)}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function McpNavDropdown({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const mcpActive = isMcpSectionPath(pathname)
  const activeTab = pathname.startsWith('/mcp')
    ? (searchParams.get('tab') as McpTab | null)
    : null

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href="/mcp" className={`${navLinkClass(mcpActive)} inline-flex items-center gap-1`}>
        MCP
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </Link>
      {open && (
        <div className="absolute top-full left-0 pt-1.5 z-[110] min-w-[11rem]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 overflow-hidden">
            {MCP_CHILDREN.map(({ tab, label, icon: Icon }) => {
              const childActive = mcpActive && (activeTab === tab || (!activeTab && tab === 'mock' && pathname === '/mcp'))
              return (
                <Link
                  key={tab}
                  href={mcpTabUrl(tab)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                    childActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [answersNavHref, setAnswersNavHref] = useState('/answers')
  const build = process.env.NEXT_PUBLIC_COMMIT_SHA
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate'>('idle')

  useEffect(() => {
    setAnswersNavHref(buildAnswersNavHref())
  }, [pathname])

  const checkForUpdate = useCallback(async () => {
    setUpdateStatus('checking')
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.filter(k => k !== 'lm-images').map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        void reg?.update()
      }
      window.location.href = window.location.href
    } catch {
      setUpdateStatus('idle')
    }
  }, [])

  return (
    <nav className="sticky top-0 z-[90] bg-[var(--bg-card)]/96 backdrop-blur-xl border-b border-[var(--border)] shadow-[0_2px_24px_rgba(0,0,0,0.07),0_0_0_0.5px_rgba(176,136,72,0.18)]">
      <div className="max-w-7xl mx-auto px-4">

        {/* ── Top row ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/daily" className="flex items-center gap-2.5 shrink-0 group">
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
              <span className="hidden sm:inline text-[10px] font-mono text-[var(--text-subtle)] mr-1 select-none bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                {build}
              </span>
            )}
            {/* Get Latest Version */}
            <button
              type="button"
              onClick={checkForUpdate}
              disabled={updateStatus === 'checking'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                updateStatus === 'uptodate'
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              {updateStatus === 'checking' ? (
                <><RefreshCw size={11} className="animate-spin" /><span className="hidden sm:inline">Updating…</span></>
              ) : updateStatus === 'uptodate' ? (
                <><Check size={11} /><span className="hidden sm:inline">Up to date</span></>
              ) : (
                <><RefreshCw size={11} /><span className="hidden sm:inline">Get Latest</span></>
              )}
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
          {[
            { key: 'starred', links: STARRED_LINKS },
            { key: 'study', links: STUDY_LINKS },
            { key: 'drill', links: DRILL_LINKS },
            { key: 'sites', links: SITES_LINKS },
            { key: 'topics', links: TOPIC_LINKS },
            { key: 'meta', links: META_LINKS },
          ].map((section, gi) => (
            <React.Fragment key={section.key}>
              {gi > 0 && (
                <span className="w-px h-4 mx-1.5 shrink-0 rounded-full" style={{ background: 'var(--border)' }} />
              )}
              {section.key === 'starred' && (
                <>
                  {section.links.map(({ href, label, also }) => {
                    const base = href === '/' ? '/' : '/' + href.split('/')[1]
                    const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                      || (also ?? []).some(p => pathname.startsWith(p))
                    return (
                      <Link key={href} href={href} className={navLinkClass(active)}>{label}</Link>
                    )
                  })}
                  <LearnNavDropdown pathname={pathname} />
                </>
              )}
              {section.key === 'drill' && (
                <>
                  {section.links.slice(0, 2).map(({ href, label }) => {
                    const base = '/' + href.split('/')[1]
                    const active = pathname.startsWith(base)
                    return (
                      <Link key={href} href={href} className={navLinkClass(active)}>{label}</Link>
                    )
                  })}
                  <McpNavDropdown pathname={pathname} />
                  {section.links.slice(2).map(({ href, label }) => {
                    const base = '/' + href.split('/')[1]
                    const active = pathname.startsWith(base)
                    return (
                      <Link key={href} href={href} className={navLinkClass(active)}>{label}</Link>
                    )
                  })}
                </>
              )}
              {section.key !== 'drill' && section.key !== 'starred' && section.links.map(({ href, label, also }) => {
                const base = href === '/' ? '/' : '/' + href.split('/')[1]
                const active = (href === '/' ? pathname === '/' : pathname.startsWith(base))
                  || (also ?? []).some(p => pathname.startsWith(p))
                return (
                  <Link
                    key={href}
                    href={href === '/answers' ? answersNavHref : href}
                    className={navLinkClass(active)}
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
            className="md:hidden fixed inset-0 z-[95] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel */}
          <div className="md:hidden absolute top-full left-0 right-0 z-[100] border-t border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_40px_rgba(0,0,0,0.14)] px-4 py-3 space-y-1 max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">

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

                {group === STARRED_LINKS && (
                  <>
                    {group.map(({ href, label: lnk, icon: Icon, also }) => {
                      const base = '/' + href.split('/')[1]
                      const active = pathname.startsWith(base) || (also ?? []).some(p => pathname.startsWith(p))
                      return (
                        <Link key={href} href={href} onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                            active ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60' : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
                            <Icon size={14} />
                          </div>
                          {lnk}
                        </Link>
                      )
                    })}
                    <Link href={learnHubHref(1)} onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isLearnSectionPath(pathname) ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60' : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                      }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isLearnSectionPath(pathname) ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
                        <BookOpen size={14} />
                      </div>
                      ★ Learn
                    </Link>
                    {LEARN_CHILDREN.map(set => (
                      <Link key={set} href={learnHubHref(set)} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 pl-8 pr-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]">
                        <BookOpen size={13} className="shrink-0 text-[var(--text-subtle)]" />
                        {learnSetLabel(set)}
                      </Link>
                    ))}
                  </>
                )}
                {group === DRILL_LINKS && (
                  <>
                    {group.slice(0, 2).map(({ href, label: lnk, icon: Icon }) => {
                      const base = '/' + href.split('/')[1]
                      const active = pathname.startsWith(base)
                      return (
                        <Link key={href} href={href} onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                            active ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60' : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
                            <Icon size={14} />
                          </div>
                          {lnk}
                        </Link>
                      )
                    })}
                    <Link href="/mcp" onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isMcpSectionPath(pathname) ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60' : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                      }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isMcpSectionPath(pathname) ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
                        <Timer size={14} />
                      </div>
                      MCP
                    </Link>
                    {MCP_CHILDREN.map(({ tab, label, icon: Icon }) => (
                      <Link key={tab} href={mcpTabUrl(tab)} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 pl-8 pr-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]">
                        <Icon size={13} className="shrink-0 text-[var(--text-subtle)]" />
                        {label}
                      </Link>
                    ))}
                    {group.slice(2).map(({ href, label: lnk, icon: Icon }) => {
                      const base = '/' + href.split('/')[1]
                      const active = pathname.startsWith(base)
                      return (
                        <Link key={href} href={href} onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                            active ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60' : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
                            <Icon size={14} />
                          </div>
                          {lnk}
                        </Link>
                      )
                    })}
                  </>
                )}
                {group !== DRILL_LINKS && group !== STARRED_LINKS && group.map(({ href, label: lnk, icon: Icon, also }) => {
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

          </div>
        </>
      )}
    </nav>
  )
}

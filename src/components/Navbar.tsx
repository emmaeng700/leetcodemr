'use client'
import React, { useState, useCallback, useSyncExternalStore } from 'react'
import AppNavLink from '@/components/AppNavLink'
import { usePathname, useSearchParams } from 'next/navigation'
import { getOpenQuestionContext } from '@/lib/openQuestionContext'
import { grindHrefForLastQuestion } from '@/lib/grindStorage'
import {
  Menu, X, Home, BarChart2, Brain,
  Layers, GitBranch, Server, Clock,
  Calendar, Code2, Zap, RefreshCw,
  BookOpen, Swords, Settings, Check,
  ChevronDown, ClipboardList, MoreHorizontal,
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

const MAIN_LINKS: NavLink[] = [
  { href: '/grind', label: 'Grind', icon: Code2 },
  { href: '/leetcode', label: 'LeetCode', icon: Zap },
  { href: '/daily', label: 'Daily', icon: Calendar },
  { href: '/review', label: 'Reviews', icon: Brain, also: ['/quick-review', '/sr-queue', '/pattern-review', '/best-solutions'] },
]

const LEARN_CHILDREN: LearnSet[] = [1, 2, 3]

const MCP_CHILDREN: { tab: McpTab; label: string; icon: React.ElementType }[] = [
  { tab: 'mock', label: 'Mock', icon: Clock },
  { tab: 'patterns', label: 'Patterns', icon: GitBranch },
  { tab: 'clipboard', label: 'Clipboard', icon: ClipboardList },
]

const EXTRA_STUDY_LINKS: NavLink[] = [
  { href: '/questions', label: 'Questions', icon: Home, also: ['/practice', '/question'] },
]

const EXTRA_DRILL_LINKS: NavLink[] = [
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/cycles', label: 'Cycles', icon: RefreshCw },
]

const EXTRA_MORE_LINKS: NavLink[] = [
  { href: '/sites', label: 'Sites', icon: Zap, also: ['/neetcode', '/leetcode-api', '/answers'] },
  { href: '/resources', label: 'Resources', icon: Server, also: ['/behavioral', '/system-design', '/gems', '/dsa', '/downloads'] },
  { href: '/stats', label: 'Stats', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const EXTRA_PATH_PREFIXES = [
  '/learn', '/learn2', '/learn3',
  '/questions', '/practice', '/question',
  '/flashcards', '/cycles', '/mcp', '/mock', '/patterns', '/clipboard',
  '/sites', '/neetcode', '/leetcode-api', '/answers',
  '/resources', '/behavioral', '/system-design', '/gems', '/dsa', '/downloads',
  '/stats', '/settings',
]

function buildAnswersNavHref(): string {
  const ctx = getOpenQuestionContext()
  if (!ctx) return '/answers'
  const t = ctx.title ? `&title=${encodeURIComponent(ctx.title)}` : ''
  return `/answers?id=${ctx.id}&slug=${encodeURIComponent(ctx.slug)}${t}`
}

function resolveNavHref(href: string, grindNavHref: string, answersNavHref: string): string {
  if (href === '/grind') return grindNavHref
  if (href === '/answers') return answersNavHref
  return href
}

function linkActive(pathname: string, href: string, also?: string[]): boolean {
  const base = href === '/' ? '/' : '/' + href.split('/')[1]
  return (href === '/' ? pathname === '/' : pathname.startsWith(base))
    || (also ?? []).some(p => pathname.startsWith(p))
}

function isMainSectionPath(pathname: string): boolean {
  return MAIN_LINKS.some(l => linkActive(pathname, l.href, l.also))
}

function isExtraSectionPath(pathname: string): boolean {
  if (isMainSectionPath(pathname) || pathname === '/') return false
  return EXTRA_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function navLinkClass(active: boolean) {
  return `px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
    active
      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-[0_2px_10px_rgba(99,102,241,0.45),0_0_0_1px_rgba(124,58,237,0.4)]'
      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] hover:shadow-sm'
  }`
}

function dropdownLinkClass(active: boolean) {
  return `flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-50 text-indigo-600'
      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
  }`
}

function MainNavDropdown({
  pathname,
  grindNavHref,
  answersNavHref,
}: {
  pathname: string
  grindNavHref: string
  answersNavHref: string
}) {
  const [open, setOpen] = useState(false)
  const mainActive = isMainSectionPath(pathname)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`${navLinkClass(mainActive)} inline-flex items-center gap-1`}
        aria-expanded={open}
      >
        <Swords size={14} className="shrink-0" />
        Main
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-1.5 z-[110] min-w-[11rem]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 overflow-hidden">
            {MAIN_LINKS.map(link => {
              const active = linkActive(pathname, link.href, link.also)
              const Icon = link.icon
              return (
                <AppNavLink
                  key={link.href}
                  href={resolveNavHref(link.href, grindNavHref, answersNavHref)}
                  className={dropdownLinkClass(active)}
                >
                  <Icon size={14} className="shrink-0" />
                  {link.label}
                </AppNavLink>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ExtraNavDropdown({
  pathname,
  grindNavHref,
  answersNavHref,
}: {
  pathname: string
  grindNavHref: string
  answersNavHref: string
}) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const extraActive = isExtraSectionPath(pathname)
  const learnActive = isLearnSectionPath(pathname)
  const activeSet = activeLearnSetFromPath(pathname)
  const mcpActive = isMcpSectionPath(pathname)
  const activeTab = pathname.startsWith('/mcp') ? (searchParams.get('tab') as McpTab | null) : null

  const renderLink = (link: NavLink) => {
    const active = linkActive(pathname, link.href, link.also)
    const Icon = link.icon
    return (
      <AppNavLink
        key={link.href}
        href={resolveNavHref(link.href, grindNavHref, answersNavHref)}
        className={dropdownLinkClass(active)}
      >
        <Icon size={14} className="shrink-0" />
        {link.label}
      </AppNavLink>
    )
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`${navLinkClass(extraActive)} inline-flex items-center gap-1`}
        aria-expanded={open}
      >
        <MoreHorizontal size={14} className="shrink-0" />
        Extra
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-1.5 z-[110] min-w-[12rem]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 overflow-hidden max-h-[min(70vh,28rem)] overflow-y-auto">
            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-[var(--text-subtle)] uppercase tracking-widest">Study</p>
            {EXTRA_STUDY_LINKS.map(renderLink)}
            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-[var(--text-subtle)] uppercase tracking-widest">Learn</p>
            {LEARN_CHILDREN.map(set => (
              <AppNavLink
                key={set}
                href={learnHubHref(set)}
                className={dropdownLinkClass(learnActive && activeSet === set)}
              >
                <BookOpen size={14} className="shrink-0" />
                {learnSetLabel(set)}
              </AppNavLink>
            ))}
            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-[var(--text-subtle)] uppercase tracking-widest">Tools</p>
            {EXTRA_DRILL_LINKS.map(renderLink)}
            <AppNavLink href="/mcp" className={dropdownLinkClass(mcpActive && !activeTab)}>
              <Clock size={14} className="shrink-0" />
              MCP
            </AppNavLink>
            {MCP_CHILDREN.map(({ tab, label, icon: Icon }) => (
              <AppNavLink
                key={tab}
                href={mcpTabUrl(tab)}
                className={`${dropdownLinkClass(mcpActive && (activeTab === tab || (!activeTab && tab === 'mock' && pathname === '/mcp')))} pl-8`}
              >
                <Icon size={13} className="shrink-0" />
                {label}
              </AppNavLink>
            ))}
            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-[var(--text-subtle)] uppercase tracking-widest">More</p>
            {EXTRA_MORE_LINKS.map(renderLink)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  if (pathname === '/grind' || pathname.startsWith('/grind/')) return null
  const [open, setOpen] = useState(false)
  const grindNavHref = useSyncExternalStore(
    () => () => {},
    grindHrefForLastQuestion,
    () => '/grind',
  )
  const answersNavHref = useSyncExternalStore(
    () => () => {},
    buildAnswersNavHref,
    () => '/answers',
  )
  const build = process.env.NEXT_PUBLIC_COMMIT_SHA
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate'>('idle')
  const [mobileSection, setMobileSection] = useState<'main' | 'extra' | null>(null)
  const mainActive = isMainSectionPath(pathname)
  const extraActive = isExtraSectionPath(pathname)

  const toggleMobileMenu = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      if (next) {
        setMobileSection(mainActive ? 'main' : extraActive ? 'extra' : null)
      } else {
        setMobileSection(null)
      }
      return next
    })
  }, [mainActive, extraActive])

  const checkForUpdate = useCallback(async () => {
    setUpdateStatus('checking')
    try {
      // Wipe all SW caches so the reload fetches fresh from server
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        await reg?.update().catch(() => {})
      }
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }, [])

  const renderMobileLink = (link: NavLink, indent = false) => {
    const { href, label, icon: Icon, also } = link
    const active = linkActive(pathname, href, also)
    return (
      <AppNavLink
        key={href}
        href={resolveNavHref(href, grindNavHref, answersNavHref)}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 ${indent ? 'pl-8 pr-3 py-2' : 'px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-gradient-to-r from-indigo-600/15 to-violet-600/10 text-indigo-600 font-semibold border border-indigo-200/60'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
        }`}
      >
        {!indent && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'}`}>
            <Icon size={14} />
          </div>
        )}
        {indent && <Icon size={13} className="shrink-0 text-[var(--text-subtle)]" />}
        {label}
      </AppNavLink>
    )
  }

  return (
    <nav className="sticky top-0 z-[90] bg-[var(--bg-card)]/96 backdrop-blur-xl border-b border-[var(--border)] shadow-[0_2px_24px_rgba(0,0,0,0.07),0_0_0_0.5px_rgba(176,136,72,0.18)]">
      <div className="max-w-7xl mx-auto px-4">

        <div className="flex items-center justify-between h-14">
          <AppNavLink href="/grind" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.4)] group-hover:shadow-[0_4px_14px_rgba(99,102,241,0.55)] transition-shadow duration-200">
              <Swords size={16} className="text-white" />
            </div>
            <span className="font-black text-[1.1rem] tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 bg-clip-text text-transparent select-none">
              LeetMastery
            </span>
          </AppNavLink>

          <div className="flex items-center gap-1 shrink-0">
            {build && (
              <span className="hidden sm:inline text-[10px] font-mono text-[var(--text-subtle)] mr-1 select-none bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                {build}
              </span>
            )}
            <button
              type="button"
              onClick={checkForUpdate}
              disabled={updateStatus === 'checking'}
              className={`flex min-h-11 items-center gap-1 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                updateStatus === 'uptodate'
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              {updateStatus === 'checking' ? (
                <><RefreshCw size={11} className="animate-spin" /><span className="hidden sm:inline">Updating...</span></>
              ) : updateStatus === 'uptodate' ? (
                <><Check size={11} /><span className="hidden sm:inline">Up to date</span></>
              ) : (
                <><RefreshCw size={11} /><span className="hidden sm:inline">Get Latest</span></>
              )}
            </button>
            <button
              onClick={toggleMobileMenu}
              className="md:hidden flex min-h-11 min-w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] rounded-xl transition-colors"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 pb-2.5">
          <MainNavDropdown pathname={pathname} grindNavHref={grindNavHref} answersNavHref={answersNavHref} />
          <ExtraNavDropdown pathname={pathname} grindNavHref={grindNavHref} answersNavHref={answersNavHref} />
        </div>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-[95] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <div className="md:hidden absolute top-full left-0 right-0 z-[100] border-t border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_40px_rgba(0,0,0,0.14)] px-4 py-3 space-y-1 max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]">

            <button
              type="button"
              onClick={() => setMobileSection(s => (s === 'main' ? null : 'main'))}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mainActive
                  ? 'text-indigo-600 bg-indigo-50/80'
                  : 'text-[var(--text)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Swords size={15} className="shrink-0" />
                Main
              </span>
              <ChevronDown size={15} className={`transition-transform ${mobileSection === 'main' ? 'rotate-180' : ''}`} />
            </button>
            {mobileSection === 'main' && (
              <div className="pl-2 pb-1 space-y-0.5">
                {MAIN_LINKS.map(link => renderMobileLink(link, true))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileSection(s => (s === 'extra' ? null : 'extra'))}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                extraActive
                  ? 'text-indigo-600 bg-indigo-50/80'
                  : 'text-[var(--text)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <MoreHorizontal size={15} className="shrink-0" />
                Extra
              </span>
              <ChevronDown size={15} className={`transition-transform ${mobileSection === 'extra' ? 'rotate-180' : ''}`} />
            </button>
            {mobileSection === 'extra' && (
              <div className="pl-2 pb-1 space-y-0.5">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--text-subtle)]">Study</p>
                {EXTRA_STUDY_LINKS.map(link => renderMobileLink(link, true))}
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--text-subtle)]">Learn</p>
                {LEARN_CHILDREN.map(set => (
                  <AppNavLink
                    key={set}
                    href={learnHubHref(set)}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 pl-8 pr-3 py-2 rounded-xl text-sm transition-all ${
                      isLearnSectionPath(pathname) && activeLearnSetFromPath(pathname) === set
                        ? 'text-indigo-600 font-semibold'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    <BookOpen size={13} className="shrink-0 text-[var(--text-subtle)]" />
                    {learnSetLabel(set)}
                  </AppNavLink>
                ))}
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--text-subtle)]">Tools</p>
                {EXTRA_DRILL_LINKS.map(link => renderMobileLink(link, true))}
                {renderMobileLink({ href: '/mcp', label: 'MCP', icon: Clock }, true)}
                {MCP_CHILDREN.map(({ tab, label, icon }) => renderMobileLink({ href: mcpTabUrl(tab), label, icon }, true))}
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--text-subtle)]">More</p>
                {EXTRA_MORE_LINKS.map(link => renderMobileLink(link, true))}
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  )
}

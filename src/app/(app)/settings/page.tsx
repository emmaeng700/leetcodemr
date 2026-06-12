'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Bell, Globe, Save, Loader2, Check, BookOpen, RefreshCw, Smartphone, Target, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HST)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',        label: 'Central Europe (CET)' },
  { value: 'Europe/Helsinki',     label: 'Eastern Europe (EET)' },
  { value: 'Asia/Dubai',          label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata',        label: 'India (IST)' },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo',          label: 'Japan (JST)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST)' },
  { value: 'UTC',                 label: 'UTC' },
]

const REVIEW_DELAYS = [
  { days: 14, label: '2 weeks',  desc: 'Start reviews 2 weeks after solving' },
  { days: 21, label: '3 weeks',  desc: 'Start reviews 3 weeks after solving' },
  { days: 30, label: '1 month',  desc: 'Start reviews 1 month after solving' },
]

const REPS_PER_Q_KEY = 'lm_reps_per_q'

export default function SettingsPage() {
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [updateStatus,    setUpdateStatus]    = useState<'idle' | 'checking' | 'uptodate'>('idle')
  const [emailEnabled,    setEmailEnabled]    = useState(true)
  const [timezone,        setTimezone]        = useState('America/Chicago')
  const [reviewStartDays, setReviewStartDays] = useState(14)
  const [revisionCap,     setRevisionCap]     = useState(2)
  const [repsPerQ,        setRepsPerQ]        = useState(2)
  // per_day from study_plan (null = no plan set)
  const [perDay,          setPerDay]          = useState<number | null>(null)
  const [perDayStr,       setPerDayStr]       = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/user/profile').then(r => r.json()).catch(() => ({ profile: {} })),
      fetch('/api/study-plan').then(r => r.json()).catch(() => ({ plan: null })),
    ]).then(([pd, sp]) => {
      const p = pd.profile ?? {}
      const cap: number = Math.min(Math.max(p.revisionCap ?? 2, 1), 10)
      // DB wins — ensures changes saved on any device propagate everywhere.
      const profileReps = typeof p.repsPerQ === 'number' && p.repsPerQ > 0 ? p.repsPerQ : 0
      const localReps   = Number.parseInt(localStorage.getItem(REPS_PER_Q_KEY) ?? '', 10)
      const resolvedReps = profileReps > 0 ? profileReps : (Number.isFinite(localReps) && localReps > 0 ? localReps : 2)
      setEmailEnabled(p.emailEnabled ?? true)
      setTimezone(p.timezone ?? 'America/Chicago')
      setReviewStartDays(p.reviewStartDays ?? 14)
      setRevisionCap(cap)
      setRepsPerQ(resolvedReps)
      localStorage.setItem(REPS_PER_Q_KEY, String(resolvedReps))

      const pd2: number | null = sp.plan?.per_day ?? null
      setPerDay(pd2)
      setPerDayStr(pd2 !== null ? String(pd2) : '')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const checkForUpdate = useCallback(async () => {
    setUpdateStatus('checking')
    try {
      // 1. Clear all SW caches except the stable image cache.
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter(k => k !== 'lm-images').map(k => caches.delete(k))
        )
      }
      // 2. Tell any waiting SW to activate immediately.
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        void reg?.update()
      }
      // 3. Hard-navigate so the browser must re-fetch HTML from the network.
      window.location.href = window.location.href
    } catch {
      toast.error('Could not update — try closing and reopening the app')
      setUpdateStatus('idle')
    }
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const saves: Promise<unknown>[] = [
        fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailEnabled, timezone, reviewStartDays, revisionCap, repsPerQ }),
        }),
      ]

      // Save per_day to study_plan if a plan exists and the value changed
      const parsedPerDay = Math.max(1, Math.min(20, parseInt(perDayStr, 10) || 1))
      if (perDay !== null) {
        saves.push(
          fetch('/api/study-plan', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ per_day: parsedPerDay }),
          })
        )
        setPerDay(parsedPerDay)
        setPerDayStr(String(parsedPerDay))
      }

      const results = await Promise.all(saves)
      if (results.some(r => !(r as Response).ok)) throw new Error('Save failed')

      localStorage.setItem(REPS_PER_Q_KEY, String(repsPerQ))
      setSaved(true)
      toast.success('Settings saved!')
      setTimeout(() => setSaved(false), 2500)
    } catch {
      toast.error('Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[var(--text-subtle)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <Settings size={18} className="text-indigo-400" /> Settings
          </h1>
          <p className="text-xs text-[var(--text-subtle)] mt-1">
            Study pace, review schedule, and email reminders.
          </p>
        </div>

        {/* ── Daily plan pace ── */}
        {perDay !== null && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-indigo-500" />
              <span className="text-sm font-bold text-[var(--text)]">Questions per Day</span>
            </div>

            <p className="text-[11px] text-[var(--text-subtle)]">
              How many new questions your daily plan serves each day.
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const v = Math.max(1, (parseInt(perDayStr, 10) || 1) - 1)
                    setPerDayStr(String(v))
                  }}
                  className="px-3 py-2 text-lg font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={perDayStr}
                  onChange={e => setPerDayStr(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(1, Math.min(20, parseInt(perDayStr, 10) || 1))
                    setPerDayStr(String(v))
                  }}
                  className="w-12 text-center py-2 text-sm font-bold bg-transparent text-[var(--text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = Math.min(20, (parseInt(perDayStr, 10) || 1) + 1)
                    setPerDayStr(String(v))
                  }}
                  className="px-3 py-2 text-lg font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
                >+</button>
              </div>
              <span className="text-xs text-[var(--text-subtle)]">questions/day</span>
            </div>

            <p className="text-[10px] text-[var(--text-subtle)]">
              Takes effect from your next session. Your existing progress is preserved.
            </p>
          </div>
        )}

        {/* ── Daily review quota ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-green-500" />
            <span className="text-sm font-bold text-[var(--text)]">Reviews per Day</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            Max spaced-repetition reviews per day. Once you hit this, the review quota is done for the day.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRevisionCap(n)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-xl border text-center transition-colors ${
                  revisionCap === n
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-subtle)] hover:border-green-300'
                }`}
              >
                <span className="text-lg font-black">{n}</span>
                <span className="text-[10px]">{n === 1 ? 'review' : 'reviews'}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-[var(--text-subtle)]">
            Daily questions must be done first. Reviews only block &quot;done for the day&quot; when some are due today.
          </p>
        </div>

        {/* ── Daily reps target ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-[var(--text)]">Reps per Question</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            How many accepted solves a Daily question needs before it counts as done and moves to the next.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRepsPerQ(n)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-xl border text-center transition-colors ${
                  repsPerQ === n
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-subtle)] hover:border-indigo-300'
                }`}
              >
                <span className="text-lg font-black">{n}</span>
                <span className="text-[10px]">rep{n === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Review start delay ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-violet-400" />
            <span className="text-sm font-bold text-[var(--text)]">First Review Delay</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            How long after solving a question before your first spaced-repetition review is scheduled.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {REVIEW_DELAYS.map(opt => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setReviewStartDays(opt.days)}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border text-center transition-colors ${
                  reviewStartDays === opt.days
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-subtle)] hover:border-violet-300'
                }`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-[var(--text-subtle)]">
            Applies to all solved questions that haven&apos;t started reviewing yet, plus any you solve from now on.
          </p>
        </div>

        {/* ── Email reminders ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-5 mb-4">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-indigo-400" />
            <span className="text-sm font-bold text-[var(--text)]">Email Reminders</span>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text)]">Daily reminders</p>
              <p className="text-[11px] text-[var(--text-subtle)] mt-0.5">
                Stops once you complete your daily questions for the day
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEmailEnabled(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${emailEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-subtle)]">
              <Globe size={11} /> Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              disabled={!emailEnabled}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:outline-none focus:border-indigo-400 disabled:opacity-40"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── App update ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone size={14} className="text-sky-500" />
              <span className="text-sm font-bold text-[var(--text)]">App Version</span>
            </div>
            {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && (
              <a
                href={`https://github.com/emmaeng700/leetcodemr/commit/${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg hover:text-indigo-600 transition-colors"
              >
                {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}
              </a>
            )}
            {!process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && (
              <span className="font-mono text-[11px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-lg">dev</span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-subtle)]">
            If your home screen app is showing an old version, tap below to pull the latest and reload.
          </p>
          <button
            type="button"
            onClick={checkForUpdate}
            disabled={updateStatus === 'checking'}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-colors ${
              updateStatus === 'uptodate'
                ? 'border-green-400 bg-green-50 text-green-700'
                : 'border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-60'
            }`}
          >
            {updateStatus === 'checking' ? (
              <><Loader2 size={14} className="animate-spin" /> Checking…</>
            ) : updateStatus === 'uptodate' ? (
              <><Check size={14} /> Already up to date</>
            ) : (
              <><RefreshCw size={14} /> Get Latest Version</>
            )}
          </button>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check size={15} /> Saved!</>
          ) : (
            <><Save size={15} /> Save Settings</>
          )}
        </button>

        <p className="text-[10px] text-[var(--text-subtle)] text-center mt-3 mb-4">
          Reminders stop once you complete your daily questions.
        </p>

        {/* About */}
        <div className="mt-6 pt-5 border-t border-[var(--border)]">
          <h2 className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-widest mb-3">About</h2>
          <div className="bg-[var(--bg-muted)] rounded-xl p-4 text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
            <p><strong className="text-[var(--text)]">LeetMastery</strong> — a personal LeetCode study companion.</p>
            <p>Priority-grouped · Difficulty-first · Spaced repetition · Cycle training</p>
            <p className="text-[var(--text-subtle)] pt-1">Built for the July 2026 recruitment cycle 🚀</p>
          </div>
        </div>
      </div>
    </div>
  )
}

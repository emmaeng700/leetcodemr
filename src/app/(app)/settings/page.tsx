'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Bell, Clock, Globe, Save, Loader2, Check, BookOpen, RefreshCw, Smartphone } from 'lucide-react'
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

const SLOTS = [
  { label: 'Morning',   default: '08:00' },
  { label: 'Afternoon', default: '13:00' },
  { label: 'Evening',   default: '19:00' },
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
  const [emailTimes,      setEmailTimes]      = useState<(string | null)[]>([null, null, null])
  const [reviewStartDays, setReviewStartDays] = useState(14)
  const [revisionCap,     setRevisionCap]     = useState(3)
  const [repsPerQ,        setRepsPerQ]        = useState(3)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(pd => {
        const p = pd.profile ?? {}
        const cap: number = Math.min(Math.max(p.revisionCap ?? 3, 1), 3)
        const localReps = Number.parseInt(localStorage.getItem(REPS_PER_Q_KEY) ?? '', 10)
        const resolvedReps = Number.isFinite(localReps) && localReps > 0 ? localReps : (p.repsPerQ ?? 3)
        setEmailEnabled(p.emailEnabled ?? true)
        setTimezone(p.timezone ?? 'America/Chicago')
        setReviewStartDays(p.reviewStartDays ?? 14)
        setRevisionCap(cap)
        setRepsPerQ(resolvedReps)
        localStorage.setItem(REPS_PER_Q_KEY, String(resolvedReps))

        const savedTimes: string[] = p.emailTimes ?? []
        const slots: (string | null)[] = [null, null, null]
        savedTimes.forEach((t: string, i: number) => { if (i < 3) slots[i] = t })
        setEmailTimes(slots.map((t, i) => i < cap ? (t ?? SLOTS[i].default) : null))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const checkForUpdate = useCallback(async () => {
    setUpdateStatus('checking')
    try {
      // 1. Clear all SW caches except the stable image cache.
      //    This forces the next load to fetch everything fresh from the network.
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
        // Also trigger a network check for a brand-new SW version.
        void reg?.update()
      }
      // 3. Hard-navigate so the browser must re-fetch HTML from the network.
      //    Using href assignment bypasses the bfcache on iOS better than reload().
      window.location.href = window.location.href
    } catch {
      toast.error('Could not update — try closing and reopening the app')
      setUpdateStatus('idle')
    }
  }, [])

  const updateSlot = (i: number, val: string) => {
    setEmailTimes(prev => prev.map((t, idx) => idx === i ? val : t))
  }

  const enabledTimes = emailTimes.filter(t => t !== null) as string[]

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const r = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailEnabled, emailTimes: enabledTimes, timezone, reviewStartDays, revisionCap, repsPerQ }),
      })
      if (!r.ok) throw new Error('Profile save failed')
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
            Control email reminders and review schedule.
          </p>
        </div>

        {/* ── Review start delay ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-violet-400" />
            <span className="text-sm font-bold text-[var(--text)]">Review Start Delay</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            How long after solving a question before your first review is scheduled.
          </p>

          <div className="grid grid-cols-3 gap-2">
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

        {/* ── Daily revision cap ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-green-500" />
            <span className="text-sm font-bold text-[var(--text)]">Daily Revision Limit</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            Max spaced-repetition reviews per day. Once you hit this, the day is done and reminders stop.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRevisionCap(n)
                  // Extend or trim email time slots to match new cap
                  setEmailTimes(prev => prev.map((t, i) => i < n ? (t ?? SLOTS[i].default) : null))
                }}
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
            This is separate from your daily new questions target — both need to be done for the full day to be complete.
          </p>
        </div>

        {/* ── Daily reps target ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-[var(--text)]">Daily Reps Per Question</span>
          </div>

          <p className="text-[11px] text-[var(--text-subtle)]">
            How many accepted solves a Daily question needs before it counts as done and moves to the next one.
          </p>

          <div className="grid grid-cols-4 gap-2">
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

          <p className="text-[10px] text-[var(--text-subtle)]">
            This setting is shared with the Daily page’s top reps control and the Daily practice auto-advance flow.
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
              <p className="text-sm text-[var(--text)]">Daily review reminders</p>
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

          {/* Time slots — count matches daily revision cap */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-subtle)]">
                <Clock size={11} /> Reminder times
              </label>
              <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {revisionCap} per day
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-subtle)]">
              {revisionCap === 1
                ? 'Daily target is 1 — pick the one time you want your reminder.'
                : revisionCap === 2
                ? 'Daily target is 2 — pick any two times to be reminded.'
                : 'Daily target is 3 — one reminder for each part of the day.'}
            </p>

            <div className="space-y-2 pt-1">
              {SLOTS.slice(0, revisionCap).map((slot, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-[11px] font-semibold text-[var(--text-subtle)] w-16 shrink-0">
                    {slot.label}
                  </div>
                  <input
                    type="time"
                    value={emailTimes[i] ?? slot.default}
                    onChange={e => updateSlot(i, e.target.value)}
                    disabled={!emailEnabled}
                    className="flex-1 px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text)] focus:outline-none focus:border-indigo-400 disabled:opacity-40"
                  />
                </div>
              ))}
            </div>

            {revisionCap < 3 && (
              <p className="text-[10px] text-[var(--text-subtle)] mt-1">
                To unlock more reminder slots, increase your daily revision limit above.
              </p>
            )}

            {!emailEnabled && (
              <p className="text-[11px] text-[var(--text-subtle)] italic">Enable reminders to edit times.</p>
            )}
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

        <p className="text-[10px] text-[var(--text-subtle)] text-center mt-3">
          Reminders stop once you complete your daily questions. Adjust your daily target on the Daily page.
        </p>
      </div>
    </div>
  )
}

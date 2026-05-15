'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Trash2, Plus, Loader2, Eye, EyeOff, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClipItem {
  id: number
  label: string
  content: string
  created_at: string
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/* ── Single item card ────────────────────────────────────────────────────── */
function ItemCard({ item, onDelete }: { item: ClipItem; onDelete: (id: number) => void }) {
  const [copied,   setCopied]   = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(item.content).catch(() => {})
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const del = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/clipboard', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      if (res.ok) onDelete(item.id)
      else toast.error('Could not delete')
    } catch { toast.error('Network error') }
    finally { setDeleting(false) }
  }

  /* Detect if content looks sensitive (long token / cookie string) */
  const isSensitive = item.content.length > 40 && !item.content.includes('\n')
  const displayContent = isSensitive && !revealed
    ? item.content.slice(0, 24) + '••••••••••••••••'
    : item.content

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-2">
      {/* Top row: label + time + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {item.label && (
            <span className="text-xs font-semibold text-[var(--text)] truncate">{item.label}</span>
          )}
          <span className="text-[10px] text-gray-500 shrink-0">{timeAgo(item.created_at)}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Reveal toggle for sensitive content */}
          {isSensitive && (
            <button onClick={() => setRevealed(v => !v)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              title={revealed ? 'Hide' : 'Reveal'}>
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}

          {/* Copy */}
          <button onClick={copy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {/* Delete */}
          <button onClick={del} disabled={deleting}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Content preview */}
      <div className="font-mono text-[11px] text-gray-400 break-all leading-relaxed bg-black/20 rounded-lg px-3 py-2 select-all">
        {displayContent}
      </div>
    </div>
  )
}

/* ══ Page ════════════════════════════════════════════════════════════════════ */
export default function ClipboardPage() {
  const [items,      setItems]      = useState<ClipItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [content,    setContent]    = useState('')
  const [label,      setLabel]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  /* Load */
  useEffect(() => {
    fetch('/api/clipboard')
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setTableReady(d.tableReady !== false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* Save */
  const save = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, content }),
      })
      const d = await res.json()
      if (res.ok && d.item) {
        setItems(prev => [d.item, ...prev])
        setContent('')
        setLabel('')
        textareaRef.current?.focus()
        toast.success('Saved!')
      } else {
        toast.error(d.error ?? 'Could not save')
      }
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  const handleDelete = (id: number) => setItems(prev => prev.filter(i => i.id !== id))

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <ClipboardList size={18} className="text-indigo-400" /> Clipboard
          </h1>
          <p className="text-xs text-[var(--text-subtle)] mt-1">
            Paste anything here — session tokens, codes, notes. Copy on any device, delete when done.
          </p>
        </div>

        {/* Setup banner */}
        {!tableReady && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-400">One-time setup needed</p>
            <p className="text-xs text-amber-300/80 mt-1">
              Run this SQL in your{' '}
              <a href="https://supabase.com/dashboard/project/azrokoorufejfoeddzrw/sql"
                target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                Supabase SQL Editor
              </a>:
            </p>
            <pre className="mt-2 text-[10px] text-amber-200/70 bg-black/30 rounded-lg p-2 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS clipboard_items (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT        NOT NULL DEFAULT 'emmanuel',
  label      TEXT        NOT NULL DEFAULT '',
  content    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ          DEFAULT NOW()
);`}</pre>
          </div>
        )}

        {/* Add form */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6 space-y-3">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional) — e.g. LeetCode Session"
            className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-indigo-400/60"
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save() }}
            placeholder="Paste anything here…"
            rows={4}
            className="w-full px-3 py-2 text-sm font-mono bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-indigo-400/60 resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-600">⌘Enter to save</p>
            <button onClick={save} disabled={!content.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Save
            </button>
          </div>
        </div>

        {/* Items list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-subtle)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-subtle)]">Nothing saved yet.</p>
            <p className="text-xs text-gray-600 mt-1">Paste something above and hit Save.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <ItemCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Headphones, Play, Pause, SkipBack, SkipForward, RotateCcw,
  BookOpen, Server, List, ChevronDown, Volume2,
} from 'lucide-react'
import { SD_CARDS, SD_CATEGORIES } from '@/data/systemDesignCards'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Story { title: string; situation: string; task: string; action: string; result: string }
interface BehavioralQ { id: number; category: string; question: string; stories: Story[] }
interface SDCard { id: string; category: string; q: string; a: string }

type PlaylistItem = { type: 'behavioral'; data: BehavioralQ } | { type: 'sd'; data: SDCard }

type Section = 'all' | 'behavioral' | 'sd'
type Mode = 'question' | 'full'

const BCAT_ALL = 'All'
const SDCAT_ALL = 'All'

// ── Text builders ─────────────────────────────────────────────────────────────

function behavioralTexts(q: BehavioralQ, mode: Mode): string[] {
  const out: string[] = [`${q.category}. ${q.question}`]
  if (mode === 'full') {
    q.stories.forEach((s, i) => {
      out.push(
        `Story ${i + 1}: ${s.title}. ` +
        `Situation: ${s.situation}. ` +
        `Task: ${s.task}. ` +
        `Action: ${s.action}. ` +
        `Result: ${s.result}.`
      )
    })
  }
  return out
}

function cleanSD(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[─━•·🎯📊🏗⚡📈🔥💡✅❌🚀📝🔧⚙🗄📡🌐]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sdTexts(card: SDCard, mode: Mode): string[] {
  const out: string[] = [card.q]
  if (mode === 'full') out.push(cleanSD(card.a))
  return out
}

// ── Speed options ─────────────────────────────────────────────────────────────

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

// ── Main component ────────────────────────────────────────────────────────────

export default function AudiobookPage() {
  const [allBehavioral, setAllBehavioral] = useState<BehavioralQ[]>([])
  const [loading, setLoading] = useState(true)

  const [section, setSection] = useState<Section>('all')
  const [bCat, setBCat] = useState(BCAT_ALL)
  const [sdCat, setSdCat] = useState(SDCAT_ALL)
  const [mode, setMode] = useState<Mode>('full')
  const [speed, setSpeed] = useState(1)
  const [autoAdvance, setAutoAdvance] = useState(true)

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceIdx, setVoiceIdx] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const utterQueue = useRef<string[]>([])
  const utterPos = useRef(0)
  const stopFlag = useRef(false)

  // Load behavioral questions
  useEffect(() => {
    fetch('/behavioral_questions.json')
      .then(r => r.json())
      .then((data: BehavioralQ[]) => { setAllBehavioral(data); setLoading(false) })
  }, [])

  // Load voices
  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  // Build playlist whenever filters change
  useEffect(() => {
    if (loading) return
    const items: PlaylistItem[] = []

    if (section !== 'sd') {
      const filtered = bCat === BCAT_ALL ? allBehavioral : allBehavioral.filter(q => q.category === bCat)
      filtered.forEach(data => items.push({ type: 'behavioral', data }))
    }

    if (section !== 'behavioral') {
      const sdFiltered = sdCat === SDCAT_ALL
        ? (SD_CARDS as SDCard[])
        : (SD_CARDS as SDCard[]).filter(c => c.category === sdCat)
      sdFiltered.forEach(data => items.push({ type: 'sd', data }))
    }

    stopSpeaking()
    setPlaylist(items)
    setIdx(0)
    setPlaying(false)
    setPaused(false)
  }, [section, bCat, sdCat, allBehavioral, loading])

  // ── Speech helpers ────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    stopFlag.current = true
    window.speechSynthesis?.cancel()
    utterQueue.current = []
    utterPos.current = 0
  }, [])

  const speakNext = useCallback((queue: string[], pos: number, spd: number, voice: SpeechSynthesisVoice | undefined, onDone: () => void) => {
    if (stopFlag.current || pos >= queue.length) {
      if (!stopFlag.current) onDone()
      return
    }
    const text = queue[pos]
    setCurrentText(text)
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = spd
    if (voice) utt.voice = voice
    utt.onend = () => speakNext(queue, pos + 1, spd, voice, onDone)
    utt.onerror = () => { if (!stopFlag.current) onDone() }
    window.speechSynthesis.speak(utt)
  }, [])

  const playItem = useCallback((items: PlaylistItem[], i: number, spd: number, selectedVoiceIdx: number, md: Mode) => {
    if (i < 0 || i >= items.length) return
    const item = items[i]
    const queue = item.type === 'behavioral'
      ? behavioralTexts(item.data, md)
      : sdTexts(item.data, md)

    utterQueue.current = queue
    utterPos.current = 0
    stopFlag.current = false

    const voice = voices[selectedVoiceIdx]

    speakNext(queue, 0, spd, voice, () => {
      setCurrentText('')
      if (autoAdvance && i + 1 < items.length) {
        setIdx(i + 1)
        playItem(items, i + 1, spd, selectedVoiceIdx, md)
      } else {
        setPlaying(false)
        setPaused(false)
        if (i + 1 >= items.length) setIdx(0)
      }
    })
  }, [voices, autoAdvance, speakNext])

  // ── Controls ──────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
      setPlaying(true)
      return
    }
    stopSpeaking()
    setPlaying(true)
    setPaused(false)
    playItem(playlist, idx, speed, voiceIdx, mode)
  }, [paused, stopSpeaking, playItem, playlist, idx, speed, voiceIdx, mode])

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause()
    setPaused(true)
    setPlaying(false)
  }, [])

  const handleStop = useCallback(() => {
    stopSpeaking()
    setPlaying(false)
    setPaused(false)
    setCurrentText('')
  }, [stopSpeaking])

  const handlePrev = useCallback(() => {
    const next = Math.max(0, idx - 1)
    stopSpeaking()
    setIdx(next)
    setPaused(false)
    if (playing) {
      setPlaying(true)
      playItem(playlist, next, speed, voiceIdx, mode)
    }
  }, [idx, stopSpeaking, playing, playItem, playlist, speed, voiceIdx, mode])

  const handleNext = useCallback(() => {
    const next = Math.min(playlist.length - 1, idx + 1)
    stopSpeaking()
    setIdx(next)
    setPaused(false)
    if (playing) {
      setPlaying(true)
      playItem(playlist, next, speed, voiceIdx, mode)
    }
  }, [idx, playlist.length, stopSpeaking, playing, playItem, playlist, speed, voiceIdx, mode])

  const handleRestart = useCallback(() => {
    stopSpeaking()
    setIdx(0)
    setPlaying(false)
    setPaused(false)
    setCurrentText('')
  }, [stopSpeaking])

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s)
    if (playing && !paused) {
      stopSpeaking()
      playItem(playlist, idx, s, voiceIdx, mode)
    }
  }, [playing, paused, stopSpeaking, playItem, playlist, idx, voiceIdx, mode])

  // Stop when unmounting
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  // ── Current card display ──────────────────────────────────────────────────

  const currentItem = playlist[idx] || null

  const bCategories = ['All', ...Array.from(new Set(allBehavioral.map(q => q.category)))]
  const sdCategoriesList = ['All', ...(SD_CATEGORIES as string[])]

  // ── English voices only ───────────────────────────────────────────────────
  const englishVoices = voices.filter(v => v.lang.startsWith('en'))

  if (loading) return (
    <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading...</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
            <Headphones size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Audiobook</h1>
            <p className="text-sm text-[var(--text-muted)]">Listen to your interview prep on the go</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-violet-300 hover:text-violet-600 text-xs font-medium transition-colors"
        >
          <Volume2 size={13} /> Settings
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-4 space-y-4">
          {/* Voice */}
          {englishVoices.length > 0 && (
            <div>
              <label className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide block mb-2">Voice</label>
              <div className="relative">
                <select
                  value={voiceIdx}
                  onChange={e => setVoiceIdx(Number(e.target.value))}
                  className="w-full appearance-none bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] pr-8 focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  {englishVoices.map((v, i) => (
                    <option key={v.name} value={voices.indexOf(v)}>{v.name} ({v.lang})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Mode */}
          <div>
            <label className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide block mb-2">Read Mode</label>
            <div className="flex gap-2">
              {(['question', 'full'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); handleStop() }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                    mode === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-300'
                  }`}
                >
                  {m === 'question' ? 'Question Only' : 'Full Q&A'}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-advance */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide">Auto-advance</span>
            <button
              onClick={() => setAutoAdvance(a => !a)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                autoAdvance ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]'
              }`}
            >
              {autoAdvance ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {([
          { id: 'all', label: 'All', icon: List },
          { id: 'behavioral', label: 'Behavioral', icon: BookOpen },
          { id: 'sd', label: 'System Design', icon: Server },
        ] as { id: Section; label: string; icon: React.ElementType }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              section === t.id ? 'border-violet-500 text-violet-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text-muted)]'
            }`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Category filters */}
      {(section === 'all' || section === 'behavioral') && (
        <div>
          <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Behavioral Category</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {bCategories.map(c => (
              <button
                key={c}
                onClick={() => { setBCat(c) }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  bCat === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-indigo-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {(section === 'all' || section === 'sd') && (
        <div>
          <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-2">System Design Category</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {sdCategoriesList.map(c => (
              <button
                key={c}
                onClick={() => { setSdCat(c) }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  sdCat === c ? 'bg-sky-600 text-white border-sky-600' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-sky-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current card */}
      {currentItem && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${
          currentItem.type === 'behavioral' ? 'border-indigo-200 bg-indigo-50' : 'border-sky-200 bg-sky-50'
        }`}>
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            {currentItem.type === 'behavioral'
              ? <BookOpen size={14} className="text-indigo-500 shrink-0" />
              : <Server size={14} className="text-sky-500 shrink-0" />}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              currentItem.type === 'behavioral'
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                : 'bg-sky-100 text-sky-700 border-sky-200'
            }`}>
              {currentItem.type === 'behavioral' ? currentItem.data.category : currentItem.data.category}
            </span>
            <span className="ml-auto text-xs text-[var(--text-subtle)]">{idx + 1} / {playlist.length}</span>
          </div>
          <div className="px-5 pb-4">
            <p className="text-base font-bold text-[var(--text)] leading-snug mb-2">
              {currentItem.type === 'behavioral' ? currentItem.data.question : currentItem.data.q}
            </p>
            {currentText && (
              <div className={`mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed italic ${
                currentItem.type === 'behavioral'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-sky-100 text-sky-800'
              }`}>
                <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse mr-2 align-middle" />
                {currentText.length > 140 ? currentText.slice(0, 140) + '…' : currentText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player controls */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
        {/* Speed */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs text-[var(--text-subtle)] font-medium">Speed:</span>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                speed === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)] hover:border-violet-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Main buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleRestart}
            title="Restart playlist"
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:border-[var(--border-soft)] transition-colors"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={handlePrev}
            disabled={idx === 0}
            className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-violet-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <SkipBack size={20} />
          </button>

          {playing && !paused ? (
            <button
              onClick={handlePause}
              className="p-4 rounded-2xl bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-colors"
            >
              <Pause size={24} />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={playlist.length === 0}
              className="p-4 rounded-2xl bg-violet-600 text-white shadow-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              <Play size={24} />
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={idx === playlist.length - 1}
            className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-violet-300 hover:text-violet-600 disabled:opacity-30 transition-colors"
          >
            <SkipForward size={20} />
          </button>

          <div className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            autoAdvance ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 border-violet-200 dark:border-violet-500/30' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)]'
          }`}>
            {autoAdvance ? '▶▶ Auto' : '— Manual'}
          </div>
        </div>

        {/* Progress bar (visual only) */}
        {playlist.length > 0 && (
          <div className="mt-4">
            <div className="w-full h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${((idx + 1) / playlist.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[var(--text-subtle)] mt-1">
              <span>{idx + 1} of {playlist.length}</span>
              <span className="font-medium">
                {mode === 'question' ? 'Question only' : 'Full Q&A'} · {speed}x
              </span>
            </div>
          </div>
        )}
      </div>

      {playlist.length === 0 && (
        <div className="text-center py-12 text-[var(--text-subtle)] text-sm">No items match this filter.</div>
      )}

      {/* Playlist preview */}
      <div>
        <p className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wide mb-3">
          Playlist · {playlist.length} items
        </p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {playlist.map((item, i) => (
            <button
              key={item.type === 'behavioral' ? item.data.id : item.data.id}
              onClick={() => {
                stopSpeaking()
                setIdx(i)
                setPaused(false)
                if (playing) playItem(playlist, i, speed, voiceIdx, mode)
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors flex items-center gap-3 ${
                i === idx
                  ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-300'
                  : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[var(--border-soft)]'
              }`}
            >
              <span className={`shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                i === idx ? 'bg-violet-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-subtle)]'
              }`}>
                {i === idx && (playing && !paused) ? '▶' : i + 1}
              </span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${
                item.type === 'behavioral' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'
              }`}>
                {item.type === 'behavioral' ? 'B' : 'SD'}
              </span>
              <span className="truncate">
                {item.type === 'behavioral' ? item.data.question : item.data.q}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

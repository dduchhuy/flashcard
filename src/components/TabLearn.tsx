import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  RotateCcw,
  Volume2,
  BarChart2,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Tag as TagIcon,
  ChevronDown,
  Check,
  X,
  BookOpen,
  ArrowLeftRight
} from "lucide-react"
import {
  useFlashcardStore,
  getCardTags,
  getCardsForMode,
  Flashcard,
  Highlight,
  PhraseIdiom,
  normalizePhraseItem,
  SRSData
} from "../store"
import { speakEnglish, extractWordText } from "../utils"
import {
  previewIntervals,
  calculateNextSRS,
  Rating,
  LearnSettings,
  DEFAULT_LEARN_SETTINGS,
  parseIntervalStr,
  msToStr
} from "../utils/srs"
import { CardDetailModal } from "./CardDetailModal"

const LS_KEY = "learn_settings"

function loadSettings(): LearnSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_LEARN_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_LEARN_SETTINGS }
}

function saveSettings(s: LearnSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

// ── Queue item types ──────────────────────────────────────────────
export type LearnCardMode = "meanings" | "words" | "phrases" | "phrase_meanings"

interface MeaningItem {
  type: "meaning"
  card: Flashcard
  highlight: Highlight
  word: string
}

interface WordItem {
  type: "word"
  card: Flashcard
}

interface PhraseItem {
  type: "phrase"
  card: Flashcard
  phrase: PhraseIdiom
}

interface PhraseMeaningItem {
  type: "phrase_meaning"
  card: Flashcard
  phrase: PhraseIdiom
}

type QueueItem = MeaningItem | WordItem | PhraseItem | PhraseMeaningItem

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQueue(
  flashcards: Flashcard[],
  tags: string[],
  gameInputMode: "word" | "sentence",
  mode: LearnCardMode,
  isRandom: boolean,
  forceAll: boolean = false
): QueueItem[] {
  let filtered = tags.length > 0
    ? flashcards.filter(f => getCardTags(f).some(t => tags.includes(t)))
    : flashcards
  filtered = getCardsForMode(filtered, gameInputMode)

  const now = Date.now()
  const items: QueueItem[] = []

  if (mode === "meanings") {
    filtered.forEach(card => {
      (card.highlights || []).forEach(highlight => {
        const srs = highlight.srs
        // Keep cards with 'again' or 'hard' so user is reminded across reloads; skip good/easy not due yet
        if (!forceAll && srs && (srs.lastRating === "good" || srs.lastRating === "easy") && srs.due > now) return
        const word = extractWordText(card.sentence, highlight.wordIndices) || card.sentence
        items.push({ type: "meaning", card, highlight, word })
      })
    })
  } else if (mode === "words") {
    filtered.forEach(card => {
      if ((card.highlights || []).length === 0 && (!card.posEntries || card.posEntries.length === 0)) return
      const srs = card.srs
      if (!forceAll && srs && (srs.lastRating === "good" || srs.lastRating === "easy") && srs.due > now) return
      items.push({ type: "word", card })
    })
  } else if (mode === "phrases" || mode === "phrase_meanings") {
    filtered.forEach(card => {
      const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem).filter(p => p.phrase && p.translation)
      phrases.forEach(phrase => {
        const srs = phrase.srs
        if (!forceAll && srs && (srs.lastRating === "good" || srs.lastRating === "easy") && srs.due > now) return
        if (mode === "phrases") {
          items.push({ type: "phrase", card, phrase })
        } else {
          items.push({ type: "phrase_meaning", card, phrase })
        }
      })
    })
  }

  if (isRandom) return shuffleArr(items)

  // Sort prioritizing cards that need reminding ("nhắc lại"):
  // 1) again (highest priority)
  // 2) hard
  // 3) due now
  // 4) new (no srs yet)
  // 5) others
  items.sort((a, b) => {
    const getSrs = (item: QueueItem) => {
      if (item.type === "meaning") return item.highlight.srs
      if (item.type === "phrase" || item.type === "phrase_meaning") return item.phrase.srs
      return item.card.srs
    }
    const srsA = getSrs(a)
    const srsB = getSrs(b)
    const getScore = (srs?: SRSData) => {
      if (!srs) return 3 // new card
      if (srs.lastRating === "again") return 0
      if (srs.lastRating === "hard") return 1
      if (srs.due <= now) return 2
      return 4
    }
    const diff = getScore(srsA) - getScore(srsB)
    if (diff !== 0) return diff
    return (srsA?.due ?? 0) - (srsB?.due ?? 0)
  })
  return items
}

// ── Settings panel ────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose }: {
  settings: LearnSettings
  onChange: (s: LearnSettings) => void
  onClose: () => void
}) {
  const fields: { key: keyof LearnSettings; label: string; color: string }[] = [
    { key: "againMs", label: "Again", color: "text-red-600" },
    { key: "hardMs", label: "Hard", color: "text-orange-600" },
    { key: "goodMs", label: "Good", color: "text-green-600" },
    { key: "easyMs", label: "Easy", color: "text-blue-600" },
  ]
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {}
    fields.forEach(f => { r[f.key] = msToStr(settings[f.key]) })
    return r
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleSave = () => {
    const next = { ...settings }
    const errs: Record<string, boolean> = {}
    let ok = true
    fields.forEach(f => {
      const ms = parseIntervalStr(inputs[f.key])
      if (ms === null || ms <= 0) { errs[f.key] = true; ok = false }
      else next[f.key] = ms
    })
    setErrors(errs)
    if (ok) { onChange(next); onClose() }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Interval Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Format: m = minutes, h = hours, d = days. e.g. 1m, 6m, 2h, 3d</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className={`text-xs font-semibold ${f.color} mb-1 block`}>{f.label}</label>
            <input
              value={inputs[f.key]}
              onChange={e => setInputs(prev => ({ ...prev, [f.key]: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors[f.key] ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}
              placeholder="e.g. 10m"
            />
            {errors[f.key] && <p className="text-red-500 text-xs mt-0.5">Invalid (e.g. 1m, 2h, 3d)</p>}
          </div>
        ))}
      </div>
      <button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-medium transition-colors">
        Save
      </button>
    </div>
  )
}

// ── Statistics modal ──────────────────────────────────────────────
function LearnStatsModal({
  stats,
  flashcards,
  onClose
}: {
  stats: { again: number; hard: number; good: number; easy: number }
  flashcards: Flashcard[]
  onClose: () => void
}) {
  const totalSession = stats.again + stats.hard + stats.good + stats.easy
  const retention = totalSession > 0 ? Math.round(((stats.good + stats.easy) / totalSession) * 100) : 0

  const now = Date.now()
  const dueCards = flashcards.filter(f => f.srs && f.srs.due <= now).length
  const learningCards = flashcards.filter(f => f.srs && f.srs.reps > 0 && f.srs.step < 3).length
  const matureCards = flashcards.filter(f => f.srs && f.srs.interval >= 21 * 24 * 60).length
  const youngCards = flashcards.filter(f => f.srs && f.srs.step === 3 && f.srs.interval < 21 * 24 * 60).length
  const newCards = flashcards.filter(f => !f.srs || f.srs.reps === 0).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl">
              <BarChart2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">Learning Statistics</h3>
              <p className="text-xs text-gray-400">Session progress & SRS retention</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Session Stats */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Session</span>
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{totalSession} cards reviewed</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Again", count: stats.again, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
              { label: "Hard", count: stats.hard, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
              { label: "Good", count: stats.good, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
              { label: "Easy", count: stats.easy, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
            ].map(item => (
              <div key={item.label} className={`p-2.5 rounded-xl ${item.bg} text-center`}>
                <span className={`text-xl font-bold ${item.color}`}>{item.count}</span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40">
            <span className="text-xs font-medium text-purple-900 dark:text-purple-200">Session Retention Rate</span>
            <span className="text-base font-bold text-purple-700 dark:text-purple-300">{retention}%</span>
          </div>
        </div>

        {/* Library SRS Overview */}
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Library SRS Overview</span>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{flashcards.length}</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Total Cards</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{dueCards}</span>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">Due for Review</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/40">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{learningCards}</span>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">In Learning</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{matureCards}</span>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">Mature (21d+)</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{youngCards}</span>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">Young (&lt;21d)</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-500 dark:text-gray-400">{newCards}</span>
              <p className="text-[11px] text-gray-400 mt-0.5">New / Unlearned</p>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-sm transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Tag selector ──────────────────────────────────────────────────
function TagSelector({ allTags, selected, onChange }: {
  allTags: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <TagIcon size={15} className="text-purple-500" />
        {selected.length === 0 ? "All tags" : `${selected.length} tag${selected.length > 1 ? "s" : ""}`}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[180px] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => { onChange([]); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${selected.length === 0 ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
            >
              All tags {selected.length === 0 && <Check size={14} />}
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${selected.includes(tag) ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >
                {tag} {selected.includes(tag) && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export function TabLearn() {
  const { flashcards, gameInputMode, updateHighlightSRS, updateFlashcardSRS, updatePhraseSRS } = useFlashcardStore()
  const [settings, setSettings] = useState<LearnSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [popupCard, setPopupCard] = useState<Flashcard | null>(null)
  const [learnMode, setLearnMode] = useState<LearnCardMode>(() => {
    try {
      const saved = localStorage.getItem("learn_mode") as LearnCardMode
      if (saved && ["meanings", "words", "phrases", "phrase_meanings"].includes(saved)) return saved
    } catch {}
    return "words"
  })
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [isRandom, setIsRandom] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("learn_selected_tags")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return []
  })
  const [showAnswer, setShowAnswer] = useState(false)
  const [meaningIdx, setMeaningIdx] = useState(0)
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [isQueueInit, setIsQueueInit] = useState(false)

  const modeDropdownRef = useRef<HTMLDivElement>(null)
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup all timers
  const clearPendingTimers = () => {
    pendingTimers.current.forEach(t => clearTimeout(t))
    pendingTimers.current.clear()
  }

  // Cleanup on unmount
  useEffect(() => () => clearPendingTimers(), [])

  // Close mode dropdown on outside click
  useEffect(() => {
    if (!modeDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [modeDropdownOpen])

  const allTags = useMemo(() =>
    Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).sort()
  , [flashcards])

  // Initialize queue once flashcards are loaded
  useEffect(() => {
    if (flashcards.length > 0 && !isQueueInit) {
      setQueue(buildQueue(flashcards, selectedTags, gameInputMode, learnMode, isRandom))
      setIsQueueInit(true)
    }
  }, [flashcards, gameInputMode, isQueueInit, selectedTags, learnMode, isRandom])

  const current = queue[0]

  const handleSettings = (s: LearnSettings) => {
    setSettings(s)
    saveSettings(s)
  }

  // Synchronous reset helper
  const resetSession = (newTags: string[], newMode: LearnCardMode, newRandom: boolean, forceAll = false) => {
    try {
      localStorage.setItem("learn_selected_tags", JSON.stringify(newTags))
      localStorage.setItem("learn_mode", newMode)
    } catch {}
    clearPendingTimers()
    setQueue(buildQueue(flashcards, newTags, gameInputMode, newMode, newRandom, forceAll))
    setCompletedCount(0)
    setShowAnswer(false)
    setMeaningIdx(0)
  }

  const handleRate = useCallback((rating: Rating) => {
    if (!current) return

    let currentSrs = current.card.srs
    if (current.type === "meaning") {
      currentSrs = current.highlight.srs
    } else if (current.type === "phrase" || current.type === "phrase_meaning") {
      currentSrs = current.phrase.srs
    }

    const { srsData } = calculateNextSRS(rating, currentSrs, settings)

    if (current.type === "meaning") {
      updateHighlightSRS(current.card.id, current.highlight.id, srsData)
    } else if (current.type === "phrase" || current.type === "phrase_meaning") {
      updatePhraseSRS(current.card.id, current.phrase.phrase, srsData)
    } else {
      updateFlashcardSRS(current.card.id, srsData)
    }
    
    setStats(s => ({ ...s, [rating]: s[rating] + 1 }))
    setShowAnswer(false)
    setMeaningIdx(0)
    
    const captured = current
    
    // Remove current card from queue
    setQueue(prev => prev.slice(1))

    // Schedule re-insertion after interval
    const delayMs = rating === "again" ? settings.againMs
                  : rating === "hard"  ? settings.hardMs
                  : rating === "good"  ? settings.goodMs
                  : settings.easyMs

    setCompletedCount(c => c + 1)

    // Only reschedule within same session (cap at 24h)
    if (delayMs <= 24 * 60 * 60 * 1000) {
      const timerId = setTimeout(() => {
        // Insert at index 1 so the user finishes the active card before seeing the rescheduled card!
        setQueue(prev => prev.length > 0 ? [prev[0], captured, ...prev.slice(1)] : [captured])
        setCompletedCount(c => Math.max(0, c - 1))
        pendingTimers.current.delete(captured.card.id)
      }, delayMs)
      // Cancel any existing timer for this card
      const existing = pendingTimers.current.get(captured.card.id)
      if (existing) clearTimeout(existing)
      pendingTimers.current.set(captured.card.id, timerId)
    }
  }, [current, settings, updateHighlightSRS, updateFlashcardSRS, updatePhraseSRS])

  const handleRestart = () => {
    setStats({ again: 0, hard: 0, good: 0, easy: 0 })
    resetSession(selectedTags, learnMode, isRandom, true)
  }

  // Keyboard shortcuts (Space/Enter to flip, 1-4 to rate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSettings || showStatsModal || !!popupCard || !current) return
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === " " || e.key === "Enter") {
        if (!showAnswer) {
          e.preventDefault()
          setShowAnswer(true)
        }
      } else if (e.key === "1") {
        e.preventDefault()
        handleRate("again")
      } else if (e.key === "2") {
        e.preventDefault()
        handleRate("hard")
      } else if (e.key === "3") {
        e.preventDefault()
        handleRate("good")
      } else if (e.key === "4") {
        e.preventDefault()
        handleRate("easy")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showSettings, showStatsModal, popupCard, current, showAnswer, handleRate])

  const modeOptions: { id: LearnCardMode; label: string }[] = [
    { id: "meanings", label: "Meanings" },
    { id: "words", label: "Words" },
    { id: "phrases", label: "Phrases" },
    { id: "phrase_meanings", label: "Phrase Meanings" },
  ]

  const currentModeLabel = modeOptions.find(m => m.id === learnMode)?.label || "Meanings"

  // ── Done screen ───────────────────────────────────────────────
  const total = stats.again + stats.hard + stats.good + stats.easy
  if (!current) {
    return (
      <div className="max-w-3xl mx-auto py-8 flex flex-col gap-4 animate-in fade-in">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <TagSelector allTags={allTags} selected={selectedTags} onChange={tags => { setSelectedTags(tags); resetSession(tags, learnMode, isRandom) }} />
          <button onClick={() => { const r = !isRandom; setIsRandom(r); resetSession(selectedTags, learnMode, r) }} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${isRandom ? "bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}>
            <Shuffle size={15} /> Random
          </button>
          
          {/* Mode Selector */}
          <div className="relative" ref={modeDropdownRef}>
            <button
              onClick={() => setModeDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50"
            >
              <ArrowLeftRight size={15} /> {currentModeLabel}
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${modeDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {modeDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[170px] p-1.5 space-y-0.5">
                {modeOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setLearnMode(opt.id)
                      setModeDropdownOpen(false)
                      resetSession(selectedTags, opt.id, isRandom)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${
                      learnMode === opt.id
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                    {learnMode === opt.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-center py-12 flex flex-col items-center">
          <div className="text-7xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">All Done!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">No more cards due for today in this mode.</p>

          {total > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 mb-6 w-full max-w-xs grid grid-cols-4 gap-3 text-sm">
              {[
                { label: "Again", val: stats.again, cls: "text-red-600 dark:text-red-400" },
                { label: "Hard", val: stats.hard, cls: "text-orange-600 dark:text-orange-400" },
                { label: "Good", val: stats.good, cls: "text-green-600 dark:text-green-400" },
                { label: "Easy", val: stats.easy, cls: "text-blue-600 dark:text-blue-400" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="text-center">
                  <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleRestart} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors">
            <RotateCcw size={18} /> Start Over
          </button>
        </div>
      </div>
    )
  }

  const currentSrs = current.type === "meaning" ? current.highlight.srs
    : current.type === "phrase" || current.type === "phrase_meaning" ? current.phrase.srs
    : current.card.srs
  const previews = previewIntervals(currentSrs, settings)

  // Word mode: navigate meanings
  const wordMeanings = current.type === "word" ? (current.card.highlights || []) : []
  const shownMeaning = wordMeanings[meaningIdx]

  const cardTypeBadge = () => {
    const srs = currentSrs
    if (!srs || srs.reps === 0) return { label: "New", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
    if (!srs || srs.reps < 2) return { label: "Learning", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" }
    return { label: "Review", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
  }
  const badge = cardTypeBadge()

  return (
    <div className="max-w-3xl mx-auto py-4 pb-36 md:pb-28 flex flex-col gap-3 animate-in fade-in">

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <TagSelector allTags={allTags} selected={selectedTags} onChange={tags => { setSelectedTags(tags); resetSession(tags, learnMode, isRandom) }} />
        <button
          onClick={() => { const r = !isRandom; setIsRandom(r); resetSession(selectedTags, learnMode, r) }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${isRandom ? "bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
        >
          <Shuffle size={15} /> Random
        </button>

        {/* Mode Selector */}
        <div className="relative" ref={modeDropdownRef}>
          <button
            onClick={() => setModeDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50"
          >
            <ArrowLeftRight size={15} /> {currentModeLabel}
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${modeDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {modeDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[170px] p-1.5 space-y-0.5">
              {modeOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setLearnMode(opt.id)
                    setModeDropdownOpen(false)
                    resetSession(selectedTags, opt.id, isRandom)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${
                    learnMode === opt.id
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                  {learnMode === opt.id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowSettings(s => !s)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showSettings ? "bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500"}`}
        >
          <Settings2 size={15} />
        </button>
        <button
          onClick={() => setShowStatsModal(true)}
          className="flex items-center p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Learning Statistics"
        >
          <BarChart2 size={18} />
        </button>
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-2 flex justify-around text-xs">
          {[
            { label: "Again", val: stats.again, cls: "text-red-500" },
            { label: "Hard", val: stats.hard, cls: "text-orange-500" },
            { label: "Good", val: stats.good, cls: "text-green-500" },
            { label: "Easy", val: stats.easy, cls: "text-blue-500" },
          ].map(({ label, val, cls }) => (
            <div key={label} className="text-center">
              <p className={`font-bold ${cls}`}>{val}</p>
              <p className="text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel settings={settings} onChange={handleSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / (completedCount + queue.length)) * 100}%` }}
        />
      </div>

      {/* Main Review Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative">
        {/* Badge */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
            {currentSrs?.lastRating && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                currentSrs.lastRating === 'again' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                currentSrs.lastRating === 'hard' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' :
                currentSrs.lastRating === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' :
                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
              }`}>
                Last: {currentSrs.lastRating.toUpperCase()}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{completedCount + 1} / {completedCount + queue.length}</span>
        </div>

        {/* Front */}
        <div className="px-6 py-8 text-center min-h-[140px] flex flex-col justify-center items-center">
          {learnMode === "meanings" ? (
            // Front = Meaning only (example sentence hidden)
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Meaning</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap max-w-xl">
                {(current as MeaningItem).highlight.meaning}
              </p>
            </>
          ) : learnMode === "words" ? (
            // Front = English word + POS + Phonetic
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Vocabulary Word</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words">
                  {(current as WordItem).card.sentence}
                </p>
                <button
                  onClick={() => speakEnglish((current as WordItem).card.sentence)}
                  className="text-gray-300 hover:text-purple-500 transition-colors shrink-0"
                  title="Pronounce"
                >
                  <Volume2 size={22} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                {((current as WordItem).card.partOfSpeech || (current as WordItem).card.posEntries?.[0]?.partOfSpeech) && (
                  <span className="text-xs italic text-purple-600 dark:text-purple-400 font-medium">
                    {(current as WordItem).card.partOfSpeech || (current as WordItem).card.posEntries?.[0]?.partOfSpeech}
                  </span>
                )}
                {((current as WordItem).card.phonetic || (current as WordItem).card.phonetics?.[0]?.ipa || (current as WordItem).card.posEntries?.[0]?.phonetic) && (
                  <span className="text-xs font-mono text-gray-400">
                    /{((current as WordItem).card.phonetic || (current as WordItem).card.phonetics?.[0]?.ipa || (current as WordItem).card.posEntries?.[0]?.phonetic)?.replace(/^\/|\/$/g, "")}/
                  </span>
                )}
              </div>
            </>
          ) : learnMode === "phrases" ? (
            // Front = Phrase / Idiom
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Phrase & Idiom</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words">
                  {(current as PhraseItem).phrase.phrase}
                </p>
                <button
                  onClick={() => speakEnglish((current as PhraseItem).phrase.phrase)}
                  className="text-gray-300 hover:text-purple-500 transition-colors shrink-0"
                  title="Pronounce"
                >
                  <Volume2 size={22} />
                </button>
              </div>
            </>
          ) : (
            // Front = Phrase Meaning
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Meaning of Phrase</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap max-w-xl">
                {(current as PhraseMeaningItem).phrase.translation}
              </p>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-700 mx-6" />

        {/* Back — tap to reveal */}
        <div
          className="cursor-pointer"
          onClick={() => !showAnswer && setShowAnswer(true)}
        >
          {!showAnswer ? (
            <div className="px-6 py-5 text-center text-sm text-gray-400 dark:text-gray-500 select-none hover:text-purple-600 transition-colors">
              Tap to reveal answer
            </div>
          ) : (
            <div className="px-6 py-6 animate-in fade-in">
              {learnMode === "meanings" ? (
                // Back = Word + POS + Examples + Tags
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-medium">Word</p>
                    <div className="flex items-center justify-center gap-3">
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        {(current as MeaningItem).word}
                      </p>
                      <button onClick={() => speakEnglish((current as MeaningItem).word)} className="text-gray-300 hover:text-purple-500 transition-colors">
                        <Volume2 size={20} />
                      </button>
                    </div>
                  </div>

                  {((current as MeaningItem).card.partOfSpeech || (current as MeaningItem).card.posEntries?.[0]?.partOfSpeech) && (
                    <p className="text-xs italic text-gray-400">
                      {(current as MeaningItem).card.partOfSpeech || (current as MeaningItem).card.posEntries?.[0]?.partOfSpeech}
                    </p>
                  )}

                  {(current as MeaningItem).highlight.example && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl max-w-lg mx-auto text-left border border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400 uppercase font-medium mb-1">Example</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {(current as MeaningItem).highlight.example}
                      </p>
                    </div>
                  )}

                  {getCardTags((current as MeaningItem).card).length > 0 && (
                    <div className="flex items-center gap-1.5 justify-center flex-wrap pt-1">
                      {getCardTags((current as MeaningItem).card).map(t => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : learnMode === "words" ? (
                // Back = Meanings list
                <div className="space-y-3">
                  {wordMeanings.length > 1 && (
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMeaningIdx(i => Math.max(0, i - 1)) }}
                        disabled={meaningIdx === 0}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span className="text-xs text-gray-400 font-medium">
                        {meaningIdx + 1} / {wordMeanings.length}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMeaningIdx(i => Math.min(wordMeanings.length - 1, i + 1)) }}
                        disabled={meaningIdx === wordMeanings.length - 1}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                  {shownMeaning ? (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-medium">Meaning</p>
                      <p className="text-xl font-semibold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap">
                        {shownMeaning.meaning}
                      </p>
                      {shownMeaning.example && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic break-words">
                          {shownMeaning.example}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-400">
                      {(current as WordItem).card.translation || "No definition available"}
                    </div>
                  )}
                  {getCardTags((current as WordItem).card).length > 0 && (
                    <div className="flex items-center gap-1.5 justify-center flex-wrap pt-2">
                      {getCardTags((current as WordItem).card).map(t => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : learnMode === "phrases" ? (
                // Back = Translation / Meaning of phrase
                <div className="text-center space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-medium">Translation / Meaning</p>
                  <p className="text-xl font-semibold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap">
                    {(current as PhraseItem).phrase.translation}
                  </p>
                  {getCardTags((current as PhraseItem).card).length > 0 && (
                    <div className="flex items-center gap-1.5 justify-center flex-wrap pt-2">
                      {getCardTags((current as PhraseItem).card).map(t => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Back = Phrase text
                <div className="text-center space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-medium">Phrase / Idiom</p>
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {(current as PhraseMeaningItem).phrase.phrase}
                    </p>
                    <button onClick={() => speakEnglish((current as PhraseMeaningItem).phrase.phrase)} className="text-gray-300 hover:text-purple-500 transition-colors">
                      <Volume2 size={20} />
                    </button>
                  </div>
                  {getCardTags((current as PhraseMeaningItem).card).length > 0 && (
                    <div className="flex items-center gap-1.5 justify-center flex-wrap pt-2">
                      {getCardTags((current as PhraseMeaningItem).card).map(t => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom-left popup card button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setPopupCard(current.card)
          }}
          className="absolute bottom-3 left-3 p-2 rounded-xl text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 transition-colors z-20 cursor-pointer"
          title="View full card details"
        >
          <BookOpen size={18} />
        </button>
      </div>

      {/* Floating Fixed Bottom Actions Bar — always docked at bottom without moving, NO numbers [1][2][3][4] */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 py-2.5 sm:py-3 px-3 sm:px-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-700/80 shadow-lg">
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-2 sm:gap-3">
          {([
            { r: "again" as Rating, label: "Again", bg: "bg-red-50 hover:bg-red-100 dark:bg-red-900/25 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/40" },
            { r: "hard" as Rating, label: "Hard", bg: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/25 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/40" },
            { r: "good" as Rating, label: "Good", bg: "bg-green-50 hover:bg-green-100 dark:bg-green-900/25 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200/50 dark:border-green-800/40" },
            { r: "easy" as Rating, label: "Easy", bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40" },
          ]).map(({ r, label, bg }) => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`flex flex-col items-center justify-center rounded-xl sm:rounded-2xl py-2 sm:py-2.5 px-1 transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] ${bg}`}
            >
              <span className="text-sm sm:text-base font-bold">{label}</span>
              <span className="text-[11px] sm:text-xs mt-0.5 opacity-75 font-medium">{previews[r]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Modal */}
      {showStatsModal && (
        <LearnStatsModal
          stats={stats}
          flashcards={flashcards}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {/* Card Detail Popup Modal */}
      <CardDetailModal
        card={popupCard}
        isOpen={!!popupCard}
        onClose={() => setPopupCard(null)}
      />
    </div>
  )
}

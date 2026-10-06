import { useState, useMemo, useCallback, useEffect } from 'react'
import { RotateCcw, Volume2, BarChart2, Settings2, ChevronLeft, ChevronRight, Shuffle, ArrowLeftRight, Tag as TagIcon, ChevronDown, Check, X } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, Highlight } from '../store'
import { speakEnglish, extractWordText } from '../utils'
import {
  previewIntervals, calculateNextSRS, Rating,
  LearnSettings, DEFAULT_LEARN_SETTINGS, parseIntervalStr, msToStr
} from '../utils/srs'

const LS_KEY = 'learn_settings'

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
interface MeaningItem { // Meaning mode: one per highlight
  type: 'meaning'
  card: Flashcard
  highlight: Highlight
  word: string
}
interface WordItem { // Word mode: one per flashcard
  type: 'word'
  card: Flashcard
}
type QueueItem = MeaningItem | WordItem

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
  gameInputMode: 'word' | 'sentence',
  mode: 'word' | 'meaning',
  isRandom: boolean
): QueueItem[] {
  let filtered = tags.length > 0
    ? flashcards.filter(f => getCardTags(f).some(t => tags.includes(t)))
    : flashcards
  filtered = getCardsForMode(filtered, gameInputMode)

  const now = Date.now()
  const items: QueueItem[] = []

  if (mode === 'meaning') {
    filtered.forEach(card => {
      card.highlights.forEach(highlight => {
        const srs = highlight.srs
        if (srs && srs.due > now) return // not due
        const word = extractWordText(card.sentence, highlight.wordIndices)
        items.push({ type: 'meaning', card, highlight, word })
      })
    })
  } else {
    filtered.forEach(card => {
      if (card.highlights.length === 0) return
      const srs = card.srs
      if (srs && srs.due > now) return // not due
      items.push({ type: 'word', card })
    })
  }

  return isRandom ? shuffleArr(items) : items
}

// ── Settings panel ────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose }: {
  settings: LearnSettings
  onChange: (s: LearnSettings) => void
  onClose: () => void
}) {
  const fields: { key: keyof LearnSettings; label: string; color: string }[] = [
    { key: 'againMs', label: 'Again', color: 'text-red-600' },
    { key: 'hardMs', label: 'Hard', color: 'text-orange-600' },
    { key: 'goodMs', label: 'Good', color: 'text-green-600' },
    { key: 'easyMs', label: 'Easy', color: 'text-blue-600' },
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
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors[f.key] ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
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

// ── Tag selector ──────────────────────────────────────────────────
function TagSelector({ allTags, selected, onChange }: {
  allTags: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <TagIcon size={15} className="text-purple-500" />
        {selected.length === 0 ? 'All tags' : `${selected.length} tag${selected.length > 1 ? 's' : ''}`}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[180px] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => { onChange([]); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${selected.length === 0 ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              All tags {selected.length === 0 && <Check size={14} />}
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${selected.includes(tag) ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
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
  const { flashcards, gameInputMode, updateHighlightSRS, updateFlashcardSRS } = useFlashcardStore()
  const [settings, setSettings] = useState<LearnSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [learnMode, setLearnMode] = useState<'word' | 'meaning'>('meaning')
  const [isRandom, setIsRandom] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sessionKey, setSessionKey] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [meaningIdx, setMeaningIdx] = useState(0) // for word mode: which meaning is shown
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })

  const allTags = useMemo(() =>
    Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).sort()
  , [flashcards])

  const queue = useMemo(
    () => buildQueue(flashcards, selectedTags, gameInputMode, learnMode, isRandom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flashcards, selectedTags, gameInputMode, learnMode, isRandom, sessionKey]
  )

  const current = queue[currentIdx]

  // Reset when queue changes
  useEffect(() => {
    setCurrentIdx(0)
    setShowAnswer(false)
    setMeaningIdx(0)
  }, [sessionKey, learnMode, isRandom])

  const handleSettings = (s: LearnSettings) => {
    setSettings(s)
    saveSettings(s)
  }

  const handleRate = useCallback((rating: Rating) => {
    if (!current) return
    const { srsData } = calculateNextSRS(rating, current.type === 'meaning' ? current.highlight.srs : current.card.srs, settings)

    if (current.type === 'meaning') {
      updateHighlightSRS(current.card.id, current.highlight.id, srsData)
    } else {
      updateFlashcardSRS(current.card.id, srsData)
    }
    setStats(s => ({ ...s, [rating]: s[rating] + 1 }))
    setShowAnswer(false)
    setMeaningIdx(0)
    setCurrentIdx(i => i + 1)
  }, [current, settings, updateHighlightSRS, updateFlashcardSRS])

  const handleRestart = () => {
    setStats({ again: 0, hard: 0, good: 0, easy: 0 })
    setCurrentIdx(0)
    setShowAnswer(false)
    setMeaningIdx(0)
    setSessionKey(k => k + 1)
  }

  // ── Done screen ───────────────────────────────────────────────
  const total = stats.again + stats.hard + stats.good + stats.easy
  if (!current || currentIdx >= queue.length) {
    return (
      <div className="max-w-xl mx-auto py-8 flex flex-col gap-4 animate-in fade-in">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <TagSelector allTags={allTags} selected={selectedTags} onChange={setSelectedTags} />
          <button onClick={() => setIsRandom(r => !r)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${isRandom ? 'bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
            <Shuffle size={15} /> Random
          </button>
          <button onClick={() => setLearnMode(m => m === 'meaning' ? 'word' : 'meaning')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300`}>
            <ArrowLeftRight size={15} /> {learnMode === 'meaning' ? 'Meaning → Word' : 'Word → Meaning'}
          </button>
        </div>

        <div className="text-center py-12 flex flex-col items-center">
          <div className="text-7xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">All Done!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">No more cards due for today.</p>

          {total > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 mb-6 w-full max-w-xs grid grid-cols-4 gap-3 text-sm">
              {[
                { label: 'Again', val: stats.again, cls: 'text-red-600 dark:text-red-400' },
                { label: 'Hard', val: stats.hard, cls: 'text-orange-600 dark:text-orange-400' },
                { label: 'Good', val: stats.good, cls: 'text-green-600 dark:text-green-400' },
                { label: 'Easy', val: stats.easy, cls: 'text-blue-600 dark:text-blue-400' },
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

  const previews = previewIntervals(
    current.type === 'meaning' ? current.highlight.srs : current.card.srs,
    settings
  )

  // Word mode: navigate meanings
  const wordMeanings = current.type === 'word' ? current.card.highlights : []
  const shownMeaning = wordMeanings[meaningIdx]

  const cardTypeBadge = () => {
    const srs = current.type === 'meaning' ? current.highlight.srs : current.card.srs
    if (!srs || srs.reps === 0) return { label: 'New', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' }
    if (!srs || srs.reps < 2) return { label: 'Learning', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
    return { label: 'Review', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
  }
  const badge = cardTypeBadge()

  return (
    <div className="max-w-xl mx-auto py-4 flex flex-col gap-3 animate-in fade-in">

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <TagSelector allTags={allTags} selected={selectedTags} onChange={tags => { setSelectedTags(tags); setSessionKey(k => k + 1) }} />
        <button
          onClick={() => { setIsRandom(r => !r); setSessionKey(k => k + 1) }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${isRandom ? 'bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
        >
          <Shuffle size={15} /> Random
        </button>
        <button
          onClick={() => { setLearnMode(m => m === 'meaning' ? 'word' : 'meaning'); setSessionKey(k => k + 1) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50"
        >
          <ArrowLeftRight size={15} /> {learnMode === 'meaning' ? 'Meaning → Word' : 'Word → Meaning'}
        </button>
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showSettings ? 'bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}
        >
          <Settings2 size={15} />
        </button>
        <button onClick={() => setShowSettings(false)} className="flex items-center">
          <BarChart2 size={18} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
        </button>
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-2 flex justify-around text-xs">
          {[
            { label: 'Again', val: stats.again, cls: 'text-red-500' },
            { label: 'Hard', val: stats.hard, cls: 'text-orange-500' },
            { label: 'Good', val: stats.good, cls: 'text-green-500' },
            { label: 'Easy', val: stats.easy, cls: 'text-blue-500' },
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
          style={{ width: `${(currentIdx / queue.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Badge */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{currentIdx + 1} / {queue.length}</span>
        </div>

        {/* Front */}
        <div className="px-6 py-8 text-center">
          {learnMode === 'meaning' ? (
            // Front = meaning, need to remember word
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Meaning?</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">
                {(current as MeaningItem).highlight.meaning}
              </p>
              {(current as MeaningItem).highlight.example && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 italic">
                  {(current as MeaningItem).highlight.example}
                </p>
              )}
            </>
          ) : (
            // Front = word, need to remember meaning
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">What does this mean?</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words">
                  {(current as WordItem).card.sentence}
                </p>
                <button
                  onClick={() => speakEnglish((current as WordItem).card.sentence)}
                  className="text-gray-300 hover:text-purple-500 transition-colors shrink-0"
                >
                  <Volume2 size={22} />
                </button>
              </div>
              {getCardTags((current as WordItem).card).length > 0 && (
                <p className="text-xs text-gray-400 mt-2">{getCardTags((current as WordItem).card).join(', ')}</p>
              )}
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
            <div className="px-6 py-4 text-center text-sm text-gray-400 dark:text-gray-500 select-none">
              Tap to reveal answer
            </div>
          ) : (
          <div className="px-6 py-6">
            {learnMode === 'meaning' ? (
              // Back = the word
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Word</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {(current as MeaningItem).word}
                  </p>
                  <button onClick={() => speakEnglish((current as MeaningItem).word)} className="text-gray-300 hover:text-purple-500 transition-colors">
                    <Volume2 size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {(current as MeaningItem).card.sentence !== (current as MeaningItem).word
                    ? (current as MeaningItem).card.sentence
                    : ''}
                </p>
              </div>
            ) : (
              // Back = meanings with left/right navigation
              <>
                {wordMeanings.length > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setMeaningIdx(i => Math.max(0, i - 1))}
                      disabled={meaningIdx === 0}
                      className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-xs text-gray-400 font-medium">
                      {meaningIdx + 1} / {wordMeanings.length}
                    </span>
                    <button
                      onClick={() => setMeaningIdx(i => Math.min(wordMeanings.length - 1, i + 1))}
                      disabled={meaningIdx === wordMeanings.length - 1}
                      className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                {shownMeaning && (
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Meaning</p>
                    <p className="text-xl font-semibold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap">
                      {shownMeaning.meaning}
                    </p>
                    {shownMeaning.example && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 italic break-words">
                        {shownMeaning.example}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </div>

        {/* Actions — always visible */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-4 gap-2">
            {([
              { r: 'again' as Rating, label: 'Again', bg: 'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400' },
              { r: 'hard' as Rating, label: 'Hard', bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400' },
              { r: 'good' as Rating, label: 'Good', bg: 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400' },
              { r: 'easy' as Rating, label: 'Easy', bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
            ]).map(({ r, label, bg }) => (
              <button
                key={r}
                onClick={() => handleRate(r)}
                className={`flex flex-col items-center rounded-xl py-3 px-1 transition-colors ${bg}`}
              >
                <span className="text-sm font-bold">{label}</span>
                <span className="text-xs mt-0.5 opacity-70">{previews[r]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

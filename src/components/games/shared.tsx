import { useState, useEffect, useRef, useMemo, ReactNode } from 'react'
import { ArrowLeft, RefreshCcw, BookOpen, Timer } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, normalizePhraseItem } from '../../store'
import { extractWordText } from '../../utils'

export type Note = {
  id: string
  word: string
  meaning: string
  sentence: string
  cardId: string
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useNotes(seed: number, allHighlights?: boolean, sourceMode?: 'highlights' | 'phrases'): Note[] {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  return useMemo(() => {
    const notes: Note[] = []
    let filtered = activeTags.length > 0
      ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t)))
      : flashcards
      
    filtered = getCardsForMode(filtered, gameInputMode)
    filtered.forEach(card => {
      if (sourceMode === 'phrases') {
        const phrases = card.phrasesAndIdioms || []
        phrases.forEach((p, idx) => {
          const norm = normalizePhraseItem(p)
          if (!norm.phrase) return
          notes.push({
            id: norm.id || `${card.id}-pi-${idx}`,
            word: norm.phrase,
            meaning: norm.translation || norm.phrase,
            sentence: norm.phrase,
            cardId: card.id,
          })
        })
        return
      }

      const highlights = card.highlights || []
      if (highlights.length === 0) return
      
      if (allHighlights) {
        highlights.forEach(h => {
          notes.push({
            id: h.id,
            word: extractWordText(card.sentence, h.wordIndices) || card.sentence,
            meaning: h.meaning,
            sentence: card.sentence,
            cardId: card.id,
          })
        })
      } else {
        let selectedHighlight = highlights[0]
        if (highlights.length > 1) {
          const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
          selectedHighlight = highlights[randIndex]
        }
        
        notes.push({
          id: selectedHighlight.id,
          word: extractWordText(card.sentence, selectedHighlight.wordIndices) || card.sentence,
          meaning: selectedHighlight.meaning,
          sentence: card.sentence,
          cardId: card.id,
        })
      }
    })
    return shuffle(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags, gameInputMode, allHighlights, sourceMode])
}

export function EmptyState({ onExit, text }: { onExit: () => void, text?: string }) {
  const mode = useFlashcardStore.getState().gameInputMode
  const defaultText = mode === 'word' ? 'No suitable flashcards found.' : 'No notes found. Highlight words first!'
  const display = text || defaultText
  return (
    <div className="text-center text-gray-500 dark:text-gray-400 py-20">
      <p>{display}</p>
      <button onClick={onExit} className="mt-4 text-purple-600 hover:underline">Go back</button>
    </div>
  )
}

export function ResultScreen({
  lines,
  onExit,
  onAgain,
  correct,
  wrong,
  skipped,
  title = "Game Complete!"
}: {
  lines?: ReactNode
  onExit: () => void
  onAgain: () => void
  correct?: number
  wrong?: number
  skipped?: number
  title?: string
}) {
  const total = (correct ?? 0) + (wrong ?? 0) + (skipped ?? 0)
  const accuracy = total > 0 ? Math.round(((correct ?? 0) / total) * 100) : null

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in flex flex-col items-center text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center shadow-inner">
          <span className="text-4xl">🏆</span>
        </div>
        {accuracy !== null && (
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
            {accuracy}%
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{title}</h2>
      {lines && <div className="text-gray-500 dark:text-gray-400 text-sm mb-4">{lines}</div>}

      {(correct !== undefined || wrong !== undefined || skipped !== undefined) && (
        <div className="grid grid-cols-3 gap-3 w-full my-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{correct ?? 0}</span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">Correct</span>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{wrong ?? 0}</span>
            <span className="text-xs font-medium text-rose-700 dark:text-rose-300 mt-0.5">Wrong</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{skipped ?? 0}</span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 mt-0.5">Skipped</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 w-full mt-2">
        <button
          onClick={onExit}
          className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors text-sm"
        >
          Menu
        </button>
        <button
          onClick={onAgain}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-purple-500/20 transition-all text-sm flex items-center justify-center gap-2"
        >
          <RefreshCcw size={16} /> Play Again
        </button>
      </div>
    </div>
  )
}

export interface UseGameTimerReturn {
  timeLeft: number
  duration: number
  isUnlimited: boolean
  isRunning: boolean
  addTime: (seconds: number) => void
  resetTimer: (newSeconds?: number) => void
  reset: (newSeconds?: number) => void
  setDuration: (seconds: number) => void
  setIsUnlimited: (val: boolean) => void
  toggleUnlimited: () => void
  pause: () => void
  resume: () => void
}

export function useGameTimer({
  initialSeconds,
  initialDuration,
  onTimeUp,
  autoStart = true,
  enabled = true,
}: {
  initialSeconds?: number
  initialDuration?: number
  onTimeUp?: () => void
  autoStart?: boolean
  enabled?: boolean
}): UseGameTimerReturn {
  const init = initialDuration ?? initialSeconds ?? 15
  const [duration, setDurationState] = useState(init)
  const [isUnlimited, setIsUnlimitedState] = useState(false)
  const [timeLeft, setTimeLeft] = useState(init)
  const [isRunning, setIsRunning] = useState(autoStart)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  useEffect(() => {
    if (isUnlimited || !isRunning || !enabled) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (onTimeUpRef.current) {
            onTimeUpRef.current()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isUnlimited, isRunning, enabled, duration])

  const addTime = (secs: number) => {
    if (isUnlimited) return
    setTimeLeft(prev => Math.max(0, prev + secs))
  }

  const resetTimer = (newSeconds?: number) => {
    const s = newSeconds !== undefined ? newSeconds : duration
    setTimeLeft(s)
    setIsRunning(true)
  }

  const setDuration = (secs: number) => {
    const valid = Math.max(3, secs)
    setDurationState(valid)
    setTimeLeft(valid)
    setIsUnlimitedState(false)
  }

  const toggleUnlimited = () => {
    setIsUnlimitedState(prev => {
      const next = !prev
      if (!next) {
        setTimeLeft(duration)
      }
      return next
    })
  }

  const pause = () => setIsRunning(false)
  const resume = () => setIsRunning(true)

  return {
    timeLeft,
    duration,
    isUnlimited,
    isRunning,
    addTime,
    resetTimer,
    reset: resetTimer,
    setDuration,
    setIsUnlimited: setIsUnlimitedState,
    toggleUnlimited,
    pause,
    resume,
  }
}

export function GameTimerBadge({
  timer,
  className = '',
}: {
  timer: UseGameTimerReturn
  className?: string
}) {
  const [showSettings, setShowSettings] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSettings) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSettings])

  const isLow = !timer.isUnlimited && timer.timeLeft <= 5

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowSettings(prev => !prev)}
        title="Timer Settings (Click to configure or set unlimited)"
        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
          timer.isUnlimited
            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            : isLow
            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 animate-pulse'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200/80 dark:border-gray-700 hover:border-purple-300'
        }`}
      >
        <Timer size={14} className={isLow ? 'text-rose-600' : 'text-purple-600 dark:text-purple-400'} />
        <span>{timer.isUnlimited ? '∞' : `${timer.timeLeft}s`}</span>
      </button>

      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-700 p-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs text-gray-800 dark:text-gray-200">
          <div className="flex items-center justify-between font-bold mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">
            <span>Timer Settings</span>
            <span className="text-[10px] text-gray-400">Limit</span>
          </div>

          <button
            type="button"
            onClick={() => {
              timer.toggleUnlimited()
              setShowSettings(false)
            }}
            className={`w-full py-1.5 px-2.5 rounded-xl font-semibold flex items-center justify-between mb-2 transition-colors cursor-pointer ${
              timer.isUnlimited
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <span>Unlimited mode</span>
            <span className="text-base font-bold">∞</span>
          </button>

          <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1">Presets:</div>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {[10, 15, 20, 30, 60, 90, 120, 180].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  timer.setDuration(s)
                  setShowSettings(false)
                }}
                className={`py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !timer.isUnlimited && timer.duration === s
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
            <span className="text-[11px] text-gray-400">Custom:</span>
            <input
              type="number"
              min="3"
              max="600"
              placeholder="sec"
              defaultValue={timer.duration}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = Number((e.target as HTMLInputElement).value)
                  if (val > 0) {
                    timer.setDuration(val)
                    setShowSettings(false)
                  }
                }
              }}
              className="w-16 px-2 py-1 rounded-lg text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-center font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-[11px] text-gray-400">sec</span>
          </div>
        </div>
      )}
    </div>
  )
}

export interface GameHeaderProps {
  onExit: () => void
  title?: string
  center?: ReactNode
  right?: ReactNode
  timer?: UseGameTimerReturn
  current?: number
  total?: number
  progress?: number
  className?: string
}

export function GameHeader({
  onExit,
  title,
  center,
  right,
  timer,
  current,
  total,
  progress,
  className = ''
}: GameHeaderProps) {
  const calcProgress = progress !== undefined
    ? progress
    : (current !== undefined && total && total > 0 ? Math.min(100, Math.round(((current + 1) / total) * 100)) : undefined)

  return (
    <div className={`w-full mb-3 sm:mb-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onExit}
          title="Back to games menu"
          className="p-1.5 sm:p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span className="text-xs font-semibold hidden sm:inline">Exit</span>
        </button>

        <div className="flex items-center justify-center flex-1 min-w-0">
          {center ? center : title ? (
            <h2 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100 truncate text-center">
              {title}
            </h2>
          ) : null}
        </div>

        <div className="flex items-center gap-2 justify-end flex-shrink-0">
          {timer && <GameTimerBadge timer={timer} />}
          {right}
        </div>
      </div>

      {calcProgress !== undefined && (
        <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${calcProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function BackBar({ onExit, right }: { onExit: () => void, right?: ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-6">
      <button onClick={onExit} className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5">
        <ArrowLeft size={20} />
        <span className="text-xs font-semibold hidden sm:inline">Exit</span>
      </button>
      {right ?? <div className="w-6" />}
    </div>
  )
}

export function BottomCounter({ children }: { children: ReactNode }) {
  return <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-4">{children}</p>
}

export const softBtn = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"

export function RootCardButton({ onClick, className = '' }: { onClick: () => void, className?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title="View original flashcard"
      className={`p-2 rounded-xl text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 transition-colors z-10 ${className}`}
    >
      <BookOpen size={18} />
    </button>
  )
}

export function GameStatsBar({
  correct,
  wrong,
  skipped,
  current,
  total,
  className = ''
}: {
  correct: number
  wrong: number
  skipped: number
  current?: number
  total?: number
  className?: string
}) {
  return (
    <div className={`flex items-center justify-center gap-4 sm:gap-6 mt-4 px-2 text-xs sm:text-sm font-medium ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {correct} correct
      </span>
      <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {wrong} wrong
      </span>
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {skipped} skip
      </span>
      {total !== undefined && (
        <span className="tabular-nums text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
          {current !== undefined ? current : 0} / {total}
        </span>
      )}
    </div>
  )
}

export { CardDetailModal } from '../CardDetailModal'
export type { CardDetailModalProps } from '../CardDetailModal'


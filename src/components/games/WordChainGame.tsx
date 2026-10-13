import { useState, useMemo, useEffect, useRef } from 'react'
import { Link2, Volume2, Sparkles, Zap, Send, RotateCcw } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, CardDetailModal, GameHeader, useGameTimer, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

interface ChainItem {
  word: string
  clean: string
  meaning: string
  cardId: string
  pointsEarned: number
}

const BONUS_TIME_PER_WORD = 5

export function WordChainGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed] = useState(0)
  const allNotes = useNotes(seed, true)

  // Build clean vocabulary map from user library
  const { vocabMap, wordList } = useMemo(() => {
    const map = new Map<string, Note>()
    for (const note of allNotes) {
      const clean = note.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (clean.length >= 2 && !map.has(clean)) {
        map.set(clean, note)
      }
    }
    const list = Array.from(map.keys())
    return { vocabMap: map, wordList: list }
  }, [allNotes])

  // Game state
  const [chain, setChain] = useState<ChainItem[]>([])
  const [inputVal, setInputVal] = useState('')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  const [activeModalCardId, setActiveModalCardId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const chainEndRef = useRef<HTMLDivElement>(null)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Current active word & required starting letter
  const currentItem = chain[chain.length - 1] ?? null
  const requiredLetter = useMemo(() => {
    if (!currentItem) return ''
    return currentItem.clean.slice(-1)
  }, [currentItem])

  // Words already used in this chain
  const usedWords = useMemo(() => {
    return new Set(chain.map(item => item.clean))
  }, [chain])

  // Timer integration
  const handleTimeUp = () => {
    setIsGameOver(true)
  }

  const timer = useGameTimer({
    initialDuration: 30,
    onTimeUp: handleTimeUp,
    enabled: !isGameOver && chain.length > 0
  })

  // Start / restart game
  const startGame = () => {
    if (wordList.length === 0) return

    const candidatesWithSuccessor = wordList.filter(w => {
      const lastCh = w.slice(-1)
      return wordList.some(other => other !== w && other.startsWith(lastCh))
    })

    const pool = candidatesWithSuccessor.length > 0 ? candidatesWithSuccessor : wordList
    const starterWord = pool[Math.floor(Math.random() * pool.length)]
    const starterNote = vocabMap.get(starterWord)!

    setChain([
      {
        word: starterNote.word,
        clean: starterWord,
        meaning: starterNote.meaning,
        cardId: starterNote.cardId,
        pointsEarned: 0,
      },
    ])
    setInputVal('')
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setIsGameOver(false)
    setFeedback(null)
    setActiveModalCardId(starterNote.cardId)
    timer.reset()

    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // Initialize on mount or when words change
  useEffect(() => {
    startGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabMap])

  // Auto scroll chain to newest word
  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' })
  }, [chain])

  const showFeedbackMsg = (type: 'success' | 'error', message: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    setFeedback({ type, message })
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null)
    }, 2500)
  }

  // Handle word submission
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isGameOver || !currentItem) return

    const raw = inputVal.trim()
    const clean = raw.toLowerCase().replace(/[^a-z]/g, '')

    if (!clean) {
      showFeedbackMsg('error', 'Please enter an English word!')
      return
    }

    // Rule 1: Must start with required letter
    if (!clean.startsWith(requiredLetter)) {
      showFeedbackMsg(
        'error',
        `Word must start with "${requiredLetter.toUpperCase()}"! (You typed "${clean[0]?.toUpperCase() || ''}")`
      )
      return
    }

    // Rule 2: Cannot repeat used word
    if (usedWords.has(clean)) {
      showFeedbackMsg('error', `Word "${clean}" has already been used in this chain!`)
      return
    }

    // Rule 3: Must exist in vocabulary
    const matchedNote = vocabMap.get(clean)
    if (!matchedNote) {
      showFeedbackMsg('error', `Word "${clean}" is not in your library vocabulary!`)
      return
    }

    // Correct!
    const newStreak = streak + 1
    const pts = 10 + clean.length * 2 + Math.min(newStreak, 5) * 5
    const nextScore = score + pts

    setScore(nextScore)
    setStreak(newStreak)
    setMaxStreak(prev => Math.max(prev, newStreak))
    timer.addTime(BONUS_TIME_PER_WORD)
    setInputVal('')
    setActiveModalCardId(matchedNote.cardId)

    const newItem: ChainItem = {
      word: matchedNote.word,
      clean,
      meaning: matchedNote.meaning,
      cardId: matchedNote.cardId,
      pointsEarned: pts,
    }

    setChain(prev => [...prev, newItem])
    speakEnglish(clean)
    showFeedbackMsg('success', `+${pts} pts! Chained!`)

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  if (wordList.length < 2) {
    return <EmptyState onExit={onExit} text="At least 2 vocabulary words needed in library to play Word Chain." />
  }

  if (isGameOver) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Link2 size={36} />
          </div>

          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-1">Time's Up! Game Over</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            You built an impressive chain of words!
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-100 dark:border-purple-800/40">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold block">Score</span>
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{score}</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-100 dark:border-blue-800/40">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold block">Chain Length</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{chain.length}</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-100 dark:border-amber-800/40">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block">Max Streak</span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{maxStreak}</span>
            </div>
          </div>

          {/* Chain list review */}
          <div className="text-left mb-6 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 max-h-48 overflow-y-auto">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Chained Words ({chain.length}):
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {chain.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const found = flashcards.find(f => f.id === c.cardId)
                    if (found) setShowModalCard(found)
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-purple-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="font-semibold">{c.clean}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]">({c.meaning})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={startGame}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={18} />
              <span>Play Again</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>

        <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl sm:max-w-5xl mx-auto px-3 sm:px-6 py-2 flex flex-col items-center">
      <GameHeader 
        title="Word Chain" 
        onExit={onExit} 
        timer={timer}
      />

      {/* Top Status Bar: Score, Combo, Count */}
      <div className="w-full max-w-3xl mb-4 flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
        {/* Score & Combo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-sm">
            <Sparkles size={16} />
            <span>{score} pts</span>
          </div>
          {streak > 1 && (
            <div className="flex items-center gap-1 text-amber-500 font-semibold text-xs bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              <Zap size={13} />
              <span>x{streak} streak</span>
            </div>
          )}
        </div>

        {/* Chained count badge */}
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Chained: <span className="font-bold text-gray-800 dark:text-gray-200">{chain.length} words</span>
        </div>
      </div>

      {/* Main Chain Play Area */}
      <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-xs relative flex flex-col">
        {/* Chain Display (Horizontal Scrollable Strip) */}
        <div className="w-full mb-6">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Chain History
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-purple-200 dark:scrollbar-thumb-gray-700">
            {chain.map((item, idx) => {
              const isLast = idx === chain.length - 1
              const firstLetter = item.clean.charAt(0)
              const middleLetters = item.clean.slice(1, -1)
              const lastLetter = item.clean.slice(-1)

              return (
                <div key={idx} className="flex items-center shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = flashcards.find(f => f.id === item.cardId)
                      if (c) setShowModalCard(c)
                    }}
                    className={`min-w-[150px] sm:min-w-[170px] h-[72px] px-4 py-2.5 rounded-2xl border text-left transition-all group cursor-pointer flex flex-col justify-center shrink-0 ${
                      isLast
                        ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 ring-2 ring-purple-400/30 shadow-xs'
                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                        {item.clean.length <= 1 ? (
                          <span className="text-purple-600 dark:text-purple-400 uppercase">{item.clean}</span>
                        ) : (
                          <>
                            <span className={idx > 0 ? 'text-purple-600 dark:text-purple-400 font-extrabold underline decoration-purple-400' : ''}>
                              {firstLetter}
                            </span>
                            <span>{middleLetters}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-black underline decoration-amber-400">
                              {lastLetter}
                            </span>
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          speakEnglish(item.clean)
                        }}
                        className="opacity-60 group-hover:opacity-100 text-gray-400 hover:text-purple-600 transition-opacity p-0.5 cursor-pointer ml-auto"
                        title="Pronounce"
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[140px] mt-0.5">
                      {item.meaning}
                    </div>
                  </button>

                  {!isLast && (
                    <span className="text-gray-300 dark:text-gray-600 font-bold text-sm select-none">
                      ➜
                    </span>
                  )}
                </div>
              )
            })}
            <div ref={chainEndRef} />
          </div>
        </div>

        {/* Current Requirement Card */}
        {currentItem && (
          <div className="w-full bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-100 dark:border-purple-800/40 rounded-2xl p-5 mb-5 text-center">
            <span className="text-xs uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400 block mb-2">
              Next Letter
            </span>
            <div className="flex items-center justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-purple-200 dark:border-purple-800 flex items-center justify-center font-black text-4xl sm:text-5xl text-purple-700 dark:text-purple-300 uppercase drop-shadow-2xs">
                {requiredLetter}
              </div>
            </div>
          </div>
        )}

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`w-full mb-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full flex items-stretch gap-2 mb-4">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder={`Enter word starting with "${requiredLetter.toUpperCase()}"...`}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-800 text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 placeholder:font-normal transition-all"
            />
          </div>

          <button
            type="submit"
            className="px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Submit</span>
          </button>
        </form>

        {/* Bottom bar with card details inspection button */}
        <div className="w-full flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <div className="relative">
            <RootCardButton
              onClick={() => {
                const targetId = activeModalCardId || currentItem?.cardId
                const c = flashcards.find(f => f.id === targetId)
                if (c) setShowModalCard(c)
              }}
            />
          </div>

          <button
            type="button"
            onClick={startGame}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-medium transition-colors cursor-pointer"
          >
            New Starter Word
          </button>
        </div>
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

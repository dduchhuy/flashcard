import { useState, useMemo, useEffect, useRef } from 'react'
import { Link2, Volume2, Timer, Zap, Sparkles, Send, HelpCircle, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, CardDetailModal, GameHeader, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

interface ChainItem {
  word: string
  clean: string
  meaning: string
  cardId: string
  pointsEarned: number
}

const INITIAL_TIME_SECONDS = 25
const BONUS_TIME_PER_WORD = 5
const MAX_TIME_SECONDS = 60

export function WordChainGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed] = useState(0)
  const allNotes = useNotes(seed, true)

  // Build clean vocabulary map from user library
  // Map clean lowercase word -> Note (prefer shorter single words)
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
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME_SECONDS)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  const [activeModalCardId, setActiveModalCardId] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

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

  // Remaining eligible words that start with requiredLetter
  const eligibleNextWords = useMemo(() => {
    if (!requiredLetter) return []
    return wordList.filter(w => w.startsWith(requiredLetter) && !usedWords.has(w))
  }, [requiredLetter, wordList, usedWords])

  // Start / restart game
  const startGame = () => {
    if (wordList.length === 0) return

    // Pick a starter word that has at least 1 possible chain successor if possible
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
    setTimeLeft(INITIAL_TIME_SECONDS)
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setIsGameOver(false)
    setFeedback(null)
    setShowHint(false)
    setActiveModalCardId(starterNote.cardId)

    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // Initialize on mount or when words change
  useEffect(() => {
    startGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabMap])

  // Countdown timer
  useEffect(() => {
    if (isGameOver || chain.length === 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isGameOver, chain.length])

  // Auto scroll chain to newest word
  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' })
  }, [chain])

  // Trigger feedback with auto dismiss
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
      showFeedbackMsg('error', 'Vui lòng nhập một từ tiếng Anh!')
      return
    }

    // Rule 1: Must start with required letter
    if (!clean.startsWith(requiredLetter)) {
      showFeedbackMsg(
        'error',
        `Từ phải bắt đầu bằng chữ cái "${requiredLetter.toUpperCase()}"! (Bạn đã nhập "${clean[0]?.toUpperCase() || ''}")`
      )
      return
    }

    // Rule 2: Cannot repeat used word
    if (usedWords.has(clean)) {
      showFeedbackMsg('error', `Từ "${clean}" đã được sử dụng trong chuỗi này rồi!`)
      return
    }

    // Rule 3: Must exist in vocabulary
    const matchedNote = vocabMap.get(clean)
    if (!matchedNote) {
      showFeedbackMsg('error', `Từ "${clean}" không có trong bộ từ vựng của bạn!`)
      return
    }

    // Correct!
    const newStreak = streak + 1
    const pts = 10 + clean.length * 2 + Math.min(newStreak, 5) * 5
    const nextScore = score + pts

    setScore(nextScore)
    setStreak(newStreak)
    setMaxStreak(prev => Math.max(prev, newStreak))
    setTimeLeft(prev => Math.min(MAX_TIME_SECONDS, prev + BONUS_TIME_PER_WORD))
    setInputVal('')
    setShowHint(false)
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
    showFeedbackMsg('success', `+${pts} điểm! Nối từ thành công!`)

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  if (wordList.length < 2) {
    return <EmptyState onExit={onExit} text="Cần ít nhất 2 từ vựng tiếng Anh trong thư viện để chơi English Word Chain." />
  }

  if (isGameOver) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Link2 size={36} />
          </div>

          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-1">Hết giờ! Game Over</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Chuỗi từ của bạn đã đạt đến độ dài ấn tượng!
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-100 dark:border-purple-800/40">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold block">Điểm số</span>
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{score}</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-100 dark:border-blue-800/40">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold block">Độ dài chuỗi</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{chain.length}</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-100 dark:border-amber-800/40">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block">Combo cao nhất</span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{maxStreak}</span>
            </div>
          </div>

          {/* Chain list review */}
          <div className="text-left mb-6 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 max-h-48 overflow-y-auto">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Các từ đã nối ({chain.length}):
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
              <span>Chơi lại ván mới</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors cursor-pointer"
            >
              Về Menu
            </button>
          </div>
        </div>

        <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
      </div>
    )
  }

  // Hint candidate: Pick 1 random eligible word to give meaning hint
  const hintWord = eligibleNextWords.length > 0 ? vocabMap.get(eligibleNextWords[0]) : null

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2 flex flex-col items-center">
      <GameHeader title="English Word Chain · Nối từ tiếng Anh" onExit={onExit} />

      {/* Top Status Bar: Score, Combo, Timer */}
      <div className="w-full max-w-2xl mb-3 flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
        {/* Score & Combo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-sm">
            <Sparkles size={16} />
            <span>{score} điểm</span>
          </div>
          {streak > 1 && (
            <div className="flex items-center gap-1 text-amber-500 font-semibold text-xs bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              <Zap size={13} />
              <span>x{streak} combo</span>
            </div>
          )}
        </div>

        {/* Chained count badge */}
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Đã nối: <span className="font-bold text-gray-800 dark:text-gray-200">{chain.length} từ</span>
        </div>

        {/* Countdown Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            timeLeft <= 5
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse border border-rose-300'
              : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200'
          }`}
        >
          <Timer size={14} className={timeLeft <= 5 ? 'text-rose-600' : 'text-gray-500'} />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Main Chain Play Area */}
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-xs relative flex flex-col">
        {/* Chain Display (Horizontal Scrollable Strip) */}
        <div className="w-full mb-5">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Chuỗi từ hiện tại</span>
            <span>(Nhấn từ để xem chi tiết thẻ)</span>
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
                    className={`px-3 py-2 rounded-2xl border text-left transition-all group cursor-pointer ${
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
                        className="opacity-60 group-hover:opacity-100 text-gray-400 hover:text-purple-600 transition-opacity p-0.5 cursor-pointer"
                        title="Nghe phát âm"
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[120px] mt-0.5">
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
          <div className="w-full bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-100 dark:border-purple-800/40 rounded-2xl p-4 sm:p-5 mb-4 text-center">
            <span className="text-xs uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
              Chữ cái tiếp theo cần nối
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl sm:text-5xl font-black text-purple-700 dark:text-purple-300 uppercase tracking-tight drop-shadow-2xs">
                {requiredLetter}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Từ tiếp theo phải bắt đầu bằng chữ cái <span className="font-bold text-purple-600 dark:text-purple-400 uppercase">"{requiredLetter}"</span> và có trong bộ thẻ của bạn.
            </p>

            {/* Hint summary: how many words match */}
            <div className="mt-3 flex items-center justify-center gap-3 text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Còn <span className="font-bold text-purple-600 dark:text-purple-400">{eligibleNextWords.length}</span> từ khả dụng trong thư viện
              </span>

              {eligibleNextWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHint(h => !h)}
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  <HelpCircle size={13} />
                  <span>{showHint ? 'Ẩn gợi ý' : 'Gợi ý nghĩa'}</span>
                </button>
              )}
            </div>

            {/* Hint box if enabled */}
            {showHint && hintWord && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                💡 <span className="font-semibold">Gợi ý từ:</span> mang nghĩa "{hintWord.meaning}" (Gồm {hintWord.word.trim().replace(/[^a-z]/gi, '').length} chữ cái)
              </div>
            )}
          </div>
        )}

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`w-full mb-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full flex items-stretch gap-2 mb-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder={`Nhập từ bắt đầu bằng "${requiredLetter.toUpperCase()}"...`}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-800 text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 placeholder:font-normal transition-all"
            />
          </div>

          <button
            type="submit"
            className="px-5 sm:px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Nối từ</span>
          </button>
        </form>

        {/* Bottom bar with card details inspection button */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
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
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-medium transition-colors"
          >
            Đổi từ bắt đầu khác
          </button>
        </div>
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

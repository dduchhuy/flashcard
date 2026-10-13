import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Volume2, SkipForward } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen, shuffle } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

export function MissingLettersGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const allNotes = useNotes(seed, true)
  // Filter notes that have at least 3 letters and contain english characters
  const notes = useMemo(() => {
    return allNotes.filter(n => {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      return clean.length >= 3
    })
  }, [allNotes])

  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [combo, setCombo] = useState(0)
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  // Current note and clean target
  const note = notes[index]
  const cleanWord = useMemo(() => {
    if (!note) return ''
    return note.word.trim().toLowerCase().replace(/[^a-z]/g, '')
  }, [note])

  // Determine which indices to hide
  const hiddenIndices = useMemo(() => {
    if (!cleanWord || cleanWord.length < 3) return []
    const len = cleanWord.length
    const numToHide = len <= 4 ? 1 : len <= 7 ? 2 : 3
    
    // Pick deterministic or random indices avoiding all vowels or first letter if possible
    const candidates = Array.from({ length: len }, (_, i) => i)
    // Prefer hiding middle characters
    const shuffled = shuffle(candidates.filter(i => i > 0 && i < len - 1))
    const fallback = shuffle(candidates)
    const picked = [...shuffled, ...fallback].slice(0, numToHide).sort((a, b) => a - b)
    return Array.from(new Set(picked)).sort((a, b) => a - b)
  }, [cleanWord, index])

  // Current user filled letters for the blanks: Record<blankIndex, string>
  const [filledLetters, setFilledLetters] = useState<Record<number, string>>({})
  const [activeBlankIdx, setActiveBlankIdx] = useState<number>(0)

  // Reset state when cleanWord or hiddenIndices change
  useEffect(() => {
    setFilledLetters({})
    setActiveBlankIdx(hiddenIndices[0] ?? 0)
    setStatus('playing')
  }, [cleanWord, hiddenIndices])

  // Distractor options + missing letters for tap bubbles
  const bubbleOptions = useMemo(() => {
    if (!cleanWord || hiddenIndices.length === 0) return []
    const targetLetters = hiddenIndices.map(i => cleanWord[i])
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')
    const distractors = shuffle(alphabet.filter(c => !targetLetters.includes(c))).slice(0, Math.max(4, 8 - targetLetters.length))
    return shuffle([...targetLetters, ...distractors])
  }, [cleanWord, hiddenIndices])

  const next = () => {
    if (index + 1 >= notes.length) {
      setIndex(notes.length)
      return
    }
    setIndex(i => i + 1)
  }

  // Handle letter input (either from bubble tap or physical keyboard)
  const handleInputLetter = (char: string) => {
    if (status !== 'playing') return
    const ch = char.toLowerCase()
    if (!/^[a-z]$/.test(ch)) return

    // Find the current active blank, or the first unfilled blank
    const targetBlankIndex = hiddenIndices.find(idx => !filledLetters[idx])
    if (targetBlankIndex === undefined) return

    const newFilled = { ...filledLetters, [targetBlankIndex]: ch }
    setFilledLetters(newFilled)

    // Check if all blanks filled
    const allFilled = hiddenIndices.every(idx => !!newFilled[idx])
    if (allFilled) {
      // Validate
      const isAllCorrect = hiddenIndices.every(idx => newFilled[idx] === cleanWord[idx])
      if (isAllCorrect) {
        setStatus('correct')
        setCorrect(c => c + 1)
        setCombo(cb => cb + 1)
        speakEnglish(note.word)
        setTimeout(next, 900)
      } else {
        setStatus('wrong')
        setWrong(w => w + 1)
        setCombo(0)
        // Clear wrong blanks after a brief shake
        setTimeout(() => {
          setFilledLetters({})
          setStatus('playing')
        }, 750)
      }
    } else {
      // Advance active blank pointer
      const nextBlank = hiddenIndices.find(idx => idx !== targetBlankIndex && !newFilled[idx])
      if (nextBlank !== undefined) setActiveBlankIdx(nextBlank)
    }
  }

  const handleBackspace = () => {
    if (status !== 'playing') return
    // Remove the most recently filled blank
    const filledIdxs = hiddenIndices.filter(idx => !!filledLetters[idx])
    if (filledIdxs.length === 0) return
    const lastIdx = filledIdxs[filledIdxs.length - 1]
    const updated = { ...filledLetters }
    delete updated[lastIdx]
    setFilledLetters(updated)
    setActiveBlankIdx(lastIdx)
  }

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'playing') return
      if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Enter') {
        // do nothing or check
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleInputLetter(e.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, hiddenIndices, filledLetters, cleanWord])

  const handleHint = () => {
    if (status !== 'playing') return
    // Find first unfilled or incorrectly filled blank
    const unfilled = hiddenIndices.find(idx => filledLetters[idx] !== cleanWord[idx])
    if (unfilled === undefined) return
    handleInputLetter(cleanWord[unfilled])
  }

  const handleSkip = () => {
    if (status !== 'playing') return
    setStatus('skipped')
    setSkipped(s => s + 1)
    setCombo(0)
    // Reveal correct letters
    const revealed: Record<number, string> = {}
    hiddenIndices.forEach(idx => { revealed[idx] = cleanWord[idx] })
    setFilledLetters(revealed)
    setTimeout(next, 1200)
  }

  if (notes.length === 0) {
    return <EmptyState onExit={onExit} text="No suitable vocabulary words found." />
  }

  if (index >= notes.length) {
    return (
      <ResultScreen
        title="Missing Letters Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={() => {
          setSeed(s => s + 1)
          setIndex(0)
          setCorrect(0)
          setWrong(0)
          setSkipped(0)
          setCombo(0)
        }}
      />
    )
  }

  const currentCard = flashcards.find(f => f.id === note.cardId)

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-4 select-none">
      <GameHeader
        onExit={onExit}
        center={
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {index + 1} / {notes.length}
            </span>
            {combo > 1 && (
              <span className="text-[11px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full shadow-xs animate-bounce">
                🔥 {combo} Combo
              </span>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleHint}
              disabled={status !== 'playing'}
              title="Reveal a missing letter"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Lightbulb size={17} />
            </button>
            <button
              onClick={handleSkip}
              disabled={status !== 'playing'}
              title="Skip word"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <SkipForward size={17} />
            </button>
          </div>
        }
      />

      {/* Main Game Card */}
      <div className="w-full bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md p-6 sm:p-8 mt-2 relative flex flex-col items-center text-center">
        {/* Category / Meaning Header */}
        <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
          Điền chữ cái còn thiếu
        </div>
        <p className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 max-w-md break-words mb-6">
          {note.meaning}
        </p>

        {/* Word Display with Missing Letter Slots */}
        <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 mb-8 min-h-[4rem]">
          {cleanWord.split('').map((char, i) => {
            const isHidden = hiddenIndices.includes(i)
            const filledChar = filledLetters[i]
            const isRevealed = status === 'correct' || status === 'skipped'
            const isWrong = status === 'wrong' && isHidden

            if (!isHidden) {
              return (
                <div
                  key={i}
                  className="w-10 sm:w-12 h-12 sm:h-14 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center justify-center text-xl sm:text-2xl font-black text-gray-900 dark:text-white shadow-xs uppercase"
                >
                  {char}
                </div>
              )
            }

            return (
              <div
                key={i}
                className={`w-10 sm:w-12 h-12 sm:h-14 rounded-xl border-2 flex items-center justify-center text-xl sm:text-2xl font-black transition-all shadow-sm uppercase ${
                  isRevealed
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 scale-105'
                    : isWrong
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 animate-shake'
                    : filledChar
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                    : activeBlankIdx === i
                    ? 'border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20 text-purple-400 border-dashed animate-pulse'
                    : 'border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                }`}
              >
                {filledChar || (status === 'skipped' ? char : '_')}
              </div>
            )
          })}
        </div>

        {/* Audio speaker on correct */}
        <button
          type="button"
          onClick={() => speakEnglish(note.word)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-4 cursor-pointer"
        >
          <Volume2 size={16} />
          <span>Nghe phát âm</span>
        </button>

        {/* Interactive Letter Bubble Choices */}
        <div className="w-full max-w-md pt-2 border-t border-gray-100 dark:border-gray-700/60">
          <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-2">
            Chọn chữ cái còn thiếu hoặc gõ bàn phím:
          </div>
          <div className="flex items-center justify-center flex-wrap gap-2">
            {bubbleOptions.map((optChar, optIdx) => (
              <button
                key={`${optChar}-${optIdx}`}
                type="button"
                onClick={() => handleInputLetter(optChar)}
                disabled={status !== 'playing'}
                className="w-10 sm:w-11 h-10 sm:h-11 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 hover:border-purple-300 dark:hover:bg-purple-900/40 text-gray-800 dark:text-gray-100 font-bold text-base sm:text-lg uppercase transition-all active:scale-95 border border-transparent shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
              >
                {optChar}
              </button>
            ))}
          </div>
        </div>

        {/* Root Card Button bottom-left */}
        {currentCard && (
          <RootCardButton
            onClick={() => setShowModalCard(currentCard)}
            className="absolute bottom-3 left-3"
          />
        )}
      </div>

      <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

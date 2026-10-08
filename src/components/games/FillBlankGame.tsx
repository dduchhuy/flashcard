import { useState, useMemo, useEffect, useRef } from 'react'
import { useFlashcardStore, getCardTags } from '../../store'
import { ArrowLeft, RefreshCcw, Lightbulb, Volume2, SkipForward } from 'lucide-react'
import { extractWordText, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'

// Mode: 'first' = show first meaning only, 'all' = show full meaning, (same as before = show full meaning as default)
type FillMode = 'all' | 'first'

export function FillBlankGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [fillMode, setFillMode] = useState<FillMode>('all')

  const allQuestions = useMemo(() => {
    const questions: any[] = []
    const filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered.forEach(card => {
      card.highlights.forEach(h => {
        questions.push({
          id: h.id,
          word: extractWordText(card.sentence, h.wordIndices),
          sentence: card.sentence,
          meaning: h.meaning,
          firstMeaning: h.meaning.split('\n')[0].trim(),
        })
      })
    })
    return questions.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  const [hinted, setHinted] = useState<number[]>([])
  
  // Stats
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [skipCount, setSkipCount] = useState(0)
  const [wrongQuestions, setWrongQuestions] = useState<any[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'playing') {
      inputRef.current?.focus()
    }
  }, [status, currentIndex])

  useEffect(() => {
    setHinted([])
  }, [currentIndex])

  const [replayMode, setReplayMode] = useState(false)
  const [replayQuestions, setReplayQuestions] = useState<any[]>([])

  const activeQuestions = replayMode ? replayQuestions : allQuestions

  const currentQ = activeQuestions[currentIndex]

  const displayMeaning = currentQ
    ? (fillMode === 'first' ? currentQ.firstMeaning : currentQ.meaning)
    : ''

  if (allQuestions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-20">
        <p>No notes found. Highlight words first!</p>
        <button onClick={onExit} className="mt-4 text-purple-600">Go back</button>
      </div>
    )
  }

  if (currentIndex >= activeQuestions.length) {
    const total = activeQuestions.length
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Complete!</h2>
        <div className="flex gap-6 mb-6 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-green-600">{correctCount}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Correct</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-red-500">{wrongCount}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Wrong</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-500">{skipCount}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Skipped</span>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Score: <span className="font-bold text-purple-600">{correctCount}</span> / {total}
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium">Back</button>
          <button
            onClick={() => {
              setSeed(s => s + 1)
              setCurrentIndex(0)
              setCorrectCount(0)
              setWrongCount(0)
              setSkipCount(0)
              setInputValue('')
              setStatus('playing')
              setWrongQuestions([])
              setReplayMode(false)
            }}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700"
          >
            <RefreshCcw size={18} /> Play Again
          </button>
          {wrongQuestions.length > 0 && (
            <button
              onClick={() => {
                setReplayMode(true)
                setReplayQuestions(wrongQuestions.sort(() => Math.random() - 0.5))
                setCurrentIndex(0)
                setCorrectCount(0)
                setWrongCount(0)
                setSkipCount(0)
                setInputValue('')
                setStatus('playing')
                setWrongQuestions([])
              }}
              className="bg-red-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-red-600 shadow-sm transition-colors"
            >
              Retry Wrong ({wrongQuestions.length})
            </button>
          )}
        </div>
      </div>
    )
  }

  const checkAnswer = () => {
    if (status !== 'playing') return
    const guess = buildGuess(currentQ.word, inputValue, hinted)
    if (fuzzyMatch(guess, currentQ.word)) {
      setStatus('correct')
      setCorrectCount(c => c + 1)
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 1500)
    } else {
      // Wrong: show answer and move on
      setStatus('wrong')
      setWrongCount(c => c + 1)
      setWrongQuestions(prev => [...prev, currentQ])
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 2000)
    }
  }

  const handleSkip = () => {
    if (status !== 'playing') return
    setSkipCount(c => c + 1)
    setInputValue('')
    setStatus('skipped')
    setTimeout(() => {
      setStatus('playing')
      setCurrentIndex(i => i + 1)
    }, 800)
  }

  const handleHint = () => {
    const remaining = letterIndices(currentQ.word).filter(i => !hinted.includes(i))
    if (remaining.length === 0) return
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    setHinted([...hinted, pick])
    setInputValue(v => v.slice(0, remaining.length - 1))
    inputRef.current?.focus()
  }

  const showFullSentence = hinted.length >= letterIndices(currentQ.word).length || status === 'correct' || status === 'skipped'

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft size={24} />
          </button>
          {/* Stats */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-green-600 dark:text-green-400">✓ {correctCount}</span>
            <span className="text-red-500 dark:text-red-400">✗ {wrongCount}</span>
            <span className="text-gray-500 dark:text-gray-400">→ {skipCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Fill mode selector */}
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
            <button
              onClick={() => setFillMode('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${fillMode === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
            >
              All meanings
            </button>
            <button
              onClick={() => setFillMode('first')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${fillMode === 'first' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
            >
              1st meaning
            </button>
          </div>

          {/* Listen button */}
          <button
            onClick={() => speakEnglish(currentQ.word)}
            className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50"
          >
            <Volume2 size={16} />
            <span className="hidden sm:inline">Listen</span>
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center max-w-xl mx-auto w-full relative">

        {/* Context sentence */}
        <p className={`text-lg text-gray-800 dark:text-gray-200 mb-6 leading-relaxed whitespace-pre-wrap px-4 transition-all duration-300 ${!showFullSentence ? 'blur-sm select-none opacity-60' : ''}`}>
          {currentQ.sentence}
        </p>

        {/* Meaning display */}
        <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 mb-6 border border-purple-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Meaning</span>
          <span className="font-medium text-purple-700 dark:text-purple-300 text-lg break-words whitespace-pre-wrap">{displayMeaning}</span>
        </div>

        {/* Wrong: show correct answer */}
        {status === 'wrong' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 animate-in fade-in">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              Answer: <span className="font-bold">{currentQ.word}</span>
            </p>
          </div>
        )}

        {/* Skipped: show answer */}
        {status === 'skipped' && (
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-4 animate-in fade-in">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Skipped — Answer: <span className="font-bold">{currentQ.word}</span>
            </p>
          </div>
        )}

        {/* Letter input */}
        <div className="max-w-sm mx-auto">
          <LetterInput
            word={currentQ.word}
            typed={inputValue}
            hinted={hinted}
            status={status}
            onChange={setInputValue}
            onEnter={() => {
              if (status !== 'playing') return
              if (hinted.length >= letterIndices(currentQ.word).length) {
                setInputValue('')
                setCurrentIndex(i => i + 1)
              } else if (inputValue.trim()) {
                checkAnswer()
              }
            }}
            inputRef={inputRef}
            accent="purple"
          />
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={handleSkip}
            disabled={status !== 'playing'}
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <SkipForward size={16} /> Skip
          </button>

          <button
            onClick={handleHint}
            disabled={status !== 'playing' || hinted.length >= letterIndices(currentQ.word).length}
            title="Hint"
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            <Lightbulb size={20} />
          </button>

          <button
            onClick={checkAnswer}
            disabled={status !== 'playing' || !inputValue.trim()}
            className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex-1 min-w-[140px]"
          >
            Submit Answer
          </button>
        </div>
      </div>

      {/* Progress */}
      <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
        {currentIndex + 1} / {activeQuestions.length}
      </p>
    </div>
  )
}

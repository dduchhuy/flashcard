import { useState, useMemo, useEffect, useRef } from 'react'
import { useFlashcardStore, getCardTags } from '../../store'
import { ArrowLeft, RefreshCcw, Lightbulb, Volume2 } from 'lucide-react'
import { extractWordText, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'

export function FillBlankGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const allQuestions = useMemo(() => {
    const questions: any[] = []
    const filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered.forEach(card => {
      card.highlights.forEach(h => {
        questions.push({
          id: h.id,
          word: extractWordText(card.sentence, h.wordIndices),
          sentence: card.sentence,
          meaning: h.meaning
        })
      })
    })
    return questions.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  
  const [hinted, setHinted] = useState<number[]>([])
  const [score, setScore] = useState(0)
  
  const inputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    if (status === 'playing') {
      inputRef.current?.focus()
    }
  }, [status, currentIndex])

  useEffect(() => {
    setHinted([])
  }, [currentIndex])

  const currentQ = allQuestions[currentIndex]

  if (allQuestions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-20">
        <p>No notes found. Highlight words first!</p>
        <button onClick={onExit} className="mt-4 text-purple-600">Go back</button>
      </div>
    )
  }

  if (currentIndex >= allQuestions.length) {
    const percentage = Math.round((score / allQuestions.length) * 100)
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Complete!</h2>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
          You scored <span className="font-bold text-purple-600">{score}</span> out of {allQuestions.length} ({percentage}%)
        </p>
        <div className="flex gap-4 mt-2">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={() => { setSeed(s => s + 1); setCurrentIndex(0); setScore(0) }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  const checkAnswer = () => {
    if (fuzzyMatch(buildGuess(currentQ.word, inputValue, hinted), currentQ.word)) {
      setStatus('correct')
      setScore(s => s + 1)
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 1500)
    } else {
      setStatus('wrong')
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        inputRef.current?.focus()
      }, 1500)
    }
  }

  const handleSkip = () => {
    setInputValue('')
    setCurrentIndex(i => i + 1)
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
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft size={24} />
          </button>
        </div>
        
        <button 
          onClick={() => speakEnglish(currentQ.word)}
          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50"
        >
          <Volume2 size={16} />
          <span className="hidden sm:inline">Listen</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center max-w-xl mx-auto w-full relative">
        
        <p className={`text-lg text-gray-800 dark:text-gray-200 mb-8 leading-relaxed whitespace-pre-wrap px-4 transition-all duration-300 ${!showFullSentence ? 'blur-sm select-none opacity-60' : ''}`}>
          {currentQ.sentence}
        </p>
        
        <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 mb-8 border border-purple-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Meaning</span>
          <span className="font-medium text-purple-700 dark:text-purple-300 text-lg break-words whitespace-pre-wrap">{currentQ.meaning}</span>
        </div>

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
        
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={handleSkip}
            disabled={status !== 'playing'}
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Skip
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
      <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
        {currentIndex + 1} / {allQuestions.length}
      </p>
    </div>
  )
}

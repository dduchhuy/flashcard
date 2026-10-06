import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useFlashcardStore, getCardTags } from '../../store'
import { ArrowLeft, RefreshCcw, Volume2, Lightbulb } from 'lucide-react'
import { extractWordText, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'

export function ListenGame({ onExit }: { onExit: () => void }) {
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

  // Audio settings
  const [readMode, setReadMode] = useState<'word' | 'sentence'>('word')
  const [hideMeaning, setHideMeaning] = useState(true)

  useEffect(() => {
    if (status === 'playing') {
      inputRef.current?.focus()
    }
  }, [status, currentIndex])

  useEffect(() => {
    setHinted([])
    setHideMeaning(true)
  }, [currentIndex])

  const currentQ = allQuestions[currentIndex]

  const playAudio = useCallback((text?: string) => {
    if (!currentQ) return
    const textToPlay = text || (readMode === 'word' ? currentQ.word : currentQ.sentence)
    speakEnglish(textToPlay)
  }, [currentQ, readMode])

  // Auto-play ONLY when question changes
  useEffect(() => {
    if (currentQ) {
      const timeout = setTimeout(() => playAudio(), 300)
      return () => clearTimeout(timeout)
    }
  }, [currentQ, playAudio])


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
          You scored <span className="font-bold text-blue-600">{score}</span> out of {allQuestions.length} ({percentage}%)
        </p>
        <div className="flex gap-4 mt-2">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={() => { setSeed(s => s + 1); setCurrentIndex(0); setScore(0) }} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium">
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft size={24} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
            <button 
              onClick={() => setReadMode('word')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${readMode === 'word' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Word
            </button>
            <button 
              onClick={() => setReadMode('sentence')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${readMode === 'sentence' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Sentence
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center max-w-xl mx-auto w-full relative">
        
        {showFullSentence ? (
          <p className="text-lg text-gray-800 dark:text-gray-200 mb-8 leading-relaxed whitespace-pre-wrap px-4">
            {currentQ.sentence}
          </p>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 mb-8 px-4 flex items-center justify-center gap-2">
            <Volume2 size={18} className="animate-pulse" />
            <span className="text-sm font-medium">Listen and type the word</span>
          </div>
        )}

        <button
          onClick={() => playAudio()}
          className="mx-auto w-24 h-24 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center hover:scale-105 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all shadow-sm mb-6"
        >
          <Volume2 size={48} />
        </button>
        
        <div className="bg-blue-50 dark:bg-gray-900 rounded-xl p-4 mb-8 border border-blue-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Meaning</span>
            <button 
              onClick={() => setHideMeaning(!hideMeaning)}
              className="text-xs px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-1"
            >
              {hideMeaning ? 'Show' : 'Hide'}
            </button>
          </div>
          {!hideMeaning && (
            <div className="mt-3 font-medium text-blue-700 dark:text-blue-300 text-lg break-words whitespace-pre-wrap block">
              {currentQ.meaning}
            </div>
          )}
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
            accent="blue"
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
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-1 min-w-[140px]"
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

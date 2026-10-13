import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard } from '../../store'
import { Volume2, Lightbulb } from 'lucide-react'
import { extractWordText, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'
import { CardDetailModal, RootCardButton, GameStatsBar, EmptyState, GameHeader, ResultScreen } from './shared'

export function ListenGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const allQuestions = useMemo(() => {
    const questions: any[] = []
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (highlights.length === 0) return
      let selectedHighlight = highlights[0]
      if (highlights.length > 1) {
        const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
        selectedHighlight = highlights[randIndex]
      }
      const h = selectedHighlight
      questions.push({
        id: h.id,
        cardId: card.id,
        word: extractWordText(card.sentence, h.wordIndices),
        sentence: h.example ? h.example : card.sentence,
        meaning: h.meaning,
        isExample: !!h.example
      })
    })
    return questions.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, gameInputMode])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  const [hinted, setHinted] = useState<number[]>([])
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Audio settings
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
    const textToPlay = text || currentQ.word
    speakEnglish(textToPlay)
  }, [currentQ])

  // Auto-play ONLY when question changes
  useEffect(() => {
    if (currentQ) {
      const timeout = setTimeout(() => playAudio(), 300)
      return () => clearTimeout(timeout)
    }
  }, [currentQ, playAudio])


  if (allQuestions.length === 0) {
    return <EmptyState onExit={onExit} text="No notes found. Highlight words first!" />
  }

  if (currentIndex >= allQuestions.length) {
    return (
      <ResultScreen
        title="Dictation Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={() => {
          setSeed(s => s + 1)
          setCurrentIndex(0)
          setCorrect(0)
          setWrong(0)
          setSkipped(0)
          setStatus('playing')
        }}
      />
    )
  }

  const checkAnswer = () => {
    if (fuzzyMatch(buildGuess(currentQ.word, inputValue, hinted), currentQ.word)) {
      setStatus('correct')
      setCorrect(c => c + 1)
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 1200)
    } else {
      setStatus('wrong')
      setWrong(w => w + 1)
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 1500)
    }
  }

  const handleSkip = () => {
    setStatus('skipped')
    setSkipped(s => s + 1)
    setTimeout(() => {
      setStatus('playing')
      setInputValue('')
      setCurrentIndex(i => i + 1)
    }, 1000)
  }

  const handleHint = () => {
    const remaining = letterIndices(currentQ.word).filter(i => !hinted.includes(i))
    if (remaining.length === 0) return
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    setHinted([...hinted, pick])
    setInputValue(v => v.slice(0, remaining.length - 1))
    inputRef.current?.focus()
  }

  const showFullSentence = hinted.length >= letterIndices(currentQ.word).length || status === 'correct' || status === 'skipped' || status === 'wrong'

  return (
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        title="Dictation"
        current={currentIndex + 1}
        total={allQuestions.length}
        right={
          <button
            onClick={() => playAudio()}
            className="p-1.5 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            title="Replay Audio"
          >
            <Volume2 size={16} />
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 p-4 sm:p-5 mb-2 text-center max-w-xl mx-auto w-full relative">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === currentQ.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute top-3 left-3"
        />
        
        {showFullSentence ? (
          <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 mb-3 leading-relaxed whitespace-pre-wrap px-2">
            {currentQ.sentence}
          </p>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 mb-3 px-2 flex items-center justify-center gap-1.5">
            <Volume2 size={16} className="animate-pulse" />
            <span className="text-xs font-medium">Listen and type the word</span>
          </div>
        )}

        <button
          onClick={() => playAudio()}
          className="mx-auto w-14 sm:w-16 h-14 sm:h-16 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center hover:scale-105 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all shadow-2xs mb-3 cursor-pointer"
        >
          <Volume2 size={28} />
        </button>
        
        <div className="bg-blue-50 dark:bg-gray-900 rounded-xl p-2.5 sm:p-3 mb-3 border border-blue-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Meaning</span>
            <button 
              onClick={() => setHideMeaning(!hideMeaning)}
              className="text-xs px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md shadow-2xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-1"
            >
              {hideMeaning ? 'Show' : 'Hide'}
            </button>
          </div>
          {!hideMeaning && (
            <div className="mt-1.5 font-medium text-blue-700 dark:text-blue-300 text-sm sm:text-base break-words whitespace-pre-wrap block">
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
        
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          <button
            onClick={handleSkip}
            disabled={status !== 'playing'}
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-4 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Skip
          </button>
          
          <button
            onClick={handleHint}
            disabled={status !== 'playing' || hinted.length >= letterIndices(currentQ.word).length}
            title="Hint"
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3.5 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Lightbulb size={18} />
          </button>
          
          <button
            onClick={checkAnswer}
            disabled={status !== 'playing' || !inputValue.trim()}
            className="bg-blue-600 text-white px-5 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-1 min-w-[120px] cursor-pointer"
          >
            Submit Answer
          </button>
        </div>
      </div>
      
      <div className="mt-1 flex flex-col items-center gap-1">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

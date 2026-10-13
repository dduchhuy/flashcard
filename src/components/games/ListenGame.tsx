import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard } from '../../store'
import { Volume2, Lightbulb, SkipForward } from 'lucide-react'
import { extractWordText, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'
import { CardDetailModal, RootCardButton, GameStatsBar, EmptyState, GameHeader, ResultScreen, useGameTimer } from './shared'

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
  const [hideMeaning, setHideMeaning] = useState(true)

  const handleTimeUp = () => {
    if (status !== 'playing') return
    handleSkip()
  }

  const timer = useGameTimer({
    initialDuration: 20,
    onTimeUp: handleTimeUp,
    enabled: status === 'playing' && currentIndex < allQuestions.length
  })

  useEffect(() => {
    if (status === 'playing') {
      inputRef.current?.focus()
    }
  }, [status, currentIndex])

  useEffect(() => {
    setHinted([])
    setHideMeaning(true)
    timer.reset()
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
          timer.reset()
        }}
      />
    )
  }

  const checkAnswer = () => {
    if (status !== 'playing') return
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
    if (status !== 'playing') return
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
    <div className="max-w-4xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full items-center w-full">
      <GameHeader
        onExit={onExit}
        timer={timer}
        title="Dictation"
        current={currentIndex + 1}
        total={allQuestions.length}
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-6 sm:p-8 mb-3 text-center max-w-2xl mx-auto w-full relative pb-16">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === currentQ.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute bottom-3 left-4"
        />
        
        {showFullSentence ? (
          <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 mb-4 leading-relaxed whitespace-pre-wrap px-2">
            {currentQ.sentence}
          </p>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 mb-4 px-2 flex items-center justify-center gap-1.5">
            <Volume2 size={16} className="animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Listen and type the word</span>
          </div>
        )}

        <button
          onClick={() => playAudio()}
          title="Play Audio"
          className="mx-auto w-16 sm:w-18 h-16 sm:h-18 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center hover:scale-105 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-all shadow-sm mb-4 cursor-pointer"
        >
          <Volume2 size={32} />
        </button>
        
        <div className="bg-purple-50/70 dark:bg-gray-900/50 rounded-2xl p-3 sm:p-4 mb-4 border border-purple-100/80 dark:border-gray-700 max-w-lg mx-auto">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Meaning</span>
            <button 
              onClick={() => setHideMeaning(!hideMeaning)}
              className="text-xs px-2.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg shadow-2xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-1 cursor-pointer"
            >
              {hideMeaning ? 'Show' : 'Hide'}
            </button>
          </div>
          {!hideMeaning && (
            <div className="mt-2 font-medium text-gray-800 dark:text-gray-100 text-sm sm:text-base break-words whitespace-pre-wrap block text-left">
              {currentQ.meaning}
            </div>
          )}
        </div>

        <div className="max-w-md mx-auto my-2">
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
        
        <div className="mt-5 flex flex-wrap gap-2.5 justify-center max-w-sm mx-auto">
          <button
            onClick={handleSkip}
            disabled={status !== 'playing'}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 text-xs sm:text-sm rounded-xl font-medium disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <SkipForward size={15} />
            <span>Skip</span>
          </button>
          
          <button
            onClick={handleHint}
            disabled={status !== 'playing' || hinted.length >= letterIndices(currentQ.word).length}
            title="Hint"
            className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 px-3.5 py-2 text-xs sm:text-sm rounded-xl font-medium disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Lightbulb size={18} />
          </button>
          
          <button
            onClick={checkAnswer}
            disabled={status !== 'playing' || !inputValue.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-xs sm:text-sm rounded-xl font-bold disabled:opacity-50 transition-colors flex-1 min-w-[120px] shadow-sm cursor-pointer"
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

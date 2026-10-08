import { useState, useMemo, useEffect, useRef } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode } from '../../store'
import { ArrowLeft, RefreshCcw, Lightbulb, Volume2 } from 'lucide-react'
import { extractWordText, extractWordsAndSpaces, fuzzyMatch, speakEnglish } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'
import { EmptyState } from './shared'

type FillMode = 'meaning' | 'meaning-all' | 'sentence'

export function FillBlankGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [fillMode, setFillMode] = useState<FillMode>('meaning')
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)

  const allQuestions = useMemo(() => {
    const questions: any[] = []
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    filtered.forEach(card => {
      if (card.highlights.length === 0) return

      if (fillMode === 'meaning') {
        // Only first highlight, show first meaning
        const h = card.highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices)
        questions.push({
          id: h.id,
          word: wordText,
          sentence: h.example ? h.example : card.sentence,
          meaning: h.meaning,
          displayMeaning: h.meaning,
          wordIndices: h.wordIndices,
          isExample: !!h.example,
          mode: 'meaning',
        })
      } else if (fillMode === 'meaning-all') {
        // Only first highlight (one question per card), show ALL meanings of the card
        const h = card.highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices)
        const allMeanings = card.highlights.map(hl => hl.meaning).join('\n')
        questions.push({
          id: h.id,
          word: wordText,
          sentence: h.example ? h.example : card.sentence,
          meaning: h.meaning,
          displayMeaning: allMeanings,
          wordIndices: h.wordIndices,
          isExample: !!h.example,
          mode: 'meaning-all',
        })
      } else {
        // sentence mode (original behavior): pick one highlight per card
        let selectedHighlight = card.highlights[0]
        if (card.highlights.length > 1) {
          const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * card.highlights.length)
          selectedHighlight = card.highlights[randIndex]
        }
        const h = selectedHighlight
        
        if (gameInputMode === 'word') {
          const sentence = h.example ? h.example : card.sentence
          const { words } = extractWordsAndSpaces(sentence)
          const validWords = words.map((w, i) => ({w, i})).filter(x => /[a-zA-Z]{2,}/.test(x.w))
          if (validWords.length > 0) {
            const rIdx = Math.floor(Math.abs(Math.sin(h.id.length + seed)) * validWords.length)
            const target = validWords[rIdx]
            questions.push({
              id: h.id,
              word: target.w,
              sentence: sentence,
              meaning: h.meaning,
              displayMeaning: h.meaning,
              wordIndices: [target.i],
              isExample: false,
              mode: 'sentence',
            })
          }
        } else {
          questions.push({
            id: h.id,
            word: extractWordText(card.sentence, h.wordIndices),
            sentence: h.example ? h.example : card.sentence,
            meaning: h.meaning,
            displayMeaning: h.meaning,
            wordIndices: h.wordIndices,
            isExample: !!h.example,
            mode: 'sentence',
          })
        }
      }
    })
    return questions.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, gameInputMode, fillMode])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  
  const [hinted, setHinted] = useState<number[]>([])
  const [hideMeaning, setHideMeaning] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'playing') {
      inputRef.current?.focus()
    }
  }, [status, currentIndex])

  useEffect(() => {
    setHinted([])
    // In meaning/meaning-all modes, meaning is the question so show it by default
    setHideMeaning(fillMode === 'sentence')
  }, [currentIndex, fillMode])

  // Reset index when mode changes
  useEffect(() => {
    setCurrentIndex(0)
    setInputValue('')
    setStatus('playing')
    setHinted([])
    setCorrect(0)
    setWrong(0)
    setSkipped(0)
  }, [fillMode])

  const currentQ = allQuestions[currentIndex]

  if (allQuestions.length === 0) {
    return <EmptyState onExit={onExit} />
  }

  const handleRestart = () => {
    setSeed(s => s + 1)
    setCurrentIndex(0)
    setInputValue('')
    setStatus('playing')
    setCorrect(0)
    setWrong(0)
    setSkipped(0)
  }

  if (currentIndex >= allQuestions.length) {
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Complete!</h2>
        <div className="flex gap-6 mb-8 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-green-500">{correct}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Correct</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-red-500">{wrong}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Wrong</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-yellow-500">{skipped}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Skipped</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{allQuestions.length}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</span>
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={handleRestart} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
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
      }, 1500)
    } else {
      // Wrong: show answer, count as wrong, next after 1.5s (no retry)
      setStatus('wrong')
      setWrong(w => w + 1)
      setTimeout(() => {
        setStatus('playing')
        setInputValue('')
        setCurrentIndex(i => i + 1)
      }, 1800)
    }
  }

  const handleSkip = () => {
    if (status !== 'playing') return
    setInputValue('')
    setSkipped(s => s + 1)
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
  const isMeaningMode = fillMode === 'meaning' || fillMode === 'meaning-all'

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft size={24} />
          </button>
        </div>
        
        {/* Mode segmented control */}
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
          <button
            onClick={() => setFillMode('meaning')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${fillMode === 'meaning' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Meaning→Word
          </button>
          <button
            onClick={() => setFillMode('meaning-all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${fillMode === 'meaning-all' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            All Meanings
          </button>
          <button
            onClick={() => setFillMode('sentence')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${fillMode === 'sentence' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Sentence
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
        
        {/* Meaning display area */}
        {isMeaningMode ? (
          // In meaning modes: show meaning big, user types the word
          <div className="mb-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">What is the word for this meaning?</p>
            <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
              <p className="text-xl font-semibold text-purple-700 dark:text-purple-300 whitespace-pre-wrap leading-relaxed break-words">
                {currentQ.displayMeaning}
              </p>
            </div>
            {/* Show answer when wrong */}
            {status === 'wrong' && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Correct answer:</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{currentQ.word}</p>
              </div>
            )}
          </div>
        ) : (
          // Sentence mode: show blanked sentence
          <>
            <p className="text-lg text-gray-800 dark:text-gray-200 mb-8 leading-relaxed whitespace-pre-wrap px-4">
              {(() => {
                if (showFullSentence) return currentQ.sentence
                if (currentQ.isExample) {
                  const regex = new RegExp(`\\b${currentQ.word}\\b`, 'gi')
                  const parts = currentQ.sentence.split(regex)
                  if (parts.length === 1) {
                    const parts2 = currentQ.sentence.split(new RegExp(currentQ.word, 'gi'))
                    return (
                      <>
                        {parts2.map((part: string, i: number) => (
                          <span key={i}>
                            {part}
                            {i < parts2.length - 1 && <span className="text-purple-400 dark:text-purple-500 font-bold opacity-70">{'___'}</span>}
                          </span>
                        ))}
                      </>
                    )
                  }
                  return (
                    <>
                      {parts.map((part: string, i: number) => (
                        <span key={i}>
                          {part}
                          {i < parts.length - 1 && <span className="text-purple-400 dark:text-purple-500 font-bold opacity-70">{'___'}</span>}
                        </span>
                      ))}
                    </>
                  )
                }
                const { words, spaces, initialSpace } = extractWordsAndSpaces(currentQ.sentence)
                return (
                  <>
                    {initialSpace}
                    {words.map((w: string, i: number) => {
                      const isBlank = currentQ.wordIndices.includes(i)
                      return (
                        <span key={i}>
                          {isBlank ? <span className="text-purple-400 dark:text-purple-500 font-bold opacity-70">{'___'}</span> : w}
                          {spaces[i]}
                        </span>
                      )
                    })}
                  </>
                )
              })()}
            </p>
            
            {/* Show answer when wrong in sentence mode */}
            {status === 'wrong' && (
              <div className="mb-4 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Correct answer:</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{currentQ.word}</p>
              </div>
            )}
            
            <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 mb-8 border border-purple-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
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
                <div className="mt-3 font-medium text-purple-700 dark:text-purple-300 text-lg break-words whitespace-pre-wrap block">
                  {currentQ.meaning}
                </div>
              )}
            </div>
          </>
        )}

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
          
          {fillMode === 'sentence' && (
            <button
              onClick={handleHint}
              disabled={status !== 'playing' || hinted.length >= letterIndices(currentQ.word).length}
              title="Hint"
              className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <Lightbulb size={20} />
            </button>
          )}
          
          <button
            onClick={checkAnswer}
            disabled={status !== 'playing' || !inputValue.trim()}
            className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex-1 min-w-[140px]"
          >
            Submit Answer
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-4 text-sm font-medium py-2 px-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <span className="text-green-600 dark:text-green-400">✅ {correct}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-red-500 dark:text-red-400">❌ {wrong}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-yellow-500 dark:text-yellow-400">⏭ {skipped}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-gray-500 dark:text-gray-400">{currentIndex + 1} / {allQuestions.length}</span>
      </div>
    </div>
  )
}

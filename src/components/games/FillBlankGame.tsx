import { useState, useMemo, useEffect, useRef } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { Lightbulb, Volume2 } from 'lucide-react'
import { extractWordText, extractWordsAndSpaces, fuzzyMatch, speakEnglish, escapeRegExp } from '../../utils'
import { LetterInput, letterIndices, buildGuess } from './LetterInput'
import { EmptyState, CardDetailModal, RootCardButton, GameHeader, ResultScreen, GameStatsBar } from './shared'

type FillMode = 'meaning' | 'meaning-all' | 'sentence' | 'phrase'

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
    
    if (fillMode === 'phrase') {
      filtered.forEach(card => {
        const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem)
        phrases.forEach((pi, idx) => {
          if (!pi.phrase) return
          questions.push({
            id: pi.id || `${card.id}-pi-${idx}`,
            cardId: card.id,
            word: card.sentence.trim(),
            sentence: pi.phrase,
            meaning: pi.translation || pi.phrase,
            displayMeaning: pi.translation || pi.phrase,
            wordIndices: [],
            isExample: true,
            mode: 'phrase',
          })
        })
      })
      return questions.sort(() => Math.random() - 0.5)
    }

    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (highlights.length === 0) return

      if (fillMode === 'meaning') {
        // Only first highlight, show first meaning
        const h = highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices)
        questions.push({
          id: h.id,
          cardId: card.id,
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
        const h = highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices)
        const allMeanings = highlights.map(hl => hl.meaning).join('\n')
        questions.push({
          id: h.id,
          cardId: card.id,
          word: wordText,
          sentence: h.example ? h.example : card.sentence,
          meaning: h.meaning,
          displayMeaning: allMeanings,
          wordIndices: h.wordIndices,
          isExample: !!h.example,
          mode: 'meaning-all',
        })
      } else {
        // sentence mode: pick one highlight per card
        let selectedHighlight = highlights[0]
        if (highlights.length > 1) {
          const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
          selectedHighlight = highlights[randIndex]
        }
        const h = selectedHighlight
        
        if (gameInputMode === 'word') {
          const sentence = h.example ? h.example : card.sentence
          const { words } = extractWordsAndSpaces(sentence)
          const rootClean = card.sentence.trim().toLowerCase()
          let foundTarget = words.map((w, i) => ({w, i})).find(x => x.w.toLowerCase() === rootClean)
          if (!foundTarget) {
            foundTarget = words.map((w, i) => ({w, i})).find(x => x.w.toLowerCase().includes(rootClean) || rootClean.includes(x.w.toLowerCase()))
          }
          const target = foundTarget || { w: card.sentence, i: 0 }
          questions.push({
            id: h.id,
            cardId: card.id,
            word: target.w,
            sentence: sentence,
            meaning: h.meaning,
            displayMeaning: h.meaning,
            wordIndices: [target.i],
            isExample: !!h.example,
            mode: 'sentence',
          })
        } else {
          questions.push({
            id: h.id,
            cardId: card.id,
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
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  
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
    setHideMeaning(fillMode === 'sentence' || fillMode === 'phrase')
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
      <ResultScreen
        title="Fill in the Blank Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={handleRestart}
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
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        current={currentIndex + 1}
        total={allQuestions.length}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => setFillMode('meaning')}
              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${fillMode === 'meaning' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Meaning→Word
            </button>
            <button
              onClick={() => setFillMode('meaning-all')}
              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${fillMode === 'meaning-all' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              All Meanings
            </button>
            <button
              onClick={() => setFillMode('sentence')}
              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${fillMode === 'sentence' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Sentence
            </button>
            <button
              onClick={() => setFillMode('phrase')}
              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${fillMode === 'phrase' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Phrases
            </button>
          </div>
        }
        right={
          <button
            onClick={() => speakEnglish(currentQ.word)}
            className="p-1.5 rounded-lg flex items-center justify-center border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 transition-colors"
            title="Listen"
          >
            <Volume2 size={16} />
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 p-4 sm:p-5 mb-2.5 text-center max-w-xl mx-auto w-full relative">
        {(() => {
          const rootCard = currentQ ? flashcards.find(f => f.id === currentQ.cardId) : null
          return rootCard ? (
            <RootCardButton 
              onClick={() => setShowModalCard(rootCard)}
              className="absolute bottom-3 left-3"
            />
          ) : null
        })()}
        
        {/* Meaning display area */}
        {isMeaningMode ? (
          // In meaning modes: show meaning big, user types the word
          <div className="mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">What is the word for this meaning?</p>
            <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-3 border border-purple-100 dark:border-gray-700">
              <p className="text-base sm:text-lg font-semibold text-purple-700 dark:text-purple-300 whitespace-pre-wrap leading-relaxed break-words">
                {currentQ.displayMeaning}
              </p>
            </div>
            {/* Show answer when wrong */}
            {status === 'wrong' && (
              <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Correct answer:</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{currentQ.word}</p>
              </div>
            )}
          </div>
        ) : (
          // Sentence mode: show blanked sentence
          <>
            <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 mb-3 leading-relaxed whitespace-pre-wrap px-2">
              {(() => {
                if (showFullSentence) return currentQ.sentence
                if (currentQ.isExample) {
                  try {
                    const escaped = escapeRegExp(currentQ.word)
                    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
                    const parts = currentQ.sentence.split(regex)
                    if (parts.length === 1) {
                      const parts2 = currentQ.sentence.split(new RegExp(escaped, 'gi'))
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
                  } catch {
                    return currentQ.sentence
                  }
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
              <div className="mb-2 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Correct answer:</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{currentQ.word}</p>
              </div>
            )}
            
            <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-2.5 sm:p-3 mb-3 border border-purple-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
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
                <div className="mt-1.5 font-medium text-purple-700 dark:text-purple-300 text-sm sm:text-base break-words whitespace-pre-wrap block">
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
        
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          <button
            onClick={handleSkip}
            disabled={status !== 'playing'}
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-4 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Skip
          </button>
          
          {fillMode === 'sentence' && (
            <button
              onClick={handleHint}
              disabled={status !== 'playing' || hinted.length >= letterIndices(currentQ.word).length}
              title="Hint"
              className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3.5 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
            >
              <Lightbulb size={18} />
            </button>
          )}
          
          <button
            onClick={checkAnswer}
            disabled={status !== 'playing' || !inputValue.trim()}
            className="bg-purple-600 text-white px-5 py-2 text-xs sm:text-sm rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex-1 min-w-[120px] cursor-pointer"
          >
            Submit Answer
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center gap-2">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}



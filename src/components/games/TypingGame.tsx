import { useState, useMemo, useEffect } from 'react'
import { Volume2, Eye, EyeOff } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { extractWordText, speakEnglish } from '../../utils'
import { shuffle, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen } from './shared'

export function TypingGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [quizTarget, setQuizTarget] = useState<'sentence' | 'meaning'>('sentence')
  const [srcMode, setSrcMode] = useState<'highlights' | 'phrases'>('highlights')

  // Extract all questions with missing word/phrase and options
  const allQuestions = useMemo(() => {
    const questions: {
      cardId: string
      highlightId: string
      targetWord: string
      meaning: string
      sentenceWithBlank: string
      sentenceFull: string
    }[] = []

    let filtered = activeTags.length > 0
      ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t)))
      : flashcards
      
    filtered = getCardsForMode(filtered, gameInputMode)

    if (srcMode === 'phrases') {
      filtered.forEach(card => {
        const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem)
        phrases.forEach((pi, idx) => {
          if (!pi.phrase) return
          const targetWord = card.sentence.trim()
          if (!targetWord) return
          // Blank the card's main word within the phrase
          const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          let sentenceWithBlank = pi.phrase
          try {
            const rx = new RegExp(`\\b${escaped}\\b`, 'gi')
            if (rx.test(pi.phrase)) {
              sentenceWithBlank = pi.phrase.replace(rx, '______')
            } else {
              const idxOf = pi.phrase.toLowerCase().indexOf(targetWord.toLowerCase())
              if (idxOf !== -1) {
                sentenceWithBlank = pi.phrase.slice(0, idxOf) + '______' + pi.phrase.slice(idxOf + targetWord.length)
              } else {
                sentenceWithBlank = `______ (${pi.phrase})`
              }
            }
          } catch { sentenceWithBlank = `______ (${pi.phrase})` }
          questions.push({
            cardId: card.id,
            highlightId: pi.id || `${card.id}-pi-${idx}`,
            targetWord,
            meaning: pi.translation || pi.phrase,
            sentenceWithBlank,
            sentenceFull: pi.phrase,
          })
        })
      })
      return shuffle(questions)
    }

    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (highlights.length === 0) return
      
      highlights.forEach(h => {
        let targetWord = ''
        let targetSentence = card.sentence
        let targetMeaning = h.meaning || ''
        let sentenceWithBlank = ''

        if (gameInputMode === 'word') {
          targetWord = card.sentence.trim()
          targetSentence = h.example || card.sentence
          
          if (h.example) {
            const regex = new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            if (regex.test(targetSentence)) {
              sentenceWithBlank = targetSentence.replace(regex, '______')
            } else {
              const idx = targetSentence.toLowerCase().indexOf(targetWord.toLowerCase())
              if (idx !== -1) {
                sentenceWithBlank = targetSentence.slice(0, idx) + '______' + targetSentence.slice(idx + targetWord.length)
              } else {
                sentenceWithBlank = `______ (${targetSentence})`
              }
            }
          } else {
            sentenceWithBlank = '______'
          }
        } else {
          targetWord = extractWordText(card.sentence, h.wordIndices)
          if (!targetWord) return
          targetSentence = card.sentence

          const parts = targetSentence.trim().split(/(\s+)/)
          const words: string[] = []
          const spaces: string[] = []
          let initialSpace = ''

          for (let i = 0; i < parts.length; i += 2) {
            let w = parts[i]
            let s = parts[i + 1] || ''

            if (/^[.,!?;:"'()[\]{}<>]+$/.test(w)) {
              words.push(w)
              spaces.push(s)
              continue
            }

            const matchLeading = w.match(/^([.,!?;:"'()[\]{}<>]+)(.*)$/)
            if (matchLeading) {
              if (words.length > 0) spaces[spaces.length - 1] += matchLeading[1]
              else initialSpace += matchLeading[1]
              w = matchLeading[2]
            }

            const matchTrailing = w.match(/^(.*?)([.,!?;:"'()[\]{}<>]+)$/)
            if (matchTrailing) {
              w = matchTrailing[1]
              s = matchTrailing[2] + s
            }

            words.push(w)
            spaces.push(s)
          }

          let blankBuilt = initialSpace
          let inBlank = false
          for (let i = 0; i < words.length; i++) {
            if (h.wordIndices.includes(i)) {
              if (!inBlank) {
                blankBuilt += '______'
                inBlank = true
              }
            } else {
              inBlank = false
              blankBuilt += words[i]
            }
            blankBuilt += spaces[i]
          }
          sentenceWithBlank = blankBuilt.trim()
        }

        if (!targetWord) return

        questions.push({
          cardId: card.id,
          highlightId: h.id,
          targetWord,
          meaning: targetMeaning,
          sentenceWithBlank: sentenceWithBlank || '______',
          sentenceFull: targetSentence,
        })
      })
    })

    return shuffle(questions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags, gameInputMode, srcMode])

  const allWordsPool = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.targetWord)))
  }, [allQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const currentQ = allQuestions[currentIndex]

  const options = useMemo(() => {
    if (!currentQ) return []
    const wrongOptions = allWordsPool.filter(w => w.toLowerCase() !== currentQ.targetWord.toLowerCase())
    const shuffledWrong = shuffle(wrongOptions).slice(0, 3)
    const combined = [currentQ.targetWord, ...shuffledWrong]
    return shuffle(combined)
  }, [currentQ, allWordsPool])

  if (allQuestions.length === 0) {
    return <EmptyState onExit={onExit} text="No highlighted words found. Create notes in your flashcards first!" />
  }

  if (currentIndex >= allQuestions.length) {
    return (
      <ResultScreen
        title="Fill Blank (4 Choices) Complete!"
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
          setSelectedOption(null)
        }}
      />
    )
  }

  const handleSelect = (option: string) => {
    if (selectedOption !== null) return
    setSelectedOption(option)

    const isCorrect = option.toLowerCase() === currentQ.targetWord.toLowerCase()
    if (isCorrect) {
      setCorrect(c => c + 1)
      speakEnglish(currentQ.targetWord)
    } else {
      setWrong(w => w + 1)
    }

    setTimeout(() => {
      setSelectedOption(null)
      setCurrentIndex(i => i + 1)
    }, 1500)
  }

  const handleSkip = () => {
    if (selectedOption !== null) return
    setSkipped(s => s + 1)
    setSelectedOption(currentQ.targetWord)
    setTimeout(() => {
      setSelectedOption(null)
      setCurrentIndex(i => i + 1)
    }, 1200)
  }

  const [showHint, setShowHint] = useState(false)

  // Keyboard shortcut listener 1-4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedOption !== null) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= options.length) {
        handleSelect(options[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [options, selectedOption, currentQ])

  return (
    <div className="max-w-xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        current={currentIndex + 1}
        total={allQuestions.length}
        center={
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button
                onClick={() => { setSrcMode('highlights'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setSelectedOption(null) }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  srcMode === 'highlights'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Words
              </button>
              <button
                onClick={() => { setSrcMode('phrases'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setSelectedOption(null) }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  srcMode === 'phrases'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Phrases
              </button>
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button
                onClick={() => setQuizTarget('sentence')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  quizTarget === 'sentence'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Sentence
              </button>
              <button
                onClick={() => setQuizTarget('meaning')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  quizTarget === 'meaning'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Meaning
              </button>
            </div>
          </div>
        }
        right={
          quizTarget === 'sentence' ? (
            <button
              onClick={() => setShowHint(!showHint)}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors border ${
                showHint
                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={showHint ? 'Hide hint' : 'Show hint'}
            >
              {showHint ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : undefined
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 p-4 sm:p-5 text-center max-w-xl mx-auto w-full relative mb-2.5">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === currentQ.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute bottom-3 left-3"
        />

        <p className="text-[11px] font-semibold tracking-wider text-purple-600 dark:text-purple-400 uppercase mb-2">
          {quizTarget === 'sentence' ? 'Fill in the blank' : 'Match word to meaning'}
        </p>

        {quizTarget === 'sentence' ? (
          <>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 leading-relaxed whitespace-pre-wrap">
              {currentQ.sentenceWithBlank.split('______').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    selectedOption && selectedOption.toLowerCase() === currentQ.targetWord.toLowerCase()
                      ? <span className="inline-block mx-1 px-2.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold">{currentQ.targetWord}</span>
                      : <span className="inline-block mx-1 w-20 sm:w-24 h-6 rounded bg-gray-200 dark:bg-gray-700 align-middle" />
                  )}
                </span>
              ))}
            </h2>

            {showHint && currentQ.meaning && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-2.5 inline-block border border-purple-100 dark:border-purple-800/50 mb-2 animate-in fade-in slide-in-from-top-2">
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5">Meaning hint</span>
                <span className="font-medium text-purple-700 dark:text-purple-300 text-xs sm:text-sm break-words whitespace-pre-wrap">
                  {currentQ.meaning}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="py-1">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1 uppercase tracking-wider font-semibold">Meaning</span>
            <h2 className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap px-2">
              {currentQ.meaning || 'No definition available'}
            </h2>
          </div>
        )}

        <button
          onClick={() => speakEnglish(currentQ.sentenceFull)}
          title="Listen full sentence"
          className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
        >
          <Volume2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {options.map((opt, i) => {
          let baseBtnClass = "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          let hoverBtnClass = "hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"

          if (selectedOption !== null) {
            if (opt.toLowerCase() === currentQ.targetWord.toLowerCase()) {
              baseBtnClass = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-200 font-bold"
              hoverBtnClass = ""
            } else if (opt === selectedOption) {
              baseBtnClass = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200 font-bold"
              hoverBtnClass = ""
            } else {
              baseBtnClass = "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-50"
              hoverBtnClass = ""
            }
          }

          return (
            <button
              key={`${currentIndex}-${i}`}
              onClick={() => handleSelect(opt)}
              disabled={selectedOption !== null}
              className={`w-full min-h-[2.75rem] p-2.5 rounded-xl border text-center font-medium transition-all duration-200 relative group ${baseBtnClass} ${hoverBtnClass} flex items-center justify-center cursor-pointer`}
            >
              <span className="hidden sm:inline-flex absolute top-1.5 left-2 px-1 py-0.2 text-[10px] font-bold rounded bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 group-hover:text-purple-600 transition-colors">
                {i + 1}
              </span>
              <div className="line-clamp-2 text-xs sm:text-sm whitespace-pre-wrap break-words px-4">
                {opt}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-1 mb-2 flex justify-center">
        <button
          onClick={handleSkip}
          disabled={selectedOption !== null}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-6 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors cursor-pointer"
        >
          Skip
        </button>
      </div>

      <div className="mt-1 flex flex-col items-center gap-1">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { Volume2, Eye, EyeOff } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { extractWordText, speakEnglish } from '../../utils'
import { shuffle, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen, useGameTimer } from './shared'

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
      translation: string
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
            translation: pi.translation || card.translation || pi.phrase,
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
          translation: card.translation || targetMeaning,
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
  const [showHint, setShowHint] = useState(false)

  const currentQ = allQuestions[currentIndex]

  const options = useMemo(() => {
    if (!currentQ) return []
    const wrongOptions = allWordsPool.filter(w => w.toLowerCase() !== currentQ.targetWord.toLowerCase())
    const shuffledWrong = shuffle(wrongOptions).slice(0, 3)
    const combined = [currentQ.targetWord, ...shuffledWrong]
    return shuffle(combined)
  }, [currentQ, allWordsPool])

  const handleTimeUp = () => {
    if (selectedOption !== null) return
    handleSkip()
  }

  const timer = useGameTimer({
    initialDuration: 15,
    onTimeUp: handleTimeUp,
    enabled: selectedOption === null && currentIndex < allQuestions.length
  })

  useEffect(() => {
    timer.reset()
    setShowHint(false)
  }, [currentIndex, srcMode, quizTarget])

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
          timer.reset()
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

  return (
    <div className="max-w-4xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full items-center w-full">
      <GameHeader
        onExit={onExit}
        timer={timer}
        current={currentIndex + 1}
        total={allQuestions.length}
        center={
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button
                onClick={() => { setSrcMode('highlights'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setSelectedOption(null) }}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  srcMode === 'highlights'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Words
              </button>
              <button
                onClick={() => { setSrcMode('phrases'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setSelectedOption(null) }}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  srcMode === 'phrases'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Phrases
              </button>
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button
                onClick={() => setQuizTarget('sentence')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  quizTarget === 'sentence'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Sentence
              </button>
              <button
                onClick={() => setQuizTarget('meaning')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  quizTarget === 'meaning'
                    ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
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
              className={`p-1.5 rounded-xl flex items-center gap-1 text-xs font-medium transition-colors border cursor-pointer ${
                showHint
                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={showHint ? 'Hide translation hint' : 'Show translation hint'}
            >
              {showHint ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : undefined
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-6 sm:p-8 text-center max-w-2xl mx-auto w-full relative mb-4 pb-16">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === currentQ.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute bottom-3 left-4"
        />

        <p className="text-xs font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase mb-2">
          {quizTarget === 'sentence' ? 'Fill in the blank' : 'Match word to meaning'}
        </p>

        {quizTarget === 'sentence' ? (
          <>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 leading-relaxed whitespace-pre-wrap">
              {currentQ.sentenceWithBlank.split('______').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    selectedOption && selectedOption.toLowerCase() === currentQ.targetWord.toLowerCase()
                      ? <span className="inline-block mx-1 px-3 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">{currentQ.targetWord}</span>
                      : <span className="inline-block mx-1 w-20 sm:w-28 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 align-middle" />
                  )}
                </span>
              ))}
            </h2>

            {showHint && (
              <div className="bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl p-3 sm:p-4 inline-block border border-purple-100/80 dark:border-purple-800/50 mb-3 animate-in fade-in slide-in-from-top-2 text-center max-w-lg">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">Sentence Translation</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base break-words whitespace-pre-wrap">
                  {currentQ.translation || currentQ.meaning}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 uppercase tracking-wider font-semibold">Meaning</span>
            <h2 className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap px-2">
              {currentQ.meaning || 'No definition available'}
            </h2>
          </div>
        )}

        <button
          onClick={() => speakEnglish(currentQ.sentenceFull)}
          title="Listen full sentence"
          className="absolute bottom-3 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
        >
          <Volume2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 max-w-2xl w-full">
        {options.map((opt, i) => {
          let baseBtnClass = "bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-100 shadow-xs"
          let hoverBtnClass = "hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/30"

          if (selectedOption !== null) {
            if (opt.toLowerCase() === currentQ.targetWord.toLowerCase()) {
              baseBtnClass = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold ring-2 ring-emerald-400/30"
              hoverBtnClass = ""
            } else if (opt === selectedOption) {
              baseBtnClass = "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200 font-bold ring-2 ring-rose-400/30"
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
              className={`w-full min-h-[3.25rem] p-3 rounded-2xl border text-center font-medium transition-all duration-200 relative ${baseBtnClass} ${hoverBtnClass} flex items-center justify-center cursor-pointer`}
            >
              <div className="text-sm sm:text-base font-medium whitespace-pre-wrap break-words px-3">
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
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2 text-xs sm:text-sm rounded-xl font-medium transition-colors cursor-pointer"
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

import { useState, useMemo } from 'react'
import { Volume2, Eye, EyeOff } from 'lucide-react'
import { useFlashcardStore, getCardTags } from '../../store'
import { extractWordText, speakEnglish } from '../../utils'
import { shuffle, EmptyState, ResultScreen, BackBar, BottomCounter } from './shared'

export function TypingGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

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

    const filtered = activeTags.length > 0
      ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t)))
      : flashcards

    filtered.forEach(card => {
      card.highlights.forEach(h => {
        const wordText = extractWordText(card.sentence, h.wordIndices)
        if (!wordText) return

        // Build blank sentence
        const parts = card.sentence.trim().split(/(\s+)/)
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

        let sentenceWithBlank = initialSpace
        let inBlank = false
        for (let i = 0; i < words.length; i++) {
          if (h.wordIndices.includes(i)) {
            if (!inBlank) {
              sentenceWithBlank += '______'
              inBlank = true
            }
          } else {
            inBlank = false
            sentenceWithBlank += words[i]
          }
          sentenceWithBlank += spaces[i]
        }

        questions.push({
          cardId: card.id,
          highlightId: h.id,
          targetWord: wordText,
          meaning: h.meaning,
          sentenceWithBlank: sentenceWithBlank.trim(),
          sentenceFull: card.sentence,
        })
      })
    })

    return shuffle(questions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags])

  const allWordsPool = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.targetWord)))
  }, [allQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

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
    const percentage = Math.round((score / allQuestions.length) * 100)
    return (
      <ResultScreen
        onExit={onExit}
        onAgain={() => {
          setSeed(s => s + 1)
          setCurrentIndex(0)
          setScore(0)
          setSelectedOption(null)
        }}
        lines={
          <>
            You answered <span className="font-bold text-purple-600">{score}</span> of {allQuestions.length} sentences correctly ({percentage}%)
          </>
        }
      />
    )
  }

  const handleSelect = (option: string) => {
    if (selectedOption !== null) return
    setSelectedOption(option)

    const isCorrect = option.toLowerCase() === currentQ.targetWord.toLowerCase()
    if (isCorrect) {
      setScore(s => s + 1)
      speakEnglish(currentQ.targetWord)
    }

    setTimeout(() => {
      setSelectedOption(null)
      setCurrentIndex(i => i + 1)
    }, 1500)
  }

  const [showHint, setShowHint] = useState(false)

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar 
        onExit={onExit} 
        right={
          <button 
            onClick={() => setShowHint(!showHint)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border ${
              showHint 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            {showHint ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{showHint ? 'Hide Hint' : 'Show Hint'}</span>
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center max-w-xl mx-auto w-full relative mb-6">
        <p className="text-xs font-semibold tracking-wider text-purple-600 dark:text-purple-400 uppercase mb-3">
          Fill in the blank
        </p>

        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 leading-relaxed whitespace-pre-wrap">
          {currentQ.sentenceWithBlank.split('______').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                selectedOption && selectedOption.toLowerCase() === currentQ.targetWord.toLowerCase()
                  ? <span className="inline-block mx-1 px-3 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold">{currentQ.targetWord}</span>
                  : <span className="inline-block mx-1 w-28 h-8 rounded bg-gray-200 dark:bg-gray-700 align-middle" />
              )}
            </span>
          ))}
        </h2>

        {showHint && currentQ.meaning && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 inline-block border border-purple-100 dark:border-purple-800/50 mb-4 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Meaning hint</span>
            <span className="font-medium text-purple-700 dark:text-purple-300 text-sm break-words whitespace-pre-wrap">
              {currentQ.meaning}
            </span>
          </div>
        )}

        <button
          onClick={() => speakEnglish(currentQ.sentenceFull)}
          title="Listen full sentence"
          className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
        >
          <Volume2 size={22} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
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
              key={i}
              onClick={() => handleSelect(opt)}
              disabled={selectedOption !== null}
              className={`w-full min-h-[4rem] p-4 rounded-xl border-2 text-center font-medium transition-all duration-300 ${baseBtnClass} ${hoverBtnClass} flex items-center justify-center`}
            >
              <div className="line-clamp-2 whitespace-pre-wrap break-words">
                {opt}
              </div>
            </button>
          )
        })}
      </div>

      <BottomCounter>{currentIndex + 1} / {allQuestions.length}</BottomCounter>
    </div>
  )
}

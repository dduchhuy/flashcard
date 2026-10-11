import { useState, useMemo, useEffect } from 'react'
import { Check, X, Volume2, RefreshCcw } from 'lucide-react'
import { useNotes, EmptyState, BackBar, RootCardButton, GameStatsBar, CardDetailModal } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

export function TrueFalseGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const notes = useNotes(seed, true)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [answer, setAnswer] = useState<null | { right: boolean }>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const questions = useMemo(() => {
    const meanings = Array.from(new Set(notes.map(n => n.meaning)))
    return notes.map(n => {
      const others = meanings.filter(m => m !== n.meaning)
      const isTrue = others.length === 0 || Math.random() < 0.5
      return { note: n, shown: isTrue ? n.meaning : others[Math.floor(Math.random() * others.length)], isTrue }
    })
  }, [notes])

  const q = questions[index]
  const currentCard = useMemo(() => {
    if (!q) return null
    return flashcards.find(f => f.id === q.note.cardId) || null
  }, [q, flashcards])

  const choose = (userSaysTrue: boolean) => {
    if (answer || !q) return
    const right = userSaysTrue === q.isTrue
    setAnswer({ right })
    if (right) {
      setCorrect(c => c + 1)
    } else {
      setWrong(w => w + 1)
    }
    setTimeout(() => {
      setAnswer(null)
      setIndex(i => i + 1)
    }, right ? 600 : 1500)
  }

  const handleSkip = () => {
    if (answer || !q) return
    setSkipped(s => s + 1)
    setIndex(i => i + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') choose(true)
      else if (e.key === 'ArrowLeft') choose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />
  if (index >= questions.length) {
    const total = questions.length
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Complete!</h2>
        <div className="flex gap-4 my-6">
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400 font-medium">
            Correct: {correct}
          </div>
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 font-medium">
            Wrong: {wrong}
          </div>
          <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 font-medium">
            Skipped: {skipped}
          </div>
        </div>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
          Score: <span className="font-bold text-purple-600">{percentage}%</span>
        </p>
        <div className="flex gap-4 mt-2">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={() => { setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setAnswer(null) }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className={`rounded-3xl shadow-sm border-2 p-8 mb-6 text-center relative transition-colors ${
        answer === null ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' :
        answer.right ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'
      }`}>
        <RootCardButton
          onClick={() => {
            if (currentCard) setShowModalCard(currentCard)
          }}
          className="absolute top-4 left-4"
        />

        <div className="mb-4">
          <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">{q.note.word}</h3>
          {(currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech) && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 block mt-1 break-words">{currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech}</span>
          )}
          {currentCard?.phonetic && (
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500 block font-mono mt-0.5 break-words">{currentCard.phonetic}</span>
          )}
        </div>

        <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">means</p>
        <p className="text-xl font-medium text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap">{q.shown}</p>

        {answer && !answer.right && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            Correct meaning: <span className="font-semibold">{q.note.meaning}</span>
          </p>
        )}

        <button
          onClick={() => speakEnglish(q.note.word)}
          title="Listen"
          className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
        ><Volume2 size={22} /></button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => choose(false)} disabled={!!answer} className="py-5 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-60 transition-colors">
          <X size={22} /> False
        </button>
        <button onClick={() => choose(true)} disabled={!!answer} className="py-5 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-60 transition-colors">
          <Check size={22} /> True
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          onClick={handleSkip}
          disabled={!!answer}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-8 py-2.5 rounded-xl font-medium transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {index + 1} / {questions.length}
        </p>
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

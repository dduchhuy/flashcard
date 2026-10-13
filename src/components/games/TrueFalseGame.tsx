import { useState, useMemo, useEffect } from 'react'
import { Check, X, Volume2 } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

export function TrueFalseGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [srcMode, setSrcMode] = useState<'highlights' | 'phrases'>('highlights')
  const notes = useNotes(seed, true, srcMode)
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
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 't') choose(true)
      else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'f') choose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />
  if (index >= questions.length) {
    return (
      <ResultScreen
        title="True or False Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setAnswer(null) }}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        current={index + 1}
        total={questions.length}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => { setSrcMode('highlights'); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setAnswer(null) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${srcMode === 'highlights' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Words
            </button>
            <button
              onClick={() => { setSrcMode('phrases'); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setAnswer(null) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${srcMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Phrases
            </button>
          </div>
        }
      />

      <div className={`rounded-2xl shadow-xs border-2 p-4 sm:p-5 mb-2.5 text-center relative transition-colors ${
        answer === null ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' :
        answer.right ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'
      }`}>
        <RootCardButton
          onClick={() => {
            if (currentCard) setShowModalCard(currentCard)
          }}
          className="absolute bottom-3 left-3"
        />

        <div className="mb-2">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">{q.note.word}</h3>
          {(currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech) && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block mt-0.5 break-words">{currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech}</span>
          )}
          {currentCard?.phonetic && (
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 block font-mono mt-0.5 break-words">{currentCard.phonetic}</span>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">means</p>
        <p className="text-base sm:text-lg font-medium text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap">{q.shown}</p>

        {answer && !answer.right && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            Correct meaning: <span className="font-semibold">{q.note.meaning}</span>
          </p>
        )}

        <button
          onClick={() => speakEnglish(q.note.word)}
          title="Listen"
          className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
        ><Volume2 size={20} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => choose(false)}
          disabled={!!answer}
          className="py-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-2 border-rose-200 dark:border-rose-800 font-bold text-base flex items-center justify-center gap-2 hover:bg-rose-100 hover:scale-[1.02] disabled:opacity-60 transition-all shadow-xs cursor-pointer"
        >
          <X size={20} /> False
        </button>
        <button
          onClick={() => choose(true)}
          disabled={!!answer}
          className="py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-800 font-bold text-base flex items-center justify-center gap-2 hover:bg-emerald-100 hover:scale-[1.02] disabled:opacity-60 transition-all shadow-xs cursor-pointer"
        >
          <Check size={20} /> True
        </button>
      </div>

      <div className="mt-1 flex justify-center">
        <button
          onClick={handleSkip}
          disabled={!!answer}
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

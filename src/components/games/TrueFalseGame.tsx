import { useState, useMemo, useEffect } from 'react'
import { Check, X, Volume2 } from 'lucide-react'
import { useNotes, EmptyState, ResultScreen, BackBar, BottomCounter } from './shared'
import { speakEnglish } from '../../utils'

export function TrueFalseGame({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(0)
  const notes = useNotes(seed, true)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState<null | { right: boolean }>(null)

  const questions = useMemo(() => {
    const meanings = Array.from(new Set(notes.map(n => n.meaning)))
    return notes.map(n => {
      const others = meanings.filter(m => m !== n.meaning)
      const isTrue = others.length === 0 || Math.random() < 0.5
      return { note: n, shown: isTrue ? n.meaning : others[Math.floor(Math.random() * others.length)], isTrue }
    })
  }, [notes])

  const q = questions[index]

  const choose = (userSaysTrue: boolean) => {
    if (answer || !q) return
    const right = userSaysTrue === q.isTrue
    setAnswer({ right })
    if (right) setScore(s => s + 1)
    setTimeout(() => {
      setAnswer(null)
      setIndex(i => i + 1)
    }, right ? 600 : 1500)
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
    return (
      <ResultScreen
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setScore(0); setAnswer(null) }}
        lines={<>You scored <span className="font-bold text-purple-600">{score}</span> out of {questions.length} ({Math.round((score / questions.length) * 100)}%)</>}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className={`rounded-3xl shadow-sm border-2 p-8 mb-6 text-center relative transition-colors ${
        answer === null ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' :
        answer.right ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'
      }`}>
        <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap mb-4">{q.note.word}</h3>
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
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">Use ← False · True →</p>

      <BottomCounter>{index + 1} / {questions.length}</BottomCounter>
    </div>
  )
}

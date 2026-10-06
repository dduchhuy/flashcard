import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Volume2 } from 'lucide-react'
import { useNotes, EmptyState, ResultScreen, BackBar, BottomCounter, softBtn } from './shared'
import { speakEnglish } from '../../utils'

const MAX_MISSES = 6
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

function Gallows({ misses }: { misses: number }) {
  const stroke = 'currentColor'
  return (
    <svg viewBox="0 0 120 130" className="w-32 h-36 text-gray-700 dark:text-gray-300" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round">
      <line x1="10" y1="125" x2="80" y2="125" />
      <line x1="30" y1="125" x2="30" y2="10" />
      <line x1="30" y1="10" x2="80" y2="10" />
      <line x1="80" y1="10" x2="80" y2="25" />
      {misses > 0 && <circle cx="80" cy="35" r="10" />}
      {misses > 1 && <line x1="80" y1="45" x2="80" y2="80" />}
      {misses > 2 && <line x1="80" y1="52" x2="65" y2="68" />}
      {misses > 3 && <line x1="80" y1="52" x2="95" y2="68" />}
      {misses > 4 && <line x1="80" y1="80" x2="67" y2="102" />}
      {misses > 5 && <line x1="80" y1="80" x2="93" y2="102" />}
    </svg>
  )
}

export function HangmanGame({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(0)
  const allNotes = useNotes(seed, true)
  const notes = useMemo(() => allNotes.filter(n => /[a-z]/i.test(n.word)), [allNotes])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [guessed, setGuessed] = useState<string[]>([])
  const [hints, setHints] = useState(0)

  const note = notes[index]
  const target = note ? note.word.toLowerCase() : ''
  const targetLetters = useMemo(() => Array.from(new Set(target.split('').filter(c => /[a-z]/.test(c)))), [target])
  const wrongGuesses = guessed.filter(g => !targetLetters.includes(g)).length
  const misses = Math.min(MAX_MISSES, wrongGuesses + hints)
  const won = !!note && targetLetters.every(l => guessed.includes(l))
  const lost = !!note && !won && misses >= MAX_MISSES
  const over = won || lost

  const next = () => {
    setIndex(i => i + 1)
    setGuessed([])
    setHints(0)
  }

  const guess = (letter: string) => {
    if (over || guessed.includes(letter)) return
    const nextGuessed = [...guessed, letter]
    setGuessed(nextGuessed)
    if (targetLetters.every(l => nextGuessed.includes(l))) {
      setScore(s => s + 1)
      speakEnglish(note.word)
    }
  }

  const hint = () => {
    if (over || misses >= MAX_MISSES - 1) return
    const remaining = targetLetters.filter(l => !guessed.includes(l))
    if (remaining.length <= 1) return
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    setHints(h => h + 1)
    setGuessed(g => [...g, pick])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!note) return
      if (e.key === 'Enter' && over) { next(); return }
      const k = e.key.toLowerCase()
      if (k.length === 1 && ALPHABET.includes(k)) guess(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />
  if (index >= notes.length) {
    return (
      <ResultScreen
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setScore(0); setGuessed([]); setHints(0) }}
        lines={<>You saved <span className="font-bold text-purple-600">{score}</span> of {notes.length} words ({Math.round((score / notes.length) * 100)}%)</>}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center max-w-xl mx-auto w-full relative">
        <div className="flex justify-center mb-4"><Gallows misses={misses} /></div>

        <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 mb-6 border border-purple-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Meaning</span>
          <span className="font-medium text-purple-700 dark:text-purple-300 text-lg break-words whitespace-pre-wrap">{note.meaning}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-x-2 gap-y-2 mb-6">
          {note.word.split('').map((ch, i) => {
            if (ch === ' ') return <span key={i} className="w-4" />
            const lower = ch.toLowerCase()
            const isLetter = /[a-z]/.test(lower)
            const show = !isLetter || guessed.includes(lower) || lost
            return (
              <span key={i} className={`w-8 h-10 flex items-end justify-center text-2xl font-bold border-b-4 ${
                lost && isLetter && !guessed.includes(lower) ? 'text-red-500 border-red-400' :
                won ? 'text-green-600 dark:text-green-400 border-green-500' : 'text-gray-800 dark:text-gray-100 border-gray-400 dark:border-gray-500'
              }`}>{show ? ch : ''}</span>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 mb-6">
          {ALPHABET.map(l => {
            const used = guessed.includes(l)
            const hit = used && targetLetters.includes(l)
            return (
              <button
                key={l}
                onClick={() => guess(l)}
                disabled={used || over}
                className={`w-9 h-10 rounded-lg font-bold uppercase text-sm transition-colors ${
                  hit ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                  used ? 'bg-red-100 dark:bg-red-900/30 text-red-400 dark:text-red-400/70 line-through' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                }`}
              >{l}</button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-center items-center">
          {over ? (
            <button onClick={next} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors">
              {won ? 'Nice! Next ↵' : 'Next ↵'}
            </button>
          ) : (
            <>
              <button onClick={hint} disabled={misses >= MAX_MISSES - 1} title="Reveal a letter (costs a life)" className={softBtn}><Lightbulb size={20} /></button>
              <button onClick={next} className={softBtn}>Skip</button>
            </>
          )}
        </div>

        <button onClick={() => speakEnglish(note.word)} title="Listen" className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
          <Volume2 size={22} />
        </button>
      </div>

      <BottomCounter>{index + 1} / {notes.length}</BottomCounter>
    </div>
  )
}

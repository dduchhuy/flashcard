import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Volume2 } from 'lucide-react'
import { useNotes, EmptyState, softBtn, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

const MAX_MISSES = 6
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

function Gallows({ misses }: { misses: number }) {
  const stroke = 'currentColor'
  return (
    <svg viewBox="0 0 120 130" className="w-20 sm:w-24 h-24 sm:h-28 text-gray-700 dark:text-gray-300" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round">
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
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const allNotes = useNotes(seed, true)
  const notes = useMemo(() => allNotes.filter(n => /[a-z]/i.test(n.word)), [allNotes])
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [guessed, setGuessed] = useState<string[]>([])
  const [hints, setHints] = useState(0)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

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

  const handleSkip = () => {
    setSkipped(s => s + 1)
    next()
  }

  const guess = (letter: string) => {
    if (over || guessed.includes(letter)) return
    const nextGuessed = [...guessed, letter]
    setGuessed(nextGuessed)
    if (targetLetters.every(l => nextGuessed.includes(l))) {
      setCorrect(c => c + 1)
      speakEnglish(note.word)
    } else {
      const nextWrongGuesses = nextGuessed.filter(g => !targetLetters.includes(g)).length
      if (nextWrongGuesses + hints >= MAX_MISSES) {
        setWrong(w => w + 1)
      }
    }
  }

  const hint = () => {
    if (over || misses >= MAX_MISSES - 1) return
    const remaining = targetLetters.filter(l => !guessed.includes(l))
    if (remaining.length <= 1) return
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    setHints(h => h + 1)
    const nextGuessed = [...guessed, pick]
    setGuessed(nextGuessed)
    if (targetLetters.every(l => nextGuessed.includes(l))) {
      setCorrect(c => c + 1)
      speakEnglish(note.word)
    }
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
        title="Hangman Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={() => {
          setSeed(s => s + 1)
          setIndex(0)
          setCorrect(0)
          setWrong(0)
          setSkipped(0)
          setGuessed([])
          setHints(0)
        }}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        title="Hangman"
        current={index + 1}
        total={notes.length}
        right={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs font-semibold text-red-600 dark:text-red-400">
            <span>Lives:</span>
            <span>{MAX_MISSES - misses} / {MAX_MISSES}</span>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4 text-center max-w-xl mx-auto w-full relative mb-2">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === note.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute top-3 left-3"
        />

        <div className="flex justify-center mb-2"><Gallows misses={misses} /></div>

        <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-2 sm:p-2.5 mb-2.5 border border-purple-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Meaning</span>
          <span className="font-medium text-purple-700 dark:text-purple-300 text-xs sm:text-sm break-words whitespace-pre-wrap">{note.meaning}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1.5 mb-2.5">
          {note.word.split('').map((ch, i) => {
            if (ch === ' ') return <span key={i} className="w-3" />
            const lower = ch.toLowerCase()
            const isLetter = /[a-z]/.test(lower)
            const show = !isLetter || guessed.includes(lower) || lost
            return (
              <span key={i} className={`w-6 sm:w-7 h-7 sm:h-8 flex items-end justify-center text-lg sm:text-xl font-bold border-b-2 sm:border-b-4 ${
                lost && isLetter && !guessed.includes(lower) ? 'text-red-500 border-red-400' :
                won ? 'text-green-600 dark:text-green-400 border-green-500' : 'text-gray-800 dark:text-gray-100 border-gray-400 dark:border-gray-500'
              }`}>{show ? ch : ''}</span>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-1 mb-2.5">
          {ALPHABET.map(l => {
            const used = guessed.includes(l)
            const hit = used && targetLetters.includes(l)
            return (
              <button
                key={l}
                onClick={() => guess(l)}
                disabled={used || over}
                className={`w-7 sm:w-8 h-7 sm:h-8 rounded-lg font-bold uppercase text-xs transition-colors cursor-pointer ${
                  hit ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                  used ? 'bg-red-100 dark:bg-red-900/30 text-red-400 dark:text-red-400/70 line-through cursor-default' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                }`}
              >{l}</button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2 justify-center items-center">
          {over ? (
            <button onClick={next} className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors cursor-pointer">
              {won ? 'Nice! Next ↵' : 'Next ↵'}
            </button>
          ) : (
            <>
              <button onClick={hint} disabled={misses >= MAX_MISSES - 1} title="Reveal a letter (costs a life)" className={softBtn}><Lightbulb size={16} /></button>
              <button onClick={handleSkip} className={`${softBtn} text-xs sm:text-sm`}>Skip</button>
            </>
          )}
        </div>

        <button onClick={() => speakEnglish(note.word)} title="Listen" className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer">
          <Volume2 size={20} />
        </button>
      </div>

      <div className="mt-1 flex flex-col items-center gap-1">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

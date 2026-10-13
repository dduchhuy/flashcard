import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Volume2, SkipForward } from 'lucide-react'
import { EmptyState, softBtn, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen, useGameTimer } from './shared'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard } from '../../store'
import { speakEnglish, extractWordText } from '../../utils'

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
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [meaningMode, setMeaningMode] = useState<'all' | 'first'>('all')

  const notes = useMemo(() => {
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)

    const list: { cardId: string; word: string; meaning: string }[] = []
    filtered.forEach(card => {
      const hls = card.highlights || []
      if (hls.length === 0) return

      if (meaningMode === 'first') {
        const h = hls[0]
        const w = gameInputMode === 'word' ? card.sentence.trim() : extractWordText(card.sentence, h.wordIndices)
        if (/[a-z]/i.test(w)) {
          list.push({ cardId: card.id, word: w, meaning: h.meaning })
        }
      } else {
        hls.forEach(h => {
          const w = gameInputMode === 'word' ? card.sentence.trim() : extractWordText(card.sentence, h.wordIndices)
          if (/[a-z]/i.test(w)) {
            list.push({ cardId: card.id, word: w, meaning: h.meaning })
          }
        })
      }
    })
    return list.sort(() => Math.random() - 0.5)
  }, [flashcards, activeTags, gameInputMode, meaningMode, seed])

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
  const won = !!note && targetLetters.length > 0 && targetLetters.every(l => guessed.includes(l))
  const lost = !!note && !won && misses >= MAX_MISSES
  const over = won || lost

  const handleTimeUp = () => {
    if (over) return
    setHints(h => {
      const nextH = h + 1
      if (wrongGuesses + nextH >= MAX_MISSES) {
        setWrong(w => w + 1)
      }
      return nextH
    })
    timer.reset()
  }

  const timer = useGameTimer({
    initialDuration: 25,
    onTimeUp: handleTimeUp,
    enabled: !over && index < notes.length
  })

  useEffect(() => {
    setGuessed([])
    setHints(0)
    timer.reset()
  }, [index, meaningMode])

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
          timer.reset()
        }}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full items-center w-full">
      <GameHeader
        onExit={onExit}
        timer={timer}
        title="Hangman"
        current={index + 1}
        total={notes.length}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => { setMeaningMode('all'); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0) }}
              className={`px-3 py-1 rounded-lg transition-colors ${
                meaningMode === 'all'
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              All Meanings
            </button>
            <button
              onClick={() => { setMeaningMode('first'); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0) }}
              className={`px-3 py-1 rounded-lg transition-colors ${
                meaningMode === 'first'
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              1st Meaning
            </button>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-6 sm:p-8 text-center max-w-2xl mx-auto w-full relative mb-3 pb-16">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === note.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute bottom-3 left-4"
        />

        <div className="flex justify-center mb-3"><Gallows misses={misses} /></div>

        <div className="bg-purple-50/70 dark:bg-gray-900/50 rounded-2xl p-3 sm:p-4 mb-4 border border-purple-100/80 dark:border-gray-700">
          <span className="text-xs uppercase tracking-wider font-semibold text-purple-600 dark:text-purple-400 block mb-1">Meaning</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-base sm:text-lg break-words whitespace-pre-wrap">{note.meaning}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-x-2 gap-y-2 mb-5 min-h-[2.5rem]">
          {note.word.split('').map((ch, i) => {
            if (ch === ' ') return <span key={i} className="w-4" />
            const lower = ch.toLowerCase()
            const isLetter = /[a-z]/.test(lower)
            const show = !isLetter || guessed.includes(lower) || lost
            return (
              <span key={i} className={`w-8 sm:w-10 h-10 sm:h-12 flex items-end justify-center text-xl sm:text-2xl font-black border-b-4 uppercase ${
                lost && isLetter && !guessed.includes(lower) ? 'text-rose-500 border-rose-400' :
                won ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500' : 'text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600'
              }`}>{show ? ch : ''}</span>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 mb-5 max-w-xl mx-auto">
          {ALPHABET.map(l => {
            const used = guessed.includes(l)
            const hit = used && targetLetters.includes(l)
            return (
              <button
                key={l}
                onClick={() => guess(l)}
                disabled={used || over}
                className={`w-8 sm:w-9 h-8 sm:h-9 rounded-xl font-bold uppercase text-xs sm:text-sm transition-all cursor-pointer ${
                  hit ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black' :
                  used ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-400 line-through opacity-60 cursor-default' :
                  'bg-gray-100 hover:bg-purple-100 dark:bg-gray-700 dark:hover:bg-purple-900/40 text-gray-800 dark:text-gray-200'
                }`}
              >{l}</button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2.5 justify-center items-center">
          {over ? (
            <button onClick={next} className="bg-purple-600 text-white px-7 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors cursor-pointer shadow-sm">
              {won ? 'Nice! Next ↵' : 'Next ↵'}
            </button>
          ) : (
            <>
              <button onClick={hint} disabled={misses >= MAX_MISSES - 1} title="Reveal a letter (costs 1 life)" className={softBtn}>
                <Lightbulb size={16} />
                <span>Hint</span>
              </button>
              <button onClick={handleSkip} className={`${softBtn} text-xs sm:text-sm`}>
                <SkipForward size={16} />
                <span>Skip</span>
              </button>
            </>
          )}
        </div>

        <button 
          onClick={() => speakEnglish(note.word)} 
          title="Listen" 
          className="absolute bottom-3 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
        >
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

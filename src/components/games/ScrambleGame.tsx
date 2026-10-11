import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Shuffle, Volume2, RefreshCcw } from 'lucide-react'
import { shuffle, useNotes, EmptyState, BackBar, softBtn, RootCardButton, GameStatsBar, CardDetailModal } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

export function ScrambleGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const notes = useNotes(seed, true)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [slots, setSlots] = useState<(number | null)[]>([])
  const [hintedSlots, setHintedSlots] = useState<number[]>([])
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  const [shuffleKey, setShuffleKey] = useState(0)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const note = notes[index]
  const letters = useMemo(() => (note ? note.word.replace(/\s/g, '').split('') : []), [note])

  useEffect(() => {
    setSlots(new Array(letters.length).fill(null))
    setHintedSlots([])
    setStatus('playing')
  }, [letters])

  const tiles = useMemo(() => {
    const base = letters.map((ch, id) => ({ id, ch }))
    if (base.length < 2) return base
    let out = shuffle(base)
    for (let t = 0; t < 10 && out.map(x => x.ch).join('') === letters.join(''); t++) out = shuffle(base)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, shuffleKey])

  const next = () => {
    setIndex(i => i + 1)
    setSlots([])
    setHintedSlots([])
    setStatus('playing')
  }

  const handleSkip = () => {
    if (status !== 'playing') return
    setStatus('skipped')
    setSkipped(s => s + 1)
    setTimeout(next, 1200)
  }

  const checkSlots = (newSlots: (number | null)[]) => {
    if (newSlots.some(s => s === null)) return
    const guess = newSlots.map(id => (id !== null ? tiles.find(t => t.id === id)?.ch : '')).join('').toLowerCase()
    const target = letters.join('').toLowerCase()
    if (guess === target) {
      setStatus('correct')
      setCorrect(c => c + 1)
      speakEnglish(note.word)
      setTimeout(next, 1300)
    } else {
      setStatus('wrong')
      setWrong(w => w + 1)
      setTimeout(next, 1500)
    }
  }

  const addTile = (tileId: number) => {
    if (status !== 'playing' || slots.includes(tileId)) return
    const firstEmpty = slots.findIndex(s => s === null)
    if (firstEmpty === -1) return
    const nextSlots = [...slots]
    nextSlots[firstEmpty] = tileId
    setSlots(nextSlots)
    checkSlots(nextSlots)
  }

  const removeAt = (pos: number) => {
    if (status !== 'playing') return
    if (hintedSlots.includes(pos)) return
    const nextSlots = [...slots]
    nextSlots[pos] = null
    setSlots(nextSlots)
  }

  const hint = () => {
    if (status !== 'playing') return
    const unhinted = letters.map((_, i) => i).filter(i => !hintedSlots.includes(i))
    if (unhinted.length === 0) {
      handleSkip()
      return
    }

    const targetPos = unhinted[Math.floor(Math.random() * unhinted.length)]
    const targetChar = letters[targetPos].toLowerCase()

    let matchingTile = tiles.find(t => !slots.includes(t.id) && t.ch.toLowerCase() === targetChar)
    if (!matchingTile) {
      matchingTile = tiles.find(t => t.ch.toLowerCase() === targetChar && (!slots.includes(t.id) || !hintedSlots.includes(slots.indexOf(t.id))))
    }
    if (!matchingTile) return

    const nextSlots = [...slots]
    const prevPos = nextSlots.indexOf(matchingTile.id)
    if (prevPos !== -1 && prevPos !== targetPos) {
      nextSlots[prevPos] = null
    }
    nextSlots[targetPos] = matchingTile.id
    setSlots(nextSlots)

    const nextHinted = [...hintedSlots, targetPos]
    setHintedSlots(nextHinted)

    if (nextHinted.length >= letters.length) {
      setStatus('skipped')
      setSkipped(s => s + 1)
      setTimeout(next, 1200)
      return
    }

    checkSlots(nextSlots)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== 'playing' || !note) return
      if (e.key === 'Backspace') {
        for (let i = slots.length - 1; i >= 0; i--) {
          if (slots[i] !== null && !hintedSlots.includes(i)) {
            const nextSlots = [...slots]
            nextSlots[i] = null
            setSlots(nextSlots)
            break
          }
        }
      } else if (e.key.length === 1) {
        const tile = tiles.find(t => !slots.includes(t.id) && t.ch.toLowerCase() === e.key.toLowerCase())
        if (tile) addTile(tile.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />
  if (index >= notes.length) {
    const total = notes.length
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
          <button onClick={() => { setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setSlots([]); setHintedSlots([]); setStatus('playing') }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  let k = 0
  const renderedSlots = note.word.split('').map((ch, i) => {
    if (ch === ' ') return <span key={i} className="w-4" />
    const pos = k++
    const tileId = slots[pos]
    const tileChar = tileId !== null && tileId !== undefined ? tiles.find(t => t.id === tileId)?.ch : ''
    const filled = status === 'wrong' || status === 'skipped' ? letters[pos] : tileChar
    const isHinted = hintedSlots.includes(pos)

    return (
      <button
        key={i}
        onClick={() => tileId !== null && removeAt(pos)}
        className={`w-10 h-12 rounded-lg border-2 text-xl font-bold flex items-center justify-center transition-colors ${
          status === 'correct' ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
          status === 'wrong' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
          status === 'skipped' ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
          isHinted ? 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/50 dark:border-purple-500 dark:text-purple-200' :
          filled ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-200' :
          'bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600'
        }`}
      >{filled}</button>
    )
  })

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 pt-14 text-center max-w-xl mx-auto w-full relative">
        <RootCardButton
          onClick={() => {
            const c = flashcards.find(f => f.id === note.cardId)
            if (c) setShowModalCard(c)
          }}
          className="absolute top-4 left-4"
        />

        <button
          onClick={() => speakEnglish(note.word)}
          title="Listen"
          className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
        >
          <Volume2 size={22} />
        </button>

        <div className="bg-purple-50 dark:bg-gray-900 rounded-xl p-4 mb-8 border border-purple-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Meaning</span>
          <span className="font-medium text-purple-700 dark:text-purple-300 text-lg break-words whitespace-pre-wrap">{note.meaning}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">{renderedSlots}</div>

        <div className="flex flex-wrap justify-center gap-2 mb-8 min-h-[3rem]">
          {tiles.map(t => {
            const isUsed = slots.includes(t.id)
            return (
              <button
                key={t.id}
                onClick={() => addTile(t.id)}
                disabled={isUsed || status !== 'playing'}
                className={`w-10 h-12 rounded-lg text-xl font-bold transition-all ${
                  isUsed
                    ? 'bg-transparent border-2 border-dashed border-gray-200 dark:border-gray-700 text-transparent'
                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:-translate-y-0.5 shadow-sm'
                }`}
              >{t.ch}</button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => {
              const reset = slots.map((s, i) => hintedSlots.includes(i) ? s : null)
              setSlots(reset)
              setShuffleKey(x => x + 1)
            }}
            disabled={status !== 'playing'}
            title="Shuffle letters"
            className={softBtn}
          >
            <Shuffle size={20} />
          </button>
          <button onClick={hint} disabled={status !== 'playing'} title="Hint" className={softBtn}><Lightbulb size={20} /></button>
          <button onClick={handleSkip} disabled={status !== 'playing'} className={softBtn}>Skip</button>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {index + 1} / {notes.length}
        </p>
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

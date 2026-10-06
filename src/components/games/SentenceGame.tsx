import { useState, useMemo } from 'react'
import { RotateCcw, Volume2 } from 'lucide-react'
import { useFlashcardStore, getCardTags } from '../../store'
import { extractWordsAndSpaces, speakEnglish } from '../../utils'
import { shuffle, EmptyState, ResultScreen, BackBar, BottomCounter, softBtn } from './shared'

export function SentenceGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const items = useMemo(() => {
    const filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    const list = filtered
      .map(card => ({
        card,
        tokens: extractWordsAndSpaces(card.sentence).words.filter(w => w.length > 0),
      }))
      .filter(x => x.tokens.length >= 3)
    return shuffle(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags])

  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [placed, setPlaced] = useState<number[]>([])
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing')
  const [wrongOnce, setWrongOnce] = useState(false)

  const item = items[index]

  const pool = useMemo(() => {
    if (!item) return []
    const base = item.tokens.map((t, id) => ({ id, t }))
    let out = shuffle(base)
    for (let k = 0; k < 10 && out.map(x => x.t).join(' ') === item.tokens.join(' '); k++) out = shuffle(base)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  const next = () => {
    setIndex(i => i + 1)
    setPlaced([])
    setStatus('playing')
    setWrongOnce(false)
  }

  const add = (id: number) => {
    if (status !== 'playing' || placed.includes(id)) return
    const nextPlaced = [...placed, id]
    setPlaced(nextPlaced)
    if (nextPlaced.length === item.tokens.length) {
      const guess = nextPlaced.map(i => item.tokens[i]).join(' ')
      if (guess === item.tokens.join(' ')) {
        setStatus('correct')
        if (!wrongOnce) setScore(s => s + 1)
        speakEnglish(item.card.sentence)
        setTimeout(next, 2200)
      } else {
        setStatus('wrong')
        setWrongOnce(true)
        setTimeout(() => { setPlaced([]); setStatus('playing') }, 900)
      }
    }
  }

  const removeAt = (pos: number) => {
    if (status !== 'playing') return
    setPlaced(p => p.filter((_, i) => i !== pos))
  }

  if (flashcards.length === 0 || items.length === 0) {
    return <EmptyState onExit={onExit} text="No sentences with 3 or more words found." />
  }
  if (index >= items.length) {
    return (
      <ResultScreen
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setScore(0); setPlaced([]); setStatus('playing'); setWrongOnce(false) }}
        lines={<>You built <span className="font-bold text-purple-600">{score}</span> of {items.length} sentences on the first try ({Math.round((score / items.length) * 100)}%)</>}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center max-w-xl mx-auto w-full relative">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tap the words in the right order</p>

        <div className={`min-h-[5rem] rounded-xl border-2 border-dashed p-3 mb-6 flex flex-wrap gap-2 justify-center items-center transition-colors ${
          status === 'correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
          status === 'wrong' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
          'border-gray-300 dark:border-gray-600'
        }`}>
          {status === 'correct' ? (
            <span className="text-lg text-green-700 dark:text-green-300 whitespace-pre-wrap">{item.card.sentence}</span>
          ) : placed.map((id, pos) => (
            <button key={pos} onClick={() => removeAt(pos)} className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors">
              {item.tokens[id]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8 min-h-[3rem]">
          {pool.map(p => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={placed.includes(p.id) || status !== 'playing'}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                placed.includes(p.id)
                  ? 'border-2 border-dashed border-gray-200 dark:border-gray-700 text-transparent select-none'
                  : 'bg-purple-600 text-white hover:bg-purple-700 hover:-translate-y-0.5 shadow-sm'
              }`}
            >{p.t}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => setPlaced([])} disabled={status !== 'playing'} title="Reset" className={softBtn}><RotateCcw size={20} /></button>
          <button onClick={() => speakEnglish(item.card.sentence)} title="Listen to sentence" className={softBtn}><Volume2 size={20} /></button>
          <button onClick={next} disabled={status !== 'playing'} className={softBtn}>Skip</button>
        </div>

        {status === 'correct' && (
          <button onClick={() => speakEnglish(item.card.sentence)} title="Listen" className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <Volume2 size={22} />
          </button>
        )}
      </div>

      <BottomCounter>{index + 1} / {items.length}</BottomCounter>
    </div>
  )
}

import { useState, useMemo, useRef } from 'react'
import { RotateCcw, Volume2, RefreshCcw } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard } from '../../store'
import { extractWordsAndSpaces, speakEnglish } from '../../utils'
import { shuffle, EmptyState, BackBar, softBtn, RootCardButton, GameStatsBar, CardDetailModal } from './shared'

export function SentenceGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const items = useMemo(() => {
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    let list: { card: any, sentence: string, tokens: string[] }[] = []
    
    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (gameInputMode === 'word' && highlights.length > 0) {
        highlights.forEach(h => {
          const targetSentence = h.example || card.sentence
          list.push({
            card,
            sentence: targetSentence,
            tokens: extractWordsAndSpaces(targetSentence).words.filter(w => w.length > 0)
          })
        })
      } else {
        list.push({
          card,
          sentence: card.sentence,
          tokens: extractWordsAndSpaces(card.sentence).words.filter(w => w.length > 0)
        })
      }
    })
    
    list = list.filter(x => x.tokens.length >= 3)
    return shuffle(list)
  }, [flashcards, seed, activeTags, gameInputMode])

  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [placed, setPlaced] = useState<number[]>([])
  const [typedInput, setTypedInput] = useState('')
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'skipped'>('playing')
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    setTypedInput('')
    setStatus('playing')
  }

  const handleSkip = () => {
    if (status !== 'playing') return
    setStatus('skipped')
    setSkipped(s => s + 1)
    setTimeout(next, 1500)
  }

  const checkGuess = (guessStr: string) => {
    const cleanGuess = guessStr.trim().toLowerCase().replace(/[.,!?;:'"]/g, '')
    const cleanTarget = item.sentence.trim().toLowerCase().replace(/[.,!?;:'"]/g, '')
    if (cleanGuess === cleanTarget) {
      setStatus('correct')
      setCorrect(c => c + 1)
      speakEnglish(item.sentence)
      setTimeout(next, 2000)
    } else {
      setStatus('wrong')
      setWrong(w => w + 1)
      setTimeout(() => {
        setPlaced([])
        setTypedInput('')
        setStatus('playing')
      }, 1500)
    }
  }

  const add = (id: number) => {
    if (status !== 'playing' || placed.includes(id)) return
    const nextPlaced = [...placed, id]
    setPlaced(nextPlaced)
    const text = nextPlaced.map(i => item.tokens[i]).join(' ')
    setTypedInput(text)
    if (nextPlaced.length === item.tokens.length) {
      checkGuess(text)
    }
  }

  const removeAt = (pos: number) => {
    if (status !== 'playing') return
    const nextPlaced = placed.filter((_, i) => i !== pos)
    setPlaced(nextPlaced)
    setTypedInput(nextPlaced.map(i => item.tokens[i]).join(' '))
  }

  const handleTypedInput = (val: string) => {
    if (status !== 'playing') return
    setTypedInput(val)
    const words = val.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const newPlaced: number[] = []
    const used = new Set<number>()
    for (const w of words) {
      const cleanW = w.replace(/[^\w]/g, '')
      const match = pool.find(p => !used.has(p.id) && p.t.toLowerCase().replace(/[^\w]/g, '') === cleanW)
      if (match) {
        newPlaced.push(match.id)
        used.add(match.id)
      }
    }
    setPlaced(newPlaced)
  }

  if (flashcards.length === 0 || items.length === 0) {
    return <EmptyState onExit={onExit} text="No sentences with 3 or more words found." />
  }
  if (index >= items.length) {
    const total = items.length
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
          <button onClick={() => { setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setPlaced([]); setTypedInput(''); setStatus('playing') }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center max-w-xl mx-auto w-full relative">
        <RootCardButton
          onClick={() => {
            if (item?.card) setShowModalCard(item.card)
          }}
          className="absolute top-4 left-4"
        />

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tap words in order or type the sentence</p>

        <div className={`min-h-[5rem] rounded-xl border-2 border-dashed p-3 mb-4 flex flex-wrap gap-2 justify-center items-center transition-colors ${
          status === 'correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
          status === 'wrong' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
          status === 'skipped' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
          'border-gray-300 dark:border-gray-600'
        }`}>
          {status === 'correct' || status === 'wrong' || status === 'skipped' ? (
            <span className={`text-lg font-medium whitespace-pre-wrap ${
              status === 'correct' ? 'text-green-700 dark:text-green-300' :
              status === 'wrong' ? 'text-red-700 dark:text-red-300' :
              'text-orange-700 dark:text-orange-300'
            }`}>{item.sentence}</span>
          ) : placed.map((id, pos) => (
            <button key={pos} onClick={() => removeAt(pos)} className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors">
              {item.tokens[id]}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <input
            ref={inputRef}
            type="text"
            value={typedInput}
            onChange={e => handleTypedInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && typedInput.trim()) {
                checkGuess(typedInput)
              }
            }}
            disabled={status !== 'playing'}
            placeholder="Type sentence here and press Enter..."
            className="w-full px-4 py-2.5 text-center text-base rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
          />
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
          <button onClick={() => { setPlaced([]); setTypedInput('') }} disabled={status !== 'playing'} title="Reset" className={softBtn}><RotateCcw size={20} /></button>
          <button onClick={() => speakEnglish(item.sentence)} title="Listen to sentence" className={softBtn}><Volume2 size={20} /></button>
          <button onClick={handleSkip} disabled={status !== 'playing'} className={softBtn}>Skip</button>
        </div>

        {status === 'correct' && (
          <button onClick={() => speakEnglish(item.sentence)} title="Listen" className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <Volume2 size={22} />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {index + 1} / {items.length}
        </p>
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

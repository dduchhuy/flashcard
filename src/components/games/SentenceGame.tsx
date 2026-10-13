import { useState, useMemo, useRef } from 'react'
import { RotateCcw, Volume2 } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { extractWordsAndSpaces, speakEnglish } from '../../utils'
import { shuffle, EmptyState, softBtn, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen } from './shared'

export function SentenceGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [srcMode, setSrcMode] = useState<'highlights' | 'phrases'>('highlights')

  const items = useMemo(() => {
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    let list: { card: any, sentence: string, tokens: string[], meaning?: string }[] = []
    
    if (srcMode === 'phrases') {
      filtered.forEach(card => {
        const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem)
        phrases.forEach(pi => {
          if (!pi.phrase) return
          list.push({
            card,
            sentence: pi.phrase,
            tokens: extractWordsAndSpaces(pi.phrase).words.filter(w => w.length > 0),
            meaning: pi.translation,
          })
        })
      })
    } else {
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
    }
    
    list = list.filter(x => x.tokens.length >= 3)
    return shuffle(list)
  }, [flashcards, seed, activeTags, gameInputMode, srcMode])

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
    return (
      <ResultScreen
        title="Sentence Builder Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setPlaced([]); setTypedInput(''); setStatus('playing') }}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        current={index + 1}
        total={items.length}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => { setSrcMode('highlights'); setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setStatus('playing') }}
              className={`px-3 py-1.5 rounded-md transition-colors ${srcMode === 'highlights' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Words
            </button>
            <button
              onClick={() => { setSrcMode('phrases'); setSeed(s => s + 1); setIndex(0); setCorrect(0); setWrong(0); setSkipped(0); setStatus('playing') }}
              className={`px-3 py-1.5 rounded-md transition-colors ${srcMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'}`}
            >
              Phrases
            </button>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 p-4 sm:p-5 text-center max-w-xl mx-auto w-full relative mb-2">
        <RootCardButton
          onClick={() => {
            if (item?.card) setShowModalCard(item.card)
          }}
          className="absolute top-3 left-3"
        />

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tap words in order or type the sentence</p>

        <div className={`min-h-[3.75rem] rounded-xl border-2 border-dashed p-2.5 mb-2.5 flex flex-wrap gap-1.5 sm:gap-2 justify-center items-center transition-colors ${
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
            <button key={pos} onClick={() => removeAt(pos)} className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs sm:text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors cursor-pointer">
              {item.tokens[id]}
            </button>
          ))}
        </div>

        <div className="mb-3">
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
            className="w-full px-3 py-1.5 text-center text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mb-3 min-h-[2.5rem]">
          {pool.map(p => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={placed.includes(p.id) || status !== 'playing'}
              className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                placed.includes(p.id)
                  ? 'border-2 border-dashed border-gray-200 dark:border-gray-700 text-transparent select-none'
                  : 'bg-purple-600 text-white hover:bg-purple-700 hover:-translate-y-0.5 shadow-2xs'
              }`}
            >{p.t}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={() => { setPlaced([]); setTypedInput('') }} disabled={status !== 'playing'} title="Reset" className={softBtn}><RotateCcw size={16} /></button>
          <button onClick={() => speakEnglish(item.sentence)} title="Listen to sentence" className={softBtn}><Volume2 size={16} /></button>
          <button onClick={handleSkip} disabled={status !== 'playing'} className={`${softBtn} text-xs sm:text-sm`}>Skip</button>
        </div>

        {status === 'correct' && (
          <button onClick={() => speakEnglish(item.sentence)} title="Listen" className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer">
            <Volume2 size={20} />
          </button>
        )}
      </div>

      <div className="mt-1 flex flex-col items-center gap-1">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

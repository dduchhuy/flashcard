import { useState, useMemo } from 'react'
import { Zap, Volume2 } from 'lucide-react'
import { shuffle, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen, useGameTimer } from './shared'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { speakEnglish, extractWordText } from '../../utils'

const BEST_KEY = 'flashcard_speed_best'

export function SpeedGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [srcMode, setSrcMode] = useState<'highlights' | 'highlights-first' | 'phrases'>('highlights')
  const [stage, setStage] = useState<'ready' | 'playing' | 'done'>('ready')
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem(BEST_KEY) || 0))
  const [newRecord, setNewRecord] = useState(false)
  const [mode, setMode] = useState<'word' | 'meaning'>('word')
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const notes = useMemo(() => {
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)

    const list: { cardId: string; word: string; meaning: string }[] = []
    if (srcMode === 'phrases') {
      filtered.forEach(card => {
        (card.phrasesAndIdioms || []).map(normalizePhraseItem).forEach(p => {
          if (p.phrase) list.push({ cardId: card.id, word: p.phrase, meaning: p.translation || p.phrase })
        })
      })
    } else if (srcMode === 'highlights-first') {
      filtered.forEach(card => {
        const h = (card.highlights || [])[0]
        if (h) {
          const w = gameInputMode === 'word' ? card.sentence.trim() : extractWordText(card.sentence, h.wordIndices)
          list.push({ cardId: card.id, word: w, meaning: h.meaning })
        }
      })
    } else {
      filtered.forEach(card => {
        (card.highlights || []).forEach(h => {
          const w = gameInputMode === 'word' ? card.sentence.trim() : extractWordText(card.sentence, h.wordIndices)
          list.push({ cardId: card.id, word: w, meaning: h.meaning })
        })
      })
    }
    return shuffle(list)
  }, [flashcards, activeTags, gameInputMode, srcMode, seed])

  const note = notes.length ? notes[qi % notes.length] : undefined
  const currentCard = useMemo(() => {
    if (!note) return null
    return flashcards.find(f => f.id === note.cardId) || null
  }, [note, flashcards])

  const handleTimeUp = () => {
    setStage('done')
    if (score > best) {
      setBest(score)
      setNewRecord(true)
      localStorage.setItem(BEST_KEY, String(score))
    }
  }

  const timer = useGameTimer({
    initialDuration: 60,
    onTimeUp: handleTimeUp,
    enabled: stage === 'playing'
  })

  const options = useMemo(() => {
    if (!note) return []
    const target = mode === 'word' ? note.meaning : note.word
    let pool: string[] = []
    if (mode === 'word') {
      const validNotes = notes.filter(n => n.word.toLowerCase() !== note.word.toLowerCase() && n.meaning.toLowerCase() !== note.meaning.toLowerCase())
      pool = Array.from(new Set(validNotes.map(n => n.meaning)))
    } else {
      const validNotes = notes.filter(n => n.meaning.toLowerCase() !== note.meaning.toLowerCase() && n.word.toLowerCase() !== note.word.toLowerCase())
      pool = Array.from(new Set(validNotes.map(n => n.word)))
    }
    return shuffle([target, ...shuffle(pool).slice(0, 3)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, notes, mode])

  const start = () => {
    setSeed(s => s + 1)
    setStage('playing')
    setQi(0)
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setCorrect(0)
    setWrong(0)
    setSkipped(0)
    setSelected(null)
    setNewRecord(false)
    timer.reset()
  }

  const handleSkip = () => {
    if (stage !== 'playing' || !note) return
    setSkipped(s => s + 1)
    setCombo(0)
    setSelected(null)
    setQi(q => q + 1)
  }

  const choose = (opt: string) => {
    if (selected !== null || stage !== 'playing' || !note) return
    setSelected(opt)
    const target = mode === 'word' ? note.meaning : note.word
    if (opt === target) {
      setScore(s => s + 10 + Math.min(combo, 10) * 2)
      setCombo(c => { const n = c + 1; setBestCombo(b => Math.max(b, n)); return n })
      setCorrect(c => c + 1)
      timer.addTime(1)
    } else {
      setCombo(0)
      setWrong(w => w + 1)
      timer.addTime(-1)
    }
    setTimeout(() => {
      setSelected(null)
      setQi(q => q + 1)
    }, opt === target ? 250 : 700)
  }

  if (notes.length === 0) return <EmptyState onExit={onExit} />

  if (stage === 'ready') {
    return (
      <div className="max-w-4xl mx-auto py-6 animate-in fade-in flex flex-col items-center w-full">
        <GameHeader onExit={onExit} title="Speed Match" />
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-8 sm:p-12 text-center max-w-xl mx-auto w-full">
          <div className="inline-flex bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 p-4 rounded-full mb-4">
            <Zap size={36} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Speed Match</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm sm:text-base">
            Pick the right answer as fast as you can. Correct: +1s, Wrong: -1s. Streaks give bonus points!
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
            Best score: <span className="font-extrabold text-amber-600 dark:text-amber-400">{best} pts</span>
          </p>
          
          {/* Source mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 mb-8 inline-flex self-center mx-auto w-fit border border-gray-200/60 dark:border-gray-800">
            <button
              onClick={() => {
                if (srcMode === 'highlights') setSrcMode('highlights-first')
                else if (srcMode === 'highlights-first') setSrcMode('highlights')
                else setSrcMode('highlights')
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                srcMode === 'highlights' || srcMode === 'highlights-first'
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {srcMode === 'highlights-first' ? 'Word¹' : 'Words*'}
            </button>
            <button
              onClick={() => setSrcMode('phrases')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                srcMode === 'phrases'
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              Phrases
            </button>
          </div>

          <div>
            <button onClick={start} className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white px-10 py-3 rounded-2xl font-bold shadow-sm transition-all cursor-pointer text-base">
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <ResultScreen
        title={newRecord ? "🎉 New High Score!" : "Time's Up!"}
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        lines={
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
              Score: {score} pts
            </span>
            <span className="text-xs text-gray-500">
              Best: {best} pts · Best Streak: {bestCombo}🔥
            </span>
          </div>
        }
        onExit={onExit}
        onAgain={start}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full items-center w-full">
      <GameHeader
        onExit={() => { setStage('ready'); onExit() }}
        timer={timer}
        center={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold">
              <Zap size={14} className="fill-amber-500 text-amber-500" />
              <span>{score} pts</span>
            </div>
            {combo > 1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-xs font-bold animate-bounce">
                {combo}x Streak 🔥
              </span>
            )}
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-6 sm:p-8 mb-4 text-center relative min-h-[8rem] flex flex-col items-center justify-center max-w-2xl w-full pb-16">
        <RootCardButton
          onClick={() => {
            if (currentCard) setShowModalCard(currentCard)
          }}
          className="absolute bottom-3 left-4"
        />

        <button
          onClick={() => setMode(m => m === 'word' ? 'meaning' : 'word')}
          className="absolute top-3.5 right-4 text-xs font-bold px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:text-purple-600 transition-colors cursor-pointer border border-gray-200 dark:border-gray-600"
        >
          {mode === 'word' ? 'EN → VI' : 'VI → EN'}
        </button>

        {mode === 'word' ? (
          <div className="text-center px-4">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">{note!.word}</h3>
            {(currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech) && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block mt-1 break-words">{currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech}</span>
            )}
            {currentCard?.phonetic && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 block font-mono mt-0.5 break-words">{currentCard.phonetic}</span>
            )}
          </div>
        ) : (
          <h3 className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300 break-words whitespace-pre-wrap px-4">{note!.meaning}</h3>
        )}

        {mode === 'word' && (
          <button
            onClick={() => speakEnglish(note!.word)}
            title="Listen"
            className="absolute bottom-3 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
          ><Volume2 size={20} /></button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 max-w-2xl w-full">
        {options.map((opt, i) => {
          const target = mode === 'word' ? note!.meaning : note!.word
          const isCorrect = opt === target
          let cls = 'bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 shadow-xs'
          if (selected !== null) {
            if (isCorrect) cls = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold ring-2 ring-emerald-400/30'
            else if (opt === selected) cls = 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200 font-bold ring-2 ring-rose-400/30'
            else cls = 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-50'
          }
          return (
            <button key={`${note!.cardId}-${i}`} onClick={() => choose(opt)} disabled={selected !== null} className={`min-h-[3.25rem] p-3 rounded-2xl border text-center font-medium transition-all relative flex items-center justify-center cursor-pointer ${cls}`}>
              <span className="line-clamp-2 whitespace-pre-wrap break-words px-3 text-sm sm:text-base font-medium">{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex justify-center">
        <button
          onClick={handleSkip}
          disabled={selected !== null}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2 text-xs sm:text-sm rounded-xl font-medium transition-colors cursor-pointer"
        >
          Skip
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        <GameStatsBar correct={correct} wrong={wrong} skipped={skipped} />
      </div>

      <CardDetailModal card={showModalCard} onClose={() => setShowModalCard(null)} />
    </div>
  )
}

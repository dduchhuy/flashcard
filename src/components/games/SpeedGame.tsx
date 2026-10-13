import { useState, useMemo, useEffect } from 'react'
import { Zap, Volume2 } from 'lucide-react'
import { shuffle, useNotes, EmptyState, RootCardButton, GameStatsBar, CardDetailModal, GameHeader, ResultScreen } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

const BEST_KEY = 'flashcard_speed_best'

export function SpeedGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [srcMode, setSrcMode] = useState<'highlights' | 'phrases'>('highlights')
  const notes = useNotes(seed, false, srcMode)
  const [stage, setStage] = useState<'ready' | 'playing' | 'done'>('ready')
  const [customDuration, setCustomDuration] = useState(60)
  const [timeLeft, setTimeLeft] = useState(60)
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

  const note = notes.length ? notes[qi % notes.length] : undefined
  const currentCard = useMemo(() => {
    if (!note) return null
    return flashcards.find(f => f.id === note.cardId) || null
  }, [note, flashcards])

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

  useEffect(() => {
    if (stage !== 'playing') return
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [stage])

  useEffect(() => {
    if (stage === 'playing' && timeLeft <= 0) {
      setStage('done')
      if (score > best) {
        setBest(score)
        setNewRecord(true)
        localStorage.setItem(BEST_KEY, String(score))
      }
    }
  }, [timeLeft, stage, score, best])

  const start = () => {
    setSeed(s => s + 1)
    setStage('playing')
    setTimeLeft(customDuration)
    setQi(0)
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setCorrect(0)
    setWrong(0)
    setSkipped(0)
    setSelected(null)
    setNewRecord(false)
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
    } else {
      setCombo(0)
      setWrong(w => w + 1)
    }
    setTimeout(() => {
      setSelected(null)
      setQi(q => q + 1)
    }, opt === target ? 250 : 700)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage !== 'playing') return
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) choose(options[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />

  if (stage === 'ready') {
    return (
      <div className="max-w-xl mx-auto py-6 animate-in fade-in">
        <GameHeader onExit={onExit} title="Speed Match" />
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="inline-flex bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 p-4 rounded-full mb-4"><Zap size={36} /></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Speed Match</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Pick the right answer as fast as you can. Streaks give bonus points.</p>
          
          <div className="mb-6 flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Duration:</span>
            <div className="flex items-center gap-2">
              {[30, 60, 90, 120].map(d => (
                <button
                  key={d}
                  onClick={() => setCustomDuration(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    customDuration === d
                      ? 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {d}s
                </button>
              ))}
              <input
                type="number"
                min="5"
                max="600"
                value={customDuration}
                onChange={e => setCustomDuration(Math.max(5, Math.min(600, Number(e.target.value) || 30)))}
                className="w-16 px-2 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-medium"
              />
              <span className="text-sm text-gray-500">sec</span>
            </div>
          </div>

          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Best score: <span className="font-bold text-yellow-600 dark:text-yellow-400">{best}</span></p>
          
          {/* Source mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 mb-8 inline-flex self-center mx-auto w-fit">
            <button
              onClick={() => setSrcMode('highlights')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${srcMode === 'highlights' ? 'bg-white dark:bg-gray-700 shadow-sm text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >Words</button>
            <button
              onClick={() => setSrcMode('phrases')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${srcMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-sm text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >Phrases</button>
          </div>

          <div>
            <button onClick={start} className="bg-yellow-500 hover:bg-yellow-600 text-white px-10 py-3 rounded-xl font-bold shadow-sm transition-colors">Start</button>
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
            <span className="text-xl font-extrabold text-yellow-600 dark:text-yellow-400">
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
    <div className="max-w-xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={() => { setStage('ready'); onExit() }}
        center={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 text-xs font-bold">
              <Zap size={14} className="fill-yellow-500" />
              <span>{score} pts</span>
            </div>
            {combo > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-xs font-bold animate-bounce">
                {combo}x Streak 🔥
              </span>
            )}
          </div>
        }
        right={
          <div className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
            timeLeft <= 10
              ? 'bg-rose-50 text-rose-600 border-rose-300 animate-pulse'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
          }`}>
            ⏱️ {timeLeft}s
          </div>
        }
      />

      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2.5">
        <div 
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            timeLeft <= 10 ? 'bg-rose-500' : timeLeft <= 25 ? 'bg-amber-500' : 'bg-emerald-500'
          }`} 
          style={{ width: `${(timeLeft / customDuration) * 100}%` }} 
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/80 dark:border-gray-700/80 p-4 sm:p-5 mb-2.5 text-center relative min-h-[6.5rem] flex flex-col items-center justify-center">
        <RootCardButton
          onClick={() => {
            if (currentCard) setShowModalCard(currentCard)
          }}
          className="absolute top-3 left-3"
        />

        <button
          onClick={() => setMode(m => m === 'word' ? 'meaning' : 'word')}
          className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          {mode === 'word' ? 'EN → VI' : 'VI → EN'}
        </button>

        {mode === 'word' ? (
          <div className="text-center px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">{note!.word}</h3>
            {(currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech) && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block mt-0.5 break-words">{currentCard?.posEntries ? currentCard.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCard?.partOfSpeech}</span>
            )}
            {currentCard?.phonetic && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 block font-mono mt-0.5 break-words">{currentCard.phonetic}</span>
            )}
          </div>
        ) : (
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap px-4">{note!.meaning}</h3>
        )}

        {mode === 'word' && (
          <button
            onClick={() => speakEnglish(note!.word)}
            title="Listen"
            className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
          ><Volume2 size={20} /></button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt, i) => {
          const target = mode === 'word' ? note!.meaning : note!.word
          const isCorrect = opt === target
          let cls = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
          if (selected !== null) {
            if (isCorrect) cls = 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-200'
            else if (opt === selected) cls = 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200'
            else cls = 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-50'
          }
          return (
            <button key={`${note!.id}-${i}`} onClick={() => choose(opt)} disabled={selected !== null} className={`min-h-[2.75rem] p-2.5 rounded-xl border text-center font-medium transition-all relative flex items-center justify-center cursor-pointer ${cls}`}>
              <span className="absolute top-1.5 left-2 text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 py-0.2 rounded">
                {i + 1}
              </span>
              <span className="line-clamp-2 whitespace-pre-wrap break-words px-3 text-xs sm:text-sm">{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex justify-center">
        <button
          onClick={handleSkip}
          disabled={selected !== null}
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

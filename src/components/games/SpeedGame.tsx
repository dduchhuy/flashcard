import { useState, useMemo, useEffect } from 'react'
import { Zap, Volume2 } from 'lucide-react'
import { shuffle, useNotes, EmptyState, BackBar, BottomCounter } from './shared'
import { speakEnglish } from '../../utils'

const DURATION = 60
const BEST_KEY = 'flashcard_speed_best'

export function SpeedGame({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(0)
  const notes = useNotes(seed)
  const [stage, setStage] = useState<'ready' | 'playing' | 'done'>('ready')
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem(BEST_KEY) || 0))
  const [newRecord, setNewRecord] = useState(false)
  const [mode, setMode] = useState<'word' | 'meaning'>('word')

  const note = notes.length ? notes[qi % notes.length] : undefined

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
    setTimeLeft(DURATION)
    setQi(0)
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setCorrect(0)
    setWrong(0)
    setSelected(null)
    setNewRecord(false)
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
        <BackBar onExit={onExit} />
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="inline-flex bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 p-4 rounded-full mb-4"><Zap size={36} /></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Speed Match</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">Pick the right meaning as fast as you can in {DURATION} seconds. Streaks give bonus points.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Best score: <span className="font-bold text-yellow-600 dark:text-yellow-400">{best}</span></p>
          <button onClick={start} className="bg-yellow-500 hover:bg-yellow-600 text-white px-10 py-3 rounded-xl font-bold shadow-sm transition-colors">Start</button>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    const total = correct + wrong
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">⚡</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Time's up!</h2>
        {newRecord && <p className="text-yellow-600 dark:text-yellow-400 font-bold mb-2">🎉 New record!</p>}
        <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 my-3">{score}</p>
        <p className="text-gray-500 dark:text-gray-400 mb-1">{correct} correct of {total} answered ({total ? Math.round((correct / total) * 100) : 0}%)</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Best streak: {bestCombo} · Best score: {best}</p>
        <div className="flex gap-4">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={start} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700">Play Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={() => { setStage('ready') ; onExit() }} />

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
        <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 10 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${(timeLeft / DURATION) * 100}%` }} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center relative min-h-[10rem] flex items-center justify-center">
        <button
          onClick={() => setMode(m => m === 'word' ? 'meaning' : 'word')}
          className="absolute top-4 left-4 text-xs font-bold px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          {mode === 'word' ? 'EN → VI' : 'VI → EN'}
        </button>
        <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap px-4">{mode === 'word' ? note!.word : note!.meaning}</h3>
        {mode === 'word' && (
          <button
            onClick={() => speakEnglish(note!.word)}
            title="Listen"
            className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
          ><Volume2 size={22} /></button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <button key={`${note!.id}-${i}`} onClick={() => choose(opt)} disabled={selected !== null} className={`h-24 p-4 rounded-xl border-2 text-center font-medium transition-colors flex items-center justify-center ${cls}`}>
              <span className="line-clamp-2 whitespace-pre-wrap break-all">{opt}</span>
            </button>
          )
        })}
      </div>

      <BottomCounter>
        {timeLeft}s · Score {score}{combo > 1 ? ` · 🔥 x${combo}` : ''}
      </BottomCounter>
    </div>
  )
}

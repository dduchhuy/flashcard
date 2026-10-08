import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Shuffle, Volume2 } from 'lucide-react'
import { shuffle, useNotes, EmptyState, ResultScreen, BackBar, BottomCounter, softBtn } from './shared'
import { speakEnglish } from '../../utils'

export function ScrambleGame({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(0)
  const notes = useNotes(seed, true)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [placed, setPlaced] = useState<number[]>([])
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing')
  const [assisted, setAssisted] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)

  const note = notes[index]
  const letters = useMemo(() => (note ? note.word.replace(/\s/g, '').split('') : []), [note])

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
    setPlaced([])
    setStatus('playing')
    setAssisted(false)
  }

  const place = (nextPlaced: number[], usedAssist = assisted) => {
    setPlaced(nextPlaced)
    if (nextPlaced.length !== letters.length) return
    const guess = nextPlaced.map(id => letters[id]).join('').toLowerCase()
    if (guess === letters.join('').toLowerCase()) {
      setStatus('correct')
      if (!usedAssist) setScore(s => s + 1)
      speakEnglish(note.word)
      setTimeout(next, 1300)
    } else {
      setStatus('wrong')
      setAssisted(true)
      setTimeout(() => {
        setPlaced([])
        setStatus('playing')
      }, 800)
    }
  }

  const addTile = (id: number) => {
    if (status !== 'playing' || placed.includes(id)) return
    place([...placed, id])
  }

  const removeAt = (k: number) => {
    if (status !== 'playing') return
    setPlaced(p => p.filter((_, i) => i !== k))
  }

  const hint = () => {
    if (status !== 'playing') return
    const prefix: number[] = []
    for (const id of placed) {
      if (letters[id].toLowerCase() === letters[prefix.length]?.toLowerCase()) prefix.push(id)
      else break
    }
    const target = letters[prefix.length]
    if (target === undefined) return
    const tile = tiles.find(t => !prefix.includes(t.id) && t.ch.toLowerCase() === target.toLowerCase())
    if (!tile) return
    setAssisted(true)
    place([...prefix, tile.id], true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== 'playing' || !note) return
      if (e.key === 'Backspace') {
        setPlaced(p => p.slice(0, -1))
      } else if (e.key.length === 1) {
        const tile = tiles.find(t => !placed.includes(t.id) && t.ch.toLowerCase() === e.key.toLowerCase())
        if (tile) addTile(tile.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (notes.length === 0) return <EmptyState onExit={onExit} />
  if (index >= notes.length) {
    return (
      <ResultScreen
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setIndex(0); setScore(0); setPlaced([]); setStatus('playing'); setAssisted(false) }}
        lines={<>You solved <span className="font-bold text-purple-600">{score}</span> of {notes.length} without help ({Math.round((score / notes.length) * 100)}%)</>}
      />
    )
  }

  let k = 0
  const slots = note.word.split('').map((ch, i) => {
    if (ch === ' ') return <span key={i} className="w-4" />
    const pos = k++
    const filled = placed[pos] !== undefined ? letters[placed[pos]] : ''
    return (
      <button
        key={i}
        onClick={() => filled && removeAt(pos)}
        className={`w-10 h-12 rounded-lg border-2 text-xl font-bold flex items-center justify-center transition-colors ${
          status === 'correct' ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
          status === 'wrong' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
          filled ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-200' :
          'bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600'
        }`}
      >{filled}</button>
    )
  })

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <BackBar onExit={onExit} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center max-w-xl mx-auto w-full relative">
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

        <div className="flex flex-wrap justify-center gap-2 mb-8">{slots}</div>

        <div className="flex flex-wrap justify-center gap-2 mb-8 min-h-[3rem]">
          {tiles.map(t => (
            <button
              key={t.id}
              onClick={() => addTile(t.id)}
              disabled={placed.includes(t.id) || status !== 'playing'}
              className={`w-10 h-12 rounded-lg text-xl font-bold transition-all ${
                placed.includes(t.id)
                  ? 'bg-transparent border-2 border-dashed border-gray-200 dark:border-gray-700 text-transparent'
                  : 'bg-purple-600 text-white hover:bg-purple-700 hover:-translate-y-0.5 shadow-sm'
              }`}
            >{t.ch}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => { setPlaced([]); setShuffleKey(x => x + 1) }} disabled={status !== 'playing'} title="Shuffle letters" className={softBtn}><Shuffle size={20} /></button>
          <button onClick={hint} disabled={status !== 'playing'} title="Hint" className={softBtn}><Lightbulb size={20} /></button>
          <button onClick={next} disabled={status !== 'playing'} className={softBtn}>Skip</button>
        </div>
      </div>

      <BottomCounter>{index + 1} / {notes.length}</BottomCounter>
    </div>
  )
}

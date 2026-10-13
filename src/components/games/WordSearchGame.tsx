import { useState, useMemo, useEffect } from 'react'
import { Check, Volume2, RefreshCw } from 'lucide-react'
import { useNotes, EmptyState, CardDetailModal, GameHeader, ResultScreen, useGameTimer, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

type Difficulty = 'easy' | 'normal' | 'hard' | 'evil'

const DIFFICULTY_CONFIG: Record<Difficulty, { size: number; wordCount: number; maxWordLen: number }> = {
  easy: { size: 7, wordCount: 3, maxWordLen: 6 },
  normal: { size: 9, wordCount: 5, maxWordLen: 8 },
  hard: { size: 11, wordCount: 7, maxWordLen: 10 },
  evil: { size: 13, wordCount: 9, maxWordLen: 12 },
}

const PALETTE = [
  'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500',
  'bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500',
  'bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-500',
  'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500',
  'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500',
  'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border-cyan-500',
  'bg-violet-500/20 text-violet-800 dark:text-violet-200 border-violet-500',
  'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-teal-500',
  'bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-500',
  'bg-pink-500/20 text-pink-800 dark:text-pink-200 border-pink-500',
]

interface PlacedWord {
  note: Note
  word: string
  cells: { r: number; c: number }[]
  colorClass: string
  found: boolean
}

export function WordSearchGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [isGameOver, setIsGameOver] = useState(false)
  const allNotes = useNotes(seed, true)

  const config = DIFFICULTY_CONFIG[difficulty]
  const gridSize = config.size

  // Filter valid words: 3 to maxWordLen letters, english letters only
  const eligibleNotes = useMemo(() => {
    return allNotes.filter(n => {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      return clean.length >= 3 && clean.length <= config.maxWordLen
    })
  }, [allNotes, config.maxWordLen])

  // Select target words based on difficulty wordCount
  const selectedNotes = useMemo(() => {
    const uniqueMap = new Map<string, Note>()
    for (const n of eligibleNotes) {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (!uniqueMap.has(clean)) uniqueMap.set(clean, n)
      if (uniqueMap.size >= config.wordCount) break
    }
    return Array.from(uniqueMap.values())
  }, [eligibleNotes, config.wordCount, seed])

  // Build grid & place words
  const { grid, placedWords: initialPlaced } = useMemo(() => {
    if (selectedNotes.length === 0) return { grid: [], placedWords: [] }

    const g: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(''))
    const placed: PlacedWord[] = []

    const directions = [
      { dr: 0, dc: 1 },  // horizontal right
      { dr: 1, dc: 0 },  // vertical down
      { dr: 1, dc: 1 },  // diagonal down-right
      { dr: -1, dc: 1 }, // diagonal up-right
    ]

    selectedNotes.forEach((n, idx) => {
      const w = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      let placedOk = false
      let attempts = 0

      while (!placedOk && attempts < 100) {
        attempts++
        const dir = directions[Math.floor(Math.random() * directions.length)]
        const minR = dir.dr < 0 ? w.length - 1 : 0
        const maxR = dir.dr > 0 ? gridSize - w.length : gridSize - 1
        const maxC = gridSize - w.length

        if (maxR < minR || maxC < 0) continue

        const startR = Math.floor(Math.random() * (maxR - minR + 1)) + minR
        const startC = Math.floor(Math.random() * (maxC + 1))

        // Check if fits
        let canPlace = true
        for (let i = 0; i < w.length; i++) {
          const r = startR + dir.dr * i
          const c = startC + dir.dc * i
          if (g[r][c] !== '' && g[r][c] !== w[i]) {
            canPlace = false
            break
          }
        }

        if (canPlace) {
          const cells: { r: number; c: number }[] = []
          for (let i = 0; i < w.length; i++) {
            const r = startR + dir.dr * i
            const c = startC + dir.dc * i
            g[r][c] = w[i]
            cells.push({ r, c })
          }
          placed.push({
            note: n,
            word: w,
            cells,
            colorClass: PALETTE[idx % PALETTE.length],
            found: false,
          })
          placedOk = true
        }
      }
    })

    // Fill remaining cells with random letters
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (g[r][c] === '') {
          g[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)]
        }
      }
    }

    return { grid: g, placedWords: placed }
  }, [selectedNotes, gridSize])

  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([])
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ r: number; c: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  useEffect(() => {
    setPlacedWords(initialPlaced)
    setDragStart(null)
    setDragEnd(null)
  }, [initialPlaced])

  const allFound = placedWords.length > 0 && placedWords.every(p => p.found)

  const handleTimeUp = () => {
    setIsGameOver(true)
  }

  const timer = useGameTimer({
    initialDuration: 90,
    onTimeUp: handleTimeUp,
    enabled: !isGameOver && !allFound && placedWords.length > 0
  })

  // Compute selected cells from dragStart to dragEnd in a straight line
  const selectedCells = useMemo(() => {
    if (!dragStart || !dragEnd) return []
    const dr = dragEnd.r - dragStart.r
    const dc = dragEnd.c - dragStart.c

    // Must be horizontal, vertical, or 45 deg diagonal
    const absDr = Math.abs(dr)
    const absDc = Math.abs(dc)
    if (absDr !== 0 && absDc !== 0 && absDr !== absDc) return [{ r: dragStart.r, c: dragStart.c }]

    const steps = Math.max(absDr, absDc)
    const stepR = dr === 0 ? 0 : dr / absDr
    const stepC = dc === 0 ? 0 : dc / absDc

    const cells: { r: number; c: number }[] = []
    for (let i = 0; i <= steps; i++) {
      cells.push({ r: dragStart.r + stepR * i, c: dragStart.c + stepC * i })
    }
    return cells
  }, [dragStart, dragEnd])

  const handlePointerDown = (r: number, c: number) => {
    setDragStart({ r, c })
    setDragEnd({ r, c })
    setIsDragging(true)
  }

  const handlePointerEnter = (r: number, c: number) => {
    if (isDragging && dragStart) {
      setDragEnd({ r, c })
    }
  }

  const handlePointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)

    if (selectedCells.length >= 2) {
      // Build selected word forward and reverse
      const letters = selectedCells.map(cell => grid[cell.r]?.[cell.c] || '').join('').toLowerCase()
      const reversed = letters.split('').reverse().join('')

      const matchIdx = placedWords.findIndex(p => !p.found && (p.word === letters || p.word === reversed))
      if (matchIdx !== -1) {
        const updated = [...placedWords]
        updated[matchIdx].found = true
        setPlacedWords(updated)
        timer.addTime(10) // +10s bonus on found word!
        speakEnglish(updated[matchIdx].note.word)
      }
    }

    setDragStart(null)
    setDragEnd(null)
  }

  if (selectedNotes.length === 0) {
    return <EmptyState onExit={onExit} text="Not enough suitable vocabulary words for Word Search." />
  }

  const foundCount = placedWords.filter(p => p.found).length

  if (isGameOver) {
    return (
      <ResultScreen
        title="Time's Up!"
        correct={foundCount}
        wrong={placedWords.length - foundCount}
        onExit={onExit}
        onAgain={() => {
          setIsGameOver(false)
          setSeed(s => s + 1)
          timer.reset()
        }}
      />
    )
  }

  if (allFound) {
    return (
      <ResultScreen
        title="Word Search Solved!"
        correct={placedWords.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => {
          setIsGameOver(false)
          setSeed(s => s + 1)
          timer.reset()
        }}
      />
    )
  }

  const progressPercent = Math.round((foundCount / (placedWords.length || 1)) * 100)

  const cellClass = gridSize >= 13
    ? 'w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 aspect-square text-xs sm:text-sm'
    : gridSize >= 11
    ? 'w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 aspect-square text-xs sm:text-base'
    : gridSize >= 9
    ? 'w-9 sm:w-11 md:w-12 h-9 sm:h-11 md:h-12 aspect-square text-sm sm:text-lg'
    : 'w-11 sm:w-13 md:w-14 h-11 sm:h-13 md:h-14 aspect-square text-base sm:text-xl'

  return (
    <div 
      className="max-w-4xl sm:max-w-5xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-3 sm:px-6 select-none touch-none w-full"
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <GameHeader
        title="Word Search"
        onExit={onExit}
        progress={progressPercent}
        timer={timer}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            {(['easy', 'normal', 'hard', 'evil'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d)
                  setSeed(s => s + 1)
                  setIsGameOver(false)
                  timer.reset()
                }}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  difficulty === d
                    ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        }
        right={
          <button
            onClick={() => {
              setSeed(s => s + 1)
              setIsGameOver(false)
              timer.reset()
            }}
            title="New Puzzle"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-purple-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 mt-3">
        {/* Letter Grid */}
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md">
          <div 
            className="grid gap-1 sm:gap-1.5"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {grid.map((row, r) =>
              row.map((ch, c) => {
                // Check if cell is in permanently found word
                const foundItem = placedWords.find(p => p.found && p.cells.some(cell => cell.r === r && cell.c === c))
                const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c)

                return (
                  <div
                    key={`${r}-${c}`}
                    onPointerDown={() => handlePointerDown(r, c)}
                    onPointerEnter={() => handlePointerEnter(r, c)}
                    className={`${cellClass} rounded-lg flex items-center justify-center font-bold uppercase transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white scale-105 shadow-sm ring-2 ring-purple-400'
                        : foundItem
                        ? `${foundItem.colorClass} border font-black scale-100`
                        : 'bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {ch}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Target Words Checklist */}
        <div className="w-full lg:w-72 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/70 shadow-sm flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            Target Words ({foundCount} / {placedWords.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {placedWords.map((item, idx) => {
              const card = flashcards.find(f => f.id === item.note.cardId)
              return (
                <div
                  key={idx}
                  onClick={() => {
                    speakEnglish(item.note.word)
                    if (card) setShowModalCard(card)
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    item.found
                      ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 line-through opacity-80'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-gray-50/50 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs uppercase flex items-center gap-1.5">
                      <span>{item.word}</span>
                      {item.found && <Check size={13} className="text-emerald-500 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {item.note.meaning}
                    </div>
                  </div>
                  <Volume2 size={13} className="text-gray-400 hover:text-purple-600 shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <CardDetailModal
        card={showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

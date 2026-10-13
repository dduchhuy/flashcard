import { useState, useMemo, useEffect } from 'react'
import { Check, Volume2, RefreshCw } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, CardDetailModal, GameHeader, ResultScreen, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

const GRID_SIZE = 9 // 9x9 grid fits comfortably on mobile screens
const PALETTE = [
  'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500',
  'bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500',
  'bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-500',
  'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500',
  'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500',
  'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border-cyan-500',
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
  const allNotes = useNotes(seed, true)

  // Filter valid words: 3 to 7 letters, english letters only
  const eligibleNotes = useMemo(() => {
    return allNotes.filter(n => {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      return clean.length >= 3 && clean.length <= GRID_SIZE - 1
    })
  }, [allNotes])

  // Select 5 words for the current puzzle
  const selectedNotes = useMemo(() => {
    const uniqueMap = new Map<string, Note>()
    for (const n of eligibleNotes) {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (!uniqueMap.has(clean)) uniqueMap.set(clean, n)
      if (uniqueMap.size >= 5) break
    }
    return Array.from(uniqueMap.values())
  }, [eligibleNotes, seed])

  // Build grid & place words
  const { grid, placedWords: initialPlaced } = useMemo(() => {
    if (selectedNotes.length === 0) return { grid: [], placedWords: [] }

    const g: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''))
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
        const maxR = dir.dr > 0 ? GRID_SIZE - w.length : GRID_SIZE - 1
        const maxC = GRID_SIZE - w.length

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
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (g[r][c] === '') {
          g[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)]
        }
      }
    }

    return { grid: g, placedWords: placed }
  }, [selectedNotes])

  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([])
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ r: number; c: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    setPlacedWords(initialPlaced)
    setDragStart(null)
    setDragEnd(null)
    setElapsedTime(0)
  }, [initialPlaced])

  // Timer
  const allFound = placedWords.length > 0 && placedWords.every(p => p.found)
  useEffect(() => {
    if (allFound) return
    const timer = setInterval(() => setElapsedTime(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [allFound])

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
        speakEnglish(updated[matchIdx].note.word)
      }
    }

    setDragStart(null)
    setDragEnd(null)
  }

  if (selectedNotes.length === 0) {
    return <EmptyState onExit={onExit} text="Not enough 3–8 letter vocabulary words for Word Search." />
  }

  if (allFound) {
    return (
      <ResultScreen
        title="Word Search Solved!"
        correct={placedWords.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => setSeed(s => s + 1)}
      />
    )
  }

  const foundCount = placedWords.filter(p => p.found).length

  return (
    <div 
      className="max-w-2xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-3 select-none touch-none"
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <GameHeader
        onExit={onExit}
        center={
          <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
            <span>Tìm được: {foundCount} / {placedWords.length}</span>
            <span className="text-gray-400">·</span>
            <span className="font-mono text-purple-600 dark:text-purple-400">{elapsedTime}s</span>
          </div>
        }
        right={
          <button
            onClick={() => setSeed(s => s + 1)}
            title="Tạo bảng mới"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-purple-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="w-full flex flex-col md:flex-row items-center md:items-start justify-center gap-5 mt-2">
        {/* Letter Grid */}
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md">
          <div 
            className="grid gap-1 sm:gap-1.5"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
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
                    className={`w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm uppercase transition-all cursor-pointer ${
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
        <div className="w-full md:w-60 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/70 shadow-sm flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            Từ cần tìm ({placedWords.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {placedWords.map((item, idx) => {
              const card = flashcards.find(f => f.id === item.note.cardId)
              return (
                <div
                  key={idx}
                  onClick={() => {
                    speakEnglish(item.note.word)
                    if (card) setShowModalCard(card)
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
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

      <div className="w-full flex justify-start mt-2 max-w-2xl px-2">
        <RootCardButton
          onClick={() => {
            const first = placedWords[0]
            if (first) {
              const c = flashcards.find(f => f.id === first.note.cardId)
              if (c) setShowModalCard(c)
            }
          }}
        />
      </div>

      <CardDetailModal
        card={showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

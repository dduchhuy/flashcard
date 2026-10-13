import { useState, useMemo, useEffect, useRef } from 'react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, CardDetailModal, GameHeader, ResultScreen, useGameTimer, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'

type Difficulty = 'easy' | 'normal' | 'hard' | 'evil'

const CROSSWORD_CONFIG: Record<Difficulty, { minWords: number; targetWords: number; maxWordLen: number }> = {
  easy: { minWords: 3, targetWords: 4, maxWordLen: 6 },
  normal: { minWords: 4, targetWords: 6, maxWordLen: 8 },
  hard: { minWords: 6, targetWords: 8, maxWordLen: 10 },
  evil: { minWords: 8, targetWords: 12, maxWordLen: 12 },
}

interface CrosswordWord {
  id: string
  number: number
  direction: 'across' | 'down'
  word: string
  meaning: string
  note: Note
  card?: Flashcard
  startR: number
  startC: number
  length: number
  coords: { r: number; c: number }[]
}

interface Cell {
  r: number
  c: number
  solution: string
  number?: number
  acrossWordIdx?: number
  downWordIdx?: number
}

// Extract the 1st meaning strictly from the flashcard
function getFirstCardMeaning(card?: Flashcard, fallback?: string): string {
  if (card) {
    const posMeaning = card.posEntries?.[0]?.meanings?.[0]?.meaning?.trim()
    if (posMeaning) return posMeaning
    const hlMeaning = card.highlights?.[0]?.meaning?.trim()
    if (hlMeaning) return hlMeaning
    const trans = card.translation?.trim()
    if (trans) return trans
  }
  return fallback?.trim() || ''
}

// Strict placement validation:
// 1. Cell immediately before word must be empty
// 2. Cell immediately after word must be empty
// 3. Occupied cells must have matching char and perpendicular orientation
// 4. Empty cells must NOT have occupied perpendicular flanks (prevents adjacent parallel touching)
function canPlace(
  board: Map<string, string>,
  boardWords: Map<string, { across?: number; down?: number }>,
  word: string,
  startR: number,
  startC: number,
  dir: 'across' | 'down'
): { valid: boolean; intersections: number } {
  const L = word.length
  let intersections = 0

  // 1. Cap before word
  const beforeR = dir === 'down' ? startR - 1 : startR
  const beforeC = dir === 'across' ? startC - 1 : startC
  if (board.has(`${beforeR},${beforeC}`)) return { valid: false, intersections: 0 }

  // 2. Cap after word
  const afterR = dir === 'down' ? startR + L : startR
  const afterC = dir === 'across' ? startC + L : startC
  if (board.has(`${afterR},${afterC}`)) return { valid: false, intersections: 0 }

  // 3. Cell-by-cell check
  for (let k = 0; k < L; k++) {
    const r = dir === 'down' ? startR + k : startR
    const c = dir === 'across' ? startC + k : startC
    const key = `${r},${c}`

    if (board.has(key)) {
      if (board.get(key) !== word[k]) return { valid: false, intersections: 0 }
      const existing = boardWords.get(key)
      if (dir === 'across' && existing?.across !== undefined) return { valid: false, intersections: 0 }
      if (dir === 'down' && existing?.down !== undefined) return { valid: false, intersections: 0 }
      intersections++
    } else {
      // Empty cell: check flanking perpendicular cells
      if (dir === 'across') {
        if (board.has(`${r - 1},${c}`) || board.has(`${r + 1},${c}`)) {
          return { valid: false, intersections: 0 }
        }
      } else {
        if (board.has(`${r},${c - 1}`) || board.has(`${r},${c + 1}`)) {
          return { valid: false, intersections: 0 }
        }
      }
    }
  }

  return { valid: true, intersections }
}

interface CandidateItem {
  word: string
  note: Note
  meaning: string
  card?: Flashcard
}

// Single layout trial run
function generateCrosswordAttempt(candidates: CandidateItem[], targetWords: number) {
  if (candidates.length === 0) return null

  const board = new Map<string, string>()
  const boardWords = new Map<string, { across?: number; down?: number }>()
  const placed: {
    direction: 'across' | 'down'
    word: string
    meaning: string
    note: Note
    card?: Flashcard
    startR: number
    startC: number
    length: number
    coords: { r: number; c: number }[]
  }[] = []

  // Place first word at (0, 0) across
  const first = candidates[0]
  const firstCoords: { r: number; c: number }[] = []
  for (let i = 0; i < first.word.length; i++) {
    const key = `0,${i}`
    board.set(key, first.word[i])
    boardWords.set(key, { across: 0 })
    firstCoords.push({ r: 0, c: i })
  }
  placed.push({
    direction: 'across',
    word: first.word,
    meaning: first.meaning,
    note: first.note,
    card: first.card,
    startR: 0,
    startC: 0,
    length: first.word.length,
    coords: firstCoords,
  })

  // Try placing subsequent words by intersection
  for (let candIdx = 1; candIdx < candidates.length && placed.length < targetWords; candIdx++) {
    const cand = candidates[candIdx]
    const candWord = cand.word
    const possiblePlacements: {
      startR: number
      startC: number
      dir: 'across' | 'down'
      intersections: number
      score: number
    }[] = []

    for (const p of placed) {
      const targetDir: 'across' | 'down' = p.direction === 'across' ? 'down' : 'across'

      for (let ci = 0; ci < candWord.length; ci++) {
        const char = candWord[ci]

        for (let pi = 0; pi < p.length; pi++) {
          if (p.word[pi] === char) {
            const interR = p.direction === 'across' ? p.startR : p.startR + pi
            const interC = p.direction === 'across' ? p.startC + pi : p.startC

            const startR = targetDir === 'down' ? interR - ci : interR
            const startC = targetDir === 'across' ? interC - ci : interC

            const check = canPlace(board, boardWords, candWord, startR, startC, targetDir)
            if (check.valid && check.intersections >= 1) {
              let minR = startR, maxR = targetDir === 'down' ? startR + candWord.length - 1 : startR
              let minC = startC, maxC = targetDir === 'across' ? startC + candWord.length - 1 : startC
              for (const ex of placed) {
                minR = Math.min(minR, ex.startR)
                minC = Math.min(minC, ex.startC)
                maxR = Math.max(maxR, ex.direction === 'down' ? ex.startR + ex.length - 1 : ex.startR)
                maxC = Math.max(maxC, ex.direction === 'across' ? ex.startC + ex.length - 1 : ex.startC)
              }
              const spanR = maxR - minR + 1
              const spanC = maxC - minC + 1
              const area = spanR * spanC
              const aspectPenalty = Math.abs(spanR - spanC) * 3

              const score = (check.intersections * 50) - (area * 0.5) - aspectPenalty
              possiblePlacements.push({
                startR,
                startC,
                dir: targetDir,
                intersections: check.intersections,
                score,
              })
            }
          }
        }
      }
    }

    if (possiblePlacements.length > 0) {
      possiblePlacements.sort((a, b) => b.score - a.score)
      const chosen = possiblePlacements[0]
      const newIdx = placed.length
      const coords: { r: number; c: number }[] = []

      for (let k = 0; k < candWord.length; k++) {
        const r = chosen.dir === 'down' ? chosen.startR + k : chosen.startR
        const c = chosen.dir === 'across' ? chosen.startC + k : chosen.startC
        const key = `${r},${c}`

        board.set(key, candWord[k])
        const existing = boardWords.get(key) || {}
        if (chosen.dir === 'across') existing.across = newIdx
        else existing.down = newIdx
        boardWords.set(key, existing)
        coords.push({ r, c })
      }

      placed.push({
        direction: chosen.dir,
        word: candWord,
        meaning: cand.meaning,
        note: cand.note,
        card: cand.card,
        startR: chosen.startR,
        startC: chosen.startC,
        length: candWord.length,
        coords,
      })
    }
  }

  // Fallback: If target count not reached, place remaining candidates outside (detached with empty row gap)
  if (placed.length < targetWords) {
    for (let candIdx = 1; candIdx < candidates.length && placed.length < targetWords; candIdx++) {
      const cand = candidates[candIdx]
      if (placed.some(p => p.word === cand.word)) continue

      let maxR = -Infinity, minC = Infinity
      for (const p of placed) {
        maxR = Math.max(maxR, p.direction === 'down' ? p.startR + p.length - 1 : p.startR)
        minC = Math.min(minC, p.startC)
      }

      const outsideR = maxR + 2
      const outsideC = minC
      const check = canPlace(board, boardWords, cand.word, outsideR, outsideC, 'across')
      if (check.valid) {
        const newIdx = placed.length
        const coords: { r: number; c: number }[] = []
        for (let k = 0; k < cand.word.length; k++) {
          const r = outsideR
          const c = outsideC + k
          const key = `${r},${c}`
          board.set(key, cand.word[k])
          boardWords.set(key, { across: newIdx })
          coords.push({ r, c })
        }
        placed.push({
          direction: 'across',
          word: cand.word,
          meaning: cand.meaning,
          note: cand.note,
          card: cand.card,
          startR: outsideR,
          startC: outsideC,
          length: cand.word.length,
          coords,
        })
      }
    }
  }

  return { words: placed, board, boardWords }
}

// Multi-iteration crossword builder with bounding box normalization
function buildOptimizedCrossword(candidates: CandidateItem[], minWords: number, targetWords: number) {
  if (candidates.length < 2) return null

  let bestResult: {
    words: {
      direction: 'across' | 'down'
      word: string
      meaning: string
      note: Note
      card?: Flashcard
      startR: number
      startC: number
      length: number
      coords: { r: number; c: number }[]
    }[]
    score: number
  } | null = null

  const runs = 35

  for (let run = 0; run < runs; run++) {
    const pool = run === 0
      ? [...candidates].sort((a, b) => b.word.length - a.word.length)
      : [...candidates].sort(() => Math.random() - 0.5)

    const attempt = generateCrosswordAttempt(pool, targetWords)
    if (!attempt || attempt.words.length < minWords) continue

    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
    for (const w of attempt.words) {
      minR = Math.min(minR, w.startR)
      minC = Math.min(minC, w.startC)
      maxR = Math.max(maxR, w.direction === 'down' ? w.startR + w.length - 1 : w.startR)
      maxC = Math.max(maxC, w.direction === 'across' ? w.startC + w.length - 1 : w.startC)
    }
    const spanR = maxR - minR + 1
    const spanC = maxC - minC + 1
    const area = spanR * spanC
    const aspectPenalty = Math.abs(spanR - spanC) * 4

    const score = (attempt.words.length * 200) - (area * 1.5) - aspectPenalty

    if (!bestResult || score > bestResult.score) {
      bestResult = {
        words: attempt.words,
        score,
      }
    }
  }

  if (!bestResult) return null

  // Crop & Normalize coordinates to (0, 0)
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
  for (const w of bestResult.words) {
    minR = Math.min(minR, w.startR)
    minC = Math.min(minC, w.startC)
    maxR = Math.max(maxR, w.direction === 'down' ? w.startR + w.length - 1 : w.startR)
    maxC = Math.max(maxC, w.direction === 'across' ? w.startC + w.length - 1 : w.startC)
  }

  const rows = maxR - minR + 1
  const cols = maxC - minC + 1

  const shiftedWords = bestResult.words.map(w => ({
    ...w,
    startR: w.startR - minR,
    startC: w.startC - minC,
    coords: w.coords.map(c => ({ r: c.r - minR, c: c.c - minC })),
  }))

  // Number the clues standard crossword style
  let currentNum = 1
  const finalWords: CrosswordWord[] = []
  const cellNumberMap = new Map<string, number>()

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startingAcross = shiftedWords.find(w => w.direction === 'across' && w.startR === r && w.startC === c)
      const startingDown = shiftedWords.find(w => w.direction === 'down' && w.startR === r && w.startC === c)

      if (startingAcross || startingDown) {
        cellNumberMap.set(`${r},${c}`, currentNum)
        if (startingAcross) {
          finalWords.push({
            ...startingAcross,
            id: `w-${finalWords.length}`,
            number: currentNum,
          })
        }
        if (startingDown) {
          finalWords.push({
            ...startingDown,
            id: `w-${finalWords.length}`,
            number: currentNum,
          })
        }
        currentNum++
      }
    }
  }

  // Populate cell map with words and solutions
  const gridCells = new Map<string, Cell>()
  finalWords.forEach((w, wIdx) => {
    for (let i = 0; i < w.length; i++) {
      const { r, c } = w.coords[i]
      const key = `${r},${c}`
      const existing = gridCells.get(key) || {
        r,
        c,
        solution: w.word[i],
        number: cellNumberMap.get(key),
      }

      if (w.direction === 'across') {
        existing.acrossWordIdx = wIdx
      } else {
        existing.downWordIdx = wIdx
      }

      gridCells.set(key, existing)
    }
  })

  return {
    words: finalWords,
    gridCells,
    rows,
    cols,
  }
}

export function CrosswordGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [isGameOver, setIsGameOver] = useState(false)
  const allNotes = useNotes(seed, true)

  const config = CROSSWORD_CONFIG[difficulty]

  // Map flashcards by ID for quick lookup
  const flashcardMap = useMemo(() => new Map(flashcards.map(f => [f.id, f])), [flashcards])

  // Prepare eligible candidate words with their first flashcard meaning
  const eligibleCandidates = useMemo(() => {
    const seen = new Set<string>()
    const list: CandidateItem[] = []

    for (const n of allNotes) {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (clean.length >= 3 && clean.length <= config.maxWordLen && !seen.has(clean)) {
        seen.add(clean)
        const card = flashcardMap.get(n.cardId) || flashcards.find(f => f.sentence.trim().toLowerCase() === clean)
        const meaning = getFirstCardMeaning(card, n.meaning)
        list.push({
          word: clean,
          note: n,
          meaning,
          card,
        })
      }
    }

    return list
  }, [allNotes, config.maxWordLen, flashcardMap, flashcards])

  // Build the optimized tight-crop crossword grid
  const crosswordData = useMemo(() => {
    return buildOptimizedCrossword(eligibleCandidates, config.minWords, config.targetWords)
  }, [eligibleCandidates, config.minWords, config.targetWords, seed])

  const words = crosswordData?.words || []
  const gridCells = crosswordData?.gridCells || new Map<string, Cell>()
  const gridRows = crosswordData?.rows || 0
  const gridCols = crosswordData?.cols || 0

  const [selectedWordIdx, setSelectedWordIdx] = useState<number>(0)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const [userInputs, setUserInputs] = useState<Record<string, string>>({})
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  // Track which words are correctly solved
  const solvedWordIndices = useMemo(() => {
    const set = new Set<number>()
    words.forEach((w, idx) => {
      let wordSolved = true
      for (let i = 0; i < w.length; i++) {
        const { r, c } = w.coords[i]
        const val = (userInputs[`${r},${c}`] || '').toLowerCase()
        if (val !== w.word[i].toLowerCase()) {
          wordSolved = false
          break
        }
      }
      if (wordSolved) set.add(idx)
    })
    return set
  }, [words, userInputs])

  const isAllSolved = useMemo(() => {
    if (gridCells.size === 0) return false
    for (const [key, cell] of gridCells.entries()) {
      if ((userInputs[key] || '').toLowerCase() !== cell.solution.toLowerCase()) return false
    }
    return true
  }, [gridCells, userInputs])

  const timer = useGameTimer({
    initialDuration: 120,
    onTimeUp: () => setIsGameOver(true),
    enabled: !isGameOver && !isAllSolved && words.length > 0
  })

  // Award +10s per newly solved word
  const prevSolvedCountRef = useRef(0)
  useEffect(() => {
    const currentCount = solvedWordIndices.size
    if (currentCount > prevSolvedCountRef.current) {
      const diff = currentCount - prevSolvedCountRef.current
      timer.addTime(10 * diff)
    }
    prevSolvedCountRef.current = currentCount
  }, [solvedWordIndices.size, timer])

  // Reset inputs when crossword changes
  useEffect(() => {
    setUserInputs({})
    prevSolvedCountRef.current = 0
    if (words.length > 0) {
      setSelectedWordIdx(0)
      setActiveCell({ r: words[0].startR, c: words[0].startC })
    }
  }, [words])

  const selectedWord = words[selectedWordIdx]

  const isCellInWord = (w: CrosswordWord, r: number, c: number) => {
    return w.coords.some(coord => coord.r === r && coord.c === c)
  }

  // Handle cell click: toggle orientation if clicked twice on intersection
  const handleCellClick = (r: number, c: number) => {
    const cell = gridCells.get(`${r},${c}`)
    if (!cell) return

    if (activeCell?.r === r && activeCell?.c === c) {
      if (cell.acrossWordIdx !== undefined && cell.downWordIdx !== undefined) {
        if (selectedWord?.direction === 'across') {
          setSelectedWordIdx(cell.downWordIdx)
        } else {
          setSelectedWordIdx(cell.acrossWordIdx)
        }
        return
      }
    }

    setActiveCell({ r, c })

    if (selectedWord && isCellInWord(selectedWord, r, c)) return

    if (cell.acrossWordIdx !== undefined) {
      setSelectedWordIdx(cell.acrossWordIdx)
    } else if (cell.downWordIdx !== undefined) {
      setSelectedWordIdx(cell.downWordIdx)
    }
  }

  // Keyboard navigation & typing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell || !selectedWord || isGameOver) return

    if (/^[a-zA-Z]$/.test(e.key)) {
      const char = e.key.toLowerCase()
      const key = `${activeCell.r},${activeCell.c}`
      setUserInputs(prev => ({ ...prev, [key]: char }))

      // Move to next cell in current word
      const currentCoordIdx = selectedWord.coords.findIndex(c => c.r === activeCell.r && c.c === activeCell.c)
      if (currentCoordIdx >= 0 && currentCoordIdx < selectedWord.coords.length - 1) {
        const next = selectedWord.coords[currentCoordIdx + 1]
        setActiveCell({ r: next.r, c: next.c })
      }
    } else if (e.key === 'Backspace') {
      const key = `${activeCell.r},${activeCell.c}`
      if (userInputs[key]) {
        setUserInputs(prev => {
          const cp = { ...prev }
          delete cp[key]
          return cp
        })
      } else {
        const currentCoordIdx = selectedWord.coords.findIndex(c => c.r === activeCell.r && c.c === activeCell.c)
        if (currentCoordIdx > 0) {
          const prev = selectedWord.coords[currentCoordIdx - 1]
          setActiveCell({ r: prev.r, c: prev.c })
          const pKey = `${prev.r},${prev.c}`
          setUserInputs(p => {
            const cp = { ...p }
            delete cp[pKey]
            return cp
          })
        }
      }
    } else if (e.key === 'ArrowRight') {
      const nR = activeCell.r
      const nC = activeCell.c + 1
      if (gridCells.has(`${nR},${nC}`)) handleCellClick(nR, nC)
    } else if (e.key === 'ArrowLeft') {
      const nR = activeCell.r
      const nC = activeCell.c - 1
      if (gridCells.has(`${nR},${nC}`)) handleCellClick(nR, nC)
    } else if (e.key === 'ArrowDown') {
      const nR = activeCell.r + 1
      const nC = activeCell.c
      if (gridCells.has(`${nR},${nC}`)) handleCellClick(nR, nC)
    } else if (e.key === 'ArrowUp') {
      const nR = activeCell.r - 1
      const nC = activeCell.c
      if (gridCells.has(`${nR},${nC}`)) handleCellClick(nR, nC)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setSelectedWordIdx((prev) => {
        const next = (prev + 1) % words.length
        const nextW = words[next]
        if (nextW) setActiveCell({ r: nextW.startR, c: nextW.startC })
        return next
      })
    }
  }

  // Hint button: reveal active cell letter
  const handleHint = () => {
    if (!activeCell || isGameOver) return
    const cell = gridCells.get(`${activeCell.r},${activeCell.c}`)
    if (!cell) return
    setUserInputs(prev => ({ ...prev, [`${activeCell.r},${activeCell.c}`]: cell.solution }))
  }

  if (words.length === 0) {
    return <EmptyState onExit={onExit} text="Not enough suitable vocabulary words to generate crossword." />
  }

  if (isGameOver) {
    return (
      <ResultScreen
        title="Time's Up!"
        correct={solvedWordIndices.size}
        wrong={words.length - solvedWordIndices.size}
        onExit={onExit}
        onAgain={() => {
          setIsGameOver(false)
          setSeed(s => s + 1)
          timer.reset()
        }}
      />
    )
  }

  if (isAllSolved) {
    return (
      <ResultScreen
        title="Crossword Solved!"
        correct={words.length}
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

  const acrossClues = words.filter(w => w.direction === 'across')
  const downClues = words.filter(w => w.direction === 'down')
  const currentCard = selectedWord ? (selectedWord.card || flashcards.find(f => f.id === selectedWord.note.cardId)) : null
  const progressPercent = Math.round((solvedWordIndices.size / words.length) * 100)

  // Cell sizing matching WordSearch & WordChain uniform square proportions
  const maxDim = Math.max(gridRows, gridCols)
  const cellClass = maxDim >= 13
    ? 'w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 text-xs sm:text-sm'
    : maxDim >= 11
    ? 'w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 text-xs sm:text-base'
    : maxDim >= 9
    ? 'w-9 sm:w-11 md:w-12 h-9 sm:h-11 md:h-12 text-sm sm:text-lg'
    : 'w-11 sm:w-13 md:w-14 h-11 sm:h-13 md:h-14 text-base sm:text-xl'

  return (
    <div 
      className="max-w-4xl sm:max-w-5xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-3 sm:px-6 select-none outline-none w-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <GameHeader
        title="Crossword"
        onExit={onExit}
        progress={progressPercent}
        timer={timer}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            {(['easy', 'normal', 'hard', 'evil'] as Difficulty[]).map(d => (
              <button
                key={d}
                type="button"
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleHint}
              title="Reveal current letter"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
            >
              <Lightbulb size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSeed(s => s + 1)
                setIsGameOver(false)
                timer.reset()
              }}
              title="New Crossword"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />

      <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 mt-3">
        {/* Tight-crop Crossword Grid */}
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md overflow-x-auto max-w-full">
          <div 
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: gridRows }).map((_, r) =>
              Array.from({ length: gridCols }).map((_, c) => {
                const key = `${r},${c}`
                const cell = gridCells.get(key)

                if (!cell) {
                  return (
                    <div 
                      key={key} 
                      className={`${cellClass} aspect-square rounded-sm bg-transparent pointer-events-none`} 
                    />
                  )
                }

                const isInWord = selectedWord ? isCellInWord(selectedWord, r, c) : false
                const isActive = activeCell?.r === r && activeCell?.c === c
                const val = (userInputs[key] || '').toUpperCase()
                const isCellCorrect = (userInputs[key] || '').toLowerCase() === cell.solution.toLowerCase()

                return (
                  <div
                    key={key}
                    onClick={() => handleCellClick(r, c)}
                    className={`${cellClass} aspect-square rounded-lg border relative flex items-center justify-center font-black uppercase cursor-pointer transition-all select-none ${
                      isActive
                        ? 'border-purple-600 bg-purple-100 dark:bg-purple-900/60 ring-2 ring-purple-400 text-purple-900 dark:text-purple-100 shadow-sm'
                        : isInWord
                        ? 'border-purple-300 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200'
                        : isCellCorrect
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-750 text-gray-800 dark:text-gray-100 shadow-2xs'
                    }`}
                  >
                    {cell.number !== undefined && (
                      <span className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-bold text-gray-500 dark:text-gray-400 select-none pointer-events-none leading-none">
                        {cell.number}
                      </span>
                    )}
                    <span>{val}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Clues Sidebar (Silent click, no speech audio) */}
        <div className="w-full lg:w-80 flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md">
          {acrossClues.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1.5">
                Across
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {acrossClues.map(ac => {
                  const isSel = selectedWord === ac
                  const isWordSolved = solvedWordIndices.has(words.indexOf(ac))
                  return (
                    <div
                      key={`ac-${ac.number}-${ac.word}`}
                      onClick={() => {
                        setSelectedWordIdx(words.indexOf(ac))
                        setActiveCell({ r: ac.startR, c: ac.startC })
                        // Strictly NO speakEnglish here per user request
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                        isWordSolved
                          ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 line-through opacity-85'
                          : isSel
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-semibold ring-1 ring-purple-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-bold mr-1">#{ac.number}.</span>
                      <span>{ac.meaning}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({ac.length} letters)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {downClues.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                Down
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {downClues.map(dc => {
                  const isSel = selectedWord === dc
                  const isWordSolved = solvedWordIndices.has(words.indexOf(dc))
                  return (
                    <div
                      key={`dc-${dc.number}-${dc.word}`}
                      onClick={() => {
                        setSelectedWordIdx(words.indexOf(dc))
                        setActiveCell({ r: dc.startR, c: dc.startC })
                        // Strictly NO speakEnglish here per user request
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                        isWordSolved
                          ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 line-through opacity-85'
                          : isSel
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-bold mr-1">#{dc.number}.</span>
                      <span>{dc.meaning}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({dc.length} letters)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {currentCard && (
        <div className="w-full flex justify-start mt-3 max-w-4xl px-2">
          <RootCardButton
            onClick={() => setShowModalCard(currentCard)}
          />
        </div>
      )}

      <CardDetailModal
        card={showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

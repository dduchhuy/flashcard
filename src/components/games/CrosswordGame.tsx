import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { useNotes, EmptyState, RootCardButton, CardDetailModal, GameHeader, ResultScreen, Note } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

interface CrosswordWord {
  number: number
  direction: 'across' | 'down'
  word: string
  meaning: string
  note: Note
  startR: number
  startC: number
  length: number
}

interface Cell {
  r: number
  c: number
  solution: string
  number?: number
  acrossWordIdx?: number
  downWordIdx?: number
}

const GRID_DIM = 9

export function CrosswordGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const allNotes = useNotes(seed, true)

  // Filter 3 to 6 letter words with only clean lowercase english letters
  const eligibleNotes = useMemo(() => {
    return allNotes.filter(n => {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      return clean.length >= 3 && clean.length <= 6
    })
  }, [allNotes])

  // Crossword Generator: picks 3-5 words that can interlock
  const { words, gridCells } = useMemo(() => {
    if (eligibleNotes.length < 2) return { words: [], gridCells: new Map<string, Cell>() }

    // Deduplicate notes by clean word
    const uniqueNotes: Note[] = []
    const seen = new Set<string>()
    for (const n of eligibleNotes) {
      const w = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (!seen.has(w)) {
        seen.add(w)
        uniqueNotes.push(n)
      }
    }

    if (uniqueNotes.length < 2) return { words: [], gridCells: new Map<string, Cell>() }

    // Start with 1st word across in the middle
    const w1Note = uniqueNotes[0]
    const w1 = w1Note.word.trim().toLowerCase().replace(/[^a-z]/g, '')
    const startR1 = 4
    const startC1 = Math.max(1, Math.floor((GRID_DIM - w1.length) / 2))

    const placed: CrosswordWord[] = [
      {
        number: 1,
        direction: 'across',
        word: w1,
        meaning: w1Note.meaning,
        note: w1Note,
        startR: startR1,
        startC: startC1,
        length: w1.length,
      }
    ]

    const cellMap = new Map<string, Cell>()
    for (let i = 0; i < w1.length; i++) {
      const r = startR1
      const c = startC1 + i
      cellMap.set(`${r},${c}`, {
        r, c, solution: w1[i],
        number: i === 0 ? 1 : undefined,
        acrossWordIdx: 0,
      })
    }

    let nextNumber = 2

    // Try intersecting with other words (down, then across...)
    for (let ni = 1; ni < uniqueNotes.length && placed.length < 4; ni++) {
      const candNote = uniqueNotes[ni]
      const cand = candNote.word.trim().toLowerCase().replace(/[^a-z]/g, '')

      let placedThis = false
      // Try intersecting with each already placed word
      for (const p of placed) {
        if (placedThis) break
        const targetDir: 'across' | 'down' = p.direction === 'across' ? 'down' : 'across'

        for (let i = 0; i < cand.length; i++) {
          if (placedThis) break
          const char = cand[i]

          // Find match in p
          for (let j = 0; j < p.length; j++) {
            if (p.word[j] === char) {
              // Candidate intersection point
              const interR = p.direction === 'across' ? p.startR : p.startR + j
              const interC = p.direction === 'across' ? p.startC + j : p.startC

              const candStartR = targetDir === 'down' ? interR - i : interR
              const candStartC = targetDir === 'across' ? interC - i : interC

              // Boundary check
              if (candStartR < 0 || candStartR + (targetDir === 'down' ? cand.length : 1) > GRID_DIM) continue
              if (candStartC < 0 || candStartC + (targetDir === 'across' ? cand.length : 1) > GRID_DIM) continue

              // Overlap & clash check
              let valid = true
              for (let k = 0; k < cand.length; k++) {
                const cr = targetDir === 'down' ? candStartR + k : candStartR
                const cc = targetDir === 'across' ? candStartC + k : candStartC
                const existing = cellMap.get(`${cr},${cc}`)
                if (existing) {
                  if (existing.solution !== cand[k]) { valid = false; break }
                }
              }

              if (valid) {
                const newWord: CrosswordWord = {
                  number: nextNumber++,
                  direction: targetDir,
                  word: cand,
                  meaning: candNote.meaning,
                  note: candNote,
                  startR: candStartR,
                  startC: candStartC,
                  length: cand.length,
                }
                const wordIdx = placed.length
                placed.push(newWord)

                for (let k = 0; k < cand.length; k++) {
                  const cr = targetDir === 'down' ? candStartR + k : candStartR
                  const cc = targetDir === 'across' ? candStartC + k : candStartC
                  const key = `${cr},${cc}`
                  const existing = cellMap.get(key)
                  if (existing) {
                    if (targetDir === 'across') existing.acrossWordIdx = wordIdx
                    else existing.downWordIdx = wordIdx
                    if (k === 0 && !existing.number) existing.number = newWord.number
                  } else {
                    cellMap.set(key, {
                      r: cr, c: cc, solution: cand[k],
                      number: k === 0 ? newWord.number : undefined,
                      acrossWordIdx: targetDir === 'across' ? wordIdx : undefined,
                      downWordIdx: targetDir === 'down' ? wordIdx : undefined,
                    })
                  }
                }
                placedThis = true
                break
              }
            }
          }
        }
      }
    }

    return { words: placed, gridCells: cellMap }
  }, [eligibleNotes, seed])

  // User input map: key `${r},${c}` -> string
  const [userInputs, setUserInputs] = useState<Record<string, string>>({})
  const [selectedWordIdx, setSelectedWordIdx] = useState<number>(0)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  // Initialize selection
  useEffect(() => {
    setUserInputs({})
    if (words.length > 0) {
      setSelectedWordIdx(0)
      setActiveCell({ r: words[0].startR, c: words[0].startC })
    }
  }, [words])

  const selectedWord = words[selectedWordIdx]

  // Check if cell is in selected word
  const isCellInSelectedWord = (r: number, c: number) => {
    if (!selectedWord) return false
    if (selectedWord.direction === 'across') {
      return r === selectedWord.startR && c >= selectedWord.startC && c < selectedWord.startC + selectedWord.length
    } else {
      return c === selectedWord.startC && r >= selectedWord.startR && r < selectedWord.startR + selectedWord.length
    }
  }

  // Handle cell click
  const handleCellClick = (r: number, c: number) => {
    const cell = gridCells.get(`${r},${c}`)
    if (!cell) return

    setActiveCell({ r, c })

    // If cell belongs to current selected word, just focus it
    if (selectedWord && isCellInSelectedWord(r, c)) return

    // Otherwise switch to across word or down word
    if (cell.acrossWordIdx !== undefined) {
      setSelectedWordIdx(cell.acrossWordIdx)
    } else if (cell.downWordIdx !== undefined) {
      setSelectedWordIdx(cell.downWordIdx)
    }
  }

  // Handle keyboard typing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell || !selectedWord) return

    if (/^[a-zA-Z]$/.test(e.key)) {
      const char = e.key.toLowerCase()
      const key = `${activeCell.r},${activeCell.c}`
      setUserInputs(prev => ({ ...prev, [key]: char }))

      // Move to next cell in word
      const stepR = selectedWord.direction === 'down' ? 1 : 0
      const stepC = selectedWord.direction === 'across' ? 1 : 0
      const nextR = activeCell.r + stepR
      const nextC = activeCell.c + stepC

      if (isCellInSelectedWord(nextR, nextC)) {
        setActiveCell({ r: nextR, c: nextC })
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
        // Move back
        const stepR = selectedWord.direction === 'down' ? -1 : 0
        const stepC = selectedWord.direction === 'across' ? -1 : 0
        const prevR = activeCell.r + stepR
        const prevC = activeCell.c + stepC
        if (isCellInSelectedWord(prevR, prevC)) {
          setActiveCell({ r: prevR, c: prevC })
          const pKey = `${prevR},${prevC}`
          setUserInputs(prev => {
            const cp = { ...prev }
            delete cp[pKey]
            return cp
          })
        }
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const stepR = e.key === 'ArrowDown' ? 1 : 0
      const stepC = e.key === 'ArrowRight' ? 1 : 0
      const nR = activeCell.r + stepR
      const nC = activeCell.c + stepC
      if (gridCells.has(`${nR},${nC}`)) {
        handleCellClick(nR, nC)
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const stepR = e.key === 'ArrowUp' ? -1 : 0
      const stepC = e.key === 'ArrowLeft' ? -1 : 0
      const nR = activeCell.r + stepR
      const nC = activeCell.c + stepC
      if (gridCells.has(`${nR},${nC}`)) {
        handleCellClick(nR, nC)
      }
    }
  }

  // Hint: fill active cell
  const handleHint = () => {
    if (!activeCell) return
    const cell = gridCells.get(`${activeCell.r},${activeCell.c}`)
    if (!cell) return
    setUserInputs(prev => ({ ...prev, [`${activeCell.r},${activeCell.c}`]: cell.solution }))
  }

  // Validate all cells
  const isAllSolved = useMemo(() => {
    if (gridCells.size === 0) return false
    for (const [key, cell] of gridCells.entries()) {
      if ((userInputs[key] || '').toLowerCase() !== cell.solution.toLowerCase()) return false
    }
    return true
  }, [gridCells, userInputs])

  if (words.length === 0) {
    return <EmptyState onExit={onExit} text="Not enough suitable intersecting vocabulary words." />
  }

  if (isAllSolved) {
    return (
      <ResultScreen
        title="Crossword Solved!"
        correct={words.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => setSeed(s => s + 1)}
      />
    )
  }

  const acrossClues = words.filter(w => w.direction === 'across')
  const downClues = words.filter(w => w.direction === 'down')
  const currentCard = selectedWord ? flashcards.find(f => f.id === selectedWord.note.cardId) : null

  return (
    <div 
      className="max-w-2xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-3 select-none outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <GameHeader
        onExit={onExit}
        center={
          <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
            Crossword — Ô chữ ({words.length} từ)
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleHint}
              title="Điền chữ cái ô hiện tại"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
            >
              <Lightbulb size={16} />
            </button>
            <button
              onClick={() => setSeed(s => s + 1)}
              title="Tạo ô chữ mới"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />

      <div className="w-full flex flex-col md:flex-row items-center md:items-start justify-center gap-5 mt-2">
        {/* Crossword Grid Container */}
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md">
          <div 
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${GRID_DIM}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: GRID_DIM }).map((_, r) =>
              Array.from({ length: GRID_DIM }).map((_, c) => {
                const key = `${r},${c}`
                const cell = gridCells.get(key)

                if (!cell) {
                  return (
                    <div 
                      key={key} 
                      className="w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 bg-gray-100/40 dark:bg-gray-900/40 rounded-sm" 
                    />
                  )
                }

                const isInWord = isCellInSelectedWord(r, c)
                const isActive = activeCell?.r === r && activeCell?.c === c
                const val = (userInputs[key] || '').toUpperCase()

                return (
                  <div
                    key={key}
                    onClick={() => handleCellClick(r, c)}
                    className={`w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 rounded border relative flex items-center justify-center font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                      isActive
                        ? 'border-purple-600 bg-purple-100 dark:bg-purple-900/60 ring-2 ring-purple-400 text-purple-900 dark:text-purple-100'
                        : isInWord
                        ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-750 text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {cell.number && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-bold text-gray-400 leading-none">
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

        {/* Clues Panel */}
        <div className="w-full md:w-64 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/70 shadow-sm space-y-4">
          {acrossClues.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1.5">
                Ngang (Across)
              </h4>
              <div className="space-y-1.5">
                {acrossClues.map(ac => {
                  const isSel = selectedWord === ac
                  return (
                    <div
                      key={ac.number}
                      onClick={() => {
                        setSelectedWordIdx(words.indexOf(ac))
                        setActiveCell({ r: ac.startR, c: ac.startC })
                        speakEnglish(ac.word)
                      }}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                        isSel
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-medium'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-bold mr-1">#{ac.number}.</span>
                      <span>{ac.meaning}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({ac.length} chữ)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {downClues.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                Dọc (Down)
              </h4>
              <div className="space-y-1.5">
                {downClues.map(dc => {
                  const isSel = selectedWord === dc
                  return (
                    <div
                      key={dc.number}
                      onClick={() => {
                        setSelectedWordIdx(words.indexOf(dc))
                        setActiveCell({ r: dc.startR, c: dc.startC })
                        speakEnglish(dc.word)
                      }}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                        isSel
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-bold mr-1">#{dc.number}.</span>
                      <span>{dc.meaning}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({dc.length} chữ)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {currentCard && (
        <RootCardButton
          onClick={() => setShowModalCard(currentCard)}
          className="fixed bottom-3 left-3 z-20"
        />
      )}

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

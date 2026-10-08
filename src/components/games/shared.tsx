import { useMemo, ReactNode } from 'react'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode } from '../../store'
import { extractWordText } from '../../utils'

export type Note = {
  id: string
  word: string
  meaning: string
  sentence: string
  cardId: string
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useNotes(seed: number, allHighlights?: boolean): Note[] {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  return useMemo(() => {
    const notes: Note[] = []
    let filtered = activeTags.length > 0
      ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t)))
      : flashcards
      
    filtered = getCardsForMode(filtered, gameInputMode)
    filtered.forEach(card => {
      if (card.highlights.length === 0) return
      
      if (allHighlights) {
        card.highlights.forEach(h => {
          notes.push({
            id: h.id,
            word: extractWordText(card.sentence, h.wordIndices),
            meaning: h.meaning,
            sentence: card.sentence,
            cardId: card.id,
          })
        })
      } else {
        let selectedHighlight = card.highlights[0]
        if (card.highlights.length > 1) {
          const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * card.highlights.length)
          selectedHighlight = card.highlights[randIndex]
        }
        
        notes.push({
          id: selectedHighlight.id,
          word: extractWordText(card.sentence, selectedHighlight.wordIndices),
          meaning: selectedHighlight.meaning,
          sentence: card.sentence,
          cardId: card.id,
        })
      }
    })
    return shuffle(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags, gameInputMode, allHighlights])
}

export function EmptyState({ onExit, text }: { onExit: () => void, text?: string }) {
  const mode = useFlashcardStore.getState().gameInputMode
  const defaultText = mode === 'word' ? 'No suitable flashcards found.' : 'No notes found. Highlight words first!'
  const display = text || defaultText
  return (
    <div className="text-center text-gray-500 dark:text-gray-400 py-20">
      <p>{display}</p>
      <button onClick={onExit} className="mt-4 text-purple-600 hover:underline">Go back</button>
    </div>
  )
}

export function ResultScreen({ lines, onExit, onAgain }: { lines: ReactNode, onExit: () => void, onAgain: () => void }) {
  return (
    <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
      <div className="text-6xl mb-6">🏆</div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Complete!</h2>
      <div className="text-lg text-gray-500 dark:text-gray-400 mb-6">{lines}</div>
      <div className="flex gap-4 mt-2">
        <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium">Back</button>
        <button onClick={onAgain} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700">
          <RefreshCcw size={18} /> Play Again
        </button>
      </div>
    </div>
  )
}

export function BackBar({ onExit, right }: { onExit: () => void, right?: ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-8">
      <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={24} />
      </button>
      {right ?? <div className="w-6" />}
    </div>
  )
}

export function BottomCounter({ children }: { children: ReactNode }) {
  return <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-4">{children}</p>
}

export const softBtn = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"

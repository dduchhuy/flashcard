import { useMemo, useState, useEffect, ReactNode } from 'react'
import { ArrowLeft, RefreshCcw, BookOpen, X, Volume2 } from 'lucide-react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard } from '../../store'
import { extractWordText, speakEnglish } from '../../utils'

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

export function useNotes(seed: number, allHighlights?: boolean, sourceMode?: 'highlights' | 'phrases'): Note[] {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  return useMemo(() => {
    const notes: Note[] = []
    let filtered = activeTags.length > 0
      ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t)))
      : flashcards
      
    filtered = getCardsForMode(filtered, gameInputMode)
    filtered.forEach(card => {
      if (sourceMode === 'phrases') {
        const phrases = card.phrasesAndIdioms || []
        phrases.forEach((p, idx) => {
          if (!p.phrase) return
          notes.push({
            id: p.id || `${card.id}-pi-${idx}`,
            word: p.phrase,
            meaning: p.translation || p.phrase,
            sentence: p.phrase,
            cardId: card.id,
          })
        })
        return
      }

      const highlights = card.highlights || []
      if (highlights.length === 0) return
      
      if (allHighlights) {
        highlights.forEach(h => {
          notes.push({
            id: h.id,
            word: extractWordText(card.sentence, h.wordIndices) || card.sentence,
            meaning: h.meaning,
            sentence: card.sentence,
            cardId: card.id,
          })
        })
      } else {
        let selectedHighlight = highlights[0]
        if (highlights.length > 1) {
          const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
          selectedHighlight = highlights[randIndex]
        }
        
        notes.push({
          id: selectedHighlight.id,
          word: extractWordText(card.sentence, selectedHighlight.wordIndices) || card.sentence,
          meaning: selectedHighlight.meaning,
          sentence: card.sentence,
          cardId: card.id,
        })
      }
    })
    return shuffle(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, seed, activeTags, gameInputMode, allHighlights, sourceMode])
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

export function RootCardButton({ onClick, className = '' }: { onClick: () => void, className?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title="View original flashcard"
      className={`p-1.5 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 ${className}`}
    >
      <BookOpen size={18} />
    </button>
  )
}

export function GameStatsBar({
  correct,
  wrong,
  skipped,
  current,
  total,
  className = ''
}: {
  correct: number
  wrong: number
  skipped: number
  current?: number
  total?: number
  className?: string
}) {
  return (
    <div className={`flex items-center justify-center gap-6 mt-3 px-1 text-sm font-medium text-gray-500 dark:text-gray-400 ${className}`}>
      <span>{correct} correct</span>
      <span>{wrong} wrong</span>
      <span>{skipped} skip</span>
      {total !== undefined && (
        <>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700" />
          <span className="tabular-nums">
            {current !== undefined ? current : 0} / {total}
          </span>
        </>
      )}
    </div>
  )
}

export function CardDetailModal({
  card,
  isOpen = true,
  onClose
}: {
  card?: Flashcard | null
  isOpen?: boolean
  onClose: () => void
}) {
  const { flashcards } = useFlashcardStore()
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [activePosIdx, setActivePosIdx] = useState<number>(0)

  useEffect(() => {
    if (card) {
      setActiveCardId(card.id)
      setActivePosIdx(0)
    }
  }, [card])

  if (!isOpen || !card) return null

  // Find all sibling cards that share the same word
  const wordKey = card.sentence.trim().toLowerCase()
  const siblings = flashcards.filter(f => f.sentence.trim().toLowerCase() === wordKey)
  const currentCard = siblings.find(s => s.id === activeCardId) || card

  const hasPosEntries = Boolean(currentCard.posEntries && currentCard.posEntries.length > 0)
  const posList = hasPosEntries
    ? currentCard.posEntries!.map((p, idx) => ({
        key: p.id || String(idx),
        label: p.partOfSpeech,
        isActive: idx === activePosIdx,
        onClick: () => setActivePosIdx(idx),
      }))
    : siblings
        .filter(s => s.partOfSpeech)
        .map(sib => ({
          key: sib.id,
          label: sib.partOfSpeech!,
          isActive: sib.id === currentCard.id,
          onClick: () => setActiveCardId(sib.id),
        }))

  const activePosEntry = hasPosEntries ? (currentCard.posEntries![activePosIdx] || currentCard.posEntries![0]) : null
  const displayPhonetic = activePosEntry?.phonetic || currentCard.phonetic

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
      onPointerDown={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-1 flex-1 pr-4">
            {/* Line 1: Word */}
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize break-words">
                {currentCard.sentence}
              </h2>
              <button
                onClick={() => speakEnglish(currentCard.sentence)}
                className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full transition-colors"
                title="Listen"
              >
                <Volume2 size={20} />
              </button>
            </div>

            {/* Line 2: Parts of speech (clickable to switch between POS) */}
            {posList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {posList.map(p => {
                  if (!p.label) return null
                  return (
                    <button
                      key={p.key}
                      onClick={p.onClick}
                      className={`text-sm italic px-2 py-0.5 rounded transition-all ${
                        p.isActive
                          ? 'font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600'
                          : 'font-normal text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Line 3: Phonetic */}
            {displayPhonetic && (
              <div className="text-base italic text-gray-400 dark:text-gray-500 font-normal">
                {displayPhonetic}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            onPointerDown={(e) => { e.stopPropagation(); onClose() }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X size={22} />
          </button>
        </div>

        {/* Highlights / Meanings / Examples */}
        <div className="space-y-3 mt-4">
          {hasPosEntries && activePosEntry ? (
            activePosEntry.meanings.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No notes or meanings added.</p>
            ) : (
              activePosEntry.meanings.map((m, mIdx) => (
                <div key={m.id || mIdx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700">
                  <div className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-1">
                    {m.meaning}
                  </div>
                  {m.examples && m.examples.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {m.examples.map((ex, exIdx) => (
                        <div key={ex.id || exIdx} className="bg-white/60 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-100/80 dark:border-gray-600/40">
                          <div className="text-sm text-gray-700 dark:text-gray-200 italic flex items-start justify-between gap-2">
                            <span>"{ex.sentence}"</span>
                            <button
                              onClick={() => speakEnglish(ex.sentence)}
                              className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-0.5 rounded transition-colors shrink-0"
                              title="Listen"
                            >
                              <Volume2 size={15} />
                            </button>
                          </div>
                          {ex.translation && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-1">
                              {ex.translation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (currentCard.highlights || []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No notes or meanings added.</p>
          ) : (
            (currentCard.highlights || []).map(h => (
              <div key={h.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700">
                <div className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-1">
                  {h.meaning}
                </div>
                {h.example && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 italic flex items-start gap-2 mt-1">
                    "{h.example}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Phrases & Idioms Section */}
        {currentCard.phrasesAndIdioms && currentCard.phrasesAndIdioms.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="font-bold text-gray-800 dark:text-gray-200 text-base mb-2.5 flex items-center gap-2">
              <span>Phrases &amp; Idioms</span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-normal">
                {currentCard.phrasesAndIdioms.length}
              </span>
            </div>
            <div className="space-y-2">
              {currentCard.phrasesAndIdioms.map((pi, piIdx) => (
                <div key={pi.id || piIdx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {pi.phrase}
                    </div>
                    {pi.translation && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                        {pi.translation}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => speakEnglish(pi.phrase)}
                    className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full transition-colors shrink-0"
                    title="Listen"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {getCardTags(currentCard).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            {getCardTags(currentCard).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


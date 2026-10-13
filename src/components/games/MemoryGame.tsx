import { useState, useMemo, useEffect } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, normalizePhraseItem } from '../../store'
import { Volume2, VolumeX } from 'lucide-react'
import { extractWordText, speakEnglish } from '../../utils'
import { GameHeader, ResultScreen } from './shared'

type CardItem = {
  uid: string
  pairId: string
  type: 'word' | 'meaning'
  text: string
  isFlipped: boolean
  isMatched: boolean
}

export function MemoryGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [memMode, setMemMode] = useState<'highlights' | 'phrases'>('highlights')

  const allPairs = useMemo(() => {
    const pairs: { id: string, word: string, meaning: string }[] = []
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    if (memMode === 'phrases') {
      filtered.forEach(card => {
        const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem)
        phrases.forEach((pi, idx) => {
          if (!pi.phrase) return
          pairs.push({
            id: pi.id || `${card.id}-pi-${idx}`,
            word: pi.phrase,
            meaning: pi.translation || pi.phrase,
          })
        })
      })
      return pairs.sort(() => Math.random() - 0.5)
    }

    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (highlights.length === 0) return
      let selectedHighlight = highlights[0]
      if (highlights.length > 1) {
        const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
        selectedHighlight = highlights[randIndex]
      }
      const h = selectedHighlight
      pairs.push({
        id: h.id,
        word: extractWordText(card.sentence, h.wordIndices),
        meaning: h.meaning
      })
    })
    return pairs.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, memMode])

  const [currentRound, setCurrentRound] = useState(0)
  
  // 6 pairs per round = 12 cards
  const actualRoundPairs = useMemo(() => {
    return allPairs.slice(currentRound * 6, currentRound * 6 + 6)
  }, [allPairs, currentRound])

  const [cards, setCards] = useState<CardItem[]>([])
  const [flippedUids, setFlippedUids] = useState<string[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)

  useEffect(() => {
    if (actualRoundPairs.length > 0) {
      let newCards: CardItem[] = []
      actualRoundPairs.forEach(p => {
        newCards.push({ uid: `${p.id}-w`, pairId: p.id, type: 'word', text: p.word, isFlipped: false, isMatched: false })
        newCards.push({ uid: `${p.id}-m`, pairId: p.id, type: 'meaning', text: p.meaning, isFlipped: false, isMatched: false })
      })
      newCards = newCards.sort(() => Math.random() - 0.5)
      setCards(newCards)
      setFlippedUids([])
    }
  }, [actualRoundPairs])

  const handleFlip = (uid: string) => {
    if (isAnimating) return
    const card = cards.find(c => c.uid === uid)
    if (!card || card.isMatched || card.isFlipped) return

    if (autoSpeak && card.type === 'word') speakEnglish(card.text)

    const newFlipped = [...flippedUids, uid]
    setFlippedUids(newFlipped)
    
    setCards(prev => prev.map(c => c.uid === uid ? { ...c, isFlipped: true } : c))

    if (newFlipped.length === 2) {
      setIsAnimating(true)
      const c1 = cards.find(c => c.uid === newFlipped[0])
      const c2 = cards.find(c => c.uid === newFlipped[1])
      
      if (c1 && c2 && c1.pairId === c2.pairId) {
        // match
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.uid) ? { ...c, isMatched: true } : c))
          setFlippedUids([])
          setIsAnimating(false)
        }, 600)
      } else {
        // mismatch
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.uid) ? { ...c, isFlipped: false } : c))
          setFlippedUids([])
          setIsAnimating(false)
        }, 1200)
      }
    }
  }

  const isRoundComplete = cards.length > 0 && cards.every(c => c.isMatched)

  useEffect(() => {
    if (isRoundComplete) {
      setTimeout(() => {
        setCurrentRound(r => r + 1)
      }, 1000)
    }
  }, [isRoundComplete])

  if (allPairs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-20">
        <p>No notes found. Highlight words first!</p>
        <button onClick={onExit} className="mt-4 text-purple-600">Go back</button>
      </div>
    )
  }

  if (currentRound * 6 >= allPairs.length && allPairs.length > 0) {
    return (
      <ResultScreen
        title="Memory Complete!"
        correct={allPairs.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setCurrentRound(0) }}
      />
    )
  }

  const matchedCount = cards.filter(c => c.isMatched).length
  const progressPercent = cards.length > 0 ? Math.round((matchedCount / cards.length) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        progress={progressPercent}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => { setMemMode('highlights'); setCurrentRound(0); setSeed(s => s + 1) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${memMode === 'highlights' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Words
            </button>
            <button
              onClick={() => { setMemMode('phrases'); setCurrentRound(0); setSeed(s => s + 1) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${memMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Phrases
            </button>
          </div>
        }
        right={
          <button
            onClick={() => setAutoSpeak(a => !a)}
            title={autoSpeak ? 'Auto-read English: on' : 'Auto-read English: off'}
            className={`p-1.5 rounded-lg border transition-colors ${autoSpeak ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        }
      />

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 flex-1 perspective-1000">
        {cards.map(c => (
          <div 
            key={c.uid} 
            className="relative w-full aspect-[3/2] cursor-pointer group"
            onClick={() => handleFlip(c.uid)}
          >
            <div className={`w-full h-full transition-all duration-500 transform-style-3d ${c.isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front (Face down) */}
              <div className={`absolute w-full h-full bg-purple-100 dark:bg-purple-900/30 rounded-xl border-2 border-purple-200 dark:border-purple-800 backface-hidden ${c.isFlipped ? 'opacity-0' : 'opacity-100'} group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors flex items-center justify-center text-purple-300`}>
                <span className="text-2xl sm:text-3xl opacity-50 font-bold">?</span>
              </div>
              
              {/* Back (Face up) */}
              <div className={`absolute w-full h-full rounded-xl border-2 backface-hidden rotate-y-180 p-1.5 sm:p-2 flex items-center justify-center text-center text-xs sm:text-sm font-medium break-all shadow-sm ${
                c.isMatched ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-200' :
                'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                <span className="line-clamp-2 sm:line-clamp-3 leading-tight">{c.text}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
      <p className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">
        Round {currentRound + 1}
      </p>
    </div>
  )
}

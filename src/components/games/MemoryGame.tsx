import { useState, useMemo, useEffect } from 'react'
import { useFlashcardStore } from '../../store'
import { ArrowLeft, RefreshCcw, Volume2, VolumeX } from 'lucide-react'
import { extractWordText, speakEnglish } from '../../utils'

type CardItem = {
  uid: string
  pairId: string
  type: 'word' | 'meaning'
  text: string
  isFlipped: boolean
  isMatched: boolean
}

export function MemoryGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const allPairs = useMemo(() => {
    const pairs: { id: string, word: string, meaning: string }[] = []
    flashcards.forEach(card => {
      card.highlights.forEach(h => {
        pairs.push({
          id: h.id,
          word: extractWordText(card.sentence, h.wordIndices),
          meaning: h.meaning
        })
      })
    })
    return pairs.sort(() => Math.random() - 0.5)
  }, [flashcards, seed])

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
      const c1 = cards.find(c => c.uid === newFlipped[0])!
      const c2 = cards.find(c => c.uid === newFlipped[1])!
      
      if (c1.pairId === c2.pairId) {
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
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Memory Complete!</h2>
        <div className="flex gap-4 mt-6">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 px-6 py-2 rounded-lg font-medium">Back</button>
          <button onClick={() => { setSeed(s => s + 1); setCurrentRound(0) }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium">
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <ArrowLeft size={24} />
        </button>
        <div className="w-6" />
        <button
          onClick={() => setAutoSpeak(a => !a)}
          title={autoSpeak ? 'Auto-read English: on' : 'Auto-read English: off'}
          className={`p-2 rounded-full border transition-colors ${autoSpeak ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700'}`}
        >
          {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 flex-1 perspective-1000">
        {cards.map(c => (
          <div 
            key={c.uid} 
            className="relative w-full aspect-[4/3] cursor-pointer group"
            onClick={() => handleFlip(c.uid)}
          >
            <div className={`w-full h-full transition-all duration-500 transform-style-3d ${c.isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front (Face down) */}
              <div className={`absolute w-full h-full bg-purple-100 dark:bg-purple-900/30 rounded-xl border-2 border-purple-200 dark:border-purple-800 backface-hidden ${c.isFlipped ? 'opacity-0' : 'opacity-100'} group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors flex items-center justify-center text-purple-300`}>
                <span className="text-4xl opacity-50">?</span>
              </div>
              
              {/* Back (Face up) */}
              <div className={`absolute w-full h-full rounded-xl border-2 backface-hidden rotate-y-180 p-2 flex items-center justify-center text-center text-sm font-medium break-all shadow-sm ${
                c.isMatched ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-200' :
                'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                <span className="line-clamp-3 leading-tight">{c.text}</span>
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
      <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-6">
        Round {currentRound + 1}
      </p>
    </div>
  )
}

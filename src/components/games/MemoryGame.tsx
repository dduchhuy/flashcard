import { useState, useMemo, useEffect } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, normalizePhraseItem } from '../../store'
import { Volume2, VolumeX } from 'lucide-react'
import { extractWordText, speakEnglish } from '../../utils'
import { GameHeader, ResultScreen, useGameTimer } from './shared'

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
  const [memMode, setMemMode] = useState<'words' | 'word-first' | 'phrases'>('words')
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)

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

    if (memMode === 'word-first') {
      filtered.forEach(card => {
        const h = (card.highlights || [])[0]
        if (!h) return
        pairs.push({
          id: h.id,
          word: extractWordText(card.sentence, h.wordIndices),
          meaning: h.meaning
        })
      })
      return pairs.sort(() => Math.random() - 0.5)
    }

    // Default: all words/highlights
    filtered.forEach(card => {
      const highlights = card.highlights || []
      highlights.forEach(h => {
        pairs.push({
          id: h.id,
          word: extractWordText(card.sentence, h.wordIndices),
          meaning: h.meaning
        })
      })
    })
    return pairs.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, gameInputMode, memMode])

  const [currentRound, setCurrentRound] = useState(0)
  
  // 6 pairs per round = 12 cards
  const actualRoundPairs = useMemo(() => {
    return allPairs.slice(currentRound * 6, currentRound * 6 + 6)
  }, [allPairs, currentRound])

  const [cards, setCards] = useState<CardItem[]>([])
  const [flippedUids, setFlippedUids] = useState<string[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)

  const handleTimeUp = () => {
    setIsGameOver(true)
  }

  const timer = useGameTimer({
    initialDuration: 60,
    onTimeUp: handleTimeUp,
    enabled: !isGameOver && currentRound * 6 < allPairs.length
  })

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
    if (isAnimating || isGameOver) return
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
        // match: +1s bonus
        timer.addTime(1)
        setScore(s => s + 1)
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.uid) ? { ...c, isMatched: true } : c))
          setFlippedUids([])
          setIsAnimating(false)
        }, 600)
      } else {
        // mismatch: -1s penalty
        timer.addTime(-1)
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

  if (isGameOver) {
    return (
      <ResultScreen
        title="Time's Up!"
        correct={score}
        wrong={0}
        onExit={onExit}
        onAgain={() => {
          setIsGameOver(false)
          setScore(0)
          setSeed(s => s + 1)
          setCurrentRound(0)
          timer.reset()
        }}
      />
    )
  }

  if (currentRound * 6 >= allPairs.length && allPairs.length > 0) {
    return (
      <ResultScreen
        title="Memory Complete!"
        correct={allPairs.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => { 
          setSeed(s => s + 1)
          setCurrentRound(0)
          setScore(0)
          setIsGameOver(false)
          timer.reset()
        }}
      />
    )
  }

  const matchedCount = cards.filter(c => c.isMatched).length
  const progressPercent = cards.length > 0 ? Math.round((matchedCount / cards.length) * 100) : 0

  return (
    <div className="max-w-4xl sm:max-w-5xl mx-auto py-2 px-3 sm:px-6 animate-in fade-in flex flex-col h-full w-full">
      <GameHeader
        onExit={onExit}
        progress={progressPercent}
        timer={timer}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => {
                if (memMode === 'words') setMemMode('word-first')
                else if (memMode === 'word-first') setMemMode('words')
                else setMemMode('words')
                setCurrentRound(0)
                setSeed(s => s + 1)
                timer.reset()
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                memMode === 'words' || memMode === 'word-first'
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300 font-bold'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {memMode === 'word-first' ? 'Word¹' : 'Words*'}
            </button>
            <button
              onClick={() => { 
                setMemMode('phrases')
                setCurrentRound(0)
                setSeed(s => s + 1)
                timer.reset()
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                memMode === 'phrases' 
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300 font-bold' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
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

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3 flex-1 perspective-1000 my-auto py-4">
        {cards.map(c => (
          <div 
            key={c.uid} 
            className="relative w-full aspect-[4/3] sm:aspect-[3/2] cursor-pointer group select-none"
            onClick={() => handleFlip(c.uid)}
          >
            <div className={`w-full h-full transition-all duration-500 transform-style-3d ${c.isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front (Face down) */}
              <div className={`absolute inset-0 bg-purple-50 dark:bg-purple-950/40 rounded-xl border-2 border-purple-200 dark:border-purple-800/80 backface-hidden ${c.isFlipped ? 'opacity-0' : 'opacity-100'} group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 group-hover:border-purple-300 transition-colors flex items-center justify-center text-purple-300 dark:text-purple-500 shadow-xs`}>
                <span className="text-2xl sm:text-3xl opacity-40 font-black">?</span>
              </div>
              
              {/* Back (Face up) */}
              <div className={`absolute inset-0 rounded-xl border-2 backface-hidden rotate-y-180 p-2 sm:p-2.5 flex items-center justify-center text-center text-xs sm:text-sm font-medium break-words shadow-sm transition-all ${
                c.isMatched ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200 font-semibold' :
                'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                <span className="line-clamp-3 leading-snug">{c.text}</span>
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
      <p className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 mt-2 mb-1">
        Round {currentRound + 1} • Matches: {cards.filter(c => c.isMatched).length / 2} / 6
      </p>
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode } from '../../store'
import { ArrowLeft, RefreshCcw, Shuffle, Volume2, VolumeX } from 'lucide-react'
import { extractWordText, speakEnglish } from '../../utils'
import { EmptyState } from './shared'

type MixItem = {
  uid: string
  pairId: string
  type: 'word' | 'meaning'
  text: string
}

export function MatchGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)

  const allPairs = useMemo(() => {
    const pairs: { id: string, word: string, meaning: string }[] = []
    let filtered = activeTags && activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    filtered.forEach(card => {
      if (card.highlights.length === 0) return
      
      let selectedHighlight = card.highlights[0]
      if (card.highlights.length > 1) {
        const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * card.highlights.length)
        selectedHighlight = card.highlights[randIndex]
      }
      
      pairs.push({
        id: selectedHighlight.id,
        word: extractWordText(card.sentence, selectedHighlight.wordIndices),
        meaning: selectedHighlight.meaning
      })
    })
    return pairs.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, gameInputMode])

  const [currentRound, setCurrentRound] = useState(0)
  const [autoSpeak, setAutoSpeak] = useState(true)
  
  const actualRoundPairs = useMemo(() => {
    return allPairs.slice(currentRound * 5, currentRound * 5 + 5)
  }, [allPairs, currentRound])

  const [items, setItems] = useState<MixItem[]>([])
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
  
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [selectedMeaningId, setSelectedMeaningId] = useState<string | null>(null)
  const [errorPair, setErrorPair] = useState<{w: string, m: string} | null>(null)

  useEffect(() => {
    if (actualRoundPairs.length > 0) {
      const newItems: MixItem[] = []
      actualRoundPairs.forEach(p => {
        newItems.push({ uid: `${p.id}-w`, pairId: p.id, type: 'word', text: p.word })
        newItems.push({ uid: `${p.id}-m`, pairId: p.id, type: 'meaning', text: p.meaning })
      })
      setItems(newItems.sort(() => Math.random() - 0.5))
      setMatchedIds(new Set())
      setSelectedWordId(null)
      setSelectedMeaningId(null)
      setErrorPair(null)
    }
  }, [actualRoundPairs])

  useEffect(() => {
    if (selectedWordId && selectedMeaningId) {
      if (selectedWordId === selectedMeaningId) { // they match pairId
        setTimeout(() => {
          setMatchedIds(prev => new Set(prev).add(selectedWordId))
          setSelectedWordId(null)
          setSelectedMeaningId(null)
        }, 300)
      } else {
        setErrorPair({ w: selectedWordId, m: selectedMeaningId })
        setTimeout(() => {
          setErrorPair(null)
          setSelectedWordId(null)
          setSelectedMeaningId(null)
        }, 800)
      }
    }
  }, [selectedWordId, selectedMeaningId])

  useEffect(() => {
    if (actualRoundPairs.length > 0 && matchedIds.size === actualRoundPairs.length) {
      setTimeout(() => {
        setCurrentRound(r => r + 1)
      }, 500)
    }
  }, [matchedIds.size, actualRoundPairs.length])

  const handleSelect = (item: MixItem) => {
    const isDeselect = item.type === 'word' ? selectedWordId === item.pairId : selectedMeaningId === item.pairId
    if (autoSpeak && item.type === 'word' && !isDeselect) speakEnglish(item.text)
    // If selecting same type again, replace it
    if (item.type === 'word') setSelectedWordId(prev => prev === item.pairId ? null : item.pairId)
    if (item.type === 'meaning') setSelectedMeaningId(prev => prev === item.pairId ? null : item.pairId)
  }

  if (allPairs.length === 0) {
    return <EmptyState onExit={onExit} />
  }

  if (currentRound * 5 >= allPairs.length) {
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Match Complete!</h2>
        <div className="flex gap-4 mt-6">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium">Back</button>
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
        <div className="flex items-center gap-3">
        <button
          onClick={() => setAutoSpeak(a => !a)}
          title={autoSpeak ? 'Auto-read English: on' : 'Auto-read English: off'}
          className={`p-2 rounded-full border transition-colors ${autoSpeak ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700'}`}
        >
          {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button 
          onClick={() => setItems(prev => [...prev].sort(() => Math.random() - 0.5))}
          className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
          title="Shuffle Cards"
        >
          <Shuffle size={20} />
        </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {items.map(item => {
          if (matchedIds.has(item.pairId)) return <div key={item.uid} className="h-24" /> // spacer

          const isSelected = item.type === 'word' ? selectedWordId === item.pairId : selectedMeaningId === item.pairId
          const isError = item.type === 'word' ? errorPair?.w === item.pairId : errorPair?.m === item.pairId
          
          const highlightColor = item.type === 'word' ? 'purple' : 'blue'
          
          let btnClass = "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          
          if (isError) {
            btnClass = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200"
          } else if (isSelected) {
            if (highlightColor === 'purple') btnClass = "bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-800 dark:text-purple-200"
            if (highlightColor === 'blue') btnClass = "bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-800 dark:text-blue-200"
          } else {
            if (highlightColor === 'purple') btnClass += " hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            if (highlightColor === 'blue') btnClass += " hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          }

          const overlayClass = isSelected ? btnClass : (
            highlightColor === 'purple' 
              ? "bg-purple-50 dark:bg-gray-700 border-purple-300 dark:border-purple-500 text-gray-700 dark:text-gray-200" 
              : "bg-blue-50 dark:bg-gray-700 border-blue-300 dark:border-blue-500 text-gray-700 dark:text-gray-200"
          )

          return (
            <div key={item.uid} className="relative group w-full h-24">
              <button
                onClick={() => handleSelect(item)}
                className={`w-full h-full p-4 rounded-xl border-2 text-center font-medium transition-all duration-300 ${btnClass} flex items-center justify-center`}
              >
                <div className="line-clamp-2 whitespace-pre-wrap break-all">
                  {item.text}
                </div>
              </button>

              <div className="absolute top-0 left-0 w-full hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => handleSelect(item)}
                  className={`w-full min-h-[6rem] h-auto p-4 rounded-xl border-2 text-center font-medium shadow-2xl flex items-center justify-center ${overlayClass}`}
                >
                  <div className="whitespace-pre-wrap break-all">
                    {item.text}
                  </div>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-6">
        Round {currentRound + 1}
      </p>
    </div>
  )
}

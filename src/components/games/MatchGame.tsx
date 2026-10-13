import { useState, useMemo, useEffect } from 'react'
import { useFlashcardStore, getCardTags, getCardsForMode, Flashcard, normalizePhraseItem } from '../../store'
import { Shuffle, Volume2, VolumeX } from 'lucide-react'
import { extractWordText, speakEnglish } from '../../utils'
import { EmptyState, CardDetailModal, RootCardButton, GameHeader, ResultScreen } from './shared'

type MixItem = {
  uid: string
  pairId: string
  type: 'word' | 'meaning'
  text: string
}

export function MatchGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)
  const [matchMode, setMatchMode] = useState<'words' | 'examples' | 'phrases'>('words')

  const allPairs = useMemo(() => {
    const pairs: { id: string, cardId: string, word: string, meaning: string }[] = []
    let filtered = activeTags && activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    if (matchMode === 'examples') {
      filtered.forEach(card => {
        const posEntries = card.posEntries || []
        posEntries.forEach((pos, pi) => {
          pos.meanings.forEach((m, mi) => {
            (m.examples || []).forEach((ex, ei) => {
              if (!ex.sentence) return
              pairs.push({
                id: `${card.id}-ex-${pi}-${mi}-${ei}`,
                cardId: card.id,
                word: ex.sentence,
                meaning: ex.translation || ex.sentence,
              })
            })
          })
        })
        // Also check legacy highlights examples
        const highlights = card.highlights || []
        highlights.forEach((h, hi) => {
          if (!h.example) return
          pairs.push({
            id: `${card.id}-hex-${hi}`,
            cardId: card.id,
            word: h.example,
            meaning: h.meaning,
          })
        })
      })
      return pairs.sort(() => Math.random() - 0.5)
    }

    if (matchMode === 'phrases') {
      filtered.forEach(card => {
        const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem)
        phrases.forEach((pi, idx) => {
          if (!pi.phrase) return
          pairs.push({
            id: pi.id || `${card.id}-pi-${idx}`,
            cardId: card.id,
            word: pi.phrase,
            meaning: pi.translation || pi.phrase,
          })
        })
      })
      return pairs.sort(() => Math.random() - 0.5)
    }

    // Default: words mode
    filtered.forEach(card => {
      const highlights = card.highlights || []
      if (highlights.length === 0) return
      
      let selectedHighlight = highlights[0]
      if (highlights.length > 1) {
        const randIndex = Math.floor(Math.abs(Math.sin(card.id.length + seed)) * highlights.length)
        selectedHighlight = highlights[randIndex]
      }
      
      pairs.push({
        id: selectedHighlight.id,
        cardId: card.id,
        word: extractWordText(card.sentence, selectedHighlight.wordIndices),
        meaning: selectedHighlight.meaning
      })
    })
    return pairs.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, gameInputMode, matchMode])

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
      <ResultScreen
        title="Match Complete!"
        correct={allPairs.length}
        wrong={0}
        onExit={onExit}
        onAgain={() => { setSeed(s => s + 1); setCurrentRound(0) }}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-2 px-3 sm:px-4 animate-in fade-in flex flex-col h-full">
      <GameHeader
        onExit={onExit}
        progress={actualRoundPairs.length > 0 ? Math.round((matchedIds.size / actualRoundPairs.length) * 100) : 0}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
            <button
              onClick={() => { setMatchMode('words'); setCurrentRound(0); setSeed(s => s + 1) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${matchMode === 'words' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Words
            </button>
            <button
              onClick={() => { setMatchMode('examples'); setCurrentRound(0); setSeed(s => s + 1) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${matchMode === 'examples' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Examples
            </button>
            <button
              onClick={() => { setMatchMode('phrases'); setCurrentRound(0); setSeed(s => s + 1) }}
              className={`px-2.5 py-1 rounded-md transition-colors ${matchMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'}`}
            >
              Phrases
            </button>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAutoSpeak(a => !a)}
              title={autoSpeak ? 'Auto-read English: on' : 'Auto-read English: off'}
              className={`p-1.5 rounded-lg border transition-colors ${autoSpeak ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button 
              onClick={() => setItems(prev => [...prev].sort(() => Math.random() - 0.5))}
              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200"
              title="Shuffle Cards"
            >
              <Shuffle size={16} />
            </button>
            <RootCardButton 
              onClick={() => {
                const currentPairId = selectedWordId || selectedMeaningId || actualRoundPairs[0]?.id
                const foundPair = actualRoundPairs.find(p => p.id === currentPairId)
                const card = flashcards.find(f => f.id === foundPair?.cardId) || flashcards.find(f => f.id === actualRoundPairs[0]?.cardId)
                if (card) setShowModalCard(card)
              }}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 flex-1 mb-2">
        {items.map(item => {
          if (matchedIds.has(item.pairId)) return <div key={item.uid} className="h-16 sm:h-18" /> // spacer

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
            <div key={item.uid} className="relative group w-full h-16 sm:h-18">
              <button
                onClick={() => handleSelect(item)}
                className={`w-full h-full p-2.5 rounded-xl border-2 text-center text-xs sm:text-sm font-medium transition-all duration-300 ${btnClass} flex items-center justify-center`}
              >
                <div className="line-clamp-2 whitespace-pre-wrap break-all">
                  {item.text}
                </div>
              </button>

              <div className="absolute top-0 left-0 w-full hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => handleSelect(item)}
                  className={`w-full min-h-[4.5rem] h-auto p-2.5 rounded-xl border-2 text-center text-xs sm:text-sm font-medium shadow-2xl flex items-center justify-center ${overlayClass}`}
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
      <p className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">
        Round {currentRound + 1}
      </p>

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

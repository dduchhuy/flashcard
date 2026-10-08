import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashcardStore, getCardTags } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { SelectDropdown } from './SelectDropdown'
import { LayoutGrid, List, Lightbulb, LightbulbOff, Tag as TagIcon, ChevronDown, Check, Lock, Unlock, Type } from 'lucide-react'

type SortOption = 'date_desc' | 'date_asc' | 'a_z' | 'tag'

export function TabAllCards() {
  const { flashcards } = useFlashcardStore()
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [showHighlights, setShowHighlights] = useState(true)
  const [showPartOfSpeech, setShowPartOfSpeech] = useState(true)
  const [showPhonetic, setShowPhonetic] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'all' | 'exact'>('all')
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false)
  const [displayCount, setDisplayCount] = useState(50)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsTagFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [])

  const allAvailableTags = useMemo(() => {
    return Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).sort()
  }, [flashcards])

  const filteredCards = useMemo(() => {
    let result = flashcards
    if (selectedTags.length > 0) {
      result = result.filter(c => {
        const tags = getCardTags(c)
        return selectedTags.some(t => tags.includes(t))
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => {
        if (c.sentence.toLowerCase().includes(q)) return true
        if (searchMode === 'all') {
          if (c.highlights.some(h => h.meaning.toLowerCase().includes(q) || h.example?.toLowerCase().includes(q))) return true
        }
        return false
      })
    }
    return result
  }, [flashcards, selectedTags, searchQuery, searchMode])

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'date_desc') return b.createdAt - a.createdAt
    if (sortBy === 'date_asc') return a.createdAt - b.createdAt
    if (sortBy === 'a_z') return a.sentence.localeCompare(b.sentence)
    if (sortBy === 'tag') {
      const aTag = getCardTags(a)[0] || '\uffff'
      const bTag = getCardTags(b)[0] || '\uffff'
      if (aTag !== bTag) return aTag.localeCompare(bTag)
      return a.sentence.localeCompare(b.sentence)
    }
    return 0
  })

  useEffect(() => {
    setDisplayCount(50)
  }, [searchQuery, searchMode, selectedTags, sortBy])

  const displayedCards = sortedCards.slice(0, displayCount)

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 transition-colors">
        <div className="flex gap-2">
          <button
            onClick={() => setSearchMode(m => m === 'all' ? 'exact' : 'all')}
            title={searchMode === 'all' ? "Search everywhere" : "Search word only"}
            className={`flex-shrink-0 w-10 flex items-center justify-center rounded-lg transition-colors ${
              searchMode === 'exact' 
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Type size={18} />
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchMode === 'all' ? "Search flashcards, meanings, or examples..." : "Search exactly by word..."}
            className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
          />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 flex flex-wrap items-center gap-2 transition-colors">
        
        {/* Sort Dropdown */}
        <SelectDropdown
          value={sortBy}
          onChange={(v) => setSortBy(v as SortOption)}
          options={[
            { value: 'date_desc', label: 'Newest first' },
            { value: 'date_asc', label: 'Oldest first' },
            { value: 'a_z', label: 'A - Z' },
            { value: 'tag', label: 'Tag' }
          ]}
          className="flex-1 min-w-[130px]"
        />

        {/* Tag Dropdown */}
        <div className="relative flex-1 min-w-[130px]" ref={filterRef}>
          <button
            onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <TagIcon size={16} className="text-purple-500 shrink-0" />
              <span className="truncate font-medium">{selectedTags.length === 0 ? 'All tags' : `${selectedTags.length} tags`}</span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isTagFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isTagFilterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-full min-w-max bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in slide-in-from-top-1">
              <div className="overflow-y-auto p-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    setSelectedTags([])
                    setIsTagFilterOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between transition-colors ${
                    selectedTags.length === 0 
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate mr-4">All tags</span>
                  {selectedTags.length === 0 && <Check size={16} />}
                </button>
                {allAvailableTags.map(tag => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isSelected) {
                          setSelectedTags(prev => prev.filter(t => t !== tag))
                        } else {
                          setSelectedTags(prev => [...prev, tag])
                        }
                      }}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between transition-colors ${
                        isSelected 
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="truncate mr-4">{tag}</span>
                      {isSelected && <Check size={16} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Icons Group */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`p-2.5 rounded-lg flex items-center justify-center transition-colors border shadow-sm ${
              isLocked 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={isLocked ? "Unlock Mode" : "Lock Mode (Read text instead of editing)"}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>

          <button 
            onClick={() => setShowHighlights(!showHighlights)}
            className={`p-2.5 rounded-lg flex items-center justify-center transition-colors border shadow-sm ${
              showHighlights 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={showHighlights ? 'Hide Notes' : 'Show Notes'}
          >
            {showHighlights ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
          </button>

          <button 
            onClick={() => setShowPartOfSpeech(!showPartOfSpeech)}
            className={`p-2.5 rounded-lg flex items-center justify-center transition-colors border shadow-sm ${
              showPartOfSpeech 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={showPartOfSpeech ? 'Hide Type' : 'Show Type'}
          >
            <Type size={18} />
          </button>

          <button 
            onClick={() => setShowPhonetic(!showPhonetic)}
            className={`p-2.5 rounded-lg flex items-center justify-center transition-colors border shadow-sm ${
              showPhonetic 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={showPhonetic ? 'Hide Phonetic' : 'Show Phonetic'}
          >
            <span className="text-xs font-bold italic">/a/</span>
          </button>

          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded flex items-center justify-center transition-colors ${
                viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="List View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded flex items-center justify-center transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {sortedCards.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No cards to display.
        </div>
      ) : (
        <>
          <div className={
            viewMode === 'list' 
              ? "flex flex-col gap-4" 
              : "columns-1 sm:columns-2 lg:columns-3 gap-4"
          }>
            {displayedCards.map((card) => (
              <div key={card.id} className={`break-inside-avoid ${viewMode === 'grid' ? 'mb-4' : ''}`}>
                <FlashcardItem 
                  flashcard={card} 
                  viewMode={viewMode} 
                  showHighlights={showHighlights} 
                  showPartOfSpeech={showPartOfSpeech}
                  showPhonetic={showPhonetic}
                  isLocked={isLocked}
                />
              </div>
            ))}
          </div>
          
          {displayCount < sortedCards.length && (
            <div className="flex justify-center pt-6 pb-12">
              <button
                onClick={() => setDisplayCount(c => c + 50)}
                className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60 px-6 py-2.5 rounded-full font-medium transition-colors"
              >
                Load More ({sortedCards.length - displayCount} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

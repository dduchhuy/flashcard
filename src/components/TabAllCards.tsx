import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashcardStore, getCardTags } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { SelectDropdown } from './SelectDropdown'
import { LayoutGrid, List, Lightbulb, LightbulbOff, Tag as TagIcon, ChevronDown, Check, Lock, Unlock } from 'lucide-react'

type SortOption = 'date_desc' | 'date_asc' | 'a_z'

export function TabAllCards() {
  const { flashcards } = useFlashcardStore()
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [showHighlights, setShowHighlights] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false)
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
    if (selectedTags.length === 0) return flashcards
    return flashcards.filter(c => {
      const tags = getCardTags(c)
      return selectedTags.some(t => tags.includes(t))
    })
  }, [flashcards, selectedTags])

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'date_desc') return b.createdAt - a.createdAt
    if (sortBy === 'date_asc') return a.createdAt - b.createdAt
    if (sortBy === 'a_z') return a.sentence.localeCompare(b.sentence)
    return 0
  })

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm font-medium mr-1">Sort by:</span>
            <SelectDropdown
              value={sortBy}
              onChange={(v) => setSortBy(v as SortOption)}
              options={[
                { value: 'date_desc', label: 'Newest first' },
                { value: 'date_asc', label: 'Oldest first' },
                { value: 'a_z', label: 'A - Z' }
              ]}
              className="flex-1 sm:flex-none min-w-[140px]"
            />
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <TagIcon size={16} className="text-purple-500" />
              <span>{selectedTags.length === 0 ? 'All tags' : `${selectedTags.length} tags`}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            
            {isTagFilterOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden flex flex-col max-h-64">
                <div className="overflow-y-auto p-1">
                  <button
                    onClick={() => {
                      setSelectedTags([])
                      setIsTagFilterOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between ${
                      selectedTags.length === 0 ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>All tags</span>
                    {selectedTags.length === 0 && <Check size={14} />}
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
                        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between ${
                          isSelected ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="truncate">{tag}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border ${
              isLocked 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title="Toggle Lock Mode (Read text instead of editing)"
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
            <span className="hidden sm:inline">Lock</span>
          </button>

          <button 
            onClick={() => setShowHighlights(!showHighlights)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border ${
              showHighlights 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            {showHighlights ? <Lightbulb size={16} /> : <LightbulbOff size={16} />}
            <span className="hidden sm:inline">{showHighlights ? 'Hide Note' : 'Show Note'}</span>
          </button>

          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <List size={18} /> <span className="text-sm font-medium hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid size={18} /> <span className="text-sm font-medium hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {sortedCards.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No cards to display.
        </div>
      ) : (
        <div className={
          viewMode === 'list' 
            ? "flex flex-col gap-4" 
            : "columns-1 sm:columns-2 lg:columns-3 gap-4"
        }>
          {sortedCards.map((card) => (
            <div key={card.id} className={`break-inside-avoid ${viewMode === 'grid' ? 'mb-4' : ''}`}>
              <FlashcardItem 
                flashcard={card} 
                viewMode={viewMode} 
                showHighlights={showHighlights} 
                isLocked={isLocked}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

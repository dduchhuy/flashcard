import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashcardStore, getCardTags } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { SelectDropdown } from './SelectDropdown'
import { LayoutGrid, List, Lightbulb, LightbulbOff, Tag as TagIcon, ChevronDown, Check, Lock, Unlock } from 'lucide-react'

type SortOption = 'date_desc' | 'date_asc' | 'a_z' | 'tag'

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
    if (sortBy === 'tag') {
      const aTag = getCardTags(a)[0] || '\uffff'
      const bTag = getCardTags(b)[0] || '\uffff'
      if (aTag !== bTag) return aTag.localeCompare(bTag)
      return a.sentence.localeCompare(b.sentence)
    }
    return 0
  })

  return (
    <div className="space-y-4 animate-in fade-in">
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

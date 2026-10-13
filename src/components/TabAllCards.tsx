import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashcardStore, getCardTags, isWordCard, Flashcard, CardDisplayFilter, defaultDisplayFilter } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { 
  LayoutGrid, 
  List, 
  Tag as TagIcon, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Check, 
  Search, 
  SlidersHorizontal, 
  X, 
  RotateCcw, 
  Layers, 
  Sparkles, 
  Loader2,
  BookOpen
} from 'lucide-react'

export type SortOption = 'date_desc' | 'date_asc' | 'a_z' | 'tag'
export type SearchTarget = 'all' | 'word' | 'meaning' | 'example' | 'phrase' | 'usage'
export type ReadingMode = 'pagination' | 'load_more' | 'infinite_scroll'

export const FLASHCARD_SEARCH_TARGETS: { value: SearchTarget; label: string; desc: string }[] = [
  { value: 'word', label: 'English Word', desc: 'Search card headword' },
  { value: 'meaning', label: 'Vietnamese Meaning', desc: 'Search definition meanings' },
  { value: 'example', label: 'Examples (EN / VI)', desc: 'Search English examples and translations' },
  { value: 'phrase', label: 'Phrases & Idioms', desc: 'Search idioms and phrases' },
  { value: 'usage', label: 'Usage Notes', desc: 'Search card usage guidelines' },
]

export const SENTENCE_SEARCH_TARGETS: { value: SearchTarget; label: string; desc: string }[] = [
  { value: 'word', label: 'English Word / Sentence', desc: 'Search English text in sentence' },
  { value: 'meaning', label: 'Vietnamese Meaning', desc: 'Search sentence translation or notes' },
]

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'a_z', label: 'Alphabetical (A - Z)' },
  { value: 'tag', label: 'By Tag' },
]

export const PAGE_SIZE_OPTIONS = [20, 50, 100]

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '...')[] = [1]
  if (current > 3) {
    pages.push('...')
  }
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  if (current < total - 2) {
    pages.push('...')
  }
  pages.push(total)
  return pages
}

function SettingToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all select-none cursor-pointer ${
        checked
          ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
          : 'bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-750'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="pr-3 min-w-0 flex-1">
        <div className={`text-xs font-semibold ${checked ? 'text-purple-900 dark:text-purple-200' : 'text-gray-800 dark:text-gray-200'}`}>
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onChange(!checked)
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SettingCompactToggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
        checked
          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
      }`}
    >
      <span className="truncate pr-2">{label}</span>
      <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
        checked ? 'bg-purple-600 text-white' : 'border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
      }`}>
        {checked && <Check size={12} strokeWidth={3} />}
      </div>
    </button>
  )
}

export function TabAllCards() {
  const { flashcards } = useFlashcardStore()

  // 1. Core view states
  const [cardTypeFilter, setCardTypeFilter] = useState<'flashcard' | 'sentence'>('flashcard')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')

  // 2. Search & Tag filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTargets, setSearchTargets] = useState<SearchTarget[]>(['word'])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 3. Display filter states
  const [displayFilter, setDisplayFilter] = useState<CardDisplayFilter>(() => {
    try {
      const saved = localStorage.getItem('flashcard_display_filter')
      if (saved) {
        return { ...defaultDisplayFilter, ...JSON.parse(saved) }
      }
    } catch {}
    return defaultDisplayFilter
  })

  useEffect(() => {
    try {
      localStorage.setItem('flashcard_display_filter', JSON.stringify(displayFilter))
    } catch {}
  }, [displayFilter])

  // 4. Reading Mode & Pagination states (default: pagination - lightest)
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => {
    const saved = localStorage.getItem('flashcard_reading_mode')
    if (saved === 'pagination' || saved === 'load_more' || saved === 'infinite_scroll') return saved
    return 'pagination'
  })

  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem('flashcard_page_size'))
    if (saved === 20 || saved === 50 || saved === 100) return saved
    return 20
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [visibleCount, setVisibleCount] = useState<number>(pageSize)

  // 5. Settings modal open state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'layout' | 'search' | 'display'>('layout')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 6. Quick toolbar dropdown menus (Content Type, Layout, Tag)
  const [openQuickMenu, setOpenQuickMenu] = useState<'contentType' | 'layout' | 'tag' | null>(null)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const quickMenuRef = useRef<HTMLDivElement>(null)

  // Close quick menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setOpenQuickMenu(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenQuickMenu(null)
      }
    }
    if (openQuickMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openQuickMenu])

  // Persist reading mode and page size
  useEffect(() => {
    localStorage.setItem('flashcard_reading_mode', readingMode)
  }, [readingMode])

  useEffect(() => {
    localStorage.setItem('flashcard_page_size', String(pageSize))
  }, [pageSize])

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSettingsOpen])

  // Count cards by type
  const { flashcardCount, sentenceCount } = useMemo(() => {
    let f = 0, s = 0
    flashcards.forEach(c => {
      if (isWordCard(c)) f++
      else s++
    })
    return { flashcardCount: f, sentenceCount: s }
  }, [flashcards])

  // All unique tags
  const allAvailableTags = useMemo(() => {
    return Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).sort()
  }, [flashcards])

  // Filtered tags for quick tag popup
  const filteredMenuTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return allAvailableTags
    return allAvailableTags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase().trim()))
  }, [allAvailableTags, tagSearchQuery])

  // Filtered cards
  const filteredCards = useMemo(() => {
    // 1. Filter by card type: Flashcard (word) vs Sentence
    let result = flashcards.filter(c => {
      const isWord = isWordCard(c)
      return cardTypeFilter === 'flashcard' ? isWord : !isWord
    })

    // 2. Filter by tag
    if (selectedTags.length > 0) {
      result = result.filter(c => {
        const tags = getCardTags(c)
        return selectedTags.some(t => tags.includes(t))
      })
    }

    // 3. Filter by search query & search target
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const activeTargets = searchTargets.length > 0 ? searchTargets : ['word']
      result = result.filter(c => {
        const wordMatches = c.sentence.toLowerCase().includes(q)

        const meaningMatches = () => {
          if (c.translation && c.translation.toLowerCase().includes(q)) return true
          if (c.highlights?.some(h => h.meaning.toLowerCase().includes(q))) return true
          if (c.posEntries?.some(pos => pos.meanings.some(m => m.meaning.toLowerCase().includes(q)))) return true
          return false
        }

        const exampleMatches = () => {
          if (c.highlights?.some(h => h.example && h.example.toLowerCase().includes(q))) return true
          if (c.posEntries?.some(pos => pos.meanings.some(m =>
            m.examples?.some(ex =>
              ex.sentence.toLowerCase().includes(q) ||
              (ex.translation && ex.translation.toLowerCase().includes(q))
            )
          ))) return true
          return false
        }

        const phraseMatches = () => {
          if (c.phrasesAndIdioms?.some(pi => {
            const p = typeof pi === 'string' ? pi : pi.phrase
            const t = typeof pi === 'string' ? '' : pi.translation
            return p.toLowerCase().includes(q) || (t && t.toLowerCase().includes(q))
          })) return true
          return false
        }

        const usageMatches = () => {
          if (c.usageNotes?.some(u => u.toLowerCase().includes(q))) return true
          if (c.posEntries?.some(pos => pos.meanings.some(m => m.notes?.some(n => n.toLowerCase().includes(q))))) return true
          return false
        }

        return activeTargets.some(target => {
          if (target === 'word') return wordMatches
          if (target === 'meaning') return meaningMatches()
          if (target === 'example') return exampleMatches()
          if (target === 'phrase') return phraseMatches()
          if (target === 'usage') return usageMatches()
          if (target === 'all') return wordMatches || meaningMatches() || exampleMatches() || phraseMatches() || usageMatches()
          return false
        })
      })
    }
    return result
  }, [flashcards, cardTypeFilter, selectedTags, searchQuery, searchTargets])

  // Sorted cards
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
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
  }, [filteredCards, sortBy])

  // Grouped cards (group variants of same word together)
  const groupedCards = useMemo(() => {
    const groups: { primaryCard: Flashcard, siblings: Flashcard[] }[] = []
    const seenWords = new Map<string, { primaryCard: Flashcard, siblings: Flashcard[] }>()

    sortedCards.forEach(card => {
      const isWord = isWordCard(card)
      const key = isWord ? card.sentence.trim().toLowerCase() : card.id
      if (seenWords.has(key)) {
        seenWords.get(key)!.siblings.push(card)
      } else {
        const group = { primaryCard: card, siblings: [card] }
        seenWords.set(key, group)
        groups.push(group)
      }
    })
    return groups
  }, [sortedCards])

  // Keep searchTargets valid when switching to sentence mode
  useEffect(() => {
    if (cardTypeFilter === 'sentence') {
      setSearchTargets(prev => {
        const filtered = prev.filter(t => t === 'word' || t === 'meaning')
        return filtered.length > 0 ? filtered : ['word']
      })
    }
  }, [cardTypeFilter])

  const toggleSearchTarget = (target: SearchTarget) => {
    setSearchTargets(prev => {
      if (prev.includes(target)) {
        const next = prev.filter(t => t !== target)
        return next.length > 0 ? next : ['word']
      } else {
        return [...prev, target]
      }
    })
  }

  const searchPlaceholder = useMemo(() => {
    if (cardTypeFilter === 'sentence') {
      const hasWord = searchTargets.includes('word')
      const hasMeaning = searchTargets.includes('meaning')
      if (hasWord && hasMeaning) return 'Search sentence by English text or Vietnamese meaning...'
      if (hasMeaning) return 'Search sentence by Vietnamese meaning / translation...'
      return 'Search sentence by English text...'
    }
    const currentOptions = FLASHCARD_SEARCH_TARGETS.filter(o => searchTargets.includes(o.value))
    if (currentOptions.length === FLASHCARD_SEARCH_TARGETS.length) {
      return 'Search all fields (word, meaning, example, phrase, usage)...'
    }
    if (currentOptions.length === 0) return 'Search by English word...'
    return `Search by ${currentOptions.map(o => o.label).join(', ')}...`
  }, [cardTypeFilter, searchTargets])

  // Reset pagination / visible count when any filter changes
  useEffect(() => {
    setCurrentPage(1)
    setVisibleCount(pageSize)
  }, [searchQuery, searchTargets, selectedTags, sortBy, cardTypeFilter, pageSize, readingMode])

  // Calculate displayed cards
  const totalCards = groupedCards.length
  const totalPages = Math.max(1, Math.ceil(totalCards / pageSize))

  const displayedGroups = useMemo(() => {
    if (readingMode === 'pagination') {
      const start = (currentPage - 1) * pageSize
      return groupedCards.slice(start, start + pageSize)
    }
    return groupedCards.slice(0, visibleCount)
  }, [groupedCards, readingMode, currentPage, pageSize, visibleCount])

  // Infinite scroll observer
  useEffect(() => {
    if (readingMode !== 'infinite_scroll') return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => {
          if (prev < groupedCards.length) {
            return Math.min(prev + pageSize, groupedCards.length)
          }
          return prev
        })
      }
    }, { rootMargin: '250px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [readingMode, pageSize, groupedCards.length])

  // Page navigation with smooth scroll to top
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Display Filter Helpers
  const selectAllDisplayFilter = () => {
    setDisplayFilter({
      word: true,
      partOfSpeech: true,
      phonetic: true,
      meanings: {
        meaningText: true,
        meaningNotes: true,
        exampleSentence: true,
        exampleTranslation: true,
      },
      phrasesAndIdioms: {
        phrase: true,
        translation: true,
      },
      autoExpandPhrases: true,
      usageNotes: true,
      autoExpandUsage: true,
      relatedWords: {
        synonyms: true,
        antonyms: true,
        similarWords: true,
        similarSpellings: true,
        wordsContaining: true,
        wordsMentioning: true,
      },
      sentenceTranslation: true,
      sentenceHoverTooltip: true,
      clickWordToPopupCard: true,
    })
  }

  const resetDefaultDisplayFilter = () => {
    setDisplayFilter(defaultDisplayFilter)
  }

  const allMeaningsChecked = displayFilter.meanings.meaningText &&
    displayFilter.meanings.meaningNotes &&
    displayFilter.meanings.exampleSentence &&
    displayFilter.meanings.exampleTranslation

  const toggleAllMeanings = (checked: boolean) => {
    setDisplayFilter(prev => ({
      ...prev,
      meanings: {
        meaningText: checked,
        meaningNotes: checked,
        exampleSentence: checked,
        exampleTranslation: checked,
      }
    }))
  }

  const allPhrasesChecked = displayFilter.phrasesAndIdioms.phrase && displayFilter.phrasesAndIdioms.translation

  const toggleAllPhrases = (checked: boolean) => {
    setDisplayFilter(prev => ({
      ...prev,
      phrasesAndIdioms: {
        phrase: checked,
        translation: checked,
      }
    }))
  }

  const allRelatedChecked = Object.values(displayFilter.relatedWords).every(Boolean)

  const toggleAllRelated = (checked: boolean) => {
    setDisplayFilter(prev => ({
      ...prev,
      relatedWords: {
        synonyms: checked,
        antonyms: checked,
        similarWords: checked,
        similarSpellings: checked,
        wordsContaining: checked,
        wordsMentioning: checked,
      }
    }))
  }

  // Reset all filters to default
  const handleResetAll = () => {
    setCardTypeFilter('flashcard')
    setViewMode('list')
    setSortBy('date_desc')
    setSearchTargets(['word'])
    setSelectedTags([])
    setDisplayFilter(defaultDisplayFilter)
    setReadingMode('pagination')
    setPageSize(20)
    setCurrentPage(1)
    setVisibleCount(20)
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* 1. Sticky Search & Setting Toolbar */}
      <div className="sticky top-[57px] md:top-[61px] z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md py-3 -my-3 mb-3 border-b border-gray-200/50 dark:border-gray-800/50 transition-colors">
        <div className="flex items-center gap-2">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-0 flex items-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all">
            <div className="pl-3.5 pr-2 text-gray-400 flex items-center pointer-events-none">
              <Search size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full py-2.5 pr-3 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors font-bold text-lg leading-none"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Quick Controls: Content Type, Layout, Tag (visible when space permits: hidden md:flex) */}
          <div ref={quickMenuRef} className="hidden md:flex items-center gap-1.5 shrink-0">
            {/* 1. Quick Content Type Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenQuickMenu(prev => prev === 'contentType' ? null : 'contentType')}
                className={`h-11 px-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 border transition-all shrink-0 shadow-xs ${
                  openQuickMenu === 'contentType'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                    : cardTypeFilter === 'sentence'
                    ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80'
                }`}
                title="Content Type"
              >
                {cardTypeFilter === 'flashcard' ? (
                  <BookOpen size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                ) : (
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                )}
                <span className="font-semibold">{cardTypeFilter === 'flashcard' ? 'Flashcards' : 'Sentences'}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200 leading-none">
                  {cardTypeFilter === 'flashcard' ? flashcardCount : sentenceCount}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${openQuickMenu === 'contentType' ? 'rotate-180' : ''}`} />
              </button>

              {openQuickMenu === 'contentType' && (
                <div className="absolute top-full mt-2 left-0 min-w-[210px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Content Type
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCardTypeFilter('flashcard')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      cardTypeFilter === 'flashcard' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} />
                      <span>Flashcards</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold">
                        {flashcardCount}
                      </span>
                      {cardTypeFilter === 'flashcard' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCardTypeFilter('sentence')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      cardTypeFilter === 'sentence' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} />
                      <span>Sentences</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold">
                        {sentenceCount}
                      </span>
                      {cardTypeFilter === 'sentence' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 2. Quick Layout Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenQuickMenu(prev => prev === 'layout' ? null : 'layout')}
                className={`h-11 px-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 border transition-all shrink-0 shadow-xs ${
                  openQuickMenu === 'layout'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                    : viewMode === 'grid'
                    ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80'
                }`}
                title="Layout & View"
              >
                {viewMode === 'list' ? (
                  <List size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                ) : (
                  <LayoutGrid size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                )}
                <span className="font-semibold">{viewMode === 'list' ? 'List' : 'Grid'}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${openQuickMenu === 'layout' ? 'rotate-180' : ''}`} />
              </button>

              {openQuickMenu === 'layout' && (
                <div className="absolute top-full mt-2 left-0 min-w-[210px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Layout View
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('list')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      viewMode === 'list' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <List size={15} />
                      <span>List View</span>
                    </div>
                    {viewMode === 'list' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('grid')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      viewMode === 'grid' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid size={15} />
                      <span>Grid View</span>
                    </div>
                    {viewMode === 'grid' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                  </button>

                  <div className="my-1.5 border-t border-gray-100 dark:border-gray-700" />
                  <div className="px-3 py-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Reading Mode
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingMode('pagination')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      readingMode === 'pagination' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span>Pagination</span>
                    {readingMode === 'pagination' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingMode('load_more')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      readingMode === 'load_more' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span>Load More Button</span>
                    {readingMode === 'load_more' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingMode('infinite_scroll')
                      setOpenQuickMenu(null)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors ${
                      readingMode === 'infinite_scroll' ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span>Infinite Scroll</span>
                    {readingMode === 'infinite_scroll' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                  </button>
                </div>
              )}
            </div>

            {/* 3. Quick Tag Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenQuickMenu(prev => prev === 'tag' ? null : 'tag')}
                className={`h-11 px-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 border transition-all shrink-0 shadow-xs ${
                  openQuickMenu === 'tag' || selectedTags.length > 0
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80'
                }`}
                title="Filter by Tag"
              >
                <TagIcon size={15} className={selectedTags.length > 0 ? 'text-purple-600 dark:text-purple-400 shrink-0' : 'text-gray-400 shrink-0'} />
                <span className="font-semibold max-w-[110px] truncate">
                  {selectedTags.length === 0
                    ? 'Tags'
                    : selectedTags.length === 1
                    ? `#${selectedTags[0]}`
                    : `${selectedTags.length} Tags`}
                </span>
                {selectedTags.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white leading-none">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${openQuickMenu === 'tag' ? 'rotate-180' : ''}`} />
              </button>

              {openQuickMenu === 'tag' && (
                <div className="absolute top-full mt-2 right-0 md:left-auto md:right-0 lg:left-0 lg:right-auto min-w-[250px] max-w-[300px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-30 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700 mb-2.5">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <TagIcon size={13} className="text-purple-500" />
                      Filter by Tag
                    </span>
                    {selectedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Clear ({selectedTags.length})
                      </button>
                    )}
                  </div>

                  {allAvailableTags.length > 6 && (
                    <div className="mb-2">
                      <input
                        type="text"
                        value={tagSearchQuery}
                        onChange={(e) => setTagSearchQuery(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTags([])
                        setOpenQuickMenu(null)
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedTags.length === 0
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      All tags
                    </button>
                    {filteredMenuTags.length === 0 ? (
                      <div className="w-full py-2 text-center text-xs text-gray-400">
                        No tags found
                      </div>
                    ) : (
                      filteredMenuTags.map(tag => {
                        const isSelected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(prev => prev.filter(t => t !== tag))
                              } else {
                                setSelectedTags(prev => [...prev, tag])
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            <span>#{tag}</span>
                            {isSelected && <Check size={12} />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unified Settings & Filters Button */}
          <button
            type="button"
            onClick={() => {
              setIsSettingsOpen(true)
              setOpenQuickMenu(null)
            }}
            className={`h-11 px-3.5 sm:px-4 rounded-xl font-semibold text-sm flex items-center gap-2 border transition-all shrink-0 shadow-xs ${
              isSettingsOpen
                ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80'
            }`}
            title="Settings & Filters"
          >
            <SlidersHorizontal size={17} className={isSettingsOpen ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} />
            <span className="hidden sm:inline">Settings &amp; Filters</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Settings & Filters Modal / Panel */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="shrink-0 p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    Library Settings &amp; Filters
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Customize view layout, reading mode, search target and display filters
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-1 transition-colors"
                  title="Reset all settings to default"
                >
                  <RotateCcw size={13} />
                  <span className="hidden sm:inline">Reset All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Modal Tabs Navigation */}
            <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 px-4 sm:px-6 pt-2 gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSettingsTab('layout')}
                className={`pb-2.5 px-3.5 rounded-t-lg text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  settingsTab === 'layout'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-gray-800/90 shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>General &amp; Layout</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('search')}
                className={`pb-2.5 px-3.5 rounded-t-lg text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  settingsTab === 'search'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-gray-800/90 shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Search size={14} />
                <span>Search &amp; Sort</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('display')}
                className={`pb-2.5 px-3.5 rounded-t-lg text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  settingsTab === 'display'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-gray-800/90 shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Layers size={14} />
                <span>Display Filters</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: GENERAL & LAYOUT */}
              {settingsTab === 'layout' && (
                <div className="space-y-6">
                  {/* Content Type Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Content Type
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900/80 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700/80">
                      <button
                        type="button"
                        onClick={() => setCardTypeFilter('flashcard')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                          cardTypeFilter === 'flashcard'
                            ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <BookOpen size={16} />
                        <span>Flashcards</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardTypeFilter('sentence')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                          cardTypeFilter === 'sentence'
                            ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <Sparkles size={16} />
                        <span>Sentences</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Layout View (List vs Grid) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Card Layout View
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          viewMode === 'list'
                            ? 'border-2 border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          <List size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-xs font-bold ${viewMode === 'list' ? 'text-purple-900 dark:text-purple-200' : 'text-gray-900 dark:text-white'}`}>
                              List View
                            </span>
                            {viewMode === 'list' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                            Detailed row layout with full definitions, examples, and pronunciation.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          viewMode === 'grid'
                            ? 'border-2 border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          <LayoutGrid size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-xs font-bold ${viewMode === 'grid' ? 'text-purple-900 dark:text-purple-200' : 'text-gray-900 dark:text-white'}`}>
                              Grid View
                            </span>
                            {viewMode === 'grid' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                            Compact card grid for quick multi-column browsing and scanning.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Reading Mode (Loading) */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Reading &amp; Loading Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setReadingMode('pagination')}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          readingMode === 'pagination'
                            ? 'border-2 border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                              <Layers size={16} className="text-purple-600 dark:text-purple-400" />
                              <span>Pagination</span>
                            </div>
                            {readingMode === 'pagination' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                            Fixed cards per page with page numbers. Lightest &amp; fastest.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReadingMode('load_more')}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          readingMode === 'load_more'
                            ? 'border-2 border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                              <ChevronDown size={16} className="text-purple-600 dark:text-purple-400" />
                              <span>Load More</span>
                            </div>
                            {readingMode === 'load_more' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                            Displays a "Load More" button at the bottom of the list.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReadingMode('infinite_scroll')}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          readingMode === 'infinite_scroll'
                            ? 'border-2 border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                              <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                              <span>Infinite Scroll</span>
                            </div>
                            {readingMode === 'infinite_scroll' && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                            Smoothly loads new cards automatically as you scroll down.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Cards per page */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        Cards per page / load:
                      </span>
                      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                        {PAGE_SIZE_OPTIONS.map(sz => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setPageSize(sz)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              pageSize === sz
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                          >
                            {sz} cards
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SEARCH & SORT */}
              {settingsTab === 'search' && (
                <div className="space-y-6">
                  {/* Search Scope */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                        Search Target Scope
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Select which card fields are searched when typing in the search bar
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(cardTypeFilter === 'sentence' ? SENTENCE_SEARCH_TARGETS : FLASHCARD_SEARCH_TARGETS).map(opt => {
                        const isSelected = searchTargets.includes(opt.value)
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleSearchTarget(opt.value)}
                            className={`p-3 rounded-xl border text-left flex items-start justify-between gap-2.5 transition-all ${
                              isSelected
                                ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-2xs'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold leading-tight">{opt.label}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 font-normal mt-0.5">{opt.desc}</div>
                            </div>
                            <div className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-purple-600 text-white'
                                : 'border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sort Option */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                        Sort Order
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Arrange cards in library
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSortBy(opt.value)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-center transition-all ${
                            sortBy === opt.value
                              ? 'bg-purple-600 text-white shadow-xs font-bold'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags Filter */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                          <TagIcon size={13} className="text-purple-500" />
                          <span>Filter by Tags</span>
                        </label>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Show cards tagged with selected tags
                        </p>
                      </div>
                      {selectedTags.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTags([])}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTags.length === 0
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        All tags
                      </button>
                      {allAvailableTags.map(tag => {
                        const isSelected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(prev => prev.filter(t => t !== tag))
                              } else {
                                setSelectedTags(prev => [...prev, tag])
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <span>#{tag}</span>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DISPLAY FILTERS */}
              {settingsTab === 'display' && (
                <div className="space-y-4">
                  {/* Header with Quick Actions */}
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {cardTypeFilter === 'flashcard' ? 'Flashcard Display Filters' : 'Sentence Display Filters'}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Control which card sections and details are visible
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cardTypeFilter === 'flashcard' && (
                        <>
                          <button
                            type="button"
                            onClick={selectAllDisplayFilter}
                            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={resetDefaultDisplayFilter}
                        className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Defaults
                      </button>
                    </div>
                  </div>

                  {cardTypeFilter === 'flashcard' ? (
                    <div className="space-y-3.5">
                      {/* 1. Core Fields */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block">Core Information</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <SettingCompactToggle
                            checked={displayFilter.word}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, word: val }))}
                            label="English Word"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.partOfSpeech}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, partOfSpeech: val }))}
                            label="Part of Speech"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.phonetic}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, phonetic: val }))}
                            label="Phonetics"
                          />
                        </div>
                      </div>

                      {/* 2. Meanings & Examples */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Definitions &amp; Examples</span>
                          <button
                            type="button"
                            onClick={() => toggleAllMeanings(!allMeaningsChecked)}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            {allMeaningsChecked ? 'Uncheck all' : 'Check all'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <SettingCompactToggle
                            checked={displayFilter.meanings.meaningText}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, meanings: { ...prev.meanings, meaningText: val } }))}
                            label="Definition Text"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.meanings.meaningNotes}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, meanings: { ...prev.meanings, meaningNotes: val } }))}
                            label="Usage Notes of Definition"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.meanings.exampleSentence}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, meanings: { ...prev.meanings, exampleSentence: val } }))}
                            label="Example Sentences"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.meanings.exampleTranslation}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, meanings: { ...prev.meanings, exampleTranslation: val } }))}
                            label="Translation of Examples"
                          />
                        </div>
                      </div>

                      {/* 3. Phrases & Idioms */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Phrases &amp; Idioms</span>
                          <button
                            type="button"
                            onClick={() => toggleAllPhrases(!allPhrasesChecked)}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            {allPhrasesChecked ? 'Uncheck all' : 'Check all'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <SettingCompactToggle
                            checked={displayFilter.phrasesAndIdioms.phrase}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, phrasesAndIdioms: { ...prev.phrasesAndIdioms, phrase: val } }))}
                            label="Phrases & Idioms"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.phrasesAndIdioms.translation}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, phrasesAndIdioms: { ...prev.phrasesAndIdioms, translation: val } }))}
                            label="Translation"
                          />
                        </div>
                        <SettingToggleSwitch
                          checked={displayFilter.autoExpandPhrases ?? false}
                          onChange={val => setDisplayFilter(prev => ({ ...prev, autoExpandPhrases: val }))}
                          label="Always show phrases by default"
                          description="Automatically display phrases and idioms without needing to click to expand"
                        />
                      </div>

                      {/* 4. Usage Notes */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2.5">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block">Usage Notes</span>
                        <SettingToggleSwitch
                          checked={displayFilter.usageNotes}
                          onChange={val => setDisplayFilter(prev => ({ ...prev, usageNotes: val }))}
                          label="Show Usage Notes"
                          description="Display general word usage notes and tips"
                        />
                        <SettingToggleSwitch
                          checked={displayFilter.autoExpandUsage ?? false}
                          onChange={val => setDisplayFilter(prev => ({ ...prev, autoExpandUsage: val }))}
                          label="Always show usage notes by default"
                          description="Automatically display usage notes without needing to click to expand"
                        />
                      </div>

                      {/* 5. Related Words */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Related Words</span>
                          <button
                            type="button"
                            onClick={() => toggleAllRelated(!allRelatedChecked)}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            {allRelatedChecked ? 'Uncheck all' : 'Check all'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.synonyms}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, synonyms: val } }))}
                            label="Synonyms"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.antonyms}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, antonyms: val } }))}
                            label="Antonyms"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.similarWords}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, similarWords: val } }))}
                            label="Similar Words"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.similarSpellings}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, similarSpellings: val } }))}
                            label="Similar Spellings"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.wordsContaining}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, wordsContaining: val } }))}
                            label="Words Containing"
                          />
                          <SettingCompactToggle
                            checked={displayFilter.relatedWords.wordsMentioning}
                            onChange={val => setDisplayFilter(prev => ({ ...prev, relatedWords: { ...prev.relatedWords, wordsMentioning: val } }))}
                            label="Words Mentioning"
                          />
                        </div>
                      </div>

                      {/* 6. Interactivity */}
                      <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block">Card Interactivity</span>
                        <SettingToggleSwitch
                          checked={displayFilter.clickWordToPopupCard !== false}
                          onChange={val => setDisplayFilter(prev => ({ ...prev, clickWordToPopupCard: val }))}
                          label="Click Words to Open Flashcard Popup"
                          description="Click any English word in sentences and notes to view its full flashcard popup"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <SettingToggleSwitch
                        checked={displayFilter.sentenceTranslation !== false}
                        onChange={val => setDisplayFilter(prev => ({ ...prev, sentenceTranslation: val }))}
                        label="Sentence Translation / Meaning"
                        description="Display Vietnamese translation below the English sentence"
                      />
                      <SettingToggleSwitch
                        checked={displayFilter.sentenceHoverTooltip !== false}
                        onChange={val => setDisplayFilter(prev => ({ ...prev, sentenceHoverTooltip: val }))}
                        label="Hover Tooltip on Word Notes"
                        description="Display definition tooltip when hovering over annotated words in sentences"
                      />
                      <SettingToggleSwitch
                        checked={displayFilter.clickWordToPopupCard !== false}
                        onChange={val => setDisplayFilter(prev => ({ ...prev, clickWordToPopupCard: val }))}
                        label="Click Words to Open Flashcard Popup"
                        description="Click any English word in the sentence to view its full flashcard popup"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Matches: <strong className="text-gray-800 dark:text-gray-100">{groupedCards.length}</strong> cards
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cards Display List */}
      {sortedCards.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
          <p className="text-base font-semibold">No cards found matching your filters.</p>
          <p className="text-xs text-gray-400 mt-1">Try clearing some search terms or resetting settings.</p>
          <button
            type="button"
            onClick={handleResetAll}
            className="mt-4 px-4 py-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className={
            viewMode === 'list' 
              ? "flex flex-col gap-4 max-w-4xl mx-auto" 
              : "columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 2xl:columns-4 gap-4"
          }>
            {displayedGroups.map((group) => (
              <div key={group.primaryCard.id} className={`break-inside-avoid ${viewMode === 'grid' ? 'mb-4' : ''}`}>
                <FlashcardItem 
                  flashcard={group.primaryCard} 
                  siblingCards={group.siblings}
                  viewMode={viewMode} 
                  displayFilter={displayFilter}
                />
              </div>
            ))}
          </div>

          {/* 4. Reading Mode Controls: Pagination vs Load More vs Infinite Scroll */}
          
          {/* Mode A: Pagination (Default / Lightest) */}
          {readingMode === 'pagination' && totalPages > 1 && (
            <div className="pt-8 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 mt-6">
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
                Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-semibold text-gray-700 dark:text-gray-200">{Math.min(currentPage * pageSize, totalCards)}</span> of <span className="font-semibold text-gray-700 dark:text-gray-200">{totalCards}</span> cards
                <span className="mx-2">•</span>
                Page <span className="font-semibold text-gray-700 dark:text-gray-200">{currentPage}</span> of <span className="font-semibold text-gray-700 dark:text-gray-200">{totalPages}</span>
              </div>

              <div className="flex items-center gap-1 flex-wrap justify-center">
                {/* First Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(1)}
                  className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>

                {/* Prev Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                >
                  <ChevronLeft size={15} /> Prev
                </button>

                {/* Page Numbers */}
                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 select-none">...</span>
                  }
                  const pageNum = p as number
                  const isActive = pageNum === currentPage
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                {/* Next Page */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight size={15} />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(totalPages)}
                  className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Mode B: Load More */}
          {readingMode === 'load_more' && (
            <div className="pt-8 pb-12 flex flex-col items-center justify-center gap-3">
              {visibleCount < totalCards ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => Math.min(prev + pageSize, totalCards))}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-7 py-3 rounded-2xl font-bold text-xs shadow-md transition-all hover:shadow-lg flex items-center gap-2"
                  >
                    <span>Load More (+{Math.min(pageSize, totalCards - visibleCount)} cards)</span>
                    <ChevronDown size={16} />
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing {visibleCount} of {totalCards} cards
                  </p>
                </>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-4 flex items-center gap-2">
                  <span>✓ All {totalCards} cards loaded</span>
                </div>
              )}
            </div>
          )}

          {/* Mode C: Infinite Scroll */}
          {readingMode === 'infinite_scroll' && (
            <div className="pt-6 pb-12 flex flex-col items-center justify-center">
              {visibleCount < totalCards ? (
                <div ref={sentinelRef} className="py-6 flex flex-col items-center gap-2 text-gray-400 text-xs">
                  <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-400" />
                  <span>Loading more cards ({visibleCount} of {totalCards})...</span>
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-4 flex items-center gap-2">
                  <span>✓ End of list ({totalCards} cards)</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

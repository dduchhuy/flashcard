import { useState, useRef, useEffect, useMemo } from 'react'
import { Flashcard, useFlashcardStore, getCardTags, isWordCard as checkIsWordCard, normalizePhraseItem, CardDisplayFilter, defaultDisplayFilter } from '../store'
import { MoreVertical, Trash2, Edit2, Check, Tag, ChevronRight, Plus, Volume2, Highlighter } from 'lucide-react'
import { speakEnglish } from '../utils'
import { WordCardEditModal } from './WordCardEditModal'
import { CardDetailModal } from './CardDetailModal'
import { buildWordToFlashcardMap, findMatchingCard, ClickableSentence } from './ClickableSentence'

function normalizePos(pos: string): string {
  if (!pos) return ''
  const p = pos.trim().toLowerCase().replace(/[()[\].,]/g, '')
  if (p === 'n' || p === 'noun' || p.startsWith('noun')) return 'noun'
  if (p === 'v' || p === 'verb' || p.startsWith('verb')) return 'verb'
  if (p === 'adj' || p === 'adjective' || p.startsWith('adj')) return 'adjective'
  if (p === 'adv' || p === 'adverb' || p.startsWith('adv')) return 'adverb'
  if (p === 'prep' || p === 'preposition' || p.startsWith('prep')) return 'preposition'
  if (p === 'pron' || p === 'pronoun' || p.startsWith('pron')) return 'pronoun'
  if (p === 'conj' || p === 'conjunction' || p.startsWith('conj')) return 'conjunction'
  if (p === 'interj' || p === 'interjection' || p.startsWith('interj')) return 'interjection'
  return p
}

function cleanContextToPos(context: string): string {
  if (!context) return ''
  const c = context.toLowerCase()
  const found: string[] = []
  if (c.includes('danh từ') || c.includes('noun')) found.push('noun')
  if (c.includes('động từ') || c.includes('verb')) found.push('verb')
  if (c.includes('tính từ') || c.includes('adjective')) found.push('adjective')
  if (c.includes('trạng từ') || c.includes('phó từ') || c.includes('adverb')) found.push('adverb')
  if (c.includes('giới từ') || c.includes('preposition')) found.push('preposition')
  if (c.includes('liên từ') || c.includes('conjunction')) found.push('conjunction')
  if (c.includes('đại từ') || c.includes('pronoun')) found.push('pronoun')
  if (c.includes('thán từ') || c.includes('interjection')) found.push('interjection')

  if (found.length > 0) {
    return Array.from(new Set(found)).sort().join(', ')
  }
  if (/^(uk|us)$/i.test(context.trim())) return ''
  return context.trim()
}

function isPosMatching(
  groupPosLabel: string,
  groupItems: Array<{ pos?: string[] }>,
  targetPos: string
): boolean {
  if (!targetPos) return false
  const targetNorm = normalizePos(targetPos)
  const targetLower = targetPos.trim().toLowerCase()

  if (groupPosLabel) {
    const rawParts = groupPosLabel.split(/[,/;&]+/).map(s => s.trim().toLowerCase())
    for (const part of rawParts) {
      if (!part) continue
      const partNorm = normalizePos(part)
      if (
        part === targetLower ||
        partNorm === targetNorm ||
        part.includes(targetLower) ||
        targetLower.includes(part) ||
        partNorm.includes(targetNorm) ||
        targetNorm.includes(partNorm)
      ) {
        return true
      }
    }
  }

  for (const item of groupItems) {
    if (item.pos && item.pos.length > 0) {
      for (const p of item.pos) {
        const pLower = p.trim().toLowerCase()
        const pNorm = normalizePos(pLower)
        if (
          pLower === targetLower ||
          pNorm === targetNorm ||
          pLower.includes(targetLower) ||
          targetLower.includes(pLower) ||
          pNorm.includes(targetNorm) ||
          targetNorm.includes(pNorm)
        ) {
          return true
        }
      }
    }
  }

  return false
}

interface Props {
  flashcard: Flashcard
  siblingCards?: Flashcard[]
  viewMode?: 'list' | 'grid'
  showHighlights?: boolean
  showPartOfSpeech?: boolean
  showPhonetic?: boolean
  isLocked?: boolean
  displayFilter?: CardDisplayFilter
  initialEditingSentence?: boolean
}

type Segment = {
  type: 'normal' | 'editing' | 'highlight'
  indices: number[]
  highlightId?: string
  meaning?: string
}

export function FlashcardItem({
  flashcard,
  siblingCards,
  viewMode = 'list',
  showHighlights = true,
  showPartOfSpeech = true,
  showPhonetic = true,
  isLocked = false,
  displayFilter = defaultDisplayFilter,
  initialEditingSentence = false
}: Props) {
  const { deleteFlashcard, updateFlashcard, updateFlashcardTag, saveHighlight, removeHighlight, settings, flashcards } = useFlashcardStore()

  const allVariants = useMemo(() => {
    if (siblingCards && siblingCards.length > 0) return siblingCards
    return [flashcard]
  }, [siblingCards, flashcard])

  const [activeCardId, setActiveCardId] = useState<string>(flashcard.id)
  const [activePosIdx, setActivePosIdx] = useState<number>(0)
  const [userToggledPhrases, setUserToggledPhrases] = useState<boolean | null>(null)
  const [userToggledUsage, setUserToggledUsage] = useState<boolean | null>(null)

  const isPhrasesExpanded = userToggledPhrases !== null ? userToggledPhrases : Boolean(displayFilter?.autoExpandPhrases)
  const isUsageExpanded = userToggledUsage !== null ? userToggledUsage : Boolean(displayFilter?.autoExpandUsage)

  useEffect(() => {
    setActiveCardId(flashcard.id)
    setActivePosIdx(0)
    setUserToggledPhrases(null)
    setUserToggledUsage(null)
    if (initialEditingSentence) {
      setIsEditingSentence(true)
      setEditSentenceValue(flashcard.sentence)
      setEditTranslationValue(flashcard.translation || '')
      setEditPhoneticValue(flashcard.phonetic || '')
      setEditPartOfSpeechValue(flashcard.partOfSpeech || '')
      setEditUsageValue(flashcard.usageNotes?.[0] || '')
    }
  }, [flashcard.id, initialEditingSentence])

  const currentCard = allVariants.find(c => c.id === activeCardId) || flashcard

  const hasPosEntries = Boolean(currentCard.posEntries && currentCard.posEntries.length > 0)
  const posList = useMemo(() => {
    if (hasPosEntries) {
      return currentCard.posEntries!.map((p, idx) => ({
        key: p.id || String(idx),
        label: p.partOfSpeech,
        isActive: idx === activePosIdx,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          setActivePosIdx(idx)
        }
      }))
    }
    return allVariants.filter(v => v.partOfSpeech).map(v => ({
      key: v.id,
      label: v.partOfSpeech!,
      isActive: v.id === currentCard.id,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        setActiveCardId(v.id)
      }
    }))
  }, [hasPosEntries, currentCard.posEntries, activePosIdx, allVariants, currentCard.id])

  const activePosEntry = hasPosEntries ? (currentCard.posEntries![activePosIdx] || currentCard.posEntries![0]) : null
  const displayPhonetic = activePosEntry?.phonetic || currentCard.phonetic

  const phoneticGroups = useMemo<Array<{ key: string; posLabel: string; items: Array<{ ipa: string; dialect?: string; context?: string; pos?: string[] }> }>>(() => {
    if (currentCard.phonetics && currentCard.phonetics.length > 0) {
      const hasAnyPos = currentCard.phonetics.some(
        p => (p.pos && p.pos.length > 0) || (p.context && p.context.trim())
      )

      if (!hasAnyPos) {
        return [{
          key: 'all',
          posLabel: '',
          items: currentCard.phonetics
        }]
      }

      const groups: Array<{ key: string; posLabel: string; items: Array<{ ipa: string; dialect?: string; context?: string; pos?: string[] }> }> = []
      for (const p of currentCard.phonetics) {
        let label = ''
        if (p.pos && p.pos.length > 0) {
          label = p.pos.slice().sort().join(', ')
        } else if (p.context && p.context.trim()) {
          label = cleanContextToPos(p.context)
        }

        const key = (label || 'general').toLowerCase()
        let grp = groups.find(g => g.key === key)
        if (!grp) {
          grp = { key, posLabel: label, items: [] }
          groups.push(grp)
        }
        grp.items.push(p)
      }
      return groups
    }

    if (currentCard.posEntries && currentCard.posEntries.some(pe => pe.phonetic && pe.phonetic.trim())) {
      const groups: Array<{ key: string; posLabel: string; items: Array<{ ipa: string; dialect?: string; context?: string; pos?: string[] }> }> = []
      for (const pe of currentCard.posEntries) {
        if (pe.phonetic && pe.phonetic.trim()) {
          groups.push({
            key: pe.partOfSpeech.toLowerCase(),
            posLabel: pe.partOfSpeech,
            items: [{ ipa: pe.phonetic.trim(), pos: [pe.partOfSpeech] }]
          })
        }
      }
      if (groups.length > 0) return groups
    }

    if (currentCard.phonetic && currentCard.phonetic.trim()) {
      return [{
        key: 'single',
        posLabel: currentCard.partOfSpeech || '',
        items: [{ ipa: currentCard.phonetic.trim(), pos: currentCard.partOfSpeech ? [currentCard.partOfSpeech] : [] }]
      }]
    }

    return []
  }, [currentCard.phonetics, currentCard.posEntries, currentCard.phonetic, currentCard.partOfSpeech])

  const activePosName = useMemo(() => {
    const activeItem = posList.find(p => p.isActive)
    return (activeItem?.label || activePosEntry?.partOfSpeech || currentCard.partOfSpeech || '').trim()
  }, [posList, activePosEntry, currentCard.partOfSpeech])

  const handlePhoneticClick = (e: React.MouseEvent, group: typeof phoneticGroups[0]) => {
    e.stopPropagation()
    const matchingPosIndex = posList.findIndex(p => isPosMatching(group.posLabel, group.items, p.label))
    if (matchingPosIndex !== -1) {
      if (hasPosEntries) {
        setActivePosIdx(matchingPosIndex)
      } else {
        const targetCard = allVariants.find(v => v.partOfSpeech && isPosMatching(group.posLabel, group.items, v.partOfSpeech))
        if (targetCard) setActiveCardId(targetCard.id)
      }
    }
  }

  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [editingIndices, setEditingIndices] = useState<number[]>([])
  const [meaningInput, setMeaningInput] = useState('')
  
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select')
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [baseIndices, setBaseIndices] = useState<number[]>([])

  const [showMenu, setShowMenu] = useState(false)
  const [isEditingSentence, setIsEditingSentence] = useState(Boolean(initialEditingSentence))
  const [editSentenceValue, setEditSentenceValue] = useState(flashcard.sentence)
  const [editTranslationValue, setEditTranslationValue] = useState(flashcard.translation || '')
  const [editPhoneticValue, setEditPhoneticValue] = useState(flashcard.phonetic || '')
  const [editPartOfSpeechValue, setEditPartOfSpeechValue] = useState(flashcard.partOfSpeech || '')
  const [editUsageValue, setEditUsageValue] = useState(flashcard.usageNotes?.[0] || '')
  
  const [newTagValue, setNewTagValue] = useState('')
  
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)

  const isWordCard = checkIsWordCard(currentCard)
  const effectiveIsLocked = isWordCard ? false : isLocked
  const effectiveShowWord = displayFilter ? displayFilter.word : true
  const effectiveShowPos = displayFilter ? displayFilter.partOfSpeech : (showPartOfSpeech ?? true)
  const effectiveShowPhonetic = displayFilter ? displayFilter.phonetic : (showPhonetic ?? true)
  const effectiveShowHighlights = displayFilter
    ? (displayFilter.meanings.meaningText || displayFilter.meanings.meaningNotes || displayFilter.meanings.exampleSentence || displayFilter.meanings.exampleTranslation)
    : (showHighlights ?? true)
  const effectiveShowPhrases = displayFilter
    ? (displayFilter.phrasesAndIdioms.phrase || displayFilter.phrasesAndIdioms.translation)
    : true
  const effectiveShowUsage = displayFilter ? displayFilter.usageNotes : true
  const effectiveShowRelated = displayFilter ? Object.values(displayFilter.relatedWords).some(Boolean) : false

  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [popupCard, setPopupCard] = useState<Flashcard | null>(null)
  const [isWordEditModalOpen, setIsWordEditModalOpen] = useState(false)

  const flashcardWordMap = useMemo(() => {
    return buildWordToFlashcardMap(flashcards)
  }, [flashcards])

  const [lockedDragStart, setLockedDragStart] = useState<number | null>(null)
  const [lockedDragIndices, setLockedDragIndices] = useState<number[]>([])

  const commitCurrentEdit = () => {
    if (editingIndices.length === 0 || !meaningInput.trim()) {
      if (editingHighlightId) {
        removeHighlight(flashcard.id, editingHighlightId)
      }
    }
  }

  const handleCloseEditing = () => {
    commitCurrentEdit()
    setEditingIndices([])
    setEditingHighlightId(null)
    setMeaningInput('')
    setDragStartIndex(null)
    setBaseIndices([])
  }

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      
      if (itemRef.current && !itemRef.current.contains(e.target as Node)) {
        if (editingIndices.length > 0 || editingHighlightId) {
          handleCloseEditing()
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingIndices.length > 0 || editingHighlightId) {
          handleCloseEditing()
        }
        if (isEditingSentence) {
          setIsEditingSentence(false)
        }
      }
    }

    document.addEventListener('mousedown', handleGlobalClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingIndices, editingHighlightId, meaningInput, flashcard.id, isEditingSentence])

  const sentenceToTokenize = isEditingSentence ? editSentenceValue : flashcard.sentence
  const parts = sentenceToTokenize.trim().split(/(\s+)/)
  const words: string[] = []
  const spaces: string[] = []
  let initialSpace = ""
  
  for (let i = 0; i < parts.length; i += 2) {
    let w = parts[i]
    let s = parts[i + 1] || ""

    if (/^[.,!?;:"'()[\]{}<>]+$/.test(w)) {
      words.push(w)
      spaces.push(s)
      continue
    }

    const matchLeading = w.match(/^([.,!?;:"'()[\]{}<>]+)(.*)$/)
    if (matchLeading) {
      if (words.length > 0) {
        spaces[spaces.length - 1] += matchLeading[1]
      } else {
        initialSpace += matchLeading[1]
      }
      w = matchLeading[2]
    }

    const matchTrailing = w.match(/^(.*?)([.,!?;:"'()[\]{}<>]+)$/)
    if (matchTrailing) {
      w = matchTrailing[1]
      s = matchTrailing[2] + s
    }

    words.push(w)
    spaces.push(s)
  }

  const segments: Segment[] = []
  let currentSegment: Segment | null = null

  for (let i = 0; i < words.length; i++) {
    const isEditing = editingIndices.includes(i)
    const highlight = showHighlights 
      ? flashcard.highlights.find(h => h.wordIndices.includes(i) && h.id !== editingHighlightId)
      : undefined

    let targetType: 'normal' | 'editing' | 'highlight' = 'normal'
    let targetId: string | undefined = undefined
    let targetMeaning: string | undefined = undefined

    if (isEditing) {
      targetType = 'editing'
    } else if (highlight) {
      targetType = 'highlight'
      targetId = highlight.id
      targetMeaning = highlight.meaning
    }

    if (currentSegment && currentSegment.type === targetType && currentSegment.highlightId === targetId) {
      currentSegment.indices.push(i)
    } else {
      if (currentSegment) segments.push(currentSegment)
      currentSegment = { type: targetType, indices: [i], highlightId: targetId, meaning: targetMeaning }
    }
  }
  if (currentSegment) segments.push(currentSegment)


  const handlePointerDown = (e: React.PointerEvent) => {
    if (viewMode === 'grid') return

    const target = e.target as HTMLElement
    try { target.releasePointerCapture(e.pointerId) } catch (err) {}

    const span = target.closest('span[data-index]')
    if (!span) return
    const index = parseInt(span.getAttribute('data-index')!, 10)

    // Lock mode: collect words for TTS instead of editing
    if (effectiveIsLocked) {
      setLockedDragStart(index)
      setLockedDragIndices([index])
      return
    }

    const existing = flashcard.highlights.find(h => h.wordIndices.includes(index))
      
    let initialBase = [...editingIndices]
    let newDragMode: 'select' | 'deselect' = 'select'

    if (editingIndices.length > 0) {
      if (editingIndices.includes(index)) {
        if (editingIndices.length === 1) {
          handleCloseEditing()
          return
        } else {
          newDragMode = 'deselect'
        }
      } else {
        if (existing && existing.id !== editingHighlightId) {
          commitCurrentEdit()
          setEditingHighlightId(existing.id)
          initialBase = [...existing.wordIndices]
          setMeaningInput(existing.meaning)
          newDragMode = 'select'
        } else {
          // Clicked a plain word while editing -> EXTEND the current note
          initialBase = [...editingIndices]
          newDragMode = 'select'
        }
      }
    } else {
      if (existing) {
        setEditingHighlightId(existing.id)
        initialBase = [...existing.wordIndices]
        setMeaningInput(existing.meaning)
      } else {
        setEditingHighlightId(null)
        initialBase = []
        setMeaningInput('')
      }
      newDragMode = 'select'
    }

    setDragMode(newDragMode)
    setDragStartIndex(index)
    setBaseIndices(initialBase)
    setIsDragging(true)
      
    if (newDragMode === 'select') {
      setEditingIndices(Array.from(new Set([...initialBase, index])).sort((a,b)=>a-b))
    } else {
      setEditingIndices(initialBase.filter(i => i !== index).sort((a,b)=>a-b))
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    // Lock mode: track drag range for TTS
    if (effectiveIsLocked && lockedDragStart !== null) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const span = el?.closest('span[data-index]')
      if (span) {
        const currentIndex = parseInt(span.getAttribute('data-index')!, 10)
        const start = Math.min(lockedDragStart, currentIndex)
        const end = Math.max(lockedDragStart, currentIndex)
        const range: number[] = []
        for (let i = start; i <= end; i++) range.push(i)
        setLockedDragIndices(range)
      }
      return
    }

    if (!isDragging || dragStartIndex === null) return
    
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const span = el?.closest('span[data-index]')
    
    if (span) {
      const currentIndex = parseInt(span.getAttribute('data-index')!, 10)
      
      const start = Math.min(dragStartIndex, currentIndex)
      const end = Math.max(dragStartIndex, currentIndex)
      
      const range = new Set<number>()
      for (let i = start; i <= end; i++) range.add(i)

      if (dragMode === 'select') {
        const newSet = new Set(baseIndices)
        range.forEach(i => newSet.add(i))
        setEditingIndices(Array.from(newSet).sort((a,b)=>a-b))
      } else {
        setEditingIndices(baseIndices.filter(i => !range.has(i)).sort((a,b)=>a-b))
      }
    }
  }

  const handlePointerUp = () => {
    // Lock mode: speak the collected word/phrase
    if (effectiveIsLocked && lockedDragStart !== null) {
      const phrase = lockedDragIndices.map(i => words[i]).join(' ')
      if (phrase.trim()) speakEnglish(phrase)
      setLockedDragStart(null)
      setLockedDragIndices([])
      return
    }

    if (isDragging) {
      setIsDragging(false)
      setDragStartIndex(null)
      if (editingIndices.length > 0 && meaningInput.trim()) {
        const newId = saveHighlight(flashcard.id, editingHighlightId, editingIndices, meaningInput)
        if (newId !== editingHighlightId) {
          setEditingHighlightId(newId)
        }
      }
    }
  }

  const handleMeaningChange = (val: string) => {
    setMeaningInput(val)
    if (editingIndices.length > 0) {
      const newId = saveHighlight(flashcard.id, editingHighlightId, editingIndices, val)
      if (newId !== editingHighlightId) {
        setEditingHighlightId(newId)
      }
    }
  }

  const handleSaveSentence = () => {
    const newUsage = editUsageValue.trim() ? [editUsageValue.trim()] : []
    const usageChanged = JSON.stringify(newUsage) !== JSON.stringify(flashcard.usageNotes || [])
    const transChanged = editTranslationValue.trim() !== (flashcard.translation || '')
    if (editSentenceValue.trim() && (
      editSentenceValue !== flashcard.sentence || 
      editPhoneticValue !== flashcard.phonetic || 
      editPartOfSpeechValue !== flashcard.partOfSpeech || 
      transChanged || 
      usageChanged
    )) {
      updateFlashcard(
        flashcard.id, 
        editSentenceValue.trim(), 
        editPhoneticValue.trim(), 
        editPartOfSpeechValue.trim(), 
        newUsage, 
        editTranslationValue.trim() || undefined
      )
      setEditingIndices([])
    }
    setIsEditingSentence(false)
  }

  return (
    <div 
      ref={itemRef} 
      onClick={isWordCard ? () => { setPopupCard(currentCard); setIsPopupOpen(true); } : undefined}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow relative flex flex-col transition-colors ${isWordCard ? 'cursor-pointer hover:shadow-md border border-transparent hover:border-purple-200 dark:hover:border-purple-800/50' : ''} ${viewMode === 'grid' ? 'p-4 h-fit' : 'p-5'}`}
    >
      
      <div className="absolute top-3 right-3" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <MoreVertical size={20} />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-100 rounded-lg shadow-lg z-20 py-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Close the card detail popup before opening the edit modal
                setIsPopupOpen(false)
                setPopupCard(null)
                if (isWordCard) {
                  setIsWordEditModalOpen(true)
                } else {
                  setEditSentenceValue(flashcard.sentence)
                  setEditTranslationValue(flashcard.translation || '')
                  setEditPhoneticValue(flashcard.phonetic || '')
                  setEditPartOfSpeechValue(flashcard.partOfSpeech || '')
                  setEditUsageValue(flashcard.usageNotes?.[0] || '')
                  setIsEditingSentence(true)
                }
                setShowMenu(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit2 size={16} /> Edit
            </button>
            <div className="relative group/tag">
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()} // Prevent closing menu on mobile touch
              >
                <div className="flex items-center gap-2">
                  <Tag size={16} /> Tag
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
              
              <div className="absolute right-full top-0 mr-1 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl hidden group-hover/tag:flex flex-col z-30 overflow-hidden cursor-default">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const input = newTagValue.trim()
                      if (input) {
                        const currentTags = getCardTags(flashcard)
                        // Add new tag if not already there, supporting comma separated
                        const newTags = Array.from(new Set([...currentTags, ...input.split(',').map(t => t.trim()).filter(Boolean)]))
                        updateFlashcardTag(flashcard.id, newTags.join(','))
                        setNewTagValue('')
                      }
                    }}
                    className="flex gap-1"
                  >
                    <input
                      type="text"
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      placeholder="Add tag (comma separated)..."
                      className="flex-1 text-sm p-1.5 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-400"
                    />
                    <button type="submit" className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-800/50">
                      <Plus size={16} />
                    </button>
                  </form>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).length === 0 ? (
                    <div className="text-xs text-gray-400 p-2 text-center">No existing tags</div>
                  ) : (
                    Array.from(new Set(flashcards.flatMap(c => getCardTags(c)))).filter(Boolean).map(tag => {
                      const hasTag = getCardTags(flashcard).includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation()
                            const currentTags = getCardTags(flashcard)
                            if (hasTag) {
                              updateFlashcardTag(flashcard.id, currentTags.filter(t => t !== tag).join(','))
                            } else {
                              updateFlashcardTag(flashcard.id, [...currentTags, tag].join(','))
                            }
                          }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded flex items-center justify-between ${
                            hasTag ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className="truncate">{tag}</span>
                          {hasTag && <Check size={14} />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => deleteFlashcard(flashcard.id)}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={16} /> Delete card
            </button>
          </div>
        )}
      </div>

      <div className={`mt-2 ${viewMode === 'list' ? 'mr-6' : 'mr-4'} flex-1`}>
        {isEditingSentence ? (
          <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
            <textarea
              autoFocus
              value={editSentenceValue}
              onChange={(e) => setEditSentenceValue(e.target.value)}
              className="w-full p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg resize-none"
              rows={3}
            />
            <input
              value={editTranslationValue}
              onChange={(e) => setEditTranslationValue(e.target.value)}
              placeholder="Sentence translation / Meaning (optional)"
              className="w-full p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={editPartOfSpeechValue}
                onChange={(e) => setEditPartOfSpeechValue(e.target.value)}
                placeholder="Part of speech (e.g. noun)"
                className="w-full sm:w-1/3 p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <input
                value={editPhoneticValue}
                onChange={(e) => setEditPhoneticValue(e.target.value)}
                placeholder="Phonetic (optional)"
                className="w-full sm:w-1/3 p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <input
                value={editUsageValue}
                onChange={(e) => setEditUsageValue(e.target.value)}
                placeholder="Usage note (optional)"
                className="w-full sm:w-1/3 p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>

            {/* Word Notes & Highlights Editor */}
            <div className="mt-2 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/60 dark:border-purple-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  Word Notes &amp; Highlights (Select text in sentence to annotate):
                </span>
                {editingIndices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCloseEditing}
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancel selection
                  </button>
                )}
              </div>

              {/* Interactive sentence for word highlighting */}
              <div 
                className="leading-relaxed touch-none select-none text-base p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-text dark:text-gray-200"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {initialSpace}
                {segments.map((seg, sIdx) => {
                  let segClass = "relative transition-colors px-0.5 rounded "
                  if (seg.type === 'editing') {
                    segClass += "bg-purple-200 text-purple-900 border-b-2 border-purple-500 font-medium"
                  } else if (seg.type === 'highlight') {
                    segClass += "font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 cursor-pointer"
                  } else {
                    segClass += "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  }
                  return (
                    <span key={sIdx}>
                      <span className={segClass}>
                        {seg.indices.map((idx, i) => (
                          <span key={idx}>
                            <span data-index={idx}>{words[idx]}</span>
                            {i < seg.indices.length - 1 && spaces[idx]}
                          </span>
                        ))}
                      </span>
                      {sIdx < segments.length - 1 && spaces[seg.indices[seg.indices.length - 1]]}
                    </span>
                  )
                })}
              </div>

              {/* Note input when words are selected */}
              {editingIndices.length > 0 && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={meaningInput}
                    onChange={(e) => handleMeaningChange(e.target.value)}
                    placeholder={`Meaning / note for "${editingIndices.map(i => words[i]).join(' ')}"...`}
                    className="flex-1 text-sm p-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCloseEditing()
                      }
                      if (e.key === 'Escape') handleCloseEditing()
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCloseEditing}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* List of existing notes with Delete button */}
              {flashcard.highlights.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Notes on this sentence:</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {flashcard.highlights.map(h => {
                      const noteText = h.wordIndices.map(i => words[i] || '').filter(Boolean).join(' ') || 'Note'
                      const isCurrentEditing = editingHighlightId === h.id
                      return (
                        <div
                          key={h.id}
                          className={`flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                            isCurrentEditing
                              ? 'bg-purple-100/70 dark:bg-purple-900/40 border-purple-300 dark:border-purple-600'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div
                            className="min-w-0 truncate flex-1 cursor-pointer"
                            onClick={() => {
                              setEditingIndices(h.wordIndices)
                              setEditingHighlightId(h.id)
                              setMeaningInput(h.meaning)
                            }}
                            title="Click to edit this note"
                          >
                            <span className="font-semibold text-purple-700 dark:text-purple-300">
                              {noteText}:
                            </span>{' '}
                            <span className="text-gray-600 dark:text-gray-300 italic">{h.meaning}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIndices(h.wordIndices)
                                setEditingHighlightId(h.id)
                                setMeaningInput(h.meaning)
                              }}
                              className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                              title="Edit note"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (editingHighlightId === h.id) {
                                  handleCloseEditing()
                                }
                                removeHighlight(flashcard.id, h.id)
                              }}
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Delete note"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  handleCloseEditing()
                  setIsEditingSentence(false)
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSentence}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1"
              >
                <Check size={16} /> Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`flex ${isWordCard ? 'items-center' : 'items-start'} gap-2`}>
              <div 
                className={`leading-relaxed touch-none select-none ${
                isWordCard ? 'truncate' : 'whitespace-pre-wrap break-words'
              } ${
                viewMode === 'grid' ? 'text-lg cursor-pointer' : (isWordCard ? 'text-xl cursor-pointer' : 'text-xl cursor-default')
              } dark:text-gray-200`}
              onClick={viewMode === 'grid' ? () => speakEnglish(flashcard.sentence) : (isWordCard ? () => { setPopupCard(currentCard); setIsPopupOpen(true); } : undefined)}
            >
              {effectiveShowWord ? (
                <>
                  {initialSpace}
                  {segments.map((seg, sIdx) => {
                    // Convert hex to rgb string for inline style
                    const hexToRgb = (hex: string) => {
                      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '216, 180, 254'
                    }

                    const isHovered = hoveredHighlightId && seg.highlightId === hoveredHighlightId
                    
                    let segmentClass = "relative transition-colors px-0.5 rounded "
                    let inlineStyle: React.CSSProperties = {}

                    if (seg.type === 'editing') {
                      segmentClass += "bg-purple-200 text-purple-900 border-b-2 border-purple-500 font-medium"
                    } else if (seg.type === 'highlight' && !isWordCard) {
                      segmentClass += "font-medium group cursor-pointer "
                      if (settings.highlightMode === 'text') {
                        inlineStyle = { 
                          color: isHovered ? settings.hoverColor : settings.highlightColor,
                          backgroundColor: 'transparent'
                        }
                      } else {
                        const bgColor = isHovered 
                          ? `rgba(${hexToRgb(settings.hoverColor)}, ${settings.hoverOpacity})`
                          : `rgba(${hexToRgb(settings.highlightColor)}, ${settings.highlightOpacity})`
                        inlineStyle = { backgroundColor: bgColor, color: settings.highlightTextColor || (settings.isDarkMode ? '#f3f4f6' : '#374151') }
                      }
                    } else {
                      segmentClass += "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    }

                    return (
                      <span key={sIdx}>
                        <span 
                          className={segmentClass}
                          style={inlineStyle}
                          onMouseEnter={() => {
                            if (seg.type === 'highlight') {
                              setHoveredHighlightId(seg.highlightId!)
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredHighlightId(null)
                          }}
                        >
                          {seg.indices.map((idx, i) => {
                            const word = words[idx]
                            const matchedCard = findMatchingCard(word, flashcardWordMap)
                            const canClickWord = !isWordCard && !isEditingSentence && editingIndices.length === 0 && (displayFilter?.clickWordToPopupCard !== false) && !!matchedCard

                            return (
                              <span key={idx}>
                                <span 
                                  data-index={idx}
                                  onClick={canClickWord ? (e) => {
                                    e.stopPropagation()
                                    setPopupCard(matchedCard!)
                                    setIsPopupOpen(true)
                                  } : undefined}
                                  title={canClickWord ? `Flashcard: ${matchedCard!.sentence}` : undefined}
                                  className={`${effectiveIsLocked && lockedDragIndices.includes(idx) ? 'bg-blue-200 text-blue-900 rounded px-0.5' : ''} ${canClickWord ? 'cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors' : ''}`}
                                >{word}</span>
                                {i < seg.indices.length - 1 && spaces[idx]}
                              </span>
                            )
                          })}

                          {seg.type === 'highlight' && !isWordCard && editingIndices.length === 0 && (displayFilter?.sentenceHoverTooltip !== false) && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max max-w-[200px] pointer-events-none">
                              <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm py-1.5 px-3 rounded-lg shadow-lg text-center break-words whitespace-pre-wrap text-left">
                                {seg.meaning}
                                <svg className="absolute text-gray-100 dark:text-gray-700 h-2 w-full left-0 top-full drop-shadow-sm" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                              </div>
                            </div>
                          )}
                        </span>
                        {sIdx < segments.length - 1 && spaces[seg.indices[seg.indices.length - 1]]}
                      </span>
                    )
                  })}
                </>
              ) : (
                <span className="font-mono tracking-widest text-gray-400 dark:text-gray-500 italic select-none">
                  ••••••••
                </span>
              )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  speakEnglish(currentCard.sentence)
                }}
                className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors shrink-0"
                title="Listen"
              >
                <Volume2 size={18} />
              </button>
              {!isWordCard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditSentenceValue(flashcard.sentence)
                    setEditTranslationValue(flashcard.translation || '')
                    setEditPhoneticValue(flashcard.phonetic || '')
                    setEditPartOfSpeechValue(flashcard.partOfSpeech || '')
                    setEditUsageValue(flashcard.usageNotes?.[0] || '')
                    setIsEditingSentence(true)
                  }}
                  className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors shrink-0"
                  title="Add / Edit notes on words"
                >
                  <Highlighter size={16} />
                </button>
              )}
            </div>
            {((effectiveShowPos && posList.length > 0) || (effectiveShowPhonetic && (phoneticGroups.length > 0 || displayPhonetic))) && (
              <div className="mt-1.5 flex flex-col gap-1 break-words overflow-hidden">
                {effectiveShowPos && posList.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {posList.map(p => {
                      if (!p.label) return null
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={p.onClick}
                          className={`text-sm italic transition-all ${
                            p.isActive
                              ? 'font-bold text-gray-800 dark:text-gray-100'
                              : 'font-normal text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Phonetics on Card: Horizontal Row with Flex-Wrap and Distinct Capsules */}
                {effectiveShowPhonetic && (
                  phoneticGroups.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {phoneticGroups.map(group => {
                        const isMatchingActive = Boolean(activePosName && isPosMatching(group.posLabel, group.items, activePosName))
                        return (
                          <div
                            key={group.key}
                            onClick={(e) => handlePhoneticClick(e, group)}
                            role="button"
                            tabIndex={0}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs transition-all cursor-pointer select-none ${
                              isMatchingActive
                                ? 'border-purple-300 dark:border-purple-700/70 bg-purple-50/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300'
                                : 'border-gray-200/60 dark:border-gray-700/60 bg-transparent text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            title={group.posLabel ? `Filter: ${group.posLabel}` : undefined}
                          >
                            {group.posLabel && (
                              <span className={`text-[10px] uppercase tracking-wider ${
                                isMatchingActive ? 'font-semibold text-purple-700 dark:text-purple-300' : 'font-normal text-gray-400 dark:text-gray-500'
                              }`}>
                                {group.posLabel}:
                              </span>
                            )}
                            <div className="inline-flex items-center gap-1.5 flex-wrap">
                              {group.items.map((p, pIdx) => {
                                const dialectUpper = (p.dialect || '').toUpperCase()
                                return (
                                  <span key={pIdx} className="inline-flex items-center gap-1">
                                    {pIdx > 0 && <span className="text-gray-300 dark:text-gray-600">•</span>}
                                    {dialectUpper && (
                                      <span className={`text-[9px] px-1 py-0.2 rounded font-sans ${
                                        isMatchingActive
                                          ? 'font-medium bg-purple-100/70 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                          : 'font-normal bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                      }`}>
                                        {dialectUpper}
                                      </span>
                                    )}
                                    <span className={`font-mono text-[11px] ${
                                      isMatchingActive
                                        ? 'font-medium text-purple-900 dark:text-purple-200'
                                        : 'font-normal text-gray-500 dark:text-gray-400'
                                    }`}>
                                      /{p.ipa.replace(/^\/|\/$/g, '')}/
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : displayPhonetic ? (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-lg border text-xs bg-gray-50/60 dark:bg-gray-800/40 border-gray-200/60 dark:border-gray-700/60 font-mono text-gray-500 dark:text-gray-400 mt-1">
                      /{displayPhonetic.replace(/^\/|\/$/g, '')}/
                    </div>
                  ) : null
                )}
              </div>
            )}
          </>
        )}
      </div>

      {effectiveShowHighlights && (
        <div className="mt-4 space-y-3">
          {isWordCard ? (
            hasPosEntries && activePosEntry ? (
              <>
                {activePosEntry.meanings.slice(0, viewMode === 'grid' ? 1 : 2).map((m, mIdx) => {
                  const showMeaningText = displayFilter ? displayFilter.meanings.meaningText : true
                  const showMeaningNotes = displayFilter ? displayFilter.meanings.meaningNotes : true
                  const showExSentence = displayFilter ? displayFilter.meanings.exampleSentence : true
                  const showExTrans = displayFilter ? displayFilter.meanings.exampleTranslation : true

                  const hasVisibleContent = showMeaningText || (showMeaningNotes && m.notes && m.notes.length > 0) || ((showExSentence || showExTrans) && m.examples && m.examples.length > 0)
                  if (!hasVisibleContent) return null

                  return (
                    <div key={m.id || mIdx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                      {showMeaningText && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-1">{m.meaning}</div>
                          {m.labels && m.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 shrink-0">
                              {m.labels.map((lbl, lIdx) => (
                                <span key={lIdx} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {showMeaningNotes && m.notes && m.notes.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic mb-1.5">
                          {m.notes.join(' ')}
                        </div>
                      )}
                      {(showExSentence || showExTrans) && m.examples && m.examples.length > 0 && (
                        <div className="space-y-1.5 mt-1.5">
                          {m.examples.slice(0, viewMode === 'grid' ? 1 : 2).map((ex, exIdx) => (
                            <div key={ex.id || exIdx} className="text-sm">
                              {showExSentence && (
                                <div className="text-gray-600 dark:text-gray-300">
                                  <ClickableSentence
                                    sentence={ex.sentence}
                                    enabled={displayFilter?.clickWordToPopupCard !== false}
                                    flashcardWordMap={flashcardWordMap}
                                    currentCardId={currentCard.id}
                                    onWordClick={(matched) => {
                                      setPopupCard(matched)
                                      setIsPopupOpen(true)
                                    }}
                                  />
                                </div>
                              )}
                              {showExTrans && ex.translation && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">{ex.translation}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {activePosEntry.meanings.length > (viewMode === 'grid' ? 1 : 2) && (
                  <div className="text-xs text-gray-400 font-medium italic mt-2 ml-1">
                    ... (and {activePosEntry.meanings.length - (viewMode === 'grid' ? 1 : 2)} more meanings)
                  </div>
                )}
              </>
            ) : null
          ) : (
            displayFilter?.sentenceTranslation !== false && (currentCard.translation || (currentCard.highlights?.find(h => h.wordIndices.length >= words.length)?.meaning)) ? (
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300 italic bg-gray-50/70 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                {currentCard.translation || currentCard.highlights?.find(h => h.wordIndices.length >= words.length)?.meaning}
              </div>
            ) : null
          )}

          {/* Phrases & Idioms on Card */}
          {isWordCard && effectiveShowPhrases && currentCard.phrasesAndIdioms && currentCard.phrasesAndIdioms.length > 0 && viewMode === 'list' && (
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setUserToggledPhrases(!isPhrasesExpanded)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium flex items-center gap-1"
              >
                {isPhrasesExpanded ? 'Hide' : 'Show'} Phrases &amp; Idioms ({currentCard.phrasesAndIdioms.length})
              </button>
              {isPhrasesExpanded && (
                <div className="mt-2 space-y-1.5 pl-2.5 border-l-2 border-purple-200 dark:border-purple-800">
                  {currentCard.phrasesAndIdioms.map((pi, piIdx) => {
                    const norm = normalizePhraseItem(pi)
                    const showP = displayFilter ? displayFilter.phrasesAndIdioms.phrase : true
                    const showT = displayFilter ? displayFilter.phrasesAndIdioms.translation : true
                    if (!showP && !showT) return null
                    return (
                      <div key={norm.id || piIdx} className="text-xs">
                        {showP && (
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            <ClickableSentence
                              sentence={norm.phrase}
                              enabled={displayFilter?.clickWordToPopupCard !== false}
                              flashcardWordMap={flashcardWordMap}
                              currentCardId={currentCard.id}
                              onWordClick={(matched) => {
                                setPopupCard(matched)
                                setIsPopupOpen(true)
                              }}
                            />
                          </span>
                        )}
                        {showT && norm.translation && (
                          <span className={`text-gray-500 dark:text-gray-400 ${showP ? 'ml-1.5' : ''}`}>
                            {showP ? '→ ' : ''}{norm.translation}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Usage notes on Card */}
          {isWordCard && effectiveShowUsage && currentCard.usageNotes && currentCard.usageNotes.length > 0 && viewMode === 'list' && (
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setUserToggledUsage(!isUsageExpanded)}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium flex items-center gap-1"
              >
                <span>💡 {isUsageExpanded ? 'Hide' : 'Show'} Usage ({currentCard.usageNotes.length})</span>
              </button>
              {isUsageExpanded && (
                <div className="mt-2 space-y-1.5 pl-2.5 border-l-2 border-amber-300 dark:border-amber-700 text-xs text-gray-700 dark:text-gray-300">
                  {currentCard.usageNotes.map((note, nIdx) => (
                    <div key={nIdx} className="bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/40 dark:border-amber-800/40">
                      <ClickableSentence
                        sentence={note}
                        enabled={displayFilter?.clickWordToPopupCard !== false}
                        flashcardWordMap={flashcardWordMap}
                        currentCardId={currentCard.id}
                        onWordClick={(matched) => {
                          setPopupCard(matched)
                          setIsPopupOpen(true)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Related words on Card */}
          {isWordCard && effectiveShowRelated && currentCard.relatedWords && (() => {
            const renderRelatedBadge = (w: string, idx: number) => {
              const matched = findMatchingCard(w, flashcardWordMap)
              const isClickable = (displayFilter?.clickWordToPopupCard !== false) && !!matched && matched.id !== currentCard.id
              return (
                <span
                  key={idx}
                  onClick={isClickable ? (e) => {
                    e.stopPropagation()
                    setPopupCard(matched!)
                    setIsPopupOpen(true)
                  } : undefined}
                  title={isClickable ? `Flashcard: ${matched!.sentence}` : undefined}
                  className={`px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50 text-[11px] font-medium transition-colors ${
                    isClickable ? 'cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/60' : ''
                  }`}
                >
                  {w}
                </span>
              )
            }

            return (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 space-y-2">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Related Words:</div>
                
                {displayFilter?.relatedWords.synonyms && currentCard.relatedWords.synonyms && currentCard.relatedWords.synonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Synonyms:</span>
                    {currentCard.relatedWords.synonyms.map(renderRelatedBadge)}
                  </div>
                )}

                {displayFilter?.relatedWords.antonyms && currentCard.relatedWords.antonyms && currentCard.relatedWords.antonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Antonyms:</span>
                    {currentCard.relatedWords.antonyms.map(renderRelatedBadge)}
                  </div>
                )}

                {displayFilter?.relatedWords.similarWords && currentCard.relatedWords.similarWords && currentCard.relatedWords.similarWords.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Similar words:</span>
                    {currentCard.relatedWords.similarWords.map(renderRelatedBadge)}
                  </div>
                )}

                {displayFilter?.relatedWords.similarSpellings && currentCard.relatedWords.similarSpellings && currentCard.relatedWords.similarSpellings.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Similar spellings:</span>
                    {currentCard.relatedWords.similarSpellings.map(renderRelatedBadge)}
                  </div>
                )}

                {displayFilter?.relatedWords.wordsContaining && currentCard.relatedWords.wordsContaining && currentCard.relatedWords.wordsContaining.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Words containing:</span>
                    {currentCard.relatedWords.wordsContaining.map(renderRelatedBadge)}
                  </div>
                )}

                {displayFilter?.relatedWords.wordsMentioning && currentCard.relatedWords.wordsMentioning && currentCard.relatedWords.wordsMentioning.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">Words mentioning:</span>
                    {currentCard.relatedWords.wordsMentioning.map(renderRelatedBadge)}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
        <span className="text-xs text-gray-400 font-medium">
          {new Date(flashcard.createdAt).toLocaleDateString('en-US')}
        </span>
        <div className="flex items-center gap-3 justify-end max-w-[70%]">
          {getCardTags(flashcard).length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {getCardTags(flashcard).map(t => (
                <span key={t} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <CardDetailModal
        card={popupCard || currentCard}
        isOpen={isPopupOpen}
        clickWordToPopupCard={displayFilter?.clickWordToPopupCard !== false}
        onClose={() => {
          setIsPopupOpen(false)
          setPopupCard(null)
        }}
        onEdit={(cardToEdit) => {
          setIsPopupOpen(false)
          setPopupCard(null)
          if (isWordCard) {
            setIsWordEditModalOpen(true)
          } else {
            setEditSentenceValue(cardToEdit.sentence)
            setEditTranslationValue(cardToEdit.translation || '')
            setEditPhoneticValue(cardToEdit.phonetic || '')
            setEditPartOfSpeechValue(cardToEdit.partOfSpeech || '')
            setEditUsageValue(cardToEdit.usageNotes?.[0] || '')
            setIsEditingSentence(true)
          }
        }}
      />

      <WordCardEditModal
        card={currentCard}
        isOpen={isWordEditModalOpen}
        onClose={() => setIsWordEditModalOpen(false)}
      />
    </div>
  )
}

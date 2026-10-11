import { useState, useRef, useEffect, useMemo } from 'react'
import { Flashcard, useFlashcardStore, getCardTags, isWordCard as checkIsWordCard } from '../store'
import { MoreVertical, Trash2, Edit2, Check, Tag, ChevronRight, Plus, Volume2 } from 'lucide-react'
import { speakEnglish } from '../utils'
import { WordCardEditModal } from './WordCardEditModal'

interface Props {
  flashcard: Flashcard
  siblingCards?: Flashcard[]
  viewMode?: 'list' | 'grid'
  showHighlights?: boolean
  showPartOfSpeech?: boolean
  showPhonetic?: boolean
  isLocked?: boolean
}

type Segment = {
  type: 'normal' | 'editing' | 'highlight'
  indices: number[]
  highlightId?: string
  meaning?: string
}

export function FlashcardItem({ flashcard, siblingCards, viewMode = 'list', showHighlights = true, showPartOfSpeech = true, showPhonetic = true, isLocked = false }: Props) {
  const { deleteFlashcard, updateFlashcard, updateFlashcardTag, saveHighlight, removeHighlight, settings, flashcards } = useFlashcardStore()

  const wordKey = flashcard.sentence.trim().toLowerCase()
  const allVariants = useMemo(() => {
    if (siblingCards && siblingCards.length > 0) return siblingCards
    return flashcards.filter(f => f.sentence.trim().toLowerCase() === wordKey)
  }, [siblingCards, flashcards, wordKey])

  const [activeCardId, setActiveCardId] = useState<string>(flashcard.id)
  const [activePosIdx, setActivePosIdx] = useState<number>(0)
  const [showPhrases, setShowPhrases] = useState(false)

  useEffect(() => {
    setActiveCardId(flashcard.id)
    setActivePosIdx(0)
  }, [flashcard.id])

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

  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [editingIndices, setEditingIndices] = useState<number[]>([])
  const [meaningInput, setMeaningInput] = useState('')
  
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select')
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [baseIndices, setBaseIndices] = useState<number[]>([])

  const [showMenu, setShowMenu] = useState(false)
  const [isEditingSentence, setIsEditingSentence] = useState(false)
  const [editSentenceValue, setEditSentenceValue] = useState(flashcard.sentence)
  const [editPhoneticValue, setEditPhoneticValue] = useState(flashcard.phonetic || '')
  const [editPartOfSpeechValue, setEditPartOfSpeechValue] = useState(flashcard.partOfSpeech || '')
  
  const [newTagValue, setNewTagValue] = useState('')
  
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)

  const isWordCard = checkIsWordCard(currentCard)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [isWordEditModalOpen, setIsWordEditModalOpen] = useState(false)

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

  const parts = flashcard.sentence.trim().split(/(\s+)/)
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
    if (isEditingSentence || viewMode === 'grid') return

    const target = e.target as HTMLElement
    try { target.releasePointerCapture(e.pointerId) } catch (err) {}

    const span = target.closest('span[data-index]')
    if (!span) return
    const index = parseInt(span.getAttribute('data-index')!, 10)

    // Lock mode: collect words for TTS instead of editing
    if (isLocked) {
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
    if (isLocked && lockedDragStart !== null) {
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
    if (isLocked && lockedDragStart !== null) {
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
    if (editSentenceValue.trim() && (editSentenceValue !== flashcard.sentence || editPhoneticValue !== flashcard.phonetic || editPartOfSpeechValue !== flashcard.partOfSpeech)) {
      updateFlashcard(flashcard.id, editSentenceValue.trim(), editPhoneticValue.trim(), editPartOfSpeechValue.trim())
      setEditingIndices([])
    }
    setIsEditingSentence(false)
  }

  return (
    <div 
      ref={itemRef} 
      onClick={isWordCard ? () => setIsPopupOpen(true) : undefined}
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
              onClick={() => {
                if (isWordCard) {
                  setIsWordEditModalOpen(true)
                } else {
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
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={editPartOfSpeechValue}
                onChange={(e) => setEditPartOfSpeechValue(e.target.value)}
                placeholder="Part of speech (e.g. noun)"
                className="w-full sm:w-1/2 p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <input
                value={editPhoneticValue}
                onChange={(e) => setEditPhoneticValue(e.target.value)}
                placeholder="Phonetic (optional)"
                className="w-full sm:w-1/2 p-2 border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingSentence(false)}
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
            <div 
              className={`leading-relaxed touch-none select-none ${
              isWordCard ? 'truncate' : 'whitespace-pre-wrap break-words'
            } ${
              viewMode === 'grid' ? 'text-lg cursor-pointer' : 'text-xl cursor-text'
            } dark:text-gray-200`}
            onPointerDown={viewMode === 'grid' || isWordCard ? undefined : handlePointerDown}
            onPointerMove={viewMode === 'grid' || isWordCard ? undefined : handlePointerMove}
            onPointerUp={viewMode === 'grid' || isWordCard ? undefined : handlePointerUp}
            onPointerCancel={viewMode === 'grid' || isWordCard ? undefined : handlePointerUp}
            onClick={viewMode === 'grid' ? () => speakEnglish(flashcard.sentence) : (isWordCard ? () => setIsPopupOpen(true) : undefined)}
          >
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
                    {seg.indices.map((idx, i) => (
                      <span key={idx}>
                        <span 
                          data-index={idx}
                          className={isLocked && lockedDragIndices.includes(idx) ? 'bg-blue-200 text-blue-900 rounded px-0.5' : ''}
                        >{words[idx]}</span>
                        {i < seg.indices.length - 1 && spaces[idx]}
                      </span>
                    ))}

                    {seg.type === 'highlight' && !isWordCard && editingIndices.length === 0 && (
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
            </div>
            {((showPartOfSpeech && posList.length > 0) || (showPhonetic && displayPhonetic)) && (
              <div className="mt-1.5 flex flex-col gap-0.5 break-words overflow-hidden">
                {showPartOfSpeech && posList.length > 0 && (
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
                {showPhonetic && displayPhonetic && (
                  <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                    {displayPhonetic}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {editingIndices.length > 0 && !isEditingSentence && viewMode === 'list' && (
        <div className="mt-4 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-3 shadow-inner animate-in fade-in zoom-in-95 duration-200">
          <div className="flex gap-2 relative">
            <textarea
              autoFocus
              value={meaningInput}
              onChange={(e) => handleMeaningChange(e.target.value)}
              placeholder="Enter meaning (Shift+Enter for new line)..."
              className="flex-1 text-base p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none placeholder-gray-400 dark:placeholder-gray-400"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCloseEditing()
                }
                if (e.key === 'Escape') handleCloseEditing()
              }}
            />
          </div>
        </div>
      )}

      {isWordCard && showHighlights && (
        <div className="mt-4 space-y-3">
          {hasPosEntries && activePosEntry ? (
            <>
              {activePosEntry.meanings.slice(0, viewMode === 'grid' ? 1 : 2).map((m, mIdx) => (
                <div key={m.id || mIdx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-1">{m.meaning}</div>
                  {m.examples && m.examples.length > 0 && (
                    <div className="space-y-1.5 mt-1.5">
                      {m.examples.slice(0, viewMode === 'grid' ? 1 : 2).map((ex, exIdx) => (
                        <div key={ex.id || exIdx} className="text-sm">
                          <div className="text-gray-600 dark:text-gray-300 italic">{ex.sentence}</div>
                          {ex.translation && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 not-italic mt-0.5">{ex.translation}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {activePosEntry.meanings.length > (viewMode === 'grid' ? 1 : 2) && (
                <div className="text-xs text-gray-400 font-medium italic mt-2 ml-1">
                  ... (and {activePosEntry.meanings.length - (viewMode === 'grid' ? 1 : 2)} more meanings)
                </div>
              )}
            </>
          ) : (
            <>
              {(currentCard.highlights || []).slice(0, viewMode === 'grid' ? 1 : 2).map(h => (
                <div key={h.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-1">{h.meaning}</div>
                  {h.example && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 italic flex items-start gap-2">
                      {h.example}
                    </div>
                  )}
                </div>
              ))}
              {(currentCard.highlights || []).length > (viewMode === 'grid' ? 1 : 2) && (
                <div className="text-xs text-gray-400 font-medium italic mt-2 ml-1">
                  ... (and {(currentCard.highlights || []).length - (viewMode === 'grid' ? 1 : 2)} more meanings)
                </div>
              )}
            </>
          )}

          {currentCard.phrasesAndIdioms && currentCard.phrasesAndIdioms.length > 0 && viewMode === 'list' && (
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowPhrases(!showPhrases)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium flex items-center gap-1"
              >
                {showPhrases ? 'Hide' : 'Show'} Phrases &amp; Idioms ({currentCard.phrasesAndIdioms.length})
              </button>
              {showPhrases && (
                <div className="mt-2 space-y-1.5 pl-2.5 border-l-2 border-purple-200 dark:border-purple-800">
                  {currentCard.phrasesAndIdioms.map((pi, piIdx) => (
                    <div key={pi.id || piIdx} className="text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{pi.phrase}</span>
                      {pi.translation && <span className="text-gray-500 dark:text-gray-400 ml-1.5">→ {pi.translation}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
          <button 
            onClick={(e) => { e.stopPropagation(); speakEnglish(flashcard.sentence); }}
            className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Read sentence"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </div>

       {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in" onPointerDown={() => setIsPopupOpen(false)}>
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onPointerDown={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                 <div className="flex flex-col gap-1 flex-1 pr-4">
                   {/* Line 1: Word */}
                   <div className="flex items-center gap-2">
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize break-words">
                       {currentCard.sentence}
                     </h2>
                     <button
                       onClick={() => speakEnglish(currentCard.sentence)}
                       className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full transition-colors"
                       title="Listen"
                     >
                       <Volume2 size={20} />
                     </button>
                   </div>

                   {/* Line 2: Parts of speech (clickable to switch) */}
                   {posList.length > 0 && (
                     <div className="flex items-center gap-2 flex-wrap mt-0.5">
                       {posList.map(p => {
                         if (!p.label) return null
                         return (
                           <button
                             key={p.key}
                             type="button"
                             onClick={p.onClick}
                             className={`text-sm italic px-2 py-0.5 rounded transition-all ${
                               p.isActive
                                 ? 'font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600'
                                 : 'font-normal text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                             }`}
                           >
                             {p.label}
                           </button>
                         )
                       })}
                     </div>
                   )}

                   {/* Line 3: Phonetic */}
                   {displayPhonetic && (
                     <div className="text-base italic text-gray-400 dark:text-gray-500 font-normal">
                       {displayPhonetic}
                     </div>
                   )}
                 </div>

                 <button 
                   onClick={(e) => { e.stopPropagation(); setIsPopupOpen(false); }}
                   onPointerDown={(e) => { e.stopPropagation(); setIsPopupOpen(false); }} 
                   className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                   title="Close"
                 >
                   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
              </div>

              {/* Meanings & Examples */}
              <div className="space-y-4">
                {hasPosEntries && activePosEntry ? (
                  activePosEntry.meanings.map((m, mIdx) => (
                    <div key={m.id || mIdx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700">
                      <div className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-1.5">{m.meaning}</div>
                      {m.examples && m.examples.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {m.examples.map((ex, exIdx) => (
                            <div key={ex.id || exIdx} className="bg-white/60 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-100/80 dark:border-gray-600/40">
                              <div className="text-sm text-gray-700 dark:text-gray-200 italic flex items-start justify-between gap-2">
                                <span>"{ex.sentence}"</span>
                                <button
                                  onClick={() => speakEnglish(ex.sentence)}
                                  className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-0.5 rounded transition-colors shrink-0"
                                  title="Listen example"
                                >
                                  <Volume2 size={15} />
                                </button>
                              </div>
                              {ex.translation && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-1">
                                  {ex.translation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  (currentCard.highlights || []).map(h => (
                    <div key={h.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                      <div className="font-medium text-gray-800 dark:text-gray-200 text-base mb-1">{h.meaning}</div>
                      {h.example && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 italic flex items-start gap-2">
                          {h.example}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Phrases & Idioms Section */}
              {currentCard.phrasesAndIdioms && currentCard.phrasesAndIdioms.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="font-bold text-gray-800 dark:text-gray-200 text-base mb-2.5 flex items-center gap-2">
                    <span>Phrases &amp; Idioms</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-normal">
                      {currentCard.phrasesAndIdioms.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {currentCard.phrasesAndIdioms.map((pi, piIdx) => (
                      <div key={pi.id || piIdx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                            {pi.phrase}
                          </div>
                          {pi.translation && (
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                              {pi.translation}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => speakEnglish(pi.phrase)}
                          className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-full transition-colors shrink-0"
                          title="Listen"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      <WordCardEditModal
        card={currentCard}
        isOpen={isWordEditModalOpen}
        onClose={() => setIsWordEditModalOpen(false)}
      />
    </div>
  )
}

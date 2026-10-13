import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Flashcard, useFlashcardStore, getCardTags, normalizePhraseItem } from '../store'
import { Volume2, X, Pin } from 'lucide-react'
import { speakEnglish } from '../utils'
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

export interface CardDetailModalProps {
  card?: Flashcard | null
  isOpen?: boolean
  clickWordToPopupCard?: boolean
  onClose: () => void
}

export function CardDetailModal({
  card,
  isOpen = true,
  clickWordToPopupCard,
  onClose
}: CardDetailModalProps) {
  const { flashcards } = useFlashcardStore()
  const [navigatedCard, setNavigatedCard] = useState<Flashcard | null>(null)
  const [cardHistory, setCardHistory] = useState<Flashcard[]>([])
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [activePosIdx, setActivePosIdx] = useState<number>(0)
  const [isHeaderPinned, setIsHeaderPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('card_popup_header_pinned') === 'true'
    } catch {
      return false
    }
  })
  const [isDetailsHidden, setIsDetailsHidden] = useState<boolean>(false)

  const effectiveClickWord = clickWordToPopupCard ?? (() => {
    try {
      const saved = localStorage.getItem('flashcard_display_filter')
      if (saved) return JSON.parse(saved).clickWordToPopupCard !== false
    } catch {}
    return true
  })()

  const flashcardWordMap = useMemo(() => {
    return buildWordToFlashcardMap(flashcards)
  }, [flashcards])

  const togglePin = () => {
    setIsHeaderPinned(prev => {
      const next = !prev
      try {
        localStorage.setItem('card_popup_header_pinned', String(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    if (card) {
      setNavigatedCard(null)
      setCardHistory([])
      setActiveCardId(card.id)
      setActivePosIdx(0)
      setIsDetailsHidden(false)
    }
  }, [card?.id])

  const effectiveBaseCard = navigatedCard || card

  const navigateToCard = (target: Flashcard) => {
    if (currentCard) {
      setCardHistory(prev => [...prev, currentCard])
    }
    setNavigatedCard(target)
    setActiveCardId(target.id)
    setActivePosIdx(0)
    setIsDetailsHidden(false)
  }

  const handleBack = () => {
    if (cardHistory.length === 0) return
    const prevCard = cardHistory[cardHistory.length - 1]
    setCardHistory(prev => prev.slice(0, prev.length - 1))
    setNavigatedCard(prevCard)
    setActiveCardId(prevCard.id)
    setActivePosIdx(0)
    setIsDetailsHidden(false)
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  const wordKey = effectiveBaseCard?.sentence ? effectiveBaseCard.sentence.trim().toLowerCase() : ''
  const siblings = useMemo(() => {
    if (!wordKey) return effectiveBaseCard ? [effectiveBaseCard] : []
    const sibs = flashcards.filter(f => f.sentence.trim().toLowerCase() === wordKey)
    return sibs.length > 0 ? sibs : (effectiveBaseCard ? [effectiveBaseCard] : [])
  }, [flashcards, wordKey, effectiveBaseCard])

  const currentCard = useMemo(() => {
    if (!effectiveBaseCard) return null
    return siblings.find(s => s.id === activeCardId) || effectiveBaseCard
  }, [siblings, activeCardId, effectiveBaseCard])

  const hasPosEntries = Boolean(currentCard?.posEntries && currentCard.posEntries.length > 0)

  const posList = useMemo(() => {
    if (!currentCard) return []
    if (hasPosEntries) {
      return currentCard.posEntries!.map((p, idx) => ({
        key: p.id || String(idx),
        label: p.partOfSpeech,
        isActive: idx === activePosIdx,
        onClick: () => setActivePosIdx(idx),
      }))
    }
    return siblings
      .filter(s => s.partOfSpeech)
      .map(sib => ({
        key: sib.id,
        label: sib.partOfSpeech!,
        isActive: sib.id === currentCard.id,
        onClick: () => setActiveCardId(sib.id),
      }))
  }, [hasPosEntries, currentCard, activePosIdx, siblings])

  const activePosEntry = hasPosEntries && currentCard?.posEntries
    ? (currentCard.posEntries[activePosIdx] || currentCard.posEntries[0])
    : null

  const displayPhonetic = activePosEntry?.phonetic || currentCard?.phonetic

  const phoneticGroups = useMemo<Array<{ key: string; posLabel: string; items: Array<{ ipa: string; dialect?: string; context?: string; pos?: string[] }> }>>(() => {
    if (!currentCard) return []

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
  }, [currentCard])

  const activePosName = useMemo(() => {
    if (!currentCard) return ''
    const activeItem = posList.find(p => p.isActive)
    return (activeItem?.label || activePosEntry?.partOfSpeech || currentCard.partOfSpeech || '').trim()
  }, [posList, activePosEntry, currentCard])

  const handlePhoneticClick = (e: React.MouseEvent, group: typeof phoneticGroups[0]) => {
    e.stopPropagation()
    const matchingPosIndex = posList.findIndex(p => isPosMatching(group.posLabel, group.items, p.label))
    if (matchingPosIndex !== -1) {
      if (hasPosEntries) {
        setActivePosIdx(matchingPosIndex)
      } else {
        const targetCard = siblings.find(v => v.partOfSpeech && isPosMatching(group.posLabel, group.items, v.partOfSpeech))
        if (targetCard) setActiveCardId(targetCard.id)
      }
    }
  }

  if (!isOpen || !card || !currentCard) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8 bg-black/60 backdrop-blur-xs animate-in fade-in" 
      onPointerDown={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-3xl w-[96vw] sm:w-[92vw] md:w-[86vw] lg:w-[82vw] max-w-6xl h-[92vh] sm:h-[88vh] md:h-[84vh] flex flex-col shadow-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden" 
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Modal Header (Sticky at top) */}
        <div 
          className="shrink-0 p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-200"
          onMouseEnter={() => {
            if (!isHeaderPinned) {
              setIsDetailsHidden(false)
            }
          }}
        >
          {/* Top Line: Word + Speaker + Pin + Close */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
              {cardHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1.5 rounded-xl border border-purple-200/60 dark:border-purple-800/60 hover:bg-purple-100 transition-colors shrink-0"
                  title={`Back to ${cardHistory[cardHistory.length - 1].sentence}`}
                >
                  ← Back
                </button>
              )}
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white capitalize break-words tracking-tight">
                {currentCard.sentence}
              </h2>
              <button
                type="button"
                onClick={() => speakEnglish(currentCard.sentence)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                title="Listen English pronunciation"
              >
                <Volume2 size={20} />
              </button>

              {/* Inline collapsed preview: Tag & Active POS */}
              {!isHeaderPinned && isDetailsHidden && (
                <div className="flex items-center gap-1.5 flex-wrap ml-1 animate-in fade-in">
                  {activePosName && (
                    <span className="text-xs italic px-2.5 py-0.5 rounded-lg font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200/60 dark:border-purple-800/60">
                      {activePosName}
                    </span>
                  )}
                  {getCardTags(currentCard).map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right Action Controls: Pin + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={togglePin}
                className={`p-2 rounded-xl transition-colors ${
                  isHeaderPinned
                    ? 'bg-gray-200/90 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
                title={isHeaderPinned ? 'Pin details (always visible)' : 'Unpin details (auto-hide on scroll)'}
              >
                <Pin size={18} className={isHeaderPinned ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose() }}
                onPointerDown={(e) => { e.stopPropagation(); onClose() }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                title="Close"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Collapsible Details Area: Tags + POS + Phonetics */}
          <div
            className={`transition-all duration-200 ease-in-out ${
              !isHeaderPinned && isDetailsHidden
                ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mt-0'
                : 'max-h-[500px] opacity-100 overflow-visible mt-2.5'
            }`}
          >
            {/* Tags */}
            {getCardTags(currentCard).length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {getCardTags(currentCard).map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Line 2: Parts of speech buttons (clickable to switch) */}
            {posList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">POS:</span>
                {posList.map(p => {
                  if (!p.label) return null
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={p.onClick}
                      className={`text-sm italic px-3 py-1 rounded-xl transition-all ${
                        p.isActive
                          ? 'font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700'
                          : 'font-normal text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-50/80 dark:bg-gray-800/60 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Line 3: Phonetics grouped by POS */}
            {phoneticGroups.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {phoneticGroups.map(group => {
                  const isMatching = Boolean(activePosName && isPosMatching(group.posLabel, group.items, activePosName))
                  return (
                    <div
                      key={group.key}
                      onClick={(e) => handlePhoneticClick(e, group)}
                      role="button"
                      tabIndex={0}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs transition-all cursor-pointer select-none ${
                        isMatching
                          ? 'border-purple-300 dark:border-purple-700/70 bg-purple-50/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300'
                          : 'border-gray-200/60 dark:border-gray-700/60 bg-transparent text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      title={group.posLabel ? `Filter: ${group.posLabel}` : undefined}
                    >
                      {group.posLabel && (
                        <span className={`text-[10px] uppercase tracking-wider ${
                          isMatching ? 'font-semibold text-purple-700 dark:text-purple-300' : 'font-normal text-gray-400 dark:text-gray-500'
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
                                  isMatching
                                    ? 'font-medium bg-purple-100/70 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                    : 'font-normal bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                }`}>
                                  {dialectUpper}
                                </span>
                              )}
                              <span className={`font-mono text-[11px] ${
                                isMatching ? 'font-medium text-purple-900 dark:text-purple-200' : 'font-normal text-gray-500 dark:text-gray-400'
                              }`}>
                                /{p.ipa.replace(/^\/|\/$/g, '')}/
                              </span>
                              {p.context && !group.posLabel && !/^(uk|us)?\s*(tính từ|danh từ|động từ|phó từ|trạng từ|giới từ|thán từ|liên từ|đại từ|noun|verb|adj|adjective|adv|adverb)/i.test(p.context.trim()) && p.context.toLowerCase() !== (p.dialect || '').toLowerCase() && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                                  ({p.context})
                                </span>
                              )}
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
            ) : null}
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div 
          className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 space-y-6"
          onMouseEnter={() => {
            if (!isHeaderPinned) {
              setIsDetailsHidden(true)
            }
          }}
        >
          {/* Meanings & Definitions */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <span>Meanings &amp; Definitions</span>
              <span className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
            </div>
            {hasPosEntries && activePosEntry ? (
              activePosEntry.meanings.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No notes or meanings added.</p>
              ) : (
                activePosEntry.meanings.map((m, mIdx) => (
                  <div key={m.id || mIdx} className="bg-gray-50/80 dark:bg-gray-900/40 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg flex-1">{m.meaning}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.labels && m.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {m.labels.map((lbl, lIdx) => (
                              <span key={lIdx} className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                {lbl}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100/80 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                          #{mIdx + 1}
                        </span>
                      </div>
                    </div>
                    {m.notes && m.notes.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">
                        {m.notes.join(' ')}
                      </div>
                    )}
                    {m.examples && m.examples.length > 0 && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        {m.examples.map((ex, exIdx) => (
                          <div key={ex.id || exIdx} className="bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-2xs">
                            <div className="text-sm text-gray-800 dark:text-gray-100 flex items-start justify-between gap-2">
                              <span>
                                <ClickableSentence
                                  sentence={ex.sentence}
                                  enabled={effectiveClickWord}
                                  flashcardWordMap={flashcardWordMap}
                                  currentCardId={currentCard.id}
                                  onWordClick={navigateToCard}
                                />
                              </span>
                              <button
                                type="button"
                                onClick={() => speakEnglish(ex.sentence)}
                                className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                                title="Listen example"
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                            {ex.translation && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-1 pl-1">
                                {ex.translation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              <div className="space-y-3">
                {currentCard.translation && (
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                      Translation / Meaning
                    </span>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words whitespace-pre-wrap">
                      {currentCard.translation}
                    </p>
                  </div>
                )}
                {(currentCard.highlights || []).length === 0 && !currentCard.translation ? (
                  <p className="text-sm text-gray-400 italic">No notes or meanings added.</p>
                ) : (
                  (currentCard.highlights || []).map((h, hIdx) => (
                    <div key={h.id || hIdx} className="bg-gray-50/80 dark:bg-gray-900/40 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-gray-700/80">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-base flex-1">{h.meaning}</div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100/80 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                          #{hIdx + 1}
                        </span>
                      </div>
                      {h.example && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                          <ClickableSentence
                            sentence={h.example}
                            enabled={effectiveClickWord}
                            flashcardWordMap={flashcardWordMap}
                            currentCardId={currentCard.id}
                            onWordClick={navigateToCard}
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Phrases & Idioms Section */}
          {currentCard.phrasesAndIdioms && currentCard.phrasesAndIdioms.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-3">
                <span>Phrases &amp; Idioms</span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-normal">
                  {currentCard.phrasesAndIdioms.length}
                </span>
                <span className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentCard.phrasesAndIdioms.map((pi, piIdx) => {
                  const norm = normalizePhraseItem(pi)
                  return (
                    <div key={norm.id || piIdx} className="bg-gray-50/80 dark:bg-gray-900/40 rounded-2xl p-3.5 border border-gray-200/80 dark:border-gray-700/80 flex items-start justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            <ClickableSentence
                              sentence={norm.phrase}
                              enabled={effectiveClickWord}
                              flashcardWordMap={flashcardWordMap}
                              currentCardId={currentCard.id}
                              onWordClick={navigateToCard}
                            />
                          </span>
                          {norm.type && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-mono font-medium">
                              {norm.type}
                            </span>
                          )}
                          {norm.labels && norm.labels.length > 0 && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                              ({norm.labels.join(', ')})
                            </span>
                          )}
                        </div>
                        {norm.translation && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {norm.translation}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => speakEnglish(norm.phrase)}
                        className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                        title="Listen"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Usage Notes Section */}
          {currentCard.usageNotes && currentCard.usageNotes.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
                <span>💡 Usage Notes</span>
                <span className="h-px bg-amber-200 dark:bg-amber-900/50 flex-1" />
              </div>
              <div className="space-y-2 bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 p-4 rounded-2xl">
                {currentCard.usageNotes.map((note, nIdx) => (
                  <p key={nIdx} className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-2">
                    <span className="text-amber-500 font-bold shrink-0">•</span>
                    <span>
                      <ClickableSentence
                        sentence={note}
                        enabled={effectiveClickWord}
                        flashcardWordMap={flashcardWordMap}
                        currentCardId={currentCard.id}
                        onWordClick={navigateToCard}
                      />
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Word Forms Section */}
          {currentCard.wordForms && currentCard.wordForms.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-2">
                <span>Word Forms</span>
                <span className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
              </div>
              <div className="flex flex-wrap gap-2">
                {currentCard.wordForms.map((wf, wfIdx) => (
                  <span key={wfIdx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-medium border border-gray-200/60 dark:border-gray-600/60">
                    {wf.form}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Words Section */}
          {currentCard.relatedWords && Object.values(currentCard.relatedWords).some(arr => arr && arr.length > 0) && (() => {
            const renderRelatedBadgeInModal = (w: string, idx: number) => {
              const matched = findMatchingCard(w, flashcardWordMap)
              const isClickable = effectiveClickWord && !!matched && matched.id !== currentCard.id
              return (
                <span
                  key={idx}
                  onClick={isClickable ? () => navigateToCard(matched!) : undefined}
                  title={isClickable ? `Open flashcard: ${matched!.sentence}` : undefined}
                  className={`text-xs px-2.5 py-0.5 rounded-lg bg-purple-100/70 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium transition-colors ${
                    isClickable ? 'cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/60' : ''
                  }`}
                >
                  {w}
                </span>
              )
            }

            return (
              <div className="pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-3">
                  <span>Related Words</span>
                  <span className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentCard.relatedWords.synonyms && currentCard.relatedWords.synonyms.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Synonyms</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.synonyms.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                  {currentCard.relatedWords.antonyms && currentCard.relatedWords.antonyms.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Antonyms</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.antonyms.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                  {currentCard.relatedWords.similarWords && currentCard.relatedWords.similarWords.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Similar Words</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.similarWords.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                  {currentCard.relatedWords.similarSpellings && currentCard.relatedWords.similarSpellings.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Similar Spellings</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.similarSpellings.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                  {currentCard.relatedWords.wordsContaining && currentCard.relatedWords.wordsContaining.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Words Containing</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.wordsContaining.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                  {currentCard.relatedWords.wordsMentioning && currentCard.relatedWords.wordsMentioning.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1.5">Words Mentioning</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.relatedWords.wordsMentioning.map(renderRelatedBadgeInModal)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>,
    document.body
  )
}

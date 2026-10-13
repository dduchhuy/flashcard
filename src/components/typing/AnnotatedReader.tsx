import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, X, Check, StickyNote } from 'lucide-react'
import { useFlashcardStore, Flashcard, Highlight, getCardTags, isWordCard } from '../../store'
import { useTypingStore, Book, BookChapter } from '../../typingStore'
import { extractWordsAndSpaces } from '../../utils'
import { splitSentences, sentenceKey, firstMeaningOf } from '../../utils/bookUtils'
import { buildWordToFlashcardMap, findMatchingCard } from '../ClickableSentence'
import { CardDetailModal } from '../CardDetailModal'
import { loadFont, getFontVariationSettings, getEffectiveFontFamily } from '../../utils/fontLoader'

interface AnnotatedReaderProps {
  book: Book
  chapter: BookChapter
  paragraphs: string[]
  mode: 'note' | 'preview'
}

interface Editor {
  skey: string
  sentence: string
  indices: number[]
  highlightId: string | null
  meaning: string
  x: number
  y: number
}

interface QuickPopup {
  x: number
  y: number
  word: string
  meaning: string
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(216,180,254,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function AnnotatedReader({ book, chapter, paragraphs, mode }: AnnotatedReaderProps) {
  const { flashcards, settings, addFlashcard, saveHighlight, removeHighlight, deleteFlashcard } = useFlashcardStore()
  const { sentenceLinks, linkSentence, unlinkSentence, settings: typingSettings } = useTypingStore()

  // Load the current typing font when it changes
  useEffect(() => {
    if (typingSettings.fontFamily) loadFont(typingSettings.fontFamily)
  }, [typingSettings.fontFamily])

  const [selection, setSelection] = useState<{ skey: string; start: number; end: number } | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const editorRef = useRef<Editor | null>(null)
  useEffect(() => {
    editorRef.current = editor
  }, [editor])
  const [quick, setQuick] = useState<QuickPopup | null>(null)
  const [modalCard, setModalCard] = useState<Flashcard | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragging = useRef(false)
  const selRef = useRef<{ skey: string; start: number; end: number } | null>(null)
  const pointerStartRef = useRef<{
    x: number
    y: number
    idx: number
    skey: string
    sentence: string
    hl?: Highlight
    target: HTMLElement
  } | null>(null)

  const wordMap = useMemo(() => buildWordToFlashcardMap(flashcards), [flashcards])
  const cardById = useMemo(() => new Map(flashcards.map(f => [f.id, f])), [flashcards])
  // Fallback lookup: sentence cards tagged with this book title
  const bookSentenceCards = useMemo(() => {
    const m = new Map<string, Flashcard>()
    for (const f of flashcards) {
      if (!isWordCard(f) && getCardTags(f).includes(book.title)) m.set(f.sentence.trim(), f)
    }
    return m
  }, [flashcards, book.title])

  const resolveCard = (skey: string, sentence: string): Flashcard | undefined => {
    const link = sentenceLinks[skey]
    if (link) {
      const c = cardById.get(link.cardId)
      if (c && c.sentence.trim() === sentence) return c
    }
    return bookSentenceCards.get(sentence)
  }

  const highlightStyle = {
    backgroundColor: hexToRgba(settings.highlightColor || '#d8b4fe', Math.max(settings.highlightOpacity ?? 0.3, 0.25)),
  }

  // Close quick popup on outside pointer
  useEffect(() => {
    if (!quick) return
    const close = () => setQuick(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [quick])

  // Reset transient UI when mode/chapter changes
  useEffect(() => {
    setSelection(null)
    setEditor(null)
    setQuick(null)
  }, [mode, chapter.id])

  // ---------- Note mode: save / delete ----------
  const saveNote = () => {
    if (!editor) return
    const meaning = editor.meaning.trim()
    if (!meaning || editor.indices.length === 0) {
      if (editor.highlightId) deleteNote()
      else setEditor(null)
      return
    }
    const existing = resolveCard(editor.skey, editor.sentence)
    if (!existing) {
      const id = addFlashcard(editor.sentence, [book.title], [{ wordIndices: editor.indices, meaning }])
      linkSentence(editor.skey, { cardId: id, sentence: editor.sentence })
    } else {
      saveHighlight(existing.id, editor.highlightId, editor.indices, meaning)
      if (sentenceLinks[editor.skey]?.cardId !== existing.id) {
        linkSentence(editor.skey, { cardId: existing.id, sentence: editor.sentence })
      }
    }
    setEditor(null)
    setSelection(null)
  }

  const deleteNote = () => {
    if (!editor || !editor.highlightId) return
    const card = resolveCard(editor.skey, editor.sentence)
    if (card) {
      removeHighlight(card.id, editor.highlightId)
      const after = useFlashcardStore.getState().flashcards.find(f => f.id === card.id)
      if (!after || after.highlights.length === 0) {
        deleteFlashcard(card.id)
        unlinkSentence(editor.skey)
      }
    }
    setEditor(null)
    setSelection(null)
  }

  const openEditorAt = (el: Element, data: Omit<Editor, 'x' | 'y'>) => {
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(rect.left, 12), window.innerWidth - 320)
    const y = rect.bottom + 8 > window.innerHeight - 160 ? rect.top - 150 : rect.bottom + 8
    setEditor({ ...data, x, y })
  }

  const wordFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-widx]') as HTMLElement | null
    if (!el) return null
    return { el, skey: el.dataset.skey!, idx: parseInt(el.dataset.widx!, 10) }
  }

  const handlePointerDown = (e: React.PointerEvent, skey: string, sentence: string, idx: number, hl?: Highlight) => {
    if (mode !== 'note') return
    e.preventDefault()
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      idx,
      skey,
      sentence,
      hl,
      target: e.currentTarget as HTMLElement,
    }
    dragging.current = false
    selRef.current = null
  }

  useEffect(() => {
    if (mode !== 'note') return
    const move = (e: PointerEvent) => {
      if (!pointerStartRef.current) return
      const start = pointerStartRef.current
      if (!dragging.current) {
        const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
        if (dist > 6) {
          dragging.current = true
          selRef.current = { skey: start.skey, start: start.idx, end: start.idx }
          setSelection(selRef.current)
        }
      }
      if (dragging.current && selRef.current) {
        const w = wordFromPoint(e.clientX, e.clientY)
        if (w && w.skey === selRef.current.skey && w.idx !== selRef.current.end) {
          selRef.current = { ...selRef.current, end: w.idx }
          setSelection(selRef.current)
        }
      }
    }

    const up = (e: PointerEvent) => {
      const start = pointerStartRef.current
      pointerStartRef.current = null
      if (!start) return

      if (dragging.current) {
        dragging.current = false
        const sel = selRef.current
        selRef.current = null
        setSelection(null)
        if (!sel) return
        const lo = Math.min(sel.start, sel.end)
        const hi = Math.max(sel.start, sel.end)
        const indices: number[] = []
        for (let i = lo; i <= hi; i++) indices.push(i)

        const anchor =
          document.querySelector(`[data-skey="${CSS.escape(sel.skey)}"][data-widx="${hi}"]`) ||
          (e.target as Element) ||
          start.target

        const currentEditor = editorRef.current
        const preservedMeaning = currentEditor && currentEditor.skey === sel.skey ? currentEditor.meaning : ''
        const preservedHlId = currentEditor && currentEditor.skey === sel.skey ? currentEditor.highlightId : null

        openEditorAt(anchor, {
          skey: sel.skey,
          sentence: start.sentence,
          indices,
          highlightId: preservedHlId,
          meaning: preservedMeaning,
        })
        return
      }

      // Single click (not dragged)
      const currentEditor = editorRef.current

      // Case 1: Editor is currently open on the same sentence -> toggle word
      if (currentEditor && currentEditor.skey === start.skey) {
        // If clicked on a different existing highlight, switch editor to that highlight
        if (start.hl && start.hl.id !== currentEditor.highlightId && !currentEditor.indices.includes(start.idx)) {
          openEditorAt(start.target, {
            skey: start.skey,
            sentence: start.sentence,
            indices: start.hl.wordIndices,
            highlightId: start.hl.id,
            meaning: start.hl.meaning,
          })
          setSelection(null)
          return
        }

        // Toggle idx in current editor: deselect if already present, add if not
        const isAlreadyIn = currentEditor.indices.includes(start.idx)
        let newIndices: number[]
        if (isAlreadyIn) {
          newIndices = currentEditor.indices.filter(i => i !== start.idx)
        } else {
          newIndices = [...currentEditor.indices, start.idx].sort((a, b) => a - b)
        }

        if (newIndices.length === 0) {
          setEditor(null)
          setSelection(null)
          return
        }

        setEditor({
          ...currentEditor,
          indices: newIndices,
        })
        setSelection(null)
        return
      }

      // Case 2: No editor or editor is on a different sentence
      if (start.hl) {
        openEditorAt(start.target, {
          skey: start.skey,
          sentence: start.sentence,
          indices: start.hl.wordIndices,
          highlightId: start.hl.id,
          meaning: start.hl.meaning,
        })
      } else {
        openEditorAt(start.target, {
          skey: start.skey,
          sentence: start.sentence,
          indices: [start.idx],
          highlightId: null,
          meaning: '',
        })
      }
      setSelection(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ---------- Preview mode: click / double click ----------
  const handleClick = (e: React.MouseEvent, word: string, hl: Highlight | undefined, libCard: Flashcard | undefined) => {
    if (mode !== 'preview') return
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      const meaning = hl?.meaning || firstMeaningOf(libCard)
      if (!meaning) return
      setQuick({
        x: Math.min(Math.max(rect.left, 12), window.innerWidth - 280),
        y: rect.bottom + 6,
        word: libCard?.sentence || word,
        meaning,
      })
    }, 230)
  }

  const handleDoubleClick = (e: React.MouseEvent, libCard: Flashcard | undefined) => {
    if (mode !== 'preview') return
    e.preventDefault()
    if (clickTimer.current) clearTimeout(clickTimer.current)
    window.getSelection()?.removeAllRanges()
    setQuick(null)
    if (libCard) setModalCard(libCard)
  }

  const isSelected = (skey: string, idx: number) => {
    if (selection && selection.skey === skey) {
      const lo = Math.min(selection.start, selection.end)
      const hi = Math.max(selection.start, selection.end)
      return idx >= lo && idx <= hi
    }
    if (editor && editor.skey === skey && editor.indices.includes(idx)) return true
    return false
  }

  if (paragraphs.length === 0) {
    return (
      <div className="text-center text-gray-400 dark:text-gray-500 py-16 text-sm">
        This chapter has no content. Select a sub-chapter from the table of contents.
      </div>
    )
  }

  return (
    <div className="relative">
      {mode === 'note' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-xl px-3 py-2">
          <StickyNote size={14} />
          Drag across words to note a word or phrase. Click a noted word to edit or delete it. Noted sentences are saved to Library with tag “{book.title}”.
        </div>
      )}

      <div
        className={`space-y-6 text-gray-800 dark:text-gray-200 ${mode === 'note' ? 'select-none' : ''}`}
        style={{
          fontFamily: getEffectiveFontFamily(typingSettings.fontFamily),
          fontSize: `${typingSettings.fontSize || 20}px`,
          fontWeight: typingSettings.fontWeight || 400,
          lineHeight: typingSettings.lineHeight || 1.8,
          fontVariationSettings: getFontVariationSettings(typingSettings.fontFamily) || undefined,
        }}
      >
        {paragraphs.map((p, pIdx) => {
          const sentences = splitSentences(p)
          return (
            <p key={pIdx} className="px-4">
              {sentences.map((s, sIdx) => {
                const skey = sentenceKey(book.id, chapter.id, pIdx, sIdx)
                const card = resolveCard(skey, s.text)
                const { words, spaces, initialSpace } = extractWordsAndSpaces(s.text)
                return (
                  <span key={sIdx}>
                    {initialSpace}
                    {words.map((w, wIdx) => {
                      const hl = card?.highlights.find(h => h.wordIndices.includes(wIdx))
                      const libCard = mode === 'preview' ? findMatchingCard(w, wordMap) : undefined
                      const selected = isSelected(skey, wIdx)
                      const nextInSame = hl && hl.wordIndices.includes(wIdx + 1)
                      return (
                        <span key={wIdx}>
                          <span
                            data-skey={skey}
                            data-widx={wIdx}
                            data-sentence={s.text}
                            onPointerDown={e => handlePointerDown(e, skey, s.text, wIdx, hl)}
                            onClick={e => handleClick(e, w, hl, libCard)}
                            onDoubleClick={e => handleDoubleClick(e, libCard)}
                            style={hl ? highlightStyle : undefined}
                            className={`group relative rounded-[3px] transition-colors ${
                              mode === 'note' ? 'cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40' : 'cursor-pointer'
                            } ${selected ? 'ring-2 ring-purple-500 bg-purple-100 dark:bg-purple-900/50' : ''}`}
                          >
                            {w}
                            {mode === 'preview' && hl && (
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 hidden group-hover:block whitespace-nowrap max-w-xs truncate font-sans text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-white shadow-lg">
                                {hl.meaning}
                              </span>
                            )}
                          </span>
                          {wIdx < words.length - 1 || spaces[wIdx] ? (
                            <span style={nextInSame ? highlightStyle : undefined}>{spaces[wIdx]}</span>
                          ) : null}
                        </span>
                      )
                    })}
                    {/\s$/.test(s.raw) && sIdx < sentences.length - 1 ? ' ' : ''}
                  </span>
                )
              })}
            </p>
          )
        })}
      </div>

      {/* Note editor popover */}
      {editor && mode === 'note' && (
        <div
          className="fixed z-50 w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 font-sans animate-in fade-in"
          style={{ left: editor.x, top: editor.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1.5 truncate">
            {extractWordsAndSpaces(editor.sentence).words.filter((_, i) => editor.indices.includes(i)).join(' ') || '(no words selected)'}
          </div>
          <input
            autoFocus
            value={editor.meaning}
            onChange={e => setEditor({ ...editor, meaning: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); saveNote() }
              if (e.key === 'Escape') { setEditor(null); setSelection(null) }
            }}
            placeholder="Meaning / note..."
            className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center justify-end gap-1.5 mt-2">
            {editor.highlightId && (
              <button type="button" onClick={deleteNote} className="mr-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button type="button" onClick={() => { setEditor(null); setSelection(null) }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <X size={13} /> Cancel
            </button>
            <button
              type="button"
              disabled={editor.indices.length === 0}
              onClick={saveNote}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white cursor-pointer"
            >
              <Check size={13} /> Save
            </button>
          </div>
        </div>
      )}

      {/* Quick meaning popup (single click in preview) */}
      {quick && mode === 'preview' && (
        <div
          className="fixed z-50 max-w-[280px] bg-gray-900 text-white rounded-xl shadow-2xl px-3 py-2 font-sans animate-in fade-in"
          style={{ left: quick.x, top: quick.y }}
        >
          <div className="text-[11px] font-bold text-purple-300">{quick.word}</div>
          <div className="text-sm">{quick.meaning}</div>
        </div>
      )}

      <CardDetailModal card={modalCard} isOpen={!!modalCard} onClose={() => setModalCard(null)} />
    </div>
  )
}

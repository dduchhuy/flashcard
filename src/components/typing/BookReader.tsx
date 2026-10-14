import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, CheckCircle2, Keyboard, StickyNote, Eye, ListTree, X, PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2, Settings } from 'lucide-react'
import { useTypingStore, Book, BookChapter, TypingViewMode } from '../../typingStore'
import { flattenChapters, splitParagraphs } from '../../utils/bookUtils'
import { TypingMode } from './TypingMode'
import { AnnotatedReader } from './AnnotatedReader'
import { TypingSettingsModal } from './TypingSettingsModal'

interface BookReaderProps {
  book: Book
  onBack: () => void
}

const MODES: { id: TypingViewMode; label: string; icon: typeof Keyboard }[] = [
  { id: 'typing', label: 'Typing', icon: Keyboard },
  { id: 'note', label: 'Note', icon: StickyNote },
  { id: 'preview', label: 'Preview', icon: Eye },
]

export function BookReader({ book, onBack }: BookReaderProps) {
  const { progress, lastPosition, viewMode, setViewMode, setLastPosition } = useTypingStore()
  const flat = useMemo(() => flattenChapters(book.chapters), [book.chapters])

  const initialChapterId = useMemo(() => {
    const last = lastPosition[book.id]
    if (last && flat.some(f => f.chapter.id === last.chapterId)) return last.chapterId
    return (flat.find(f => f.chapter.content.trim()) || flat[0])?.chapter.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id])

  const [chapterId, setChapterId] = useState<string | undefined>(initialChapterId)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showToc, setShowToc] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isTopBarHidden, setIsTopBarHidden] = useState(false)

  // Auto-hide top bar when scrolling down, show when scrolling up or mouse near top
  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY
          if (currentY > 60 && currentY > lastY + 5) {
            setIsTopBarHidden(true)
          } else if (currentY < lastY - 5 || currentY <= 30) {
            setIsTopBarHidden(false)
          }
          lastY = currentY
          ticking = false
        })
        ticking = true
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 70) {
        setIsTopBarHidden(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Listen for Escape key to exit Zen mode
  useEffect(() => {
    if (!zenMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZenMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zenMode])

  const current = flat.find(f => f.chapter.id === chapterId)
  const paragraphs = useMemo(() => splitParagraphs(current?.chapter.content || ''), [current?.chapter.content])

  const nextChapter = useMemo(() => {
    if (!current) return undefined
    return flat.slice(current.number + 1).find(f => f.chapter.content.trim())
  }, [flat, current])

  const selectChapter = (id: string) => {
    setChapterId(id)
    const prog = progress[book.id]?.[id] || {}
    const paras = splitParagraphs(flat.find(f => f.chapter.id === id)?.chapter.content || '')
    const firstOpen = paras.findIndex((_, i) => !prog[i])
    setLastPosition(book.id, id, firstOpen === -1 ? paras.length : firstOpen)
    setShowToc(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!current && flat[0]) setChapterId(flat[0].chapter.id)
  }, [current, flat])

  const chapterPercent = (ch: BookChapter) => {
    const paras = splitParagraphs(ch.content)
    if (paras.length === 0) return null
    const prog = progress[book.id]?.[ch.id] || {}
    const done = paras.filter((_, i) => prog[i]).length
    return Math.round((done / paras.length) * 100)
  }

  const renderToc = (chapters: BookChapter[], depth: number) =>
    chapters.map(ch => {
      const pct = chapterPercent(ch)
      const isCurrent = ch.id === chapterId
      const hasChildren = ch.children.length > 0
      const isCollapsed = collapsed[ch.id]
      return (
        <div key={ch.id}>
          <div
            className={`flex items-center gap-1 rounded-lg pr-2 py-1.5 text-sm cursor-pointer transition-colors ${
              isCurrent
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-semibold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={{ paddingLeft: 6 + depth * 14 }}
            onClick={() => selectChapter(ch.id)}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setCollapsed(c => ({ ...c, [ch.id]: !c[ch.id] }))
                }}
                className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : (
              <span className="w-[18px]" />
            )}
            <span className="flex-1 min-w-0 truncate" title={ch.title}>{ch.title || 'Untitled'}</span>
            {pct === 100 ? (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            ) : pct !== null && pct > 0 ? (
              <span className="text-[10px] text-gray-400 shrink-0">{pct}%</span>
            ) : null}
          </div>
          {hasChildren && !isCollapsed && renderToc(ch.children, depth + 1)}
        </div>
      )
    })

  const toc = (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-2 mb-1 border-b border-gray-100 dark:border-gray-700">
        <div className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug">{book.title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{book.author.join(', ')}</div>
      </div>
      {renderToc(book.chapters, 0)}
    </div>
  )

  if (zenMode) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-y-auto px-4 py-8 sm:px-12 flex flex-col items-center">
        {/* Discreet Zen Controls */}
        <div className="w-full max-w-4xl flex items-center justify-between mb-6 opacity-40 hover:opacity-100 transition-opacity">
          <span className="text-xs text-gray-400 font-medium">Zen Mode · Press <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">Esc</kbd> to exit</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              title="Typing Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => setZenMode(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <Minimize2 size={14} /> Exit Zen
            </button>
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto flex-1">
          {current && (
            viewMode === 'typing' ? (
              <TypingMode
                key={current.chapter.id}
                book={book}
                chapter={current.chapter}
                paragraphs={paragraphs}
                hasNext={!!nextChapter}
                onNextChapter={() => nextChapter && selectChapter(nextChapter.chapter.id)}
              />
            ) : (
              <AnnotatedReader book={book} chapter={current.chapter} paragraphs={paragraphs} mode={viewMode} />
            )
          )}
        </div>

        <TypingSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          currentBook={book}
        />
      </div>
    )
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Desktop TOC (Collapsible) */}
      {!sidebarCollapsed && (
        <aside className="hidden lg:block w-64 shrink-0 sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 rounded-2xl p-3">
          {toc}
        </aside>
      )}

      {/* Mobile TOC drawer */}
      {showToc && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowToc(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 p-3 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setShowToc(false)} className="ml-auto mb-2 flex p-1 text-gray-400 cursor-pointer">
              <X size={18} />
            </button>
            {toc}
          </div>
        </div>
      )}

      <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'max-w-4xl mx-auto w-full' : 'max-w-4xl mx-auto'}`}>        {/* Top bar with auto-hide */}
        <div className={`sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md py-2.5 mb-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs px-3 transition-all duration-300 ease-in-out ${
          isTopBarHidden 
            ? '-translate-y-24 opacity-0 pointer-events-none' 
            : 'translate-y-0 opacity-100 pointer-events-auto'
        }`}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <ArrowLeft size={16} /> Books
            </button>
            
            {/* Desktop Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              title={sidebarCollapsed ? "Show Table of Contents" : "Hide Table of Contents (Center Typing Area)"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>

            <button
              type="button"
              onClick={() => setShowToc(true)}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <ListTree size={16} /> Chapters
            </button>
            
            <h2 className="flex-1 min-w-0 truncate text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
              {current?.chapter.title || book.title}
            </h2>

            {/* Mode Switcher */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
              {MODES.map(m => {
                const Icon = m.icon
                const active = viewMode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon size={15} /> {m.label}
                  </button>
                )
              })}
            </div>

            {/* Zen Mode Button */}
            <button
              type="button"
              onClick={() => setZenMode(true)}
              className="flex items-center p-2 rounded-xl text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              title="Zen Mode (Distraction-Free)"
            >
              <Maximize2 size={16} />
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center p-2 rounded-xl text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              title="Typing Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {current && (
          viewMode === 'typing' ? (
            <TypingMode
              key={current.chapter.id}
              book={book}
              chapter={current.chapter}
              paragraphs={paragraphs}
              hasNext={!!nextChapter}
              onNextChapter={() => nextChapter && selectChapter(nextChapter.chapter.id)}
            />
          ) : (
            <AnnotatedReader book={book} chapter={current.chapter} paragraphs={paragraphs} mode={viewMode} />
          )
        )}

        <TypingSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          currentBook={book}
        />

        {current && current.chapter.children.length > 0 && (
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Sub-chapters</div>
            <div className="flex flex-col gap-1.5">
              {current.chapter.children.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChapter(ch.id)}
                  className="flex items-center justify-between text-left px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 hover:border-purple-300 text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  {ch.title} <ChevronRight size={15} className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {nextChapter && viewMode !== 'typing' && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => selectChapter(nextChapter.chapter.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold cursor-pointer"
            >
              Next: {nextChapter.chapter.title} <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

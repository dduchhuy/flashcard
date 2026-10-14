import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { v4 as uuidv4 } from 'uuid'
import { SAMPLE_BOOK } from './components/typing/sampleBook'

export interface BookChapter {
  id: string
  title: string
  content: string
  children: BookChapter[]
}

export interface Book {
  id: string
  title: string
  author: string[]
  chapters: BookChapter[]
  importedAt: number
  fileName?: string
}

export interface ParagraphProgress {
  wpm: number
  accuracy: number // 0..100
  durationMs: number
  chars: number
  completedAt: number
  mistakeIndices?: number[]
}

export interface SentenceLink {
  cardId: string
  sentence: string
}

export type TypingViewMode = 'typing' | 'note' | 'preview'

export interface TypingSettings {
  // Appearance & Colors
  untypedColor: string
  untypedOpacity: number
  correctColor: string
  errorColor: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  fontFamily: string

  // Caret
  caretStyle: 'line' | 'floor' | 'block'
  caretAnimation: 'linear' | 'swing' | 'ease' | 'ease-in' | 'ease-out'

  // Behavior
  typewriterMode: boolean
  keepInPosition: boolean
  newLineIndication: boolean
  typosIndication: 'both' | 'highlight' | 'replace'
  markIncorrectWords: boolean
  paragraphReset: 'off' | 'tab' | 'esc'
  backspaceBehavior: 'char' | 'word'
  markAsRead: boolean
  autoPause: '2s' | '5s' | '10s' | 'never'
  hideParagraphStats: boolean
  hudPinned: boolean

  // Sound
  soundEnabled: boolean
  keycapsSound: string
  keycapsVolume: number
  keycapsPitch: number
  keycapsReleaseSound: boolean
  keycapsSpecial: boolean
  keycapsTrim: boolean
  errorSound: string
  errorVolume: number
  otherVolume: number
}

export const defaultTypingSettings: TypingSettings = {
  untypedColor: '#9ca3af',
  untypedOpacity: 1,
  correctColor: '#111827',
  errorColor: '#e11d48',
  fontSize: 20,
  fontWeight: 400,
  lineHeight: 1.8,
  fontFamily: 'JetBrains Mono',

  caretStyle: 'line',
  caretAnimation: 'ease',

  typewriterMode: false,
  keepInPosition: false,
  newLineIndication: false,
  typosIndication: 'both',
  markIncorrectWords: true,
  paragraphReset: 'tab',
  backspaceBehavior: 'char',
  markAsRead: true,
  autoPause: '5s',
  hideParagraphStats: false,
  hudPinned: true,

  soundEnabled: true,
  keycapsSound: 'mechanical/mxbrown',
  keycapsVolume: 0.5,
  keycapsPitch: 0,
  keycapsReleaseSound: false,
  keycapsSpecial: true,
  keycapsTrim: true,
  errorSound: 'errors/pop',
  errorVolume: 0.3,
  otherVolume: 0.3,
}

interface TypingState {
  books: Book[]
  /** progress[bookId][chapterId][paragraphIndex] */
  progress: Record<string, Record<string, Record<number, ParagraphProgress>>>
  lastPosition: Record<string, { chapterId: string; pIdx: number }>
  /** key: `${bookId}|${chapterId}|${pIdx}|${sIdx}` */
  sentenceLinks: Record<string, SentenceLink>
  viewMode: TypingViewMode
  settings: TypingSettings

  importBook: (data: { title: string; author: string[]; chapters: BookChapter[]; fileName?: string }, replaceId?: string, fileName?: string) => string
  deleteBook: (bookId: string) => void
  markParagraphComplete: (bookId: string, chapterId: string, pIdx: number, p: ParagraphProgress) => void
  resetChapterProgress: (bookId: string, chapterId: string) => void
  setLastPosition: (bookId: string, chapterId: string, pIdx: number) => void
  linkSentence: (key: string, link: SentenceLink) => void
  unlinkSentence: (key: string) => void
  setViewMode: (m: TypingViewMode) => void
  updateTypingSettings: (newSettings: Partial<TypingSettings>) => void
  resetTypingSettings: () => void
}

const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const val = await get(name)
      if (val !== undefined && val !== null) return val
      const local = localStorage.getItem(name)
      if (local) {
        await set(name, local)
        return local
      }
    } catch {
      return localStorage.getItem(name)
    }
    return null
  },
  setItem: async (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {}
    try {
      await set(name, value)
    } catch {}
  },
  removeItem: async (name) => {
    try {
      localStorage.removeItem(name)
    } catch {}
    try {
      await del(name)
    } catch {}
  },
}

export const useTypingStore = create<TypingState>()(
  persist(
    (setState) => ({
      books: [SAMPLE_BOOK],
      progress: {},
      lastPosition: {},
      sentenceLinks: {},
      viewMode: 'typing',
      settings: defaultTypingSettings,

      importBook: (data, replaceId, fileName) => {
        const id = replaceId || uuidv4()
        const resolvedFileName = fileName || data.fileName
        const book: Book = {
          id,
          title: data.title,
          author: data.author,
          chapters: data.chapters,
          importedAt: Date.now(),
          fileName: resolvedFileName
        }
        setState(state => ({
          books: replaceId
            ? state.books.map(b => (b.id === replaceId ? book : b))
            : [...state.books, book],
        }))
        return id
      },

      deleteBook: (bookId) =>
        setState(state => {
          const progress = { ...state.progress }
          delete progress[bookId]
          const lastPosition = { ...state.lastPosition }
          delete lastPosition[bookId]
          const sentenceLinks: Record<string, SentenceLink> = {}
          for (const [k, v] of Object.entries(state.sentenceLinks)) {
            if (!k.startsWith(`${bookId}|`)) sentenceLinks[k] = v
          }
          return { books: state.books.filter(b => b.id !== bookId), progress, lastPosition, sentenceLinks }
        }),

      markParagraphComplete: (bookId, chapterId, pIdx, p) =>
        setState(state => {
          const bookProg = { ...(state.progress[bookId] || {}) }
          bookProg[chapterId] = { ...(bookProg[chapterId] || {}), [pIdx]: p }
          return { progress: { ...state.progress, [bookId]: bookProg } }
        }),

      resetChapterProgress: (bookId, chapterId) =>
        setState(state => {
          const bookProg = { ...(state.progress[bookId] || {}) }
          delete bookProg[chapterId]
          return { progress: { ...state.progress, [bookId]: bookProg } }
        }),

      setLastPosition: (bookId, chapterId, pIdx) =>
        setState(state => ({ lastPosition: { ...state.lastPosition, [bookId]: { chapterId, pIdx } } })),

      linkSentence: (key, link) =>
        setState(state => ({ sentenceLinks: { ...state.sentenceLinks, [key]: link } })),

      unlinkSentence: (key) =>
        setState(state => {
          const sentenceLinks = { ...state.sentenceLinks }
          delete sentenceLinks[key]
          return { sentenceLinks }
        }),

      setViewMode: (m) => setState({ viewMode: m }),

      updateTypingSettings: (newSettings) =>
        setState(state => ({
          settings: { ...state.settings, ...newSettings }
        })),

      resetTypingSettings: () =>
        setState({ settings: defaultTypingSettings }),
    }),
    {
      name: 'typing-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
)

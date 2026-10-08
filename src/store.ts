import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export interface SRSData {
  due: number
  interval: number
  easeFactor: number
  reps: number
  step: number
}

export interface Highlight {
  id: string
  wordIndices: number[]
  meaning: string
  example?: string
  srs?: SRSData
}

export interface Flashcard {
  id: string
  sentence: string
  highlights: Highlight[]
  createdAt: number
  tag?: string
  tags?: string[]
  srs?: SRSData
}

export function getCardTags(card: Flashcard): string[] {
  if (card.tags && card.tags.length > 0) return card.tags
  if (card.tag && card.tag.trim()) return [card.tag.trim()]
  return []
}

export function getCardsForMode(flashcards: Flashcard[], mode: 'word' | 'sentence'): Flashcard[] {
  if (mode === 'word') {
    return flashcards.filter(f => f.highlights && f.highlights.length > 0)
  }
  return flashcards
}

export function parseTagsInput(input?: string[] | string): string[] {
  if (!input) return []
  if (Array.isArray(input)) return input.map(t => t.trim()).filter(Boolean)
  return input.split(',').map(t => t.trim()).filter(Boolean)
}

export interface AppSettings {
  highlightMode?: 'background' | 'text'
  highlightColor: string
  highlightOpacity: number
  hoverColor: string
  hoverOpacity: number
  isDarkMode: boolean
  voiceAccent: 'US' | 'UK' | 'Random'
  voiceGender: 'Male' | 'Female' | 'Random'
}

export const defaultSettings: AppSettings = {
  highlightMode: 'background',
  highlightColor: '#d8b4fe', // Tailwind purple-300
  highlightOpacity: 0.3,     // Equivalent to bg-purple-100/200ish
  hoverColor: '#a855f7',     // Tailwind purple-500
  hoverOpacity: 0.4,
  isDarkMode: false,
  voiceAccent: 'Random',
  voiceGender: 'Random'
}

interface FlashcardState {
  flashcards: Flashcard[]
  settings: AppSettings
  activeTags: string[]
  setActiveTags: (tags: string[]) => void
  updateSettings: (newSettings: Partial<AppSettings>) => void
  resetSettings: () => void
  addFlashcard: (sentence: string, tags?: string[] | string) => void
  deleteFlashcard: (id: string) => void
  updateFlashcard: (id: string, newSentence: string) => void
  updateFlashcardTag: (id: string, tags?: string[] | string) => void
  saveHighlight: (flashcardId: string, highlightId: string | null, wordIndices: number[], meaning: string) => string
  removeHighlight: (flashcardId: string, highlightId: string) => void
  gameInputMode: 'word' | 'sentence'
  setGameInputMode: (mode: 'word' | 'sentence') => void
  updateFlashcardSRS: (id: string, srsData: SRSData) => void
  updateHighlightSRS: (flashcardId: string, highlightId: string, srsData: SRSData) => void
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set) => ({
      flashcards: [],
      settings: defaultSettings,
      activeTags: [],
      setActiveTags: (tags) => set({ activeTags: tags }),
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      resetSettings: () => set((state) => ({ settings: { ...defaultSettings, isDarkMode: state.settings.isDarkMode } })),
      addFlashcard: (sentence, tags) =>
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          return {
            flashcards: [
              ...state.flashcards,
              {
                id: uuidv4(),
                sentence: sentence.trim(),
                highlights: [],
                createdAt: Date.now(),
                tags: parsedTags.length > 0 ? parsedTags : undefined,
              },
            ],
          }
        }),
      deleteFlashcard: (id) =>
        set((state) => ({
          flashcards: state.flashcards.filter((f) => f.id !== id),
        })),
      updateFlashcard: (id, newSentence) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) =>
            f.id === id ? { ...f, sentence: newSentence } : f
          ),
        })),
      updateFlashcardTag: (id, tags) =>
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          return {
            flashcards: state.flashcards.map((f) =>
              f.id === id ? { ...f, tags: parsedTags.length > 0 ? parsedTags : undefined, tag: undefined } : f
            ),
          }
        }),
      saveHighlight: (flashcardId, highlightId, wordIndices, meaning) => {
        const finalId = highlightId || uuidv4()
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id === flashcardId) {
              // Nếu mảng từ rỗng HOẶC nghĩa bị bỏ trống hoàn toàn -> Xóa hẳn note khỏi database
              if (wordIndices.length === 0 || meaning.trim() === '') {
                return {
                  ...f,
                  highlights: f.highlights.filter(h => h.id !== finalId)
                }
              }

              let newHighlights = [...f.highlights]
              newHighlights = newHighlights.map(h => {
                if (h.id === finalId) return h
                return {
                  ...h,
                  wordIndices: h.wordIndices.filter(idx => !wordIndices.includes(idx))
                }
              }).filter(h => h.wordIndices.length > 0)

              if (highlightId) {
                const existingIndex = newHighlights.findIndex(h => h.id === finalId)
                if (existingIndex >= 0) {
                  newHighlights[existingIndex] = { id: finalId, wordIndices, meaning: meaning.trim() }
                } else {
                  newHighlights.push({ id: finalId, wordIndices, meaning: meaning.trim() })
                }
              } else {
                newHighlights.push({ id: finalId, wordIndices, meaning: meaning.trim() })
              }

              return { ...f, highlights: newHighlights }
            }
            return f
          }),
        }))
        return finalId
      },
      removeHighlight: (flashcardId, highlightId) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id === flashcardId) {
              return {
                ...f,
                highlights: f.highlights.filter((h) => h.id !== highlightId),
              }
            }
            return f
          }),
        })),
      gameInputMode: 'word',
      setGameInputMode: (mode) => set({ gameInputMode: mode }),
      updateFlashcardSRS: (id, srsData) => set((state) => ({
        flashcards: state.flashcards.map(f => f.id === id ? { ...f, srs: srsData } : f)
      })),
      updateHighlightSRS: (flashcardId, highlightId, srsData) => set((state) => ({
        flashcards: state.flashcards.map(f => f.id === flashcardId ? {
          ...f,
          highlights: f.highlights.map(h => h.id === highlightId ? { ...h, srs: srsData } : h)
        } : f)
      })),
    }),
    {
      name: 'flashcard-storage',
    }
  )
)

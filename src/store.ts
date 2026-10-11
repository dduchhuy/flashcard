import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { v4 as uuidv4 } from 'uuid'

export interface SRSData {
  due: number // timestamp in ms
  interval: number // in minutes
  easeFactor: number
  reps: number
  step: number // 0=New, 1=Learning step 1, 2=Learning step 2, 3=Review
}

export interface Highlight {
  id: string
  wordIndices: number[]
  meaning: string
  example?: string
  srs?: SRSData
}

export interface Example {
  id?: string
  sentence: string
  translation: string
}

export interface Meaning {
  id?: string
  meaning: string
  examples: Example[]
}

export interface PosEntry {
  id?: string
  partOfSpeech: string
  phonetic?: string
  meanings: Meaning[]
}

export interface PhraseIdiom {
  id?: string
  phrase: string
  translation: string
}

export interface Flashcard {
  id: string
  sentence: string
  phonetic?: string
  partOfSpeech?: string
  highlights: Highlight[]
  posEntries?: PosEntry[]
  phrasesAndIdioms?: PhraseIdiom[]
  createdAt: number
  tag?: string
  tags?: string[]
  srs?: SRSData  // word-mode SRS
}

export function syncHighlightsFromPosEntries(posEntries?: PosEntry[]): Highlight[] {
  if (!posEntries || posEntries.length === 0) return []
  const highlights: Highlight[] = []
  posEntries.forEach((pos) => {
    pos.meanings.forEach((m) => {
      highlights.push({
        id: m.id || uuidv4(),
        wordIndices: [0],
        meaning: m.meaning,
        example: m.examples?.[0]?.sentence || '',
      })
    })
  })
  return highlights
}

export function migrateFlashcard(card: Flashcard): Flashcard {
  if (card.posEntries && card.posEntries.length > 0) {
    if (!card.highlights || card.highlights.length === 0) {
      return {
        ...card,
        highlights: syncHighlightsFromPosEntries(card.posEntries),
        phrasesAndIdioms: card.phrasesAndIdioms || []
      }
    }
    return {
      ...card,
      phrasesAndIdioms: card.phrasesAndIdioms || []
    }
  }

  const isOldWord = card.highlights && card.highlights.some(h => h.example !== undefined)
  if (isOldWord) {
    const meanings: Meaning[] = card.highlights.map(h => ({
      id: h.id || uuidv4(),
      meaning: h.meaning,
      examples: h.example ? [{ id: uuidv4(), sentence: h.example, translation: '' }] : []
    }))
    const posEntries: PosEntry[] = [{
      id: uuidv4(),
      partOfSpeech: card.partOfSpeech || '',
      phonetic: card.phonetic,
      meanings
    }]
    return {
      ...card,
      posEntries,
      phrasesAndIdioms: card.phrasesAndIdioms || []
    }
  }

  return card
}

export function getCardTags(card: Flashcard): string[] {
  if (card.tags && card.tags.length > 0) return card.tags
  if (card.tag && card.tag.trim()) return [card.tag.trim()]
  return []
}

export function isWordCard(card: Flashcard): boolean {
  if (card.posEntries && card.posEntries.length > 0) return true
  if (card.highlights && card.highlights.some(h => h.example !== undefined)) return true
  return false
}

export function getCardsForMode(cards: Flashcard[], mode: 'sentence' | 'word'): Flashcard[] {
  return cards.filter(c => mode === 'word' ? isWordCard(c) : !isWordCard(c))
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
  highlightTextColor: string
  isDarkMode: boolean
  voiceAccent: 'US' | 'UK' | 'Random'
  voiceGender: 'Male' | 'Female' | 'Random'
  isSpecialAccent?: boolean
  specialAccent?: 'Indian' | 'Irish' | 'French'
}

export const defaultSettings: AppSettings = {
  highlightMode: 'background',
  highlightColor: '#d8b4fe', // Tailwind purple-300
  highlightOpacity: 0.3,     // Equivalent to bg-purple-100/200ish
  hoverColor: '#a855f7',     // Tailwind purple-500
  hoverOpacity: 0.4,
  highlightTextColor: '', // Empty means auto-adapt to dark/light mode
  isDarkMode: false,
  voiceAccent: 'Random',
  voiceGender: 'Random',
  isSpecialAccent: false,
  specialAccent: 'Indian'
}

interface FlashcardState {
  flashcards: Flashcard[]
  settings: AppSettings
  activeTags: string[]
  setActiveTags: (tags: string[]) => void
  updateSettings: (newSettings: Partial<AppSettings>) => void
  resetSettings: () => void
  addFlashcard: (sentence: string, tags?: string[] | string, highlights?: Omit<Highlight, 'id'>[], phonetic?: string, partOfSpeech?: string) => void
  addWordCard: (word: string, posEntries: PosEntry[], phrasesAndIdioms?: PhraseIdiom[], tags?: string[] | string, phonetic?: string) => void
  deleteFlashcard: (id: string) => void
  updateFlashcard: (id: string, newSentence: string, newPhonetic?: string, newPartOfSpeech?: string) => void
  updateWordCard: (id: string, word: string, posEntries: PosEntry[], phrasesAndIdioms?: PhraseIdiom[], tags?: string[] | string, phonetic?: string) => void
  updateFlashcardTag: (id: string, tags?: string[] | string) => void
  saveHighlight: (flashcardId: string, highlightId: string | null, wordIndices: number[], meaning: string, example?: string) => string
  removeHighlight: (flashcardId: string, highlightId: string) => void
  updateHighlightSRS: (flashcardId: string, highlightId: string, srsData: SRSData) => void
  updateFlashcardSRS: (flashcardId: string, srsData: SRSData) => void
  gameInputMode: 'sentence' | 'word'
  setGameInputMode: (mode: 'sentence' | 'word') => void
}

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const val = await get(name)
    if (val !== undefined && val !== null) return val

    // Migration from localStorage to IndexedDB
    const local = localStorage.getItem(name)
    if (local) {
      await set(name, local)
      return local
    }
    return null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
  },
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set) => ({
      flashcards: [],
      settings: defaultSettings,
      activeTags: [],
      gameInputMode: 'sentence',
      setGameInputMode: (mode) => set({ gameInputMode: mode }),
      setActiveTags: (tags) => set({ activeTags: tags }),
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      resetSettings: () => set((state) => ({ settings: { ...defaultSettings, isDarkMode: state.settings.isDarkMode } })),
      addFlashcard: (sentence, tags, highlights, phonetic, partOfSpeech) =>
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          return {
            flashcards: [
              ...state.flashcards,
              {
                id: uuidv4(),
                sentence: sentence.trim(),
                phonetic: phonetic?.trim(),
                partOfSpeech: partOfSpeech?.trim(),
                highlights: highlights ? highlights.map(h => ({ ...h, id: uuidv4() })) : [],
                createdAt: Date.now(),
                tags: parsedTags.length > 0 ? parsedTags : undefined,
              },
            ],
          }
        }),
      addWordCard: (word, posEntries, phrasesAndIdioms, tags, phonetic) =>
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          const highlights = syncHighlightsFromPosEntries(posEntries)
          const newCard: Flashcard = {
            id: uuidv4(),
            sentence: word.trim(),
            phonetic: phonetic?.trim() || posEntries[0]?.phonetic?.trim(),
            partOfSpeech: posEntries[0]?.partOfSpeech?.trim(),
            highlights,
            posEntries,
            phrasesAndIdioms: phrasesAndIdioms || [],
            createdAt: Date.now(),
            tags: parsedTags.length > 0 ? parsedTags : undefined,
          }
          return {
            flashcards: [...state.flashcards, newCard],
          }
        }),
      deleteFlashcard: (id) =>
        set((state) => ({
          flashcards: state.flashcards.filter((f) => f.id !== id),
        })),
      updateFlashcard: (id, newSentence, newPhonetic, newPartOfSpeech) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id !== id) return f
            const updated: Flashcard = {
              ...f,
              sentence: newSentence,
              phonetic: newPhonetic !== undefined ? newPhonetic : f.phonetic,
              partOfSpeech: newPartOfSpeech !== undefined ? newPartOfSpeech : f.partOfSpeech,
            }
            // If card has posEntries, update the primary POS or phonetic
            if (updated.posEntries && updated.posEntries.length > 0) {
              const updatedPosEntries = [...updated.posEntries]
              if (newPartOfSpeech !== undefined) {
                updatedPosEntries[0] = { ...updatedPosEntries[0], partOfSpeech: newPartOfSpeech }
              }
              if (newPhonetic !== undefined) {
                updatedPosEntries[0] = { ...updatedPosEntries[0], phonetic: newPhonetic }
              }
              updated.posEntries = updatedPosEntries
              updated.highlights = syncHighlightsFromPosEntries(updatedPosEntries)
            }
            return updated
          }),
        })),
      updateWordCard: (id, word, posEntries, phrasesAndIdioms, tags, phonetic) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id !== id) return f
            const highlights = syncHighlightsFromPosEntries(posEntries)
            const parsedTags = tags !== undefined ? parseTagsInput(tags) : f.tags
            return {
              ...f,
              sentence: word.trim(),
              phonetic: phonetic?.trim() !== undefined ? phonetic?.trim() : (posEntries[0]?.phonetic?.trim() || f.phonetic),
              partOfSpeech: posEntries[0]?.partOfSpeech?.trim() || f.partOfSpeech,
              highlights,
              posEntries,
              phrasesAndIdioms: phrasesAndIdioms || [],
              tags: parsedTags && parsedTags.length > 0 ? parsedTags : undefined,
            }
          }),
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
      saveHighlight: (flashcardId, highlightId, wordIndices, meaning, example) => {
        const finalId = highlightId || uuidv4()
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id === flashcardId) {
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
                  const existingExample = example !== undefined ? example?.trim() : newHighlights[existingIndex].example
                  newHighlights[existingIndex] = { id: finalId, wordIndices, meaning: meaning.trim(), example: existingExample }
                } else {
                  newHighlights.push({ id: finalId, wordIndices, meaning: meaning.trim(), example: example?.trim() })
                }
              } else {
                newHighlights.push({ id: finalId, wordIndices, meaning: meaning.trim(), example: example?.trim() })
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
      updateHighlightSRS: (flashcardId, highlightId, srsData) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id === flashcardId) {
              return {
                ...f,
                highlights: f.highlights.map((h) => 
                  h.id === highlightId ? { ...h, srs: srsData } : h
                ),
              }
            }
            return f
          }),
        })),
      updateFlashcardSRS: (flashcardId, srsData) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) =>
            f.id === flashcardId ? { ...f, srs: srsData } : f
          ),
        })),
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.flashcards)) {
          state.flashcards = state.flashcards.map(migrateFlashcard)
        }
      }
    }
  )
)

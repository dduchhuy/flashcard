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
  lastRating?: 'again' | 'hard' | 'good' | 'easy'
  lastReviewedAt?: number
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
  translation?: string
}

export interface Meaning {
  id?: string
  meaning: string
  notes?: string[]
  labels?: string[]
  examples?: Example[]
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
  labels?: string[]
  type?: 'phrase' | 'idiom' | string
  srs?: SRSData
}

export interface PhoneticItem {
  ipa: string
  dialect?: 'uk' | 'us' | string
  pos?: string[]
  context?: string
  assignment?: string
}

export interface RelatedWords {
  synonyms?: string[]
  antonyms?: string[]
  similarWords?: string[]
  similarSpellings?: string[]
  wordsContaining?: string[]
  wordsMentioning?: string[]
}

export interface Illustration {
  imageUrl?: string
  alt?: string
  exampleSentence?: string
  exampleTranslation?: string
}

export interface WordForm {
  form: string
}

export interface Flashcard {
  id: string
  sentence: string // headword or sentence
  translation?: string // sentence translation
  partOfSpeech?: string
  phonetics?: PhoneticItem[]
  phonetic?: string
  posEntries?: PosEntry[]
  phrasesAndIdioms?: PhraseIdiom[]
  usageNotes?: string[]
  relatedWords?: RelatedWords
  illustrations?: Illustration[]
  wordForms?: WordForm[]
  createdAt: number
  tag?: string
  tags?: string[]
  highlights: Highlight[]
  srs?: SRSData  // word-mode SRS
}

export interface CardDisplayFilter {
  word: boolean
  partOfSpeech: boolean
  phonetic: boolean
  meanings: {
    meaningText: boolean
    meaningNotes: boolean
    exampleSentence: boolean
    exampleTranslation: boolean
  }
  phrasesAndIdioms: {
    phrase: boolean
    translation: boolean
  }
  autoExpandPhrases?: boolean
  usageNotes: boolean
  autoExpandUsage?: boolean
  relatedWords: {
    synonyms: boolean
    antonyms: boolean
    similarWords: boolean
    similarSpellings: boolean
    wordsContaining: boolean
    wordsMentioning: boolean
  }
  sentenceTranslation?: boolean
  sentenceHoverTooltip?: boolean
  clickWordToPopupCard?: boolean
}

export const defaultDisplayFilter: CardDisplayFilter = {
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
  autoExpandPhrases: false,
  usageNotes: true,
  autoExpandUsage: false,
  relatedWords: {
    synonyms: false,
    antonyms: false,
    similarWords: false,
    similarSpellings: false,
    wordsContaining: false,
    wordsMentioning: false,
  },
  sentenceTranslation: true,
  sentenceHoverTooltip: true,
  clickWordToPopupCard: true,
}

export function syncHighlightsFromPosEntries(posEntries?: PosEntry[]): Highlight[] {
  if (!posEntries || posEntries.length === 0) return []
  const highlights: Highlight[] = []
  posEntries.forEach((pos) => {
    (pos.meanings || []).forEach((m) => {
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

const VIETNAMESE_REGEX = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i

export function normalizePhraseItem(pi: PhraseIdiom): PhraseIdiom {
  if (!pi) return pi
  const p = (pi.phrase || '').trim()
  const t = (pi.translation || '').trim()
  if (!p && !t) return pi
  
  const pIsVi = VIETNAMESE_REGEX.test(p)
  const tIsVi = VIETNAMESE_REGEX.test(t)
  
  // If phrase has Vietnamese tones and translation is in English, swap them so English is phrase and Vietnamese is translation
  if (pIsVi && !tIsVi && t.length > 0) {
    return {
      ...pi,
      phrase: t,
      translation: p,
    }
  }
  return { ...pi, phrase: p, translation: t }
}

export function migrateFlashcard(card: any): Flashcard {
  if (!card) return card

  // 1. Sentence / Headword
  const sentence = (card.sentence || card.word || '').trim()

  // 2. ID and CreatedAt
  const id = card.id || uuidv4()
  const createdAt = typeof card.createdAt === 'number' ? card.createdAt : Date.now()

  // 3. Phonetics
  const phonetics: PhoneticItem[] = Array.isArray(card.phonetics)
    ? card.phonetics.map((p: any) => ({
        ipa: p.ipa || '',
        dialect: p.dialect || '',
        pos: Array.isArray(p.pos) ? p.pos : [],
        context: p.context || undefined,
        assignment: p.assignment || undefined,
      }))
    : []

  // Backward compatible primary phonetic
  let primaryPhonetic = card.phonetic || ''
  if (!primaryPhonetic && phonetics.length > 0) {
    const usOrUk = phonetics.find(p => p.dialect === 'us') || phonetics.find(p => p.dialect === 'uk') || phonetics[0]
    primaryPhonetic = usOrUk.ipa
  }

  // 4. POS Entries
  let posEntries: PosEntry[] | undefined = undefined
  if (Array.isArray(card.posEntries) && card.posEntries.length > 0) {
    posEntries = card.posEntries.map((p: any) => ({
      id: p.id || uuidv4(),
      partOfSpeech: p.partOfSpeech || '',
      phonetic: p.phonetic || undefined,
      meanings: Array.isArray(p.meanings)
        ? p.meanings.map((m: any) => ({
            id: m.id || uuidv4(),
            meaning: m.meaning || '',
            notes: Array.isArray(m.notes) ? m.notes : [],
            labels: Array.isArray(m.labels) ? m.labels : [],
            examples: Array.isArray(m.examples)
              ? m.examples.map((ex: any) => ({
                  id: ex.id || uuidv4(),
                  sentence: ex.sentence || '',
                  translation: ex.translation || '',
                }))
              : [],
          }))
        : [],
    }))
  } else if (card.highlights && card.highlights.some((h: any) => h.example !== undefined)) {
    // Legacy word card with highlights having example
    const meanings: Meaning[] = card.highlights.map((h: any) => ({
      id: h.id || uuidv4(),
      meaning: h.meaning,
      notes: [],
      labels: [],
      examples: h.example ? [{ id: uuidv4(), sentence: h.example, translation: '' }] : [],
    }))
    posEntries = [{
      id: uuidv4(),
      partOfSpeech: card.partOfSpeech || '',
      phonetic: primaryPhonetic,
      meanings,
    }]
  }

  // 5. Part of Speech summary string
  let partOfSpeech = card.partOfSpeech || ''
  if (!partOfSpeech && posEntries && posEntries.length > 0) {
    partOfSpeech = posEntries.map(p => p.partOfSpeech).filter(Boolean).join(' / ')
  }

  // 6. Phrases & Idioms
  const normPhrases = (card.phrasesAndIdioms || []).map((pi: any) => {
    const norm = normalizePhraseItem(pi)
    return {
      id: norm.id || uuidv4(),
      phrase: norm.phrase || '',
      translation: norm.translation || '',
      labels: Array.isArray(norm.labels) ? norm.labels : [],
      type: norm.type || 'phrase',
      srs: pi.srs || norm.srs,
    }
  })

  // 7. Usage Notes
  const usageNotes: string[] = Array.isArray(card.usageNotes) ? card.usageNotes : []

  // 8. Related Words
  const rawRelated = card.relatedWords || {}
  const relatedWords: RelatedWords = {
    synonyms: Array.isArray(rawRelated.synonyms) ? rawRelated.synonyms : [],
    antonyms: Array.isArray(rawRelated.antonyms) ? rawRelated.antonyms : [],
    similarWords: Array.isArray(rawRelated.similarWords) ? rawRelated.similarWords : [],
    similarSpellings: Array.isArray(rawRelated.similarSpellings) ? rawRelated.similarSpellings : [],
    wordsContaining: Array.isArray(rawRelated.wordsContaining) ? rawRelated.wordsContaining : [],
    wordsMentioning: Array.isArray(rawRelated.wordsMentioning) ? rawRelated.wordsMentioning : [],
  }

  // 9. Illustrations (preserved, even if not displayed yet)
  const illustrations: Illustration[] = Array.isArray(card.illustrations)
    ? card.illustrations.map((ill: any) => ({
        imageUrl: ill.imageUrl || undefined,
        alt: ill.alt || undefined,
        exampleSentence: ill.exampleSentence || undefined,
        exampleTranslation: ill.exampleTranslation || undefined,
      }))
    : []

  // 10. Word Forms
  const wordForms: WordForm[] = Array.isArray(card.wordForms)
    ? card.wordForms.map((wf: any) => ({
        form: typeof wf === 'string' ? wf : (wf.form || ''),
      }))
    : []

  // 11. Tags
  let tags: string[] | undefined = undefined
  if (Array.isArray(card.tags) && card.tags.length > 0) {
    tags = card.tags.map((t: any) => String(t).trim()).filter(Boolean)
  } else if (card.tag && String(card.tag).trim()) {
    tags = [String(card.tag).trim()]
  }

  // 12. Highlights (synced for mini-games and learning)
  let highlights: Highlight[] = []
  if (posEntries && posEntries.length > 0) {
    highlights = syncHighlightsFromPosEntries(posEntries)
    if (Array.isArray(card.highlights) && card.highlights.length > 0) {
      const oldSrsMap = new Map<string, SRSData | undefined>(
        card.highlights.map((h: any) => [h.id, h.srs as SRSData | undefined])
      )
      highlights = highlights.map(h => ({
        ...h,
        srs: oldSrsMap.get(h.id) ?? h.srs,
      }))
    }
  } else if (Array.isArray(card.highlights) && card.highlights.length > 0) {
    highlights = card.highlights
  }

  return {
    id,
    sentence,
    translation: card.translation ? String(card.translation).trim() : undefined,
    partOfSpeech,
    phonetics,
    phonetic: primaryPhonetic || undefined,
    posEntries,
    phrasesAndIdioms: normPhrases,
    usageNotes,
    relatedWords,
    illustrations,
    wordForms,
    tags,
    tag: undefined, // cleaned up
    createdAt,
    highlights,
    srs: card.srs,
  }
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
  homeRandomType?: 'all' | 'words' | 'phrases' | 'sentences' | 'words_phrases' | 'words_sentences'
  homeUpdateTrigger?: 'reload' | 'timer'
  homeTimerMinutes?: number
  showScrollbar?: boolean
  gitDataAutoLoad?: boolean
  lastGitSync?: number
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
  specialAccent: 'Indian',
  homeRandomType: 'all',
  homeUpdateTrigger: 'reload',
  homeTimerMinutes: 10,
  showScrollbar: true,
  gitDataAutoLoad: true,
}

interface FlashcardState {
  flashcards: Flashcard[]
  settings: AppSettings
  activeTags: string[]
  setActiveTags: (tags: string[]) => void
  updateSettings: (newSettings: Partial<AppSettings>) => void
  resetSettings: () => void
  addFlashcard: (sentence: string, tags?: string[] | string, highlights?: Omit<Highlight, 'id'>[], phonetic?: string, partOfSpeech?: string, usageNotes?: string[], translation?: string) => string
  addWordCard: (word: string, posEntries: PosEntry[], phrasesAndIdioms?: PhraseIdiom[], tags?: string[] | string, phonetic?: string, usageNotes?: string[]) => string
  deleteFlashcard: (id: string) => void
  updateFlashcard: (id: string, newSentence: string, newPhonetic?: string, newPartOfSpeech?: string, usageNotes?: string[], translation?: string) => void
  updateWordCard: (id: string, word: string, posEntries: PosEntry[], phrasesAndIdioms?: PhraseIdiom[], tags?: string[] | string, phonetic?: string, usageNotes?: string[]) => void
  updateFlashcardTag: (id: string, tags?: string[] | string) => void
  saveHighlight: (flashcardId: string, highlightId: string | null, wordIndices: number[], meaning: string, example?: string) => string
  removeHighlight: (flashcardId: string, highlightId: string) => void
  updateHighlightSRS: (flashcardId: string, highlightId: string, srsData: SRSData) => void
  updateFlashcardSRS: (flashcardId: string, srsData: SRSData) => void
  updatePhraseSRS: (flashcardId: string, phraseTextOrId: string, srsData: SRSData) => void
  gameInputMode: 'sentence' | 'word'
  setGameInputMode: (mode: 'sentence' | 'word') => void
  purgeDictionaryCards: () => number
}

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const val = await get(name)
      if (val !== undefined && val !== null) return val

      // Migration from localStorage to IndexedDB
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
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(name, value)
    } catch {}
    try {
      await set(name, value)
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      localStorage.removeItem(name)
    } catch {}
    try {
      await del(name)
    } catch {}
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
      addFlashcard: (sentence, tags, highlights, phonetic, partOfSpeech, usageNotes, translation) => {
        const id = uuidv4()
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          return {
            flashcards: [
              ...state.flashcards,
              {
                id,
                sentence: sentence.trim(),
                translation: translation?.trim() || undefined,
                phonetic: phonetic?.trim(),
                partOfSpeech: partOfSpeech?.trim(),
                highlights: highlights ? highlights.map(h => ({ ...h, id: uuidv4() })) : [],
                usageNotes: usageNotes && usageNotes.length > 0 ? usageNotes : undefined,
                createdAt: Date.now(),
                tags: parsedTags.length > 0 ? parsedTags : undefined,
              },
            ],
          }
        })
        return id
      },
      addWordCard: (word, posEntries, phrasesAndIdioms, tags, phonetic, usageNotes) => {
        const id = uuidv4()
        set((state) => {
          const parsedTags = parseTagsInput(tags)
          const newCard = migrateFlashcard({
            id,
            sentence: word.trim(),
            phonetic: phonetic?.trim() || posEntries[0]?.phonetic?.trim(),
            posEntries,
            phrasesAndIdioms,
            usageNotes: usageNotes && usageNotes.length > 0 ? usageNotes : undefined,
            createdAt: Date.now(),
            tags: parsedTags.length > 0 ? parsedTags : undefined,
          })
          return {
            flashcards: [...state.flashcards, newCard],
          }
        })
        return id
      },
      deleteFlashcard: (id) =>
        set((state) => ({
          flashcards: state.flashcards.filter((f) => f.id !== id),
        })),
      updateFlashcard: (id, newSentence, newPhonetic, newPartOfSpeech, usageNotes, translation) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id !== id) return f
            const updated: Flashcard = {
              ...f,
              sentence: newSentence,
              translation: translation !== undefined ? (translation.trim() || undefined) : f.translation,
              phonetic: newPhonetic !== undefined ? newPhonetic : f.phonetic,
              partOfSpeech: newPartOfSpeech !== undefined ? newPartOfSpeech : f.partOfSpeech,
              usageNotes: usageNotes !== undefined ? usageNotes : f.usageNotes,
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
      updateWordCard: (id, word, posEntries, phrasesAndIdioms, tags, phonetic, usageNotes) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id !== id) return f
            const parsedTags = tags !== undefined ? parseTagsInput(tags) : f.tags
            return migrateFlashcard({
              ...f,
              sentence: word.trim(),
              phonetic: phonetic?.trim() !== undefined ? phonetic?.trim() : (posEntries[0]?.phonetic?.trim() || f.phonetic),
              posEntries,
              phrasesAndIdioms,
              usageNotes: usageNotes !== undefined ? usageNotes : f.usageNotes,
              tags: parsedTags && parsedTags.length > 0 ? parsedTags : undefined,
            })
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
      updatePhraseSRS: (flashcardId, phraseTextOrId, srsData) =>
        set((state) => ({
          flashcards: state.flashcards.map((f) => {
            if (f.id === flashcardId && f.phrasesAndIdioms) {
              return {
                ...f,
                phrasesAndIdioms: f.phrasesAndIdioms.map((p) =>
                  p.phrase === phraseTextOrId || p.id === phraseTextOrId
                    ? { ...p, srs: srsData }
                    : p
                ),
              }
            }
            return f
          }),
        })),
      purgeDictionaryCards: () => {
        let purgedCount = 0
        set((state) => {
          const kept = state.flashcards.filter((c) => {
            if (c.srs && (c.srs.reps > 0 || c.srs.lastReviewedAt)) return true
            if (c.highlights?.some((h) => h.srs && (h.srs.reps > 0 || h.srs.lastReviewedAt))) return true
            if (c.phrasesAndIdioms?.some((p) => p.srs && (p.srs.reps > 0 || p.srs.lastReviewedAt))) return true
            if (!isWordCard(c)) return true
            return false
          })
          purgedCount = state.flashcards.length - kept.length
          return { flashcards: kept }
        })
        return purgedCount
      },
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.flashcards)) {
          // If bulk dictionary (160k cards) was previously loaded, auto-clean it
          if (state.flashcards.length > 5000) {
            console.warn(`[Auto-Clean] Detected ${state.flashcards.length} cards. Purging unstudied raw dictionary bulk import...`)
            state.flashcards = state.flashcards.filter((c) => {
              if (c.srs && (c.srs.reps > 0 || c.srs.lastReviewedAt)) return true
              if (c.highlights?.some((h) => h.srs && (h.srs.reps > 0 || h.srs.lastReviewedAt))) return true
              if (c.phrasesAndIdioms?.some((p) => p.srs && (p.srs.reps > 0 || p.srs.lastReviewedAt))) return true
              if (!isWordCard(c)) return true
              return false
            })
            console.log(`[Auto-Clean] Cleaned down to ${state.flashcards.length} personal cards.`)
          }
          state.flashcards = state.flashcards.map(migrateFlashcard)
        }
      }
    }
  )
)


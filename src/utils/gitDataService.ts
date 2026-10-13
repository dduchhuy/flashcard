import { useFlashcardStore, Flashcard, isWordCard, migrateFlashcard, getCardTags } from '../store'
import { useTypingStore } from '../typingStore'
import {
  validateBookJson,
  parseTxtToBook,
  parseEpubToBook,
  parseBookSaveFile
} from './bookUtils'
import JSZip from 'jszip'

export interface DataManifest {
  book: Array<{ name: string; size: number; modified: number }>
  vocab: Array<{ name: string; size: number; modified: number }>
  sentence: Array<{ name: string; size: number; modified: number }>
  save: Array<{ name: string; size: number; modified: number }>
}

/** Check if Vite dev server data API is available */
export async function isDevDataApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/data/list', { method: 'GET', signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

/** Fetch manifest of files in data/ */
export async function fetchDataManifest(): Promise<DataManifest> {
  // 1. Try dev server API
  try {
    const res = await fetch('/api/data/list')
    if (res.ok) {
      return (await res.json()) as DataManifest
    }
  } catch {}

  // 2. Try static manifest in production build
  try {
    const res = await fetch('./data/manifest.json')
    if (res.ok) {
      return (await res.json()) as DataManifest
    }
  } catch {}

  return { book: [], vocab: [], sentence: [], save: [] }
}

/** Fetch a single file content from data/ */
async function fetchFileContent(category: 'book' | 'vocab' | 'sentence' | 'save', name: string): Promise<{ text: string; blob: Blob }> {
  let res: Response | null = null

  // 1. Try dev server API
  try {
    res = await fetch(`/api/data/file?category=${category}&name=${encodeURIComponent(name)}`)
  } catch {}

  // 2. Fallback to static URL
  if (!res || !res.ok) {
    res = await fetch(`./data/${category}/${encodeURIComponent(name)}`)
  }

  if (!res.ok) {
    throw new Error(`Failed to load data/${category}/${name}: ${res.statusText}`)
  }

  const blob = await res.blob()
  const text = await blob.text()
  return { text, blob }
}

/** Load and import all data from Flashcard/data (book, vocab, sentence, save) */
export async function loadAllFromGitData(options?: {
  onProgress?: (message: string) => void
}): Promise<{
  booksCount: number
  vocabCount: number
  sentenceCount: number
  savesCount: number
}> {
  const manifest = await fetchDataManifest()
  const notify = options?.onProgress || (() => {})

  let booksCount = 0
  let vocabCount = 0
  let sentenceCount = 0
  let savesCount = 0

  // 1. Load Books from data/book
  for (const item of manifest.book) {
    try {
      notify(`Reading book: ${item.name}...`)
      const { text, blob } = await fetchFileContent('book', item.name)
      const ext = item.name.split('.').pop()?.toLowerCase()
      let parsedBook: { title: string; author: string[]; chapters: any[] } | null = null

      if (ext === 'json') {
        const json = JSON.parse(text)
        parsedBook = validateBookJson(json)
      } else if (ext === 'txt') {
        parsedBook = parseTxtToBook(item.name, text)
      } else if (ext === 'epub') {
        const file = new File([blob], item.name, { type: 'application/epub+zip' })
        parsedBook = await parseEpubToBook(file)
      }

      if (parsedBook) {
        const books = useTypingStore.getState().books
        const existing = books.find(
          b => b.title === parsedBook!.title && b.author.join('|') === parsedBook!.author.join('|')
        )
        useTypingStore.getState().importBook(parsedBook, existing?.id)
        booksCount++
      }
    } catch (e) {
      console.warn(`Error loading book "${item.name}":`, e)
    }
  }

  // 2. Load Word Cards from data/vocab
  const importedWordCards: Flashcard[] = []
  for (const item of manifest.vocab) {
    if (!item.name.toLowerCase().endsWith('.json')) continue
    try {
      notify(`Reading vocab: ${item.name}...`)
      const { text } = await fetchFileContent('vocab', item.name)
      const parsed = JSON.parse(text)
      let list: unknown[] = []
      if (Array.isArray(parsed)) {
        list = parsed
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).state?.flashcards)) {
        list = (parsed as any).state.flashcards
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).flashcards)) {
        list = (parsed as any).flashcards
      }

      for (const raw of list) {
        const card = migrateFlashcard(raw)
        if (isWordCard(card)) {
          importedWordCards.push(card)
        }
      }
    } catch (e) {
      console.warn(`Error loading vocab "${item.name}":`, e)
    }
  }

  // 3. Load Sentence Cards from data/sentence
  const importedSentenceCards: Flashcard[] = []
  for (const item of manifest.sentence) {
    if (!item.name.toLowerCase().endsWith('.json')) continue
    try {
      notify(`Reading sentences: ${item.name}...`)
      const { text } = await fetchFileContent('sentence', item.name)
      const parsed = JSON.parse(text)
      let list: unknown[] = []
      if (Array.isArray(parsed)) {
        list = parsed
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).state?.flashcards)) {
        list = (parsed as any).state.flashcards
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).flashcards)) {
        list = (parsed as any).flashcards
      }

      for (const raw of list) {
        const card = migrateFlashcard(raw)
        if (!isWordCard(card)) {
          importedSentenceCards.push(card)
        }
      }
    } catch (e) {
      console.warn(`Error loading sentence "${item.name}":`, e)
    }
  }

  // Merge cards into Flashcard store
  if (importedWordCards.length > 0 || importedSentenceCards.length > 0) {
    useFlashcardStore.setState(state => {
      const currentMap = new Map<string, Flashcard>()
      state.flashcards.forEach(c => currentMap.set(c.sentence.trim().toLowerCase(), c))

      // Merge word cards
      for (const card of importedWordCards) {
        const key = card.sentence.trim().toLowerCase()
        const existing = currentMap.get(key)
        if (existing) {
          // Merge tags
          const mergedTags = Array.from(new Set([...getCardTags(existing), ...getCardTags(card)]))
          currentMap.set(key, { ...existing, ...card, id: existing.id, tags: mergedTags })
        } else {
          currentMap.set(key, card)
        }
        vocabCount++
      }

      // Merge sentence cards
      for (const card of importedSentenceCards) {
        const key = card.sentence.trim().toLowerCase()
        const existing = currentMap.get(key)
        if (existing) {
          const mergedTags = Array.from(new Set([...getCardTags(existing), ...getCardTags(card)]))
          currentMap.set(key, { ...existing, ...card, id: existing.id, tags: mergedTags })
        } else {
          currentMap.set(key, card)
        }
        sentenceCount++
      }

      return { flashcards: Array.from(currentMap.values()) }
    })
  }

  // 4. Load Saves from data/save
  for (const item of manifest.save) {
    if (!item.name.toLowerCase().endsWith('.json')) continue
    try {
      notify(`Reading progress save: ${item.name}...`)
      const { text } = await fetchFileContent('save', item.name)
      const payload = parseBookSaveFile(text)

      // Merge progress into typingStore
      useTypingStore.setState(state => {
        const progress = { ...state.progress, [payload.bookId]: payload.progress }
        const lastPosition = { ...state.lastPosition }
        if (payload.lastPosition) {
          lastPosition[payload.bookId] = payload.lastPosition
        }
        const sentenceLinks = { ...state.sentenceLinks, ...payload.sentenceLinks }
        return { progress, lastPosition, sentenceLinks }
      })

      // Merge linked flashcards if present
      if (Array.isArray(payload.linkedCards) && payload.linkedCards.length > 0) {
        useFlashcardStore.setState(state => {
          const existingIds = new Set(state.flashcards.map(c => c.id))
          const existingSentences = new Set(state.flashcards.map(c => c.sentence.trim().toLowerCase()))
          const newCards = payload.linkedCards.filter(
            (c: Flashcard) => !existingIds.has(c.id) && !existingSentences.has(c.sentence.trim().toLowerCase())
          )
          return { flashcards: [...state.flashcards, ...newCards] }
        })
      }

      savesCount++
    } catch (e) {
      console.warn(`Error loading save "${item.name}":`, e)
    }
  }

  // Record timestamp of last sync
  useFlashcardStore.getState().updateSettings({ lastGitSync: Date.now() })

  return { booksCount, vocabCount, sentenceCount, savesCount }
}

/** Export all current data to Flashcard/data on local disk or download zip */
export async function exportAllToGitData(options?: {
  onProgress?: (message: string) => void
}): Promise<{
  isLocalDisk: boolean
  written: { vocab: number; sentence: number; books: number; saves: number }
}> {
  const notify = options?.onProgress || (() => {})
  notify('Preparing data for Git export...')

  const { flashcards } = useFlashcardStore.getState()
  const { books, progress, lastPosition, sentenceLinks } = useTypingStore.getState()

  // Separate word cards & sentence cards
  const vocabCards = flashcards.filter(c => isWordCard(c))
  const sentenceCards = flashcards.filter(c => !isWordCard(c))

  // Prepare saves payload per book
  const savesMap: Record<string, unknown> = {}
  for (const book of books) {
    const bookProg = progress[book.id]
    if (bookProg && Object.keys(bookProg).length > 0) {
      const bookLinks: Record<string, any> = {}
      const cardIds = new Set<string>()
      for (const [k, v] of Object.entries(sentenceLinks)) {
        if (k.startsWith(`${book.id}|`)) {
          bookLinks[k] = v
          if ((v as any)?.cardId) cardIds.add((v as any).cardId)
        }
      }
      const linkedCards = flashcards.filter(c => cardIds.has(c.id) || getCardTags(c).includes(book.title))
      savesMap[book.title] = {
        format: 'flashcard-book-save',
        version: 1,
        bookId: book.id,
        bookTitle: book.title,
        exportedAt: Date.now(),
        progress: bookProg,
        lastPosition: lastPosition[book.id] || null,
        sentenceLinks: bookLinks,
        linkedCards: linkedCards
      }
    }
  }

  const payload = {
    vocab: vocabCards,
    sentence: sentenceCards,
    books: books,
    saves: savesMap
  }

  // 1. Try sending directly to Vite dev server API
  const isDev = await isDevDataApiAvailable()
  if (isDev) {
    notify('Writing directly to Flashcard/data on disk...')
    const res = await fetch('/api/data/export-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const result = await res.json()
      useFlashcardStore.getState().updateSettings({ lastGitSync: Date.now() })
      return {
        isLocalDisk: true,
        written: result.written
      }
    }
  }

  // 2. Fallback: Generate ZIP archive with folders data/book, data/vocab, data/sentence, data/save
  notify('Packing data into zip archive...')
  const zip = new JSZip()
  const dataFolder = zip.folder('data') || zip

  // Vocab folder
  const vocabFolder = dataFolder.folder('vocab')
  if (vocabFolder) {
    vocabFolder.file('vocab.json', JSON.stringify(vocabCards, null, 2))
  }

  // Sentence folder
  const sentenceFolder = dataFolder.folder('sentence')
  if (sentenceFolder) {
    sentenceFolder.file('sentence.json', JSON.stringify(sentenceCards, null, 2))
  }

  // Book folder
  const bookFolder = dataFolder.folder('book')
  if (bookFolder) {
    for (const b of books) {
      const safeTitle = b.title.replace(/[^a-zA-Z0-9._\-]/g, '_')
      bookFolder.file(
        `${safeTitle}.json`,
        JSON.stringify({ book: { title: b.title, author: b.author, chapters: b.chapters } }, null, 2)
      )
    }
  }

  // Save folder
  const saveFolder = dataFolder.folder('save')
  if (saveFolder) {
    for (const [title, save] of Object.entries(savesMap)) {
      const safeTitle = title.replace(/[^a-zA-Z0-9._\-]/g, '_')
      saveFolder.file(`${safeTitle}.flashcard-save.json`, JSON.stringify(save, null, 2))
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flashcard-data-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  useFlashcardStore.getState().updateSettings({ lastGitSync: Date.now() })

  return {
    isLocalDisk: false,
    written: {
      vocab: vocabCards.length,
      sentence: sentenceCards.length,
      books: books.length,
      saves: Object.keys(savesMap).length
    }
  }
}

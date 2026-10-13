/**
 * dataPersistence.ts
 *
 * Write-through helpers: every mutation (add/edit/delete card or book) calls these
 * to keep the local data/ directory in sync so reloads don't lose changes.
 *
 * In production (no dev API), these are no-ops.
 */
import { Flashcard } from '../store'
import { Book } from '../typingStore'
import { isWordCard } from '../store'

// ── Internal helpers ──────────────────────────────────────────────────────────

let _apiAvailable: boolean | null = null
let _apiCheckTime = 0

async function isApiAvailable(): Promise<boolean> {
  const now = Date.now()
  if (_apiAvailable !== null && now - _apiCheckTime < 10_000) return _apiAvailable
  try {
    const res = await fetch('/api/data/list', { signal: AbortSignal.timeout(1500) })
    _apiAvailable = res.ok
  } catch {
    _apiAvailable = false
  }
  _apiCheckTime = now
  return _apiAvailable
}

async function apiWrite(category: string, name: string, content: unknown): Promise<boolean> {
  try {
    if (!(await isApiAvailable())) return false
    const res = await fetch('/api/data/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, name, content }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function apiDelete(category: string, name: string, title?: string): Promise<boolean> {
  try {
    if (!(await isApiAvailable())) return false
    const res = await fetch('/api/data/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, name, title }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write all vocab cards to data/vocab/vocab.json
 * and all sentence cards to data/sentence/sentence.json
 */
export async function saveFlashcardsToData(flashcards: Flashcard[]): Promise<void> {
  const vocabCards = flashcards.filter(c => isWordCard(c))
  const sentenceCards = flashcards.filter(c => !isWordCard(c))
  await Promise.all([
    vocabCards.length > 0
      ? apiWrite('vocab', 'vocab.json', vocabCards)
      : Promise.resolve(true),
    sentenceCards.length > 0
      ? apiWrite('sentence', 'sentence.json', sentenceCards)
      : Promise.resolve(true),
  ])
}

/**
 * Write a single book to data/book/<sanitized-title>.json
 */
export async function saveBookToData(book: Book): Promise<void> {
  const safeTitle = book.title.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const content = {
    book: {
      title: book.title,
      author: book.author,
      chapters: book.chapters,
    }
  }
  await apiWrite('book', `${safeTitle}.json`, content)
}

/**
 * Write an epub/txt/json file object to data/book/<filename> (binary safe via base64)
 */
export async function saveBookFileToData(file: File): Promise<void> {
  try {
    if (!(await isApiAvailable())) return
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')
    const arrayBuf = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuf)
    let binary = ''
    uint8.forEach(byte => { binary += String.fromCharCode(byte) })
    const base64 = btoa(binary)
    await fetch('/api/data/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'book', name: safeFilename, content: base64, isBase64: true }),
    })
  } catch {
    // Silently ignore
  }
}

/**
 * Delete a book from data/book/ by its title and optional fileName
 */
export async function deleteBookFromData(bookTitle: string, fileName?: string): Promise<void> {
  const safeTitle = bookTitle.replace(/[^a-zA-Z0-9._\-]/g, '_')
  await Promise.all([
    apiDelete('book', `${safeTitle}.json`, bookTitle),
    fileName ? apiDelete('book', fileName, bookTitle) : Promise.resolve(true),
  ])
}

/**
 * Delete a book file from data/book/ by its exact filename (epub/txt)
 */
export async function deleteBookFileFromData(filename: string): Promise<void> {
  await apiDelete('book', filename)
}

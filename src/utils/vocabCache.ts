/**
 * vocabCache.ts
 *
 * Lazy-load vocab data from data/vocab/{letter}.json on demand.
 * Each file is fetched at most once and cached in-memory for the session.
 *
 * The 26 vocab files (a.json – z.json) each contain a Zustand persist snapshot:
 *   { state: { flashcards: [...] }, version: number }
 *
 * Only the file corresponding to the first letter of the searched word is loaded,
 * so a 500 MB corpus never hits the network at startup.
 */

import { Flashcard, migrateFlashcard, isWordCard } from '../store'

// ── Cache state ──────────────────────────────────────────────────────────────

/** letter → Map<word_lowercase, Flashcard> */
const letterCache = new Map<string, Map<string, Flashcard>>()

/** Inflight fetch promises so parallel calls for the same letter don't double-fetch */
const pendingLoads = new Map<string, Promise<void>>()

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchVocabFile(letter: string): Promise<string> {
  const name = `${letter}.json`

  // 1. Dev server API
  try {
    const res = await fetch(`/api/data/file?category=vocab&name=${name}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return res.text()
  } catch {}

  // 2. Static URL (production build / GitHub Pages)
  try {
    const res = await fetch(`./data/vocab/${name}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) return res.text()
  } catch {}

  // 3. GitHub raw fallback
  const res = await fetch(
    `https://raw.githubusercontent.com/dduchhuy/flashcard/main/data/vocab/${name}`,
    { signal: AbortSignal.timeout(20000) }
  )
  if (!res.ok) throw new Error(`Failed to load vocab/${name}: ${res.statusText}`)
  return res.text()
}

function parseVocabText(text: string): Flashcard[] {
  const parsed = JSON.parse(text)
  let list: unknown[] = []

  if (Array.isArray(parsed)) {
    list = parsed
  } else if (parsed?.state?.flashcards && Array.isArray(parsed.state.flashcards)) {
    list = parsed.state.flashcards
  } else if (parsed?.flashcards && Array.isArray(parsed.flashcards)) {
    list = parsed.flashcards
  }

  return list
    .map((raw) => migrateFlashcard(raw as any))
    .filter((c) => isWordCard(c))
}

// ── Core: ensure a letter is loaded ──────────────────────────────────────────

export async function ensureLetterLoaded(letter: string): Promise<void> {
  const l = letter.toLowerCase()
  if (letterCache.has(l)) return // already cached

  // Deduplicate concurrent calls
  if (pendingLoads.has(l)) {
    await pendingLoads.get(l)
    return
  }

  const promise = (async () => {
    try {
      const text = await fetchVocabFile(l)
      const cards = parseVocabText(text)
      const map = new Map<string, Flashcard>()
      for (const card of cards) {
        map.set(card.sentence.trim().toLowerCase(), card)
      }
      letterCache.set(l, map)
    } finally {
      pendingLoads.delete(l)
    }
  })()

  pendingLoads.set(l, promise)
  await promise
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lookup a single word in the dictionary (exact, case-insensitive).
 * Loads the corresponding letter file lazily on first use.
 */
export async function lookupVocabWord(word: string): Promise<Flashcard | null> {
  if (!word || !word.trim()) return null
  const key = word.trim().toLowerCase()
  const firstLetter = key[0]
  if (!/^[a-z]$/.test(firstLetter)) return null

  await ensureLetterLoaded(firstLetter)
  return letterCache.get(firstLetter)?.get(key) ?? null
}

/**
 * Search for words whose headword starts with `prefix` (case-insensitive).
 * Loads the corresponding letter file lazily on first use.
 * Returns at most `limit` results (default 20).
 */
export async function searchVocabByPrefix(
  prefix: string,
  limit = 20
): Promise<Flashcard[]> {
  if (!prefix || !prefix.trim()) return []
  const key = prefix.trim().toLowerCase()
  const firstLetter = key[0]
  if (!/^[a-z]$/.test(firstLetter)) return []

  await ensureLetterLoaded(firstLetter)
  const map = letterCache.get(firstLetter)
  if (!map) return []

  const results: Flashcard[] = []
  for (const [word, card] of map) {
    if (word.startsWith(key)) {
      results.push(card)
      if (results.length >= limit) break
    }
  }
  return results
}

/**
 * Check if a letter has already been loaded into cache (no network call).
 */
export function isLetterCached(letter: string): boolean {
  return letterCache.has(letter.toLowerCase())
}

/**
 * Return how many letters are currently cached.
 */
export function getCachedLetterCount(): number {
  return letterCache.size
}

/**
 * Evict all cached letters to free memory (e.g. on low-memory signal).
 */
export function clearVocabCache(): void {
  letterCache.clear()
  pendingLoads.clear()
}

/**
 * Preload a list of letters in the background without blocking.
 * Useful for pre-warming common letters (e.g. s, c, p) after app is idle.
 */
export function preloadLetters(letters: string[]): void {
  for (const l of letters) {
    if (!letterCache.has(l.toLowerCase()) && !pendingLoads.has(l.toLowerCase())) {
      ensureLetterLoaded(l).catch(() => {/* silently ignore preload failures */})
    }
  }
}

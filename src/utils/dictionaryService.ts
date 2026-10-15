/**
 * dictionaryService.ts
 *
 * High-performance dictionary lookup & prefix search for 160,000 words.
 *
 * 1. Dev Server: Queries SQLite `data/dictionary.db` directly via `/api/dict/lookup` (< 1ms)
 * 2. Static / PWA Fallback: Fetches 2-letter prefix shard `data/dict/{prefix}.json` (< 150KB, 10-30ms)
 * 3. In-memory LRU Cache: Re-looking up already searched words takes 0ms.
 */

import { Flashcard, migrateFlashcard } from '../store'
import { lookupVocabWord, searchVocabByPrefix } from './vocabCache'

export interface DictionarySearchResult {
  word: string
  phonetic?: string
  pos?: string
}

const wordCache = new Map<string, Flashcard>()
const shardCache = new Map<string, Record<string, Flashcard>>()
const pendingShards = new Map<string, Promise<Record<string, Flashcard>>>()

function getPrefix(word: string): string {
  const w = word.trim().toLowerCase()
  if (w.length >= 2 && /^[a-z]{2}$/.test(w.slice(0, 2))) {
    return w.slice(0, 2)
  }
  if (w.length >= 1 && /^[a-z]$/.test(w[0])) {
    return w[0] + '_'
  }
  return '__'
}

/**
 * Fetch a prefix shard from static storage (used when SQLite dev API is unavailable)
 */
async function fetchShard(prefix: string): Promise<Record<string, Flashcard>> {
  if (shardCache.has(prefix)) {
    return shardCache.get(prefix)!
  }

  if (pendingShards.has(prefix)) {
    return pendingShards.get(prefix)!
  }

  const promise = (async () => {
    try {
      const urls = [
        `/api/data/file?category=dict&name=${prefix}.json`,
        `./data/dict/${prefix}.json`,
        `https://raw.githubusercontent.com/dduchhuy/flashcard/main/data/dict/${prefix}.json`
      ]

      let data: Record<string, Flashcard> | null = null
      for (const url of urls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
          if (res.ok) {
            data = await res.json()
            break
          }
        } catch {}
      }

      const map = data || {}
      shardCache.set(prefix, map)
      return map
    } finally {
      pendingShards.delete(prefix)
    }
  })()

  pendingShards.set(prefix, promise)
  return promise
}

/**
 * Lookup full dictionary card data for a word.
 * Returns null if the word does not exist in the dictionary.
 */
export async function lookupDictionaryWord(word: string): Promise<Flashcard | null> {
  const cleanWord = word.trim().toLowerCase()
  if (!cleanWord) return null

  // 1. In-memory cache hit
  if (wordCache.has(cleanWord)) {
    return wordCache.get(cleanWord)!
  }

  // 2. Try Vite SQLite Dev API
  try {
    const res = await fetch(`/api/dict/lookup?word=${encodeURIComponent(cleanWord)}`, {
      signal: AbortSignal.timeout(2000)
    })
    if (res.ok) {
      const raw = await res.json()
      const card = migrateFlashcard(raw)
      wordCache.set(cleanWord, card)
      return card
    }
  } catch {}

  // 3. Fallback: Fetch 2-letter shard file
  try {
    const prefix = getPrefix(cleanWord)
    const shard = await fetchShard(prefix)
    const raw = shard[cleanWord]
    if (raw) {
      const card = migrateFlashcard(raw)
      wordCache.set(cleanWord, card)
      return card
    }
  } catch {}

  // 4. Ultimate Fallback: Single-letter vocab file (a.json - z.json)
  try {
    const card = await lookupVocabWord(cleanWord)
    if (card) {
      wordCache.set(cleanWord, card)
      return card
    }
  } catch {}

  return null
}

/**
 * Fast prefix search for autocomplete / suggestions.
 */
export async function searchDictionaryPrefix(
  prefix: string,
  limit = 15
): Promise<DictionarySearchResult[]> {
  const clean = prefix.trim().toLowerCase()
  if (!clean) return []

  // 1. Try Vite SQLite Dev API
  try {
    const res = await fetch(`/api/dict/search?prefix=${encodeURIComponent(clean)}&limit=${limit}`, {
      signal: AbortSignal.timeout(2000)
    })
    if (res.ok) {
      const list = await res.json()
      if (Array.isArray(list)) {
        return list.map((item: any) => ({
          word: item.word || '',
          phonetic: item.phonetic || '',
          pos: item.pos || ''
        }))
      }
    }
  } catch {}

  // 2. Fallback: Use shard file
  try {
    const prefixKey = getPrefix(clean)
    const shard = await fetchShard(prefixKey)
    const results: DictionarySearchResult[] = []
    for (const [w, card] of Object.entries(shard)) {
      if (w.startsWith(clean)) {
        results.push({
          word: w,
          phonetic: card.phonetic || '',
          pos: card.partOfSpeech || ''
        })
        if (results.length >= limit) break
      }
    }
    return results
  } catch {}

  // 3. Ultimate Fallback: Single-letter vocab search
  try {
    const list = await searchVocabByPrefix(clean, limit)
    return list.map(c => ({
      word: c.sentence,
      phonetic: c.phonetic || '',
      pos: c.partOfSpeech || ''
    }))
  } catch {}

  return []
}

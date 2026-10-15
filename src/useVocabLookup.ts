/**
 * useVocabLookup.ts
 *
 * React hook that wraps vocabCache for use inside components.
 *
 * Usage:
 *   const { lookupWord, searchPrefix, isLoading } = useVocabLookup()
 *
 *   // Exact lookup (e.g. when user types a word in "Add Word" form)
 *   const card = await lookupWord('example')
 *
 *   // Prefix search (e.g. autocomplete suggestions)
 *   const suggestions = await searchPrefix('exa', 10)
 */

import { useState, useCallback, useRef } from 'react'
import { Flashcard } from './store'
import {
  lookupDictionaryWord,
  searchDictionaryPrefix,
  DictionarySearchResult
} from './utils/dictionaryService'

export interface UseVocabLookupReturn {
  /** Lookup a single word by exact match. Returns null if not found. */
  lookupWord: (word: string) => Promise<Flashcard | null>
  /** Search words by prefix for autocomplete suggestions. */
  searchPrefix: (prefix: string, limit?: number) => Promise<DictionarySearchResult[]>
  /** True while any fetch is in progress */
  isLoading: boolean
}

export function useVocabLookup(): UseVocabLookupReturn {
  const [isLoading, setIsLoading] = useState(false)
  const pendingCount = useRef(0)

  const wrap = useCallback(<T>(fn: () => Promise<T>): Promise<T> => {
    pendingCount.current++
    setIsLoading(true)
    return fn().finally(() => {
      pendingCount.current--
      if (pendingCount.current <= 0) {
        pendingCount.current = 0
        setIsLoading(false)
      }
    })
  }, [])

  const lookupWord = useCallback(
    (word: string) => wrap(() => lookupDictionaryWord(word)),
    [wrap]
  )

  const searchPrefix = useCallback(
    (prefix: string, limit = 15) => wrap(() => searchDictionaryPrefix(prefix, limit)),
    [wrap]
  )

  return { lookupWord, searchPrefix, isLoading }
}

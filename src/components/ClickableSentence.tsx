import { Flashcard, isWordCard } from '../store'

/**
 * Builds a fast lookup map from lowercase word / headword to Flashcard.
 * Prioritizes word-mode cards, then any short headword cards.
 */
export function buildWordToFlashcardMap(flashcards: Flashcard[]): Map<string, Flashcard> {
  const map = new Map<string, Flashcard>()
  for (const card of flashcards) {
    if (isWordCard(card) || card.sentence.trim().split(/\s+/).length <= 2) {
      const key = card.sentence.trim().toLowerCase()
      if (key && !map.has(key)) {
        map.set(key, card)
      }
    }
  }
  return map
}

/**
 * Finds a matching flashcard in the map for a given word token.
 * Supports exact match as well as common English morphological inflections (plurals, -ing, -ed, -ies).
 */
export function findMatchingCard(rawWord: string, map: Map<string, Flashcard>): Flashcard | undefined {
  if (!rawWord) return undefined
  const clean = rawWord.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim().toLowerCase()
  if (!clean || clean.length < 2) return undefined

  // 1. Exact match
  if (map.has(clean)) return map.get(clean)

  // 2. Simple inflections
  if (clean.endsWith('ies') && clean.length > 4) {
    const candidate = clean.slice(0, -3) + 'y'
    if (map.has(candidate)) return map.get(candidate)
  }
  if (clean.endsWith('es') && clean.length > 4) {
    const candidate = clean.slice(0, -2)
    if (map.has(candidate)) return map.get(candidate)
  }
  if (clean.endsWith('s') && clean.length > 3 && !clean.endsWith('ss')) {
    const candidate = clean.slice(0, -1)
    if (map.has(candidate)) return map.get(candidate)
  }
  if (clean.endsWith('ing') && clean.length > 5) {
    const candidate1 = clean.slice(0, -3)
    if (map.has(candidate1)) return map.get(candidate1)
    const candidate2 = clean.slice(0, -3) + 'e'
    if (map.has(candidate2)) return map.get(candidate2)
    if (candidate1.length > 2 && candidate1[candidate1.length - 1] === candidate1[candidate1.length - 2]) {
      const candidate3 = candidate1.slice(0, -1)
      if (map.has(candidate3)) return map.get(candidate3)
    }
  }
  if (clean.endsWith('ed') && clean.length > 4) {
    const candidate1 = clean.slice(0, -2)
    if (map.has(candidate1)) return map.get(candidate1)
    const candidate2 = clean.slice(0, -1)
    if (map.has(candidate2)) return map.get(candidate2)
    if (candidate1.length > 2 && candidate1[candidate1.length - 1] === candidate1[candidate1.length - 2]) {
      const candidate3 = candidate1.slice(0, -1)
      if (map.has(candidate3)) return map.get(candidate3)
    }
  }

  return undefined
}

interface ClickableSentenceProps {
  sentence: string
  enabled?: boolean
  flashcardWordMap: Map<string, Flashcard>
  currentCardId?: string
  onWordClick: (card: Flashcard) => void
  className?: string
}

/**
 * Renders an English sentence where any word matching an existing flashcard
 * is rendered as an interactive clickable link that triggers the card detail popup.
 */
export function ClickableSentence({
  sentence,
  enabled = true,
  flashcardWordMap,
  currentCardId,
  onWordClick,
  className = ''
}: ClickableSentenceProps) {
  if (!sentence) return null
  if (!enabled) return <span className={className}>{sentence}</span>

  // Tokenize text into words and punctuation/whitespace
  const tokens = sentence.split(/(\s+|[.,!?;:"'()[\]{}<>]+)/)

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (!token) return null
        if (/^\s+$/.test(token) || /^[.,!?;:"'()[\]{}<>]+$/.test(token)) {
          return <span key={idx}>{token}</span>
        }

        const matched = findMatchingCard(token, flashcardWordMap)
        if (matched && matched.id !== currentCardId) {
          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                onWordClick(matched)
              }}
              title={`View flashcard: ${matched.sentence}`}
              className="cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {token}
            </span>
          )
        }

        return <span key={idx}>{token}</span>
      })}
    </span>
  )
}

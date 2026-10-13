import { useState, useEffect, useMemo, useCallback } from "react"
import { useFlashcardStore, Flashcard, getCardTags, isWordCard, PhraseIdiom, normalizePhraseItem } from "../store"
import { speakEnglish } from "../utils"
import { CardDetailModal } from "./CardDetailModal"
import { Volume2, Shuffle, BookOpen, Sparkles, Tag, ArrowRight } from "lucide-react"

type FeaturedItem = 
  | { type: "word"; card: Flashcard }
  | { type: "phrase"; card: Flashcard; phrase: PhraseIdiom }

export function TabHome() {
  const { flashcards, settings } = useFlashcardStore()
  const [featuredItem, setFeaturedItem] = useState<FeaturedItem | null>(null)
  const [popupCard, setPopupCard] = useState<Flashcard | null>(null)

  // Collect candidate items according to settings
  const candidates = useMemo<FeaturedItem[]>(() => {
    if (flashcards.length === 0) return []
    const randomType = settings.homeRandomType || "all"

    const wordCandidates: FeaturedItem[] = flashcards
      .filter(f => isWordCard(f))
      .map(card => ({ type: "word", card }))

    const phraseCandidates: FeaturedItem[] = flashcards.flatMap(card => {
      const phrases = (card.phrasesAndIdioms || []).map(normalizePhraseItem).filter(p => p.phrase && p.translation)
      return phrases.map(phrase => ({ type: "phrase", card, phrase }))
    })

    if (randomType === "words") {
      return wordCandidates.length > 0 ? wordCandidates : flashcards.map(card => ({ type: "word", card }))
    }
    if (randomType === "phrases") {
      return phraseCandidates.length > 0 ? phraseCandidates : []
    }
    // "all": both words and phrases
    const combined = [...wordCandidates, ...phraseCandidates]
    return combined.length > 0 ? combined : flashcards.map(card => ({ type: "word", card }))
  }, [flashcards, settings.homeRandomType])

  const pickRandom = useCallback(() => {
    if (candidates.length === 0) {
      setFeaturedItem(null)
      return
    }
    const randomIndex = Math.floor(Math.random() * candidates.length)
    setFeaturedItem(candidates[randomIndex])
  }, [candidates])

  // Initial pick on mount or when candidates change
  useEffect(() => {
    if (!featuredItem && candidates.length > 0) {
      pickRandom()
    }
  }, [candidates, featuredItem, pickRandom])

  // Timer interval rotation if enabled in settings
  useEffect(() => {
    if (settings.homeUpdateTrigger !== "timer") return
    const intervalMinutes = settings.homeTimerMinutes || 10
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000

    const timer = setInterval(() => {
      pickRandom()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [settings.homeUpdateTrigger, settings.homeTimerMinutes, pickRandom])

  if (flashcards.length === 0 || !featuredItem) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center animate-in fade-in">
        <div className="p-4 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-3xl w-20 h-20 mx-auto flex items-center justify-center mb-5">
          <Sparkles size={36} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Welcome to Flashcards!</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6 text-sm">
          No flashcards found. Create your first flashcard to start exploring words and phrases on your Home screen.
        </p>
        <a
          href="#/add"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all shadow-md hover:shadow-lg"
        >
          Add Flashcard <ArrowRight size={16} />
        </a>
      </div>
    )
  }

  const isWord = featuredItem.type === "word"
  const card = featuredItem.card
  const tags = getCardTags(card)

  // Primary text to pronounce
  const headwordText = isWord ? card.sentence : (featuredItem as { phrase: PhraseIdiom }).phrase.phrase

  // Part of speech
  const primaryPos = isWord 
    ? (card.partOfSpeech || card.posEntries?.[0]?.partOfSpeech || "")
    : ((featuredItem as { phrase: PhraseIdiom }).phrase.type || "phrase")

  // Phonetic
  const primaryPhonetic = isWord 
    ? (card.phonetic || card.phonetics?.[0]?.ipa || card.posEntries?.[0]?.phonetic || "")
    : ""

  // Meanings / Definitions
  const meaningsList = isWord 
    ? (card.posEntries && card.posEntries.length > 0 
        ? card.posEntries.flatMap(p => p.meanings.map(m => ({ pos: p.partOfSpeech, meaning: m.meaning, examples: m.examples })))
        : (card.highlights || []).map(h => ({ pos: card.partOfSpeech, meaning: h.meaning, examples: h.example ? [{ sentence: h.example, translation: undefined as string | undefined }] : [] })))
    : []

  const phraseTranslation = !isWord ? (featuredItem as { phrase: PhraseIdiom }).phrase.translation : ""

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-6 animate-in fade-in">
      {/* Top Banner / Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">
              {isWord ? "Featured Vocabulary" : "Featured Phrase & Idiom"}
            </h2>
            <p className="text-xs text-gray-400">
              {settings.homeUpdateTrigger === "timer" 
                ? `Rotates every ${settings.homeTimerMinutes || 10} minutes` 
                : "Randomly picked for you"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={pickRandom}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
          title="Pick another random item"
        >
          <Shuffle size={15} className="text-purple-500" />
          <span>Next Random</span>
        </button>
      </div>

      {/* Featured Hero Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-100 dark:border-gray-700/80 p-6 sm:p-8 space-y-6 relative overflow-hidden transition-all">
        {/* Decorative background element */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-purple-400/10 to-indigo-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Headword Section */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isWord 
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                  : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
              }`}>
                {isWord ? "Word" : "Phrase & Idiom"}
              </span>

              {primaryPos && (
                <span className="text-xs italic font-medium px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {primaryPos}
                </span>
              )}

              {primaryPhonetic && (
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                  /{primaryPhonetic.replace(/^\/|\/$/g, "")}/
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-white capitalize break-words tracking-tight">
                {headwordText}
              </h1>

              <button
                type="button"
                onClick={() => speakEnglish(headwordText)}
                className="p-2.5 rounded-2xl text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors shrink-0 cursor-pointer"
                title="Pronounce"
              >
                <Volume2 size={26} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPopupCard(card)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-xl text-xs sm:text-sm font-semibold border border-purple-200/60 dark:border-purple-800/60 transition-colors shrink-0 cursor-pointer"
            title="Open complete flashcard popup"
          >
            <BookOpen size={16} />
            <span>Card Details</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-700/80" />

        {/* Meaning / Content Area */}
        <div className="space-y-4">
          {isWord ? (
            meaningsList.length > 0 ? (
              <div className="space-y-4">
                {meaningsList.slice(0, 3).map((m, mIdx) => (
                  <div key={mIdx} className="space-y-1.5 bg-gray-50/70 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
                        #{mIdx + 1}
                      </span>
                      {m.pos && (
                        <span className="text-[11px] font-medium italic text-gray-400">
                          ({m.pos})
                        </span>
                      )}
                      <p className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">
                        {m.meaning}
                      </p>
                    </div>

                    {m.examples && m.examples.length > 0 && m.examples[0].sentence && (
                      <div className="ml-5 text-sm text-gray-600 dark:text-gray-400 italic">
                        &ldquo;{m.examples[0].sentence}&rdquo;
                        {m.examples[0].translation && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500 not-italic mt-0.5">
                            {m.examples[0].translation}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl text-base text-gray-700 dark:text-gray-300">
                {card.translation || "No definition available"}
              </div>
            )
          ) : (
            <div className="space-y-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                Meaning & Translation
              </span>
              <p className="text-xl sm:text-2xl font-bold text-indigo-950 dark:text-indigo-100 break-words whitespace-pre-wrap">
                {phraseTranslation}
              </p>
              {card.sentence && card.sentence !== headwordText && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                  From word / context: <span className="font-semibold">{card.sentence}</span>
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              <Tag size={14} className="text-gray-400" />
              {tags.map(t => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Detail Popup Modal */}
      <CardDetailModal
        card={popupCard}
        isOpen={!!popupCard}
        onClose={() => setPopupCard(null)}
      />
    </div>
  )
}

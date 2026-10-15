import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Check, Volume2, BookOpen, Loader2 } from 'lucide-react'
import { lookupDictionaryWord, searchDictionaryPrefix, DictionarySearchResult } from '../utils/dictionaryService'
import { Flashcard, useFlashcardStore } from '../store'

interface Props {
  isOpen: boolean
  onClose: () => void
  initialWord?: string
}

export function DictionaryModal({ isOpen, onClose, initialWord = '' }: Props) {
  const [query, setQuery] = useState(initialWord)
  const [suggestions, setSuggestions] = useState<DictionarySearchResult[]>([])
  const [selectedWord, setSelectedWord] = useState<Flashcard | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [addedSuccess, setAddedSuccess] = useState(false)

  const { flashcards, addWordCard } = useFlashcardStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<any>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery(initialWord)
      if (initialWord) {
        handleLookup(initialWord)
      } else {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } else {
      setSuggestions([])
      setSelectedWord(null)
      setAddedSuccess(false)
    }
  }, [isOpen, initialWord])

  // Autocomplete search on typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    const clean = val.trim().toLowerCase()
    if (!clean) {
      setSuggestions([])
      return
    }

    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchDictionaryPrefix(clean, 12)
        setSuggestions(results)
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 150)
  }

  const handleLookup = async (wordToLookup: string) => {
    if (!wordToLookup.trim()) return
    setIsLoading(true)
    setSuggestions([])
    setAddedSuccess(false)
    try {
      const card = await lookupDictionaryWord(wordToLookup)
      setSelectedWord(card)
    } catch {
      setSelectedWord(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && query.toLowerCase() !== suggestions[0].word) {
        handleLookup(suggestions[0].word)
      } else if (query.trim()) {
        handleLookup(query)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const isAlreadyInFlashcards = selectedWord
    ? flashcards.some(f => f.sentence.trim().toLowerCase() === selectedWord.sentence.trim().toLowerCase())
    : false

  const handleAddToFlashcard = () => {
    if (!selectedWord) return

    addWordCard(
      selectedWord.sentence,
      selectedWord.posEntries || [],
      selectedWord.phrasesAndIdioms,
      selectedWord.tags || ['Dictionary'],
      selectedWord.phonetic,
      selectedWord.usageNotes
    )

    setAddedSuccess(true)
    setTimeout(() => setAddedSuccess(false), 2500)
  }

  const playAudio = (word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(word)
      u.lang = 'en-US'
      window.speechSynthesis.speak(u)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header Search Box */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/80 dark:bg-gray-900/60 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tra từ điển (160.000 từ siêu tốc)..."
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            {isSearching && (
              <Loader2 size={16} className="absolute right-9 top-1/2 -translate-y-1/2 text-purple-600 animate-spin" />
            )}
            {query && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setSuggestions([])
                  setSelectedWord(null)
                  inputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && !selectedWord && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mb-2">
                Gợi ý từ ({suggestions.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {suggestions.map((item) => (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => {
                      setQuery(item.word)
                      handleLookup(item.word)
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 text-left transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                  >
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">{item.word}</span>
                      {item.phonetic && (
                        <span className="ml-2 text-xs text-purple-600 dark:text-purple-400 font-mono">{item.phonetic}</span>
                      )}
                    </div>
                    {item.pos && (
                      <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">
                        {item.pos}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="animate-spin text-purple-600" size={32} />
              <span className="text-sm">Đang tra cứu cơ sở dữ liệu...</span>
            </div>
          )}

          {/* Word Details (Full Cambridge / vdict style) */}
          {selectedWord && !isLoading && (
            <div className="space-y-5 animate-in fade-in">
              {/* Headword & Pronunciation */}
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-700/80 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white capitalize">
                      {selectedWord.sentence}
                    </h2>
                    <button
                      type="button"
                      onClick={() => playAudio(selectedWord.sentence)}
                      className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 hover:scale-105 active:scale-95 transition-all"
                      title="Nghe phát âm"
                    >
                      <Volume2 size={20} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {selectedWord.phonetic && (
                      <span className="text-sm font-mono text-purple-600 dark:text-purple-400 font-medium">
                        {selectedWord.phonetic}
                      </span>
                    )}
                    {selectedWord.partOfSpeech && (
                      <span className="text-xs bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                        {selectedWord.partOfSpeech}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add to Flashcard Button */}
                <div>
                  {isAlreadyInFlashcards || addedSuccess ? (
                    <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs px-3.5 py-2 rounded-xl font-bold">
                      <Check size={16} /> Đã có trong Flashcards
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddToFlashcard}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus size={16} /> Lưu vào Flashcards
                    </button>
                  )}
                </div>
              </div>

              {/* POS Entries & Meanings */}
              {selectedWord.posEntries && selectedWord.posEntries.length > 0 && (
                <div className="space-y-4">
                  {selectedWord.posEntries.map((pos, pIdx) => (
                    <div key={pIdx} className="space-y-3">
                      {pos.partOfSpeech && (
                        <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-lg w-fit border border-purple-200 dark:border-purple-800">
                          {pos.partOfSpeech}
                        </div>
                      )}

                      <div className="space-y-2.5 pl-2">
                        {pos.meanings?.map((m, mIdx) => (
                          <div key={mIdx} className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <span className="text-purple-600 font-bold text-sm leading-tight">•</span>
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                {m.meaning}
                              </div>
                            </div>

                            {/* Examples */}
                            {m.examples && m.examples.length > 0 && (
                              <div className="pl-4 space-y-1">
                                {m.examples.map((ex, exIdx) => (
                                  <div key={exIdx} className="text-xs text-gray-600 dark:text-gray-300 italic border-l-2 border-purple-200 dark:border-purple-800 pl-2 py-0.5">
                                    <p>&ldquo;{ex.sentence}&rdquo;</p>
                                    {ex.translation && (
                                      <p className="text-gray-500 dark:text-gray-400 not-italic">{ex.translation}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phrases and Idioms */}
              {selectedWord.phrasesAndIdioms && selectedWord.phrasesAndIdioms.length > 0 && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Cụm từ & Thành ngữ liên quan ({selectedWord.phrasesAndIdioms.length})
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedWord.phrasesAndIdioms.slice(0, 8).map((pi, piIdx) => (
                      <div key={piIdx} className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-700/60 text-xs">
                        <span className="font-bold text-purple-700 dark:text-purple-400">{pi.phrase}</span>
                        {pi.translation && (
                          <span className="text-gray-600 dark:text-gray-300 ml-2">— {pi.translation}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state / Prompt */}
          {!selectedWord && !isLoading && suggestions.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400 gap-3">
              <div className="w-14 h-14 rounded-3xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <BookOpen size={28} />
              </div>
              <div>
                <p className="font-bold text-gray-700 dark:text-gray-300 text-base">Từ điển 160.000 từ siêu tốc</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  Gõ bất kỳ từ tiếng Anh nào để xem phát âm, nghĩa, ví dụ và lưu nhanh vào bộ thẻ học.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

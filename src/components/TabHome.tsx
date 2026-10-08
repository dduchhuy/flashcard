import { useState, useRef } from 'react'
import { useFlashcardStore, getCardTags } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { Plus, Sparkles, Tag, X, Check, BookOpen, Command, Lock, Unlock, Type, FileText } from 'lucide-react'
import { extractWordsAndSpaces } from '../utils'

export function TabHome() {
  const { flashcards, addFlashcard } = useFlashcardStore()
  const [newSentence, setNewSentence] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [isTagsLocked, setIsTagsLocked] = useState(false)
  const [inputMode, setInputMode] = useState<'sentence' | 'word'>('sentence')
  const [wordMeanings, setWordMeanings] = useState([{ meaning: '', example: '' }])
  const [phoneticInput, setPhoneticInput] = useState('')
  const [partOfSpeechInput, setPartOfSpeechInput] = useState('')
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const existingTags = Array.from(new Set(flashcards.flatMap(f => getCardTags(f))))

  const addTagChip = (tag: string) => {
    const trimmed = tag.trim().replace(/^#/, '')
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed])
    }
  }

  const removeTagChip = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagInput.trim()) {
        addTagChip(tagInput)
        setTagInput('')
      }
    }
  }

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    // Combine typed input in tag box if any remains
    let finalTags = [...selectedTags]
    if (tagInput.trim()) {
      const typed = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      typed.forEach(t => {
        if (!finalTags.includes(t)) finalTags.push(t)
      })
    }

    if (newSentence.trim()) {
      if (inputMode === 'sentence') {
        addFlashcard(newSentence, finalTags, undefined, phoneticInput, partOfSpeechInput)
      } else {
        const { words } = extractWordsAndSpaces(newSentence)
        const indices = Array.from({ length: words.length }, (_, i) => i)
        const highlights = wordMeanings
          .filter(m => m.meaning.trim() !== '')
          .map(m => ({
            wordIndices: indices,
            meaning: m.meaning.trim(),
            example: m.example?.trim()
          }))
        addFlashcard(newSentence, finalTags, highlights, phoneticInput, partOfSpeechInput)
        setWordMeanings([{ meaning: '', example: '' }])
      }

      setNewSentence('')
      setPhoneticInput('')
      setPartOfSpeechInput('')
      if (!isTagsLocked) {
        setTagInput('')
        setSelectedTags([])
      }
      
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2500)
      textareaRef.current?.focus()
    }
  }

  const wordCount = newSentence.trim() ? newSentence.trim().split(/\s+/).length : 0

  const recentFlashcards = [...flashcards]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
      {/* Main Add Card Box */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-6 sm:p-7 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add New Flashcard</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Create a flashcard from a sentence or a word</p>
            </div>
          </div>

          {showSuccess && (
            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs px-3 py-1.5 rounded-full animate-in fade-in slide-in-from-right-4">
              <Check size={14} />
              <span className="font-medium">Card added!</span>
            </div>
          )}
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl w-fit mb-5">
          <button
            type="button"
            onClick={() => setInputMode('sentence')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'sentence' ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Type size={16} /> Sentence
          </button>
          <button
            type="button"
            onClick={() => setInputMode('word')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'word' ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <FileText size={16} /> Flashcard
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          {inputMode === 'sentence' ? (
            <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:border-purple-500 dark:focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all p-3.5">
              <textarea
                ref={textareaRef}
                value={newSentence}
                onChange={(e) => setNewSentence(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="Type or paste your sentence here (e.g. 'She decided to pursue her passion for digital art.')..."
                className="w-full bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg leading-relaxed focus:outline-none resize-none min-h-[90px]"
                rows={3}
              />
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <input
                  value={phoneticInput}
                  onChange={(e) => setPhoneticInput(e.target.value)}
                  placeholder="Phonetic (optional)"
                  className="w-full sm:w-1/3 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none"
                />
                <input
                  value={partOfSpeechInput}
                  onChange={(e) => setPartOfSpeechInput(e.target.value)}
                  placeholder="Part of speech (e.g. noun, verb)"
                  className="w-full sm:w-1/3 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none sm:border-l sm:border-gray-100 sm:dark:border-gray-700/60 sm:pl-3"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-400">
                <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                <span className="hidden sm:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px] text-gray-600 dark:text-gray-300 flex items-center gap-0.5">
                    <Command size={10} /> Enter
                  </kbd>
                  to submit
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:border-purple-500 dark:focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all p-3.5 flex flex-col sm:flex-row gap-3">
                <input
                  ref={textareaRef as any}
                  value={newSentence}
                  onChange={(e) => setNewSentence(e.target.value)}
                  placeholder="Enter a word or phrase (e.g. 'Apple')..."
                  className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg leading-relaxed focus:outline-none"
                />
                <input
                  value={phoneticInput}
                  onChange={(e) => setPhoneticInput(e.target.value)}
                  placeholder="Phonetic (e.g. /ˈæp.əl/)"
                  className="w-full sm:w-32 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-3"
                />
                <input
                  value={partOfSpeechInput}
                  onChange={(e) => setPartOfSpeechInput(e.target.value)}
                  placeholder="Type (noun)"
                  className="w-full sm:w-28 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-3"
                />
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Meanings & Examples</div>
                {wordMeanings.map((m, i) => (
                  <div key={i} className="flex gap-2 items-start relative group">
                    <div className="flex-1 space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                      <input
                        placeholder="Meaning (e.g. Trái táo)"
                        value={m.meaning}
                        onChange={e => {
                          const newM = [...wordMeanings]
                          newM[i].meaning = e.target.value
                          setWordMeanings(newM)
                        }}
                        className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none font-medium"
                      />
                      <input
                        placeholder="Example sentence (e.g. I eat an apple everyday)"
                        value={m.example}
                        onChange={e => {
                          const newM = [...wordMeanings]
                          newM[i].example = e.target.value
                          setWordMeanings(newM)
                        }}
                        className="w-full bg-transparent text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400 focus:outline-none italic"
                      />
                    </div>
                    {wordMeanings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setWordMeanings(wordMeanings.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity mt-2"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setWordMeanings([...wordMeanings, { meaning: '', example: '' }])}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium flex items-center gap-1 mt-1"
                >
                  <Plus size={12} /> Add another meaning
                </button>
              </div>
            </div>
          )}

          {/* Tags Selection Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Tag size={14} className="text-purple-500" /> Tags
                <button
                  type="button"
                  onClick={() => setIsTagsLocked(!isTagsLocked)}
                  className={`ml-1 p-1 rounded-md transition-colors ${
                    isTagsLocked ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={isTagsLocked ? "Tags locked" : "Lock tags"}
                >
                  {isTagsLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </span>
              {selectedTags.length > 0 && !isTagsLocked && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-normal"
                >
                  Clear tags
                </button>
              )}
            </div>

            {/* Selected Tags Chips Container */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 min-h-[46px]">
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-medium px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800/60 animate-in zoom-in-95"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTagChip(tag)}
                    className="hover:bg-purple-200 dark:hover:bg-purple-800 p-0.5 rounded-full transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) {
                    addTagChip(tagInput)
                    setTagInput('')
                  }
                }}
                placeholder={selectedTags.length === 0 ? "Type tag name and press Enter or comma..." : "Add another tag..."}
                className="flex-1 min-w-[140px] bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none px-1 py-0.5"
              />
            </div>

            {/* Quick Suggestion Tags */}
            {existingTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-gray-400 font-medium mr-1">Suggestions:</span>
                {existingTags.map(tag => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => isSelected ? removeTagChip(tag) : addTagChip(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300'
                      }`}
                    >
                      {isSelected && '✓ '}#{tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-7 py-3 rounded-xl font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              <span>Add Flashcard</span>
            </button>
          </div>
        </form>
      </div>

      {/* Recently Added Section */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BookOpen size={20} className="text-purple-600 dark:text-purple-400" />
            <span>Recently Added</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {flashcards.length} total cards
          </span>
        </div>

        {recentFlashcards.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <p className="font-medium text-base">No cards yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first sentence above to start creating flashcard notes!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentFlashcards.map((flashcard) => (
              <FlashcardItem key={flashcard.id} flashcard={flashcard} viewMode="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

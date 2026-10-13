import { useState, useRef, useMemo } from 'react'
import { useFlashcardStore, getCardTags, isWordCard } from '../store'
import { FlashcardItem } from './FlashcardItem'
import { Plus, Sparkles, Tag, X, Check, BookOpen, Command, Lock, Unlock, Type, FileText, ArrowLeftRight } from 'lucide-react'

interface FormExample {
  sentence: string
  translation: string
}

interface FormMeaning {
  meaning: string
  examples: FormExample[]
}

interface FormPosEntry {
  partOfSpeech: string
  phonetic?: string
  meanings: FormMeaning[]
}

const emptyExample = (): FormExample => ({ sentence: '', translation: '' })
const emptyMeaning = (): FormMeaning => ({ meaning: '', examples: [emptyExample()] })
const emptyPosEntry = (): FormPosEntry => ({ partOfSpeech: '', phonetic: '', meanings: [emptyMeaning()] })

export function TabAdd() {
  const { flashcards, addFlashcard, addWordCard } = useFlashcardStore()
  const [newSentence, setNewSentence] = useState('')
  const [sentenceTranslation, setSentenceTranslation] = useState('')
  const [annotatingCardId, setAnnotatingCardId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [isTagsLocked, setIsTagsLocked] = useState(false)
  const [inputMode, setInputMode] = useState<'sentence' | 'word'>('sentence')
  const [phoneticInput, setPhoneticInput] = useState('')
  const [partOfSpeechInput, setPartOfSpeechInput] = useState('')
  
  // Word mode state
  const [posFormEntries, setPosFormEntries] = useState<FormPosEntry[]>([emptyPosEntry()])
  const [phrasesForm, setPhrasesForm] = useState<{ phrase: string, translation: string }[]>([])
  const [usageNotesForm, setUsageNotesForm] = useState<string[]>([])
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const existingTags = Array.from(new Set(flashcards.flatMap(f => getCardTags(f))))

  const annotatingCard = useMemo(() => {
    if (!annotatingCardId) return null
    return flashcards.find(f => f.id === annotatingCardId) || null
  }, [flashcards, annotatingCardId])

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
      const validUsageNotes = usageNotesForm.map(u => u.trim()).filter(Boolean)

      if (inputMode === 'sentence') {
        const newId = addFlashcard(
          newSentence,
          finalTags,
          undefined,
          phoneticInput,
          partOfSpeechInput,
          validUsageNotes.length > 0 ? validUsageNotes : undefined,
          sentenceTranslation.trim() || undefined
        )
        setAnnotatingCardId(newId)
        setSentenceTranslation('')
      } else {
        const validPosEntries = posFormEntries
          .map(pos => ({
            partOfSpeech: pos.partOfSpeech.trim(),
            phonetic: pos.phonetic?.trim() || undefined,
            meanings: pos.meanings
              .filter(m => m.meaning.trim() !== '')
              .map(m => ({
                meaning: m.meaning.trim(),
                examples: m.examples
                  .filter(ex => ex.sentence.trim() !== '')
                  .map(ex => ({ sentence: ex.sentence.trim(), translation: ex.translation.trim() }))
              }))
          }))
          .filter(pos => pos.meanings.length > 0 || pos.partOfSpeech !== '')

        const validPhrases = phrasesForm
          .filter(p => p.phrase.trim() !== '')
          .map(p => ({ phrase: p.phrase.trim(), translation: p.translation.trim() }))

        addWordCard(newSentence, validPosEntries, validPhrases, finalTags, phoneticInput, validUsageNotes.length > 0 ? validUsageNotes : undefined)
        setPosFormEntries([emptyPosEntry()])
        setPhrasesForm([])
        setUsageNotesForm([])
      }

      setNewSentence('')
      setPhoneticInput('')
      setPartOfSpeechInput('')
      setUsageNotesForm([])
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

  const sortedRecent = [...flashcards].sort((a, b) => b.createdAt - a.createdAt)
  const recentFlashcards = useMemo(() => {
    const list: typeof flashcards = []
    const seenWords = new Set<string>()
    for (const card of sortedRecent) {
      const isWord = isWordCard(card)
      const key = isWord ? card.sentence.trim().toLowerCase() : card.id
      if (!seenWords.has(key)) {
        seenWords.add(key)
        list.push(card)
        if (list.length >= 10) break
      }
    }
    return list
  }, [sortedRecent])

  return (
    <div className="animate-in fade-in max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Main Add Card Box */}
      <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-6 sm:p-7 transition-all lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto overscroll-contain custom-scrollbar">
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

        {/* Sentence Note Annotator Step */}
        {annotatingCard && (
          <div className="mb-6 p-4 sm:p-5 bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl border-2 border-purple-300 dark:border-purple-700 space-y-3.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-purple-900 dark:text-purple-200 text-sm sm:text-base">
                  Add Notes for Words or Phrases (Step 2: Add Word Notes)
                </h3>
                <p className="text-xs text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                  Created sentence: &ldquo;{annotatingCard.sentence}&rdquo;. Select text to add notes/meanings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnnotatingCardId(null)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
              >
                Done / Finish
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
              <FlashcardItem
                key={annotatingCard.id}
                flashcard={annotatingCard}
                isLocked={false}
                showPartOfSpeech={true}
                showPhonetic={true}
                showHighlights={true}
                initialEditingSentence={true}
              />
            </div>
          </div>
        )}

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
            <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:border-purple-500 dark:focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all p-3.5 space-y-2.5">
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
                className="w-full bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg leading-relaxed focus:outline-none resize-none min-h-[80px]"
                rows={3}
              />
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <input
                  value={sentenceTranslation}
                  onChange={(e) => setSentenceTranslation(e.target.value)}
                  placeholder="Sentence translation / Meaning of the sentence or phrase (optional)..."
                  className="w-full bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <input
                  value={partOfSpeechInput}
                  onChange={(e) => setPartOfSpeechInput(e.target.value)}
                  placeholder="Part of speech (e.g. noun, verb)"
                  className="w-full sm:w-1/3 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none"
                />
                <input
                  value={phoneticInput}
                  onChange={(e) => setPhoneticInput(e.target.value)}
                  placeholder="Phonetic (optional)"
                  className="w-full sm:w-1/3 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none sm:border-l sm:border-gray-100 sm:dark:border-gray-700/60 sm:pl-3"
                />
                <input
                  value={usageNotesForm[0] || ''}
                  onChange={(e) => setUsageNotesForm(e.target.value ? [e.target.value] : [])}
                  placeholder="Usage note (optional)"
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
            <div className="space-y-5">
              {/* Word & Phonetic inputs */}
              <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:border-purple-500 dark:focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all p-3.5 flex flex-col sm:flex-row gap-3">
                <input
                  ref={textareaRef as any}
                  value={newSentence}
                  onChange={(e) => setNewSentence(e.target.value)}
                  placeholder="Enter word or phrase (e.g. 'Action')..."
                  className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg font-bold leading-relaxed focus:outline-none"
                />
                <input
                  value={phoneticInput}
                  onChange={(e) => setPhoneticInput(e.target.value)}
                  placeholder="Phonetic (e.g. /ˈæk.ʃən/)"
                  className="w-full sm:w-48 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 text-sm italic focus:outline-none sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-3"
                />
              </div>

              {/* Parts of Speech list */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Parts of Speech &amp; Meanings
                  </span>
                  <button
                    type="button"
                    onClick={() => setPosFormEntries([...posFormEntries, emptyPosEntry()])}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={14} /> Add another Part of Speech
                  </button>
                </div>

                {posFormEntries.map((pos, pIdx) => (
                  <div key={pIdx} className="bg-gray-50/80 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 space-y-3.5">
                    {/* POS Header */}
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Part of speech (e.g. noun, verb, adjective...)"
                        value={pos.partOfSpeech}
                        onChange={e => {
                          const updated = [...posFormEntries]
                          updated[pIdx].partOfSpeech = e.target.value
                          setPosFormEntries(updated)
                        }}
                        className="flex-1 bg-white dark:bg-gray-700/60 text-sm font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <input
                        placeholder="POS Phonetic (optional)"
                        value={pos.phonetic || ''}
                        onChange={e => {
                          const updated = [...posFormEntries]
                          updated[pIdx].phonetic = e.target.value
                          setPosFormEntries(updated)
                        }}
                        className="w-40 bg-white dark:bg-gray-700/60 text-sm italic text-gray-600 dark:text-gray-300 placeholder-gray-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {posFormEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPosFormEntries(posFormEntries.filter((_, idx) => idx !== pIdx))}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                          title="Delete part of speech"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Meanings within this POS */}
                    <div className="space-y-3 pl-2 sm:pl-3 border-l-2 border-purple-200 dark:border-purple-800/60">
                      {pos.meanings.map((m, mIdx) => (
                        <div key={mIdx} className="bg-white dark:bg-gray-700/40 rounded-xl p-3 border border-gray-200 dark:border-gray-600/60 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">#{mIdx + 1}</span>
                            <input
                              placeholder="Meaning (e.g. action; activity; operation; deed...)"
                              value={m.meaning}
                              onChange={e => {
                                const updated = [...posFormEntries]
                                updated[pIdx].meanings[mIdx].meaning = e.target.value
                                setPosFormEntries(updated)
                              }}
                              className="flex-1 bg-transparent text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                            />
                            {pos.meanings.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...posFormEntries]
                                  updated[pIdx].meanings = updated[pIdx].meanings.filter((_, idx) => idx !== mIdx)
                                  setPosFormEntries(updated)
                                }}
                                className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                title="Remove meaning"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Examples for this meaning */}
                          <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-600/40">
                            {m.examples.map((ex, exIdx) => (
                              <div key={exIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50/60 dark:bg-gray-800/40 p-2 rounded-lg">
                                <input
                                  placeholder="Example sentence (e.g. He is a man of action...)"
                                  value={ex.sentence}
                                  onChange={e => {
                                    const updated = [...posFormEntries]
                                    updated[pIdx].meanings[mIdx].examples[exIdx].sentence = e.target.value
                                    setPosFormEntries(updated)
                                  }}
                                  className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 italic placeholder-gray-400 focus:outline-none w-full"
                                />
                                <input
                                  placeholder="Translation (e.g. He is a man of action...)"
                                  value={ex.translation}
                                  onChange={e => {
                                    const updated = [...posFormEntries]
                                    updated[pIdx].meanings[mIdx].examples[exIdx].translation = e.target.value
                                    setPosFormEntries(updated)
                                  }}
                                  className="flex-1 bg-transparent text-xs text-gray-500 dark:text-gray-400 placeholder-gray-400 focus:outline-none w-full sm:border-l sm:border-gray-200 sm:dark:border-gray-600 sm:pl-2"
                                />
                                {m.examples.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...posFormEntries]
                                      updated[pIdx].meanings[mIdx].examples = updated[pIdx].meanings[mIdx].examples.filter((_, idx) => idx !== exIdx)
                                      setPosFormEntries(updated)
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...posFormEntries]
                                updated[pIdx].meanings[mIdx].examples.push(emptyExample())
                                setPosFormEntries(updated)
                              }}
                              className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium pt-0.5"
                            >
                              <Plus size={11} /> Add example sentence
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...posFormEntries]
                          updated[pIdx].meanings.push(emptyMeaning())
                          setPosFormEntries(updated)
                        }}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium pt-1"
                      >
                        <Plus size={12} /> Add another meaning to this part of speech
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Phrases & Idioms section */}
              <div className="bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Phrases &amp; Idioms (optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhrasesForm([...phrasesForm, { phrase: '', translation: '' }])}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={12} /> Add phrase / idiom
                  </button>
                </div>

                {phrasesForm.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No phrases or idioms added yet. Click above to add (e.g. "go into action").</p>
                ) : (
                  <div className="space-y-2">
                    {phrasesForm.map((item, pIdx) => (
                      <div key={pIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <input
                          placeholder="Phrase or idiom (e.g. go into action)"
                          value={item.phrase}
                          onChange={e => {
                            const updated = [...phrasesForm]
                            updated[pIdx].phrase = e.target.value
                            setPhrasesForm(updated)
                          }}
                          className="flex-1 bg-transparent text-xs font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none w-full"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...phrasesForm]
                            const tmp = updated[pIdx].phrase
                            updated[pIdx].phrase = updated[pIdx].translation
                            updated[pIdx].translation = tmp
                            setPhrasesForm(updated)
                          }}
                          title="Swap English phrase and translation"
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors shrink-0"
                        >
                          <ArrowLeftRight size={13} />
                        </button>
                        <input
                          placeholder="Translation (e.g. take action, swing into action...)"
                          value={item.translation}
                          onChange={e => {
                            const updated = [...phrasesForm]
                            updated[pIdx].translation = e.target.value
                            setPhrasesForm(updated)
                          }}
                          className="flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-300 placeholder-gray-400 focus:outline-none w-full sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-2"
                        />
                        <button
                          type="button"
                          onClick={() => setPhrasesForm(phrasesForm.filter((_, idx) => idx !== pIdx))}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Usage Notes section */}
              <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <span>💡 Usage Notes (optional)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setUsageNotesForm([...usageNotesForm, ''])}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 font-medium flex items-center gap-1 bg-amber-100/60 dark:bg-amber-900/30 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={12} /> Add usage note
                  </button>
                </div>

                {usageNotesForm.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No usage notes added yet. Click above to add grammar or usage tips (e.g. "When used as a noun, stress falls on the first syllable...").</p>
                ) : (
                  <div className="space-y-2">
                    {usageNotesForm.map((note, nIdx) => (
                      <div key={nIdx} className="flex gap-2 items-start bg-white dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <textarea
                          rows={2}
                          placeholder="Usage note, grammar tip, or distinction (e.g. Often used in formal or administrative contexts...)"
                          value={note}
                          onChange={e => {
                            const updated = [...usageNotesForm]
                            updated[nIdx] = e.target.value
                            setUsageNotesForm(updated)
                          }}
                          className="flex-1 bg-transparent text-xs font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => setUsageNotesForm(usageNotesForm.filter((_, idx) => idx !== nIdx))}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0"
                          title="Remove usage note"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
      <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 flex flex-col lg:max-h-[calc(100vh-6.5rem)]">
        <div className="flex items-center justify-between mb-3 px-1 shrink-0">
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
          <div className="flex-1 lg:overflow-y-auto overscroll-contain pr-1 space-y-3.5 custom-scrollbar">
            {recentFlashcards.map((flashcard) => (
              <FlashcardItem key={flashcard.id} flashcard={flashcard} viewMode="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { TabAdd as TabHome }

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check, Sparkles, ArrowLeftRight } from 'lucide-react'
import { Flashcard, PosEntry, PhraseIdiom, useFlashcardStore, getCardTags } from '../store'

function emptyMeaning() {
  return {
    meaning: '',
    examples: [{ sentence: '', translation: '' }]
  }
}

function emptyPosEntry(): PosEntry {
  return {
    partOfSpeech: '',
    phonetic: '',
    meanings: [emptyMeaning()]
  }
}

interface WordCardEditModalProps {
  card: Flashcard | null
  isOpen: boolean
  onClose: () => void
}

export function WordCardEditModal({ card, isOpen, onClose }: WordCardEditModalProps) {
  const { updateWordCard } = useFlashcardStore()

  const [word, setWord] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [posFormEntries, setPosFormEntries] = useState<PosEntry[]>([])
  const [phrasesForm, setPhrasesForm] = useState<PhraseIdiom[]>([])
  const [usageNotesForm, setUsageNotesForm] = useState<string[]>([])
  const [tagsInput, setTagsInput] = useState('')

  useEffect(() => {
    if (card && isOpen) {
      setWord(card.sentence)
      setPhonetic(card.phonetic || '')
      setTagsInput(getCardTags(card).join(', '))

      if (card.posEntries && card.posEntries.length > 0) {
        const cloned: PosEntry[] = JSON.parse(JSON.stringify(card.posEntries))
        cloned.forEach(p => {
          if (!p.meanings || p.meanings.length === 0) {
            p.meanings = [emptyMeaning()]
          } else {
            p.meanings.forEach(m => {
              if (!m.examples || m.examples.length === 0) {
                m.examples = [{ sentence: '', translation: '' }]
              }
            })
          }
        })
        setPosFormEntries(cloned)
      } else {
        // Synthesize posEntry from single card data
        const synthesizedMeanings = (card.highlights || []).length > 0
          ? (card.highlights || []).map(h => ({
              meaning: h.meaning,
              examples: h.example ? [{ sentence: h.example, translation: '' }] : [{ sentence: '', translation: '' }]
            }))
          : [emptyMeaning()]

        setPosFormEntries([
          {
            partOfSpeech: card.partOfSpeech || '',
            phonetic: card.phonetic || '',
            meanings: synthesizedMeanings
          }
        ])
      }

      if (card.phrasesAndIdioms && card.phrasesAndIdioms.length > 0) {
        setPhrasesForm(JSON.parse(JSON.stringify(card.phrasesAndIdioms)))
      } else {
        setPhrasesForm([])
      }

      if (card.usageNotes && card.usageNotes.length > 0) {
        setUsageNotesForm([...card.usageNotes])
      } else {
        setUsageNotesForm([])
      }
    }
  }, [card, isOpen])

  if (!isOpen || !card) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!word.trim()) return

    const validPosEntries: PosEntry[] = posFormEntries
      .map(pos => ({
        partOfSpeech: pos.partOfSpeech.trim(),
        phonetic: pos.phonetic?.trim() || undefined,
        meanings: pos.meanings
          .filter(m => m.meaning.trim() !== '')
          .map(m => ({
            id: m.id,
            meaning: m.meaning.trim(),
            notes: m.notes,
            labels: m.labels,
            examples: (m.examples || [])
              .filter(ex => ex.sentence.trim() !== '')
              .map(ex => ({
                id: ex.id,
                sentence: ex.sentence.trim(),
                translation: ex.translation?.trim() || ''
              }))
          }))
      }))
      .filter(pos => pos.meanings.length > 0 || pos.partOfSpeech !== '')

    // Fallback if user emptied all meanings
    const finalPosEntries = validPosEntries.length > 0 ? validPosEntries : [
      {
        partOfSpeech: posFormEntries[0]?.partOfSpeech?.trim() || '',
        phonetic: posFormEntries[0]?.phonetic?.trim() || undefined,
        meanings: [{ meaning: word.trim(), examples: [] }]
      }
    ]

    const validPhrases = phrasesForm
      .filter(p => p.phrase.trim() !== '')
      .map(p => ({
        ...p,
        phrase: p.phrase.trim(),
        translation: p.translation.trim()
      }))

    const validUsageNotes = usageNotesForm.map(u => u.trim()).filter(Boolean)

    updateWordCard(
      card.id,
      word.trim(),
      finalPosEntries,
      validPhrases,
      tagsInput,
      phonetic.trim() || undefined,
      validUsageNotes
    )

    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
      onPointerDown={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6"
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Flashcard</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Update word, parts of speech, meanings &amp; examples</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Main Word & Phonetic */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Word &amp; General Phonetic
            </label>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-3 flex flex-col sm:flex-row gap-3">
              <input
                required
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="Word or phrase..."
                className="flex-1 bg-transparent text-gray-900 dark:text-white text-lg font-bold focus:outline-none"
              />
              <input
                value={phonetic}
                onChange={e => setPhonetic(e.target.value)}
                placeholder="Phonetic (e.g. /ˈæk.ʃən/)"
                className="w-full sm:w-48 bg-transparent text-gray-600 dark:text-gray-300 text-sm italic focus:outline-none sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-3"
              />
            </div>
          </div>

          {/* Parts of Speech & Meanings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Parts of Speech ({posFormEntries.length})
              </label>
              <button
                type="button"
                onClick={() => setPosFormEntries([...posFormEntries, emptyPosEntry()])}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Part of Speech
              </button>
            </div>

            {posFormEntries.map((pos, pIdx) => (
              <div
                key={pIdx}
                className="bg-gray-50/80 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 space-y-3.5 shadow-sm"
              >
                {/* POS Title & Phonetic */}
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Part of speech (e.g. noun, verb, danh từ...)"
                    value={pos.partOfSpeech}
                    onChange={e => {
                      const updated = [...posFormEntries]
                      updated[pIdx].partOfSpeech = e.target.value
                      setPosFormEntries(updated)
                    }}
                    className="flex-1 bg-white dark:bg-gray-700 text-sm font-bold text-gray-800 dark:text-gray-100 placeholder-gray-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    placeholder="POS Phonetic (optional)"
                    value={pos.phonetic || ''}
                    onChange={e => {
                      const updated = [...posFormEntries]
                      updated[pIdx].phonetic = e.target.value
                      setPosFormEntries(updated)
                    }}
                    className="w-40 bg-white dark:bg-gray-700 text-sm italic text-gray-600 dark:text-gray-300 placeholder-gray-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {posFormEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPosFormEntries(posFormEntries.filter((_, idx) => idx !== pIdx))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors shrink-0"
                      title="Delete part of speech"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Meanings */}
                <div className="space-y-3 pl-2 sm:pl-3 border-l-2 border-purple-200 dark:border-purple-800/60">
                  {pos.meanings.map((m, mIdx) => (
                    <div
                      key={mIdx}
                      className="bg-white dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
                          #{mIdx + 1}
                        </span>
                        <input
                          placeholder="Meaning (e.g. hành động; việc làm; diễn biến phim...)"
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
                            className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0"
                            title="Remove meaning"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Examples */}
                      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-600/40">
                        {(m.examples || []).map((ex, exIdx) => (
                          <div
                            key={exIdx}
                            className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50/70 dark:bg-gray-800/40 p-2 rounded-lg"
                          >
                            <input
                              placeholder="Example sentence (e.g. He is a man of action...)"
                              value={ex.sentence}
                              onChange={e => {
                                const updated = [...posFormEntries]
                                const exList = updated[pIdx].meanings[mIdx].examples || []
                                if (exList[exIdx]) {
                                  exList[exIdx].sentence = e.target.value
                                  updated[pIdx].meanings[mIdx].examples = exList
                                  setPosFormEntries(updated)
                                }
                              }}
                              className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 italic placeholder-gray-400 focus:outline-none w-full"
                            />
                            <input
                              placeholder="Translation (e.g. Anh ấy là con người hành động...)"
                              value={ex.translation || ''}
                              onChange={e => {
                                const updated = [...posFormEntries]
                                const exList = updated[pIdx].meanings[mIdx].examples || []
                                if (exList[exIdx]) {
                                  exList[exIdx].translation = e.target.value
                                  updated[pIdx].meanings[mIdx].examples = exList
                                  setPosFormEntries(updated)
                                }
                              }}
                              className="flex-1 bg-transparent text-xs text-gray-500 dark:text-gray-400 placeholder-gray-400 focus:outline-none w-full sm:border-l sm:border-gray-200 sm:dark:border-gray-600 sm:pl-2"
                            />
                            {(m.examples || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...posFormEntries]
                                  const exList = updated[pIdx].meanings[mIdx].examples || []
                                  updated[pIdx].meanings[mIdx].examples = exList.filter((_, idx) => idx !== exIdx)
                                  setPosFormEntries(updated)
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                title="Remove example"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...posFormEntries]
                            const exList = updated[pIdx].meanings[mIdx].examples || []
                            exList.push({ sentence: '', translation: '' })
                            updated[pIdx].meanings[mIdx].examples = exList
                            setPosFormEntries(updated)
                          }}
                          className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium pt-1"
                        >
                          <Plus size={11} /> Add Example
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
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold pt-1"
                  >
                    <Plus size={12} /> Add Meaning
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Phrases & Idioms Section */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Phrases &amp; Idioms ({phrasesForm.length})
                </span>
                <p className="text-[11px] text-gray-400">Optional common idioms, phrasal verbs, or set expressions</p>
              </div>
              <button
                type="button"
                onClick={() => setPhrasesForm([...phrasesForm, { phrase: '', translation: '' }])}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Phrase / Idiom
              </button>
            </div>

            {phrasesForm.map((pi, piIdx) => (
              <div
                key={piIdx}
                className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50/80 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <input
                  placeholder="Phrase or idiom (e.g. piece of cake, call it a day...)"
                  value={pi.phrase}
                  onChange={e => {
                    const updated = [...phrasesForm]
                    updated[piIdx].phrase = e.target.value
                    setPhrasesForm(updated)
                  }}
                  className="flex-1 bg-white dark:bg-gray-700 text-sm font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none w-full"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...phrasesForm]
                    const tmp = updated[piIdx].phrase
                    updated[piIdx].phrase = updated[piIdx].translation
                    updated[piIdx].translation = tmp
                    setPhrasesForm(updated)
                  }}
                  title="Hoán đổi cụm từ tiếng Anh và câu dịch"
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors shrink-0"
                >
                  <ArrowLeftRight size={15} />
                </button>
                <input
                  placeholder="Translation / Meaning (e.g. dễ như ăn bánh, nghỉ tay...)"
                  value={pi.translation}
                  onChange={e => {
                    const updated = [...phrasesForm]
                    updated[piIdx].translation = e.target.value
                    setPhrasesForm(updated)
                  }}
                  className="flex-1 bg-white dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none w-full"
                />
                <button
                  type="button"
                  onClick={() => setPhrasesForm(phrasesForm.filter((_, idx) => idx !== piIdx))}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0"
                  title="Remove phrase"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Usage Notes */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span>💡 Usage Notes ({usageNotesForm.length})</span>
              </label>
              <button
                type="button"
                onClick={() => setUsageNotesForm([...usageNotesForm, ''])}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 font-medium flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Usage Note
              </button>
            </div>

            {usageNotesForm.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No usage notes added yet. Click above to add grammar or usage tips.</p>
            ) : (
              <div className="space-y-2">
                {usageNotesForm.map((note, nIdx) => (
                  <div
                    key={nIdx}
                    className="flex gap-2 items-start bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40"
                  >
                    <textarea
                      rows={2}
                      placeholder="Usage note, grammar tip, or distinction (e.g. Khi là danh từ, trọng âm rơi vào âm tiết thứ nhất...)"
                      value={note}
                      onChange={e => {
                        const updated = [...usageNotesForm]
                        updated[nIdx] = e.target.value
                        setUsageNotesForm(updated)
                      }}
                      className="flex-1 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 p-2 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => setUsageNotesForm(usageNotesForm.filter((_, idx) => idx !== nIdx))}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0"
                      title="Remove note"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tags
            </label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. vocabulary, business, ielts (comma-separated)..."
              className="w-full bg-gray-50/50 dark:bg-gray-900/50 text-sm text-gray-800 dark:text-gray-100 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check size={16} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

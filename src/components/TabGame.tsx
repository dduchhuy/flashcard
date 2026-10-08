import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashcardStore, Flashcard, getCardTags, getCardsForMode } from '../store'
import { RefreshCcw, ThumbsDown, ThumbsUp, Lightbulb, LightbulbOff, Layers, MousePointerClick, ArrowLeft, Grid2X2, Type, BrainCircuit, Headphones, Volume2, Shuffle, Zap, ListOrdered, ToggleLeft, Skull } from 'lucide-react'
import { MatchGame } from './games/MatchGame'
import { EmptyState } from './games/shared'
import { MemoryGame } from './games/MemoryGame'
import { FillBlankGame } from './games/FillBlankGame'
import { ListenGame } from './games/ListenGame'
import { ScrambleGame } from './games/ScrambleGame'
import { SpeedGame } from './games/SpeedGame'
import { SentenceGame } from './games/SentenceGame'
import { TrueFalseGame } from './games/TrueFalseGame'
import { HangmanGame } from './games/HangmanGame'
import { TypingGame } from './games/TypingGame'
import { SelectDropdown } from './SelectDropdown'

type Segment = {
  type: 'normal' | 'highlight'
  indices: number[]
  highlightId?: string
  meaning?: string
}

type GameMode = 'menu' | 'swipe' | 'quiz' | 'match' | 'memory' | 'fill' | 'listen' | 'scramble' | 'speed' | 'sentence' | 'truefalse' | 'hangman' | 'typing'

export function TabGame() {
  const [gameMode, setGameMode] = useState<GameMode>('menu')
  const { flashcards } = useFlashcardStore()

  useEffect(() => {
    fetch('/api/debug', {
      method: 'POST',
      body: JSON.stringify(flashcards)
    }).catch(() => {})
  }, [flashcards])

  return (
    <div className="h-full pb-8">
      {gameMode === 'menu' && <GameMenu onSelect={setGameMode} />}
      {gameMode === 'swipe' && <SwipeGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'quiz' && <QuizGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'match' && <MatchGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'memory' && <MemoryGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'fill' && <FillBlankGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'listen' && <ListenGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'scramble' && <ScrambleGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'speed' && <SpeedGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'sentence' && <SentenceGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'truefalse' && <TrueFalseGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'hangman' && <HangmanGame onExit={() => setGameMode('menu')} />}
      {gameMode === 'typing' && <TypingGame onExit={() => setGameMode('menu')} />}
    </div>
  )
}

function GameMenu({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const { flashcards, activeTags, setActiveTags, gameInputMode, setGameInputMode } = useFlashcardStore()
  const allTags = Array.from(new Set(flashcards.flatMap(f => getCardTags(f))))

  const toggleTag = (tag: string) => {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter(t => t !== tag))
    } else {
      setActiveTags([...activeTags, tag])
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 animate-in fade-in flex flex-col items-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Choose Practice Mode</h2>
      
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-6 px-4 max-w-2xl">
          <button
            onClick={() => setActiveTags([])}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTags.length === 0
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Tags
          </button>
          {allTags.map(tag => {
            const isActive = activeTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-center mb-8 w-full px-4">
        <div className="bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl flex items-center shadow-inner border border-gray-200/50 dark:border-gray-700/50">
          <button
            onClick={() => setGameInputMode('sentence')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              gameInputMode === 'sentence' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-600/50' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
            }`}
          >
            Sentence Mode
          </button>
          <button
            onClick={() => setGameInputMode('word')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              gameInputMode === 'word' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-600/50' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
            }`}
          >
            Flashcard Mode
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full px-4">
        <button 
          onClick={() => onSelect('swipe')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Layers size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Swipe Cards</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Review & swipe right if remembered.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('quiz')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <MousePointerClick size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Multiple Choice</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select meaning from random options.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('match')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Grid2X2 size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Match Game</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Connect words with their meanings.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('fill')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Type size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Fill in the Blank</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Type the exact missing word.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('memory')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <BrainCircuit size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Memory Flip</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Flip cards to find matching pairs.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('listen')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Headphones size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Dictation</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Listen to the pronunciation and spell it.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('scramble')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Shuffle size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Word Scramble</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unscramble the letters of the word.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('speed')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Zap size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Speed Match</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Beat the clock for the highest score.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('sentence')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <ListOrdered size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Sentence Builder</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Put the words in the right order.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('truefalse')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <ToggleLeft size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">True or False</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Is this meaning correct?</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('hangman')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Skull size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Hangman</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Guess the word letter by letter.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelect('typing')}
          className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-fuchsia-300 dark:hover:border-fuchsia-600 hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group"
        >
          <div className="bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-600 dark:text-fuchsia-400 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Type size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Fill Blank (4 Choices)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select missing word/phrase from 4 options.</p>
          </div>
        </button>
      </div>
    </div>
  )
}

import { extractWordText, speakEnglish } from '../utils'

function QuizGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [quizMode, setQuizMode] = useState<'w2m' | 'm2w'>('w2m')
  const [uniqueWords, setUniqueWords] = useState(false)
  const [answerCount, setAnswerCount] = useState(6)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [skipped, setSkipped] = useState(0)
  
  // Extract all highlights across all flashcards to form questions
  const allQuestions = useMemo(() => {
    const questions: any[] = []
    let filtered = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    filtered = getCardsForMode(filtered, gameInputMode)
    
    if (uniqueWords) {
      // Each card appears only once, using only first highlight
      filtered.forEach(card => {
        if (card.highlights.length === 0) return
        const h = card.highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices)
        questions.push({
          cardId: card.id,
          highlightId: h.id,
          word: wordText,
          sentence: card.sentence,
          correctMeaning: h.meaning,
        })
      })
    } else {
      filtered.forEach(card => {
        card.highlights.forEach(h => {
          const wordText = extractWordText(card.sentence, h.wordIndices)
          questions.push({
            cardId: card.id,
            highlightId: h.id,
            word: wordText,
            sentence: card.sentence,
            correctMeaning: h.meaning,
          })
        })
      })
    }
    return questions.sort(() => Math.random() - 0.5)
  }, [flashcards, seed, activeTags, uniqueWords])

  const allMeanings = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.correctMeaning)))
  }, [allQuestions])

  const allWords = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.word)))
  }, [allQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showContext, setShowContext] = useState(false)

  const currentQ = allQuestions[currentIndex]
  const questionText = currentQ ? (quizMode === 'w2m' ? currentQ.word : currentQ.correctMeaning) : ''
  const correctOption = currentQ ? (quizMode === 'w2m' ? currentQ.correctMeaning : currentQ.word) : ''

  const options = useMemo(() => {
    if (!currentQ) return []
    const wrongCount = answerCount - 1
    let wrongOptions: string[] = []
    
    if (quizMode === 'w2m') {
      const validWrongQs = allQuestions.filter(q => 
        q.word.toLowerCase() !== currentQ.word.toLowerCase() &&
        q.correctMeaning.toLowerCase() !== currentQ.correctMeaning.toLowerCase()
      )
      const uniqueWrongMeanings = Array.from(new Set(validWrongQs.map(q => q.correctMeaning)))
      wrongOptions = uniqueWrongMeanings.sort(() => Math.random() - 0.5).slice(0, wrongCount)
    } else {
      const validWrongQs = allQuestions.filter(q => 
        q.correctMeaning.toLowerCase() !== currentQ.correctMeaning.toLowerCase() &&
        q.word.toLowerCase() !== currentQ.word.toLowerCase()
      )
      const uniqueWrongWords = Array.from(new Set(validWrongQs.map(q => q.word)))
      wrongOptions = uniqueWrongWords.sort(() => Math.random() - 0.5).slice(0, wrongCount)
    }
    
    const combined = [correctOption, ...wrongOptions]
    return combined.sort(() => Math.random() - 0.5)
  }, [correctOption, allMeanings, allWords, quizMode, currentQ, answerCount])
  
  if (allQuestions.length === 0) {
    return <EmptyState onExit={onExit} />
  }

  const handleRestart = () => {
    setSeed(s => s + 1)
    setCurrentIndex(0)
    setCorrect(0)
    setWrong(0)
    setSkipped(0)
  }

  if (currentIndex >= allQuestions.length) {
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Quiz Complete!</h2>
        <div className="flex gap-6 mb-8 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{correct}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Correct</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{wrong}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Wrong</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{skipped}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Skipped</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{allQuestions.length}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={onExit}
            className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Back
          </button>
          <button 
            onClick={handleRestart}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 font-medium inline-flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }

  const handleSelect = (option: string) => {
    if (selectedOption) return // prevent double click
    setSelectedOption(option)
    if (option === correctOption) {
      setCorrect(c => c + 1)
    } else {
      setWrong(w => w + 1)
    }
    setTimeout(() => {
      setSelectedOption(null)
      setCurrentIndex(i => i + 1)
    }, 1500)
  }

  const handleSkip = () => {
    if (selectedOption) return
    setSkipped(s => s + 1)
    setCurrentIndex(i => i + 1)
  }

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in flex flex-col h-full">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6 gap-2">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0">
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
          {/* Context toggle */}
          <button 
            onClick={() => setShowContext(!showContext)}
            className={`flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 transition-colors border ${
              showContext 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {showContext ? <Lightbulb size={16} /> : <LightbulbOff size={16} />}
            <span className="hidden sm:inline">Context</span>
          </button>
          
          {/* Answer count selector — styled like the library tag dropdown */}
          <SelectDropdown
            value={String(answerCount)}
            onChange={v => setAnswerCount(Number(v))}
            options={[2,3,4,5,6,7,8].map(n => ({ value: String(n), label: `${n} options` }))}
            className="w-28 flex-shrink-0"
            buttonClassName="!py-1.5 !text-xs"
          />

          {/* Unique words toggle */}
          <button
            onClick={() => { setUniqueWords(u => !u); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0) }}
            title={uniqueWords ? 'Each word shown once (ON)' : 'Each word shown once (OFF)'}
            className={`flex-shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              uniqueWords
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            1 Mean
          </button>

          {/* Quiz mode segmented control */}
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 flex-shrink-0">
            <button onClick={() => setQuizMode('m2w')} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${quizMode === 'm2w' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>Mean</button>
            <button onClick={() => setQuizMode('w2m')} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${quizMode === 'w2m' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>Word</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-6 text-center flex-1 flex flex-col items-center justify-center relative">
        {quizMode === 'w2m' && (
          <button
            onClick={() => speakEnglish(currentQ.word)}
            title="Listen"
            className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Volume2 size={22} />
          </button>
        )}
        {showContext && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-3 leading-relaxed whitespace-pre-wrap px-4 animate-in fade-in slide-in-from-bottom-2">
            "...{currentQ.sentence}..."
          </p>
        )}
        <h2 className="text-4xl font-bold text-purple-600 dark:text-purple-400 break-words whitespace-pre-wrap">{questionText}</h2>
        {/* Skip button inside card */}
        <button
          onClick={handleSkip}
          disabled={!!selectedOption}
          className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 font-medium"
        >
          Skip
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 w-full">
        {options.map((opt, i) => {
          let baseBtnClass = "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          let hoverBtnClass = "hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
          
          if (selectedOption) {
            if (opt === correctOption) {
              baseBtnClass = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-200"
              hoverBtnClass = ""
            } else if (opt === selectedOption) {
              baseBtnClass = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200"
              hoverBtnClass = ""
            } else {
              baseBtnClass = "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-50"
              hoverBtnClass = ""
            }
          }

          const btnClass = `${baseBtnClass} ${hoverBtnClass}`

          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              disabled={!!selectedOption}
              className={`w-full p-3 rounded-xl border-2 text-center font-medium transition-all duration-300 ${btnClass} flex items-center justify-center min-h-[3.5rem]`}
            >
              <div className="text-sm whitespace-pre-wrap break-words w-full">
                {opt}
              </div>
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-6 mt-2 px-1 text-sm font-medium text-gray-500 dark:text-gray-400">
        <span>
          {correct} correct
        </span>
        <span>
          {wrong} wrong
        </span>
        <span>
          {skipped} skip
        </span>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700" />
        <span className="tabular-nums">
          {currentIndex + 1} / {allQuestions.length}
        </span>
      </div>
    </div>
  )
}



function SwipeGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [learningCards, setLearningCards] = useState<{ card: Flashcard, hid: string | null }[]>([])
  const [swipeCount, setSwipeCount] = useState(0)
  const [showHighlights, setShowHighlights] = useState(false)
  const [displayMode, setDisplayMode] = useState<'sentence' | 'words' | 'meanings'>('sentence')
  
  useEffect(() => {
    let cardsToLearn = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    cardsToLearn = getCardsForMode(cardsToLearn, gameInputMode)
    let items: { card: Flashcard, hid: string | null }[]
    if (gameInputMode === 'word') {
      if (displayMode === 'words') {
        items = cardsToLearn.map(card => ({ card, hid: null }))
      } else {
        items = cardsToLearn.flatMap(card => card.highlights.map(h => ({ card, hid: h.id })))
      }
    } else {
      if (displayMode === 'sentence') {
        items = cardsToLearn.map(card => ({ card, hid: null }))
      } else {
        items = cardsToLearn.flatMap(card => card.highlights.map(h => ({ card, hid: h.id })))
      }
    }
    setLearningCards(items.sort(() => Math.random() - 0.5))
  }, [flashcards, displayMode, activeTags, gameInputMode])

  if (learningCards.length === 0) {
    if (swipeCount === 0) return <EmptyState onExit={onExit} />
    return (
      <div className="text-center py-20 animate-in fade-in flex flex-col items-center">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Congratulations!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">You have reviewed all the cards.</p>
        <div className="flex gap-4">
          <button onClick={onExit} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2.5 rounded-lg font-medium transition-colors">Back</button>
          <button 
            onClick={() => {
              setSwipeCount(0)
              // The useEffect will trigger and reload the cards when swipeCount is 0,
              // but we need to force re-evaluation of items:
              let cardsToLearn = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
              cardsToLearn = getCardsForMode(cardsToLearn, gameInputMode)
              let items: { card: Flashcard, hid: string | null }[]
              if (gameInputMode === 'word') {
                if (displayMode === 'words') {
                  items = cardsToLearn.map(card => ({ card, hid: null }))
                } else {
                  items = cardsToLearn.flatMap(card => card.highlights.map(h => ({ card, hid: h.id })))
                }
              } else {
                if (displayMode === 'sentence') {
                  items = cardsToLearn.map(card => ({ card, hid: null }))
                } else {
                  items = cardsToLearn.flatMap(card => card.highlights.map(h => ({ card, hid: h.id })))
                }
              }
              setLearningCards(items.sort(() => Math.random() - 0.5))
            }} 
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 font-medium inline-flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    )
  }


  const currentItem = learningCards[0]
  const currentCard = currentItem.card

  return (
    <div className="max-w-md mx-auto h-[60vh] flex flex-col items-center justify-center relative animate-in fade-in pt-12">
      <div className="absolute top-0 w-full flex justify-between items-center z-10 gap-2 flex-wrap">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={24} />
        </button>

        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 flex-1 max-w-[260px] mx-auto">
          <button 
            onClick={() => setDisplayMode('sentence')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${displayMode === 'sentence' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {gameInputMode === 'word' ? 'Sentences' : 'Sentence'}
          </button>
          <button 
            onClick={() => setDisplayMode('words')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${displayMode === 'words' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Words
          </button>
          <button 
            onClick={() => setDisplayMode('meanings')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${displayMode === 'meanings' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Meanings
          </button>
        </div>

        <button 
          onClick={() => setShowHighlights(!showHighlights)}
          className={`text-sm font-medium px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 transition-colors border ${
            showHighlights 
              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {showHighlights ? <Lightbulb size={16} /> : <LightbulbOff size={16} />}
          <span className="hidden sm:inline">{showHighlights ? 'Hide Hints' : 'Show Hints'}</span>
        </button>
      </div>
      
      <SwipeableCard 
        key={`${currentCard.id}-${currentItem.hid}-${swipeCount}`} 
        card={currentCard}
        onlyHighlightId={currentItem.hid}
        showHighlights={showHighlights}
        displayMode={displayMode}
        onSwipedRight={() => {
          setLearningCards(prev => prev.slice(1))
          setSwipeCount(c => c + 1)
        }}
        onSwipedLeft={() => {
          setLearningCards(prev => [...prev.slice(1), currentItem])
          setSwipeCount(c => c + 1)
        }}
      />

      <div className="absolute bottom-0 w-full text-center">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{learningCards.length} left</span>
      </div>
    </div>
  )
}

function SwipeableCard({ 
  card, 
  onlyHighlightId,
  showHighlights,
  displayMode,
  onSwipedRight, 
  onSwipedLeft 
}: { 
  card: Flashcard, 
  onlyHighlightId: string | null,
  showHighlights: boolean,
  displayMode: 'sentence' | 'words' | 'meanings',
  onSwipedRight: () => void, 
  onSwipedLeft: () => void 
}) {
  const { settings, gameInputMode } = useFlashcardStore()
  const cardRef = useRef<HTMLDivElement>(null)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swiped, setSwiped] = useState(false)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (swiped || isDragging) return
      if (e.key === 'ArrowRight') {
        setOffsetX(500)
        setSwiped(true)
        setTimeout(onSwipedRight, 300)
      } else if (e.key === 'ArrowLeft') {
        setOffsetX(-500)
        setSwiped(true)
        setTimeout(onSwipedLeft, 300)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSwipedRight, onSwipedLeft, swiped, isDragging])

  const handleDragStart = (clientX: number) => {
    setStartX(clientX)
    setIsDragging(true)
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return
    const currentX = clientX
    setOffsetX(currentX - startX)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    
    if (offsetX > 100) {
      setSwiped(true)
      setTimeout(onSwipedRight, 300)
    } else if (offsetX < -100) {
      setSwiped(true)
      setTimeout(onSwipedLeft, 300)
    } else {
      setOffsetX(0)
    }
  }

  const rotation = offsetX * 0.1
  const opacity = 1 - Math.abs(offsetX) / 500
  const isRight = offsetX > 50
  const isLeft = offsetX < -50

  const transformStyle = swiped 
    ? `translate(${offsetX > 0 ? 500 : -500}px, 0px) rotate(${offsetX > 0 ? 20 : -20}deg)`
    : `translate(${offsetX}px, 0px) rotate(${rotation}deg)`

  const parts = card.sentence.trim().split(/(\s+)/)
  const words: string[] = []
  const spaces: string[] = []
  let initialSpace = ""
  
  for (let i = 0; i < parts.length; i += 2) {
    let w = parts[i]
    let s = parts[i + 1] || ""

    if (/^[.,!?;:"'()[\]{}<>]+$/.test(w)) {
      words.push(w)
      spaces.push(s)
      continue
    }

    const matchLeading = w.match(/^([.,!?;:"'()[\]{}<>]+)(.*)$/)
    if (matchLeading) {
      if (words.length > 0) {
        spaces[spaces.length - 1] += matchLeading[1]
      } else {
        initialSpace += matchLeading[1]
      }
      w = matchLeading[2]
    }

    const matchTrailing = w.match(/^(.*?)([.,!?;:"'()[\]{}<>]+)$/)
    if (matchTrailing) {
      w = matchTrailing[1]
      s = matchTrailing[2] + s
    }

    words.push(w)
    spaces.push(s)
  }

  const segments: Segment[] = []
  let currentSegment: Segment | null = null

  for (let i = 0; i < words.length; i++) {
    const highlight = (showHighlights || displayMode !== 'sentence') ? card.highlights.find(h => h.wordIndices.includes(i)) : undefined
    
    const targetType = highlight ? 'highlight' : 'normal'
    const targetId = highlight?.id
    const targetMeaning = highlight?.meaning

    if (currentSegment && currentSegment.type === targetType && currentSegment.highlightId === targetId) {
      currentSegment.indices.push(i)
    } else {
      if (currentSegment) segments.push(currentSegment)
      currentSegment = { type: targetType, indices: [i], highlightId: targetId, meaning: targetMeaning }
    }
  }
  if (currentSegment) segments.push(currentSegment)


  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null)

  return (
    <div
      ref={cardRef}
      onPointerDown={(e) => {
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch(err){}
        handleDragStart(e.clientX)
      }}
      onPointerMove={(e) => handleDragMove(e.clientX)}
      onPointerUp={(e) => {
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch(err){}
        handleDragEnd()
      }}
      onPointerCancel={handleDragEnd}
      className={`absolute w-full max-w-sm aspect-square bg-white dark:bg-gray-800 rounded-3xl shadow-2xl flex items-center justify-center p-8 select-none touch-none cursor-grab active:cursor-grabbing border-4 border-transparent ${
        !isDragging ? 'transition-all duration-300 ease-out' : ''
      }`}
      style={{
        transform: transformStyle,
        opacity: opacity,
        borderColor: isRight ? '#4ade80' : isLeft ? '#f87171' : 'transparent',
        boxShadow: isRight ? '0 20px 25px -5px rgba(74, 222, 128, 0.2)' : isLeft ? '0 20px 25px -5px rgba(248, 113, 113, 0.2)' : ''
      }}
    >
      {isRight && (
        <div className="absolute top-6 left-6 text-green-500 border-4 border-green-500 rounded-full p-2 rotate-12 opacity-80 bg-white">
          <ThumbsUp size={40} />
        </div>
      )}
      {isLeft && (
        <div className="absolute top-6 right-6 text-red-500 border-4 border-red-500 rounded-full p-2 -rotate-12 opacity-80 bg-white">
          <ThumbsDown size={40} />
        </div>
      )}

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          if (gameInputMode === 'word') {
            if (displayMode === 'words') {
              speakEnglish(card.sentence)
            } else {
              const h = card.highlights.find(x => x.id === onlyHighlightId)
              if (displayMode === 'sentence') {
                speakEnglish(h?.example || card.sentence)
              } else {
                if (h) speakEnglish(h.meaning)
              }
            }
          } else {
            const h = displayMode === 'sentence' ? null : card.highlights.find(x => x.id === onlyHighlightId)
            if (h) {
              const w = extractWordText(card.sentence, h.wordIndices)
              speakEnglish(w)
            } else {
              speakEnglish(card.sentence)
            }
          }
        }}
        title="Listen"
        className="absolute bottom-4 right-4 p-2 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
      >
        <Volume2 size={22} />
      </button>

      <div className="text-center w-full">
        <div className="text-3xl font-medium leading-relaxed text-gray-800 dark:text-gray-200 flex flex-wrap justify-center items-center whitespace-pre-wrap">
          {gameInputMode === 'word' ? (() => {
            if (displayMode === 'words') {
              return <span>{card.sentence}</span>
            }
            const h = card.highlights.find(x => x.id === onlyHighlightId)
            if (!h) return null

            if (displayMode === 'meanings') {
              return <span>{h.meaning}</span>
            }
            
            // displayMode === 'sentence'
            return (
              <div className="flex flex-col gap-2 w-full px-4 text-center">
                <span>{h.example || card.sentence}</span>
                {showHighlights && (
                  <span className="text-purple-600 dark:text-purple-400 text-lg font-medium mt-2">
                    {h.meaning}
                  </span>
                )}
              </div>
            )
          })() : (
          <>
          {displayMode === 'sentence' && initialSpace}
          {segments.map((seg, sIdx) => {
            const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
              return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '216, 180, 254'
            }

            if (displayMode !== 'sentence' && (seg.type !== 'highlight' || seg.highlightId !== onlyHighlightId)) {
              return null
            }

            const isHovered = hoveredHighlightId && seg.highlightId === hoveredHighlightId
            let segmentClass = "relative transition-colors px-0.5 rounded "
            let inlineStyle: React.CSSProperties = {}

            if (seg.type === 'highlight' && displayMode !== 'sentence' && showHighlights) {
              segmentClass += "group cursor-pointer "
            }

            if (seg.type === 'highlight' && displayMode === 'sentence') {
              segmentClass += "group cursor-pointer "
              if (settings.highlightMode === 'text') {
                inlineStyle = { 
                  color: isHovered ? settings.hoverColor : settings.highlightColor,
                  backgroundColor: 'transparent'
                }
              } else {
                segmentClass += settings.isDarkMode ? 'text-purple-100' : 'text-purple-900'
                const bgColor = isHovered 
                  ? `rgba(${hexToRgb(settings.hoverColor)}, ${settings.hoverOpacity})`
                  : `rgba(${hexToRgb(settings.highlightColor)}, ${settings.highlightOpacity})`
                inlineStyle = { backgroundColor: bgColor }
              }
            }

            return (
              <span key={sIdx}>
                <span 
                  className={segmentClass}
                  style={inlineStyle}
                  onMouseEnter={() => seg.type === 'highlight' && setHoveredHighlightId(seg.highlightId!)}
                  onMouseLeave={() => setHoveredHighlightId(null)}
                >
                  {displayMode === 'meanings' ? seg.meaning : seg.indices.map((idx, i) => (
                    <span key={idx}>
                      {words[idx]}
                      {i < seg.indices.length - 1 && spaces[idx]}
                    </span>
                  ))}

                  {seg.type === 'highlight' && (displayMode === 'sentence' || showHighlights) && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max max-w-[200px] pointer-events-none">
                      <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-base font-normal py-1.5 px-3 rounded-lg shadow-lg text-center break-words tracking-normal whitespace-pre-wrap text-left">
                        {displayMode === 'meanings'
                          ? seg.indices.map((idx, i) => words[idx] + (i < seg.indices.length - 1 ? spaces[idx] : '')).join('')
                          : seg.meaning}
                        <svg className="absolute text-gray-100 dark:text-gray-700 h-2 w-full left-0 top-full drop-shadow-sm" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                      </div>
                    </div>
                  )}
                </span>
                {displayMode === 'sentence' && sIdx < segments.length - 1 && spaces[seg.indices[seg.indices.length - 1]]}
              </span>
            )
          })}
          </>
          )}
        </div>
      </div>
    </div>
  )
}

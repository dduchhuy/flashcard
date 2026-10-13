import { useState, useRef, useEffect, useMemo, Component, ReactNode, ErrorInfo } from 'react'
import { useFlashcardStore, Flashcard, getCardTags, getCardsForMode, normalizePhraseItem } from '../store'
import { ThumbsDown, ThumbsUp, Lightbulb, LightbulbOff, Layers, MousePointerClick, Grid2X2, Type, BrainCircuit, Headphones, Volume2, Shuffle, Zap, ListOrdered, ToggleLeft, Skull, Sparkles, ChevronRight, Tag as TagIcon, ChevronDown, Check, Link2, Search, LayoutGrid, PenLine } from 'lucide-react'
import { MatchGame } from './games/MatchGame'
import { EmptyState, CardDetailModal, RootCardButton, GameHeader, ResultScreen, useGameTimer } from './games/shared'
import { MemoryGame } from './games/MemoryGame'
import { FillBlankGame } from './games/FillBlankGame'
import { ListenGame } from './games/ListenGame'
import { ScrambleGame } from './games/ScrambleGame'
import { SpeedGame } from './games/SpeedGame'
import { SentenceGame } from './games/SentenceGame'
import { TrueFalseGame } from './games/TrueFalseGame'
import { HangmanGame } from './games/HangmanGame'
import { TypingGame } from './games/TypingGame'
import { MissingLettersGame } from './games/MissingLettersGame'
import { WordSearchGame } from './games/WordSearchGame'
import { CrosswordGame } from './games/CrosswordGame'
import { WordChainGame } from './games/WordChainGame'
import { SelectDropdown } from './SelectDropdown'

type Segment = {
  type: 'normal' | 'highlight'
  indices: number[]
  highlightId?: string
  meaning?: string
}

type GameMode = 'menu' | 'swipe' | 'quiz' | 'match' | 'memory' | 'fill' | 'listen' | 'scramble' | 'speed' | 'sentence' | 'truefalse' | 'hangman' | 'typing' | 'missing' | 'wordsearch' | 'crossword' | 'wordchain'

interface ErrorBoundaryProps {
  children: ReactNode
  onReset: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GameErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20 px-4 max-w-md mx-auto animate-in fade-in flex flex-col items-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">An error occurred in the game</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {this.state.error?.message || 'Error initializing or loading game data.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              this.props.onReset()
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
          >
            Back to Games Menu
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

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
      {gameMode !== 'menu' && (
        <GameErrorBoundary key={gameMode} onReset={() => setGameMode('menu')}>
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
          {gameMode === 'missing' && <MissingLettersGame onExit={() => setGameMode('menu')} />}
          {gameMode === 'wordsearch' && <WordSearchGame onExit={() => setGameMode('menu')} />}
          {gameMode === 'crossword' && <CrosswordGame onExit={() => setGameMode('menu')} />}
          {gameMode === 'wordchain' && <WordChainGame onExit={() => setGameMode('menu')} />}
        </GameErrorBoundary>
      )}
    </div>
  )
}

function GameMenuCard({
  id,
  title,
  desc,
  icon,
  colorBg,
  colorText,
  hoverBorder,
  onSelect,
}: {
  id: GameMode
  title: string
  desc: string
  icon: React.ReactNode
  colorBg: string
  colorText: string
  hoverBorder: string
  onSelect: (mode: GameMode) => void
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`group relative w-full bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200/70 dark:border-gray-700/70 shadow-2xs hover:shadow-lg ${hoverBorder} hover:scale-[1.03] transition-all duration-300 flex flex-col justify-center text-left cursor-pointer overflow-hidden min-h-[58px]`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className={`w-9 h-9 rounded-xl ${colorBg} ${colorText} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-gray-900 dark:text-gray-100 text-sm group-hover:${colorText} transition-colors truncate`}>
            {title}
          </h4>
        </div>
        <ChevronRight size={16} className={`text-gray-400 group-hover:${colorText} group-hover:translate-x-0.5 transition-all shrink-0`} />
      </div>

      <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out overflow-hidden w-full">
        <div className="overflow-hidden">
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700/60 mt-2 leading-relaxed">
            {desc}
          </p>
        </div>
      </div>
    </button>
  )
}

function GameMenu({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const { flashcards, activeTags, setActiveTags, gameInputMode, setGameInputMode } = useFlashcardStore()
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const allTags = useMemo(() => Array.from(new Set(flashcards.flatMap(f => getCardTags(f)))).sort(), [flashcards])

  useEffect(() => {
    if (!tagDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tagDropdownOpen])

  const toggleTag = (tag: string) => {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter(t => t !== tag))
    } else {
      setActiveTags([...activeTags, tag])
    }
  }

  const eligibleCards = useMemo(() => {
    let list = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    return getCardsForMode(list, gameInputMode)
  }, [flashcards, activeTags, gameInputMode])

  return (
    <div className="w-full max-w-7xl mx-auto py-2 px-4 sm:px-6 lg:px-8 animate-in fade-in flex flex-col">
      {/* Compact 1-Line Header Bar: Mode Switcher + Tags + Cards Available */}
      <div className="w-full mb-4 py-2 px-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Mode Switcher */}
        <div className="bg-gray-100 dark:bg-gray-900/80 p-0.5 sm:p-1 rounded-xl flex items-center shadow-inner border border-gray-200/50 dark:border-gray-700/50 shrink-0">
          <button
            type="button"
            onClick={() => setGameInputMode('sentence')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              gameInputMode === 'sentence' 
                ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Sentence Mode
          </button>
          <button
            type="button"
            onClick={() => setGameInputMode('word')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              gameInputMode === 'word' 
                ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Flashcard Mode
          </button>
        </div>

        {/* Center / Right: Tags & Cards Available on the same row */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 ml-auto">
          {allTags.length > 0 && (
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setTagDropdownOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <TagIcon size={14} className="text-purple-500" />
                <span>{activeTags.length === 0 ? 'All tags' : `${activeTags.length} tag${activeTags.length > 1 ? 's' : ''}`}</span>
                <ChevronDown size={13} className={`text-gray-400 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {tagDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[190px] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setActiveTags([]); setTagDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between ${activeTags.length === 0 ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    All tags {activeTags.length === 0 && <Check size={14} />}
                  </button>
                  {allTags.map(tag => {
                    const isSelected = activeTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between ${isSelected ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        #{tag} {isSelected && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
            <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
            <span>{eligibleCards.length} cards available</span>
          </div>
        </div>
      </div>

      {/* Categorized Game Sections */}
      <div className="w-full space-y-4">
        {/* Section 1: Quick Recall & Review */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Quick Recall & Review
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            <GameMenuCard
              id="swipe"
              title="Swipe Cards"
              desc="Review & swipe right if remembered"
              icon={<Layers size={20} />}
              colorBg="bg-purple-100 dark:bg-purple-900/40"
              colorText="text-purple-600 dark:text-purple-400"
              hoverBorder="hover:border-purple-300 dark:hover:border-purple-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="quiz"
              title="Multiple Choice"
              desc="Select meaning from 4-6 options"
              icon={<MousePointerClick size={20} />}
              colorBg="bg-blue-100 dark:bg-blue-900/40"
              colorText="text-blue-600 dark:text-blue-400"
              hoverBorder="hover:border-blue-300 dark:hover:border-blue-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="truefalse"
              title="True or False"
              desc="Rapidly verify if meaning is correct"
              icon={<ToggleLeft size={20} />}
              colorBg="bg-rose-100 dark:bg-rose-900/40"
              colorText="text-rose-600 dark:text-rose-400"
              hoverBorder="hover:border-rose-300 dark:hover:border-rose-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="speed"
              title="Speed Match"
              desc="Beat the clock with streak combos"
              icon={<Zap size={20} />}
              colorBg="bg-yellow-100 dark:bg-yellow-900/40"
              colorText="text-yellow-600 dark:text-yellow-400"
              hoverBorder="hover:border-yellow-300 dark:hover:border-yellow-500"
              onSelect={onSelect}
            />
          </div>
        </div>

        {/* Section 2: Memory & Connections */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Memory & Connections
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            <GameMenuCard
              id="match"
              title="Match Game"
              desc="Connect words & phrases with meanings"
              icon={<Grid2X2 size={20} />}
              colorBg="bg-emerald-100 dark:bg-emerald-900/40"
              colorText="text-emerald-600 dark:text-emerald-400"
              hoverBorder="hover:border-emerald-300 dark:hover:border-emerald-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="memory"
              title="Memory Flip"
              desc="Flip cards to find hidden pairs"
              icon={<BrainCircuit size={20} />}
              colorBg="bg-pink-100 dark:bg-pink-900/40"
              colorText="text-pink-600 dark:text-pink-400"
              hoverBorder="hover:border-pink-300 dark:hover:border-pink-500"
              onSelect={onSelect}
            />
          </div>
        </div>

        {/* Section 3: Spelling & Construction */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Spelling & Construction
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            <GameMenuCard
              id="missing"
              title="Missing Letters"
              desc="Fill in missing letters: a _ a n d o n"
              icon={<PenLine size={20} />}
              colorBg="bg-amber-100 dark:bg-amber-900/40"
              colorText="text-amber-600 dark:text-amber-400"
              hoverBorder="hover:border-amber-300 dark:hover:border-amber-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="scramble"
              title="Word Scramble"
              desc="Rearrange letter tiles: tca ➔ cat"
              icon={<Shuffle size={20} />}
              colorBg="bg-indigo-100 dark:bg-indigo-900/40"
              colorText="text-indigo-600 dark:text-indigo-400"
              hoverBorder="hover:border-indigo-300 dark:hover:border-indigo-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="fill"
              title="Fill in the Blank"
              desc="Type or spell the exact missing word"
              icon={<Type size={20} />}
              colorBg="bg-orange-100 dark:bg-orange-900/40"
              colorText="text-orange-600 dark:text-orange-400"
              hoverBorder="hover:border-orange-300 dark:hover:border-orange-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="typing"
              title="Fill Blank (4 Choices)"
              desc="Choose the missing word in context"
              icon={<Type size={20} />}
              colorBg="bg-fuchsia-100 dark:bg-fuchsia-900/40"
              colorText="text-fuchsia-600 dark:text-fuchsia-400"
              hoverBorder="hover:border-fuchsia-300 dark:hover:border-fuchsia-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="sentence"
              title="Sentence Builder"
              desc="Put words into correct order"
              icon={<ListOrdered size={20} />}
              colorBg="bg-teal-100 dark:bg-teal-900/40"
              colorText="text-teal-600 dark:text-teal-400"
              hoverBorder="hover:border-teal-300 dark:hover:border-teal-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="listen"
              title="Dictation (Audio)"
              desc="Listen to native audio and write it"
              icon={<Headphones size={20} />}
              colorBg="bg-cyan-100 dark:bg-cyan-900/40"
              colorText="text-cyan-600 dark:text-cyan-400"
              hoverBorder="hover:border-cyan-300 dark:hover:border-cyan-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="hangman"
              title="Hangman"
              desc="Deduce the word letter by letter"
              icon={<Skull size={20} />}
              colorBg="bg-slate-100 dark:bg-slate-900/40"
              colorText="text-slate-600 dark:text-slate-400"
              hoverBorder="hover:border-slate-300 dark:hover:border-slate-500"
              onSelect={onSelect}
            />
          </div>
        </div>

        {/* Section 4: Word Games & Puzzles */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Word Games & Puzzles
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            <GameMenuCard
              id="wordchain"
              title="English Word Chain"
              desc="Chain words: apple ➔ elephant ➔ tiger"
              icon={<Link2 size={20} />}
              colorBg="bg-purple-100 dark:bg-purple-900/40"
              colorText="text-purple-600 dark:text-purple-400"
              hoverBorder="hover:border-purple-300 dark:hover:border-purple-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="wordsearch"
              title="Word Search"
              desc="Find hidden words in the letter grid"
              icon={<Search size={20} />}
              colorBg="bg-emerald-100 dark:bg-emerald-900/40"
              colorText="text-emerald-600 dark:text-emerald-400"
              hoverBorder="hover:border-emerald-300 dark:hover:border-emerald-500"
              onSelect={onSelect}
            />
            <GameMenuCard
              id="crossword"
              title="Crossword"
              desc="Solve interlocking crossword clues"
              icon={<LayoutGrid size={20} />}
              colorBg="bg-blue-100 dark:bg-blue-900/40"
              colorText="text-blue-600 dark:text-blue-400"
              hoverBorder="hover:border-blue-300 dark:hover:border-blue-500"
              onSelect={onSelect}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

import { extractWordText, speakEnglish } from '../utils'

function QuizGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const [quizMode, setQuizMode] = useState<'w2m' | 'm2w'>('w2m')
  const [quizSourceMode, setQuizSourceMode] = useState<'highlights' | 'phrases'>('highlights')
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

    if (quizSourceMode === 'phrases') {
      filtered.forEach(card => {
        const phrases = card.phrasesAndIdioms || []
        phrases.forEach((rawPi, idx) => {
          const pi = normalizePhraseItem(rawPi)
          if (!pi.phrase) return
          questions.push({
            cardId: card.id,
            highlightId: pi.id || `${card.id}-pi-${idx}`,
            word: pi.phrase,
            sentence: pi.phrase,
            correctMeaning: pi.translation || pi.phrase,
          })
        })
      })
      return questions.sort(() => Math.random() - 0.5)
    }
    
    if (uniqueWords) {
      // Each card appears only once, using only first highlight
      filtered.forEach(card => {
        const highlights = card.highlights || []
        if (highlights.length === 0) return
        const h = highlights[0]
        const wordText = extractWordText(card.sentence, h.wordIndices) || card.sentence
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
        const highlights = card.highlights || []
        highlights.forEach(h => {
          const wordText = extractWordText(card.sentence, h.wordIndices) || card.sentence
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
  }, [flashcards, seed, activeTags, uniqueWords, gameInputMode, quizSourceMode])

  const allMeanings = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.correctMeaning).filter(Boolean)))
  }, [allQuestions])

  const allWords = useMemo(() => {
    return Array.from(new Set(allQuestions.map(q => q.word).filter(Boolean)))
  }, [allQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const currentQ = allQuestions[currentIndex]
  const currentCardObj = currentQ ? flashcards.find(f => f.id === currentQ.cardId) : null
  const questionText = currentQ ? (quizMode === 'w2m' ? currentQ.word : currentQ.correctMeaning) : ''
  const correctOption = currentQ ? (quizMode === 'w2m' ? currentQ.correctMeaning : currentQ.word) : ''

  const options = useMemo(() => {
    if (!currentQ) return []
    const wrongCount = answerCount - 1
    let wrongOptions: string[] = []
    
    if (quizMode === 'w2m') {
      const validWrongQs = allQuestions.filter(q => 
        (q.word || '').toLowerCase() !== (currentQ.word || '').toLowerCase() &&
        (q.correctMeaning || '').toLowerCase() !== (currentQ.correctMeaning || '').toLowerCase()
      )
      const uniqueWrongMeanings = Array.from(new Set(validWrongQs.map(q => q.correctMeaning).filter(Boolean)))
      wrongOptions = uniqueWrongMeanings.sort(() => Math.random() - 0.5).slice(0, wrongCount)
    } else {
      const validWrongQs = allQuestions.filter(q => 
        (q.correctMeaning || '').toLowerCase() !== (currentQ.correctMeaning || '').toLowerCase() &&
        (q.word || '').toLowerCase() !== (currentQ.word || '').toLowerCase()
      )
      const uniqueWrongWords = Array.from(new Set(validWrongQs.map(q => q.word).filter(Boolean)))
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

  const handleTimeUp = () => {
    if (selectedOption) return
    setWrong(w => w + 1)
    setCurrentIndex(i => i + 1)
    timer.resetTimer()
  }

  const timer = useGameTimer({ initialSeconds: 15, onTimeUp: handleTimeUp })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedOption) return
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) {
        handleSelect(options[n - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [options, selectedOption, correctOption])

  if (currentIndex >= allQuestions.length) {
    return (
      <ResultScreen 
        title="Multiple Choice Complete!"
        correct={correct}
        wrong={wrong}
        skipped={skipped}
        onExit={onExit}
        onAgain={handleRestart}
      />
    )
  }

  const handleSelect = (option: string) => {
    if (selectedOption) return // prevent double click
    setSelectedOption(option)
    timer.resetTimer()
    if (option === correctOption) {
      setCorrect(c => c + 1)
    } else {
      setWrong(w => w + 1)
    }
    setTimeout(() => {
      setSelectedOption(null)
      setCurrentIndex(i => i + 1)
      timer.resetTimer()
    }, 1200)
  }

  const handleSkip = () => {
    if (selectedOption) return
    setSkipped(s => s + 1)
    setCurrentIndex(i => i + 1)
    timer.resetTimer()
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-3 sm:px-6 animate-in fade-in flex flex-col h-full">
      {/* Top Header */}
      <GameHeader
        onExit={onExit}
        current={currentIndex}
        total={allQuestions.length}
        timer={timer}
        center={
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {/* 1 Mean toggle on the left */}
            <button
              onClick={() => { setUniqueWords(u => !u); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); timer.resetTimer() }}
              title={uniqueWords ? 'Each word shown once (ON)' : 'Each word shown once (OFF)'}
              className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                uniqueWords
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              1 Mean
            </button>

            {/* Quiz mode segmented control */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button 
                onClick={() => { setQuizMode('m2w'); timer.resetTimer() }} 
                className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${quizMode === 'm2w' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Mean
              </button>
              <button 
                onClick={() => { setQuizMode('w2m'); timer.resetTimer() }} 
                className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${quizMode === 'w2m' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Word
              </button>
            </div>

            {/* Source mode toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs font-semibold">
              <button
                onClick={() => { setQuizSourceMode('highlights'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); timer.resetTimer() }}
                className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${quizSourceMode === 'highlights' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Words
              </button>
              <button
                onClick={() => { setQuizSourceMode('phrases'); setCurrentIndex(0); setCorrect(0); setWrong(0); setSkipped(0); timer.resetTimer() }}
                className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${quizSourceMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Phrases
              </button>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            <SelectDropdown
              value={String(answerCount)}
              onChange={v => setAnswerCount(Number(v))}
              options={[2,3,4,5,6,7,8].map(n => ({ value: String(n), label: `${n} opts` }))}
              className="w-24 flex-shrink-0"
              buttonClassName="!py-0.5 !text-xs !rounded-lg"
            />
          </div>
        }
      />

      {/* Question Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xs border border-gray-200/80 dark:border-gray-700/80 p-6 sm:p-8 mb-4 text-center flex flex-col items-center justify-center relative min-h-[130px] w-full">
        {currentCardObj && (
          <RootCardButton 
            onClick={() => setShowModalCard(currentCardObj)}
            className="absolute bottom-3 left-3"
          />
        )}

        {quizMode === 'w2m' && (
          <button
            onClick={() => speakEnglish(currentQ.word)}
            title="Listen pronunciation"
            className="absolute bottom-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
          >
            <Volume2 size={20} />
          </button>
        )}

        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white break-words whitespace-pre-wrap tracking-tight px-8">
          {questionText}
        </h2>
        
        {quizMode === 'w2m' && currentCardObj && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
            {(currentCardObj.posEntries ? currentCardObj.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCardObj.partOfSpeech) && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/50">
                {currentCardObj.posEntries ? currentCardObj.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : currentCardObj.partOfSpeech}
              </span>
            )}
            {currentCardObj.phonetic && (
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                {currentCardObj.phonetic}
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleSkip}
          disabled={!!selectedOption}
          className="absolute top-3 right-3 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 cursor-pointer"
        >
          Skip
        </button>
      </div>

      {/* Answer Options Grid (without numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-3 w-full">
        {options.map((opt, i) => {
          let baseBtnClass = "bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-200 shadow-2xs"
          let hoverBtnClass = "hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 hover:shadow-xs"
          
          if (selectedOption) {
            if (opt === correctOption) {
              baseBtnClass = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold ring-2 ring-emerald-400/40"
              hoverBtnClass = ""
            } else if (opt === selectedOption) {
              baseBtnClass = "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200 ring-2 ring-rose-400/40"
              hoverBtnClass = ""
            } else {
              baseBtnClass = "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-40"
              hoverBtnClass = ""
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              disabled={!!selectedOption}
              className={`w-full p-3 sm:p-4 rounded-2xl border text-center font-medium transition-all duration-200 ${baseBtnClass} ${hoverBtnClass} flex items-center justify-center min-h-[3.25rem] relative cursor-pointer`}
            >
              <div className="text-sm sm:text-base font-medium whitespace-pre-wrap break-words w-full px-3">
                {opt}
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom Stats */}
      <div className="flex items-center justify-center gap-6 mt-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span className="text-emerald-600 dark:text-emerald-400">{correct} correct</span>
        <span className="text-rose-600 dark:text-rose-400">{wrong} wrong</span>
        <span className="text-amber-600 dark:text-amber-400">{skipped} skip</span>
        <div className="w-px h-3.5 bg-gray-300 dark:bg-gray-700" />
        <span className="tabular-nums">
          {currentIndex + 1} / {allQuestions.length}
        </span>
      </div>

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}



function SwipeGame({ onExit }: { onExit: () => void }) {
  const { flashcards, activeTags, gameInputMode } = useFlashcardStore()
  const [learningCards, setLearningCards] = useState<{ card: Flashcard, hid: string | null }[]>([])
  const [swipeCount, setSwipeCount] = useState(0)
  const [showHighlights, setShowHighlights] = useState(false)
  const [displayMode, setDisplayMode] = useState<'sentence' | 'words' | 'meanings' | 'meaning-first' | 'phrases'>('sentence')
  const [knownCount, setKnownCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  const handleTimeUp = () => {
    if (learningCards.length === 0) return
    setLearningCards(prev => [...prev.slice(1), prev[0]])
    setSwipeCount(c => c + 1)
    setUnknownCount(c => c + 1)
    timer.reset()
  }

  const timer = useGameTimer({
    initialDuration: 15,
    onTimeUp: handleTimeUp,
    enabled: learningCards.length > 0
  })

  const getItems = (mode: 'sentence' | 'words' | 'meanings' | 'meaning-first' | 'phrases') => {
    let cardsToLearn = activeTags.length > 0 ? flashcards.filter(f => getCardTags(f).some(t => activeTags.includes(t))) : flashcards
    cardsToLearn = getCardsForMode(cardsToLearn, gameInputMode)

    let items: { card: Flashcard, hid: string | null }[]
    if (mode === 'phrases') {
      items = cardsToLearn.flatMap(card => 
        (card.phrasesAndIdioms || []).map(normalizePhraseItem).filter(p => p.phrase).map((p, idx) => ({ card, hid: p.id || `${card.id}-pi-${idx}` }))
      )
    } else if (mode === 'meaning-first') {
      items = cardsToLearn.map(card => {
        const firstH = (card.highlights || [])[0]
        return firstH ? { card, hid: firstH.id } : null
      }).filter((x): x is { card: Flashcard, hid: string } => !!x)
    } else if (gameInputMode === 'word') {
      if (mode === 'words') {
        items = cardsToLearn.map(card => ({ card, hid: null }))
      } else if (mode === 'sentence') {
        items = cardsToLearn.flatMap(card => {
          if (card.posEntries && card.posEntries.length > 0) {
            const exs: { card: Flashcard, hid: string }[] = []
            card.posEntries.forEach((pos, pi) => {
              pos.meanings.forEach((m, mi) => {
                (m.examples || []).forEach((ex, ei) => {
                  if (ex.sentence) {
                    exs.push({ card, hid: ex.id || `${card.id}-ex-${pi}-${mi}-${ei}` })
                  }
                })
              })
            })
            if (exs.length > 0) return exs
          }
          const hlExs = (card.highlights || []).filter(h => h.example)
          if (hlExs.length > 0) {
            return hlExs.map(h => ({ card, hid: h.id }))
          }
          return (card.highlights || []).map(h => ({ card, hid: h.id }))
        })
      } else {
        items = cardsToLearn.flatMap(card => (card.highlights || []).map(h => ({ card, hid: h.id })))
      }
    } else {
      if (mode === 'sentence') {
        items = cardsToLearn.map(card => ({ card, hid: null }))
      } else {
        items = cardsToLearn.flatMap(card => (card.highlights || []).map(h => ({ card, hid: h.id })))
      }
    }
    return items.sort(() => Math.random() - 0.5)
  }
  
  useEffect(() => {
    setLearningCards(getItems(displayMode))
    setKnownCount(0)
    setUnknownCount(0)
    setSwipeCount(0)
    timer.reset()
  }, [flashcards, displayMode, activeTags, gameInputMode])

  if (learningCards.length === 0) {
    if (swipeCount === 0) return <EmptyState onExit={onExit} text={displayMode === 'phrases' ? 'No phrases and idioms found.' : undefined} />
    return (
      <ResultScreen
        title="Swipe Review Complete!"
        correct={knownCount}
        wrong={unknownCount}
        onExit={onExit}
        onAgain={() => {
          setSwipeCount(0)
          setKnownCount(0)
          setUnknownCount(0)
          setLearningCards(getItems(displayMode))
          timer.reset()
        }}
      />
    )
  }

  const currentItem = learningCards[0]
  const currentCard = currentItem.card

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-4">
      {/* Header */}
      <GameHeader
        onExit={onExit}
        timer={timer}
        center={
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60 max-w-[360px] w-full text-xs font-semibold">
            <button 
              onClick={() => setDisplayMode('sentence')}
              className={`flex-1 py-1 rounded-lg transition-colors ${displayMode === 'sentence' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {gameInputMode === 'word' ? 'Sentences' : 'Sentence'}
            </button>
            <button 
              onClick={() => setDisplayMode('words')}
              className={`flex-1 py-1 rounded-lg transition-colors ${displayMode === 'words' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Words
            </button>
            <button 
              onClick={() => {
                if (displayMode === 'meanings') setDisplayMode('meaning-first')
                else if (displayMode === 'meaning-first') setDisplayMode('meanings')
                else setDisplayMode('meanings')
              }}
              className={`flex-1 py-1 rounded-lg transition-colors ${displayMode === 'meanings' || displayMode === 'meaning-first' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {displayMode === 'meaning-first' ? 'Meaning¹' : 'Meanings*'}
            </button>
            <button 
              onClick={() => setDisplayMode('phrases')}
              className={`flex-1 py-1 rounded-lg transition-colors ${displayMode === 'phrases' ? 'bg-white dark:bg-gray-700 shadow-xs text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Phrases
            </button>
          </div>
        }
        right={
          <button 
            onClick={() => setShowHighlights(!showHighlights)}
            title={showHighlights ? 'Hide Hints' : 'Show Hints'}
            className={`p-1.5 rounded-xl flex items-center justify-center transition-colors border ${
              showHighlights 
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            }`}
          >
            {showHighlights ? <Lightbulb size={16} /> : <LightbulbOff size={16} />}
          </button>
        }
      />
      
      <div className="relative w-full max-w-sm sm:max-w-md aspect-[4/3] sm:aspect-square flex items-center justify-center mt-2">
        <SwipeableCard 
          key={`${currentCard.id}-${currentItem.hid}-${swipeCount}`} 
          card={currentCard}
          onlyHighlightId={currentItem.hid}
          showHighlights={showHighlights}
          displayMode={displayMode}
          onShowDetail={setShowModalCard}
          onSwipedRight={() => {
            setLearningCards(prev => prev.slice(1))
            setSwipeCount(c => c + 1)
            setKnownCount(c => c + 1)
            timer.reset()
          }}
          onSwipedLeft={() => {
            setLearningCards(prev => [...prev.slice(1), currentItem])
            setSwipeCount(c => c + 1)
            setUnknownCount(c => c + 1)
            timer.reset()
          }}
        />
      </div>

      {/* Counters — clean, unboxed, minimal layout */}
      <div className="mt-4 flex items-center justify-center gap-8 sm:gap-10 w-full max-w-sm sm:max-w-md px-2 select-none">
        <div className="flex flex-col items-center">
          <span className="font-extrabold text-rose-500 text-lg sm:text-xl leading-none">{unknownCount}</span>
          <span className="text-xs font-semibold text-rose-400/80 mt-1">Unknown</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-extrabold text-gray-700 dark:text-gray-300 text-lg sm:text-xl leading-none">{learningCards.length}</span>
          <span className="text-xs font-semibold text-gray-400 mt-1">Remaining</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-extrabold text-emerald-500 text-lg sm:text-xl leading-none">{knownCount}</span>
          <span className="text-xs font-semibold text-emerald-400/80 mt-1">Known</span>
        </div>
      </div>

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

function SwipeableCard({ 
  card, 
  onlyHighlightId,
  showHighlights,
  displayMode,
  onShowDetail,
  onSwipedRight, 
  onSwipedLeft 
}: { 
  card: Flashcard, 
  onlyHighlightId: string | null,
  showHighlights: boolean,
  displayMode: 'sentence' | 'words' | 'meanings' | 'meaning-first' | 'phrases',
  onShowDetail?: (card: Flashcard) => void,
  onSwipedRight: () => void, 
  onSwipedLeft: () => void 
}) {
  const { settings, gameInputMode } = useFlashcardStore()
  const cardRef = useRef<HTMLDivElement>(null)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swiped, setSwiped] = useState(false)
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null)

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
  const rightProgress = Math.min(1, Math.max(0, offsetX / 100))
  const leftProgress = Math.min(1, Math.max(0, -offsetX / 100))

  const dynamicBorderColor = offsetX > 0
    ? `rgba(74, 222, 128, ${rightProgress})`
    : offsetX < 0
    ? `rgba(244, 63, 94, ${leftProgress})`
    : 'transparent'

  const dynamicBoxShadow = offsetX > 0
    ? `0 10px 25px -3px rgba(74, 222, 128, ${rightProgress * 0.3})`
    : offsetX < 0
    ? `0 10px 25px -3px rgba(244, 63, 94, ${leftProgress * 0.3})`
    : ''

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
    const highlight = (showHighlights || displayMode !== 'sentence') ? (card.highlights || []).find(h => h.wordIndices.includes(i)) : undefined
    
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
      className={`absolute w-full max-w-sm sm:max-w-md aspect-[4/3] sm:aspect-square bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center p-5 select-none touch-none cursor-grab active:cursor-grabbing border-4 border-transparent ${
        !isDragging ? 'transition-all duration-300 ease-out' : ''
      }`}
      style={{
        transform: transformStyle,
        opacity: opacity,
        borderColor: dynamicBorderColor,
        boxShadow: dynamicBoxShadow
      }}
    >
      {offsetX > 5 && (
        <div 
          className="absolute top-4 right-4 text-emerald-500 border-2 border-emerald-500 rounded-full p-2 sm:p-2.5 shadow-md bg-white/95 dark:bg-gray-800/95 pointer-events-none rotate-12 flex items-center justify-center"
          style={{ opacity: Math.min(1, Math.max(0, (offsetX - 5) / 70)) }}
        >
          <ThumbsUp size={24} strokeWidth={2.5} />
        </div>
      )}
      {offsetX < -5 && (
        <div 
          className="absolute top-4 left-4 text-rose-500 border-2 border-rose-500 rounded-full p-2 sm:p-2.5 shadow-md bg-white/95 dark:bg-gray-800/95 pointer-events-none -rotate-12 flex items-center justify-center"
          style={{ opacity: Math.min(1, Math.max(0, (-offsetX - 5) / 70)) }}
        >
          <ThumbsDown size={24} strokeWidth={2.5} />
        </div>
      )}

      {/* Bottom-left root card button */}
      <RootCardButton
        onClick={() => onShowDetail?.(card)}
        className="absolute bottom-3 left-3"
      />

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          if (displayMode === 'phrases') {
            const rawPi = (card.phrasesAndIdioms || []).find((x, idx) => (x.id || `${card.id}-pi-${idx}`) === onlyHighlightId)
            const pi = rawPi ? normalizePhraseItem(rawPi) : null
            speakEnglish(pi ? pi.phrase : card.sentence)
            return
          }
          if (gameInputMode === 'word') {
            if (displayMode === 'words') {
              speakEnglish(card.sentence)
            } else {
              const h = (card.highlights || []).find(x => x.id === onlyHighlightId)
              if (displayMode === 'sentence') {
                let sentenceToSpeak = card.sentence
                if (card.posEntries) {
                  for (let pi = 0; pi < card.posEntries.length; pi++) {
                    const pos = card.posEntries[pi]
                    for (let mi = 0; mi < pos.meanings.length; mi++) {
                      const m = pos.meanings[mi]
                      const examples = m.examples || []
                      for (let ei = 0; ei < examples.length; ei++) {
                        const ex = examples[ei]
                        const exId = ex.id || `${card.id}-ex-${pi}-${mi}-${ei}`
                        if (exId === onlyHighlightId) {
                          sentenceToSpeak = ex.sentence
                          break
                        }
                      }
                      if (sentenceToSpeak !== card.sentence) break
                    }
                    if (sentenceToSpeak !== card.sentence) break
                  }
                }
                if (sentenceToSpeak === card.sentence && h?.example) {
                  sentenceToSpeak = h.example
                }
                speakEnglish(sentenceToSpeak)
              } else {
                if (h) speakEnglish(h.meaning)
              }
            }
          } else {
            const h = displayMode === 'sentence' ? null : (card.highlights || []).find(x => x.id === onlyHighlightId)
            if (h) {
              const w = extractWordText(card.sentence, h.wordIndices)
              speakEnglish(w)
            } else {
              speakEnglish(card.sentence)
            }
          }
        }}
        title="Listen"
        className="absolute bottom-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
      >
        <Volume2 size={20} />
      </button>

      <div className="text-center w-full">
        <div className="text-xl sm:text-2xl font-medium leading-relaxed text-gray-800 dark:text-gray-200 flex flex-wrap justify-center items-center whitespace-pre-wrap">
          {displayMode === 'phrases' ? (() => {
            const rawPi = (card.phrasesAndIdioms || []).find((x, idx) => (x.id || `${card.id}-pi-${idx}`) === onlyHighlightId)
            if (!rawPi) return null
            const pi = normalizePhraseItem(rawPi)
            return (
              <div className="flex flex-col items-center gap-1.5 w-full px-4 text-center">
                <span className="font-bold text-xl text-gray-800 dark:text-gray-100">{pi.phrase}</span>
                {showHighlights && (
                  <span className="text-purple-600 dark:text-purple-400 text-base font-medium mt-1">
                    {pi.translation}
                  </span>
                )}
              </div>
            )
          })() : gameInputMode === 'word' ? (() => {
            if (displayMode === 'words') {
              return (
                <div className="flex flex-col items-center gap-1 w-full px-4 text-center">
                  <span className="font-bold">{card.sentence}</span>
                  {(card.posEntries ? card.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : card.partOfSpeech) && (
                    <span className="text-sm italic text-gray-500 dark:text-gray-400 font-normal">
                      {card.posEntries ? card.posEntries.map(p => p.partOfSpeech).filter(Boolean).join(', ') : card.partOfSpeech}
                    </span>
                  )}
                  {card.phonetic && (
                    <span className="text-sm italic text-gray-400 dark:text-gray-500 font-normal">
                      {card.phonetic}
                    </span>
                  )}
                  {showHighlights && (card.highlights || []).length > 0 && (
                    <span className="text-purple-600 dark:text-purple-400 text-lg font-medium mt-2">
                      {(card.highlights || [])[0].meaning}
                    </span>
                  )}
                </div>
              )
            }
            if (displayMode === 'meanings' || displayMode === 'meaning-first') {
              const h = (card.highlights || []).find(x => x.id === onlyHighlightId)
              if (!h) return null
              return (
                <div className="flex flex-col items-center gap-2 w-full px-4 text-center">
                  <span>{h.meaning}</span>
                  {showHighlights && (
                    <span className="text-purple-600 dark:text-purple-400 text-lg font-medium mt-2">
                      {card.sentence}
                    </span>
                  )}
                </div>
              )
            }
            
            // displayMode === 'sentence'
            let sentenceText = ''
            let sentenceHint = ''

            // 1. Try finding in card.posEntries by example ID
            if (card.posEntries && card.posEntries.length > 0) {
              for (let pi = 0; pi < card.posEntries.length; pi++) {
                const pos = card.posEntries[pi]
                for (let mi = 0; mi < pos.meanings.length; mi++) {
                  const m = pos.meanings[mi]
                  const examples = m.examples || []
                  for (let ei = 0; ei < examples.length; ei++) {
                    const ex = examples[ei]
                    const exId = ex.id || `${card.id}-ex-${pi}-${mi}-${ei}`
                    if (exId === onlyHighlightId || ex.sentence === onlyHighlightId) {
                      sentenceText = ex.sentence
                      sentenceHint = ex.translation || ''
                      break
                    }
                  }
                  if (sentenceText) break
                }
                if (sentenceText) break
              }
            }

            // 2. If not found by example ID, check highlights
            if (!sentenceText) {
              const h = (card.highlights || []).find(x => x.id === onlyHighlightId)
              if (h && h.example) {
                sentenceText = h.example
                sentenceHint = h.meaning
                if (card.posEntries) {
                  for (const pos of card.posEntries) {
                    for (const m of pos.meanings) {
                      for (const ex of (m.examples || [])) {
                        if (ex.sentence === h.example && ex.translation) {
                          sentenceHint = ex.translation
                          break
                        }
                      }
                      if (sentenceHint !== h.meaning) break
                    }
                    if (sentenceHint !== h.meaning) break
                  }
                }
              }
            }

            // 3. Fallback: first available example in posEntries
            if (!sentenceText && card.posEntries) {
              for (const pos of card.posEntries) {
                for (const m of pos.meanings) {
                  for (const ex of (m.examples || [])) {
                    if (ex.sentence) {
                      sentenceText = ex.sentence
                      sentenceHint = ex.translation || ''
                      break
                    }
                  }
                  if (sentenceText) break
                }
                if (sentenceText) break
              }
            }

            // 4. Final fallback: card's word sentence
            if (!sentenceText) {
              sentenceText = card.sentence
              sentenceHint = (card.highlights || [])[0]?.meaning || ''
            }

            return (
              <div className="flex flex-col gap-2 w-full px-4 text-center">
                <span className="font-medium text-2xl leading-relaxed">{sentenceText}</span>
                {showHighlights && sentenceHint && (
                  <span className="text-purple-600 dark:text-purple-400 text-lg font-medium mt-2">
                    {sentenceHint}
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
          {displayMode === 'sentence' && showHighlights && (card.highlights || []).length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
              {(card.highlights || []).map((hl, i) => (
                <span key={i} className="text-purple-600 dark:text-purple-400 text-lg font-medium">
                  {hl.meaning}
                </span>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  )
}

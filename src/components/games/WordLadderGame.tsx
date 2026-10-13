import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, RotateCcw, ArrowDown, RefreshCw } from 'lucide-react'
import { useNotes, RootCardButton, CardDetailModal, GameHeader, ResultScreen } from './shared'
import { useFlashcardStore, Flashcard } from '../../store'
import { speakEnglish } from '../../utils'

// Common English 3-letter & 4-letter dictionary
const COMMON_DICTIONARY = new Set([
  // 3-letter words
  'act', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'all', 'and', 'ant', 'any', 'ape', 'arc', 'are', 'ark', 'arm', 'art', 'ash', 'ask', 'ate',
  'bad', 'bag', 'ban', 'bar', 'bat', 'bay', 'bed', 'bee', 'beg', 'bet', 'bid', 'big', 'bin', 'bit', 'bob', 'bog', 'bow', 'box', 'boy', 'bud', 'bug', 'bun', 'bus', 'but', 'buy', 'bye',
  'cab', 'can', 'cap', 'car', 'cat', 'cob', 'cod', 'cog', 'con', 'cop', 'cot', 'cow', 'cry', 'cup', 'cut',
  'dad', 'dam', 'day', 'den', 'dew', 'did', 'die', 'dig', 'dim', 'din', 'dip', 'doc', 'doe', 'dog', 'dot', 'dry', 'due', 'dug',
  'ear', 'eat', 'ebb', 'eel', 'egg', 'ego', 'elf', 'elk', 'elm', 'end', 'era', 'eve', 'eye',
  'fad', 'fan', 'far', 'fat', 'fed', 'fee', 'few', 'fig', 'fit', 'fix', 'fly', 'foe', 'fog', 'for', 'fox', 'fry', 'fun', 'fur',
  'gap', 'gas', 'gel', 'gem', 'get', 'gin', 'god', 'got', 'gum', 'gun', 'gut', 'guy', 'gym',
  'had', 'ham', 'has', 'hat', 'hay', 'hem', 'hen', 'her', 'hid', 'him', 'hip', 'his', 'hit', 'hog', 'hop', 'hot', 'how', 'hub', 'hue', 'hug', 'hum', 'hut',
  'ice', 'icy', 'ill', 'ink', 'inn', 'ion', 'ire', 'irk', 'its', 'ivy',
  'jab', 'jam', 'jar', 'jaw', 'jay', 'jet', 'jig', 'job', 'jog', 'joy', 'jug',
  'keg', 'key', 'kid', 'kin', 'kit',
  'lab', 'lad', 'lag', 'lap', 'law', 'lay', 'led', 'leg', 'let', 'lid', 'lie', 'lip', 'lit', 'log', 'lot', 'low',
  'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mid', 'mix', 'mob', 'mop', 'mud', 'mug', 'mum',
  'nag', 'nap', 'net', 'new', 'nib', 'nil', 'nip', 'nod', 'not', 'now', 'nun', 'nut',
  'oaf', 'oak', 'oar', 'oat', 'odd', 'off', 'oft', 'oil', 'old', 'one', 'opt', 'orb', 'ore', 'our', 'out', 'owl', 'own',
  'pad', 'pal', 'pan', 'pat', 'paw', 'pay', 'pea', 'peg', 'pen', 'pet', 'pew', 'pie', 'pig', 'pin', 'pip', 'pit', 'ply', 'pod', 'pop', 'pot', 'pro', 'pry', 'pub', 'pun', 'pup',
  'rag', 'ram', 'ran', 'rap', 'rat', 'raw', 'ray', 'red', 'rib', 'rid', 'rig', 'rim', 'rip', 'rob', 'rod', 'roe', 'rot', 'row', 'rub', 'rug', 'run', 'rut', 'rye',
  'sad', 'sag', 'sap', 'sat', 'saw', 'say', 'sea', 'see', 'set', 'sew', 'she', 'shy', 'sin', 'sip', 'sir', 'sit', 'six', 'ski', 'sky', 'sly', 'sob', 'sod', 'son', 'sop', 'sow', 'soy', 'spa', 'spy', 'sty', 'sub', 'sue', 'sum', 'sun',
  'tab', 'tag', 'tan', 'tap', 'tar', 'tax', 'tea', 'ted', 'tee', 'ten', 'the', 'tie', 'tin', 'tip', 'toe', 'ton', 'too', 'top', 'tow', 'toy', 'try', 'tub', 'tug', 'two',
  'urn', 'use',
  'van', 'vat', 'vet', 'via', 'vow',
  'wad', 'wag', 'war', 'was', 'wax', 'way', 'web', 'wed', 'wet', 'who', 'why', 'wig', 'win', 'wit', 'woe', 'won', 'woo',
  'yak', 'yam', 'yap', 'yea', 'yes', 'yet', 'yew', 'you',
  'zag', 'zap', 'zed', 'zen', 'zip', 'zoo',
  // 4-letter words
  'bake', 'ball', 'band', 'bare', 'bark', 'barn', 'base', 'bass', 'bath', 'beam', 'bean', 'bear', 'beat', 'bell', 'bend', 'best', 'bill', 'bind', 'bird', 'bite', 'blow', 'blue', 'boat', 'body', 'bold', 'bolt', 'bomb', 'bond', 'bone', 'book', 'boom', 'boot', 'bore', 'born', 'boss', 'both', 'bowl', 'burn', 'bush', 'busy',
  'cake', 'call', 'calm', 'camp', 'cane', 'card', 'care', 'cart', 'case', 'cast', 'cave', 'cell', 'chat', 'chin', 'chip', 'clay', 'clip', 'club', 'clue', 'coal', 'coat', 'coin', 'cold', 'comb', 'cook', 'cool', 'cope', 'cord', 'core', 'cork', 'corn', 'cost', 'cure',
  'dare', 'dark', 'dart', 'dash', 'date', 'dawn', 'dead', 'deaf', 'deal', 'dear', 'debt', 'deck', 'deed', 'deep', 'deer', 'desk', 'diet', 'dirt', 'disc', 'dish', 'dock', 'doll', 'dome', 'door', 'dose', 'down', 'drag', 'drop', 'drum', 'duck', 'dusk', 'dust',
  'face', 'fact', 'fade', 'fail', 'fair', 'fall', 'fame', 'fare', 'farm', 'fast', 'fate', 'fear', 'feed', 'feel', 'fell', 'file', 'fill', 'film', 'find', 'fine', 'fire', 'firm', 'fish', 'fist', 'flat', 'flee', 'folk', 'fond', 'food', 'fool', 'foot', 'ford', 'fork', 'form', 'fort', 'foul', 'four', 'free', 'frog', 'fuel', 'full', 'fund', 'fuse',
  'game', 'gang', 'gate', 'gear', 'gift', 'girl', 'give', 'glad', 'glow', 'glue', 'goal', 'goat', 'gold', 'golf', 'gone', 'good', 'grab', 'grey', 'grip', 'grow', 'gulf',
  'hair', 'half', 'hall', 'halt', 'hand', 'hang', 'hard', 'hare', 'harm', 'hate', 'have', 'hawk', 'head', 'heal', 'heap', 'hear', 'heat', 'heel', 'hell', 'help', 'herb', 'herd', 'hero', 'hide', 'hill', 'hint', 'hire', 'hold', 'hole', 'home', 'hook', 'hope', 'horn', 'hose', 'host', 'hour', 'huge', 'hunt', 'hurt',
  'iron', 'item', 'join', 'joke', 'jump', 'jury', 'just', 'keen', 'keep', 'kick', 'kill', 'kind', 'king', 'kiss', 'kite', 'knee', 'knot',
  'lace', 'lack', 'lake', 'lamb', 'lamp', 'land', 'lane', 'last', 'late', 'lead', 'leaf', 'leak', 'lean', 'leap', 'left', 'lend', 'lens', 'less', 'life', 'lift', 'like', 'limb', 'lime', 'line', 'link', 'lion', 'list', 'live', 'load', 'loaf', 'loan', 'lock', 'loft', 'lone', 'long', 'look', 'lord', 'lose', 'loss', 'lost', 'loud', 'love', 'luck', 'lump', 'lung',
  'made', 'maid', 'mail', 'main', 'make', 'male', 'mall', 'many', 'mark', 'mask', 'mass', 'mast', 'mate', 'maze', 'meal', 'mean', 'meat', 'melt', 'mend', 'menu', 'mesh', 'mess', 'mild', 'mile', 'milk', 'mill', 'mind', 'mine', 'mint', 'miss', 'mist', 'mode', 'mold', 'mole', 'mood', 'moon', 'moor', 'more', 'moss', 'most', 'moth', 'move', 'much', 'mud', 'mule',
  'nail', 'name', 'near', 'neat', 'neck', 'need', 'nest', 'news', 'next', 'nice', 'nine', 'node', 'none', 'noon', 'norm', 'nose', 'note',
  'pace', 'pack', 'page', 'paid', 'pain', 'pair', 'pale', 'palm', 'pane', 'park', 'part', 'pass', 'past', 'path', 'peak', 'pear', 'peel', 'peer', 'pile', 'pill', 'pine', 'pink', 'pipe', 'plan', 'play', 'plot', 'plug', 'plum', 'plus', 'poem', 'poet', 'pole', 'poll', 'pond', 'pool', 'poor', 'pope', 'pork', 'port', 'pose', 'post', 'pour', 'pray', 'pure', 'push',
  'race', 'rack', 'raft', 'rage', 'raid', 'rail', 'rain', 'rake', 'rank', 'rare', 'rate', 'read', 'real', 'rear', 'reed', 'reef', 'rein', 'rely', 'rent', 'rest', 'rice', 'rich', 'ride', 'ring', 'riot', 'ripe', 'rise', 'risk', 'road', 'roam', 'roar', 'robe', 'rock', 'role', 'roll', 'roof', 'room', 'root', 'rope', 'rose', 'rout', 'rude', 'ruin', 'rule', 'rush', 'rust',
  'safe', 'sage', 'sail', 'sake', 'sale', 'salt', 'same', 'sand', 'sane', 'save', 'seal', 'seam', 'seat', 'seed', 'seek', 'seem', 'seen', 'self', 'sell', 'send', 'shed', 'ship', 'shoe', 'shop', 'shot', 'show', 'shut', 'side', 'sigh', 'sign', 'silk', 'sink', 'site', 'size', 'skin', 'skip', 'slab', 'slam', 'slap', 'sled', 'slim', 'slip', 'slit', 'slot', 'slow', 'slug', 'snap', 'snow', 'soap', 'soar', 'sock', 'sofa', 'soil', 'sole', 'solo', 'some', 'song', 'soon', 'sore', 'sort', 'soul', 'soup', 'sour', 'span', 'spat', 'spin', 'spit', 'spot', 'spur', 'star', 'stay', 'stem', 'step', 'stew', 'stir', 'stop', 'stub', 'such', 'suit', 'sure', 'surf', 'swan', 'swap', 'swim',
  'tail', 'take', 'tale', 'talk', 'tall', 'tame', 'tank', 'tape', 'task', 'team', 'tear', 'tell', 'term', 'test', 'text', 'thou', 'tide', 'tidy', 'tile', 'till', 'time', 'tiny', 'tire', 'toad', 'toll', 'tomb', 'tone', 'tool', 'tour', 'town', 'trap', 'tray', 'tree', 'trek', 'trim', 'trip', 'true', 'tube', 'tune', 'turf', 'turn', 'twin', 'type',
  'unit', 'upon', 'urge', 'used', 'user', 'vail', 'vain', 'vale', 'vane', 'vary', 'vase', 'vast', 'veil', 'vein', 'vent', 'verb', 'very', 'vest', 'vice', 'view', 'vine', 'visa', 'void', 'vote',
  'wade', 'wage', 'wait', 'wake', 'walk', 'wall', 'wand', 'want', 'ward', 'warm', 'warn', 'warp', 'wart', 'wary', 'wash', 'wasp', 'wave', 'weak', 'wear', 'weed', 'week', 'weep', 'well', 'went', 'wept', 'west', 'wide', 'wild', 'will', 'wind', 'wine', 'wing', 'wink', 'wire', 'wise', 'wish', 'with', 'wolf', 'wood', 'wool', 'word', 'wore', 'work', 'worm', 'worn', 'wrap',
  'yard', 'yarn', 'year', 'yell', 'yoga', 'yoke', 'zone'
])

// Check if two words differ by exactly 1 letter
function isOneLetterDiff(w1: string, w2: string): boolean {
  if (w1.length !== w2.length) return false
  let diff = 0
  for (let i = 0; i < w1.length; i++) {
    if (w1[i] !== w2[i]) {
      diff++
      if (diff > 1) return false
    }
  }
  return diff === 1
}

// Find shortest ladder path using BFS
function findLadderPath(start: string, target: string, dict: Set<string>): string[] | null {
  if (start === target) return [start]
  const queue: string[][] = [[start]]
  const visited = new Set<string>([start])

  while (queue.length > 0) {
    const path = queue.shift()!
    const curr = path[path.length - 1]

    if (curr === target) return path
    if (path.length > 6) continue // cap max depth for speed

    // Find neighbors
    for (let i = 0; i < curr.length; i++) {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'
      for (const ch of alphabet) {
        if (ch === curr[i]) continue
        const nextWord = curr.slice(0, i) + ch + curr.slice(i + 1)
        if (dict.has(nextWord) && !visited.has(nextWord)) {
          visited.add(nextWord)
          queue.push([...path, nextWord])
        }
      }
    }
  }
  return null
}

export function WordLadderGame({ onExit }: { onExit: () => void }) {
  const { flashcards } = useFlashcardStore()
  const [seed, setSeed] = useState(0)
  const allNotes = useNotes(seed, true)

  // Merge custom flashcard words into dictionary
  const fullDictionary = useMemo(() => {
    const s = new Set<string>(COMMON_DICTIONARY)
    for (const n of allNotes) {
      const clean = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (clean.length === 3 || clean.length === 4) s.add(clean)
    }
    return s
  }, [allNotes])

  // Generate a valid (start, target) pair from dictionary / notes that has a solution of 2-4 steps
  const puzzle = useMemo(() => {
    const threeLetterNotes = allNotes.filter(n => {
      const c = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      return c.length === 3 || c.length === 4
    })

    // Try finding starting from notes first
    for (const n of threeLetterNotes) {
      const startW = n.word.trim().toLowerCase().replace(/[^a-z]/g, '')
      if (!fullDictionary.has(startW)) continue

      // Pick other words of same length
      const candidates = Array.from(fullDictionary).filter(w => w.length === startW.length && w !== startW)
      const shuffled = candidates.sort(() => Math.random() - 0.5)

      for (let i = 0; i < Math.min(20, shuffled.length); i++) {
        const targetW = shuffled[i]
        const path = findLadderPath(startW, targetW, fullDictionary)
        if (path && path.length >= 3 && path.length <= 5) {
          return { start: startW, target: targetW, shortestPath: path, note: n }
        }
      }
    }

    // Fallback: classic pairs
    const classicPairs = [
      { start: 'cat', target: 'dog' },
      { start: 'cold', target: 'warm' },
      { start: 'lead', target: 'gold' },
      { start: 'head', target: 'tail' },
      { start: 'sun', target: 'sea' },
      { start: 'boy', target: 'man' },
    ]
    const chosen = classicPairs[Math.floor(Math.random() * classicPairs.length)]
    const path = findLadderPath(chosen.start, chosen.target, fullDictionary) || [chosen.start, chosen.target]
    return { start: chosen.start, target: chosen.target, shortestPath: path, note: null }
  }, [allNotes, fullDictionary, seed])

  const [rungs, setRungs] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showModalCard, setShowModalCard] = useState<Flashcard | null>(null)

  useEffect(() => {
    setRungs([puzzle.start])
    setCurrentInput('')
    setErrorMessage('')
  }, [puzzle])

  const currentTopWord = rungs[rungs.length - 1]
  const isCompleted = currentTopWord === puzzle.target

  const handleAddWord = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isCompleted) return

    const guess = currentInput.trim().toLowerCase()
    if (!guess) return

    if (guess.length !== puzzle.start.length) {
      setErrorMessage(`Từ phải có đúng ${puzzle.start.length} chữ cái!`)
      return
    }

    if (!isOneLetterDiff(currentTopWord, guess)) {
      setErrorMessage(`Chỉ được đổi đúng 1 chữ cái từ "${currentTopWord.toUpperCase()}"!`)
      return
    }

    if (!fullDictionary.has(guess)) {
      setErrorMessage(`"${guess.toUpperCase()}" không có trong từ điển tiếng Anh hợp lệ!`)
      return
    }

    // Success: add rung
    setRungs(prev => [...prev, guess])
    setCurrentInput('')
    setErrorMessage('')
    speakEnglish(guess)
  }

  const handleUndo = () => {
    if (rungs.length <= 1 || isCompleted) return
    setRungs(prev => prev.slice(0, prev.length - 1))
    setErrorMessage('')
  }

  const handleHint = () => {
    if (isCompleted) return
    // Find next word in shortest path from current word to target
    const pathFromCurrent = findLadderPath(currentTopWord, puzzle.target, fullDictionary)
    if (pathFromCurrent && pathFromCurrent.length > 1) {
      const nextWord = pathFromCurrent[1]
      setRungs(prev => [...prev, nextWord])
      setCurrentInput('')
      setErrorMessage('')
      speakEnglish(nextWord)
    }
  }

  if (isCompleted) {
    return (
      <ResultScreen
        title="Word Ladder Reached!"
        correct={rungs.length - 1}
        wrong={0}
        onExit={onExit}
        onAgain={() => setSeed(s => s + 1)}
      />
    )
  }

  const parSteps = puzzle.shortestPath.length - 1
  const cardForStart = puzzle.note ? flashcards.find(f => f.id === puzzle.note!.cardId) : null

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-start relative animate-in fade-in py-2 px-4 select-none">
      <GameHeader
        onExit={onExit}
        center={
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200">
            <span>Word Ladder · Biến đổi từ</span>
            <span className="text-gray-400">·</span>
            <span className="text-purple-600 dark:text-purple-400">Par: {parSteps} bước</span>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleHint}
              title="Gợi ý bước kế tiếp"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
            >
              <Lightbulb size={16} />
            </button>
            <button
              onClick={() => setSeed(s => s + 1)}
              title="Tạo màn mới"
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />

      {/* Ladder Card */}
      <div className="w-full bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-md p-5 sm:p-6 mt-2 flex flex-col items-center relative">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
          Biến từ <span className="font-extrabold text-purple-600 uppercase">{puzzle.start}</span> thành{' '}
          <span className="font-extrabold text-emerald-600 uppercase">{puzzle.target}</span> bằng cách đổi từng chữ cái!
        </div>

        {/* Visual Ladder Display */}
        <div className="w-full max-w-xs space-y-2 mb-6">
          {/* Target Word at the goal end */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border-2 border-dashed border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200">
            <div className="text-xs font-semibold text-emerald-600">Đích đến (Goal):</div>
            <div className="flex gap-1.5">
              {puzzle.target.toUpperCase().split('').map((ch, idx) => (
                <span key={idx} className="w-8 h-9 rounded-lg bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center text-gray-300 dark:text-gray-600">
            <ArrowDown size={18} />
          </div>

          {/* Rungs Walked */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {rungs.map((rWord, rIdx) => {
              const prevW = rIdx > 0 ? rungs[rIdx - 1] : null
              return (
                <div
                  key={`${rWord}-${rIdx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 shadow-xs"
                >
                  <div className="text-xs font-semibold text-gray-400">
                    {rIdx === 0 ? 'Bắt đầu' : `Bước ${rIdx}`}
                  </div>
                  <div className="flex gap-1.5">
                    {rWord.toUpperCase().split('').map((ch, idx) => {
                      const isChanged = prevW && prevW[idx].toUpperCase() !== ch
                      return (
                        <span
                          key={idx}
                          className={`w-8 h-9 rounded-lg font-black text-lg flex items-center justify-center shadow-xs ${
                            isChanged
                              ? 'bg-purple-600 text-white scale-105'
                              : 'bg-white dark:bg-gray-750 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {ch}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Input Form for Next Step */}
        <form onSubmit={handleAddWord} className="w-full max-w-xs space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              maxLength={puzzle.start.length}
              value={currentInput}
              onChange={(e) => {
                setCurrentInput(e.target.value.toLowerCase())
                if (errorMessage) setErrorMessage('')
              }}
              placeholder={`Đổi 1 chữ từ ${currentTopWord.toUpperCase()}...`}
              className="flex-1 p-2.5 rounded-xl border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold uppercase tracking-wider text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Thử
            </button>
            {rungs.length > 1 && (
              <button
                type="button"
                onClick={handleUndo}
                title="Lùi 1 bước"
                className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="text-xs text-rose-500 dark:text-rose-400 font-medium text-center animate-shake">
              {errorMessage}
            </div>
          )}
        </form>

        {cardForStart && (
          <RootCardButton
            onClick={() => setShowModalCard(cardForStart)}
            className="absolute bottom-3 left-3"
          />
        )}
      </div>

      <CardDetailModal
        card={showModalCard}
        isOpen={!!showModalCard}
        onClose={() => setShowModalCard(null)}
      />
    </div>
  )
}

import { RefObject } from 'react'
import { Check, X, SkipForward } from 'lucide-react'

export function letterIndices(word: string) {
  const res: number[] = []
  for (let i = 0; i < word.length; i++) if (word[i] !== ' ') res.push(i)
  return res
}

export function buildGuess(word: string, typed: string, hinted: number[]) {
  let k = 0
  let out = ''
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') { out += ' '; continue }
    if (hinted.includes(i)) out += word[i]
    else if (k < typed.length) out += typed[k++]
  }
  return out
}

export function LetterInput({
  word, typed, hinted, status, onChange, onEnter, inputRef, accent
}: {
  word: string
  typed: string
  hinted: number[]
  status: 'playing' | 'correct' | 'wrong' | 'skipped'
  onChange: (v: string) => void
  onEnter: () => void
  inputRef: RefObject<HTMLInputElement>
  accent: 'purple' | 'blue'
}) {
  const freeCount = letterIndices(word).filter(i => !hinted.includes(i)).length
  const reveal = status === 'correct' || status === 'skipped'
  
  const displayLength = word.length
  const chars: any[] = []
  let k = 0
  
  for (let i = 0; i < displayLength; i++) {
    if (i < word.length) {
      const ch = word[i]
      if (ch === ' ') { chars.push({ ch: ' ', kind: 'space', i }); continue }
      if (reveal) { chars.push({ ch, kind: 'revealed', i }); continue }
      if (hinted.includes(i)) { chars.push({ ch, kind: 'hint', i }); continue }
      if (k < typed.length) { chars.push({ ch: typed[k++], kind: 'typed', i }); continue }
      chars.push({ ch: '_', kind: 'empty', i, next: k === typed.length })
    } else {
      chars.push({ ch: '_', kind: 'empty', i, next: k === typed.length })
    }
  }

  const boxClass =
    status === 'correct' ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
    status === 'wrong' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
    status === 'skipped' ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
    `bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${accent === 'purple' ? 'focus-within:border-purple-500' : 'focus-within:border-blue-500'}`

  return (
    <div
      className={`relative w-full py-4 px-12 rounded-xl border-2 text-center text-2xl font-medium transition-colors cursor-text ${boxClass}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-wrap justify-center gap-y-1 font-mono tracking-wider">
        {chars.map(c => c.kind === 'space'
          ? <span key={c.i} className="w-3" />
          : (
              <span
              key={c.i}
              className={`
                mx-[2px]
                ${c.kind === 'hint' ? (accent === 'purple' ? 'text-purple-500 dark:text-purple-400' : 'text-blue-500 dark:text-blue-400') : ''}
                ${c.kind === 'empty' ? 'text-gray-400 dark:text-gray-500' : ''}
                ${c.kind === 'empty' && c.next && status === 'playing' ? 'animate-pulse font-bold' : ''}
              `}
            >{c.kind === 'empty' ? '_' : c.ch}</span>
          )
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={typed}
        maxLength={freeCount}
        disabled={status !== 'playing'}
        onChange={e => onChange(e.target.value.replace(/\s/g, ''))}
        onKeyDown={e => { if (e.key === 'Enter') onEnter() }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
      />
      {status === 'correct' && <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={24} />}
      {status === 'wrong' && <X className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" size={24} />}
      {status === 'skipped' && <SkipForward className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500" size={24} />}
    </div>
  )
}

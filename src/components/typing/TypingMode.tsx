import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, RotateCcw, ChevronRight, Timer, Gauge, Target, Volume2, VolumeX } from "lucide-react"
import { useTypingStore, Book, BookChapter } from "../../typingStore"
import { isCharMatch, resolveTelexRevert, ACCENT_TO_EXPANSION, TELEX_MAP } from "../../utils/bookUtils"
import { playKeycapsSound, playErrorSound, preloadSwitch, preloadError } from "../../utils/typingAudio"

interface TypingModeProps {
  book: Book
  chapter: BookChapter
  paragraphs: string[]
  hasNext: boolean
  onNextChapter: () => void
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function TypingMode({ book, chapter, paragraphs, hasNext, onNextChapter }: TypingModeProps) {
  const { progress, lastPosition, markParagraphComplete, resetChapterProgress, setLastPosition, settings, updateTypingSettings } = useTypingStore()
  const chapterProgress = progress[book.id]?.[chapter.id] || {}

  const firstIncomplete = useMemo(() => {
    const last = lastPosition[book.id]
    if (last && last.chapterId === chapter.id && last.pIdx < paragraphs.length && !chapterProgress[last.pIdx]) {
      return last.pIdx
    }
    const idx = paragraphs.findIndex((_, i) => !chapterProgress[i])
    return idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, chapter.id, paragraphs.length])

  const [activeIdx, setActiveIdx] = useState<number>(firstIncomplete)
  const [typed, setTyped] = useState<string[]>([])
  const [keystrokes, setKeystrokes] = useState(0)
  const [errors, setErrors] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const activeRef = useRef<HTMLDivElement | null>(null)
  const recentDeletedTelexRef = useRef<{ char: string; time: number } | null>(null)
  const ignoreNextImeBackspaceRef = useRef<number>(-10000)
  const lastKeyTimeRef = useRef<number>(Date.now())
  const isAfkPausedRef = useRef<boolean>(false)

  // Dynamically load Google Font if chosen
  useEffect(() => {
    if (!settings.fontFamily) return
    const fontName = settings.fontFamily.split(",")[0].replace(/['"]/g, "").trim()
    const id = `gfont-${fontName.replace(/\s+/g, "-").toLowerCase()}`
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`
    document.head.appendChild(link)
  }, [settings.fontFamily])

  // Preload sound assets
  useEffect(() => {
    preloadSwitch(settings.keycapsSound)
    preloadError(settings.errorSound)
  }, [settings.keycapsSound, settings.errorSound])

  // Reset when chapter changes
  useEffect(() => {
    setActiveIdx(firstIncomplete)
    resetParagraphState()
  }, [chapter.id, firstIncomplete])

  const resetParagraphState = () => {
    setTyped([])
    setKeystrokes(0)
    setErrors(0)
    setStartTime(null)
    recentDeletedTelexRef.current = null
    ignoreNextImeBackspaceRef.current = -10000
    lastKeyTimeRef.current = Date.now()
    isAfkPausedRef.current = false
  }

  // Live timer tick with Auto-pause AFK detection
  useEffect(() => {
    if (startTime === null) return

    const thresholdMs =
      settings.autoPause === "2s"
        ? 2000
        : settings.autoPause === "5s"
        ? 5000
        : settings.autoPause === "10s"
        ? 10000
        : Infinity

    const t = setInterval(() => {
      const current = Date.now()
      const idle = current - lastKeyTimeRef.current
      if (idle > thresholdMs) {
        isAfkPausedRef.current = true
      } else {
        if (isAfkPausedRef.current) {
          isAfkPausedRef.current = false
        }
        setNow(current)
      }
    }, 250)
    return () => clearInterval(t)
  }, [startTime, settings.autoPause])

  // Scroll active paragraph into view
  useEffect(() => {
    if (activeIdx >= 0) activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeIdx])

  const target = activeIdx >= 0 ? paragraphs[activeIdx] || "" : ""

  const advanceToNext = (fromIdx: number) => {
    const updated = { ...chapterProgress, [fromIdx]: true }
    let next = -1
    for (let i = fromIdx + 1; i < paragraphs.length; i++) {
      if (!updated[i]) { next = i; break }
    }
    if (next === -1) {
      for (let i = 0; i < fromIdx; i++) {
        if (!updated[i]) { next = i; break }
      }
    }
    setLastPosition(book.id, chapter.id, next === -1 ? paragraphs.length : next)
    setActiveIdx(next)
    resetParagraphState()
  }

  const completeParagraph = () => {
    if (activeIdx < 0) return
    const durationMs = startTime ? Date.now() - startTime : 0
    const minutes = Math.max(durationMs / 60000, 1 / 600)
    const correctChars = typed.reduce((acc, ch, i) => acc + (isCharMatch(target[i], ch) ? 1 : 0), 0)
    const wpm = Math.round((correctChars / 5) / minutes)
    const accuracy = keystrokes > 0 ? Math.max(0, Math.min(100, Math.round(((keystrokes - errors) / keystrokes) * 100))) : 100
    markParagraphComplete(book.id, chapter.id, activeIdx, {
      wpm,
      accuracy,
      durationMs,
      chars: target.length,
      completedAt: Date.now(),
    })
    advanceToNext(activeIdx)
  }

  // Keyboard handling
  useEffect(() => {
    if (activeIdx < 0) return

    const keyupHandler = (e: KeyboardEvent) => {
      if (!settings.soundEnabled || !settings.keycapsReleaseSound) return
      const k = e.key
      let type: "key" | "space" | "enter" | "backspace" = "key"
      if (k === " ") type = "space"
      else if (k === "Enter") type = "enter"
      else if (k === "Backspace") type = "backspace"

      playKeycapsSound({
        action: "release",
        type,
        key: k,
        switchId: settings.keycapsSound,
        volume: settings.keycapsVolume,
        pitchModifier: settings.keycapsPitch,
        special: settings.keycapsSpecial,
      })
    }

    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      if (document.querySelector('[data-modal-open="true"]')) return
      if (e.isComposing || e.key === "Process" || e.key === "Dead") return
      if (e.metaKey || (e.ctrlKey && e.key !== "Backspace")) return

      // Paragraph reset key
      if (
        (settings.paragraphReset === "tab" && e.key === "Tab") ||
        (settings.paragraphReset === "esc" && e.key === "Escape")
      ) {
        e.preventDefault()
        resetParagraphState()
        return
      }

      // Mark as read shortcut: Shift + Return at the beginning of the paragraph
      if (settings.markAsRead && e.shiftKey && e.key === "Enter") {
        if (typed.length === 0) {
          e.preventDefault()
          markParagraphComplete(book.id, chapter.id, activeIdx, {
            wpm: 0,
            accuracy: 100,
            durationMs: 500,
            chars: target.length,
            completedAt: Date.now(),
          })
          advanceToNext(activeIdx)
          return
        }
      }

      if (e.key === "Enter") {
        e.preventDefault()
        if (typed.length >= target.length) {
          if (settings.soundEnabled) {
            playKeycapsSound({
              type: "enter",
              switchId: settings.keycapsSound,
              volume: settings.keycapsVolume,
              pitchModifier: settings.keycapsPitch,
              special: settings.keycapsSpecial,
            })
          }
          completeParagraph()
        }
        return
      }

      if (e.key === "Backspace") {
        e.preventDefault()
        if (typed.length === 0) return

        if (Date.now() - ignoreNextImeBackspaceRef.current < 120) {
          return
        }

        lastKeyTimeRef.current = Date.now()

        if (settings.soundEnabled) {
          playKeycapsSound({
            type: "backspace",
            switchId: settings.keycapsSound,
            volume: settings.keycapsVolume,
            pitchModifier: settings.keycapsPitch,
            special: settings.keycapsSpecial,
          })
        }

        // Backspace behavior option
        const isDeleteWord =
          (settings.backspaceBehavior === "word" && !e.altKey) ||
          (settings.backspaceBehavior === "char" && (e.altKey || e.ctrlKey))

        if (isDeleteWord) {
          let i = typed.length
          while (i > 0 && /\s/.test(target[i - 1])) i--
          while (i > 0 && !/\s/.test(target[i - 1])) i--
          recentDeletedTelexRef.current = null
          setTyped(typed.slice(0, i))
        } else {
          const lastIdx = typed.length - 1
          const lastChar = typed[lastIdx]

          recentDeletedTelexRef.current = {
            char: lastChar,
            time: Date.now(),
          }

          setTyped(typed.slice(0, -1))
        }
        return
      }

      if (e.key.length !== 1) return
      e.preventDefault()

      const nowTime = Date.now()
      lastKeyTimeRef.current = nowTime

      // Case 1: An accented character was recently deleted by IME backspace,
      // and user/IME typed the modifier key to restore it
      if (recentDeletedTelexRef.current && nowTime - recentDeletedTelexRef.current.time < 350) {
        const del = recentDeletedTelexRef.current
        const targetRemaining = target.slice(typed.length)
        const revert = resolveTelexRevert(del.char, e.key, targetRemaining)
        if (revert && revert.length >= 2) {
          recentDeletedTelexRef.current = null
          if (startTime === null) {
            setStartTime(nowTime)
            setNow(nowTime)
          }
          setKeystrokes(k => k + 1)
          const delWasError = !isCharMatch(target[typed.length], del.char)
          let newErrors = 0
          for (let ri = 0; ri < revert.length; ri++) {
            const tChar = target[typed.length + ri]
            if (tChar !== undefined && !isCharMatch(tChar, revert[ri])) {
              newErrors++
            }
          }
          if (settings.soundEnabled) {
            if (newErrors > 0) playErrorSound(settings.errorSound, settings.errorVolume)
            else playKeycapsSound({ type: "key", key: e.key, switchId: settings.keycapsSound, volume: settings.keycapsVolume, pitchModifier: settings.keycapsPitch, special: settings.keycapsSpecial })
          }
          setErrors(er => Math.max(0, er - (delWasError ? 1 : 0) + newErrors))
          setTyped([...typed, ...revert])
          return
        }
      }

      // Case 2: Plain vowel was recently deleted by IME, and accented vowel was sent
      if (recentDeletedTelexRef.current && nowTime - recentDeletedTelexRef.current.time < 350) {
        const del = recentDeletedTelexRef.current
        const decomp = ACCENT_TO_EXPANSION[e.key]
        if (decomp && decomp.base.toLowerCase() === del.char.toLowerCase()) {
          const expectedNext = target.slice(typed.length, typed.length + decomp.expansion.length)
          if (expectedNext.toLowerCase() === decomp.expansion.join("").toLowerCase()) {
            recentDeletedTelexRef.current = null
            if (startTime === null) {
              setStartTime(nowTime)
              setNow(nowTime)
            }
            setKeystrokes(k => k + 1)
            let newErrors = 0
            for (let ri = 0; ri < decomp.expansion.length; ri++) {
              const tChar = target[typed.length + ri]
              if (tChar !== undefined && !isCharMatch(tChar, decomp.expansion[ri])) {
                newErrors++
              }
            }
            if (settings.soundEnabled) {
              if (newErrors > 0) playErrorSound(settings.errorSound, settings.errorVolume)
              else playKeycapsSound({ type: "key", key: e.key, switchId: settings.keycapsSound, volume: settings.keycapsVolume, pitchModifier: settings.keycapsPitch, special: settings.keycapsSpecial })
            }
            setErrors(er => er + newErrors)
            setTyped([...typed, ...decomp.expansion])
            return
          }
        }
      }

      // Case 3: Direct revert when accented char is still in buffer
      if (typed.length > 0) {
        const lastTypedChar = typed[typed.length - 1]
        const targetRemaining = target.slice(typed.length - 1)
        const revert = resolveTelexRevert(lastTypedChar, e.key, targetRemaining)
        if (revert && revert.length >= 2) {
          if (startTime === null) {
            setStartTime(nowTime)
            setNow(nowTime)
          }
          setKeystrokes(k => k + 1)
          const wasError = !isCharMatch(target[typed.length - 1], lastTypedChar)
          const newTyped = [...typed.slice(0, -1), ...revert]

          let newErrors = 0
          for (let ri = 0; ri < revert.length; ri++) {
            const tChar = target[typed.length - 1 + ri]
            if (tChar !== undefined && !isCharMatch(tChar, revert[ri])) {
              newErrors++
            }
          }

          ignoreNextImeBackspaceRef.current = nowTime
          if (settings.soundEnabled) {
            if (newErrors > 0) playErrorSound(settings.errorSound, settings.errorVolume)
            else playKeycapsSound({ type: "key", key: e.key, switchId: settings.keycapsSound, volume: settings.keycapsVolume, pitchModifier: settings.keycapsPitch, special: settings.keycapsSpecial })
          }
          setErrors(er => Math.max(0, er - (wasError ? 1 : 0) + newErrors))
          setTyped(newTyped)
          return
        }
      }

      // Case 4: Target-aware recovery if IME swallowed the vowel before modifier
      if (typed.length > 0 && ["s", "r", "f", "x", "j", "w"].includes(e.key.toLowerCase())) {
        const remainingTarget = target.slice(typed.length)
        if (remainingTarget.length >= 2 && remainingTarget[1].toLowerCase() === e.key.toLowerCase()) {
          const potentialVowel = remainingTarget[0]
          if (/[aeiouy]/i.test(potentialVowel)) {
            const mapForK = TELEX_MAP[e.key.toLowerCase()]
            if (mapForK && Object.values(mapForK).some(exp => exp[0].toLowerCase() === potentialVowel.toLowerCase())) {
              if (startTime === null) {
                setStartTime(nowTime)
                setNow(nowTime)
              }
              setKeystrokes(k => k + 1)
              const inserted = [potentialVowel, e.key]
              let newErrors = 0
              for (let ri = 0; ri < inserted.length; ri++) {
                const tChar = target[typed.length + ri]
                if (tChar !== undefined && !isCharMatch(tChar, inserted[ri])) {
                  newErrors++
                }
              }
              if (settings.soundEnabled) {
                if (newErrors > 0) playErrorSound(settings.errorSound, settings.errorVolume)
                else playKeycapsSound({ type: "key", key: e.key, switchId: settings.keycapsSound, volume: settings.keycapsVolume, pitchModifier: settings.keycapsPitch, special: settings.keycapsSpecial })
              }
              setErrors(er => er + newErrors)
              setTyped([...typed, ...inserted])
              return
            }
          }
        }
      }

      if (typed.length >= target.length) return
      if (startTime === null) {
        setStartTime(nowTime)
        setNow(nowTime)
      }
      const expected = target[typed.length]
      const isMatch = isCharMatch(expected, e.key)
      setKeystrokes(k => k + 1)
      if (!isMatch) setErrors(er => er + 1)

      if (settings.soundEnabled) {
        if (isMatch) {
          playKeycapsSound({
            type: e.key === " " ? "space" : "key",
            key: e.key,
            switchId: settings.keycapsSound,
            volume: settings.keycapsVolume,
            pitchModifier: settings.keycapsPitch,
            special: settings.keycapsSpecial,
          })
        } else {
          playErrorSound(settings.errorSound, settings.errorVolume)
        }
      }
      setTyped([...typed, e.key])
    }

    window.addEventListener("keydown", handler)
    window.addEventListener("keyup", keyupHandler)
    return () => {
      window.removeEventListener("keydown", handler)
      window.removeEventListener("keyup", keyupHandler)
    }
  })

  // Chapter stats
  const doneEntries = Object.values(chapterProgress)
  const doneCount = paragraphs.filter((_, i) => chapterProgress[i]).length
  const avgWpm = doneEntries.length ? Math.round(doneEntries.reduce((a, p) => a + p.wpm, 0) / doneEntries.length) : 0
  const avgAcc = doneEntries.length ? Math.round(doneEntries.reduce((a, p) => a + p.accuracy, 0) / doneEntries.length) : 0
  const totalMs = doneEntries.reduce((a, p) => a + p.durationMs, 0)
  const liveMs = startTime ? now - startTime : 0
  const liveCorrect = typed.reduce((acc, ch, i) => acc + (isCharMatch(target[i], ch) ? 1 : 0), 0)
  const liveWpm = liveMs > 1500 ? Math.round((liveCorrect / 5) / (liveMs / 60000)) : 0
  const liveAcc = keystrokes > 0 ? Math.max(0, Math.min(100, Math.round(((keystrokes - errors) / keystrokes) * 100))) : 100
  const isChapterDone = paragraphs.length > 0 && doneCount === paragraphs.length

  const renderActive = () => {
    // Split target into tokens where each word keeps its trailing whitespace:
    // e.g. "Hi! Start typing" -> ["Hi! ", "Start ", "typing"]
    const tokens: { text: string; start: number }[] = []
    const re = /\S+\s*|\s+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(target)) !== null) {
      tokens.push({ text: m[0], start: m.index })
    }

    const renderChar = (ch: string, i: number) => {
      const isTyped = i < typed.length
      const isCurrent = i === typed.length
      const ok = isTyped && isCharMatch(ch, typed[i])

      let displayChar = ch
      if (isTyped && !ok) {
        if (settings.typosIndication === "replace" || settings.typosIndication === "both") {
          displayChar = typed[i] || ch
        } else {
          // highlight: keeps expected char
          displayChar = ch
        }
      }

      // Dynamic custom colors
      let style: React.CSSProperties = {}
      if (isTyped) {
        if (ok) {
          style = { color: settings.correctColor }
        } else {
          style = { color: settings.errorColor }
        }
      } else {
        style = { color: settings.untypedColor, opacity: settings.untypedOpacity }
      }

      // Caret element
      let caretEl: React.ReactNode = null
      if (isCurrent) {
        const animClass =
          settings.caretAnimation === "linear"
            ? "animate-pulse"
            : settings.caretAnimation === "swing"
            ? "animate-bounce"
            : "animate-pulse"

        if (settings.caretStyle === "floor") {
          caretEl = <span className={`absolute left-0 right-0 bottom-0 h-[2.5px] bg-purple-600 dark:bg-purple-400 ${animClass} rounded`} />
        } else if (settings.caretStyle === "block") {
          caretEl = <span className={`absolute inset-0 bg-purple-600/30 dark:bg-purple-400/40 ${animClass} rounded`} />
        } else {
          // line
          caretEl = <span className={`absolute -left-[1px] top-[0.15em] bottom-[0.1em] w-[2px] bg-purple-600 dark:bg-purple-400 ${animClass} rounded`} />
        }
      }

      const isSpaceMistake = isTyped && !ok && /\s/.test(displayChar)

      return (
        <span key={i} className="relative inline-block whitespace-pre" style={style}>
          {caretEl}
          {isSpaceMistake ? (
            <span className="inline-block px-0.5 text-xs font-mono select-none" style={{ color: settings.errorColor }}>␣</span>
          ) : (
            displayChar
          )}
        </span>
      )
    }

    return (
      <>
        {tokens.map(tok => {
          const wordPart = tok.text.replace(/\s+$/, '')
          const spacePart = tok.text.slice(wordPart.length)
          const wordEnd = tok.start + wordPart.length

          let wordHasError = false
          if (settings.markIncorrectWords && typed.length > tok.start && wordPart.length > 0) {
            for (let wi = tok.start; wi < Math.min(typed.length, wordEnd); wi++) {
              if (!isCharMatch(target[wi], typed[wi])) {
                wordHasError = true
                break
              }
            }
          }

          const wordClass = wordHasError
            ? "underline decoration-rose-500 decoration-wavy decoration-2"
            : ""

          return (
            <span key={tok.start} className="inline-block whitespace-nowrap">
              {wordPart.length > 0 && (
                <span className={wordClass}>
                  {wordPart.split("").map((ch, k) => renderChar(ch, tok.start + k))}
                </span>
              )}
              {spacePart.split("").map((ch, k) => renderChar(ch, tok.start + wordPart.length + k))}
            </span>
          )
        })}

        {/* Caret at very end of paragraph when fully typed */}
        {typed.length === target.length && (
          <span className="relative inline-block w-0">
            {settings.caretStyle === "floor" ? (
              <span className="absolute -left-2 right-0 bottom-0 w-3 h-[2.5px] bg-purple-600 dark:bg-purple-400 animate-pulse rounded" />
            ) : settings.caretStyle === "block" ? (
              <span className="absolute -left-2 top-[0.15em] bottom-[0.1em] w-3 bg-purple-600/30 dark:bg-purple-400/40 animate-pulse rounded" />
            ) : (
              <span className="absolute -left-[1px] top-[0.15em] bottom-[0.1em] w-[2px] bg-purple-600 dark:bg-purple-400 animate-pulse rounded" />
            )}
          </span>
        )}

        {/* New Line Indication */}
        {settings.newLineIndication && (
          <span className="select-none text-purple-400 dark:text-purple-500 font-mono text-sm ml-1" title="New line">
            ⏎
          </span>
        )}
      </>
    )
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
  }

  return (
    <div>
      {/* Sticky Stats HUD */}
      <div className="sticky top-2 z-20 mb-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        
        {/* Left Stats Cluster with Fixed Slots */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 overflow-x-auto">
          {/* WPM Slot */}
          <div className="w-[78px] shrink-0 flex items-center gap-1.5" title="Typing speed (words per minute)">
            <Gauge size={14} className="text-purple-500 shrink-0" />
            <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums font-mono whitespace-nowrap">
              {liveWpm} <span className="text-[11px] text-gray-400 font-sans">WPM</span>
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Accuracy Slot */}
          <div className="w-[66px] shrink-0 flex items-center gap-1.5" title="Accuracy">
            <Target size={14} className="text-emerald-500 shrink-0" />
            <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums font-mono whitespace-nowrap">
              {liveAcc}%
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Timer Slot */}
          <div className="w-[70px] shrink-0 flex items-center gap-1.5" title="Elapsed typing time">
            <Timer size={14} className="text-blue-500 shrink-0" />
            <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums font-mono whitespace-nowrap">
              {formatDuration(liveMs)}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Paragraph Progress Slot */}
          <div className="w-[124px] shrink-0 flex items-center gap-1 text-gray-500 font-medium whitespace-nowrap">
            <span className="tabular-nums font-mono font-semibold text-gray-800 dark:text-gray-200">
              {doneCount}/{paragraphs.length}
            </span>
            <span className="text-xs">paragraphs</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resetParagraphState}
            title="Restart current paragraph"
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            onClick={() => updateTypingSettings({ soundEnabled: !settings.soundEnabled })}
            title={settings.soundEnabled ? "Mute typing sound" : "Enable typing sound"}
            className={`shrink-0 p-1.5 rounded-lg border transition-colors cursor-pointer ${
              settings.soundEnabled
                ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100"
                : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-600"
            }`}
          >
            {settings.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          <span className="hidden lg:inline text-gray-400 font-normal shrink-0 text-[11px]">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-mono">Enter</kbd> finish ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-mono">
              {settings.paragraphReset === "esc" ? "Esc" : settings.paragraphReset === "off" ? "--" : "Tab"}
            </kbd> restart
          </span>
        </div>
      </div>

      {/* Paragraphs */}
      <div
        style={containerStyle}
        className={`space-y-6 ${settings.keepInPosition ? "pb-[45vh]" : ""}`}
      >
        {paragraphs.map((p, i) => {
          const done = chapterProgress[i]
          const isActive = i === activeIdx
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              onClick={() => {
                // Prevent clicking on already-completed paragraphs
                if (!isActive && !done) {
                  setActiveIdx(i)
                  setLastPosition(book.id, chapter.id, i)
                  resetParagraphState()
                }
              }}
              className={`relative rounded-2xl px-4 py-3 transition-all ${
                isActive
                  ? "bg-white dark:bg-gray-800 shadow-md ring-1 ring-purple-200 dark:ring-purple-800"
                  : done
                  ? "text-gray-700 dark:text-gray-300 cursor-default opacity-85"
                  : "text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
              }`}
            >
              {isActive ? renderActive() : p}

              {/* Completed stats badge (can be hidden in settings) */}
              {done && !isActive && !settings.hideParagraphStats && (
                <span className="flex items-center gap-1.5 mt-1 text-[11px] font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} /> {done.wpm} WPM · {done.accuracy}% · {formatDuration(done.durationMs)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {isChapterDone && activeIdx < 0 && (
        <div className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/50 rounded-3xl p-6 text-center font-sans">
          <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 mb-1">Chapter complete!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{chapter.title}</p>
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3">
              <div className="text-[11px] text-gray-400 font-semibold">Avg WPM</div>
              <div className="text-2xl font-black text-purple-600">{avgWpm}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3">
              <div className="text-[11px] text-gray-400 font-semibold">Accuracy</div>
              <div className="text-2xl font-black text-emerald-600">{avgAcc}%</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3">
              <div className="text-[11px] text-gray-400 font-semibold">Time</div>
              <div className="text-2xl font-black text-blue-600">{formatDuration(totalMs)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetChapterProgress(book.id, chapter.id)
                setActiveIdx(0)
                setLastPosition(book.id, chapter.id, 0)
                resetParagraphState()
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
            >
              <RotateCcw size={15} /> Retype Chapter
            </button>
            {hasNext && (
              <button
                type="button"
                onClick={onNextChapter}
                className="flex items-center gap-1 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm cursor-pointer"
              >
                Next Chapter <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

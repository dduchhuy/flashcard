import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, RotateCcw, Timer, Gauge, Target, Volume2, VolumeX, Pin, PinOff } from "lucide-react"
import { useTypingStore, Book, BookChapter } from "../../typingStore"
import { isCharMatch, resolveTelexRevert, ACCENT_TO_EXPANSION, TELEX_MAP } from "../../utils/bookUtils"
import { playKeycapsSound, playErrorSound, preloadSwitch, preloadError } from "../../utils/typingAudio"
import { loadFont, getFontVariationSettings, getEffectiveFontFamily } from "../../utils/fontLoader"

interface TypingModeProps {
  book: Book
  chapter: BookChapter
  paragraphs: string[]
  hasNext: boolean
  onNextChapter: () => void
  isTopBarVisible?: boolean
  /** Set true when rendered inside Zen Mode overlay */
  zenMode?: boolean
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function TypingMode({ book, chapter, paragraphs, hasNext, onNextChapter, isTopBarVisible = true, zenMode = false }: TypingModeProps) {
  const { progress, lastPosition, markParagraphComplete, resetChapterProgress, setLastPosition, settings, updateTypingSettings } = useTypingStore()
  const chapterProgress = progress[book.id]?.[chapter.id] || {}
  const isPinned = settings.hudPinned ?? true

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
  const [liveMs, setLiveMs] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const activeRef = useRef<HTMLDivElement | null>(null)
  const mobileInputRef = useRef<HTMLInputElement | null>(null)
  const recentDeletedTelexRef = useRef<{ char: string; time: number } | null>(null)
  const ignoreNextImeBackspaceRef = useRef<number>(-10000)
  const lastKeyTimeRef = useRef<number>(Date.now())
  const accumulatedMsRef = useRef<number>(0)
  const activeSegmentStartRef = useRef<number | null>(null)
  const isAfkPausedRef = useRef<boolean>(false)

  // Dynamically load font (Google Fonts, CDN, system)
  useEffect(() => {
    if (!settings.fontFamily) return
    loadFont(settings.fontFamily)
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
    setLiveMs(0)
    setIsPaused(false)
    accumulatedMsRef.current = 0
    activeSegmentStartRef.current = null
    isAfkPausedRef.current = false
    recentDeletedTelexRef.current = null
    ignoreNextImeBackspaceRef.current = -10000
    lastKeyTimeRef.current = Date.now()
  }

  const ensureTimerActive = (nowTime: number) => {
    lastKeyTimeRef.current = nowTime
    if (startTime === null) {
      setStartTime(nowTime)
      accumulatedMsRef.current = 0
      activeSegmentStartRef.current = nowTime
      isAfkPausedRef.current = false
      setIsPaused(false)
    } else if (isAfkPausedRef.current) {
      isAfkPausedRef.current = false
      setIsPaused(false)
      activeSegmentStartRef.current = nowTime
    }
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

      if (idle >= thresholdMs) {
        if (!isAfkPausedRef.current) {
          isAfkPausedRef.current = true
          setIsPaused(true)
          if (activeSegmentStartRef.current !== null) {
            accumulatedMsRef.current += Math.max(0, lastKeyTimeRef.current - activeSegmentStartRef.current)
            activeSegmentStartRef.current = null
            setLiveMs(accumulatedMsRef.current)
          }
        }
      } else {
        if (!isAfkPausedRef.current && activeSegmentStartRef.current !== null) {
          const activeCurrent = accumulatedMsRef.current + Math.max(0, current - activeSegmentStartRef.current)
          setLiveMs(activeCurrent)
        }
      }
    }, 100)
    return () => clearInterval(t)
  }, [startTime, settings.autoPause])

  // Scroll active paragraph or line into view
  useEffect(() => {
    if (activeIdx >= 0 && activeRef.current) {
      if (settings.typewriterMode) {
        const activeCaret = activeRef.current.querySelector('[data-caret="true"]') || activeRef.current
        activeCaret.scrollIntoView({ behavior: "smooth", block: "center" })
      } else {
        activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [activeIdx, typed.length, settings.typewriterMode])

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
    let durationMs = accumulatedMsRef.current
    if (activeSegmentStartRef.current !== null && !isAfkPausedRef.current) {
      durationMs += Math.max(0, Date.now() - activeSegmentStartRef.current)
    }
    durationMs = Math.max(durationMs, 500)
    const minutes = Math.max(durationMs / 60000, 1 / 600)
    const correctChars = typed.reduce((acc, ch, i) => acc + (isCharMatch(target[i], ch) ? 1 : 0), 0)
    const wpm = Math.round((correctChars / 5) / minutes)
    const accuracy = keystrokes > 0 ? Math.max(0, Math.min(100, Math.round(((keystrokes - errors) / keystrokes) * 100))) : 100

    // Capture indices of mistaken characters
    const mistakeIndices: number[] = []
    for (let k = 0; k < Math.min(typed.length, target.length); k++) {
      if (!isCharMatch(target[k], typed[k])) {
        mistakeIndices.push(k)
      }
    }

    markParagraphComplete(book.id, chapter.id, activeIdx, {
      wpm,
      accuracy,
      durationMs,
      chars: target.length,
      completedAt: Date.now(),
      mistakeIndices,
    })
    advanceToNext(activeIdx)
  }

  // Keyboard handling
  useEffect(() => {
    if (activeIdx < 0) {
      const finishHandler = (e: KeyboardEvent) => {
        if (e.key === "Enter" && hasNext) {
          e.preventDefault()
          onNextChapter()
        }
      }
      window.addEventListener("keydown", finishHandler)
      return () => window.removeEventListener("keydown", finishHandler)
    }

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
      if (el && el !== mobileInputRef.current && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
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

        ensureTimerActive(Date.now())

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
      ensureTimerActive(nowTime)

      // Case 1: An accented character was recently deleted by IME backspace,
      // and user/IME typed the modifier key to restore it
      if (recentDeletedTelexRef.current && nowTime - recentDeletedTelexRef.current.time < 350) {
        const del = recentDeletedTelexRef.current
        const targetRemaining = target.slice(typed.length)
        const revert = resolveTelexRevert(del.char, e.key, targetRemaining)
        if (revert && revert.length >= 2) {
          recentDeletedTelexRef.current = null
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
        const easing =
          settings.caretAnimation === "linear" ? "linear" :
          settings.caretAnimation === "swing" ? "cubic-bezier(0.25, 1, 0.5, 1)" :
          settings.caretAnimation === "ease-in" ? "ease-in" :
          settings.caretAnimation === "ease-out" ? "ease-out" :
          "ease"

        if (settings.caretStyle === "floor") {
          caretEl = (
            <span
              data-caret="true"
              className="absolute left-0 right-0 bottom-[2px] h-[3px] bg-purple-600 dark:bg-purple-400 rounded-full z-10 pointer-events-none caret-blink"
              style={{
                transition: `all 80ms ${easing}`,
              }}
            />
          )
        } else if (settings.caretStyle === "block") {
          caretEl = (
            <span
              data-caret="true"
              className="absolute inset-x-0 top-[0.12em] bottom-[0.12em] bg-purple-600/35 dark:bg-purple-400/40 rounded-[2px] z-10 pointer-events-none caret-blink"
              style={{
                transition: `all 80ms ${easing}`,
              }}
            />
          )
        } else {
          // line
          caretEl = (
            <span
              data-caret="true"
              className="absolute -left-[1.5px] top-[0.12em] bottom-[0.12em] w-[2.5px] bg-purple-600 dark:bg-purple-400 rounded-full z-10 pointer-events-none caret-blink"
              style={{
                transition: `all 80ms ${easing}`,
              }}
            />
          )
        }
      }

      const isSpaceMistake = isTyped && !ok && /\s/.test(displayChar)

      return (
        <span key={i} className="relative inline-block whitespace-pre" data-char-idx={i}>
          {caretEl}
          <span style={style}>
            {isSpaceMistake ? (
              <span className="inline-block px-0.5 text-xs font-mono select-none" style={{ color: settings.errorColor }}>␣</span>
            ) : (
              displayChar
            )}
          </span>
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
              <span data-caret="true" className="absolute -left-2 right-0 bottom-[2px] w-3 h-[3px] bg-purple-600 dark:bg-purple-400 caret-blink rounded-full" />
            ) : settings.caretStyle === "block" ? (
              <span data-caret="true" className="absolute -left-2 top-[0.12em] bottom-[0.12em] w-3 bg-purple-600/35 dark:bg-purple-400/40 caret-blink rounded-[2px]" />
            ) : (
              <span data-caret="true" className="absolute -left-[1.5px] top-[0.12em] bottom-[0.12em] w-[2.5px] bg-purple-600 dark:bg-purple-400 caret-blink rounded-full" />
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

  const renderCompletedParagraph = (text: string, prog?: { mistakeIndices?: number[] }) => {
    const mistakeSet = new Set(prog?.mistakeIndices || [])
    if (mistakeSet.size === 0) {
      return <span style={{ color: settings.correctColor }}>{text}</span>
    }
    return (
      <span>
        {text.split("").map((char, idx) => {
          const isError = mistakeSet.has(idx)
          return (
            <span
              key={idx}
              style={{
                color: isError ? settings.errorColor : settings.correctColor,
              }}
            >
              {char}
            </span>
          )
        })}
      </span>
    )
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: getEffectiveFontFamily(settings.fontFamily),
    fontSize: `${settings.fontSize}px`,
    fontWeight: settings.fontWeight || 400,
    lineHeight: settings.lineHeight,
    fontVariationSettings: getFontVariationSettings(settings.fontFamily),
  }

  return (
    <div>
      {/* Hidden input to trigger virtual keyboard on mobile (Android / iOS) */}
      <input
        ref={mobileInputRef}
        type="text"
        aria-label="Touch typing input"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="fixed opacity-0 pointer-events-none -top-40 -left-40 w-1 h-1 z-0"
        value=""
        onChange={(e) => {
          const val = e.target.value
          if (val) {
            for (const char of val) {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }))
            }
            e.target.value = ""
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Enter") {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, bubbles: true }))
          }
        }}
      />

      {/* Stats HUD (Sticky or relative based on isPinned, higher up when in zenMode) */}
      <div
        className={`${
          isPinned
            ? zenMode
              ? "sticky top-4 sm:top-5 z-20"
              : `sticky ${isTopBarVisible ? "top-[132px]" : "top-[72px]"} z-20`
            : "relative z-10"
        } mb-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden text-xs sm:text-sm transition-all duration-300`}
      >
        <div className="px-4 py-2 flex items-center justify-between gap-2">
          {/* 4 evenly spaced stats */}
          <div className="flex-1 grid grid-cols-4 items-center text-center divide-x divide-gray-200 dark:divide-gray-700">
            {/* WPM Slot */}
            <div className="flex items-center justify-center gap-1.5 px-2" title="Typing speed (words per minute)">
              <Gauge size={14} className="text-purple-500 shrink-0" />
              <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums font-mono whitespace-nowrap">
                {liveWpm} <span className="text-[11px] text-gray-400 font-sans">WPM</span>
              </span>
            </div>

            {/* Accuracy Slot */}
            <div className="flex items-center justify-center gap-1.5 px-2" title="Accuracy">
              <Target size={14} className="text-emerald-500 shrink-0" />
              <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums font-mono whitespace-nowrap">
                {liveAcc}%
              </span>
            </div>

            {/* Timer Slot */}
            <div
              className="flex items-center justify-center gap-1.5 px-2"
              title={isPaused ? "Paused (type to resume)" : "Elapsed typing time"}
            >
              <Timer
                size={14}
                className={`shrink-0 transition-colors ${
                  isPaused ? "text-amber-500 animate-pulse" : "text-blue-500"
                }`}
              />
              <span
                className={`font-semibold tabular-nums font-mono whitespace-nowrap transition-colors ${
                  isPaused
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {formatDuration(liveMs)}
              </span>
            </div>

            {/* Paragraph Progress Slot */}
            <div className="flex items-center justify-center gap-1.5 px-2 text-gray-500 font-medium whitespace-nowrap">
              <span className="tabular-nums font-mono font-semibold text-gray-800 dark:text-gray-200">
                {doneCount}/{paragraphs.length}
              </span>
              <span className="text-xs">paragraphs</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Pin / Unpin HUD Button */}
            <button
              type="button"
              onClick={() => updateTypingSettings({ hudPinned: !isPinned })}
              title={isPinned ? "Bỏ ghim (cuộn theo nội dung, không nổi lên)" : "Ghim thanh thông số nổi trên cùng"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isPinned
                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {isPinned ? <Pin size={13} className="fill-purple-600 dark:fill-purple-300" /> : <PinOff size={13} />}
            </button>

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={() => updateTypingSettings({ soundEnabled: !settings.soundEnabled })}
              title={settings.soundEnabled ? "Mute typing sound" : "Enable typing sound"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                settings.soundEnabled
                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-600"
              }`}
            >
              {settings.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
          </div>
        </div>

        {/* Progress Bar — updates per keystroke using current paragraph fraction */}
        <div className="h-1 bg-gray-100 dark:bg-gray-700 w-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150"
            style={{
              width: `${(() => {
                if (paragraphs.length === 0) return 0
                const currentParaFraction =
                  activeIdx >= 0 && target.length > 0
                    ? Math.min(typed.length / target.length, 1)
                    : 0
                return ((doneCount + currentParaFraction) / paragraphs.length) * 100
              })()}%`,
            }}
          />
        </div>
      </div>

      {/* Paragraphs */}
      <div
        style={containerStyle}
        onClick={() => mobileInputRef.current?.focus()}
        className={`space-y-6 ${settings.typewriterMode || settings.keepInPosition ? "pb-[65vh] pt-[10vh]" : ""}`}
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
              className={`relative py-1 transition-colors ${
                isActive
                  ? "cursor-text"
                  : done
                  ? "cursor-default"
                  : "cursor-pointer"
              }`}
              style={
                !isActive && !done
                  ? { color: settings.untypedColor, opacity: settings.untypedOpacity }
                  : undefined
              }
            >
              {isActive
                ? renderActive()
                : done
                ? renderCompletedParagraph(p, done)
                : p}

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
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm cursor-pointer"
              >
                Next Chapter <kbd className="px-1.5 py-0.5 rounded bg-purple-700 text-[11px] font-mono">Enter ↵</kbd>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

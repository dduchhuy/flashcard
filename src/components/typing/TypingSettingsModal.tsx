import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Sliders, Volume2, Database, RotateCcw, Play, Upload, Download, FileText, BookOpen, Check, AlertCircle } from "lucide-react"
import { useTypingStore, Book } from "../../typingStore"
import { useFlashcardStore } from "../../store"
import { KEYCAPS_SWITCHES, ERROR_SOUNDS, playKeycapsSound, playErrorSound } from "../../utils/typingAudio"
import {
  exportBookToJson,
  exportBookToTxt,
  exportBookToEpub,
  exportBookSaveFile,
  parseBookSaveFile,
  parseTxtToBook,
  parseEpubToBook,
  validateBookJson
} from "../../utils/bookUtils"
import { loadAllFromGitData, exportAllToGitData } from "../../utils/gitDataService"

import { FONT_OPTIONS, loadFont, getFontVariationSettings } from "../../utils/fontLoader"

interface TypingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentBook?: Book | null
}

export function TypingSettingsModal({ isOpen, onClose, currentBook }: TypingSettingsModalProps) {
  const {
    settings,
    updateTypingSettings,
    resetTypingSettings,
    importBook,
    progress,
    lastPosition,
    sentenceLinks,
  } = useTypingStore()
  const { flashcards } = useFlashcardStore()

  const [activeTab, setActiveTab] = useState<"mode" | "sound" | "data">("mode")
  const [dataMessage, setDataMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isGitSyncing, setIsGitSyncing] = useState(false)
  const bookImportInputRef = useRef<HTMLInputElement>(null)
  const saveImportInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && settings.fontFamily) {
      loadFont(settings.fontFamily)
    }
  }, [isOpen, settings.fontFamily])

  // Close modal when pressing Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [isOpen, onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return
    const orig = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = orig
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSyncFromGit = async () => {
    setIsGitSyncing(true)
    setDataMessage(null)
    try {
      const res = await loadAllFromGitData()
      setDataMessage({
        type: "success",
        text: `Synced from Git: ${res.booksCount} books, ${res.vocabCount} words, ${res.sentenceCount} sentences, ${res.savesCount} progress saves.`
      })
    } catch (e) {
      setDataMessage({ type: "error", text: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsGitSyncing(false)
    }
  }

  const handleExportToGit = async () => {
    setIsGitSyncing(true)
    setDataMessage(null)
    try {
      const res = await exportAllToGitData()
      const msg = res.isLocalDisk
        ? `Wrote files directly to Flashcard/data: ${res.written.vocab} words, ${res.written.sentence} sentences, ${res.written.books} books, ${res.written.saves} saves.`
        : `Exported and downloaded zip archive with all books, vocab, sentences, and saves.`
      setDataMessage({ type: "success", text: msg })
    } catch (e) {
      setDataMessage({ type: "error", text: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsGitSyncing(false)
    }
  }

  const handleImportBookFile = async (file: File) => {
    setDataMessage(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext === "json") {
        const text = await file.text()
        const json = JSON.parse(text)
        const validated = validateBookJson(json)
        importBook(validated)
        setDataMessage({ type: "success", text: `Imported book "${validated.title}" successfully.` })
      } else if (ext === "txt") {
        const text = await file.text()
        const parsed = parseTxtToBook(file.name, text)
        importBook(parsed)
        setDataMessage({ type: "success", text: `Imported TXT "${parsed.title}" (${parsed.chapters.length} chapters).` })
      } else if (ext === "epub") {
        const parsed = await parseEpubToBook(file)
        importBook(parsed)
        setDataMessage({ type: "success", text: `Imported EPUB "${parsed.title}" (${parsed.chapters.length} chapters).` })
      } else {
        throw new Error("Unsupported format. Please select a .json, .txt, or .epub file.")
      }
    } catch (e) {
      setDataMessage({ type: "error", text: e instanceof Error ? e.message : String(e) })
    }
  }

  const handleImportSaveFile = async (file: File) => {
    setDataMessage(null)
    try {
      const text = await file.text()
      const payload = parseBookSaveFile(text)
      
      // Update progress & position in store
      useTypingStore.setState(state => {
        const progress = { ...state.progress, [payload.bookId]: payload.progress }
        const lastPosition = { ...state.lastPosition }
        if (payload.lastPosition) {
          lastPosition[payload.bookId] = payload.lastPosition
        }
        const sentenceLinks = { ...state.sentenceLinks, ...payload.sentenceLinks }
        return { progress, lastPosition, sentenceLinks }
      })

      // Merge linked flashcards if present
      if (payload.linkedCards && payload.linkedCards.length > 0) {
        useFlashcardStore.setState(state => {
          const existingMap = new Map(state.flashcards.map(c => [c.id, c]))
          payload.linkedCards.forEach(c => {
            if (!existingMap.has(c.id)) {
              existingMap.set(c.id, c)
            }
          })
          return { flashcards: Array.from(existingMap.values()) }
        })
      }

      setDataMessage({
        type: "success",
        text: `Save file for "${payload.bookTitle}" restored successfully (${Object.keys(payload.progress).length} chapters updated).`,
      })
    } catch (e) {
      setDataMessage({ type: "error", text: e instanceof Error ? e.message : String(e) })
    }
  }

  return createPortal(
    <div
      data-modal-open="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95"
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Typing Settings</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure appearance, switch sounds, and data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-4 sm:px-6 shrink-0 bg-gray-50/60 dark:bg-gray-900/30">
          <button
            onClick={() => setActiveTab("mode")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "mode"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <FileText size={16} /> Typing Mode
          </button>
          <button
            onClick={() => setActiveTab("sound")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "sound"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <Volume2 size={16} /> Sound
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "data"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <Database size={16} /> Data
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* TAB 1: TYPING MODE */}
          {activeTab === "mode" && (
            <div className="space-y-6">
              
              {/* Colors */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Text Colors & Opacity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Untyped Color */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Untyped Text</span>
                      <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer shadow-xs">
                        <div className="absolute inset-0" style={{ backgroundColor: settings.untypedColor }} />
                        <input
                          type="color"
                          value={settings.untypedColor}
                          onChange={e => updateTypingSettings({ untypedColor: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span>Opacity</span>
                      <span>{Math.round(settings.untypedOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.05"
                      value={settings.untypedOpacity}
                      onChange={e => updateTypingSettings({ untypedOpacity: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Correct Color */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Correct Text</span>
                      <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer shadow-xs">
                        <div className="absolute inset-0" style={{ backgroundColor: settings.correctColor }} />
                        <input
                          type="color"
                          value={settings.correctColor}
                          onChange={e => updateTypingSettings({ correctColor: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Color of matched characters</p>
                  </div>

                  {/* Error Color */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Error Text</span>
                      <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer shadow-xs">
                        <div className="absolute inset-0" style={{ backgroundColor: settings.errorColor }} />
                        <input
                          type="color"
                          value={settings.errorColor}
                          onChange={e => updateTypingSettings({ errorColor: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Color of mismatched characters</p>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Typography</h3>
                <div className="space-y-4">
                  
                  {/* Font Family */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Font Family
                    </label>
                    <select
                      value={settings.fontFamily}
                      onChange={e => updateTypingSettings({ fontFamily: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    >
                      {FONT_OPTIONS.map(grp => (
                        <optgroup key={grp.group} label={grp.group}>
                          {grp.fonts.map(f => (
                            <option key={f.name} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Font Size & Line Height */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                      <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <span>Font Size</span>
                        <span className="font-mono">{settings.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="14"
                        max="32"
                        step="1"
                        value={settings.fontSize}
                        onChange={e => updateTypingSettings({ fontSize: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                      <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <span>Line Height</span>
                        <span className="font-mono">{settings.lineHeight.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="1.2"
                        max="2.6"
                        step="0.1"
                        value={settings.lineHeight}
                        onChange={e => updateTypingSettings({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Font Weight */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span>Font Weight</span>
                      <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                        {settings.fontWeight === 300
                          ? "300 · Light"
                          : settings.fontWeight === 400
                          ? "400 · Regular"
                          : settings.fontWeight === 500
                          ? "500 · Medium"
                          : settings.fontWeight === 600
                          ? "600 · Semi-Bold"
                          : settings.fontWeight === 700
                          ? "700 · Bold"
                          : settings.fontWeight === 800
                          ? "800 · Extra Bold"
                          : `${settings.fontWeight || 400}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[
                        { label: "Light", weight: 300 },
                        { label: "Regular", weight: 400 },
                        { label: "Medium", weight: 500 },
                        { label: "Semi-Bold", weight: 600 },
                        { label: "Bold", weight: 700 },
                        { label: "Black", weight: 800 },
                      ].map(w => (
                        <button
                          key={w.weight}
                          type="button"
                          onClick={() => updateTypingSettings({ fontWeight: w.weight })}
                          className={`py-1.5 px-2 rounded-xl text-xs transition-all cursor-pointer text-center ${
                            (settings.fontWeight || 400) === w.weight
                              ? "bg-purple-600 text-white font-bold shadow-xs ring-2 ring-purple-400/40"
                              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/60 dark:border-gray-700/60"
                          }`}
                          style={{ fontWeight: w.weight }}
                        >
                          {w.weight}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Typography Preview */}
                  <div
                    className="p-4 rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-inner select-none"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: `${Math.min(settings.fontSize, 22)}px`,
                      fontWeight: settings.fontWeight || 400,
                      lineHeight: settings.lineHeight,
                      fontVariationSettings: getFontVariationSettings(settings.fontFamily),
                    }}
                  >
                    <div className="text-[11px] font-sans text-gray-400 uppercase tracking-wider mb-1 font-semibold">
                      Preview ({settings.fontFamily} · {settings.fontWeight || 400})
                    </div>
                    <div className="break-words">
                      <span style={{ color: settings.correctColor }}>The quick brown fox</span>{" "}
                      <span style={{ color: settings.errorColor }}>jumps</span>{" "}
                      <span style={{ color: settings.untypedColor, opacity: settings.untypedOpacity }}>
                        over the lazy dog. 1234567890
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caret & Visuals */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Caret & Layout</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Caret Style
                    </label>
                    <select
                      value={settings.caretStyle}
                      onChange={e => updateTypingSettings({ caretStyle: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium cursor-pointer"
                    >
                      <option value="line">Line (|)</option>
                      <option value="floor">Floor (_)</option>
                      <option value="block">Block (█)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Caret Animation
                    </label>
                    <select
                      value={settings.caretAnimation}
                      onChange={e => updateTypingSettings({ caretAnimation: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium cursor-pointer"
                    >
                      <option value="linear">Linear</option>
                      <option value="swing">Swing</option>
                      <option value="ease">Ease</option>
                      <option value="ease-in">Ease-in</option>
                      <option value="ease-out">Ease-out</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Detailed Options */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Typing Behavior</h3>

                {/* Keep In Position */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Keep In Position</div>
                    <div className="text-xs text-gray-500">Adds additional margin to the bottom to keep the active line in position.</div>
                  </div>
                  <button
                    onClick={() => updateTypingSettings({ keepInPosition: !settings.keepInPosition })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                      settings.keepInPosition ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.keepInPosition ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* New Line Indication */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Line Indication</div>
                    <div className="text-xs text-gray-500">When active, the return character (⏎) appears at the end of each paragraph.</div>
                  </div>
                  <button
                    onClick={() => updateTypingSettings({ newLineIndication: !settings.newLineIndication })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                      settings.newLineIndication ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.newLineIndication ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* Typos Indication */}
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Typos Indication</div>
                  <p className="text-xs text-gray-500 mb-2.5">First option is recommended as it gives the best feedback. Last option forces you to pay more attention.</p>
                  <div className="flex gap-2">
                    {(["both", "highlight", "replace"] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => updateTypingSettings({ typosIndication: opt })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                          settings.typosIndication === opt
                            ? "bg-purple-600 text-white shadow-xs"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mark Incorrect Words */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mark Incorrect Words</div>
                    <div className="text-xs text-gray-500">When active, incorrect words are underlined.</div>
                  </div>
                  <button
                    onClick={() => updateTypingSettings({ markIncorrectWords: !settings.markIncorrectWords })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                      settings.markIncorrectWords ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.markIncorrectWords ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* Paragraph Reset Key */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Paragraph Reset</div>
                    <div className="text-xs text-gray-500">Key for a quick restart of the current paragraph.</div>
                  </div>
                  <div className="flex gap-1.5">
                    {(["off", "tab", "esc"] as const).map(k => (
                      <button
                        key={k}
                        onClick={() => updateTypingSettings({ paragraphReset: k })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold uppercase cursor-pointer ${
                          settings.paragraphReset === k
                            ? "bg-purple-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Backspace Behavior */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Backspace Behavior</div>
                    <div className="text-xs text-gray-500">Selected option used for Backspace; other option used for Opt+Backspace.</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => updateTypingSettings({ backspaceBehavior: "char" })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        settings.backspaceBehavior === "char"
                          ? "bg-purple-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      Delete Char
                    </button>
                    <button
                      onClick={() => updateTypingSettings({ backspaceBehavior: "word" })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        settings.backspaceBehavior === "word"
                          ? "bg-purple-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      Delete Word
                    </button>
                  </div>
                </div>

                {/* Mark as Read */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mark as Read</div>
                    <div className="text-xs text-gray-500">Marks paragraph as read when pressing Shift+Return at the beginning.</div>
                  </div>
                  <button
                    onClick={() => updateTypingSettings({ markAsRead: !settings.markAsRead })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                      settings.markAsRead ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.markAsRead ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* Auto-pause */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Auto-pause</div>
                    <div className="text-xs text-gray-500">Controls when the timer pauses mid-paragraph (AFK threshold).</div>
                  </div>
                  <div className="flex gap-1.5">
                    {(["2s", "5s", "10s", "never"] as const).map(ap => (
                      <button
                        key={ap}
                        onClick={() => updateTypingSettings({ autoPause: ap })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                          settings.autoPause === ap
                            ? "bg-purple-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {ap}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hide Completed Paragraph Stats */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Hide Completed Paragraph Stats</div>
                    <div className="text-xs text-gray-500">Hides speed, accuracy, and duration badges on finished paragraphs.</div>
                  </div>
                  <button
                    onClick={() => updateTypingSettings({ hideParagraphStats: !settings.hideParagraphStats })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                      settings.hideParagraphStats ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.hideParagraphStats ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOUND */}
          {activeTab === "sound" && (
            <div className="space-y-6">
              
              {/* Master Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-200/70 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Sound Effects</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Master sound toggle for typing & errors</div>
                  </div>
                </div>
                <button
                  onClick={() => updateTypingSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                    settings.soundEnabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Keycaps Sound */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Keycaps Sound</h3>
                <div className="space-y-4">
                  
                  {/* Switch Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Mechanical Switch</label>
                      <button
                        onClick={() => playKeycapsSound({
                          switchId: settings.keycapsSound,
                          pitchModifier: settings.keycapsPitch,
                          volume: settings.keycapsVolume,
                          key: "a",
                        })}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" /> Preview Switch
                      </button>
                    </div>
                    <select
                      value={settings.keycapsSound}
                      onChange={e => {
                        updateTypingSettings({ keycapsSound: e.target.value })
                        playKeycapsSound({ switchId: e.target.value, volume: settings.keycapsVolume, key: "a" })
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium cursor-pointer"
                    >
                      <optgroup label="TypeLouder Switches">
                        {KEYCAPS_SWITCHES.filter(sw => sw.category === "TypeLouder").map(sw => (
                          <option key={sw.id} value={sw.id}>
                            {sw.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Mechanical (Entertrained)">
                        {KEYCAPS_SWITCHES.filter(sw => sw.category !== "TypeLouder").map(sw => (
                          <option key={sw.id} value={sw.id}>
                            {sw.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Volume Slider */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span>Keycaps Volume</span>
                      <span className="font-mono">{Math.round(settings.keycapsVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.keycapsVolume}
                      onChange={e => updateTypingSettings({ keycapsVolume: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Pitch Modifier Slider */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <span>Keycaps Pitch</span>
                      <span className="font-mono">{settings.keycapsPitch > 0 ? `+${settings.keycapsPitch}` : settings.keycapsPitch}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2">Negative values produce lower sounds; positive values produce higher sounds.</p>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="1"
                      value={settings.keycapsPitch}
                      onChange={e => {
                        const val = parseInt(e.target.value)
                        updateTypingSettings({ keycapsPitch: val })
                        playKeycapsSound({ switchId: settings.keycapsSound, pitchModifier: val, volume: settings.keycapsVolume, key: "a" })
                      }}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Release sound toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                    <div className="pr-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Keycaps Release Sound</div>
                      <div className="text-xs text-gray-500">Plays additional sound when the key is released.</div>
                    </div>
                    <button
                      onClick={() => updateTypingSettings({ keycapsReleaseSound: !settings.keycapsReleaseSound })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                        settings.keycapsReleaseSound ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.keycapsReleaseSound ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* Special keys sound toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                    <div className="pr-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Keycaps Special Sounds</div>
                      <div className="text-xs text-gray-500">Plays dedicated sounds for Space, Delete and Return.</div>
                    </div>
                    <button
                      onClick={() => updateTypingSettings({ keycapsSpecial: !settings.keycapsSpecial })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                        settings.keycapsSpecial ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.keycapsSpecial ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* Keycaps Sound Trim */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                    <div className="pr-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Keycaps Sound Trim</div>
                      <div className="text-xs text-gray-500">Makes sounds more immediate for crisp feedback.</div>
                    </div>
                    <button
                      onClick={() => updateTypingSettings({ keycapsTrim: !settings.keycapsTrim })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                        settings.keycapsTrim ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.keycapsTrim ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Errors Sound */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Error Sound</h3>
                <div className="space-y-4">
                  
                  {/* Error Sound Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Error Sound Effect</label>
                      <button
                        onClick={() => playErrorSound(settings.errorSound, settings.errorVolume)}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" /> Preview Error
                      </button>
                    </div>
                    <select
                      value={settings.errorSound}
                      onChange={e => {
                        updateTypingSettings({ errorSound: e.target.value })
                        playErrorSound(e.target.value, settings.errorVolume)
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium cursor-pointer"
                    >
                      {ERROR_SOUNDS.map(err => (
                        <option key={err.id} value={err.id}>
                          {err.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Errors Volume Slider */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span>Errors Volume</span>
                      <span className="font-mono">{Math.round(settings.errorVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.errorVolume}
                      onChange={e => updateTypingSettings({ errorVolume: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Other Effects Volume Slider */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/80">
                    <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span>Other Effects Volume</span>
                      <span className="font-mono">{Math.round(settings.otherVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.otherVolume}
                      onChange={e => updateTypingSettings({ otherVolume: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA (IMPORT / EXPORT) */}
          {activeTab === "data" && (
            <div className="space-y-6">

              {dataMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium flex items-start gap-2 ${
                    dataMessage.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {dataMessage.type === "success" ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{dataMessage.text}</span>
                </div>
              )}

              {/* Book Import Section */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Import Book</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Import books formatted as <strong>JSON</strong>, <strong>EPUB</strong> (e-books), or <strong>TXT</strong> (plain text).
                </p>
                <button
                  onClick={() => bookImportInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload size={14} /> Select File (.json, .epub, .txt)
                </button>
                <input
                  ref={bookImportInputRef}
                  type="file"
                  accept=".json,.epub,.txt,application/json,application/epub+zip,text/plain"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleImportBookFile(f)
                    e.target.value = ""
                  }}
                />
              </div>

              {/* Book Export Section */}
              {currentBook && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download size={18} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Export Book: <span className="text-purple-600 dark:text-purple-400 font-semibold">{currentBook.title}</span>
                    </h3>
                  </div>

                  {/* Recommendation banner */}
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      💡 Recommended export formats:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-purple-800/90 dark:text-purple-300">
                      <li><strong>JSON (Recommended)</strong>: Stores complete nested chapter hierarchy, author, and content. Easily imported into other devices.</li>
                      <li><strong>EPUB</strong>: For e-readers (Kindle, Apple Books, Kobo...).</li>
                      <li><strong>TXT</strong>: Plain text readable on any computer or mobile device.</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => exportBookToJson(currentBook)}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} /> Export JSON (Recommended)
                    </button>
                    <button
                      onClick={() => exportBookToEpub(currentBook)}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} /> Export EPUB
                    </button>
                    <button
                      onClick={() => exportBookToTxt(currentBook)}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} /> Export TXT
                    </button>
                  </div>
                </div>
              )}

              {/* Book Save File (Progress + Notes) */}
              {currentBook && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Save File (Book Progress &amp; Notes)
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    Save file contains all <strong>typing progress (WPM, Accuracy, Time)</strong> across paragraphs, current reading position, and <strong>all notes/word cards</strong> created from this book.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => exportBookSaveFile(currentBook, progress, lastPosition, sentenceLinks, flashcards)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} /> Export Save File (.json)
                    </button>
                    <button
                      onClick={() => saveImportInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={13} /> Import Save File
                    </button>
                    <input
                      ref={saveImportInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleImportSaveFile(f)
                        e.target.value = ""
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Git Data Storage Card */}
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Git Storage (Flashcard/data)
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Store and synchronize directly with Git folders: <code className="font-mono text-purple-600 dark:text-purple-300">data/book</code>, <code className="font-mono text-purple-600 dark:text-purple-300">data/vocab</code>, <code className="font-mono text-purple-600 dark:text-purple-300">data/sentence</code>, <code className="font-mono text-purple-600 dark:text-purple-300">data/save</code>.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSyncFromGit}
                    disabled={isGitSyncing}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download size={14} className={isGitSyncing ? "animate-bounce" : ""} />
                    {isGitSyncing ? "Loading..." : "Load from Git Folders"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportToGit}
                    disabled={isGitSyncing}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-purple-200 dark:border-purple-800 text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload size={14} /> Export to Git Folders
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/60 dark:bg-gray-900/30">
          <button
            onClick={resetTypingSettings}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}

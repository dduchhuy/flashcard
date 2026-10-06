import { useRef, useState, useMemo } from 'react'
import { useFlashcardStore, getCardTags } from '../store'
import { Download, Upload, RotateCcw, Moon, Sun, Palette, CheckCircle2, Trash2 } from 'lucide-react'

// Convert hex to rgb
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '216, 180, 254'
}

export function TabSettings() {
  const { settings, updateSettings, resetSettings, flashcards } = useFlashcardStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportTag, setExportTag] = useState<string>('all')
  const [deleteTag, setDeleteTag] = useState<string>('all')
  const [importedTags, setImportedTags] = useState<string[]>([])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    let hasNoTag = false
    flashcards.forEach(f => {
      const t = getCardTags(f)
      if (t.length === 0) hasNoTag = true
      else t.forEach(tag => tags.add(tag))
    })
    const list = Array.from(tags)
    if (hasNoTag) list.push('notag')
    return list.sort()
  }, [flashcards])

  const handleExport = async () => {
    let cardsToExport = flashcards
    if (exportTag !== 'all') {
      cardsToExport = flashcards.filter(f => {
        const t = getCardTags(f)
        if (exportTag === 'notag') return t.length === 0 || t.includes('notag')
        return t.includes(exportTag)
      })
    }

    if (cardsToExport.length === 0) {
      alert('Không có thẻ nào để export (No cards to export).')
      return
    }

    const exportDataObj = {
      state: { flashcards: cardsToExport },
      version: 0
    }
    const exportData = JSON.stringify(exportDataObj, null, 2)
    const blob = new Blob([exportData], { type: 'application/json;charset=utf-8' })
    const filename = `flashcards_${exportTag}_${new Date().toISOString().split('T')[0]}.json`

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err)
        return
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleDelete = () => {
    if (flashcards.length === 0) {
      alert('No cards to delete.')
      return
    }

    if (deleteTag === 'all') {
      const sure = window.confirm('Are you sure you want to delete ALL flashcards?\n(This action cannot be undone)')
      if (sure) {
        useFlashcardStore.setState({ flashcards: [] })
        alert('All flashcards have been deleted.')
      }
    } else {
      const sure = window.confirm(`Are you sure you want to delete all flashcards with tag "${deleteTag}"?`)
      if (sure) {
        useFlashcardStore.setState(state => {
          return {
            flashcards: state.flashcards.filter(f => {
              const t = getCardTags(f)
              if (deleteTag === 'notag') return t.length > 0 && !t.includes('notag')
              return !t.includes(deleteTag)
            })
          }
        })
        alert(`Deleted flashcards with tag "${deleteTag}".`)
        setDeleteTag('all')
      }
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    let allImportedCards: any[] = []
    let newTags = new Set<string>()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        
        let cardsToImport = []
        if (parsed.state && Array.isArray(parsed.state.flashcards)) {
          cardsToImport = parsed.state.flashcards
        } else if (Array.isArray(parsed)) {
          cardsToImport = parsed
        } else {
          throw new Error('Invalid format')
        }

        cardsToImport.forEach((card: any) => {
          let cardTags = card.tags || (card.tag ? [card.tag] : [])
          if (cardTags.length === 0) cardTags = ['notag']
          
          cardTags.forEach((t: string) => newTags.add(t))
          allImportedCards.push({
            ...card,
            tags: cardTags,
            tag: undefined // clean up old format
          })
        })
      } catch (error) {
        console.error(`Failed to import ${file.name}`, error)
        alert(`Lỗi khi đọc file (Error reading file): ${file.name}`)
      }
    }

    if (allImportedCards.length > 0) {
      const existingTags = new Set(useFlashcardStore.getState().flashcards.flatMap(getCardTags))
      const overlappingTags = Array.from(newTags).filter(t => existingTags.has(t))

      let replaceTags = false
      if (overlappingTags.length > 0) {
        const merge = window.confirm(`Some tags already exist (${overlappingTags.join(', ')}).\n\nClick OK to MERGE new words with existing ones.\nClick Cancel to REPLACE the tags completely (deletes old words).`)
        if (!merge) {
          const sure = window.confirm(`Are you sure you want to REPLACE the tags? This will delete existing flashcards with these tags.\n\nClick OK to confirm replacement.\nClick Cancel to abort the import.`)
          if (!sure) {
            if (e.target) e.target.value = ''
            return
          }
          replaceTags = true
        }
      }

      useFlashcardStore.setState(state => {
        let currentFlashcards = [...state.flashcards]

        if (replaceTags) {
          currentFlashcards = currentFlashcards.filter(c => {
            const cTags = getCardTags(c)
            return !cTags.some(t => overlappingTags.includes(t))
          })
        }

        const existingMap = new Map(currentFlashcards.map(f => [f.id, f]))
        allImportedCards.forEach(c => existingMap.set(c.id, c))
        return { flashcards: Array.from(existingMap.values()) }
      })
      setImportedTags(Array.from(newTags))
    }

    if (e.target) e.target.value = '' 
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Appearance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-5 transition-colors">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Palette size={20} className="text-purple-600 dark:text-purple-400" />
          Appearance
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings.isDarkMode ? 'bg-blue-900/30' : 'bg-orange-100'}`}>
                {settings.isDarkMode ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-orange-500" />}
              </div>
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">Theme Preference</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Toggle dark mode</div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ isDarkMode: !settings.isDarkMode })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${settings.isDarkMode ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Palette size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">Highlight Style</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {settings.highlightMode === 'text' ? 'Color the text directly' : 'Add a background color'}
                </div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ highlightMode: settings.highlightMode === 'text' ? 'background' : 'text' })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${settings.highlightMode === 'text' ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.highlightMode === 'text' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-5 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-200">Highlight Colors</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Customize how your notes look</p>
            </div>
            <button 
              onClick={resetSettings}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center gap-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Normal Color */}
            <div className="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Base Color</span>
                <div className="relative w-8 h-8 rounded-full shadow-sm border-2 border-white dark:border-gray-700 overflow-hidden cursor-pointer ring-2 ring-gray-100 dark:ring-gray-800">
                  <div className="absolute inset-0" style={{ backgroundColor: settings.highlightColor }} />
                  <input 
                    type="color" 
                    value={settings.highlightColor}
                    onChange={(e) => updateSettings({ highlightColor: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <span>Opacity</span>
                  <span>{Math.round(settings.highlightOpacity * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.05" max="1" step="0.05" 
                  value={settings.highlightOpacity}
                  onChange={(e) => updateSettings({ highlightOpacity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: settings.highlightColor }}
                />
              </div>
            </div>

            {/* Hover Color */}
            <div className="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hover Color</span>
                <div className="relative w-8 h-8 rounded-full shadow-sm border-2 border-white dark:border-gray-700 overflow-hidden cursor-pointer ring-2 ring-gray-100 dark:ring-gray-800">
                  <div className="absolute inset-0" style={{ backgroundColor: settings.hoverColor }} />
                  <input 
                    type="color" 
                    value={settings.hoverColor}
                    onChange={(e) => updateSettings({ hoverColor: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <span>Opacity</span>
                  <span>{Math.round(settings.hoverOpacity * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.05" max="1" step="0.05" 
                  value={settings.hoverOpacity}
                  onChange={(e) => updateSettings({ hoverOpacity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: settings.hoverColor }}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 text-center flex flex-col items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold">Live Preview</span>
            <span 
              className="px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer text-xl"
              style={
                settings.highlightMode === 'text' 
                  ? { color: settings.highlightColor, backgroundColor: 'transparent' }
                  : { backgroundColor: `rgba(${hexToRgb(settings.highlightColor)}, ${settings.highlightOpacity})`, color: settings.isDarkMode ? '#f3f4f6' : '#111827' }
              }
              onMouseEnter={(e) => {
                if (settings.highlightMode === 'text') {
                  e.currentTarget.style.color = settings.hoverColor
                } else {
                  e.currentTarget.style.backgroundColor = `rgba(${hexToRgb(settings.hoverColor)}, ${settings.hoverOpacity})`
                }
              }}
              onMouseLeave={(e) => {
                if (settings.highlightMode === 'text') {
                  e.currentTarget.style.color = settings.highlightColor
                } else {
                  e.currentTarget.style.backgroundColor = `rgba(${hexToRgb(settings.highlightColor)}, ${settings.highlightOpacity})`
                }
              }}
            >
              Hover over me
            </span>
          </div>
        </div>
      </div>

      {/* Voice Settings Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-5 transition-colors">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🔊 Voice Settings
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Accent</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Choose English accent preference</div>
            </div>
            <div className="relative">
              <select
                value={settings.voiceAccent}
                onChange={(e) => updateSettings({ voiceAccent: e.target.value as 'US' | 'UK' | 'Random' })}
                className="p-2 pr-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none text-left min-w-[140px]"
              >
                <option value="US">🇺🇸 US English</option>
                <option value="UK">🇬🇧 UK English</option>
                <option value="Random">🎲 Random</option>
              </select>
              <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Voice Gender</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Choose voice gender preference</div>
            </div>
            <div className="relative">
              <select
                value={settings.voiceGender}
                onChange={(e) => updateSettings({ voiceGender: e.target.value as 'Male' | 'Female' | 'Random' })}
                className="p-2 pr-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none text-left min-w-[140px]"
              >
                <option value="Female">👩 Female</option>
                <option value="Male">👨 Male</option>
                <option value="Random">🎲 Random</option>
              </select>
              <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4 transition-colors">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          Data Management
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Export your flashcards by tag, or import multiple files to merge them.
        </p>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <select
              value={exportTag}
              onChange={(e) => setExportTag(e.target.value)}
              className="p-2.5 pr-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full appearance-none text-left cursor-pointer transition-colors"
            >
              <option value="all">Export: All Tags</option>
              {allTags.map(t => (
                <option key={t} value={t}>Export: {t}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleExport}
              className="flex-1 flex justify-center items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Download size={18} /> Export
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex justify-center items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Upload size={18} /> Import Backup
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            multiple
            className="hidden" 
          />
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-500 mt-0.5" size={20} />
              <div>
                <h4 className="text-sm font-medium text-green-800 dark:text-green-300">Import Successful!</h4>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Đã nhập dữ liệu cho các tag: <span className="font-bold">{importedTags.join(', ')}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4 transition-colors border-2 border-red-100 dark:border-red-900/30">
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
          <Trash2 size={20} />
          Remove card
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Permanently delete flashcards by specific tags or wipe all data.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
          <div className="w-full sm:flex-1">
            <label className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-wider block mb-1.5 ml-1">Select tag</label>
            <div className="relative w-full">
              <select
                value={deleteTag}
                onChange={(e) => setDeleteTag(e.target.value)}
                className="appearance-none w-full p-2.5 pr-10 border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 text-red-900 dark:text-red-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-sm transition-shadow"
              >
                <option value="all">All</option>
                {allTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400 pointer-events-none" />
            </div>
          </div>
          
          <button 
            onClick={handleDelete}
            className="w-full sm:w-auto sm:mt-5 flex justify-center items-center gap-2 bg-red-600 text-white hover:bg-red-700 px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 whitespace-nowrap"
          >
            <Trash2 size={16} /> Remove
          </button>
        </div>
      </div>

    </div>
  )
}

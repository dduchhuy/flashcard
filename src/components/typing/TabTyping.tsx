import { useMemo, useRef, useState } from 'react'
import { Upload, BookOpen, Trash2, Play, AlertCircle, CheckCircle2, FolderGit2 } from 'lucide-react'
import { useTypingStore, Book } from '../../typingStore'
import { flattenChapters, splitParagraphs, validateBookJson, parseTxtToBook, parseEpubToBook } from '../../utils/bookUtils'
import { loadAllFromGitData } from '../../utils/gitDataService'
import { saveBookFileToData, deleteBookFromData } from '../../utils/dataPersistence'
import { BookReader } from './BookReader'

function bookStats(book: Book, progress: Record<string, Record<number, unknown>> | undefined) {
  const flat = flattenChapters(book.chapters)
  let total = 0
  let done = 0
  for (const f of flat) {
    const paras = splitParagraphs(f.chapter.content)
    total += paras.length
    const prog = progress?.[f.chapter.id] || {}
    done += paras.filter((_, i) => prog[i]).length
  }
  return { chapters: flat.length, total, done, percent: total ? Math.round((done / total) * 100) : 0 }
}

export function TabTyping() {
  const { books, progress, importBook, deleteBook } = useTypingStore()
  const [openBookId, setOpenBookId] = useState<string | null>(() => sessionStorage.getItem('typing_open_book'))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openBook = useMemo(() => books.find(b => b.id === openBookId) || null, [books, openBookId])

  const setOpen = (id: string | null) => {
    setOpenBookId(id)
    if (id) sessionStorage.setItem('typing_open_book', id)
    else sessionStorage.removeItem('typing_open_book')
  }

  const handleFile = async (file: File) => {
    setError(null)
    setSuccess(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let data: { title: string; author: string[]; chapters: any[] }

      if (ext === 'json') {
        const text = await file.text()
        let json: unknown
        try {
          json = JSON.parse(text)
        } catch {
          throw new Error('Invalid JSON syntax. Please check the file.')
        }
        data = validateBookJson(json)
      } else if (ext === 'txt') {
        const text = await file.text()
        data = parseTxtToBook(file.name, text)
      } else if (ext === 'epub') {
        data = await parseEpubToBook(file)
      } else {
        throw new Error('Unsupported format. Please select a .json, .epub, or .txt file.')
      }

      const existing = books.find(b => b.title === data.title && b.author.join('|') === data.author.join('|'))
      if (existing) {
        if (!window.confirm(`"${data.title}" already exists. Replace it? (Progress for chapters with the same id is kept.)`)) return
        importBook(data, existing.id, file.name)
      } else {
        importBook(data, undefined, file.name)
      }
      saveBookFileToData(file)
      setSuccess(`Imported "${data.title}" successfully.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSyncGit = async () => {
    setError(null)
    setSuccess(null)
    try {
      const res = await loadAllFromGitData()
      setSuccess(`Synced from Git: ${res.booksCount} books, ${res.vocabCount} words, ${res.sentenceCount} sentences, ${res.savesCount} saves.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (openBook) {
    return <BookReader book={openBook} onBack={() => setOpen(null)} />
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Typing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Practice touch typing by retyping books. Note words and phrases as you read.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncGit}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 text-sm font-semibold shadow-xs cursor-pointer transition-colors"
            title="Load books and progress from Flashcard/data"
          >
            <FolderGit2 size={16} /> Sync Git Data
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm cursor-pointer"
          >
            <Upload size={16} /> Import Book
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json,.txt,text/plain,.epub,application/epub+zip"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map(book => {
          const s = bookStats(book, progress[book.id] as Record<string, Record<number, unknown>> | undefined)
          return (
            <div
              key={book.id}
              className="group bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-16 shrink-0 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">{book.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{book.author.join(', ') || 'Unknown author'}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{s.chapters} chapters · {s.total} paragraphs</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{s.percent}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all" style={{ width: `${s.percent}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(book.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-sm font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/50 cursor-pointer"
                >
                  <Play size={14} /> {s.done > 0 ? 'Continue' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${book.title}" and its typing progress? (Library cards are kept.)`)) {
                      deleteBook(book.id)
                      deleteBookFromData(book.title, book.fileName)
                    }
                  }}
                  title="Delete book"
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-rose-600 hover:border-rose-300 cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setIsDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className={`min-h-[170px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-sm cursor-pointer transition-colors ${
            isDragOver
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700'
              : 'border-gray-300 dark:border-gray-700 text-gray-400 hover:border-purple-300 hover:text-purple-600'
          }`}
        >
          <BookOpen size={28} />
          <span className="font-semibold">Drop a book here (.json, .epub, .txt)</span>
          <span className="text-xs">or click to choose a file</span>
        </div>
      </div>

      <details className="mt-6 bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 rounded-2xl p-4 text-sm">
        <summary className="font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">JSON format</summary>
        <pre className="mt-3 text-xs bg-gray-50 dark:bg-gray-900 rounded-xl p-3 overflow-x-auto text-gray-700 dark:text-gray-300">{`{
  "book": {
    "title": "Book title",
    "author": ["Author name"],
    "chapters": [
      {
        "id": "chapter-1",
        "title": "Chapter 1",
        "content": "Paragraph 1\\nParagraph 2",
        "children": [
          { "id": "chapter-1-1", "title": "1.1", "content": "", "children": [] }
        ]
      }
    ]
  }
}`}</pre>
      </details>
    </div>
  )
}

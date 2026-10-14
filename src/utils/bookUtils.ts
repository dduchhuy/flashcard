import { Book, BookChapter } from '../typingStore'
import { Flashcard } from '../store'
import JSZip from 'jszip'

export interface FlatChapter {
  chapter: BookChapter
  depth: number
  parentId: string | null
  number: number // position in flattened list
}

export interface SentencePart {
  text: string // trimmed sentence text (used as card sentence)
  raw: string // original slice including trailing whitespace
  start: number
}

/** Validate a raw JSON object against the book schema. Throws a readable error on failure. */
export function validateBookJson(raw: unknown): { title: string; author: string[]; chapters: BookChapter[] } {
  if (!raw || typeof raw !== 'object') throw new Error('File is not a valid JSON object.')
  const book = (raw as any).book
  if (!book || typeof book !== 'object') throw new Error('Missing root "book" object.')
  if (typeof book.title !== 'string' || !book.title.trim()) throw new Error('"book.title" must be a non-empty string.')
  if (!Array.isArray(book.author) || !book.author.every((a: unknown) => typeof a === 'string')) {
    throw new Error('"book.author" must be an array of strings.')
  }
  if (!Array.isArray(book.chapters)) throw new Error('"book.chapters" must be an array.')

  const seenIds = new Set<string>()
  const walk = (list: unknown[], path: string): BookChapter[] =>
    list.map((ch: any, i) => {
      const where = `${path}[${i}]`
      if (!ch || typeof ch !== 'object') throw new Error(`${where} must be an object.`)
      if (typeof ch.id !== 'string' || !ch.id.trim()) throw new Error(`${where}.id must be a non-empty string.`)
      if (seenIds.has(ch.id)) throw new Error(`Duplicate chapter id "${ch.id}" at ${where}. IDs must be unique in the whole book.`)
      seenIds.add(ch.id)
      if (typeof ch.title !== 'string') throw new Error(`${where}.title must be a string.`)
      if (typeof ch.content !== 'string') throw new Error(`${where}.content must be a string (use "" if empty).`)
      if (!Array.isArray(ch.children)) throw new Error(`${where}.children must be an array (use [] if empty).`)
      return {
        id: ch.id,
        title: ch.title,
        content: ch.content,
        children: walk(ch.children, `${where}.children`),
      }
    })

  return {
    title: book.title,
    author: book.author,
    chapters: walk(book.chapters, 'book.chapters'),
  }
}

/** Depth-first flatten preserving order. */
export function flattenChapters(chapters: BookChapter[], depth = 0, parentId: string | null = null, acc: FlatChapter[] = []): FlatChapter[] {
  for (const ch of chapters) {
    acc.push({ chapter: ch, depth, parentId, number: acc.length })
    flattenChapters(ch.children, depth + 1, ch.id, acc)
  }
  return acc
}

/** Split chapter content into paragraphs (one per non-empty line). */
export function splitParagraphs(content: string): string[] {
  if (!content) return []
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(p => p.replace(/\s+$/g, '').replace(/^\s+/g, ''))
    .filter(p => p.length > 0)
}

/** Split a paragraph into sentences, keeping character offsets. */
export function splitSentences(paragraph: string): SentencePart[] {
  const result: SentencePart[] = []
  const re = /[^.!?…。！？]+(?:[.!?…。！？]+["'”’)\]»]*|$)\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(paragraph)) !== null) {
    if (!m[0]) { re.lastIndex++; continue }
    const text = m[0].trim()
    if (text) result.push({ text, raw: m[0], start: m.index })
    if (re.lastIndex >= paragraph.length) break
  }
  if (result.length === 0 && paragraph.trim()) {
    result.push({ text: paragraph.trim(), raw: paragraph, start: 0 })
  }
  return result
}

const TYPOGRAPHIC_MAP: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '′': "'", '`': "'",
  '“': '"', '”': '"', '„': '"', '″': '"', '«': '"', '»': '"',
  '–': '-', '—': '-', '‒': '-', '−': '-',
  '…': '.',
  '\u00A0': ' ', '\u2009': ' ', '\u202F': ' ',
}

/** Returns the keyboard-typable equivalent of a char, or null if it cannot be typed on a standard keyboard. */
export function typableEquivalent(ch: string): string | null {
  const code = ch.charCodeAt(0)
  if (code >= 32 && code <= 126) return ch
  if (TYPOGRAPHIC_MAP[ch]) return TYPOGRAPHIC_MAP[ch]
  const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (base.length === 1) {
    const b = base.charCodeAt(0)
    if (b >= 32 && b <= 126) return base
  }
  if (ch === 'đ') return 'd'
  if (ch === 'Đ') return 'D'
  return null
}

/** Whether the typed key is accepted for the target char. */
export function isCharMatch(target: string, typed: string): boolean {
  if (typed === target) return true
  const eq = typableEquivalent(target)
  if (eq === null) return true // foreign character: any key accepted
  return typed === eq
}

/** First meaning of a flashcard: posEntries → highlights → translation. */
export function firstMeaningOf(card: { posEntries?: { meanings?: { meaning?: string }[] }[]; highlights?: { meaning?: string }[]; translation?: string } | undefined): string {
  if (!card) return ''
  return (
    card.posEntries?.[0]?.meanings?.[0]?.meaning?.trim() ||
    card.highlights?.[0]?.meaning?.trim() ||
    card.translation?.trim() ||
    ''
  )
}

export function sentenceKey(bookId: string, chapterId: string, pIdx: number, sIdx: number) {
  return `${bookId}|${chapterId}|${pIdx}|${sIdx}`
}

export const TELEX_MAP: Record<string, Record<string, string[]>> = {
  s: {
    'á': ['a', 's'], 'ắ': ['aw', 's'], 'ấ': ['aa', 's'],
    'é': ['e', 's'], 'ế': ['ee', 's'],
    'í': ['i', 's'],
    'ó': ['o', 's'], 'ố': ['oo', 's'], 'ớ': ['ow', 's'],
    'ú': ['u', 's'], 'ứ': ['uw', 's'],
    'ý': ['y', 's'],
    'Á': ['A', 's'], 'Ắ': ['Aw', 's'], 'Ấ': ['Aa', 's'],
    'É': ['E', 's'], 'Ế': ['Ee', 's'],
    'Í': ['I', 's'],
    'Ó': ['O', 's'], 'Ố': ['Oo', 's'], 'Ớ': ['Ow', 's'],
    'Ú': ['U', 's'], 'Ứ': ['Uw', 's'],
    'Ý': ['Y', 's'],
  },
  f: {
    'à': ['a', 'f'], 'ằ': ['aw', 'f'], 'ầ': ['aa', 'f'],
    'è': ['e', 'f'], 'ề': ['ee', 'f'],
    'ì': ['i', 'f'],
    'ò': ['o', 'f'], 'ồ': ['oo', 'f'], 'ờ': ['ow', 'f'],
    'ù': ['u', 'f'], 'ừ': ['uw', 'f'],
    'ỳ': ['y', 'f'],
    'À': ['A', 'f'], 'Ằ': ['Aw', 'f'], 'Ầ': ['Aa', 'f'],
    'È': ['E', 'f'], 'Ề': ['Ee', 'f'],
    'Ì': ['I', 'f'],
    'Ò': ['O', 'f'], 'Ồ': ['Oo', 'f'], 'Ờ': ['Ow', 'f'],
    'Ù': ['U', 'f'], 'Ừ': ['Uw', 'f'],
    'Ỳ': ['Y', 'f'],
  },
  r: {
    'ả': ['a', 'r'], 'ẳ': ['aw', 'r'], 'ẩ': ['aa', 'r'],
    'ẻ': ['e', 'r'], 'ể': ['ee', 'r'],
    'ỉ': ['i', 'r'],
    'ỏ': ['o', 'r'], 'ổ': ['oo', 'r'], 'ở': ['ow', 'r'],
    'ủ': ['u', 'r'], 'ử': ['uw', 'r'],
    'ỷ': ['y', 'r'],
    'Ả': ['A', 'r'], 'Ẳ': ['Aw', 'r'], 'Ẩ': ['Aa', 'r'],
    'Ẻ': ['E', 'r'], 'Ể': ['Ee', 'r'],
    'Ỉ': ['I', 'r'],
    'Ỏ': ['O', 'r'], 'Ổ': ['Oo', 'r'], 'Ở': ['Ow', 'r'],
    'Ủ': ['U', 'r'], 'Ử': ['Uw', 'r'],
    'Ỷ': ['Y', 'r'],
  },
  x: {
    'ã': ['a', 'x'], 'ẵ': ['aw', 'x'], 'ẫ': ['aa', 'x'],
    'ẽ': ['e', 'x'], 'ễ': ['ee', 'x'],
    'ĩ': ['i', 'x'],
    'õ': ['o', 'x'], 'ỗ': ['oo', 'x'], 'ỡ': ['ow', 'x'],
    'ũ': ['u', 'x'], 'ữ': ['uw', 'x'],
    'ỹ': ['y', 'x'],
    'Ã': ['A', 'x'], 'Ẵ': ['Aw', 'x'], 'Ẫ': ['Aa', 'x'],
    'Ẽ': ['E', 'x'], 'Ễ': ['Ee', 'x'],
    'Ĩ': ['I', 'x'],
    'Õ': ['O', 'x'], 'Ỗ': ['Oo', 'x'], 'Ỡ': ['Ow', 'x'],
    'Ũ': ['U', 'x'], 'Ữ': ['Uw', 'x'],
    'Ỹ': ['Y', 'x'],
  },
  j: {
    'ạ': ['a', 'j'], 'ặ': ['aw', 'j'], 'ậ': ['aa', 'j'],
    'ẹ': ['e', 'j'], 'ệ': ['ee', 'j'],
    'ị': ['i', 'j'],
    'ọ': ['o', 'j'], 'ộ': ['oo', 'j'], 'ợ': ['ow', 'j'],
    'ụ': ['u', 'j'], 'ự': ['uw', 'j'],
    'ỵ': ['y', 'j'],
    'Ạ': ['A', 'j'], 'Ặ': ['Aw', 'j'], 'Ậ': ['Aa', 'j'],
    'Ẹ': ['E', 'j'], 'Ệ': ['Ee', 'j'],
    'Ị': ['I', 'j'],
    'Ọ': ['O', 'j'], 'Ộ': ['Oo', 'j'], 'Ợ': ['Ow', 'j'],
    'Ụ': ['U', 'j'], 'Ự': ['Uw', 'j'],
    'Ỵ': ['Y', 'j'],
  },
  w: {
    'ư': ['u', 'w'], 'ơ': ['o', 'w'], 'ă': ['a', 'w'],
    'Ư': ['U', 'w'], 'Ơ': ['O', 'w'], 'Ă': ['A', 'w'],
  },
  a: {
    'â': ['a', 'a'], 'Â': ['A', 'a'],
  },
  e: {
    'ê': ['e', 'e'], 'Ê': ['E', 'e'],
  },
  o: {
    'ô': ['o', 'o'], 'Ô': ['O', 'o'],
  },
  d: {
    'đ': ['d', 'd'], 'Đ': ['D', 'd'],
  },
}

/**
 * Reverts a Vietnamese Telex accented char when the modifier key is typed again.
 * e.g. 'í' + 's' -> ['i', 's'] (e.g. this -> thí -> this)
 *      'ê' + 'e' -> ['e', 'e'] (e.g. see -> sê -> see)
 *      'ô' + 'o' -> ['o', 'o'] (e.g. good -> gô -> goo)
 */
export function resolveTelexRevert(
  prevChar: string,
  key: string,
  targetRemaining?: string
): string[] | null {
  const k = key.toLowerCase()
  const mapForK = TELEX_MAP[k]
  if (!mapForK) return null
  const expansion = mapForK[prevChar]
  if (!expansion) return null

  const chars: string[] = []
  for (const part of expansion) {
    for (const c of part) chars.push(c)
  }

  // Preserve uppercase if target wants uppercase
  if (targetRemaining && targetRemaining.length >= chars.length) {
    for (let i = 0; i < chars.length; i++) {
      const t = targetRemaining[i]
      if (t === t.toUpperCase() && t !== t.toLowerCase()) {
        if (chars[i].toLowerCase() === t.toLowerCase()) {
          chars[i] = t
        }
      }
    }
  }

  return chars
}

/**
 * Inverted map: accented char -> base vowel + modifier
 * e.g. 'í' -> { base: 'i', modifier: 's', expansion: ['i', 's'] }
 *      'ỏ' -> { base: 'o', modifier: 'r', expansion: ['o', 'r'] }
 */
export const ACCENT_TO_EXPANSION: Record<string, { base: string; modifier: string; expansion: string[] }> = {}
for (const [mod, charMap] of Object.entries(TELEX_MAP)) {
  for (const [accentChar, parts] of Object.entries(charMap)) {
    const flatChars: string[] = []
    for (const part of parts) {
      for (const c of part) flatChars.push(c)
    }
    ACCENT_TO_EXPANSION[accentChar] = {
      base: flatChars[0],
      modifier: mod,
      expansion: flatChars,
    }
  }
}

/** Trigger browser file download */
export function triggerFileDownload(content: string | Blob, filename: string, mime: string = 'application/octet-stream') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Parse plain text into a structured book */
export function parseTxtToBook(filename: string, text: string): { title: string; author: string[]; chapters: BookChapter[] } {
  const cleanFilename = filename.replace(/\.[^/.]+$/, '').trim() || 'Untitled Book'
  const lines = text.split(/\r?\n/)
  
  // Try detecting title and author from initial lines
  let title = cleanFilename
  let author: string[] = ['Unknown']

  const firstFew = lines.slice(0, 10).map(l => l.trim()).filter(Boolean)
  for (let i = 0; i < firstFew.length; i++) {
    const l = firstFew[i]
    if (/^title:\s*(.+)$/i.test(l)) {
      title = l.replace(/^title:\s*/i, '').trim()
    } else if (/^(?:author|by):\s*(.+)$/i.test(l)) {
      const a = l.replace(/^(?:author|by):\s*/i, '').trim()
      if (a) author = [a]
    }
  }

  // Check if format uses divider line (--- or ===) or markdown headings (## or ###)
  const hasDividerOrMarkdown = lines.some(l => /^-{3,}\s*$/.test(l.trim()) || /^#{2,3}\s+\S+/.test(l.trim()))

  if (hasDividerOrMarkdown) {
    const chapters: BookChapter[] = []
    let currentMain: BookChapter | null = null
    let currentSub: BookChapter | null = null
    let currentLines: string[] = []

    const flushContent = () => {
      const content = currentLines.join('\n').trim()
      currentLines = []
      if (currentSub) {
        currentSub.content = currentSub.content ? `${currentSub.content}\n\n${content}`.trim() : content
      } else if (currentMain) {
        currentMain.content = currentMain.content ? `${currentMain.content}\n\n${content}`.trim() : content
      }
    }

    let mainCount = 0
    let subCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Skip title/author metadata lines if at very top before any chapter
      if (mainCount === 0 && (/^title:\s*/i.test(trimmed) || /^(?:author|by):\s*/i.test(trimmed))) {
        continue
      }

      // Divider line: ----------------------------------------
      if (/^-{3,}\s*$/.test(trimmed) || /^={3,}\s*$/.test(trimmed)) {
        flushContent()
        currentSub = null
        continue
      }

      // Main Chapter: ## Title
      const mainMatch = trimmed.match(/^##\s+(.+)$/)
      if (mainMatch && !trimmed.startsWith('###')) {
        flushContent()
        mainCount++
        subCount = 0
        currentSub = null
        currentMain = {
          id: `chapter-${mainCount}`,
          title: mainMatch[1].trim(),
          content: '',
          children: []
        }
        chapters.push(currentMain)
        continue
      }

      // Sub-chapter: ### Title
      const subMatch = trimmed.match(/^###\s+(.+)$/)
      if (subMatch) {
        flushContent()
        subCount++
        if (!currentMain) {
          mainCount++
          currentMain = {
            id: `chapter-${mainCount}`,
            title: title || `Chapter ${mainCount}`,
            content: '',
            children: []
          }
          chapters.push(currentMain)
        }
        currentSub = {
          id: `chapter-${mainCount}-${subCount}`,
          title: subMatch[1].trim(),
          content: '',
          children: []
        }
        currentMain.children.push(currentSub)
        continue
      }

      // Regular line content
      currentLines.push(line)
    }

    flushContent()

    const validChapters = chapters.filter(c => c.content.trim() || c.children.length > 0)
    if (validChapters.length > 0) {
      return { title, author, chapters: validChapters }
    }
  }

  // Chapter boundary pattern
  const chapterRegex = /^(?:chapter|chương|part|phần|section|act|hồi|mục|book)\s+([0-9ivxlcdm]+|[a-z0-9\s]+)/i
  const chapterIndices: { lineIdx: number; title: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (chapterRegex.test(line) && line.length < 120) {
      chapterIndices.push({ lineIdx: i, title: line })
    }
  }

  const chapters: BookChapter[] = []

  if (chapterIndices.length > 0) {
    for (let ci = 0; ci < chapterIndices.length; ci++) {
      const cur = chapterIndices[ci]
      const nextIdx = ci + 1 < chapterIndices.length ? chapterIndices[ci + 1].lineIdx : lines.length
      const chapterLines = lines.slice(cur.lineIdx + 1, nextIdx)
      const content = chapterLines.join('\n').trim()
      if (content) {
        chapters.push({
          id: `chapter-${ci + 1}`,
          title: cur.title,
          content,
          children: [],
        })
      }
    }
  }

  // Fallback: chunk paragraphs if no chapter headings found
  if (chapters.length === 0) {
    const paragraphs = splitParagraphs(text)
    if (paragraphs.length <= 15) {
      chapters.push({
        id: 'chapter-1',
        title: title,
        content: paragraphs.join('\n\n'),
        children: [],
      })
    } else {
      const chunkSize = 12
      let chNum = 1
      for (let i = 0; i < paragraphs.length; i += chunkSize) {
        const chunk = paragraphs.slice(i, i + chunkSize)
        chapters.push({
          id: `chapter-${chNum}`,
          title: `Chapter ${chNum}`,
          content: chunk.join('\n\n'),
          children: [],
        })
        chNum++
      }
    }
  }

  return { title, author, chapters }
}

/** Parse EPUB archive into a structured book */
export async function parseEpubToBook(file: Blob | ArrayBuffer): Promise<{ title: string; author: string[]; chapters: BookChapter[] }> {
  const zip = await JSZip.loadAsync(file)

  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Invalid EPUB: META-INF/container.xml not found.')
  const containerXml = await containerFile.async('text')

  const opfMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i)
  if (!opfMatch) throw new Error('Invalid EPUB: OPF rootfile path not found in container.xml.')
  const opfPath = opfMatch[1]
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error(`Invalid EPUB: OPF file not found at "${opfPath}".`)
  const opfXml = await opfFile.async('text')

  // 2. Parse title and author
  const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled EPUB'

  const authorMatches = [...opfXml.matchAll(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi)]
  const author = authorMatches.length ? authorMatches.map(m => m[1].trim()).filter(Boolean) : ['Unknown']

  // 3. Parse manifest
  const manifestMap = new Map<string, string>()
  const manifestItems = [...opfXml.matchAll(/<item\s+[^>]*id\s*=\s*["']([^"']+)["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  manifestItems.forEach(m => manifestMap.set(m[1], m[2]))
  // In case attributes are in reverse order (href before id)
  const manifestItemsAlt = [...opfXml.matchAll(/<item\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*id\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  manifestItemsAlt.forEach(m => manifestMap.set(m[2], m[1]))

  // 4. Parse spine order
  const spineItems = [...opfXml.matchAll(/<itemref\s+[^>]*idref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  const hrefsInOrder: string[] = []
  for (const item of spineItems) {
    const idref = item[1]
    const href = manifestMap.get(idref)
    if (href && /\.(x?html|xml)$/i.test(href)) {
      hrefsInOrder.push(href)
    }
  }

  // Fallback: list all html/xhtml files in zip if spine was empty
  if (hrefsInOrder.length === 0) {
    zip.forEach((relPath) => {
      if (/\.(x?html)$/i.test(relPath) && !relPath.startsWith('META-INF/')) {
        hrefsInOrder.push(relPath)
      }
    })
    hrefsInOrder.sort()
  }

  // 5. Extract chapters
  const chapters: BookChapter[] = []
  let chapterIndex = 1

  for (const href of hrefsInOrder) {
    const cleanHref = href.split('#')[0]
    const fullPath = opfDir ? opfDir + cleanHref : cleanHref
    const fileInZip = zip.file(fullPath) || zip.file(cleanHref)
    if (!fileInZip) continue

    const htmlContent = await fileInZip.async('text')
    const plain = stripHtml(htmlContent)
    if (!plain || plain.length < 10) continue // Skip blank or trivial pages

    // Try finding chapter title from h1, h2, or title
    const headingMatch = htmlContent.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i) || htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
    let chTitle = headingMatch ? stripHtml(headingMatch[1]).trim() : ''
    if (!chTitle || chTitle.length > 80) chTitle = `Chapter ${chapterIndex}`

    chapters.push({
      id: `chapter-${chapterIndex}`,
      title: chTitle,
      content: plain,
      children: [],
    })
    chapterIndex++
  }

  if (chapters.length === 0) {
    throw new Error('No readable chapters found in this EPUB file.')
  }

  return { title, author, chapters }
}

/** Export book as JSON */
export function exportBookToJson(book: Book) {
  const data = {
    book: {
      title: book.title,
      author: book.author,
      chapters: book.chapters,
    },
  }
  triggerFileDownload(JSON.stringify(data, null, 2), `${book.title}.json`, 'application/json')
}

/** Export book as TXT */
export function exportBookToTxt(book: Book) {
  const flat = flattenChapters(book.chapters)
  const lines: string[] = [
    `Title: ${book.title}`,
    `Author: ${book.author.join(', ')}`,
    '',
    '========================================',
    '',
  ]
  for (const f of flat) {
    lines.push(`## ${f.chapter.title}`)
    lines.push('')
    lines.push(f.chapter.content)
    lines.push('')
    lines.push('----------------------------------------')
    lines.push('')
  }
  triggerFileDownload(lines.join('\n'), `${book.title}.txt`, 'text/plain')
}

/** Export book as EPUB using JSZip */
export async function exportBookToEpub(book: Book) {
  const zip = new JSZip()
  const flat = flattenChapters(book.chapters)

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )

  let manifestXml = ''
  let spineXml = ''

  flat.forEach((f, idx) => {
    const chId = `ch_${idx + 1}`
    const filename = `chapter_${idx + 1}.xhtml`
    manifestXml += `    <item id="${chId}" href="${filename}" media-type="application/xhtml+xml"/>\n`
    spineXml += `    <itemref idref="${chId}"/>\n`

    const paragraphs = splitParagraphs(f.chapter.content)
    const bodyHtml = paragraphs.map(p => `  <p>${escapeXml(p)}</p>`).join('\n')

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(f.chapter.title)}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 5%; }
    h1 { font-family: sans-serif; text-align: center; margin-bottom: 2em; }
    p { margin-bottom: 1em; text-indent: 1.5em; }
  </style>
</head>
<body>
  <h1>${escapeXml(f.chapter.title)}</h1>
${bodyHtml}
</body>
</html>`
    zip.file(`OEBPS/${filename}`, xhtml)
  })

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author.join(', '))}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine>
${spineXml}
  </spine>
</package>`
  zip.file('OEBPS/content.opf', opf)

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
  triggerFileDownload(blob, `${book.title}.epub`, 'application/epub+zip')
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface BookSavePayload {
  format: 'flashcard-book-save'
  version: number
  bookId: string
  bookTitle: string
  exportedAt: number
  progress: Record<string, Record<number, any>>
  lastPosition?: { chapterId: string; pIdx: number } | null
  sentenceLinks: Record<string, any>
  linkedCards: Flashcard[]
}

/** Export book save file (progress + cards/notes) */
export function exportBookSaveFile(
  book: Book,
  progress: Record<string, Record<string, Record<number, any>>>,
  lastPosition: Record<string, { chapterId: string; pIdx: number }>,
  sentenceLinks: Record<string, any>,
  flashcards: Flashcard[]
) {
  const bookProgress = progress[book.id] || {}
  const bookPos = lastPosition[book.id] || null

  const bookLinks: Record<string, any> = {}
  const cardIds = new Set<string>()

  for (const [k, v] of Object.entries(sentenceLinks)) {
    if (k.startsWith(`${book.id}|`)) {
      bookLinks[k] = v
      if (v?.cardId) cardIds.add(v.cardId)
    }
  }

  const linkedCards = flashcards.filter(c => cardIds.has(c.id) || (c.tags && c.tags.includes(book.title)))

  const payload: BookSavePayload = {
    format: 'flashcard-book-save',
    version: 1,
    bookId: book.id,
    bookTitle: book.title,
    exportedAt: Date.now(),
    progress: bookProgress,
    lastPosition: bookPos,
    sentenceLinks: bookLinks,
    linkedCards,
  }

  triggerFileDownload(
    JSON.stringify(payload, null, 2),
    `${book.title}.flashcard-save.json`,
    'application/json'
  )
}

/** Parse and validate book save file */
export function parseBookSaveFile(rawText: string): BookSavePayload {
  let parsed: any
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Invalid JSON format in save file.')
  }

  if (!parsed || parsed.format !== 'flashcard-book-save') {
    throw new Error('This file is not a valid Flashcard Book Save file (format mismatch).')
  }

  if (!parsed.bookId || !parsed.progress) {
    throw new Error('Corrupted save file: missing bookId or progress data.')
  }

  return parsed as BookSavePayload
}



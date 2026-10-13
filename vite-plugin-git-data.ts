import { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

const CATEGORIES = ['book', 'vocab', 'sentence', 'save'] as const
type Category = typeof CATEGORIES[number]

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_')
}

function scanDataDirectory(dataDir: string) {
  const result: Record<Category, Array<{ name: string; size: number; modified: number }>> = {
    book: [],
    vocab: [],
    sentence: [],
    save: []
  }

  for (const cat of CATEGORIES) {
    const dir = path.join(dataDir, cat)
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch {}
      continue
    }

    try {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        if (file === '.gitkeep' || file === '.DS_Store' || file.startsWith('.')) continue
        const fullPath = path.join(dir, file)
        try {
          const stat = fs.statSync(fullPath)
          if (stat.isFile()) {
            result[cat].push({
              name: file,
              size: stat.size,
              modified: stat.mtimeMs
            })
          }
        } catch {}
      }
    } catch {}
  }

  return result
}

export default function gitDataPlugin(): Plugin {
  let projectRoot = process.cwd()

  return {
    name: 'vite-plugin-git-data',
    configResolved(config) {
      projectRoot = config.root || process.cwd()
    },
    configureServer(server) {
      const dataDir = path.resolve(projectRoot, 'data')

      // Ensure folders exist
      for (const cat of CATEGORIES) {
        const dir = path.join(dataDir, cat)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
      }

      // 1. API: List files in data/
      server.middlewares.use('/api/data/list', (_req, res) => {
        const manifest = scanDataDirectory(dataDir)
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(manifest))
      })

      // 2. API: Get a single file
      server.middlewares.use('/api/data/file', (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const category = url.searchParams.get('category') as Category
        const name = url.searchParams.get('name')

        if (!category || !name || !CATEGORIES.includes(category)) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing or invalid category or name' }))
          return
        }

        const safeName = path.basename(name)
        const filePath = path.join(dataDir, category, safeName)

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'File not found' }))
          return
        }

        const ext = path.extname(safeName).toLowerCase()
        if (ext === '.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
        } else if (ext === '.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        } else if (ext === '.epub') {
          res.setHeader('Content-Type', 'application/epub+zip')
        } else {
          res.setHeader('Content-Type', 'application/octet-stream')
        }

        const stream = fs.createReadStream(filePath)
        stream.pipe(res)
      })

      // 3. API: Write single file
      server.middlewares.use('/api/data/write', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            const { category, name, content, isBase64 } = parsed

            if (!category || !name || !CATEGORIES.includes(category)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid category or name' }))
              return
            }

            const safeName = sanitizeFilename(name)
            const targetDir = path.join(dataDir, category)
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

            const filePath = path.join(targetDir, safeName)

            if (isBase64) {
              const buf = Buffer.from(content, 'base64')
              fs.writeFileSync(filePath, buf)
            } else {
              fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: `data/${category}/${safeName}` }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
          }
        })
      })

      // 4. API: Export all data to Git directories
      server.middlewares.use('/api/data/export-all', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body)
            const written = {
              vocab: 0,
              sentence: 0,
              books: 0,
              saves: 0
            }

            // Export Vocab cards
            if (Array.isArray(payload.vocab) && payload.vocab.length > 0) {
              const vocabDir = path.join(dataDir, 'vocab')
              if (!fs.existsSync(vocabDir)) fs.mkdirSync(vocabDir, { recursive: true })
              fs.writeFileSync(
                path.join(vocabDir, 'vocab.json'),
                JSON.stringify(payload.vocab, null, 2),
                'utf8'
              )
              written.vocab = payload.vocab.length
            }

            // Export Sentence cards
            if (Array.isArray(payload.sentence) && payload.sentence.length > 0) {
              const sentenceDir = path.join(dataDir, 'sentence')
              if (!fs.existsSync(sentenceDir)) fs.mkdirSync(sentenceDir, { recursive: true })
              fs.writeFileSync(
                path.join(sentenceDir, 'sentence.json'),
                JSON.stringify(payload.sentence, null, 2),
                'utf8'
              )
              written.sentence = payload.sentence.length
            }

            // Export Books
            if (Array.isArray(payload.books) && payload.books.length > 0) {
              const bookDir = path.join(dataDir, 'book')
              if (!fs.existsSync(bookDir)) fs.mkdirSync(bookDir, { recursive: true })
              for (const b of payload.books) {
                const safeTitle = sanitizeFilename(b.title || 'untitled')
                const bookContent = {
                  book: {
                    title: b.title,
                    author: b.author,
                    chapters: b.chapters
                  }
                }
                fs.writeFileSync(
                  path.join(bookDir, `${safeTitle}.json`),
                  JSON.stringify(bookContent, null, 2),
                  'utf8'
                )
                written.books++
              }
            }

            // Export Saves
            if (payload.saves && typeof payload.saves === 'object') {
              const saveDir = path.join(dataDir, 'save')
              if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true })
              for (const [saveName, saveContent] of Object.entries(payload.saves)) {
                const safeSaveName = sanitizeFilename(saveName.replace(/\.json$/i, ''))
                fs.writeFileSync(
                  path.join(saveDir, `${safeSaveName}.flashcard-save.json`),
                  JSON.stringify(saveContent, null, 2),
                  'utf8'
                )
                written.saves++
              }
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, written }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
          }
        })
      })

      // 5. Static file serving for /data/* in dev server
      server.middlewares.use('/data', (req, res, next) => {
        const decodedUrl = decodeURIComponent(req.url?.split('?')[0] || '')
        const filePath = path.join(dataDir, decodedUrl)

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase()
          if (ext === '.json') res.setHeader('Content-Type', 'application/json; charset=utf-8')
          else if (ext === '.txt') res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          else if (ext === '.epub') res.setHeader('Content-Type', 'application/epub+zip')
          fs.createReadStream(filePath).pipe(res)
          return
        }
        next()
      })
    },

    // Build hook: copy data/ to dist/data/ and generate manifest.json
    closeBundle() {
      const dataDir = path.resolve(projectRoot, 'data')
      const distDir = path.resolve(projectRoot, 'dist', 'data')

      if (!fs.existsSync(dataDir)) return

      const manifest = scanDataDirectory(dataDir)

      function copyRecursive(src: string, dest: string) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
        const entries = fs.readdirSync(src, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name === '.gitkeep' || entry.name === '.DS_Store' || entry.name.startsWith('.')) continue
          const srcPath = path.join(src, entry.name)
          const destPath = path.join(dest, entry.name)
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath)
          } else {
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      try {
        copyRecursive(dataDir, distDir)
        // Write manifest.json in dist/data/
        fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
      } catch (e) {
        console.warn('Could not copy data directory to dist:', e)
      }
    }
  }
}

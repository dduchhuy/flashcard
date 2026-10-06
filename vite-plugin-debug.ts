import { Plugin } from 'vite'
import fs from 'fs'

export default function debugPlugin(): Plugin {
  return {
    name: 'debug-plugin',
    configureServer(server) {
      server.middlewares.use('/api/debug', (req, res) => {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
          fs.writeFileSync('debug.json', body)
          res.end('ok')
        })
      })
    }
  }
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Flashcard PWA',
        short_name: 'Flashcard',
        description: 'Learn vocabulary with flashcards',
        theme_color: '#9333ea',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: './icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: './icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})

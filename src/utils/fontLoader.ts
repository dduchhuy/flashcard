export interface FontOption {
  name: string
  value: string
}

export interface FontGroup {
  group: string
  fonts: FontOption[]
}

export const FONT_OPTIONS: FontGroup[] = [
  // Monospace
  {
    group: 'Monospace',
    fonts: [
      { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
      { name: 'Fira Mono', value: 'Fira Mono, monospace' },
      { name: 'Roboto Mono', value: 'Roboto Mono, monospace' },
      { name: 'Source Code Pro', value: 'Source Code Pro, monospace' },
      { name: 'Courier Prime', value: 'Courier Prime, monospace' },
      { name: 'DejaVu Mono', value: "'DejaVu Mono', monospace" },
      { name: 'OpenDyslexic Mono', value: "'OpenDyslexic', monospace" },
      { name: 'Noto Sans Mono', value: 'Noto Sans Mono, monospace' },
      { name: 'Recursive Casual', value: "'Recursive Casual', 'Recursive', monospace" },
      { name: 'Recursive Linear', value: "'Recursive Linear', 'Recursive', monospace" },
      { name: 'Ubuntu Mono', value: 'Ubuntu Mono, monospace' },
      { name: 'Victor Mono', value: 'Victor Mono, monospace' },
    ]
  },
  // Sans-serif
  {
    group: 'Sans-Serif',
    fonts: [
      { name: 'Arial', value: 'Arial, sans-serif' },
      { name: 'Open Sans', value: 'Open Sans, sans-serif' },
      { name: 'Noto Sans', value: 'Noto Sans, sans-serif' },
      { name: 'Geologica', value: 'Geologica, sans-serif' },
      { name: 'Alegreya Sans', value: 'Alegreya Sans, sans-serif' },
      { name: 'Atkinson Hyperlegible', value: 'Atkinson Hyperlegible, sans-serif' },
      { name: 'Comfortaa', value: 'Comfortaa, sans-serif' },
      { name: 'Comic Neue', value: 'Comic Neue, sans-serif' },
      { name: 'Open Dyslexic', value: "'OpenDyslexic', sans-serif" },
      { name: 'Play', value: 'Play, sans-serif' },
      { name: 'Ubuntu', value: 'Ubuntu, sans-serif' },
      { name: 'Ysabeau', value: 'Ysabeau, sans-serif' },
    ]
  },
  // Serif
  {
    group: 'Serif',
    fonts: [
      { name: 'EB Garamond', value: 'EB Garamond, serif' },
      { name: 'Times New Roman', value: "'Times New Roman', Times, serif" },
      { name: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
      { name: 'Literata', value: 'Literata, serif' },
      { name: 'Noto Serif', value: 'Noto Serif, serif' },
      { name: 'Piazzolla', value: 'Piazzolla, serif' },
      { name: 'Roboto Slab', value: 'Roboto Slab, serif' },
      { name: 'Source Serif 4', value: 'Source Serif 4, serif' },
      { name: 'Vollkorn', value: 'Vollkorn, serif' },
      { name: 'Alegreya', value: 'Alegreya, serif' },
      { name: 'DejaVu Serif', value: "'DejaVu Serif', serif" },
      { name: 'Gentium Book Plus', value: 'Gentium Book Plus, serif' },
    ]
  }
]

const SYSTEM_FONTS = new Set([
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana'
])

const CDN_FONTS: Record<string, string> = {
  'DejaVu Mono': 'https://cdn.jsdelivr.net/npm/@fontsource/dejavu-mono/index.css',
  'DejaVu Sans Mono': 'https://cdn.jsdelivr.net/npm/@fontsource/dejavu-mono/index.css',
  'DejaVu Serif': 'https://cdn.jsdelivr.net/npm/@fontsource/dejavu-serif/index.css',
  'OpenDyslexic': 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css',
  'OpenDyslexic Mono': 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css',
  'Open Dyslexic': 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css',
  'Dyslexic Mono': 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css'
}

/** Load font stylesheet dynamically into head */
export function loadFont(fontFamily: string) {
  if (!fontFamily) return

  const cleanName = fontFamily.split(',')[0].replace(/['"]/g, '').trim()
  if (SYSTEM_FONTS.has(cleanName)) return

  // Check CDN fonts
  if (CDN_FONTS[cleanName]) {
    const cdnUrl = CDN_FONTS[cleanName]
    const id = `cdnfont-${cleanName.toLowerCase().replace(/\s+/g, '-')}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = cdnUrl
    document.head.appendChild(link)
    return
  }

  // Google Fonts
  let googleFamily = cleanName
  if (cleanName.includes('Recursive')) {
    googleFamily = 'Recursive:wght,CASL@300..800,0..1'
  } else {
    googleFamily = `${cleanName}:wght@300;400;500;600;700;800`
  }

  const id = `gfont-${cleanName.toLowerCase().replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(googleFamily)}&display=swap`
  document.head.appendChild(link)
}

/** Get font-variation-settings if applicable (e.g. Recursive Casual vs Linear) */
export function getFontVariationSettings(fontFamily: string): string | undefined {
  if (!fontFamily) return undefined
  const lower = fontFamily.toLowerCase()
  if (lower.includes('recursive casual')) return "'CASL' 1"
  if (lower.includes('recursive linear')) return "'CASL' 0"
  return undefined
}

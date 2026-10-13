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

  const cleanName = fontFamily.split(',')[0].replace(/['\"]/g, '').trim()
  if (SYSTEM_FONTS.has(cleanName)) return

  // Check CDN fonts — also fuzzy-match any dyslexic variant
  const cdnKey = CDN_FONTS[cleanName]
    ?? CDN_FONTS[cleanName.replace(/\s+mono$/i, '').trim()]
    ?? (cleanName.toLowerCase().includes('dyslexic')
      ? 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css'
      : undefined)
  if (cdnKey) {
    const id = `cdnfont-${cleanName.toLowerCase().replace(/\s+/g, '-')}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = cdnKey
    document.head.appendChild(link)
    return
  }

  // Google Fonts — special handling for variable fonts
  let googleFamily: string
  const lower = cleanName.toLowerCase()
  if (lower === 'recursive casual' || lower === 'recursive linear' || lower === 'recursive') {
    // Recursive is a variable font with CASL axis; load the whole family once
    googleFamily = 'Recursive:slnt,wght,CASL,CRSV@-15..0,300..800,0..1,0..1'
  } else {
    googleFamily = `${cleanName}:wght@300;400;500;600;700;800`
  }

  // Use a stable ID based on the base font name (so Recursive Casual & Linear share one load)
  const baseId = cleanName.toLowerCase().replace(/\s+(casual|linear)$/i, '').replace(/\s+/g, '-')
  const id = `gfont-${baseId}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(googleFamily)}&display=swap`
  document.head.appendChild(link)

  ensureFontAliases()
}

function ensureFontAliases() {
  if (typeof document === 'undefined') return
  const id = 'font-alias-styles'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    @font-face { font-family: 'OpenDyslexic Mono'; src: local('OpenDyslexic'); }
    @font-face { font-family: 'Open Dyslexic'; src: local('OpenDyslexic'); }
    @font-face { font-family: 'Recursive Casual'; src: local('Recursive'); }
    @font-face { font-family: 'Recursive Linear'; src: local('Recursive'); }
  `
  document.head.appendChild(style)
}

/**
 * Map selected font name to the actual CSS font-family declaration that browsers understand.
 * For example:
 * - 'OpenDyslexic Mono' -> "'OpenDyslexic', monospace"
 * - 'Open Dyslexic' -> "'OpenDyslexic', sans-serif"
 * - 'Recursive Casual' -> "'Recursive', monospace"
 * - 'Recursive Linear' -> "'Recursive', monospace"
 */
export function getEffectiveFontFamily(fontFamily: string): string {
  if (!fontFamily) return 'inherit'
  const clean = fontFamily.split(',')[0].replace(/['"]/g, '').trim()
  const lower = clean.toLowerCase()
  if (lower === 'opendyslexic mono' || lower === 'dyslexic mono') {
    return "'OpenDyslexic', monospace"
  }
  if (lower === 'open dyslexic' || lower === 'opendyslexic') {
    return "'OpenDyslexic', sans-serif"
  }
  if (lower === 'recursive casual' || lower === 'recursive linear' || lower === 'recursive') {
    return "'Recursive', monospace"
  }
  if (lower === 'dejavu mono') {
    return "'DejaVu Mono', monospace"
  }
  if (lower === 'dejavu serif') {
    return "'DejaVu Serif', serif"
  }
  return fontFamily
}

/** Get font-variation-settings if applicable (e.g. Recursive Casual vs Linear) */
export function getFontVariationSettings(fontFamily: string): string | undefined {
  if (!fontFamily) return undefined
  const lower = fontFamily.toLowerCase()
  if (lower.includes('recursive casual')) return "'CASL' 1, 'slnt' 0"
  if (lower.includes('recursive linear')) return "'CASL' 0, 'slnt' 0"
  return undefined
}


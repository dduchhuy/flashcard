// Enhanced audio engine implementing all Entertrained (entertrained.app) keycaps switches and error sounds.
// Uses local assets from /sounds/ with Web Audio API for zero-latency playback.

export interface KeycapsSwitchItem {
  id: string
  name: string
}

export const KEYCAPS_SWITCHES: KeycapsSwitchItem[] = [
  { id: "mechanical/alpaca", name: "Alpacas" },
  { id: "mechanical/blackink", name: "Black Inks" },
  { id: "mechanical/bluealps", name: "Blue Alps" },
  { id: "mechanical/boxnavy", name: "Box Navies" },
  { id: "mechanical/buckling", name: "Buckling Spring" },
  { id: "mechanical/cream", name: "Creams" },
  { id: "mechanical/holypanda", name: "Holy Pandas" },
  { id: "mechanical/mxblack", name: "MX Blacks" },
  { id: "mechanical/mxbrown", name: "MX Browns" },
  { id: "mechanical/redink", name: "Red Inks" },
  { id: "mechanical/topre", name: "Topre" },
  { id: "mechanical/turquoise", name: "Turquoise" },
]

export interface ErrorSoundItem {
  id: string
  name: string
}

export const ERROR_SOUNDS: ErrorSoundItem[] = [
  { id: "errors/beep", name: "Beep" },
  { id: "errors/bubble", name: "Bubble" },
  { id: "errors/buzz", name: "Buzz" },
  { id: "errors/chirp", name: "Chirp" },
  { id: "errors/clank", name: "Clank" },
  { id: "errors/miss", name: "Miss" },
  { id: "errors/pip", name: "Pip" },
  { id: "errors/plonk", name: "Plonk" },
  { id: "errors/pop", name: "Pop" },
  { id: "errors/scratch", name: "Scratch" },
  { id: "errors/tink", name: "Tink" },
  { id: "errors/tomp", name: "Tomp" },
]

let audioCtx: AudioContext | null = null
const bufferCache = new Map<string, AudioBuffer>()
const pendingLoads = new Map<string, Promise<AudioBuffer | null>>()

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    if (!audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        audioCtx = new AudioCtx()
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

function resolveAssetUrl(relPath: string): string {
  const base = ((import.meta as any).env?.BASE_URL as string) || "/"
  const cleanBase = base.endsWith("/") ? base : base + "/"
  const cleanPath = relPath.startsWith("/") ? relPath.slice(1) : relPath
  return cleanBase + cleanPath
}

async function loadBufferFromUrl(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url)!
  if (pendingLoads.has(url)) return pendingLoads.get(url)!

  const p = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const arrayBuf = await res.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      bufferCache.set(url, audioBuf)
      return audioBuf
    } catch {
      return null
    } finally {
      pendingLoads.delete(url)
    }
  })()

  pendingLoads.set(url, p)
  return p
}

export function preloadSwitch(switchId: string = "mechanical/mxbrown") {
  const ctx = getAudioContext()
  if (!ctx) return
  const sw = switchId.replace(/^mechanical\//, "")
  const files = [
    `sounds/keycaps/mechanical/${sw}/press/GENERIC.mp3`,
    `sounds/keycaps/mechanical/${sw}/press/SPACE.mp3`,
    `sounds/keycaps/mechanical/${sw}/press/ENTER.mp3`,
    `sounds/keycaps/mechanical/${sw}/press/BACKSPACE.mp3`,
    `sounds/keycaps/mechanical/${sw}/release/GENERIC.mp3`,
  ]
  for (const f of files) {
    loadBufferFromUrl(resolveAssetUrl(f), ctx).catch(() => {})
  }
}

export function preloadError(errorId: string = "errors/pop") {
  const ctx = getAudioContext()
  if (!ctx) return
  const err = errorId.replace(/^errors\//, "")
  loadBufferFromUrl(resolveAssetUrl(`sounds/errors/${err}.mp3`), ctx).catch(() => {})
}

export interface PlaySoundOptions {
  key?: string
  type?: "key" | "space" | "enter" | "backspace"
  action?: "press" | "release"
  switchId?: string
  pitchModifier?: number // -5 to +5
  volume?: number // 0 to 1
  special?: boolean // whether to use space/enter/backspace specialized sounds
}

export async function playKeycapsSound(options: PlaySoundOptions = {}) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const {
      key,
      type = "key",
      action = "press",
      switchId = "mechanical/mxbrown",
      pitchModifier = 0,
      volume = 0.5,
      special = true,
    } = options

    if (volume <= 0) return

    const sw = switchId.replace(/^mechanical\//, "")
    let soundName = "GENERIC"
    if (special) {
      if (type === "space") soundName = "SPACE"
      else if (type === "enter") soundName = "ENTER"
      else if (type === "backspace") soundName = "BACKSPACE"
    }

    const relPath = `sounds/keycaps/mechanical/${sw}/${action}/${soundName}.mp3`
    const url = resolveAssetUrl(relPath)
    const audioBuf = await loadBufferFromUrl(url, ctx)
    if (!audioBuf) return

    const source = ctx.createBufferSource()
    source.buffer = audioBuf

    // Base pitch modulation from Entertrained formula:
    let baseRate = 1.0
    if (key && key.length === 1) {
      baseRate = 0.95 + (key.charCodeAt(0) % 32) * 0.01
    } else {
      baseRate = 0.95 + Math.random() * 0.1
    }

    const pitchFactor = Math.pow(2, pitchModifier / 12)
    const finalRate = Math.max(0.2, Math.min(3.0, baseRate * pitchFactor))
    source.playbackRate.value = finalRate

    const gainNode = ctx.createGain()
    const vol = Math.max(0, Math.min(1, volume * (action === "release" ? 0.7 : 1)))
    gainNode.gain.value = vol

    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    source.start(0)
  } catch {}
}

export async function playErrorSound(errorId: string = "errors/pop", volume: number = 0.3) {
  try {
    const ctx = getAudioContext()
    if (!ctx || volume <= 0) return

    const err = errorId.replace(/^errors\//, "")
    const relPath = `sounds/errors/${err}.mp3`
    const url = resolveAssetUrl(relPath)
    const audioBuf = await loadBufferFromUrl(url, ctx)
    if (!audioBuf) return

    const source = ctx.createBufferSource()
    source.buffer = audioBuf
    source.playbackRate.value = 0.98 + (Math.random() - 0.5) * 0.05

    const gainNode = ctx.createGain()
    gainNode.gain.value = Math.max(0, Math.min(1, volume))

    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    source.start(0)
  } catch {}
}

export function playTypingSound(
  type: "key" | "space" | "enter" | "backspace" | "error" = "key",
  keyChar?: string
) {
  if (type === "error") {
    playErrorSound("errors/pop", 0.3)
  } else {
    playKeycapsSound({
      type,
      key: keyChar,
      switchId: "mechanical/mxbrown",
      volume: 0.5,
    })
  }
}

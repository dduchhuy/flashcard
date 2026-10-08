import { SRSData } from '../store'

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface LearnSettings {
  againMs: number
  hardMs: number
  goodMs: number
  easyMs: number
}

export const DEFAULT_LEARN_SETTINGS: LearnSettings = {
  againMs: 1 * 60 * 1000,               // 1 minute
  hardMs: 6 * 60 * 1000,                // 6 minutes
  goodMs: 10 * 60 * 1000,               // 10 minutes
  easyMs: 3 * 24 * 60 * 60 * 1000,      // 3 days
}

const EASE_DEFAULT = 2.5
const EASE_MIN = 1.3

// Parse "1m", "6m", "2h", "3d" → milliseconds
export function parseIntervalStr(str: string): number | null {
  const match = str.trim().match(/^(\d+(?:\.\d+)?)(m|h|d)$/i)
  if (!match) return null
  const val = parseFloat(match[1])
  switch (match[2].toLowerCase()) {
    case 'm': return val * 60 * 1000
    case 'h': return val * 60 * 60 * 1000
    case 'd': return val * 24 * 60 * 60 * 1000
    default: return null
  }
}

// Format milliseconds → human readable "1m", "10m", "3d"
export function formatMs(ms: number): string {
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`
  if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`
  return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`
}

// Format ms to editable string for settings input
export function msToStr(ms: number): string {
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`
  if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`
  return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`
}

export function isDue(srs: SRSData | undefined): boolean {
  if (!srs) return true
  return srs.due <= Date.now()
}

export function isReviewPhase(srs: SRSData | undefined, settings: LearnSettings): boolean {
  if (!srs || srs.reps === 0) return false
  // Graduated to review if interval > goodMs
  return srs.interval > settings.goodMs
}

export function calculateNextSRS(
  rating: Rating,
  current: SRSData | undefined,
  settings: LearnSettings
): { srsData: SRSData; label: string } {
  const now = Date.now()
  const srs: SRSData = current ?? {
    due: now,
    interval: 0,
    easeFactor: EASE_DEFAULT,
    reps: 0,
    step: 0,
  }

  const inReview = isReviewPhase(srs, settings)
  let dueMs: number
  let newInterval = srs.interval
  let newEase = srs.easeFactor
  let newReps = srs.reps

  if (!inReview) {
    // ── LEARNING / NEW phase ──
    switch (rating) {
      case 'again':
        dueMs = settings.againMs
        newReps = Math.max(0, newReps - 1)
        break
      case 'hard':
        dueMs = settings.hardMs
        newReps++
        break
      case 'good':
        newReps++
        // Graduate when reps reaches threshold
        if (newReps >= 2) {
          newInterval = settings.easyMs // start review at easyMs interval
          dueMs = settings.goodMs
        } else {
          dueMs = settings.goodMs
        }
        break
      case 'easy':
        newReps++
        newInterval = settings.easyMs
        newEase = Math.min(newEase + 0.15, 4.0)
        dueMs = settings.easyMs
        break
    }
  } else {
    // ── REVIEW phase ──
    switch (rating) {
      case 'again':
        dueMs = settings.againMs
        newEase = Math.max(newEase - 0.20, EASE_MIN)
        newInterval = settings.againMs
        newReps = 0
        break
      case 'hard':
        newEase = Math.max(newEase - 0.15, EASE_MIN)
        newInterval = Math.ceil(srs.interval * 1.2)
        dueMs = newInterval
        newReps++
        break
      case 'good':
        newInterval = Math.ceil(srs.interval * newEase)
        dueMs = newInterval
        newReps++
        break
      case 'easy':
        newEase = Math.min(newEase + 0.15, 4.0)
        newInterval = Math.ceil(srs.interval * newEase * 1.3)
        dueMs = newInterval
        newReps++
        break
    }
  }

  return {
    srsData: {
      due: now + dueMs,
      interval: newInterval,
      easeFactor: newEase,
      reps: newReps,
      step: inReview ? 3 : (rating === 'easy' || (rating === 'good' && newReps >= 2) ? 3 : srs.step),
    },
    label: formatMs(dueMs),
  }
}

export function previewIntervals(
  current: SRSData | undefined,
  settings: LearnSettings
): Record<Rating, string> {
  const inReview = isReviewPhase(current, settings)
  const srs = current ?? { due: 0, interval: 0, easeFactor: EASE_DEFAULT, reps: 0, step: 0 }

  if (!inReview) {
    return {
      again: formatMs(settings.againMs),
      hard: formatMs(settings.hardMs),
      good: formatMs(settings.goodMs),
      easy: formatMs(settings.easyMs),
    }
  }
  // Review phase: show actual calculated intervals
  return {
    again: formatMs(settings.againMs),
    hard: formatMs(Math.ceil(srs.interval * 1.2)),
    good: formatMs(Math.ceil(srs.interval * srs.easeFactor)),
    easy: formatMs(Math.ceil(srs.interval * srs.easeFactor * 1.3)),
  }
}

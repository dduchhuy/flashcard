import { useEffect, useRef, useState, useCallback } from 'react'
import { useFlashcardStore } from './store'
import { loadAllFromGitData, exportAllToGitData, fetchDataManifest, DataManifest } from './utils/gitDataService'

export function useGitDataSync() {
  const { settings } = useFlashcardStore()
  const [isSyncing, setIsSyncing] = useState(false)
  const [manifest, setManifest] = useState<DataManifest | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  const refreshManifest = useCallback(async () => {
    try {
      const m = await fetchDataManifest()
      setManifest(m)
      return m
    } catch {
      return null
    }
  }, [])

  const syncFromGit = useCallback(async (_showNotification?: boolean) => {
    setIsSyncing(true)
    try {
      const res = await loadAllFromGitData()
      const msg = `Synced from Git data: ${res.booksCount} books, ${res.vocabCount} words, ${res.sentenceCount} sentences, ${res.savesCount} progress saves.`
      setLastResult(msg)
      await refreshManifest()
      return { success: true, res, message: msg }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      setLastResult(`Sync failed: ${err}`)
      return { success: false, error: err }
    } finally {
      setIsSyncing(false)
    }
  }, [refreshManifest])

  const exportToGit = useCallback(async () => {
    setIsSyncing(true)
    try {
      const res = await exportAllToGitData()
      const msg = res.isLocalDisk
        ? `Wrote files directly to Flashcard/data: ${res.written.vocab} words, ${res.written.sentence} sentences, ${res.written.books} books, ${res.written.saves} saves.`
        : `Exported and downloaded zip archive with ${res.written.vocab} words, ${res.written.sentence} sentences, ${res.written.books} books, ${res.written.saves} saves.`
      setLastResult(msg)
      await refreshManifest()
      return { success: true, res, message: msg }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      setLastResult(`Export failed: ${err}`)
      return { success: false, error: err }
    } finally {
      setIsSyncing(false)
    }
  }, [refreshManifest])

  // Initial load on startup
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    refreshManifest()

    if (settings.gitDataAutoLoad !== false) {
      syncFromGit(false)
    }
  }, [settings.gitDataAutoLoad, syncFromGit, refreshManifest])

  return {
    isSyncing,
    manifest,
    lastResult,
    refreshManifest,
    syncFromGit,
    exportToGit
  }
}

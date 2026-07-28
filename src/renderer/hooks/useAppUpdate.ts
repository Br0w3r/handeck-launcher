import { useCallback, useEffect, useState } from 'react'

/**
 * useAppUpdate — escucha los eventos de auto-actualización del launcher y expone
 * el estado + acciones para el banner de actualización.
 */
export type AppUpdatePhase = 'idle' | 'available' | 'downloading' | 'downloaded'

export interface UseAppUpdateResult {
  phase: AppUpdatePhase
  version: string | null
  percent: number
  download: () => void
  install: () => void
  dismiss: () => void
}

export function useAppUpdate(): UseAppUpdateResult {
  const [phase, setPhase] = useState<AppUpdatePhase>('idle')
  const [version, setVersion] = useState<string | null>(null)
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const offs = [
      window.handeck?.onAppUpdateAvailable((info) => {
        setVersion(info.version)
        setPhase('available')
      }),
      window.handeck?.onAppUpdateProgress((info) => {
        setPercent(info.percent)
        setPhase('downloading')
      }),
      window.handeck?.onAppUpdateDownloaded((info) => {
        setVersion(info.version)
        setPhase('downloaded')
      })
    ]
    return () => offs.forEach((off) => off?.())
  }, [])

  const download = useCallback(() => {
    window.handeck?.downloadAppUpdate()
    setPhase('downloading')
  }, [])

  const install = useCallback(() => {
    window.handeck?.installAppUpdate()
  }, [])

  const dismiss = useCallback(() => setPhase('idle'), [])

  return { phase, version, percent, download, install, dismiss }
}

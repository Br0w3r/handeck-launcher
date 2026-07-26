import { useCallback, useEffect, useState } from 'react'

import type { AppSettings } from '../../preload'

/**
 * Ajustes generales persistentes (API key de SteamGridDB + toggles de
 * verificación/actualización). Lee al montar y expone un update parcial.
 */
export interface UseSettings {
  settings: AppSettings | null
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.handeck.getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await window.handeck.setSettings(patch)
    setSettings(next)
  }, [])

  return { settings, update }
}

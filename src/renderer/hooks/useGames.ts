import { useCallback, useEffect, useState } from 'react'

import type { Game } from '../../preload'

/**
 * useGames — obtiene la biblioteca desde el main vía IPC (games:get-all).
 * PASO 2: sólo carga y expone la lista; la navegación con control (selección)
 * llega en el Paso 3 con useGamepad.
 */
export interface UseGamesResult {
  games: Game[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useGames(): UseGamesResult {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!window.handeck) throw new Error('Puente IPC no disponible (preload).')
      setGames(await window.handeck.getGames())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { games, loading, error, reload: load }
}

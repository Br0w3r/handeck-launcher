import { useCallback, useEffect, useRef, useState } from 'react'

import type { Game, LaunchStatus } from '../../preload'

/**
 * useLaunch — dispara el flujo de lanzamiento vía IPC y escucha los cambios de
 * estado (launch:status-update). Expone el juego en curso, su estado y errores,
 * más las acciones launch / cancel / retry / dismiss para el LaunchOverlay.
 */
export interface UseLaunchResult {
  game: Game | null
  status: LaunchStatus
  error: string | null
  launch: (game: Game) => void
  cancel: () => void
  retry: () => void
  dismiss: () => void
}

interface LaunchState {
  game: Game | null
  status: LaunchStatus
  error: string | null
}

const INITIAL: LaunchState = { game: null, status: 'idle', error: null }

export function useLaunch(): UseLaunchResult {
  const [state, setState] = useState<LaunchState>(INITIAL)
  const gameRef = useRef<Game | null>(null)

  useEffect(() => {
    return window.handeck?.onLaunchStatus((progress) => {
      // Descarta eventos de un lanzamiento que ya no es el actual.
      if (gameRef.current && progress.gameId === gameRef.current.id) {
        setState((prev) => ({
          ...prev,
          status: progress.status,
          error: progress.error ?? null
        }))
      }
    })
  }, [])

  const launch = useCallback((game: Game) => {
    gameRef.current = game
    setState({ game, status: 'checking-updates', error: null })
    window.handeck?.launchGame(game).catch((e: unknown) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: e instanceof Error ? e.message : String(e)
      }))
    })
  }, [])

  const dismiss = useCallback(() => {
    gameRef.current = null
    setState(INITIAL)
  }, [])

  const cancel = useCallback(() => {
    window.handeck?.cancelLaunch()
    dismiss()
  }, [dismiss])

  const retry = useCallback(() => {
    if (gameRef.current) launch(gameRef.current)
  }, [launch])

  return { ...state, launch, cancel, retry, dismiss }
}

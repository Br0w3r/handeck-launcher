import { useEffect, useState } from 'react'

import type { UpdateInfo } from '../../preload'

/**
 * useUpdateStates — refleja el estado de actualización de los juegos de Steam.
 *
 * En vez de sondear cada pocos segundos, el main observa los appmanifest_*.acf
 * con fs.watch y empuja los cambios (canal 'update-states:changed') en cuanto
 * Steam los escribe. Aquí sólo hacemos una lectura inicial, nos suscribimos a
 * esos avisos y mantenemos un refresco de respaldo poco frecuente por si el
 * watcher no dispara en algún sistema de archivos.
 *
 * Devuelve un mapa `${platform}:${id}` → UpdateInfo.
 */
export type UpdateStateMap = Record<string, UpdateInfo>

/**
 * Texto legible del estado de actualización. Sin porcentajes ni fase: sólo
 * indicamos que el juego se está actualizando o que tiene algo pendiente.
 */
export function updateLabel(info: UpdateInfo): string {
  if (info.updateState === 'update-pending') return 'Actualización pendiente'
  if (info.updateState === 'updating') return 'Actualizando'
  return ''
}

/** Respaldo por si fs.watch no dispara (unidades de red, etc.). */
const FALLBACK_INTERVAL_MS = 30_000

export function useUpdateStates(enabled: boolean): UpdateStateMap {
  const [states, setStates] = useState<UpdateStateMap>({})

  useEffect(() => {
    if (!enabled || !window.handeck) return

    let cancelled = false

    const refresh = async (): Promise<void> => {
      try {
        const next = await window.handeck.getUpdateStates()
        if (!cancelled) setStates(next)
      } catch {
        // Silencioso: si falla una lectura se conserva el último estado conocido.
      }
    }

    // Lectura inicial.
    void refresh()

    // Empujes del main cuando cambia un appmanifest (fs.watch).
    const unsubscribe = window.handeck.onUpdateStates?.((next) => {
      if (!cancelled) setStates(next)
    })

    // Respaldo poco frecuente.
    const id = setInterval(() => void refresh(), FALLBACK_INTERVAL_MS)

    return () => {
      cancelled = true
      unsubscribe?.()
      clearInterval(id)
    }
  }, [enabled])

  return states
}

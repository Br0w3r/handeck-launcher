import { useCallback, useEffect, useState } from 'react'

import type { AuthResult, EpicStatus } from '../../preload'

/**
 * Estado y acciones de la cuenta de Epic (para la pantalla de Ajustes).
 * Envuelve los canales epic:* del main y mantiene el estado sincronizado.
 */

export interface UseEpicAuth {
  status: EpicStatus | null
  /** Hay una operación (import/code/logout) en curso. */
  busy: boolean
  /** Último resultado de una acción, para mostrar feedback. */
  result: AuthResult | null
  refresh: () => Promise<void>
  importSession: () => Promise<void>
  /** Login interactivo (abre la ventana de Epic y captura el código solo). */
  login: () => Promise<void>
  /** Login manual (fallback) con el código pegado. */
  submitCode: (code: string) => Promise<void>
  logout: () => Promise<void>
}

export function useEpicAuth(): UseEpicAuth {
  const [status, setStatus] = useState<EpicStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  const refresh = useCallback(async () => {
    const s = await window.handeck.getEpicStatus()
    setStatus(s)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Corre una acción de auth, refresca el estado y guarda el feedback. */
  const runAction = useCallback(
    async (action: () => Promise<AuthResult>) => {
      setBusy(true)
      setResult(null)
      try {
        const res = await action()
        setResult(res)
        await refresh()
      } catch {
        setResult({ ok: false, message: 'Ocurrió un error inesperado.' })
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  const importSession = useCallback(
    () => runAction(() => window.handeck.epicAuthImport()),
    [runAction]
  )

  const login = useCallback(
    () => runAction(() => window.handeck.epicLogin()),
    [runAction]
  )

  const submitCode = useCallback(
    (code: string) => runAction(() => window.handeck.epicAuthCode(code)),
    [runAction]
  )

  const logout = useCallback(
    () => runAction(() => window.handeck.epicLogout()),
    [runAction]
  )

  return { status, busy, result, refresh, importSession, login, submitCode, logout }
}

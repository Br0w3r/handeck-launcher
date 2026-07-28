import type { Game } from './games/types'
import { waitForGameExit, waitForGameStart } from './launcher/processUtils'
import { getMainWindow, hideWindow, showWindow } from './windowManager'

/**
 * Ciclo de vida del juego:
 *   1. Tras lanzar, esperar a que el proceso del juego aparezca (ps-list).
 *   2. ESCONDER la ventana (a la bandeja) — la MISMA instancia queda viva en
 *      segundo plano; no se destruye ni se recrea (evita ventanas duplicadas y
 *      recargar la app "de 0").
 *   3. Polling cada 5s hasta que el proceso desaparece.
 *   4. MOSTRAR de nuevo la misma ventana y avisar al renderer (game:closed).
 *
 * Si el proceso no se detecta en el timeout, NO se esconde la ventana (para no
 * dejar al usuario sin launcher), y el flujo termina sin cambios.
 */

let monitoring = false

/** ¿Hay un juego siendo monitoreado ahora mismo? */
export function isMonitoring(): boolean {
  return monitoring
}

export async function startGameLifecycle(game: Game): Promise<void> {
  if (monitoring) return
  monitoring = true
  try {
    // 1. Esperar a que el juego arranque (algún proceso bajo su carpeta).
    const started = await waitForGameStart(game)
    if (!started) {
      console.warn(
        `[monitor] No se detectó el proceso de "${game.title}"; se mantiene la ventana.`
      )
      return
    }
    console.log(`[monitor] "${game.title}" corriendo.`)

    // 2. Esconder la ventana (misma instancia, en segundo plano).
    hideWindow()

    // 3. Esperar a que el juego cierre del todo (tolera el relevo del anti-cheat).
    await waitForGameExit(game)
    console.log(`[monitor] "${game.title}" cerrado; mostrando de nuevo HanDeck.`)
  } finally {
    monitoring = false
  }

  // 4. Mostrar la MISMA ventana (sin recargar) y avisar al renderer.
  showWindow()
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('game:closed')
}

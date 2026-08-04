import type { Game } from './games/types'
import { waitForGameExit, waitForGameStart } from './launcher/processUtils'
import { getMainWindow, hideWindow, showWindow } from './windowManager'

/**
 * Ciclo de vida del juego:
 *   1. ESCONDER la ventana de inmediato — así HanDeck cede el primer plano y el
 *      juego (y su anti-cheat) puede tomar el foco. Si HanDeck siguiera al frente
 *      cuando el juego intenta enfocarse, Windows bloquea el cambio de foco y el
 *      juego queda detrás (habría que hacer clic para traerlo).
 *   2. Esperar a que el juego arranque (algún proceso bajo su carpeta).
 *   3. Esperar a que cierre del todo (con margen para el relevo del anti-cheat).
 *   4. MOSTRAR de nuevo la misma ventana (sin recargar) y avisar (game:closed).
 *
 * Se esconde/muestra la MISMA instancia (no se destruye/recrea) para evitar
 * ventanas duplicadas y recargar la app "de 0".
 */

let monitoring = false

/** ¿Hay un juego siendo monitoreado ahora mismo? */
export function isMonitoring(): boolean {
  return monitoring
}

export async function startGameLifecycle(game: Game): Promise<void> {
  if (monitoring) return
  monitoring = true

  // 1. Ceder el primer plano YA (antes de que el juego intente enfocarse).
  hideWindow()

  try {
    // 2. Esperar a que el juego arranque (algún proceso bajo su carpeta).
    const started = await waitForGameStart(game)
    if (started) {
      console.log(`[monitor] "${game.title}" corriendo.`)
      // 3. Esperar a que cierre del todo (tolera el relevo del anti-cheat).
      await waitForGameExit(game)
      console.log(`[monitor] "${game.title}" cerrado; mostrando de nuevo HanDeck.`)
    } else {
      console.warn(
        `[monitor] No se detectó el proceso de "${game.title}"; se vuelve a mostrar HanDeck.`
      )
    }
  } finally {
    monitoring = false
  }

  // 4. Mostrar la MISMA ventana (sin recargar) y avisar al renderer.
  showWindow()
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('game:closed')
}

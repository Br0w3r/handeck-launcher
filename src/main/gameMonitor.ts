import type { Game } from './games/types'
import { waitForGameClose, waitForGameProcess } from './launcher/processUtils'
import { createWindow, destroyWindow } from './windowManager'

/**
 * Ciclo de vida del juego (LAUNCHER_CONTEXT.md):
 *   1. Tras lanzar, esperar a que el proceso del juego aparezca (ps-list).
 *   2. mainWindow.destroy() → sólo el main process queda vivo (~35MB).
 *   3. Polling cada 5s hasta que el proceso desaparece.
 *   4. Recrear la ventana (~300-500ms) y avisar al renderer (game:closed).
 *
 * Si el proceso no se detecta en el timeout, NO se destruye la ventana (para no
 * dejar al usuario sin launcher), y el flujo termina sin cambios.
 */

let monitoring = false

/** ¿Hay un juego siendo monitoreado ahora mismo? (evita cerrar la app al destruir). */
export function isMonitoring(): boolean {
  return monitoring
}

export async function startGameLifecycle(game: Game): Promise<void> {
  if (monitoring) return
  monitoring = true
  try {
    // 1. Esperar a que el proceso del juego aparezca.
    const proc = await waitForGameProcess(game)
    if (!proc) {
      console.warn(
        `[monitor] No se detectó el proceso de "${game.title}"; se mantiene la ventana.`
      )
      return
    }
    console.log(`[monitor] "${game.title}" corriendo (pid ${proc.pid}, ${proc.name}).`)

    // 2. Liberar el renderer manteniendo vivo el main process.
    destroyWindow()

    // 3. Esperar a que el juego cierre.
    await waitForGameClose(proc.pid)
    console.log(`[monitor] "${game.title}" cerrado; recreando ventana.`)
  } finally {
    monitoring = false
  }

  // 4. Recrear la ventana y avisar al renderer cuando esté cargada.
  const win = createWindow()
  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) win.webContents.send('game:closed')
  })
}

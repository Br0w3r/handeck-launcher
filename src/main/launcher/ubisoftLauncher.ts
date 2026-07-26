import { shell } from 'electron'

import type { Game } from '../games/types'
import type { LaunchContext } from './index'

/**
 * Flujo Ubisoft Connect vía el protocolo uplay://.
 *   lanzar → uplay://launch/<gameId>/0
 *
 * Ubisoft Connect abre (si hace falta) y arranca el juego; no exponemos su
 * verificación por línea de comandos, así que sólo emitimos launching → running.
 */
export async function launchUbisoft(game: Game, ctx: LaunchContext): Promise<void> {
  ctx.emit('launching')
  await shell.openExternal(`uplay://launch/${game.id}/0`)
  ctx.emit('running')
}

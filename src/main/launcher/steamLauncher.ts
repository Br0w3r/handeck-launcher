import { shell } from 'electron'

import type { Game } from '../games/types'
import { getStore } from '../store'
import type { LaunchContext } from './index'

/**
 * Flujo Steam vía URI scheme (Steam no expone una CLI directa):
 *   verificar → steam://validate/{appId}  (Steam abre su propia ventana)
 *   lanzar    → steam://rungameid/{appId}
 *
 * No tenemos control del output de verificación de Steam, así que emitimos el
 * estado y esperamos un tiempo prudente antes de lanzar.
 */
export async function launchSteam(game: Game, ctx: LaunchContext): Promise<void> {
  const appId = game.id

  if (getStore().get('verifyOnLaunch')) {
    ctx.emit('verifying')
    await shell.openExternal(`steam://validate/${appId}`)
    await ctx.wait(3000)
    if (ctx.isCancelled()) return
  }

  ctx.emit('launching')
  await shell.openExternal(`steam://rungameid/${appId}`)
  ctx.emit('running')
}

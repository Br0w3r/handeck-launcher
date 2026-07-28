import { shell } from 'electron'

import { getEpicAppLaunchId } from '../games/epicGames'
import type { Game } from '../games/types'
import { legendaryBin } from '../paths'
import { getStore } from '../store'
import type { LaunchContext } from './index'

/**
 * Flujo Epic.
 *
 * Verificación/actualización/reparación: vía legendary (best-effort — sólo aplica
 * si legendary gestiona el juego; si se instaló con el Epic Games Launcher,
 * legendary no lo conoce y esos pasos se omiten sin error).
 *
 * Lanzamiento: se prefiere el DEEP-LINK del Epic Games Launcher
 * (com.epicgames.launcher://apps/…), que es la forma correcta de arrancar juegos
 * instalados por Epic — maneja EOS, anti-cheat (EAC) y prerequisitos. Sólo si el
 * juego no está en los manifests de Epic (es un juego gestionado únicamente por
 * legendary) se usa `legendary launch` como fallback.
 */

/** ¿legendary reporta una actualización disponible para este app_name? */
function parseUpdateAvailable(output: string, appName: string): boolean {
  try {
    const data = JSON.parse(output) as Array<{ app_name?: string; update_available?: boolean }>
    return data.some((g) => g.app_name === appName && g.update_available === true)
  } catch {
    return false
  }
}

type VerifyResult = 'valid' | 'corrupt' | 'unknown'

/**
 * Interpreta la salida de `legendary verify`:
 *  - 'valid'   → todo bien.
 *  - 'corrupt' → hay archivos dañados/faltantes → reparar.
 *  - 'unknown' → legendary no gestiona el juego (instalado por Epic) o no se pudo
 *                determinar → NO reparar (evita el bucle de repair fallido).
 */
function interpretVerify(code: number, output: string): VerifyResult {
  const lower = output.toLowerCase()
  if (
    lower.includes('not installed') ||
    lower.includes('no installed manifest') ||
    lower.includes('is not installed')
  ) {
    return 'unknown'
  }
  if (code === 0 && output.includes('All files are valid')) return 'valid'
  if (lower.includes('corrupt') || lower.includes('missing')) return 'corrupt'
  if (code !== 0) return 'unknown'
  return 'valid'
}

export async function launchEpic(game: Game, ctx: LaunchContext): Promise<void> {
  const app = game.id
  const bin = legendaryBin()
  const store = getStore()
  // Deep-link del Epic Games Launcher (null si el juego no está en sus manifests).
  const epicLaunchId = getEpicAppLaunchId(app)

  // 1. ¿Hay actualización? → actualizar (best-effort vía legendary).
  if (store.get('checkUpdatesOnLaunch')) {
    ctx.emit('checking-updates')
    const { code, output } = await ctx.run(bin, ['list', '--check-updates', '--json'])
    if (ctx.isCancelled()) return
    if (code === 0 && parseUpdateAvailable(output, app)) {
      ctx.emit('updating')
      await ctx.run(bin, ['install', app, '--update-only'])
      if (ctx.isCancelled()) return
    }
  }

  // 2. Verificar integridad → reparar sólo si hay corrupción real.
  if (store.get('verifyOnLaunch')) {
    ctx.emit('verifying')
    const { code, output } = await ctx.run(bin, ['verify', app])
    if (ctx.isCancelled()) return
    if (interpretVerify(code, output) === 'corrupt') {
      ctx.emit('repairing')
      await ctx.run(bin, ['repair', app])
      if (ctx.isCancelled()) return
    }
  }

  // 3. Lanzar.
  ctx.emit('launching')

  if (epicLaunchId) {
    // Vía Epic Games Launcher (requiere que EGL esté instalado — lo está, porque
    // existen sus manifests). Es fire-and-forget: EGL arranca el juego.
    await shell.openExternal(
      `com.epicgames.launcher://apps/${epicLaunchId}?action=launch&silent=true`
    )
    ctx.emit('running')
    return
  }

  // Fallback: el juego lo gestiona legendary directamente.
  ctx.runDetached(bin, ['launch', app])
  ctx.emit('running')
}

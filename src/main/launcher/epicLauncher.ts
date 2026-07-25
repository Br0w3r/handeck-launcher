import type { Game } from '../games/types'
import { legendaryBin } from '../paths'
import { getStore } from '../store'
import type { LaunchContext } from './index'

/**
 * Flujo Epic vía legendary — replica referencia_dbd_launcher.py:
 *   epic_verificar_actualizacion() → epic_actualizar()
 *   epic_verificar() → epic_reparar()
 *   epic_lanzar()
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

/**
 * Interpreta la salida de `legendary verify` (misma heurística que el script):
 * ok si code 0 y "All files are valid"; corrupto si menciona corrupt/missing o
 * el código no es 0.
 */
function filesAreValid(code: number, output: string): boolean {
  const lower = output.toLowerCase()
  if (code === 0 && output.includes('All files are valid')) return true
  if (lower.includes('corrupt') || lower.includes('missing') || code !== 0) return false
  return code === 0
}

export async function launchEpic(game: Game, ctx: LaunchContext): Promise<void> {
  const app = game.id
  const bin = legendaryBin()
  const store = getStore()

  // 1. ¿Hay actualización? → actualizar.
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

  // 2. Verificar integridad → reparar si hace falta.
  if (store.get('verifyOnLaunch')) {
    ctx.emit('verifying')
    const { code, output } = await ctx.run(bin, ['verify', app])
    if (ctx.isCancelled()) return
    if (!filesAreValid(code, output)) {
      ctx.emit('repairing')
      await ctx.run(bin, ['repair', app])
      if (ctx.isCancelled()) return
    }
  }

  // 3. Lanzar (desprendido; el monitoreo del proceso es el Paso 7).
  ctx.emit('launching')
  ctx.runDetached(bin, ['launch', app])
  ctx.emit('running')
}

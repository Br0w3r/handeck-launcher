import { basename } from 'node:path'
import psList from 'ps-list'

import type { Game } from '../games/types'

/**
 * Utilidades de procesos (ps-list) para el ciclo de vida del juego.
 *   findGameProcess()     — localiza el proceso del juego en ejecución.
 *   waitForGameProcess()  — espera a que aparezca (tras lanzarlo).
 *   waitForGameClose()    — espera a que el proceso desaparezca.
 */

export interface GameProcess {
  pid: number
  name: string
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Busca el proceso del juego. Prioriza el nombre del ejecutable
 * (executableName); si no lo hay, intenta emparejar por installPath en el cmd.
 */
export async function findGameProcess(game: Game): Promise<GameProcess | null> {
  let procs: Array<{ pid: number; name: string; cmd?: string }>
  try {
    procs = await psList()
  } catch (err) {
    console.warn('[monitor] ps-list falló:', err instanceof Error ? err.message : err)
    return null
  }

  const exe = game.executableName ? basename(game.executableName).toLowerCase() : null
  const install = game.installPath ? game.installPath.toLowerCase() : null

  for (const p of procs) {
    // basename en ambos lados: en macOS ps-list devuelve la ruta completa como
    // name, en Windows sólo el ejecutable. Así la comparación es cross-platform.
    const name = basename(p.name ?? '').toLowerCase()
    if (exe && name === exe) return { pid: p.pid, name: p.name }

    const cmd = p.cmd?.toLowerCase() ?? ''
    if (install && cmd && cmd.includes(install)) return { pid: p.pid, name: p.name }
  }
  return null
}

/** ¿Sigue vivo el proceso con este pid? */
export async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    const procs = await psList()
    return procs.some((p) => p.pid === pid)
  } catch {
    // Ante un fallo puntual de ps-list asumimos que sigue vivo (no cortamos).
    return true
  }
}

/**
 * Espera (haciendo polling) a que el proceso del juego aparezca tras lanzarlo.
 * Devuelve el proceso, o null si no aparece antes del timeout.
 */
export async function waitForGameProcess(
  game: Game,
  timeoutMs = 30_000,
  intervalMs = 1_000
): Promise<GameProcess | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const proc = await findGameProcess(game)
    if (proc) return proc
    await delay(intervalMs)
  }
  return null
}

/** Espera a que el proceso desaparezca, haciendo polling cada intervalMs. */
export async function waitForGameClose(pid: number, intervalMs = 5_000): Promise<void> {
  while (await isProcessRunning(pid)) {
    await delay(intervalMs)
  }
}

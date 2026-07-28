import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import psList from 'ps-list'

import type { Game } from '../games/types'

/**
 * Detección del ciclo de vida del juego.
 *
 * Se monitorea por RUTA DE INSTALACIÓN, no por un solo proceso: mientras exista
 * cualquier proceso que corra desde la carpeta del juego (lanzador, anti-cheat
 * o el ejecutable real del juego), se considera que el juego sigue activo.
 *
 * Esto es clave para juegos con anti-cheat (DBD/EAC, BattlEye…): el .exe que
 * lanzamos arranca el anti-cheat y luego se cierra dando paso al juego real —
 * si sólo siguiéramos ese primer proceso, creeríamos que el juego terminó.
 */

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Normaliza una ruta para comparar (minúsculas, backslashes). */
function norm(p: string): string {
  return p.toLowerCase().replace(/\//g, '\\')
}

/**
 * En Windows, lista las rutas de ejecutable de todos los procesos
 * (Get-CimInstance Win32_Process). ps-list en Windows no da la ruta, sólo el
 * nombre, por eso usamos PowerShell aquí.
 */
async function listWindowsProcessPaths(): Promise<string[]> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | Select-Object -ExpandProperty ExecutablePath'
      ],
      { windowsHide: true }
    )
    let out = ''
    ps.stdout?.on('data', (d: Buffer) => (out += d.toString()))
    ps.on('close', () =>
      resolve(
        out
          .split(/\r?\n/)
          .map((s) => norm(s.trim()))
          .filter(Boolean)
      )
    )
    ps.on('error', () => resolve([]))
  })
}

/**
 * ¿Hay algún proceso del juego corriendo?
 * Windows: cualquier proceso cuyo ejecutable esté dentro de installPath.
 * Fallback (o si no hay ruta): por nombre de ejecutable vía ps-list.
 */
export async function isGameRunning(game: Game): Promise<boolean> {
  const install = game.installPath ? norm(game.installPath) : ''

  if (process.platform === 'win32' && install) {
    const paths = await listWindowsProcessPaths()
    if (paths.length > 0) {
      return paths.some((p) => p.startsWith(install))
    }
    // Si PowerShell falla, cae al método por nombre.
  }

  if (game.executableName) {
    const exe = basename(game.executableName).toLowerCase()
    try {
      const procs = await psList()
      return procs.some((p) => basename(p.name ?? '').toLowerCase() === exe)
    } catch {
      return false
    }
  }

  return false
}

/**
 * Espera a que el juego arranque (aparezca cualquier proceso suyo).
 * Devuelve true si arrancó, false si se agotó el timeout.
 */
export async function waitForGameStart(
  game: Game,
  timeoutMs = 60_000,
  intervalMs = 1_000
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isGameRunning(game)) return true
    await delay(intervalMs)
  }
  return false
}

/**
 * Espera a que el juego cierre: que isGameRunning sea falso durante `graceChecks`
 * comprobaciones seguidas. El margen cubre el relevo del anti-cheat (el EAC se
 * cierra y el juego real arranca unos segundos después).
 */
export async function waitForGameExit(
  game: Game,
  intervalMs = 5_000,
  graceChecks = 3
): Promise<void> {
  let misses = 0
  while (misses < graceChecks) {
    await delay(intervalMs)
    if (await isGameRunning(game)) misses = 0
    else misses++
  }
}

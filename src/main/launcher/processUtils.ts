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

/** Nombre "canónico" para comparar: minúsculas, sin extensión ni símbolos. */
function canonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * ¿Hay algún proceso del juego corriendo?
 *
 * Se combinan dos métodos (basta que UNO diga que sí) para ser robusto ante
 * anti-cheat (el .exe lanzador cierra y arranca el `-Shipping.exe`) y ante fallos
 * puntuales de una de las consultas:
 *   1. ps-list (ligero): un proceso cuyo nombre coincide con executableName, o
 *      cuyo nombre EMPIEZA con el nombre de la carpeta del juego (installdir).
 *      Ej.: carpeta "DeadByDaylight" → "deadbydaylight-win64-shipping" empieza igual.
 *   2. Refuerzo en Windows: cualquier proceso cuyo ejecutable esté DENTRO de
 *      installPath (Get-CimInstance). Sólo se consulta si el paso 1 no encontró
 *      nada (más barato y evita spawnear PowerShell en cada chequeo).
 */
export async function isGameRunning(game: Game): Promise<boolean> {
  const installBase = game.installPath ? canonName(basename(game.installPath)) : ''
  const exe = game.executableName ? basename(game.executableName).toLowerCase() : ''

  // 1. Por nombre (ps-list).
  try {
    const procs = await psList()
    const nameHit = procs.some((p) => {
      const raw = basename(p.name ?? '').toLowerCase()
      if (exe && raw === exe) return true
      if (installBase.length >= 5 && canonName(raw).startsWith(installBase)) return true
      return false
    })
    if (nameHit) return true
  } catch {
    // sigue al refuerzo
  }

  // 2. Refuerzo por ruta de instalación (Windows).
  const install = game.installPath ? norm(game.installPath) : ''
  if (process.platform === 'win32' && install) {
    const paths = await listWindowsProcessPaths()
    if (paths.some((p) => p.startsWith(install))) return true
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

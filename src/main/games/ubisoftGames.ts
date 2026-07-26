import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, normalize } from 'node:path'

import type { Game } from './types'

/**
 * Detección de juegos de Ubisoft Connect (antes Uplay).
 *
 * Ubisoft Connect registra sus juegos instalados en el registro de Windows:
 *   HKLM\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs\<gameId>
 *     InstallDir = ruta de instalación
 *
 * De ahí sacamos el id (gameId), la ruta y el título (nombre de la carpeta). El
 * lanzamiento se hace con el protocolo uplay://launch/<gameId>/0 (ver
 * ubisoftLauncher). Sólo aplica en Windows.
 */

/** Claves del registro donde Ubisoft lista las instalaciones (32 y 64 bits). */
const INSTALLS_KEYS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
  'HKLM\\SOFTWARE\\Ubisoft\\Launcher\\Installs'
]

/** Normaliza separadores y quita la barra final (el registro usa "/"). */
function normalizeDir(dir: string): string {
  return normalize(dir.trim()).replace(/[\\/]+$/, '')
}

/** Ejecuta `reg query <key> /s` y devuelve stdout, o null si falla/no existe. */
function queryRegistry(key: string): string | null {
  try {
    const res = spawnSync('reg', ['query', key, '/s'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10_000
    })
    if (res.status !== 0 || !res.stdout) return null
    return res.stdout
  } catch {
    return null
  }
}

/**
 * Parsea la salida de `reg query .../Installs /s`. Cada subclave termina en
 * `\Installs\<gameId>` y trae una línea `InstallDir    REG_SZ    <ruta>`.
 */
function parseInstalls(output: string): Game[] {
  const games: Game[] = []
  const seen = new Set<string>()

  let currentId: string | null = null
  for (const line of output.split(/\r?\n/)) {
    const keyMatch = line.match(/\\Installs\\(\d+)\s*$/)
    if (keyMatch) {
      currentId = keyMatch[1]
      continue
    }

    const dirMatch = line.match(/^\s*InstallDir\s+REG_SZ\s+(.+?)\s*$/i)
    if (currentId && dirMatch) {
      const dir = normalizeDir(dirMatch[1])
      if (dir && existsSync(dir) && !seen.has(currentId)) {
        seen.add(currentId)
        games.push({
          id: currentId,
          title: basename(dir),
          installPath: dir,
          platform: 'ubisoft'
        })
      }
      currentId = null
    }
  }

  return games
}

/** Detecta los juegos instalados de Ubisoft Connect (sólo Windows). */
export function getUbisoftGames(): Game[] {
  if (process.platform !== 'win32') return []

  const byId = new Map<string, Game>()
  for (const key of INSTALLS_KEYS) {
    const output = queryRegistry(key)
    if (!output) continue
    for (const game of parseInstalls(output)) {
      if (!byId.has(game.id)) byId.set(game.id, game)
    }
  }

  return [...byId.values()]
}

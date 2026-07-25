import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse as parseVdf } from '@node-steam/vdf'

import type { Game } from './types'

/**
 * Detección de juegos de Steam.
 *
 * Flujo (según LAUNCHER_CONTEXT.md):
 *   1. Encontrar la instalación de Steam.
 *   2. Leer steamapps/libraryfolders.vdf para descubrir TODAS las librerías
 *      (el usuario puede tener juegos repartidos en varios discos).
 *   3. En cada librería, parsear steamapps/appmanifest_*.acf.
 *   4. Sólo devolver los que estén completamente instalados (StateFlags & 4).
 *
 * El código es cross-platform: en Windows usa las rutas reales; en macOS/Linux
 * usa las rutas de Steam de esas plataformas, de modo que la detección también
 * se pueda ejecutar durante el desarrollo.
 */

/** StateFlags es un bitfield; el bit 4 (StateFullyInstalled) indica instalado. */
const STATE_FULLY_INSTALLED = 4

/** Rutas candidatas donde puede vivir la carpeta raíz de Steam. */
function candidateSteamPaths(): string[] {
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam'
    ]
    const programFilesX86 = process.env['PROGRAMFILES(X86)']
    if (programFilesX86) paths.push(join(programFilesX86, 'Steam'))
    const programFiles = process.env['PROGRAMFILES']
    if (programFiles) paths.push(join(programFiles, 'Steam'))
    return paths
  }

  if (process.platform === 'darwin') {
    return [join(homedir(), 'Library', 'Application Support', 'Steam')]
  }

  // Linux (incluye SteamOS): varias convenciones habituales.
  return [
    join(homedir(), '.steam', 'steam'),
    join(homedir(), '.local', 'share', 'Steam'),
    join(homedir(), '.steam', 'root')
  ]
}

/** Devuelve la carpeta raíz de Steam, o null si no se encuentra. */
export function findSteamPath(overridePath?: string): string | null {
  const candidates = overridePath
    ? [overridePath, ...candidateSteamPaths()]
    : candidateSteamPaths()

  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, 'steamapps'))) return candidate
  }
  return null
}

/**
 * Lee libraryfolders.vdf y devuelve las rutas de todas las librerías Steam.
 * Incluye siempre la raíz de Steam como primera librería.
 */
function getLibraryFolders(steamPath: string): string[] {
  const libraries = new Set<string>([steamPath])

  const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  if (!existsSync(vdfPath)) return [...libraries]

  try {
    const parsed = parseVdf(readFileSync(vdfPath, 'utf-8')) as {
      libraryfolders?: Record<string, unknown>
    }
    const folders = parsed.libraryfolders ?? {}

    for (const value of Object.values(folders)) {
      // Formato moderno: { path: "...", apps: {...} }. Formato antiguo: "path".
      if (typeof value === 'string') {
        libraries.add(value)
      } else if (value && typeof value === 'object' && 'path' in value) {
        const path = (value as { path?: unknown }).path
        if (typeof path === 'string') libraries.add(path)
      }
    }
  } catch (err) {
    console.warn('[steam] No se pudo parsear libraryfolders.vdf:', err)
  }

  return [...libraries]
}

/** Parsea un único appmanifest_*.acf a un Game, o null si no es válido/instalado. */
function parseAcf(libraryPath: string, acfPath: string): Game | null {
  try {
    const parsed = parseVdf(readFileSync(acfPath, 'utf-8')) as {
      AppState?: {
        appid?: string
        name?: string
        installdir?: string
        StateFlags?: string
      }
    }
    const app = parsed.AppState
    if (!app?.appid || !app.name || !app.installdir) return null

    // Sólo juegos completamente instalados.
    const stateFlags = Number.parseInt(app.StateFlags ?? '0', 10)
    if ((stateFlags & STATE_FULLY_INSTALLED) !== STATE_FULLY_INSTALLED) return null

    const installPath = join(libraryPath, 'steamapps', 'common', app.installdir)

    return {
      id: app.appid,
      title: app.name,
      installPath,
      platform: 'steam'
      // executableName se resolverá en un paso posterior (monitoreo de proceso).
    }
  } catch (err) {
    console.warn(`[steam] No se pudo parsear ${acfPath}:`, err)
    return null
  }
}

/** Detecta todos los juegos de Steam instalados en todas las librerías. */
export function getSteamGames(overrideSteamPath?: string): Game[] {
  const steamPath = findSteamPath(overrideSteamPath)
  if (!steamPath) {
    console.info('[steam] Steam no encontrado; se omite la detección de Steam.')
    return []
  }

  const games: Game[] = []
  const seen = new Set<string>()

  for (const library of getLibraryFolders(steamPath)) {
    const steamappsDir = join(library, 'steamapps')
    if (!existsSync(steamappsDir)) continue

    let entries: string[]
    try {
      entries = readdirSync(steamappsDir)
    } catch (err) {
      console.warn(`[steam] No se pudo leer ${steamappsDir}:`, err)
      continue
    }

    for (const entry of entries) {
      if (!entry.startsWith('appmanifest_') || !entry.endsWith('.acf')) continue
      const game = parseAcf(library, join(steamappsDir, entry))
      if (game && !seen.has(game.id)) {
        seen.add(game.id)
        games.push(game)
      }
    }
  }

  return games
}

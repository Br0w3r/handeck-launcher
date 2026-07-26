import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { legendaryBin } from '../paths'
import type { Game } from './types'

/**
 * Detección de juegos de Epic Games.
 *
 * Se usan dos fuentes, en orden de preferencia:
 *   Opción B (preferida): legendary CLI — `legendary list-installed --json`.
 *   Opción A (fallback):  leer los manifests .item de Epic directamente.
 *
 * legendary es más confiable porque también nos da el ejecutable de lanzamiento
 * y el app_name que usaremos para verify/repair/launch en pasos posteriores.
 */

/** Ruta a los manifests del Epic Games Launcher oficial. */
function epicManifestsPath(): string {
  if (process.platform === 'win32') {
    const programData = process.env['PROGRAMDATA'] ?? 'C:\\ProgramData'
    return join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  }
  // En macOS/Linux el Epic Launcher oficial no existe; sólo aplica legendary.
  return ''
}

/** Config de legendary (~/.config/legendary), igual en Windows/macOS/Linux. */
function legendaryConfigDir(overridePath?: string): string {
  return overridePath ?? join(homedir(), '.config', 'legendary')
}

/** Ejecuta un comando de legendary y devuelve stdout, o null si falla. */
function runLegendary(args: string[], legendaryPath?: string): string | null {
  const bin = legendaryPath ?? legendaryBin()
  try {
    const result = spawnSync(bin, args, {
      encoding: 'utf-8',
      timeout: 30_000,
      windowsHide: true
    })
    if (result.error || result.status !== 0) return null
    return result.stdout
  } catch {
    return null
  }
}

/** ¿Está legendary disponible en el PATH (o en la ruta configurada)? */
export function isLegendaryInstalled(legendaryPath?: string): boolean {
  return runLegendary(['--version'], legendaryPath) !== null
}

/**
 * ¿Tiene legendary una cuenta de Epic vinculada?
 * Primero intenta `legendary status --json`; si no, revisa user.json en disco.
 */
export function isLegendaryAuthenticated(legendaryPath?: string): boolean {
  const statusJson = runLegendary(['status', '--json'], legendaryPath)
  if (statusJson) {
    try {
      const status = JSON.parse(statusJson) as { account?: string }
      if (status.account && status.account !== '<not logged in>') return true
    } catch {
      // cae al chequeo de archivo
    }
  }
  return existsSync(join(legendaryConfigDir(), 'user.json'))
}

interface LegendaryInstalledGame {
  app_name: string
  title: string
  install_path: string
  executable?: string
  version?: string
}

/** Detecta juegos vía `legendary list-installed --json`. */
function getGamesFromLegendary(legendaryPath?: string): Game[] {
  const stdout = runLegendary(['list-installed', '--json'], legendaryPath)
  if (!stdout) return []

  try {
    const data = JSON.parse(stdout) as LegendaryInstalledGame[]
    return data
      .filter((g) => g.app_name && g.title)
      .map((g) => ({
        id: g.app_name,
        title: g.title,
        installPath: g.install_path ?? '',
        platform: 'epic' as const,
        executableName: g.executable
      }))
  } catch (err) {
    console.warn('[epic] No se pudo parsear la salida de legendary:', err)
    return []
  }
}

interface EpicManifest {
  AppName?: string
  DisplayName?: string
  InstallLocation?: string
  LaunchExecutable?: string
  /** Categorías del artículo: los juegos reales incluyen "games". */
  AppCategories?: string[]
  /** Si es un contenido/DLC, apunta al juego padre (p.ej. Fortnite). */
  MainGameAppName?: string
  /** Versión/build instalado ahora mismo (para comparar con la última online). */
  AppVersionString?: string
  /** Namespace del catálogo (para construir el deep-link del Epic Launcher). */
  CatalogNamespace?: string
  /** Id del artículo del catálogo (para el deep-link). */
  CatalogItemId?: string
}

/**
 * Identificador para el deep-link del Epic Launcher: `namespace:catalogId:appName`
 * (formato actual del protocolo com.epicgames.launcher://apps/…). Devuelve null
 * si no se encuentra el juego o le faltan los ids de catálogo.
 */
export function getEpicAppLaunchId(appName: string): string | null {
  const manifestsDir = epicManifestsPath()
  if (!manifestsDir || !existsSync(manifestsDir)) return null

  let entries: string[]
  try {
    entries = readdirSync(manifestsDir)
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.endsWith('.item')) continue
    try {
      const manifest = JSON.parse(
        readFileSync(join(manifestsDir, entry), 'utf-8')
      ) as EpicManifest
      if (manifest.AppName !== appName) continue
      if (manifest.CatalogNamespace && manifest.CatalogItemId) {
        return `${manifest.CatalogNamespace}:${manifest.CatalogItemId}:${manifest.AppName}`
      }
      return null
    } catch {
      // siguiente
    }
  }

  return null
}

/**
 * Versión instalada de cada juego de Epic según sus manifests `.item`
 * (`AppVersionString`). Se compara con la última versión online (legendary info)
 * para saber si hay actualización pendiente. Mapa app_name → versión.
 */
export function getEpicInstalledVersions(): Map<string, string> {
  const versions = new Map<string, string>()
  const manifestsDir = epicManifestsPath()
  if (!manifestsDir || !existsSync(manifestsDir)) return versions

  let entries: string[]
  try {
    entries = readdirSync(manifestsDir)
  } catch {
    return versions
  }

  for (const entry of entries) {
    if (!entry.endsWith('.item')) continue
    try {
      const manifest = JSON.parse(
        readFileSync(join(manifestsDir, entry), 'utf-8')
      ) as EpicManifest
      if (!manifest.AppName || !isRealEpicGame(manifest)) continue
      if (manifest.AppVersionString) {
        versions.set(manifest.AppName, manifest.AppVersionString)
      }
    } catch {
      // Ignorar manifests corruptos.
    }
  }

  return versions
}

/**
 * ¿Este manifest es un juego "de verdad" y no basura?
 *
 * Epic mezcla en la misma carpeta de manifests:
 *  - Juegos reales     → AppCategories incluye "games" (GTA V, Fortnite, PUBG…).
 *  - Apps/software      → sólo "applications"/"software" (p.ej. Discord).
 *  - Contenido de un juego → AppCategories ["applications"] y MainGameAppName
 *    apuntando al padre (Fortnite_JunoContent, Fortnite_StWContent → "Fortnite").
 *
 * Nos quedamos sólo con los que son "games" y NO son contenido hijo de otro.
 */
function isRealEpicGame(manifest: EpicManifest): boolean {
  const categories = manifest.AppCategories ?? []
  if (!categories.includes('games')) return false
  // Excluir DLC/contenido que cuelga de un juego padre.
  const main = manifest.MainGameAppName
  if (main && main !== manifest.AppName) return false
  return true
}

/** Detecta juegos leyendo los manifests .item del Epic Games Launcher. */
function getGamesFromManifests(): Game[] {
  const manifestsDir = epicManifestsPath()
  if (!manifestsDir || !existsSync(manifestsDir)) return []

  const games: Game[] = []
  const seen = new Set<string>()

  let entries: string[]
  try {
    entries = readdirSync(manifestsDir)
  } catch (err) {
    console.warn(`[epic] No se pudo leer ${manifestsDir}:`, err)
    return []
  }

  for (const entry of entries) {
    if (!entry.endsWith('.item')) continue
    try {
      const manifest = JSON.parse(
        readFileSync(join(manifestsDir, entry), 'utf-8')
      ) as EpicManifest

      if (!manifest.AppName || !manifest.DisplayName) continue
      if (!isRealEpicGame(manifest)) continue
      if (seen.has(manifest.AppName)) continue
      seen.add(manifest.AppName)

      games.push({
        id: manifest.AppName,
        title: manifest.DisplayName,
        installPath: manifest.InstallLocation ?? '',
        platform: 'epic',
        executableName: manifest.LaunchExecutable
      })
    } catch (err) {
      console.warn(`[epic] No se pudo parsear el manifest ${entry}:`, err)
    }
  }

  return games
}

/**
 * Detecta todos los juegos de Epic instalados uniendo ambas fuentes:
 * legendary (da el ejecutable de lanzamiento) + los manifests del Epic Launcher.
 *
 * Se unen (no "una u otra") para que un estado PARCIAL de legendary — p.ej. sólo
 * algunos juegos importados — no oculte el resto que sólo conoce el Epic Launcher.
 * Se deduplica por app_name, dando prioridad a la entrada de legendary.
 */
export function getEpicGames(legendaryPath?: string): Game[] {
  const byId = new Map<string, Game>()

  if (isLegendaryInstalled(legendaryPath)) {
    for (const game of getGamesFromLegendary(legendaryPath)) {
      byId.set(game.id, game)
    }
  }

  for (const game of getGamesFromManifests()) {
    if (!byId.has(game.id)) byId.set(game.id, game)
  }

  const games = [...byId.values()]
  if (games.length === 0) {
    console.info(
      '[epic] Sin juegos de Epic detectados (¿Epic Launcher o legendary con sesión?).'
    )
  }
  return games
}

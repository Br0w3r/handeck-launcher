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
 * Detecta todos los juegos de Epic instalados.
 * Prefiere legendary; si no está disponible, cae a los manifests oficiales.
 */
export function getEpicGames(legendaryPath?: string): Game[] {
  if (isLegendaryInstalled(legendaryPath)) {
    const games = getGamesFromLegendary(legendaryPath)
    if (games.length > 0) return games
  }

  const manifestGames = getGamesFromManifests()
  if (manifestGames.length === 0) {
    console.info(
      '[epic] Sin juegos de Epic detectados (¿legendary instalado y autenticado?).'
    )
  }
  return manifestGames
}

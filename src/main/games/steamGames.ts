import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse as parseVdf } from '@node-steam/vdf'

import type { Game, UpdateInfo, UpdatePhase, UpdateState } from './types'

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

/**
 * Appids de Steam que NO son juegos: redistribuibles, runtimes y capas de
 * compatibilidad que Steam instala en `steamapps/common` como si fueran apps.
 * Se excluyen de la biblioteca para no ensuciarla (p.ej. "Steamworks Common
 * Redistributables"). Lista de los más habituales.
 */
const STEAM_NON_GAME_APPIDS = new Set<string>([
  '228980', // Steamworks Common Redistributables
  '1070560', // Steam Linux Runtime 1.0 (scout)
  '1391110', // Steam Linux Runtime 2.0 (soldier)
  '1628350', // Steam Linux Runtime 3.0 (sniper)
  '1493710', // Proton Experimental
  '2180100', // Proton Hotfix
  '1887720', // Proton 7.0
  '2348590', // Proton 8.0
  '2805730', // Proton 9.0
  '2230260' //  Proton 10 / EA anti-cheat runtime (varía)
])

/** StateFlags es un bitfield; el bit 4 (StateFullyInstalled) indica instalado. */
const STATE_FULLY_INSTALLED = 4

/** El bit 2 (StateUpdateRequired) indica que hay una actualización pendiente. */
const STATE_UPDATE_REQUIRED = 2
/** El bit 512 (StateUpdatePaused) indica una actualización en cola pero pausada. */
const STATE_UPDATE_PAUSED = 512

/**
 * Bits de StateFlags que indican que Steam está trabajando activamente en la
 * actualización (descargando, validando, aplicando, etc.). Cualquiera de ellos
 * = 'updating'.
 */
const STATE_UPDATE_ACTIVE =
  256 | // UpdateRunning
  1024 | // UpdateStarted
  65536 | // Reconfiguring
  131072 | // Validating
  262144 | // AddingFiles
  524288 | // Preallocating
  1048576 | // Downloading
  2097152 | // Staging
  4194304 // Committing

/** El bit 131072 (StateValidating) indica verificación de archivos en curso. */
const STATE_VALIDATING = 131072

/** Campos de bytes de un appmanifest usados para calcular el progreso real. */
interface UpdateBytes {
  bytesDownloaded: number
  bytesToDownload: number
  bytesStaged: number
  bytesToStage: number
}

/** Fracción 0–1 segura (evita divisiones por cero y desbordes). */
function fraction(done: number, total: number): number | undefined {
  if (total <= 0) return undefined
  return Math.min(1, Math.max(0, done / total))
}

/**
 * Deriva el estado de actualización a partir de los campos del appmanifest.
 *
 * Steam muestra el progreso de la FASE activa, no del total: primero descarga
 * (BytesDownloaded/BytesToDownload) y luego aplica el parche a disco
 * (BytesStaged/BytesToStage). Por eso, cuando la descarga ya está al 100% pero
 * el parche va por la mitad, Steam muestra ese ~50% de "Aplicando parche".
 * Replicamos esa lógica por fases para que el % coincida con Steam.
 */
function computeUpdate(
  stateFlags: number,
  bytes: UpdateBytes,
  scheduledAutoUpdate: number
): UpdateInfo {
  if ((stateFlags & STATE_UPDATE_ACTIVE) !== 0) {
    const { bytesDownloaded, bytesToDownload, bytesStaged, bytesToStage } = bytes
    const downloadDone = bytesToDownload > 0 && bytesDownloaded >= bytesToDownload

    // 1) Descargando: aún faltan datos por bajar.
    if (bytesToDownload > 0 && !downloadDone) {
      return {
        updateState: 'updating',
        updatePhase: 'downloading',
        updateProgress: fraction(bytesDownloaded, bytesToDownload)
      }
    }

    // 2) Aplicando parche: descarga completa (o sin descarga) pero staging en curso.
    if (bytesToStage > 0 && bytesStaged < bytesToStage) {
      const phase: UpdatePhase =
        (stateFlags & STATE_VALIDATING) !== 0 ? 'verifying' : 'staging'
      return {
        updateState: 'updating',
        updatePhase: phase,
        updateProgress: fraction(bytesStaged, bytesToStage)
      }
    }

    // 3) Verificando sin bytes de staging claros (validación pura).
    if ((stateFlags & STATE_VALIDATING) !== 0) {
      return { updateState: 'updating', updatePhase: 'verifying' }
    }

    // 4) Activo pero sin progreso reportable todavía (preasignando, etc.).
    return { updateState: 'updating' }
  }

  const pending: UpdateState = 'update-pending'
  if (
    (stateFlags & STATE_UPDATE_REQUIRED) !== 0 ||
    (stateFlags & STATE_UPDATE_PAUSED) !== 0 ||
    scheduledAutoUpdate > 0
  ) {
    return { updateState: pending }
  }

  return { updateState: 'ready' }
}

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

/**
 * ¿Steam está trabajando AHORA en la descarga/parche de este appid?
 *
 * Señal clave: mientras Steam prepara/valida/descarga una actualización crea la
 * carpeta `steamapps/downloading/<appid>/` (y escribe ahí los `depot_*.delta`).
 * Esto aparece ANTES de que Steam reescriba el `StateFlags` del appmanifest —
 * que durante la fase de "Validando" se queda en 6 (pendiente). Por eso la
 * detectamos aparte: así el launcher muestra "Actualizando" en cuanto Steam
 * empieza, sin quedarse pegado en "pendiente".
 */
function isDownloadingOnDisk(libraryPath: string, appid: string): boolean {
  return existsSync(join(libraryPath, 'steamapps', 'downloading', appid))
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
        BytesDownloaded?: string
        BytesToDownload?: string
        BytesStaged?: string
        BytesToStage?: string
        ScheduledAutoUpdate?: string
      }
    }
    const app = parsed.AppState
    if (!app?.appid || !app.name || !app.installdir) return null

    // @node-steam/vdf parsea los valores numéricos como number; normalizamos el
    // appid a string para usarlo en rutas, en el Set de denylist y como id.
    const appid = String(app.appid)

    // Excluir redistribuibles/runtimes que no son juegos.
    if (STEAM_NON_GAME_APPIDS.has(appid)) return null

    // Sólo juegos completamente instalados. (Durante una actualización de un
    // juego ya instalado, Steam mantiene el bit StateFullyInstalled, así que
    // estos siguen apareciendo con su estado de actualización.)
    const stateFlags = Number.parseInt(app.StateFlags ?? '0', 10)
    if ((stateFlags & STATE_FULLY_INSTALLED) !== STATE_FULLY_INSTALLED) return null

    const num = (v: string | undefined): number => Number.parseInt(v ?? '0', 10) || 0
    const scheduledAutoUpdate = num(app.ScheduledAutoUpdate)
    let { updateState, updateProgress, updatePhase } = computeUpdate(
      stateFlags,
      {
        bytesDownloaded: num(app.BytesDownloaded),
        bytesToDownload: num(app.BytesToDownload),
        bytesStaged: num(app.BytesStaged),
        bytesToStage: num(app.BytesToStage)
      },
      scheduledAutoUpdate
    )

    // El appmanifest va atrasado durante la fase de validación/preparación
    // (StateFlags sigue en "pendiente"), pero Steam ya está trabajando: si existe
    // la carpeta downloading/<appid>, lo marcamos como "actualizando" de inmediato.
    if (updateState !== 'updating' && isDownloadingOnDisk(libraryPath, appid)) {
      updateState = 'updating'
      updateProgress = undefined
      updatePhase = undefined
    }

    const installPath = join(libraryPath, 'steamapps', 'common', String(app.installdir))

    return {
      id: appid,
      title: String(app.name),
      installPath,
      platform: 'steam',
      updateState,
      updateProgress,
      updatePhase
      // executableName se resolverá en un paso posterior (monitoreo de proceso).
    }
  } catch (err) {
    console.warn(`[steam] No se pudo parsear ${acfPath}:`, err)
    return null
  }
}

/**
 * Devuelve las carpetas `steamapps` de todas las librerías Steam (donde viven
 * los appmanifest_*.acf). Se usa para observarlas con fs.watch y reflejar las
 * actualizaciones en vivo.
 */
export function getSteamappsDirs(overrideSteamPath?: string): string[] {
  const steamPath = findSteamPath(overrideSteamPath)
  if (!steamPath) return []
  return getLibraryFolders(steamPath)
    .map((library) => join(library, 'steamapps'))
    .filter((dir) => existsSync(dir))
}

/**
 * Carpetas `steamapps/downloading` existentes (una por librería). Steam escribe
 * ahí mientras descarga/parchea; observarlas permite reflejar el arranque de una
 * actualización antes de que el appmanifest se actualice. Sólo devuelve las que
 * existen ahora mismo (Steam las crea/borra bajo demanda).
 */
export function getSteamDownloadingDirs(overrideSteamPath?: string): string[] {
  return getSteamappsDirs(overrideSteamPath)
    .map((steamapps) => join(steamapps, 'downloading'))
    .filter((dir) => existsSync(dir))
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

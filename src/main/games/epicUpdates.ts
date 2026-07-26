import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { legendaryBin } from '../paths'
import { getEpicInstalledVersions } from './epicGames'
import type { UpdateInfo } from './types'

/**
 * Detección de actualizaciones pendientes de Epic Games.
 *
 * Epic no deja ninguna señal en disco de "hay update" (los manifests sólo traen
 * la versión INSTALADA). La solución fiable y ligera:
 *   1. Versión instalada  → AppVersionString del manifest .item (en disco).
 *   2. Versión más reciente → `legendary info <app> --json` → game.version.
 *      Sólo descarga metadata (rápido); NO instala ni verifica (a diferencia de
 *      `legendary import`, que además da falsos "al día").
 *   3. Si difieren → actualización pendiente.
 *
 * Requiere legendary con sesión de Epic. Los juegos que legendary no puede
 * resolver en la cuenta (devuelven versión null) se dejan sin marcar (se
 * desconoce, mejor que mentir).
 *
 * El resultado se cachea en memoria y se refresca en segundo plano (es una
 * llamada de red por juego), no en el camino caliente del watcher.
 */

const execFileAsync = promisify(execFile)

/** Cache `epic:<app_name>` → UpdateInfo (sólo entradas con update pendiente). */
let cache: Record<string, UpdateInfo> = {}
let running = false

/** Estado cacheado de updates de Epic, para fusionar en getUpdateStates(). */
export function getEpicUpdateCache(): Record<string, UpdateInfo> {
  return cache
}

/** Última versión online de un juego vía `legendary info`, o null si no resuelve. */
async function fetchLatestVersion(appName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      legendaryBin(),
      ['info', appName, '--json'],
      { timeout: 30_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
    )
    const data = JSON.parse(stdout) as { game?: { version?: string } }
    return data.game?.version ?? null
  } catch {
    return null
  }
}

/**
 * Recalcula el estado de updates de Epic comparando versión instalada vs online.
 * Al terminar, invoca onChange (para que el main empuje el estado al renderer).
 * Reentrante-seguro: si ya hay un refresco en curso, no arranca otro.
 */
export async function refreshEpicUpdates(onChange?: () => void): Promise<void> {
  if (running) return
  running = true
  try {
    const installed = [...getEpicInstalledVersions().entries()]

    // Consultas en paralelo (una llamada de red por juego): el tiempo total pasa
    // de la suma a la más lenta.
    const results = await Promise.all(
      installed.map(async ([appName, installedVersion]) => ({
        appName,
        installedVersion,
        latest: await fetchLatestVersion(appName)
      }))
    )

    const next: Record<string, UpdateInfo> = {}
    for (const { appName, installedVersion, latest } of results) {
      if (latest && installedVersion && latest !== installedVersion) {
        next[`epic:${appName}`] = { updateState: 'update-pending' }
      }
    }

    cache = next
    onChange?.()
  } catch (err) {
    console.warn('[epic-updates] No se pudo refrescar el estado de Epic:', err)
  } finally {
    running = false
  }
}

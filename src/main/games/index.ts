import { getEpicGames, isLegendaryAuthenticated, isLegendaryInstalled } from './epicGames'
import { getEpicUpdateCache } from './epicUpdates'
import { getSteamGames } from './steamGames'
import type { Game, UpdateInfo } from './types'
import { getUbisoftGames } from './ubisoftGames'

export type {
  Game,
  Platform,
  LaunchStatus,
  LaunchProgress,
  ArtworkUrls,
  UpdateState,
  UpdatePhase,
  UpdateInfo
} from './types'
export { getSteamGames } from './steamGames'
export {
  getEpicGames,
  getEpicAppLaunchId,
  isLegendaryInstalled,
  isLegendaryAuthenticated
} from './epicGames'
export { refreshEpicUpdates } from './epicUpdates'

export interface GameDetectionResult {
  games: Game[]
  legendaryInstalled: boolean
  legendaryAuthenticated: boolean
}

/**
 * Detecta la biblioteca completa combinando Steam + Epic.
 * Cada fuente está aislada: si una falla, la otra sigue devolviendo resultados.
 */
export function getAllGames(): Game[] {
  let steam: Game[] = []
  let epic: Game[] = []
  let ubisoft: Game[] = []

  try {
    steam = getSteamGames()
  } catch (err) {
    console.error('[games] Falló la detección de Steam:', err)
  }

  try {
    epic = getEpicGames()
  } catch (err) {
    console.error('[games] Falló la detección de Epic:', err)
  }

  try {
    ubisoft = getUbisoftGames()
  } catch (err) {
    console.error('[games] Falló la detección de Ubisoft:', err)
  }

  return [...steam, ...epic, ...ubisoft].sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Reescanea sólo el estado de actualización de los juegos (barato: relee los
 * appmanifest_*.acf de Steam, sin red ni artwork). Pensado para hacer polling
 * desde el renderer y reflejar en vivo las descargas, como una consola.
 *
 * Steam se recalcula en cada llamada (relee los .acf, barato). Epic es una
 * llamada de red por juego, así que se lee de una cache que se refresca aparte
 * en segundo plano (ver refreshEpicUpdates); aquí sólo se fusiona lo cacheado.
 *
 * Devuelve un mapa `${platform}:${id}` → UpdateInfo.
 */
export function getUpdateStates(): Record<string, UpdateInfo> {
  const states: Record<string, UpdateInfo> = {}

  let steam: Game[] = []
  try {
    steam = getSteamGames()
  } catch (err) {
    console.error('[games] Falló el escaneo de estado de actualización de Steam:', err)
  }

  for (const game of steam) {
    states[`${game.platform}:${game.id}`] = {
      updateState: game.updateState ?? 'ready',
      updateProgress: game.updateProgress,
      updatePhase: game.updatePhase
    }
  }

  // Fusiona el estado de updates de Epic (cacheado; refrescado en segundo plano).
  return { ...states, ...getEpicUpdateCache() }
}

/** Igual que getAllGames pero incluye el estado de legendary para la UI/avisos. */
export function detectGames(): GameDetectionResult {
  const legendaryInstalled = isLegendaryInstalled()
  return {
    games: getAllGames(),
    legendaryInstalled,
    legendaryAuthenticated: legendaryInstalled ? isLegendaryAuthenticated() : false
  }
}

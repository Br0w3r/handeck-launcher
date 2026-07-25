import { getEpicGames, isLegendaryAuthenticated, isLegendaryInstalled } from './epicGames'
import { getSteamGames } from './steamGames'
import type { Game } from './types'

export type { Game, Platform, LaunchStatus, LaunchProgress, ArtworkUrls } from './types'
export { getSteamGames } from './steamGames'
export { getEpicGames, isLegendaryInstalled, isLegendaryAuthenticated } from './epicGames'

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

  return [...steam, ...epic].sort((a, b) => a.title.localeCompare(b.title))
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

import { ipcMain } from 'electron'

import { artworkKey, cacheImage } from '../artwork/artworkCache'
import { hasApiKey, resolveArtwork } from '../artwork/steamGridDB'
import { getAllGames, isLegendaryAuthenticated, isLegendaryInstalled } from '../games'
import type { ArtworkUrls, Game } from '../games'
import { startGameLifecycle } from '../gameMonitor'
import { cancelLaunch, launchGame } from '../launcher'
import { getStore } from '../store'

/**
 * Registro central de todos los ipcMain.handle().
 *
 * PASO 4: se añade artwork:get. Los canales de lanzamiento (games:launch,
 * games:cancel-launch) se añaden en el Paso 6.
 */
export function registerIpcHandlers(): void {
  // renderer → main (invoke). Devuelve la biblioteca combinada Steam + Epic.
  ipcMain.handle('games:get-all', (): Game[] => getAllGames())

  // ¿legendary está instalado Y con una cuenta de Epic vinculada?
  ipcMain.handle('legendary:is-authenticated', (): boolean => {
    return isLegendaryInstalled() && isLegendaryAuthenticated()
  })

  // Artwork de un juego: resuelve (con cache en store) → descarga a disco →
  // devuelve URLs del protocolo custom handeck-art://. Sin API key devuelve nulls.
  ipcMain.handle('artwork:get', async (_e, game: Game): Promise<ArtworkUrls> => {
    if (!hasApiKey()) return { grid: null, hero: null }

    const store = getStore()
    const gameKey = `${game.platform}:${game.id}`

    // 1. Resolver URLs remotas (cacheadas en el store para no repetir llamadas).
    const resolvedMap = store.get('artworkResolved')
    let resolved = resolvedMap[gameKey]
    if (!resolved) {
      resolved = await resolveArtwork(game)
      store.set('artworkResolved', { ...resolvedMap, [gameKey]: resolved })
    }

    // 2. Descargar a la cache local y devolver URLs del protocolo custom.
    const hash = artworkKey(game)
    const out: ArtworkUrls = { grid: null, hero: null }

    if (resolved.grid) {
      const path = await cacheImage(hash, 'grid', resolved.grid)
      if (path) out.grid = `handeck-art://${hash}/grid`
    }
    if (resolved.hero) {
      const path = await cacheImage(hash, 'hero', resolved.hero)
      if (path) out.hero = `handeck-art://${hash}/hero`
    }

    return out
  })

  // Inicia el flujo verify + launch; el progreso se emite por launch:status-update.
  // Si el juego llega a lanzarse, arranca el ciclo de vida (destruir ventana →
  // monitorear proceso → recrear al cerrar).
  ipcMain.handle('games:launch', async (e, game: Game): Promise<void> => {
    const launched = await launchGame(game, (progress) => {
      if (!e.sender.isDestroyed()) {
        e.sender.send('launch:status-update', { gameId: game.id, ...progress })
      }
    })
    if (launched) void startGameLifecycle(game)
  })

  // Cancela el lanzamiento en curso.
  ipcMain.handle('games:cancel-launch', (): void => cancelLaunch())
}

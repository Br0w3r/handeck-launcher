import { ipcMain, shell } from 'electron'

import { artworkKey, cacheImage } from '../artwork/artworkCache'
import { hasApiKey, resolveArtwork } from '../artwork/steamGridDB'
import {
  authCode,
  authImport,
  getEpicStatus,
  logout,
  type AuthResult,
  type EpicStatus
} from '../epicAuth'
import { interactiveEpicLogin } from '../epicLogin'
import {
  getAllGames,
  getEpicAppLaunchId,
  getUpdateStates,
  isLegendaryAuthenticated,
  isLegendaryInstalled,
  refreshEpicUpdates
} from '../games'
import type { ArtworkUrls, Game, UpdateInfo } from '../games'
import { startGameLifecycle } from '../gameMonitor'
import { cancelLaunch, launchGame } from '../launcher'
import { getStore } from '../store'
import { checkForUpdates, downloadUpdate, quitAndInstall } from '../updater'
import { pushUpdateStates } from '../updateWatcher'

/**
 * Acciones de gestión que delegamos al cliente de Steam vía el protocolo
 * steam:// (Steam no expone pausa/reanudar por API, pero sí estas):
 *  - 'update'    → steam://install/<id>   inicia/prioriza la actualización (Steam
 *                  pausa automáticamente la que estuviera descargando).
 *  - 'validate'  → steam://validate/<id>  verifica los archivos del juego.
 *  - 'downloads' → steam://open/downloads gestor de descargas (pausar/reordenar).
 *  - 'store'     → steam://store/<id>     ficha del juego en la tienda.
 */
export type SteamAction = 'update' | 'validate' | 'downloads' | 'store'

/** Subconjunto de la config expuesto a la UI de Ajustes. */
export interface AppSettings {
  /** Vacío = usando la key por defecto del launcher. */
  steamGridDbApiKey: string
  verifyOnLaunch: boolean
  checkUpdatesOnLaunch: boolean
}

/**
 * Registro central de todos los ipcMain.handle().
 *
 * PASO 4: se añade artwork:get. Los canales de lanzamiento (games:launch,
 * games:cancel-launch) se añaden en el Paso 6.
 */
export function registerIpcHandlers(): void {
  // renderer → main (invoke). Devuelve la biblioteca combinada Steam + Epic.
  ipcMain.handle('games:get-all', (): Game[] => getAllGames())

  // Estado de actualización por juego (barato; se hace polling desde la UI para
  // reflejar descargas en vivo). Mapa `${platform}:${id}` → UpdateInfo.
  ipcMain.handle('games:get-update-states', (): Record<string, UpdateInfo> =>
    getUpdateStates()
  )

  // Acción de gestión sobre un juego de Steam mediante el protocolo steam://.
  // (Steam no permite pausar/reanudar por API; estas son las vías soportadas.)
  ipcMain.handle('steam:action', (_e, action: SteamAction, appId?: string): void => {
    let url: string | null = null
    switch (action) {
      case 'downloads':
        url = 'steam://open/downloads'
        break
      case 'update':
        url = appId ? `steam://install/${appId}` : null
        break
      case 'validate':
        url = appId ? `steam://validate/${appId}` : null
        break
      case 'store':
        url = appId ? `steam://store/${appId}` : null
        break
    }
    if (url) void shell.openExternal(url)
  })

  // Acción sobre un juego de Epic o Ubisoft: abre su launcher nativo (para
  // actualizar/gestionar). Steam usa steam:action; esto cubre las otras tiendas.
  ipcMain.handle(
    'store:open-game',
    (_e, platform: 'epic' | 'ubisoft', id: string): void => {
      let url: string | null = null
      if (platform === 'epic') {
        const launchId = getEpicAppLaunchId(id) ?? id
        url = `com.epicgames.launcher://apps/${launchId}?action=launch`
      } else if (platform === 'ubisoft') {
        url = `uplay://launch/${id}/0`
      }
      if (url) void shell.openExternal(url)
    }
  )

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

  // ── Autenticación de Epic (Ajustes → Cuenta Epic) ──────────────────────────

  // Estado detallado: instalado, autenticado y cuenta vinculada.
  ipcMain.handle('epic:status', (): Promise<EpicStatus> => getEpicStatus())

  // Tras conectar la cuenta de Epic, dispara una comprobación de updates de Epic
  // (en segundo plano) para que los badges aparezcan sin esperar al intervalo.
  const afterEpicConnect = (result: AuthResult): AuthResult => {
    if (result.ok) void refreshEpicUpdates(pushUpdateStates)
    return result
  }

  // Importa la sesión del Epic Games Launcher oficial (cero fricción).
  ipcMain.handle('epic:auth-import', async (): Promise<AuthResult> =>
    afterEpicConnect(await authImport())
  )

  // Login interactivo: abre Epic en una ventana propia y captura el código solo.
  ipcMain.handle('epic:login', async (): Promise<AuthResult> =>
    afterEpicConnect(await interactiveEpicLogin())
  )

  // Login manual (fallback): authorizationCode pegado por el usuario.
  ipcMain.handle('epic:auth-code', (_e, code: string): Promise<AuthResult> => authCode(code))

  // Cierra la sesión de Epic.
  ipcMain.handle('epic:logout', (): Promise<AuthResult> => logout())

  // ── Ajustes generales ──────────────────────────────────────────────────────

  ipcMain.handle('settings:get', (): AppSettings => {
    const store = getStore()
    return {
      steamGridDbApiKey: store.get('steamGridDbApiKey'),
      verifyOnLaunch: store.get('verifyOnLaunch'),
      checkUpdatesOnLaunch: store.get('checkUpdatesOnLaunch')
    }
  })

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>): AppSettings => {
    const store = getStore()
    if (typeof patch.steamGridDbApiKey === 'string') {
      store.set('steamGridDbApiKey', patch.steamGridDbApiKey.trim())
    }
    if (typeof patch.verifyOnLaunch === 'boolean') {
      store.set('verifyOnLaunch', patch.verifyOnLaunch)
    }
    if (typeof patch.checkUpdatesOnLaunch === 'boolean') {
      store.set('checkUpdatesOnLaunch', patch.checkUpdatesOnLaunch)
    }
    return {
      steamGridDbApiKey: store.get('steamGridDbApiKey'),
      verifyOnLaunch: store.get('verifyOnLaunch'),
      checkUpdatesOnLaunch: store.get('checkUpdatesOnLaunch')
    }
  })

  // ── Auto-actualización del launcher (electron-updater) ──────────────────────
  ipcMain.handle('app-update:check', (): void => checkForUpdates())
  ipcMain.handle('app-update:download', (): void => downloadUpdate())
  ipcMain.handle('app-update:install', (): void => quitAndInstall())
}

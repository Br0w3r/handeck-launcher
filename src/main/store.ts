import Store from 'electron-store'

import type { ArtworkUrls } from './games/types'

/**
 * Configuración persistente (electron-store).
 *
 * Se inicializa de forma perezosa: el constructor de electron-store llama a
 * app.getPath('userData'), que sólo está disponible cuando la app está lista.
 */
export interface StoreSchema {
  /** API key de SteamGridDB (también se puede pasar por STEAMGRIDDB_API_KEY). */
  steamGridDbApiKey: string
  /** Cache de la resolución de artwork por juego: `${platform}:${id}` → URLs remotas. */
  artworkResolved: Record<string, ArtworkUrls>
  /** Preferencias generales (documento LAUNCHER_CONTEXT.md). */
  lastPlayedGameId: string
  gamepadDeadzone: number
  verifyOnLaunch: boolean
  checkUpdatesOnLaunch: boolean
}

const DEFAULTS: StoreSchema = {
  steamGridDbApiKey: '',
  artworkResolved: {},
  lastPlayedGameId: '',
  gamepadDeadzone: 0.5,
  verifyOnLaunch: true,
  checkUpdatesOnLaunch: true
}

let instance: Store<StoreSchema> | null = null

export function getStore(): Store<StoreSchema> {
  if (!instance) {
    instance = new Store<StoreSchema>({ defaults: DEFAULTS })
  }
  return instance
}

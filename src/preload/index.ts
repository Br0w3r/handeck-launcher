import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type { ArtworkUrls, Game, LaunchProgress } from '../main/games/types'

/**
 * Preload: puente seguro entre el renderer (React) y el main process.
 *
 * PASO 2: se expone `window.handeck` con los canales de lectura de la
 * biblioteca. Los métodos de lanzamiento y sus eventos (launch:status-update,
 * game:closed) se añaden en pasos posteriores.
 */
const api = {
  /** Biblioteca combinada Steam + Epic (games:get-all). */
  getGames: (): Promise<Game[]> => ipcRenderer.invoke('games:get-all'),

  /** ¿legendary instalado y con cuenta de Epic vinculada? */
  isLegendaryAuthenticated: (): Promise<boolean> =>
    ipcRenderer.invoke('legendary:is-authenticated'),

  /** Artwork (grid + hero) de un juego. URLs handeck-art:// o null. */
  getArtwork: (game: Game): Promise<ArtworkUrls> =>
    ipcRenderer.invoke('artwork:get', game),

  /** Inicia el flujo verify + launch de un juego. */
  launchGame: (game: Game): Promise<void> => ipcRenderer.invoke('games:launch', game),

  /** Cancela el lanzamiento en curso. */
  cancelLaunch: (): Promise<void> => ipcRenderer.invoke('games:cancel-launch'),

  /** Suscribe a los cambios de estado del lanzamiento. Devuelve una función
   *  para desuscribirse. */
  onLaunchStatus: (callback: (progress: LaunchProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, progress: LaunchProgress): void =>
      callback(progress)
    ipcRenderer.on('launch:status-update', listener)
    return () => ipcRenderer.removeListener('launch:status-update', listener)
  },

  /** Se dispara cuando el juego se cierra y el launcher vuelve. */
  onGameClosed: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('game:closed', listener)
    return () => ipcRenderer.removeListener('game:closed', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('handeck', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (contextIsolation deshabilitado — sólo fallback de desarrollo)
  window.handeck = api
}

export type HandeckApi = typeof api
export type {
  Game,
  Platform,
  LaunchStatus,
  LaunchProgress,
  ArtworkUrls
} from '../main/games/types'

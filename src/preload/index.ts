import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type { AuthResult, EpicStatus } from '../main/epicAuth'
import type { AppSettings, SteamAction } from '../main/ipc/handlers'
import type { ArtworkUrls, Game, LaunchProgress, UpdateInfo } from '../main/games/types'

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

  /** Estado de actualización por juego. Mapa `${platform}:${id}` → UpdateInfo. */
  getUpdateStates: (): Promise<Record<string, UpdateInfo>> =>
    ipcRenderer.invoke('games:get-update-states'),

  /** Empuje del main (fs.watch) cuando cambia el estado de actualización de
   *  Steam. Devuelve una función para desuscribirse. */
  onUpdateStates: (
    callback: (states: Record<string, UpdateInfo>) => void
  ): (() => void) => {
    const listener = (
      _e: IpcRendererEvent,
      states: Record<string, UpdateInfo>
    ): void => callback(states)
    ipcRenderer.on('update-states:changed', listener)
    return () => ipcRenderer.removeListener('update-states:changed', listener)
  },

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

  /** Acción de gestión de Steam (actualizar/verificar/descargas) vía steam://. */
  steamAction: (action: SteamAction, appId?: string): Promise<void> =>
    ipcRenderer.invoke('steam:action', action, appId),

  /** Abre un juego de Epic/Ubisoft en su launcher nativo (para actualizar/gestionar). */
  openStoreGame: (platform: 'epic' | 'ubisoft', id: string): Promise<void> =>
    ipcRenderer.invoke('store:open-game', platform, id),

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
  },

  // ── Cuenta Epic (Ajustes) ──────────────────────────────────────────────────

  /** Estado detallado de Epic: instalado, autenticado y cuenta. */
  getEpicStatus: (): Promise<EpicStatus> => ipcRenderer.invoke('epic:status'),

  /** Importa la sesión del Epic Games Launcher oficial. */
  epicAuthImport: (): Promise<AuthResult> => ipcRenderer.invoke('epic:auth-import'),

  /** Login interactivo: abre Epic en una ventana y captura el código solo. */
  epicLogin: (): Promise<AuthResult> => ipcRenderer.invoke('epic:login'),

  /** Login manual (fallback) con el authorizationCode pegado. */
  epicAuthCode: (code: string): Promise<AuthResult> =>
    ipcRenderer.invoke('epic:auth-code', code),

  /** Cierra la sesión de Epic. */
  epicLogout: (): Promise<AuthResult> => ipcRenderer.invoke('epic:logout'),

  // ── Ajustes generales ───────────────────────────────────────────────────────

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),

  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch)
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
  ArtworkUrls,
  UpdateState,
  UpdatePhase,
  UpdateInfo
} from '../main/games/types'
export type { AuthResult, EpicStatus } from '../main/epicAuth'
export type { AppSettings, SteamAction } from '../main/ipc/handlers'

import type { HandeckApi } from './index'

// Re-export de los tipos compartidos para que el renderer los consuma desde una
// ruta estable (`../../preload`) sin cruzar directamente a src/main.
export type {
  Game,
  Platform,
  LaunchStatus,
  LaunchProgress,
  ArtworkUrls,
  UpdateState,
  UpdatePhase,
  UpdateInfo,
  HandeckApi,
  AuthResult,
  EpicStatus,
  AppSettings,
  SteamAction
} from './index'

declare global {
  interface Window {
    handeck: HandeckApi
  }
}

export {}

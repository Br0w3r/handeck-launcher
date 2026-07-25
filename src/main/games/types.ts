// Tipos compartidos por todo el main process para representar juegos y su estado.

export type Platform = 'steam' | 'epic'

/**
 * Estados del ciclo de verificación + lanzamiento que el main emite al renderer.
 * (Se usan de lleno a partir del Paso 6, se declaran aquí para tener una única
 * fuente de verdad.)
 */
export type LaunchStatus =
  | 'idle'
  | 'checking-updates'
  | 'updating'
  | 'verifying'
  | 'repairing'
  | 'launching'
  | 'running'
  | 'error'

/** Evento de progreso del flujo de lanzamiento que el main envía al renderer. */
export interface LaunchProgress {
  /** id del juego que se está lanzando (para descartar eventos obsoletos). */
  gameId: string
  status: LaunchStatus
  message?: string
  /** Mensaje de error cuando status === 'error'. */
  error?: string
}

/** URLs de artwork listas para consumir en el renderer (grid vertical + hero). */
export interface ArtworkUrls {
  /** Portada vertical tipo PS5. */
  grid: string | null
  /** Imagen hero (fondo del juego seleccionado). */
  hero: string | null
}

/** Representación unificada de un juego, independiente de la plataforma. */
export interface Game {
  /** appid de Steam o app_name de legendary/Epic. */
  id: string
  title: string
  installPath: string
  platform: Platform
  /** Nombre del ejecutable, usado luego para monitorear el proceso con ps-list. */
  executableName?: string
}

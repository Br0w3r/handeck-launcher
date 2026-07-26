// Tipos compartidos por todo el main process para representar juegos y su estado.

export type Platform = 'steam' | 'epic' | 'ubisoft'

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

/**
 * Estado de actualización de un juego (por ahora, sólo Steam).
 *  - 'ready'          → instalado y al día.
 *  - 'update-pending' → hay una actualización en cola / requerida / pausada.
 *  - 'updating'       → Steam está descargando/instalando la actualización ahora.
 */
export type UpdateState = 'ready' | 'update-pending' | 'updating'

/**
 * Fase concreta de una actualización en curso (para mostrar el % correcto y una
 * etiqueta como en una consola):
 *  - 'downloading' → descargando datos.
 *  - 'staging'     → aplicando el parche a disco (Steam: "Aplicando parche").
 *  - 'verifying'   → verificando/validando archivos.
 */
export type UpdatePhase = 'downloading' | 'staging' | 'verifying'

/** Estado de actualización + progreso, para pintar el badge en la UI. */
export interface UpdateInfo {
  updateState: UpdateState
  /** Progreso 0–1 de la FASE activa (no del total), como muestra Steam. */
  updateProgress?: number
  /** Fase activa cuando updateState === 'updating'. */
  updatePhase?: UpdatePhase
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
  /** Estado de actualización (Steam). Ausente → tratar como 'ready'. */
  updateState?: UpdateState
  /** Progreso 0–1 de la fase activa cuando updateState === 'updating'. */
  updateProgress?: number
  /** Fase activa cuando updateState === 'updating'. */
  updatePhase?: UpdatePhase
}

import type { Game, LaunchStatus } from '../../../preload'
import './LaunchOverlay.css'

/** Texto en pantalla para cada estado del flujo de lanzamiento. */
const STATUS_LABEL: Record<LaunchStatus, string> = {
  idle: '',
  'checking-updates': 'Verificando actualizaciones…',
  updating: 'Descargando actualización…',
  verifying: 'Verificando archivos…',
  repairing: 'Reparando archivos…',
  launching: 'Iniciando juego…',
  running: '¡Listo! Iniciando…',
  error: 'Algo salió mal'
}

interface LaunchOverlayProps {
  game: Game
  status: LaunchStatus
  error: string | null
  onRetry: () => void
  onCancel: () => void
}

/**
 * Overlay a pantalla completa durante el flujo verify/launch. Muestra el nombre
 * del juego, un indicador animado y el estado actual; en error ofrece reintentar
 * o cancelar.
 */
export function LaunchOverlay({
  game,
  status,
  error,
  onRetry,
  onCancel
}: LaunchOverlayProps): JSX.Element {
  const isError = status === 'error'
  const isRunning = status === 'running'

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__panel">
        <h2 className="launch-overlay__title">{game.title}</h2>

        {isError ? (
          <>
            <p className="launch-overlay__error">{error ?? STATUS_LABEL.error}</p>
            <div className="launch-overlay__actions">
              <button className="launch-overlay__btn" onClick={onRetry}>
                Reintentar · A
              </button>
              <button className="launch-overlay__btn" onClick={onCancel}>
                Cancelar · B
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={
                'launch-overlay__spinner' +
                (isRunning ? ' launch-overlay__spinner--done' : '')
              }
            />
            <p className="launch-overlay__status">{STATUS_LABEL[status]}</p>
            {!isRunning && <p className="launch-overlay__hint">B para cancelar</p>}
          </>
        )}
      </div>
    </div>
  )
}

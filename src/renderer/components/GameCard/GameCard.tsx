import type { Game, UpdateInfo } from '../../../preload'
import './GameCard.css'

interface GameCardProps {
  game: Game
  /** URL de la portada vertical (grid), o null si aún no hay artwork. */
  grid: string | null
  selected: boolean
  /** Estado de actualización del juego, o undefined si aún no se conoce. */
  update?: UpdateInfo
}

/**
 * Card individual del carousel con la portada vertical del juego.
 * La seleccionada crece y recibe un glow con el color de acento (estilo PS5).
 * Si el juego se está actualizando o tiene una actualización pendiente, pinta un
 * badge (punto de estado) en la esquina y, mientras actualiza, una barra
 * indeterminada abajo — sin porcentajes, sólo la señal de que está en proceso.
 */
export function GameCard({ game, grid, selected, update }: GameCardProps): JSX.Element {
  const state = update?.updateState ?? 'ready'

  return (
    <div className={'game-card' + (selected ? ' game-card--selected' : '')}>
      {grid ? (
        <img className="game-card__img" src={grid} alt={game.title} loading="lazy" />
      ) : (
        <div className="game-card__placeholder">
          <span className="game-card__emoji">
            {game.platform === 'steam' ? '🎮' : game.platform === 'ubisoft' ? '🌀' : '🧩'}
          </span>
          <span className="game-card__name">{game.title}</span>
        </div>
      )}

      {state !== 'ready' && (
        <div className={`game-card__badge game-card__badge--${state}`} />
      )}

      {state === 'updating' && (
        <div className="game-card__progress">
          <div className="game-card__progress-bar game-card__progress-bar--indeterminate" />
        </div>
      )}
    </div>
  )
}

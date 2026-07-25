import type { Game } from '../../../preload'
import './GameCard.css'

interface GameCardProps {
  game: Game
  /** URL de la portada vertical (grid), o null si aún no hay artwork. */
  grid: string | null
  selected: boolean
}

/**
 * Card individual del carousel con la portada vertical del juego.
 * La seleccionada crece y recibe un glow con el color de acento (estilo PS5).
 */
export function GameCard({ game, grid, selected }: GameCardProps): JSX.Element {
  return (
    <div className={'game-card' + (selected ? ' game-card--selected' : '')}>
      {grid ? (
        <img className="game-card__img" src={grid} alt={game.title} loading="lazy" />
      ) : (
        <div className="game-card__placeholder">
          <span className="game-card__emoji">
            {game.platform === 'steam' ? '🎮' : '🧩'}
          </span>
          <span className="game-card__name">{game.title}</span>
        </div>
      )}
    </div>
  )
}

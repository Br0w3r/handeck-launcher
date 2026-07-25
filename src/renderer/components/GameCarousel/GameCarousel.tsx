import type { CSSProperties } from 'react'

import type { Game } from '../../../preload'
import { gameKey, type ArtworkMap } from '../../hooks/useArtwork'
import { GameCard } from '../GameCard/GameCard'
import './GameCarousel.css'

interface GameCarouselProps {
  games: Game[]
  artwork: ArtworkMap
  selectedIndex: number
}

/**
 * Carousel horizontal tipo PS5. El track se desplaza con un transform para
 * mantener siempre centrada la card seleccionada (`--i` = índice seleccionado).
 */
export function GameCarousel({
  games,
  artwork,
  selectedIndex
}: GameCarouselProps): JSX.Element {
  return (
    <div className="carousel">
      <div className="carousel__track" style={{ '--i': selectedIndex } as CSSProperties}>
        {games.map((game, index) => (
          <GameCard
            key={gameKey(game)}
            game={game}
            grid={artwork[gameKey(game)]?.grid ?? null}
            selected={index === selectedIndex}
          />
        ))}
      </div>
    </div>
  )
}

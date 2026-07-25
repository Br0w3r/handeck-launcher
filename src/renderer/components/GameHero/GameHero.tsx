import './GameHero.css'

interface GameHeroProps {
  /** URL de la imagen hero del juego seleccionado, o null. */
  heroUrl: string | null
}

/**
 * Fondo hero a pantalla completa del juego seleccionado (estilo PS5).
 * Usa dos capas con crossfade por `key` para que el cambio de imagen sea suave.
 */
export function GameHero({ heroUrl }: GameHeroProps): JSX.Element {
  return (
    <div className="game-hero">
      {heroUrl && (
        <div
          key={heroUrl}
          className="game-hero__layer"
          style={{ backgroundImage: `url("${heroUrl}")` }}
        />
      )}
      <div className="game-hero__scrim" />
    </div>
  )
}

import { useEffect, useState } from 'react'

import type { ArtworkUrls, Game } from '../../preload'

/**
 * useArtwork — pide al main el artwork (grid + hero) de cada juego vía IPC.
 * Devuelve un mapa `${platform}:${id}` → ArtworkUrls que se va llenando a medida
 * que llegan las respuestas (la primera carga puede descargar de SteamGridDB).
 */
export type ArtworkMap = Record<string, ArtworkUrls>

export function gameKey(game: Game): string {
  return `${game.platform}:${game.id}`
}

export function useArtwork(games: Game[]): ArtworkMap {
  const [artwork, setArtwork] = useState<ArtworkMap>({})

  useEffect(() => {
    if (!window.handeck || games.length === 0) return
    let cancelled = false

    void (async () => {
      for (const game of games) {
        try {
          const art = await window.handeck.getArtwork(game)
          if (cancelled) return
          setArtwork((prev) => ({ ...prev, [gameKey(game)]: art }))
        } catch {
          // Silencioso: sin artwork se usa el fallback de texto.
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [games])

  return artwork
}
